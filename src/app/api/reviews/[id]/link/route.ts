import { prisma } from "@/lib/db";

// Helpers
function fbReviewsLink(pageUrlOrId?: string) {
  if (!pageUrlOrId) return undefined;
  if (/^https?:\/\//i.test(pageUrlOrId)) {
    const trimmed = pageUrlOrId.replace(/\/+$/, "");
    return `${trimmed}/reviews/`;
  }
  return `https://facebook.com/${pageUrlOrId}/reviews/`;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const r = await prisma.review.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      provider: true,
      providerReviewId: true,
      raw: true,
      locationId: true,
    },
  });
  if (!r) return new Response("Not found", { status: 404 });

  // Fetch location sources (yelp/facebook mapping, place URL, etc.)
  const sources = await prisma.locationSource.findMany({
    where: { locationId: r.locationId },
    select: { provider: true, providerLocationId: true, providerPlaceUrl: true },
  });

  // Try provider-specific deep links
  if (r.provider === "yelp") {
    // 1) Use Yelp review URL if it exists in raw payload
    type RawReview = {
      url?: string;
      review?: {
        url?: string;
      };
    };
    const raw = r.raw as RawReview | null;
    const urlFromRaw = raw?.url || raw?.review?.url;
    if (urlFromRaw) return Response.json({ url: urlFromRaw });

    // 2) Otherwise, build biz page + optional hrid from ids we have
    const yelpSource = sources.find((s) => s.provider === "yelp");
    if (yelpSource?.providerLocationId) {
      const base = `https://www.yelp.com/biz/${encodeURIComponent(yelpSource.providerLocationId)}`;
      const url = r.providerReviewId ? `${base}?hrid=${encodeURIComponent(r.providerReviewId)}` : base;
      return Response.json({ url });
    }
  }

  if (r.provider === "facebook") {
    // Use stored Page URL/ID if available
    const fbSource = sources.find((s) => s.provider === "facebook");
    const link = fbReviewsLink(fbSource?.providerPlaceUrl || fbSource?.providerLocationId);
    if (link) return Response.json({ url: link });
  }

  // Optional: for Google we generally don't need a deep link; return 404 to hide button
  return new Response("No link", { status: 404 });
}
