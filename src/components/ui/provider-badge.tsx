import React from "react";

type Provider = "google" | "yelp" | "facebook";

export default function ProviderBadge({
  provider,
  className = "",
}: {
  provider: Provider;
  className?: string;
}) {
  const map: Record<Provider, { bg: string; label: string }> = {
    google:   { bg: "bg-[#34A853]", label: "Google" },
    yelp:     { bg: "bg-[#AF0606]", label: "Yelp" },
    facebook: { bg: "bg-[#1877F2]", label: "Facebook" },
  };
  const m = map[provider] ?? map.google;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-white text-xs ${m.bg} ${className}`}
      aria-label={`${m.label} review`}
    >
      {m.label}
    </span>
  );
}
