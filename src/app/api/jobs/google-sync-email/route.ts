import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getGoogleAccessTokenForUser } from "@/lib/google-oauth";
import { reviewsToCsv } from "@/lib/csv";
import { resend, FROM_EMAIL } from "@/lib/email";

const BASE = "https://mybusiness.googleapis.com/v4";

async function importGoogleReviewsForLocation({
  token,
  providerLocationId,
  orgId,
  locationId,
  months = 12,
}: {
  token: string;
  providerLocationId: string;
  orgId: string;
  locationId: string;
  months?: number;
}) {
  let pageToken: string | undefined;
  let imported = 0;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  do {
    const url = new URL(
      `${BASE}/accounts/-/locations/${encodeURIComponent(providerLocationId)}/reviews`
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();

    for (const rev of data.reviews || []) {
      const created = new Date(rev.createTime || rev.updateTime || Date.now());
      if (created < since) continue;

      await prisma.review.upsert({
        where: {
          provider_providerReviewId: {
            provider: "google",
            providerReviewId: rev.reviewId,
          },
        },
        update: {
          rating: rev.starRating ? Number(rev.starRating) : rev.rating ?? null,
          authorName: rev.reviewer?.displayName || null,
          authorProfileUrl: rev.reviewer?.profilePhotoUrl || null,
          text: rev.comment || null,
          createdAt: created,
          updatedAt: rev.updateTime ? new Date(rev.updateTime) : created,
          raw: rev,
          locationId,
          orgId,
        },
        create: {
          orgId,
          locationId,
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

  return imported;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  if (!session.user.email)
    return new Response("User missing email", { status: 400 });
  if (!process.env.RESEND_API_KEY || !FROM_EMAIL)
    return new Response("Email not configured", { status: 501 });

  const body = await req.json().catch(() => ({}));
  const providerLocationIds: string[] = Array.isArray(body?.providerLocationIds)
    ? body.providerLocationIds
    : [];
  const months = Number.isFinite(body?.months) ? Math.max(1, Math.min(36, body.months)) : 12;
  const syncAll = body?.all === true;

  const token = await getGoogleAccessTokenForUser(session.user.id);

  // Determine which locations to sync (from DB)
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) return new Response("No membership", { status: 404 });

  const locSources = await prisma.locationSource.findMany({
    where: {
      provider: "google",
      ...(syncAll
        ? { location: { orgId: membership.orgId } }
        : providerLocationIds.length
        ? { providerLocationId: { in: providerLocationIds } }
        : { providerLocationId: "" }), // force none if nothing passed and not syncAll
    },
    select: { providerLocationId: true, locationId: true, location: { select: { orgId: true, name: true } } },
    orderBy: { providerLocationId: "asc" },
  });

  if (!locSources.length)
    return new Response("No matching locations", { status: 400 });

  // Run imports sequentially (safer with rate limits)
  let totalImported = 0;
  for (const s of locSources) {
    totalImported += await importGoogleReviewsForLocation({
      token,
      providerLocationId: s.providerLocationId,
      orgId: s.location.orgId,
      locationId: s.locationId,
      months,
    });
  }

  // Query all reviews (filtered to the set of locations we just synced) for CSV
  const reviews = await prisma.review.findMany({
    where: { provider: "google", locationId: { in: locSources.map((s) => s.locationId) } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      rating: true,
      authorName: true,
      text: true,
      createdAt: true,
    },
  });

  const rows = reviews.map((r) => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? null,
  }));
  const csv = reviewsToCsv(rows);

  // Send email with CSV attachment
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const filename = `reviewready-google-reviews-${ts}.csv`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: session.user.email,
    subject: `ReviewReady: ${rows.length} reviews exported (Google)`,
    text: `Hi! We just synced ${totalImported} review(s) and attached a CSV with ${rows.length} rows.`,
    attachments: [
      {
        filename,
        content: Buffer.from(csv, "utf8"),
      },
    ],
  });

  return Response.json({
    ok: true,
    syncedLocations: locSources.length,
    imported: totalImported,
    emailed: true,
    rows: rows.length,
  });
}
