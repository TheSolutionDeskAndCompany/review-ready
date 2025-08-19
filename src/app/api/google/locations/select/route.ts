import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { getOrCreateOrgForUser } from "@/lib/org";
import { authOptions } from "@/lib/auth";
import { SelectLocationsSchema } from "@/lib/validate";
import { enforceRateLimit } from "@/lib/ratelimit";
import { zodError } from "@/lib/validate";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Rate limit by user ID
    await enforceRateLimit(req, "location-select", session.user.id, 10, "1 m");

    // Get or create organization for the user
    const orgId = await getOrCreateOrgForUser(session.user.id);

    // Validate request body
    const body = await req.json();
    const parsed = SelectLocationsSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(zodError(parsed.error), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const { selected } = parsed.data;

    // Process each selected location in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of selected) {
        // Create or update location
        const loc = await tx.location.upsert({
          where: { id: `${orgId}:${item.providerLocationId}` },
          update: { 
            name: item.title, 
            address: item.address || null,
            orgId, // Ensure orgId is set on update too
          },
          create: { 
            id: `${orgId}:${item.providerLocationId}`, 
            orgId, 
            name: item.title, 
            address: item.address || null 
          },
        });

        // Create or update location source
        await tx.locationSource.upsert({
          where: { 
            provider_providerLocationId: { 
              provider: "google", 
              providerLocationId: item.providerLocationId 
            } 
          },
          update: { 
            locationId: loc.id, 
            providerPlaceUrl: null,
            orgId, // Ensure orgId is set on update too
          },
          create: { 
            locationId: loc.id, 
            provider: "google", 
            providerLocationId: item.providerLocationId,
            orgId,
          },
        });

        results.push({
          providerLocationId: item.providerLocationId,
          success: true,
        });
      }
      return results;
    });

    return Response.json({ 
      ok: true, 
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in location selection:", error);
    const status = error instanceof Response ? error.status : 500;
    return new Response(
      status === 429 ? "Too Many Requests" : "Internal Server Error",
      { status }
    );
  }
}
