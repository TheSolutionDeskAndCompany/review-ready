"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

type SavedLocation = {
  id: string;
  name: string | null;
  address: string | null;
  googleProviderLocationId: string | null;
};

export default function ResyncEmailButton() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locs, setLocs] = useState<SavedLocation[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [months, setMonths] = useState<string>("12");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/locations");
        if (!r.ok) throw new Error(await r.text());
        const data = (await r.json()) as SavedLocation[];
        // Keep only those with Google mapping
        setLocs(data.filter((d) => !!d.googleProviderLocationId));
      } catch (e: any) {
        toast({ title: "Failed to load locations", description: e.message, variant: "destructive" });
      }
    })();
  }, [toast]);

  const options = useMemo(() => {
    return [
      { value: "all", label: "All Google locations" },
      ...locs.map((l) => ({
        value: l.googleProviderLocationId!,
        label: l.name || l.googleProviderLocationId!,
      })),
    ];
  }, [locs]);

  async function run() {
    setLoading(true);
    try {
      const body =
        selected === "all"
          ? { all: true, months: Number(months) || 12 }
          : { providerLocationIds: [selected], months: Number(months) || 12 };
      const r = await fetch("/api/jobs/enqueue-google-sync-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(data?.error || JSON.stringify(data));
      toast({
        title: "Job enqueued",
        description: `Your request has been queued. Check the Job History below for progress.`,
        variant: "success",
      });
    } catch (e: any) {
      toast({ title: "Failed to enqueue job", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm flex items-center gap-2">
          <span className="text-muted-foreground">Location</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm flex items-center gap-2">
          <span className="text-muted-foreground">Lookback</span>
          <select
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
            title="How many months back to re-import"
          >
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">12 months</option>
            <option value="24">24 months</option>
          </select>
        </label>

        <button
          type="button"
          onClick={run}
          disabled={loading || options.length === 0}
          className="px-3 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
        >
          {loading ? "Working…" : "Re-sync & Email CSV"}
        </button>
      </div>
      {options.length === 1 && (
        <p className="text-xs text-muted-foreground">
          No Google locations saved yet. Connect Google and select locations above.
        </p>
      )}
    </div>
  );
}
