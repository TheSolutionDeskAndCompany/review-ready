import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const providerLocationIds: string[] = Array.isArray(body?.providerLocationIds) ? body.providerLocationIds : [];
  const months = Number.isFinite(body?.months) ? Math.max(1, Math.min(36, body.months)) : 12;
  const all = body?.all === true;

  // Resolve org
  const membership = await prisma.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return new Response("No membership", { status: 404 });

  // Create Job
  const job = await prisma.job.create({
    data: {
      type: "google-sync-email",
      status: "queued",
      orgId: membership.orgId,
      userId: session.user.id,
      payload: { providerLocationIds, months, all },
      events: {
        create: [{ message: "Enqueued job", level: "info", meta: { months, all, count: providerLocationIds.length } }],
      },
    },
  });

  // Publish to QStash
  const dest = `${process.env.APP_URL}/api/qstash/jobs/google-sync-email`;
  if (!process.env.UPSTASH_QSTASH_TOKEN) {
    return Response.json({ jobId: job.id, warning: "QStash token missing. Run job manually." });
  }

  const r = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(dest)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_QSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId: job.id }),
  });

  if (!r.ok) {
    const txt = await r.text();
    await prisma.job.update({ 
      where: { id: job.id }, 
      data: { status: "failed", error: `QStash publish failed: ${txt}` } 
    });
    return new Response(`QStash publish failed: ${txt}`, { status: 502 });
  }

  return Response.json({ jobId: job.id, queued: true });
}
