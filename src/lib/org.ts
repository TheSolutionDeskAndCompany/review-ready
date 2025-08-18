import { prisma } from "@/lib/db";

export async function getOrCreateOrgForUser(userId: string) {
  const m = await prisma.membership.findFirst({ where: { userId } });
  if (m) return m.orgId;
  const org = await prisma.organization.create({ data: { name: "My Business" } });
  await prisma.membership.create({ data: { orgId: org.id, userId, role: "owner" } });
  return org.id;
}
