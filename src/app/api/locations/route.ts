import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  // Find org via membership
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) return Response.json([]);

  // Return locations with provider sources (google/yelp/facebook)
  const locs = await prisma.location.findMany({
    where: { orgId: membership.orgId },
    select: {
      id: true,
      name: true,
      address: true,
      sources: {
        select: {
          provider: true,
          providerLocationId: true,
          providerPlaceUrl: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // For convenience, attach googleProviderLocationId if present
  const out = locs.map((l) => {
    const google = l.sources.find((s) => s.provider === "google");
    return {
      id: l.id,
      name: l.name,
      address: l.address,
      googleProviderLocationId: google?.providerLocationId || null,
    };
  });

  return Response.json(out);
}
