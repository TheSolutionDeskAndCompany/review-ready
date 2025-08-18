import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { getGoogleAccessTokenForUser } from "@/lib/google-oauth";
import { authOptions } from "@/lib/auth";

// Helper: post a reply to Google Business Profile
async function postGoogleReply(accessToken: string, locationExternalId: string, reviewId: string, body: string) {
  const url = `https://mybusiness.googleapis.com/v4/accounts/-/locations/${encodeURIComponent(
    locationExternalId
  )}/reviews/${encodeURIComponent(reviewId)}/reply`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ comment: body }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`GBP reply failed: ${res.status} ${msg}`);
  }
  return true;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { provider, body } = (await req.json()) as { provider: "google" | "yelp" | "facebook"; body: string };
  if (!body || !body.trim()) return new Response("Missing body", { status: 400 });

  // Look up the review (to locate its location/org)
  const review = await prisma.review.findUnique({ where: { id: params.id } });
  if (!review) return new Response("Review not found", { status: 404 });

  // Gate non-Google providers
  if (provider !== "google") {
    // record a linkout attempt for audit
    await prisma.reviewReply.create({
      data: { reviewId: review.id, provider, body, status: "linkout" },
    });
    return Response.json({ status: "linkout" });
  }

  // Find the mapped Google location id for this review's location
  const locSource = await prisma.locationSource.findFirst({
    where: { locationId: review.locationId, provider: "google" },
  });
  if (!locSource?.providerLocationId) return new Response("Google location mapping not found", { status: 400 });

  // (Optional) require active subscription before posting
  // const membership = await prisma.membership.findFirst({ where: { userId: session.user.id } });
  // if (!membership) return new Response("No membership", { status: 403 });
  // const sub = await prisma.subscription.findUnique({ where: { orgId: membership.orgId } });
  // if (!sub || (sub.status !== "active" && sub.status !== "trialing")) return new Response("Upgrade required", { status: 402 });

  // Acquire/refresh Google access token via NextAuth account
  const token = await getGoogleAccessTokenForUser(session.user.id);

  // Post reply to GBP
  await postGoogleReply(token, locSource.providerLocationId, review.providerReviewId, body);

  // Persist the reply
  await prisma.reviewReply.create({
    data: { reviewId: review.id, provider: "google", body, status: "posted", postedAt: new Date() },
  });

  return Response.json({ status: "posted" });
}
