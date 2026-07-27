"use client";

import { useState } from "react";
import { Music, Play, ExternalLink } from "lucide-react";
import { spotifyEmbedUrl, useSpotifyOembed } from "@/lib/spotify";

const PURPLE = "#b164ff";
// Vinyl disc: a dark base with fine concentric grooves + a soft sheen.
const VINYL =
  "repeating-radial-gradient(circle at 50% 50%, #0b0b0d 0px, #0b0b0d 1px, #1d1d20 1px, #1d1d20 2.4px), radial-gradient(circle at 36% 30%, rgba(255,255,255,0.16), rgba(255,255,255,0) 42%)";

export function SpotifySong({ url }: { url: string }) {
  const { parsed, art, title } = useSpotifyOembed(url);
  const [open, setOpen] = useState(false);

  if (!parsed) return null;
  const embedUrl = spotifyEmbedUrl(parsed);

  const cover = art ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={art} alt="" className="size-full object-cover" />
  ) : (
    <div
      className="flex size-full items-center justify-center text-white"
      style={{ background: PURPLE }}
    >
      <Music className="size-6" />
    </div>
  );

  return (
    <div className="relative">
      {/* A big record sitting on top of the hero/section boundary: the album
          sleeve tucked behind, a picture-disc sliding out and spinning. The
          disc is pulled up (negative margin) so it straddles the purple→card
          edge with depth; the caption sits on the card below it. */}
      <div className="flex items-end gap-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Hide player" : "Play song"}
          className="group relative -mt-[64px] h-[150px] w-[156px] shrink-0"
        >
          {/* album sleeve, tucked behind + tilted for depth */}
          <div className="absolute left-0 top-2 size-[116px] -rotate-[7deg] overflow-hidden rounded-md shadow-[0_12px_26px_rgba(31,30,29,0.32)] ring-1 ring-black/10">
            {cover}
          </div>

          {/* picture-disc, in front, sliding out to the right */}
          <div
            className="absolute bottom-0 right-0 size-[138px] rounded-full shadow-[0_16px_32px_rgba(0,0,0,0.42)] ring-1 ring-black/25 motion-safe:animate-[spin_7s_linear_infinite]"
            style={{ background: VINYL }}
          >
            {/* large album-art center (picture disc) */}
            <div className="absolute inset-0 m-auto size-[62%] overflow-hidden rounded-full ring-1 ring-black/40">
              {cover}
            </div>
            {/* spindle hole */}
            <span className="absolute inset-0 m-auto size-[7px] rounded-full bg-neutral-900 ring-1 ring-white/40" />
          </div>

          {/* play hint on the disc */}
          <span className="absolute bottom-0 right-0 flex size-[138px] items-center justify-center rounded-full bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-7 fill-white text-white" />
          </span>
        </button>

        <div className="min-w-0 flex-1 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            On repeat
          </p>
          <p className="truncate text-[15px] font-semibold text-foreground">
            {title ?? "Tap to play"}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open in Spotify <ExternalLink className="size-3" />
          </a>
        </div>
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
