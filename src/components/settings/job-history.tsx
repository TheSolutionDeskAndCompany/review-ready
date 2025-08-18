"use client";

import { useEffect, useState } from "react";

type Job = {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
  result?: { imported?: number; rows?: number; locations?: number } | null;
  events?: { createdAt: string; level: string; message: string }[];
};

function StatusPill({ status }: { status: Job["status"] }) {
  const cls =
    status === "succeeded"
      ? "bg-green-100 text-green-800"
      : status === "failed"
      ? "bg-red-100 text-red-800"
      : status === "running"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-800";
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>
      {status}
    </span>
  );
}

export default function JobHistory() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      setJobs(await r.json());
    } catch (e) {
      console.error("Failed to load jobs:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (loading && jobs.length === 0)
    return <div className="text-sm text-muted-foreground">Loading jobs…</div>;
  if (jobs.length === 0)
    return <div className="text-sm text-muted-foreground">No jobs yet.</div>;

  return (
    <div className="rounded-2xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">Job</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Created</th>
            <th className="p-3 text-left">Result</th>
            <th className="p-3 text-left">Recent events</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-t">
              <td className="p-3">
                <div className="font-mono text-xs">{job.id.slice(0, 10)}…</div>
                <div className="text-xs text-muted-foreground">{job.type}</div>
              </td>
              <td className="p-3">
                <StatusPill status={job.status} />
              </td>
              <td className="p-3 text-xs">
                {new Date(job.createdAt).toLocaleString()}
                {job.finishedAt && (
                  <div className="text-[10px] text-muted-foreground">
                    Done: {new Date(job.finishedAt).toLocaleTimeString()}
                  </div>
                )}
              </td>
              <td className="p-3 text-xs">
                {job.result ? (
                  <>
                    <div>Imported: {job.result.imported ?? 0}</div>
                    <div>Rows: {job.result.rows ?? 0}</div>
                    <div>Locations: {job.result.locations ?? 0}</div>
                  </>
                ) : job.status === "failed" ? (
                  <span className="text-red-600">{job.error?.slice(0, 120)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="p-3 text-xs">
                {(job.events || []).map((event, i) => (
                  <div key={i}>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(event.createdAt).toLocaleTimeString()} •{" "}
                    </span>
                    <span>{event.message}</span>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
