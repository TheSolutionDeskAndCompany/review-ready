import { prisma } from "@/lib/db";
import Link from "next/link";
import type { Metadata } from "next";
import ReviewsTable from "@/components/reviews/reviews-table";
import ReviewFilters from "@/components/reviews/review-filters";
import ExportCsvButton from "@/components/reviews/export-csv-button";
import ExportCsvAllButton from "@/components/reviews/export-csv-all-button";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import type { Prisma, Provider } from "@prisma/client";

export const metadata: Metadata = { title: "Reviews • ReviewReady" };

type SP = { provider?: string; min?: string; unreplied?: string; page?: string; size?: string };

export default async function ReviewsPage({ searchParams }: { searchParams: SP }) {
  // Resolve org for current user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null; // or redirect to sign in

  const membership = await prisma.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return null; // or redirect to onboarding
  const orgId = membership.orgId;

  // Filters with proper Prisma types
  const where: Prisma.ReviewWhereInput = { orgId };
  
  // Safely handle provider filter
  if (searchParams.provider) {
    const provider = searchParams.provider as string;
    if (['google', 'yelp', 'facebook'].includes(provider)) {
      where.provider = provider as Provider;
    }
  }
  if (searchParams.min) {
    const n = parseInt(searchParams.min, 10);
    if (!Number.isNaN(n)) where.rating = { gte: n };
  }
  if (searchParams.unreplied === "1") {
    where.replies = { none: { status: "posted" } };
  }

  // Pagination + size
  const allowedSizes = [25, 50, 100] as const;
  const sizeRaw = parseInt(searchParams.size || "50", 10);
  const pageSize = (allowedSizes as readonly number[]).includes(sizeRaw) ? sizeRaw : 50;

  const pageRaw = parseInt(searchParams.page || "1", 10);
  const page = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw);
  const skip = (page - 1) * pageSize;

  // Query
  const [rowsRaw, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
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
        _count: {
          select: { replies: true }
        }
      },
    }),
    prisma.review.count({ where }),
  ]);

  interface ReviewWithCount extends Omit<typeof rowsRaw[0], 'replies'> {
    _count: { replies: number };
  }

  const rows = rowsRaw.map((r) => {
    const review = r as unknown as ReviewWithCount;
    return {
      ...r,
      createdAt: r.createdAt?.toISOString() ?? null,
      hasReply: review._count.replies > 0
    };
  });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = total ? skip + 1 : 0;
  const endIdx = skip + rows.length;

  // Build prev/next URLs preserving filters + size
  const baseParams = new URLSearchParams();
  if (searchParams.provider) baseParams.set("provider", searchParams.provider);
  if (searchParams.min) baseParams.set("min", searchParams.min);
  if (searchParams.unreplied === "1") baseParams.set("unreplied", "1");
  baseParams.set("size", String(pageSize));

  const prevParams = new URLSearchParams(baseParams); 
  prevParams.set("page", String(page - 1));
  const nextParams = new URLSearchParams(baseParams); 
  nextParams.set("page", String(page + 1));

  const canPrev = page > 1;
  const canNext = page < pageCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <Link href="/pricing" className="text-sm underline">Upgrade</Link>
      </div>

      <ReviewFilters />

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground" aria-live="polite">
          {total > 0 ? `Showing ${startIdx}–${endIdx} of ${total} reviews` : "Showing 0 reviews"}
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton rows={rows} />
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

      <div className="rounded-2xl border overflow-hidden">
        <ReviewsTable reviews={rows} />
      </div>
    </div>
  );
}
