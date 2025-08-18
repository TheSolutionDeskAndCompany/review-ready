import { prisma } from "@/lib/db";
import { getGoogleAccessTokenForUser } from "@/lib/google-oauth";
import { reviewsToCsv } from "@/lib/csv";
import { resend, FROM_EMAIL } from "@/lib/email";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

const BASE = "https://mybusiness.googleapis.com/v4";

async function log(jobId: string, message: string, meta?: any, level: "info" | "error" = "info") {
  await prisma.jobEvent.create({ data: { jobId, message, meta, level } });
}

async function importGoogleReviewsForLocation(args: {
  token: string;
  providerLocationId: string;
  orgId: string;
  locationId: string;
  months: number;
  jobId: string;
}) {
  const { token, providerLocationId, orgId, locationId, months, jobId } = args;
  let pageToken: string | undefined;
  let imported = 0;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  do {
    const url = new URL(
      `${BASE}/accounts/-/locations/${encodeURIComponent(providerLocationId)}/reviews`
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) {
      const msg = await r.text();
      await log(jobId, "Google API error", { status: r.status, msg }, "error");
      throw new Error(msg);
    }
    const data = await r.json();

    for (const rev of data.reviews || []) {
      const created = new Date(rev.createTime || rev.updateTime || Date.now());
      if (created < since) continue;

      await prisma.review.upsert({
        where: {
          provider_providerReviewId: {
            provider: "google",
            providerReviewId: rev.reviewId,
          },
        },
        update: {
          rating: rev.starRating ? Number(rev.starRating) : rev.rating ?? null,
          authorName: rev.reviewer?.displayName || null,
          authorProfileUrl: rev.reviewer?.profilePhotoUrl || null,
          text: rev.comment || null,
          createdAt: created,
          updatedAt: rev.updateTime ? new Date(rev.updateTime) : created,
          raw: rev,
          locationId,
          orgId,
        },
        create: {
          orgId,
          locationId,
          provider: "google",
          providerReviewId: rev.reviewId,
          rating: rev.starRating ? Number(rev.starRating) : rev.rating ?? null,
          authorName: rev.reviewer?.displayName || null,
          authorProfileUrl: rev.reviewer?.profilePhotoUrl || null,
          text: rev.comment || null,
          createdAt: created,
          updatedAt: rev.updateTime ? new Date(rev.updateTime) : created,
          raw: rev,
        },
      });
      imported += 1;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return imported;
}

async function handler(req: Request) {
  // Body from enqueue route
  const { jobId } = await req.json().catch(() => ({}));
  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return new Response("Job not found", { status: 404 });
  if (job.status !== "queued") return new Response("Job already processed", { status: 409 });

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });
  await log(jobId, "Job started", { payload: job.payload });

  try {
    // Resolve org + user
    const { orgId, userId } = job;
    if (!orgId || !userId) throw new Error("Missing orgId/userId on job");

    // Token for the user (NextAuth Account refresh if needed)
    const token = await getGoogleAccessTokenForUser(userId);

    // Which locations?
    const { all, providerLocationIds = [], months = 12 } = (job.payload as any) || {};
    const locSources = await prisma.locationSource.findMany({
      where: {
        provider: "google",
        ...(all
          ? { location: { orgId } }
          : providerLocationIds.length
          ? { providerLocationId: { in: providerLocationIds as string[] } }
          : { providerLocationId: "" }),
      },
      select: {
        providerLocationId: true,
        locationId: true,
        location: { select: { name: true, orgId: true } },
      },
      orderBy: { providerLocationId: "asc" },
    });
    if (!locSources.length) throw new Error("No matching Google locations");

    // Import sequentially (API-friendly)
    let totalImported = 0;
    for (const s of locSources) {
      await log(jobId, "Syncing location", {
        providerLocationId: s.providerLocationId,
        locationId: s.locationId,
      });
      totalImported += await importGoogleReviewsForLocation({
        token,
        providerLocationId: s.providerLocationId,
        orgId: s.location.orgId,
        locationId: s.locationId,
        months,
        jobId,
      });
    }

    // Build CSV of all Google reviews for those locationIds
    const reviews = await prisma.review.findMany({
      where: {
        provider: "google",
        locationId: { in: locSources.map((s) => s.locationId) },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        rating: true,
        authorName: true,
        text: true,
        createdAt: true,
      },
    });
    const rows = reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt?.toISOString() ?? null,
    }));
    const csv = reviewsToCsv(rows);

    // Email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) throw new Error("User email not found");
    if (!process.env.RESEND_API_KEY || !FROM_EMAIL)
      throw new Error("Email not configured");

    const ts = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d+Z$/, "Z");
    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `ReviewReady: ${rows.length} reviews exported (Google)`,
      text: `Synced ${totalImported} new review(s). CSV includes ${rows.length} rows.`,
      attachments: [
        {
          filename: `reviewready-google-reviews-${ts}.csv`,
          content: Buffer.from(csv, "utf8"),
        },
      ],
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        result: {
          imported: totalImported,
          rows: rows.length,
          locations: locSources.length,
        },
      },
    });
    await log(jobId, "Job succeeded", {
      imported: totalImported,
      rows: rows.length,
      locations: locSources.length,
    });

    return Response.json({ ok: true });
  } catch (e: any) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error: String(e?.message || e),
      },
    });
    await log(
      jobId,
      "Job failed",
      { error: String(e?.message || e) },
      "error"
    );
    return new Response("Job failed", { status: 500 });
  }
}

// Verify QStash signature if keys are set; else run handler directly (useful in dev)
export const POST =
  process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
    ? verifySignatureAppRouter(handler)
    : handler;
