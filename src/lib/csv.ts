export type CsvReview = {
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
  if (/^[=\-+@]/.test(s)) s = "'" + s; // formula-injection guard
  s = s.replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) s = `"${s}"`;
  return s;
}

export function reviewsToCsv(rows: CsvReview[]): string {
  const headers = ["id", "provider", "rating", "authorName", "text", "createdAt"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        sanitizeForCSV(r.id),
        sanitizeForCSV(r.provider),
        sanitizeForCSV(r.rating ?? ""),
        sanitizeForCSV(r.authorName ?? ""),
        sanitizeForCSV(r.text ?? ""),
        sanitizeForCSV(r.createdAt ?? ""),
      ].join(",")
    );
  }
  return "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8
}
