import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function sanitizeForCSV(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Prevent CSV formula injection in spreadsheet apps
  if (/^[=\-+@]/.test(s)) s = "'" + s;
  // Escape quotes by doubling them
  s = s.replace(/"/g, '""');
  // Wrap in quotes if contains special chars
  if (/[",\n\r]/.test(s)) s = `"${s}"`;
  return s;
}

export async function GET(req: Request) {
  // Require sign-in
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || undefined;
  const min = searchParams.get("min") || undefined;
  const unreplied = searchParams.get("unreplied") === "1";

  const allowed = new Set(["google", "yelp", "facebook"]);
  const where: any = {};
  if (provider && allowed.has(provider)) where.provider = provider;
  if (min) {
    const n = parseInt(min, 10);
    if (!Number.isNaN(n)) where.rating = { gte: n };
  }
  if (unreplied) where.replies = { none: { status: "posted" } };

  const encoder = new TextEncoder();
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s));

      // UTF-8 BOM so Excel opens correctly + header
      write("\uFEFFid,provider,rating,authorName,text,createdAt\n");

      const batchSize = 1000;
      let cursor: string | undefined;

      while (true) {
        const batch = await prisma.review.findMany({
          where,
          orderBy: { id: "asc" },                // stable pagination
          take: cursor ? batchSize + 1 : batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            provider: true,
            rating: true,
            authorName: true,
            text: true,
            createdAt: true,
          },
        });

        if (batch.length === 0) break;

        for (const r of batch) {
          const line = [
            sanitizeForCSV(r.id),
            sanitizeForCSV(r.provider),
            sanitizeForCSV(r.rating ?? ""),
            sanitizeForCSV(r.authorName ?? ""),
            sanitizeForCSV(r.text ?? ""),
            sanitizeForCSV(r.createdAt?.toISOString() ?? ""),
          ].join(",");
          write(line + "\n");
        }

        // Advance cursor
        cursor = batch[batch.length - 1]?.id;
        if (!cursor || batch.length < (cursor ? batchSize + 1 : batchSize)) break;

        // Yield to avoid blocking
        await new Promise((res) => setTimeout(res, 0));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reviewready-reviews-${ts}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
