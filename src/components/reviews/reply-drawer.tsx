"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import ProviderBadge from "@/components/ui/provider-badge";

type ReviewItem = {
  id: string;
  provider: "google" | "yelp" | "facebook";
  rating?: number | null;
  authorName?: string | null;
  text?: string | null;
};

export default function ReplyDrawer({
  review,
  onClose,
  onPosted,
}: {
  review: ReviewItem;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const canPost = review.provider === "google";

  type ApiResponse = { status: string; error?: string };

  async function post() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: review.provider, body }),
      });
      const data: ApiResponse = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to post reply");
      if (data.status === "posted") {
        toast({ 
          title: "Reply posted",
          description: "Your reply has been posted successfully."
        });
        onPosted();
      } else if (data.status === "linkout") {
        toast({ 
          title: "Open provider to reply", 
          description: "This network requires replying on their site.",
          variant: "destructive"
        });
      }
    } catch (e: any) {
      toast({ 
        title: "Reply failed", 
        description: e.message || "Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }

  function suggest() {
    const name = review.authorName || "there";
    const stars = review.rating || 0;
    if (stars >= 4) setBody(`Thanks, ${name}! We appreciate your feedback and look forward to serving you again.`);
    else if (stars <= 2) setBody(`Hi ${name}, we're sorry for your experience. Please contact us at {{contact}} so we can make this right.`);
    else setBody(`Thanks for the review, ${name}. We'll share this with the team and improve.`);
  }

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(body || "");
      toast({ 
        title: "Copied", 
        description: "Reply text copied to clipboard", 
        variant: "default" 
      });
    } catch {
      toast({ 
        title: "Copy failed", 
        variant: "destructive" 
      });
    }
  }

  async function openOnProvider() {
    try {
      const res = await fetch(`/api/reviews/${review.id}/link`);
      if (!res.ok) throw new Error(await res.text());
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error("No link available");
      window.open(url, "_blank", "noopener,noreferrer");
      toast({ title: "Opening provider…" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't build a deep link.";
      toast({ 
        title: "No link available", 
        description: message, 
        variant: "destructive" 
      });
    }
  }

  const linkLabel = 
    review.provider === "yelp" ? "Open on Yelp" :
    review.provider === "facebook" ? "Open on Facebook" :
    "Open on provider";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end">
      <div className="w-full max-w-md h-full bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Reply to review</h3>
          <ProviderBadge provider={review.provider} />
          <button onClick={onClose} className="text-sm underline">Close</button>
        </div>

        <div className="rounded-md border p-3 text-sm bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="font-medium">{review.authorName || "Reviewer"}</div>
            <ProviderBadge provider={review.provider} />
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {review.rating ? `${review.rating}★` : ""}
          </div>
          <div className="text-sm">{review.text || "—"}</div>
        </div>

        <textarea
          className="w-full h-40 border rounded-md p-3 text-sm"
          placeholder={
            canPost
              ? "Write a thoughtful, policy-compliant reply…"
              : "Replying in-app isn't available for this provider. Draft here and copy/paste on their site."
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={suggest} 
            className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50 transition-colors"
          >
            Suggest
          </button>
          <button
            onClick={copyBody}
            disabled={!body.trim()}
            className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Copy reply
          </button>
          {!canPost && (
            <button 
              onClick={openOnProvider} 
              className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50 transition-colors"
            >
              {linkLabel}
            </button>
          )}
          <button
            onClick={post}
            disabled={!canPost || loading || !body.trim()}
            className="px-3 py-2 rounded-md bg-black text-white text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {canPost ? (loading ? "Posting…" : "Post to Google") : "Link-out only"}
          </button>
        </div>

        {!canPost && (
          <p className="text-xs text-muted-foreground">
            Yelp & Facebook replies must be posted on their sites. Use Suggest, then copy/paste.
          </p>
        )}
      </div>
    </div>
  );
}
