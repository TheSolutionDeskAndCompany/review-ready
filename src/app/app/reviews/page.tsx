import { prisma } from "@/lib/db";
import Link from "next/link";
import type { Metadata } from "next";
import ReviewsTable from "@/components/reviews/reviews-table";
import ReviewFilters from "@/components/reviews/review-filters";
import ExportCsvButton from "@/components/reviews/export-csv-button";
import ExportCsvAllButton from "@/components/reviews/export-csv-all-button";

export const metadata: Metadata = { title: "Reviews • ReviewReady" };

type SP = { provider?: string; min?: string; unreplied?: string };

export default async function ReviewsPage({ searchParams }: { searchParams: SP }) {
  const where: any = {};

  // Provider filter
  const allowed = new Set(["google", "yelp", "facebook"]);
  if (searchParams.provider && allowed.has(searchParams.provider)) {
    where.provider = searchParams.provider;
  }

  // Min stars
  if (searchParams.min) {
    const n = parseInt(searchParams.min, 10);
    if (!Number.isNaN(n)) where.rating = { gte: n };
  }

  // Unreplied only (no posted replies)
  if (searchParams.unreplied === "1") {
    where.replies = { none: { status: "posted" } };
  }

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { 
      id: true, 
      provider: true, 
      rating: true, 
      authorName: true, 
      text: true, 
      createdAt: true,
      replies: {
        where: { status: "posted" },
        take: 1,
        select: { id: true },
      },
    },
  });

  const rows = reviews.map((r) => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? null,
    hasReplies: r.replies.length > 0,
  }));

  const total = reviews.length;
  const startIdx = 1;
  const endIdx = total;
  const page = 1;
  const pageCount = Math.ceil(total / 50);
  const prevParams = new URLSearchParams(searchParams);
  prevParams.set("page", (page - 1).toString());
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set("page", (page + 1).toString());
  const canPrev = page > 1;
  const canNext = page < pageCount;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <Link href="/pricing" className="text-sm underline">Upgrade</Link>
      </div>

      <ReviewFilters />

      <div className="rounded-2xl border overflow-hidden">
        <ReviewsTable reviews={rows} />
        <div className="flex items-center justify-between p-4">
          <div className="text-sm text-muted-foreground" aria-live="polite">
            {total > 0
              ? `Showing ${startIdx}–${endIdx} of ${total} reviews`
              : "Showing 0 reviews"}
          </div>
          <div className="flex items-center gap-2">
            <ExportCsvButton rows={rows as any} />
            <ExportCsvAllButton />
            <Link
              href={`/app/reviews?${prevParams.toString()}`}
              aria-disabled={!canPrev}
              className={`px-2 py-1 rounded border text-xs ${!canPrev ? "pointer-events-none opacity-50" : ""}`}
            >
              ← Previous
            </Link>
            <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
            <Link
              href={`/app/reviews?${nextParams.toString()}`}
              aria-disabled={!canNext}
              className={`px-2 py-1 rounded border text-xs ${!canNext ? "pointer-events-none opacity-50" : ""}`}
            >
              Next →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
