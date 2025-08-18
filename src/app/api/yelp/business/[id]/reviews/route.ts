import { NextResponse } from "next/server";
import { YelpService } from "@/lib/services/yelp";
import { auth } from "@/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "3");
  const businessId = params.id;

  if (!businessId) {
    return NextResponse.json(
      { error: "Business ID is required" },
      { status: 400 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const yelpApiKey = process.env.YELP_API_KEY;
  if (!yelpApiKey) {
    return NextResponse.json(
      { error: "Yelp API key not configured" },
      { status: 500 }
    );
  }

  const yelpService = new YelpService(yelpApiKey);

  try {
    const reviews = await yelpService.getBusinessReviews(businessId, limit);
    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Error fetching Yelp reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch Yelp reviews" },
      { status: 500 }
    );
  }
}
