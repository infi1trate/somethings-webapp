"use client";

// PersonRow (Prompt B) — the ONE shared avatar+name row for the record.
// Replaces ad-hoc person markup at the component level: the Mentorship tab's
// Mentees list + Team, and the lead's "Mentors they lead" list all render
// through this, so the person treatment is consistent everywhere at once.
//
// Anatomy: 30px avatar (initial on a rotating soft tint), primary line (name,
// row-value token), secondary line (caption token — role for staff,
// relationship context for mentees), optional mentee chips (escalation cause,
// video-call care signal), optional trailing element, optional chevron when
// the row navigates. Pressable variant: the whole row is the target (≥44px),
// inset rounded hover/focus highlight, keyboard parity — the same rules as the
// field rows (RecordRow).
//
// No-names variant (`redactName`): the read-mostly supervisor tier sees
// mentees as counts, not identities — name + initial are withheld, a neutral
// label + dot avatar stand in. Wired but dormant (no persona resolves to that
// tier yet — see permission-map's supervisorTier).

import Link from "next/link";
import { AlertTriangle, ChevronRight, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// Soft, low-chroma tints — the avatar is identity, not status, so these never
// carry meaning; the initial rotates through them by name for variety.
const TINTS = [
  { bg: "#efe7f7", fg: "#5b41a8" },
  { bg: "#e6efe8", fg: "#3a7d44" },
  { bg: "#f2e9df", fg: "#8a5a2b" },
  { bg: "#e6edf3", fg: "#3f5c78" },
  { bg: "#f5e7ea", fg: "#9a4257" },
];

/** Exported so surfaces that can't use a whole PersonRow (e.g. a table cell)
 *  still get the SAME avatar treatment instead of minting a second one. */
export function avatarTintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

function initial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

const NEUTRAL_TINT = { bg: "var(--surface-s1)", fg: "var(--text-muted)" };

export type PersonAttention = {
  /** Names the observable cause (vocabulary law: never a prediction). */
  text: string;
  /** critical = genuine escalations only; warning = derived attention
   *  (waiting-on-mentor, teen-quiet). Tokens per family, text carries the
   *  meaning (WCAG 1.4.1). */
  tone: "critical" | "warning";
};

/** Attention chip — an exception, so it speaks: family tint + icon + cause.
 *  Exported as AttentionChipInline for surfaces that aren't PersonRow (the
 *  mentee table renders it beside the name in its own markup). */
export function AttentionChipInline(props: PersonAttention) {
  return <AttentionChip {...props} />;
}

function AttentionChip({ text, tone }: PersonAttention) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium"
      style={{
        backgroundColor: `var(--alert-${tone}-bg)`,
        color: `var(--alert-${tone}-fg)`,
      }}
    >
      <AlertTriangle className="size-3" aria-hidden />
      {text}
    </span>
  );
}

/** Video-call chip — a quiet care signal (low chat volume may be video, not
 *  absence), never a metric to grade. A whisper: muted, no fill. */
function VideoChip({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]"
      aria-label={`${count} video ${count === 1 ? "call" : "calls"}, last 30 days`}
    >
      <Video className="size-3.5" aria-hidden />
      {count}
    </span>
  );
}

export interface PersonRowProps {
  name: string;
  /** Secondary caption: role (staff) or relationship context (mentees). */
  secondary?: React.ReactNode;
  /** Attention chip (observable cause + severity family). Undefined/null =
   *  no chip. critical is reserved for genuine escalations. */
  attention?: PersonAttention | null;
  /** Video calls in the trailing window → a quiet care chip. 0 = omitted. */
  videoCount?: number;
  /** Right-aligned element before the chevron (chip, count, recency). */
  trailing?: React.ReactNode;
  /** No-names degraded variant (read-mostly supervisor tier): withhold the
   *  name + initial, show a neutral label + dot avatar. */
  redactName?: boolean;
  /** Provided → the whole row is pressable and shows a trailing chevron. */
  onPress?: () => void;
  /** Navigational variant — the row becomes a real <Link>. Preferred over
   *  onPress when the destination is a URL: it keeps middle-click, open-in-
   *  new-tab and the browser's own affordances. Ignored if onPress is set. */
  href?: string;
  className?: string;
}

export function PersonRow({
  name,
  secondary,
  attention,
  videoCount = 0,
  trailing,
  redactName = false,
  onPress,
  href,
  className,
}: PersonRowProps) {
  const tint = redactName ? NEUTRAL_TINT : avatarTintFor(name);
  const displayName = redactName ? "Mentee" : name;
  const hasChips = (!redactName && !!attention) || videoCount > 0;
  const pressable = !!onPress || !!href;

  const body = (
    <>
      <span
        aria-hidden
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
      >
        {redactName ? "•" : initial(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[var(--text-primary)]"
          style={{ font: "var(--type-row-value)" }}
        >
          {displayName}
        </span>
        {secondary != null && (
          <span
            className="block truncate text-[var(--text-secondary)]"
            style={{ font: "var(--type-row-label)" }}
          >
            {secondary}
          </span>
        )}
      </span>
      {(hasChips || trailing != null) && (
        <span className="flex shrink-0 items-center gap-2">
          {/* Attention is withheld in the no-names variant along with the
              identity. Video is a count, so it survives. */}
          {!redactName && attention && <AttentionChip {...attention} />}
          {videoCount > 0 && <VideoChip count={videoCount} />}
          {trailing}
        </span>
      )}
      {pressable && (
        <ChevronRight
          className="size-3.5 shrink-0 text-[var(--text-muted)]"
          aria-hidden
        />
      )}
    </>
  );

  // Inset rounded highlight — macOS list pattern, matches the field rows
  // (canvas tone, 10px radius, 8px in from the card padding).
  const highlight = (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -inset-x-3 inset-y-0 rounded-[10px] transition-colors",
        "group-hover:bg-[var(--surface-s1)] group-focus-visible:bg-[var(--surface-s1)]",
        "group-focus-visible:outline-2 group-focus-visible:outline-offset-0 group-focus-visible:outline-[color:var(--focus-ring)]",
        RING
      )}
    />
  );
  const pressableCls = cn(
    "group relative flex min-h-11 w-full items-center gap-3 py-1.5 text-left focus-visible:outline-none",
    className
  );

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        aria-label={`${displayName} — open`}
        className={pressableCls}
      >
        {highlight}
        {body}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} aria-label={`${displayName} — open`} className={pressableCls}>
        {highlight}
        {body}
      </Link>
    );
  }

  return (
    <div className={cn("flex min-h-11 w-full items-center gap-3 py-1.5", className)}>
      {body}
    </div>
  );
}
