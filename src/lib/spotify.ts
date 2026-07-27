"use client";

// Shared Spotify helpers — parsing + a best-effort oEmbed hook (album art +
// title from Spotify's public endpoint). Used by the teen-preview SpotifySong
// widget and the record's compact SpotifyChip so both pull the same metadata.

import { useEffect, useMemo, useState } from "react";

export type SpotifyParsed = { type: string; id: string } | null;

// open.spotify.com/{type}/{id}, tolerating an `intl-xx/` locale prefix + query.
export function parseSpotify(url: string): SpotifyParsed {
  const m = url.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/
  );
  return m ? { type: m[1], id: m[2] } : null;
}

export function spotifyEmbedUrl(parsed: NonNullable<SpotifyParsed>): string {
  return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`;
}

export interface SpotifyOembed {
  parsed: SpotifyParsed;
  art: string | null;
  title: string | null;
}

/** Best-effort album art + title from Spotify's public oEmbed endpoint. Callers
 *  reset state between links with a `key` on the component (no sync setState). */
export function useSpotifyOembed(url: string): SpotifyOembed {
  const parsed = useMemo(() => parseSpotify(url), [url]);
  const [art, setArt] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

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

  return { parsed, art, title };
}
