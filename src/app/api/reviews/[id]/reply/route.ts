import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleAccessTokenForUser } from "@/lib/google-oauth";
import { ReplyBodySchema, zodError } from "@/lib/validate";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";

// Helper: post a reply to Google Business Profile
async function postGoogleReply(accessToken: string, locationExternalId: string, reviewId: string, body: string) {
  const url = `https://mybusiness.googleapis.com/v4/accounts/-/locations/${encodeURIComponent(locationExternalId)}/reviews/${encodeURIComponent(reviewId)}/reply`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { 
      Authorization: `Bearer ${accessToken}`, 
      "content-type": "application/json" 
    },
    body: JSON.stringify({ comment: body })
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    // Rate limit by user or IP
    await enforceRateLimit(req, "reply", session.user.id || getClientIp(req), 10, "1 m");

    // Validate request body
    const parsed = ReplyBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(zodError(parsed.error), { 
        status: 400, 
        headers: { "content-type": "application/json" } 
      });
    }
    const { provider, body } = parsed.data;

    // Look up the review and verify permissions
    const review = await prisma.review.findUnique({ 
      where: { id: params.id },
      select: { 
        id: true,
        orgId: true,
        locationId: true,
        providerReviewId: true 
      } 
    });
    
    if (!review) {
      return new Response("Review not found", { status: 404 });
    }

    // Verify org membership and permission
    const membership = await prisma.membership.findFirst({ 
      where: { userId: session.user.id },
      select: { orgId: true }
    });
    
    if (!membership) {
      return new Response("No membership found", { status: 403 });
    }
    
    if (review.orgId !== membership.orgId) {
      return new Response("Forbidden", { status: 403 });
    }

    // For non-Google providers, just record a linkout
    if (provider !== "google") {
      await prisma.$executeRaw`
        INSERT INTO review_replies (id, review_id, provider, body, status, org_id, created_at)
        VALUES (
          gen_random_uuid(),
          ${review.id}::uuid,
          ${provider}::provider,
          ${body},
          'linkout'::reply_status,
          ${membership.orgId}::uuid,
          NOW()
        )
      `;
      return Response.json({ status: "linkout" });
    }

    // For Google, we need to post the reply via API
    const locSource = await prisma.locationSource.findFirst({
      where: { 
        locationId: review.locationId, 
        provider: "google" 
      } 
    });
    
    if (!locSource?.providerLocationId) {
      return new Response("Google location mapping not found", { status: 400 });
    }

    // Get Google access token
    const token = await getGoogleAccessTokenForUser(session.user.id);

    // Post reply to Google
    await postGoogleReply(token, locSource.providerLocationId, review.providerReviewId, body);
    
    // Record the reply in our database using raw SQL to avoid type issues
    await prisma.$executeRaw`
      INSERT INTO review_replies (
        id, review_id, provider, body, status, org_id, posted_at, created_at
      ) VALUES (
        gen_random_uuid(),
        ${review.id}::uuid,
        'google'::provider,
        ${body},
        'posted'::reply_status,
        ${membership.orgId}::uuid,
        NOW(),
        NOW()
      )
    `;
    
    return Response.json({ status: "posted" });
  } catch (e: unknown) {
    const status = e instanceof Response ? e.status : 500;
    return new Response(
      status === 429 ? "Too Many Requests" : String(e?.message || e), 
      { status }
    );
  }
}
