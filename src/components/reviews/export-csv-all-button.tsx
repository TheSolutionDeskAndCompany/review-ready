"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

export default function ExportCsvAllButton() {
  const sp = useSearchParams();

  const href = useMemo(() => {
    const p = new URLSearchParams();
    // Keep only relevant filters; ignore paging/size
    if (sp.get("provider")) p.set("provider", sp.get("provider")!);
    if (sp.get("min")) p.set("min", sp.get("min")!);
    if (sp.get("unreplied") === "1") p.set("unreplied", "1");
    return `/api/reviews/export?${p.toString()}`;
  }, [sp]);

  return (
    <a
      href={href}
      className="px-2 py-1 rounded border text-xs hover:bg-gray-50 transition-colors"
      aria-label="Export all filtered reviews to CSV"
      title="Export all (filtered) to CSV"
    >
      ⬇︎ Export ALL CSV
    </a>
  );
}
