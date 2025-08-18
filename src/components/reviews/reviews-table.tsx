"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReplyDrawer from "./reply-drawer";
import { useToast } from "@/components/ui/use-toast";
import ProviderBadge from "@/components/ui/provider-badge";

type ReviewRow = {
  id: string;
  provider: "google" | "yelp" | "facebook";
  rating?: number | null;
  authorName?: string | null;
  text?: string | null;
  createdAt?: string | null; // ISO string from server
};

function Stars({ value }: { value?: number | null }) {
  if (!value) return <span>-</span>;
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span aria-label={`${v} out of 5 stars`} title={`${v} / 5`}>
      {"★".repeat(v)}{"☆".repeat(5 - v)}
    </span>
  );
}

export default function ReviewsTable({ reviews }: { reviews: ReviewRow[] }) {
  const [open, setOpen] = useState<ReviewRow | null>(null);
  const list = useMemo(() => reviews, [reviews]);
  const router = useRouter();
  const { toast } = useToast();

  return (
    <>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">Provider</th>
            <th className="p-3 text-left">Rating</th>
            <th className="p-3 text-left">Author</th>
            <th className="p-3 text-left">Text</th>
            <th className="p-3 text-left">When</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-3">
                <ProviderBadge provider={r.provider} />
              </td>
              <td className="p-3">
                <Stars value={r.rating} />
              </td>
              <td className="p-3">{r.authorName ?? "—"}</td>
              <td className="p-3 max-w-xl truncate" title={r.text ?? ""}>
                {r.text ?? ""}
              </td>
              <td className="p-3">
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
              </td>
              <td className="p-3 text-right">
                <button 
                  className="px-3 py-1.5 rounded-md border text-xs hover:bg-gray-50 transition-colors"
                  onClick={() => setOpen(r)}
                >
                  Reply
                </button>
              </td>
            </tr>
          ))}
          {!list.length && (
            <tr>
              <td className="p-6 text-center text-muted-foreground" colSpan={6}>
                No reviews yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {open && (
        <ReplyDrawer
          review={open}
          onClose={() => setOpen(null)}
          onPosted={() => {
            setOpen(null);
            toast({ 
              title: "Reply posted",
              variant: "default"
            });
            router.refresh();
          }}
        />
      )}
    </>
  );
}
