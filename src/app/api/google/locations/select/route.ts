import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { getOrCreateOrgForUser } from "@/lib/org";
import { authOptions } from "@/lib/auth";

type Item = { providerLocationId: string; title: string; address?: string };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const orgId = await getOrCreateOrgForUser(session.user.id);

  const { selected } = (await req.json()) as { selected: Item[] };
  if (!Array.isArray(selected) || !selected.length) return new Response("No locations", { status: 400 });

  for (const s of selected) {
    const loc = await prisma.location.upsert({
      where: { id: `${orgId}:${s.providerLocationId}` },
      update: { name: s.title, address: s.address || null },
      create: { id: `${orgId}:${s.providerLocationId}`, orgId, name: s.title, address: s.address || null },
    });
    await prisma.locationSource.upsert({
      where: { provider_providerLocationId: { provider: "google", providerLocationId: s.providerLocationId } },
      update: { locationId: loc.id, providerPlaceUrl: null },
      create: { locationId: loc.id, provider: "google", providerLocationId: s.providerLocationId },
    });
  }

  return Response.json({ ok: true, count: selected.length });
}
