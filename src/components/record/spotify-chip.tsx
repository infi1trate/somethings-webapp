"use client";

// SpotifyChip (elevated pass) — the record's "On repeat" value rendered as a
// compact data chip instead of a raw URL: album thumbnail + track title (pulled
// live from Spotify's oEmbed, shared with the teen-preview widget) and Open /
// Copy-link actions. Falls back to a plain link chip for non-Spotify URLs.

import { useState } from "react";
import { Check, Copy, ExternalLink, Music } from "lucide-react";
import { toast } from "sonner";
import { useSpotifyOembed } from "@/lib/spotify";
import { cn } from "@/lib/utils";

const ICON_BTN =
  "pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-press)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function SpotifyChip({ url }: { url: string }) {
  const { parsed, art, title } = useSpotifyOembed(url);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        toast("Link copied.");
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  // Non-Spotify (or unparseable) URL — a plain link chip, still not a raw string.
  if (!parsed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        // pointer-events-auto: this chip renders inside a RecordRow whose
        // content is pointer-events-none so the row's own press target sits
        // behind it. Interactive children opt back in.
        className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-lg border border-[color:var(--border-contour)] bg-[var(--surface-s1)] px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <Music className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{url}</span>
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      </a>
    );
  }

  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-xl border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-2 pr-2">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#1db954] text-white">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="size-full object-cover" />
        ) : (
          <Music className="size-5" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          On repeat
        </span>
        <span className="block truncate text-[14px] font-medium text-[var(--text-primary)]">
          {title ?? "Spotify track"}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={copy}
          aria-label="Copy link"
          className={ICON_BTN}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in Spotify"
          className={cn(ICON_BTN, "no-underline")}
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </span>
    </div>
  );
}
