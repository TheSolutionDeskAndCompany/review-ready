import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { getGoogleAccessTokenForUser } from "@/lib/google-oauth";
import { authOptions } from "@/lib/auth";

const BASE = "https://mybusiness.googleapis.com/v4";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const token = await getGoogleAccessTokenForUser(session.user.id);

  const { providerLocationId } = await req.json() as { providerLocationId: string };
  if (!providerLocationId) return new Response("Missing providerLocationId", { status: 400 });

  const locSource = await prisma.locationSource.findFirst({ where: { provider: "google", providerLocationId } });
  if (!locSource) return new Response("Location not selected", { status: 404 });

  const orgId = (await prisma.location.findUnique({ where: { id: locSource.locationId } }))?.orgId;
  if (!orgId) return new Response("Location missing org", { status: 404 });

  let pageToken: string | undefined;
  let imported = 0;
  const since = new Date(); since.setMonth(since.getMonth() - 12); // last 12 months

  do {
    const url = new URL(`${BASE}/accounts/-/locations/${encodeURIComponent(providerLocationId)}/reviews`);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!r.ok) return new Response(await r.text(), { status: r.status });
    const data = await r.json();

    for (const rev of (data.reviews || [])) {
      const created = new Date(rev.createTime || rev.updateTime || Date.now());
      if (created < since) continue;

      await prisma.review.upsert({
        where: { provider_providerReviewId: { provider: "google", providerReviewId: rev.reviewId } },
        update: {
          rating: rev.starRating ? Number(rev.starRating) : rev.rating ?? null,
          authorName: rev.reviewer?.displayName || null,
          authorProfileUrl: rev.reviewer?.profilePhotoUrl || null,
          text: rev.comment || null,
          createdAt: created,
          updatedAt: rev.updateTime ? new Date(rev.updateTime) : created,
          raw: rev,
          locationId: locSource.locationId,
          orgId,
        },
        create: {
          orgId,
          locationId: locSource.locationId,
          provider: "google",
          providerReviewId: rev.reviewId,
          rating: rev.starRating ? Number(rev.starRating) : rev.rating ?? null,
          authorName: rev.reviewer?.displayName || null,
          authorProfileUrl: rev.reviewer?.profilePhotoUrl || null,
          text: rev.comment || null,
          createdAt: created,
          updatedAt: rev.updateTime ? new Date(rev.updateTime) : created,
          raw: rev,
        },
      });
      imported += 1;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return Response.json({ ok: true, imported });
}
