"use client";

type ReviewRow = {
  id: string;
  provider: "google" | "yelp" | "facebook";
  rating?: number | null;
  authorName?: string | null;
  text?: string | null;
  createdAt?: string | null; // ISO string
};

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

function toCsv(rows: ReviewRow[]): string {
  const headers = ["id", "provider", "rating", "authorName", "text", "createdAt"];
  const lines = [headers.join(",")];

  for (const r of rows) {
    const line = [
      sanitizeForCSV(r.id),
      sanitizeForCSV(r.provider),
      sanitizeForCSV(r.rating ?? ""),
      sanitizeForCSV(r.authorName ?? ""),
      sanitizeForCSV(r.text ?? ""),
      sanitizeForCSV(r.createdAt ?? ""),
    ].join(",");
    lines.push(line);
  }
  // Add BOM so Excel opens as UTF-8
  return "\uFEFF" + lines.join("\n");
}

export default function ExportCsvButton({ rows }: { rows: ReviewRow[] }) {
  function download() {
    const csv = toCsv(rows || []);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const dt = new Date();
    const ts = [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, "0"),
      String(dt.getDate()).padStart(2, "0"),
      "-",
      String(dt.getHours()).padStart(2, "0"),
      String(dt.getMinutes()).padStart(2, "0"),
      String(dt.getSeconds()).padStart(2, "0"),
    ].join("");
    const a = document.createElement("a");
    a.href = url;
    a.download = `reviewready-reviews-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      disabled={!rows || rows.length === 0}
      className="px-2 py-1 rounded border text-xs disabled:opacity-50"
      aria-label="Export current page to CSV"
      title="Export current page to CSV"
      type="button"
    >
      ⬇︎ Export CSV
    </button>
  );
}
