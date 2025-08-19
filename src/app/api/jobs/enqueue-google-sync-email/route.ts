import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { EnqueueJobSchema } from "@/lib/validate";
import { enforceRateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Rate limit by user ID
    await enforceRateLimit(req, "enqueue-job", session.user.id, 5, "1 m");

    // Validate request body
    const parsed = EnqueueJobSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const { providerLocationIds, months, all } = parsed.data;

    // Resolve org membership
    const membership = await prisma.membership.findFirst({ 
      where: { userId: session.user.id },
      select: { orgId: true }
    });
    
    if (!membership) {
      return new Response("No organization membership found", { status: 404 });
    }

    // Verify location access if specific locations are provided
    if (!all && providerLocationIds.length > 0) {
      // First check if locations exist in the org
      const orgLocations = await prisma.location.findMany({
        where: {
          orgId: membership.orgId,
          sources: {
            some: {
              provider: "google",
              providerLocationId: { in: providerLocationIds }
            }
          }
        },
        select: {
          sources: {
            where: {
              provider: "google",
              providerLocationId: { in: providerLocationIds }
            },
            select: { providerLocationId: true }
          }
        }
      });

      const accessibleLocationIds = new Set(
        orgLocations.flatMap(loc => 
          loc.sources.map(s => s.providerLocationId)
        )
      );

      // Check if all requested locations are accessible
      const missingLocations = providerLocationIds.filter(
        id => !accessibleLocationIds.has(id)
      );

      if (missingLocations.length > 0) {
        return new Response(
          `Access denied or locations not found: ${missingLocations.join(", ")}`, 
          { status: 403 }
        );
      }
    }

    // Create job using raw SQL to avoid Prisma type issues
    interface JobPayload {
      providerLocationIds: string[];
      months: number;
      all: boolean;
    }

    interface JobResult {
      id: string;
      type: string;
      status: string;
      orgId: string;
      userId: string;
      payload: JobPayload;
      createdAt: Date;
    }
    
    const jobResults = await prisma.$queryRaw<JobResult[]>`
      WITH new_job AS (
        INSERT INTO "Job" (id, type, status, "orgId", "userId", payload, "createdAt")
        VALUES (
          gen_random_uuid()::text,
          'google-sync-email',
          'queued',
          ${membership.orgId},
          ${session.user.id},
          ${JSON.stringify({ providerLocationIds, months, all })}::jsonb,
          NOW()
        )
        RETURNING *
      ),
      job_event AS (
        INSERT INTO "JobEvent" (id, "jobId", level, message, meta, "createdAt")
        SELECT 
          gen_random_uuid()::text,
          id,
          'info',
          'Enqueued job',
          ${JSON.stringify({ 
            months, 
            all, 
            locationCount: all ? "all" : providerLocationIds.length,
            userId: session.user.id 
          })}::jsonb,
          NOW()
        FROM new_job
      )
      SELECT * FROM new_job;
    `;

    if (!jobResults || jobResults.length === 0) {
      throw new Error("Failed to create job");
    }
    
    // Type assertion since we know the shape of the result
    const job = jobResults[0] as JobResult;

    // Publish to QStash if configured
    const dest = `${process.env.APP_URL}/api/qstash/jobs/google-sync-email`;
    if (!process.env.UPSTASH_QSTASH_TOKEN) {
      return Response.json({ 
        jobId: job.id, 
        warning: "QStash token not configured. Job queued but not triggered automatically.",
      });
    }

    // Publish job to QStash
    const response = await fetch(
      `https://qstash.upstash.io/v2/publish/${encodeURIComponent(dest)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_QSTASH_TOKEN}`,
          "Content-Type": "application/json",
          "Upstash-Delay": "1s", // Small delay to ensure job is committed to DB
        },
        body: JSON.stringify({ jobId: job.id }),
      }
    );

    // Handle QStash response
    if (!response.ok) {
      const error = await response.text();
      await prisma.$executeRaw`
        WITH updated_job AS (
          UPDATE "Job"
          SET 
            status = 'failed',
            error = ${`QStash publish failed: ${error}`},
            "updatedAt" = NOW()
          WHERE id = ${job.id}
          RETURNING id
        )
        INSERT INTO "JobEvent" (id, "jobId", level, message, meta, "createdAt")
        SELECT 
          gen_random_uuid()::text,
          id,
          'error',
          'Failed to publish job to QStash',
          ${JSON.stringify({ error })}::jsonb,
          NOW()
        FROM updated_job;
      `;
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to enqueue job: ${error}`,
          jobId: job.id
        }), 
        { 
          status: 502,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return Response.json({ 
      jobId: job.id, 
      queued: true,
      message: "Job queued successfully"
    });

  } catch (error) {
    console.error("Error enqueuing job:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
