import { z } from "zod";

// Reply to a review
export const ReplyBodySchema = z.object({
  provider: z.enum(["google", "yelp", "facebook"]),
  body: z.string().min(2).max(4000),
});

// Select GBP locations
export const SelectLocationsSchema = z.object({
  selected: z.array(
    z.object({
      providerLocationId: z.string().min(1),
      title: z.string().min(1),
      address: z.string().optional().nullable(),
    })
  ).min(1).max(50),
});

// One-off Google backfill
export const SyncGoogleSchema = z.object({
  providerLocationId: z.string().min(1),
});

// Enqueue background sync+email job
export const EnqueueJobSchema = z.object({
  all: z.boolean().optional().default(false),
  providerLocationIds: z.array(z.string().min(1)).optional().default([]),
  months: z.number().int().min(1).max(36).optional().default(12),
}).refine(v => v.all || (v.providerLocationIds?.length ?? 0) > 0, {
  message: "Pass all=true or at least one providerLocationId",
  path: ["providerLocationIds"],
});

// Small helper to JSON-400 Zod errors
export function zodError(e: unknown) {
  if (e && typeof e === "object" && "flatten" in e) {
    const err = e as { flatten: () => unknown };
    return JSON.stringify({ error: err.flatten?.() ?? String(e) });
  }
  return JSON.stringify({ error: String(e) });
}
