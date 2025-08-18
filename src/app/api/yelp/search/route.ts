import { NextResponse } from "next/server";
import { YelpService } from "@/lib/services/yelp";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const location = searchParams.get("location") || "";
  const limit = parseInt(searchParams.get("limit") || "5");

  if (!query || !location) {
    return NextResponse.json(
      { error: "Query and location parameters are required" },
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
    const businesses = await yelpService.searchBusinesses(query, location, limit);
    return NextResponse.json(businesses);
  } catch (error) {
    console.error("Yelp search error:", error);
    return NextResponse.json(
      { error: "Failed to search Yelp businesses" },
      { status: 500 }
    );
  }
}
