"use client";

// RECORD AVATAR — the record's ONE avatar, extracted from PersonRow so the
// small inline placements (a metrics-row value, a signature line) get the same
// treatment instead of minting a fourth idiom.
//
// THERE WERE THREE BEFORE THIS: PersonRow's 30px initial tile with a rotating
// tint, UserRecordShell's 64px rounded-square with a brand colour-mix, and an
// unused `ui/avatar.tsx` on shadcn's token system (`--border` rather than
// `--border-contour`, zero consumers). PersonRow's was the real one — it is on
// the record's own tokens and already exported its tint function for table cells
// that could not use a whole row — so this is that, generalised to a size scale.
// PersonRow now renders through it.
//
// THE TINT IS IDENTITY, NEVER STATUS. It rotates by name for variety and carries
// no meaning, which is why there is no severity or presence variant here and no
// dot: presence was removed from record headers by decision (see the note in
// UserRecordShell), and a status dot on an identity token is how a colour ends up
// meaning two things.
//
// `redact` covers the case PersonRow already handled: a surface that shows
// mentees as COUNTS rather than identities withholds the name and the initial,
// so the avatar has to be able to say "a person" without saying which.

import { cn } from "@/lib/utils";

// Soft, low-chroma tints — see the note above on identity vs status.
const TINTS = [
  { bg: "#efe7f7", fg: "#5b41a8" },
  { bg: "#e6efe8", fg: "#3a7d44" },
  { bg: "#f2e9df", fg: "#8a5a2b" },
  { bg: "#e6edf3", fg: "#3f5c78" },
  { bg: "#f5e7ea", fg: "#9a4257" },
];

const NEUTRAL_TINT = { bg: "var(--surface-s1)", fg: "var(--text-muted)" };

/** Exported so surfaces that can't render a whole avatar element (a table cell
 *  computing its own markup) still land on the SAME tint. */
export function avatarTintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export function avatarInitial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

/** The size scale. 20 and 24 are the inline sizes this pass needed; 30 is
 *  PersonRow's, kept exactly so no row shifts by a pixel. */
const SIZE = {
  /** 16 is the INLINE size, added for the Activity feed's in-sentence chips: at
   *  14px/20px body text a 20px avatar is taller than the line box and pushes the
   *  line apart, while 16px sits inside it. Additive — no existing consumer asks
   *  for it. */
  16: { box: "size-4", text: "text-[9px]" },
  20: { box: "size-5", text: "text-[10px]" },
  24: { box: "size-6", text: "text-[11px]" },
  30: { box: "size-[30px]", text: "text-[13px]" },
} as const;

export function RecordAvatar({
  name,
  size = 30,
  redact = false,
  className,
}: {
  name: string;
  size?: keyof typeof SIZE;
  /** Withhold the identity — see the module note. */
  redact?: boolean;
  className?: string;
}) {
  const tint = redact ? NEUTRAL_TINT : avatarTintFor(name);
  const s = SIZE[size];
  return (
    <span
      // Decorative: the name is always rendered as text beside it, so announcing
      // the initial would read the same person twice.
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        s.box,
        s.text,
        className
      )}
      style={{ backgroundColor: tint.bg, color: tint.fg }}
    >
      {redact ? "•" : avatarInitial(name)}
    </span>
  );
}
