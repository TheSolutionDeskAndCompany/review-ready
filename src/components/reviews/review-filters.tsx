"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function ReviewFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const provider = sp.get("provider") || "all";
  const min = sp.get("min") || "";
  const unreplied = sp.get("unreplied") === "1";

  const urlBase = useMemo(() => {
    // keep path; we'll only change query
    return typeof window !== "undefined" ? window.location.pathname : "/app/reviews";
  }, []);

  function update(next: Record<string, string | "" | undefined>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v) params.delete(k);
      else params.set(k, v);
    });
    router.replace(`${urlBase}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Provider */}
      <label className="text-sm flex items-center gap-2">
        <span className="text-muted-foreground">Provider</span>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={provider}
          onChange={(e) =>
            update({ provider: e.target.value === "all" ? "" : e.target.value })
          }
        >
          <option value="all">All</option>
          <option value="google">Google</option>
          <option value="yelp">Yelp</option>
          <option value="facebook">Facebook</option>
        </select>
      </label>

      {/* Min stars */}
      <label className="text-sm flex items-center gap-2">
        <span className="text-muted-foreground">Min stars</span>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={min}
          onChange={(e) => update({ min: e.target.value || "" })}
        >
          <option value="">Any</option>
          <option value="5">5★</option>
          <option value="4">4★+</option>
          <option value="3">3★+</option>
          <option value="2">2★+</option>
          <option value="1">1★+</option>
        </select>
      </label>

      {/* Unreplied only */}
      <label className="text-sm inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={unreplied}
          onChange={(e) => update({ unreplied: e.target.checked ? "1" : "" })}
        />
        Unreplied only
      </label>
    </div>
  );
}
