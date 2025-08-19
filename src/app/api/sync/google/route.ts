import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { getGoogleAccessTokenForUser } from "@/lib/google-oauth";
import { authOptions } from "@/lib/auth";
import { SyncGoogleSchema } from "@/lib/validate";
import { enforceRateLimit } from "@/lib/ratelimit";
import { zodError } from "@/lib/validate";

const BASE = "https://mybusiness.googleapis.com/v4";

// Max number of reviews to sync in one request (pagination)
const SYNC_PAGE_SIZE = 50;
// Max number of months to look back for reviews
const MAX_MONTHS_BACK = 12;

export async function POST(req: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Rate limit by user ID
    await enforceRateLimit(req, "google-sync", session.user.id, 5, "1 m");

    // Validate request body
    const parsed = SyncGoogleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(zodError(parsed.error), { 
        status: 400, 
        headers: { "content-type": "application/json" } 
      });
    }
    const { providerLocationId } = parsed.data;

    // Get location source with org context
    const location = await prisma.location.findFirst({
      where: {
        sources: {
          some: {
            provider: "google",
            providerLocationId,
          }
        },
        // Ensure the location belongs to the user's org
        org: {
          memberships: {
            some: { userId: session.user.id }
          }
        }
      },
      select: {
        id: true,
        orgId: true,
        sources: {
          where: {
            provider: "google",
            providerLocationId
          },
          select: {
            id: true
          }
        }
      }
    });

    if (!location || location.sources.length === 0) {
      return new Response("Location not found or access denied", { status: 404 });
    }

    const orgId = location.orgId;
    const token = await getGoogleAccessTokenForUser(session.user.id);
    let pageToken: string | undefined;
    let imported = 0;
    const since = new Date();
    since.setMonth(since.getMonth() - MAX_MONTHS_BACK);

    // Process reviews in batches
    do {
      const url = new URL(`${BASE}/accounts/-/locations/${encodeURIComponent(providerLocationId)}/reviews`);
      url.searchParams.set("pageSize", SYNC_PAGE_SIZE.toString());
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await fetch(url, { 
        headers: { 
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache"
        },
        cache: "no-store" 
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Google API error:", error);
        return new Response(`Google API error: ${error}`, { status: response.status });
      }

      const data = await response.json();
      const reviews = data.reviews || [];

      // Process reviews in a transaction
      await prisma.$transaction(async (tx) => {
        for (const rev of reviews) {
          const created = new Date(rev.createTime || rev.updateTime || Date.now());
          
          // Skip old reviews
          if (created < since) continue;

          // Prepare review data
          const reviewData = {
            orgId,
            locationId: location.id,
            provider: "google" as const,
            providerReviewId: rev.reviewId,
            externalId: rev.reviewId,
            rating: rev.starRating ? Number(rev.starRating) : rev.rating ?? null,
            authorName: rev.reviewer?.displayName || null,
            authorProfileUrl: rev.reviewer?.profilePhotoUrl || null,
            authorUrl: rev.reviewer?.profileUrl || null,
            text: rev.comment || null,
            platformUrl: rev.name ? `https://search.google.com/local/reviews?authuser=0&hl=en&q=${encodeURIComponent(rev.name)}` : null,
            createdAt: created,
            updatedAt: rev.updateTime ? new Date(rev.updateTime) : created,
            raw: rev,
          };

          // Upsert review
          await tx.review.upsert({
            where: { 
              provider_providerReviewId: { 
                provider: "google", 
                providerReviewId: rev.reviewId 
              } 
            },
            update: reviewData,
            create: reviewData,
          });

          imported += 1;
        }
      });

      pageToken = data.nextPageToken;
    } while (pageToken);

    return Response.json({ 
      ok: true, 
      imported,
      message: `Successfully imported ${imported} reviews`
    });

  } catch (error) {
    console.error("Error in Google sync:", error);
    const status = error instanceof Response ? error.status : 500;
    return new Response(
      status === 429 ? "Too Many Requests" : "Internal Server Error",
      { status }
    );
  }
}
