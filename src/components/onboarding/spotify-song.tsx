"use client";

import { useEffect, useMemo, useState } from "react";
import { Music, Play, ExternalLink } from "lucide-react";

const PURPLE = "#b164ff";
// Vinyl disc: a dark base with fine concentric grooves + a soft sheen.
const VINYL =
  "repeating-radial-gradient(circle at 50% 50%, #0b0b0d 0px, #0b0b0d 1px, #1d1d20 1px, #1d1d20 2.4px), radial-gradient(circle at 38% 32%, rgba(255,255,255,0.14), rgba(255,255,255,0) 45%)";

type Parsed = { type: string; id: string } | null;

// open.spotify.com/{type}/{id}, tolerating an `intl-xx/` locale prefix and query params.
function parseSpotify(url: string): Parsed {
  const m = url.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/
  );
  return m ? { type: m[1], id: m[2] } : null;
}

export function SpotifySong({ url }: { url: string }) {
  const parsed = useMemo(() => parseSpotify(url), [url]);
  const [art, setArt] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Best-effort album art + title from Spotify's public oEmbed endpoint.
  // (State resets between links via a `key` on the parent, so no sync setState.)
  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.thumbnail_url) setArt(data.thumbnail_url);
        if (data.title) setTitle(data.title);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, parsed]);

  if (!parsed) return null;
  const embedUrl = `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`;

  const cover = art ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={art} alt="" className="size-full object-cover" />
  ) : (
    <div
      className="flex size-full items-center justify-center text-white"
      style={{ background: PURPLE }}
    >
      <Music className="size-5" />
    </div>
  );

  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-3.5">
        {/* Record sliding out of its sleeve — spins gently while "on repeat" */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Hide player" : "Play song"}
          className="group relative h-14 w-[74px] shrink-0"
        >
          {/* Vinyl peeking out behind the sleeve */}
          <div
            className="absolute right-0 top-1 size-12 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.35)] motion-safe:animate-[spin_5s_linear_infinite]"
            style={{ background: VINYL }}
          >
            {/* center label */}
            <div className="absolute inset-0 m-auto size-[44%] overflow-hidden rounded-full ring-1 ring-black/30">
              {cover}
            </div>
            {/* spindle hole */}
            <span className="absolute inset-0 m-auto size-[5px] rounded-full bg-neutral-900 ring-1 ring-white/50" />
          </div>

          {/* Album sleeve in front */}
          <div className="absolute left-0 top-1 z-10 size-12 overflow-hidden rounded-md shadow-[0_3px_10px_rgba(31,30,29,0.25)] ring-1 ring-black/5">
            {cover}
          </div>
          {/* play hint */}
          <span className="absolute left-0 top-1 z-20 flex size-12 items-center justify-center rounded-md bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-4 fill-white text-white" />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">On repeat</p>
          <p className="truncate text-xs text-muted-foreground">
            {title ?? "Tap to play on Spotify"}
          </p>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in Spotify"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>

      {open && (
        <div className="mt-3 overflow-hidden rounded-xl">
          <iframe
            title="Spotify player"
            src={embedUrl}
            width="100%"
            height="152"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            style={{ border: 0 }}
          />
        </div>
      )}
    </div>
  );
}
