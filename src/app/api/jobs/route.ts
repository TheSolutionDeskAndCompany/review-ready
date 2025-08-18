import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const membership = await prisma.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return Response.json([]);

  const jobs = await prisma.job.findMany({
    where: { orgId: membership.orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      error: true,
      result: true,
      events: {
        select: { createdAt: true, level: true, message: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  return Response.json(jobs);
}
