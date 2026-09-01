"use client";

// ONE COVER, FIVE ACTIVITIES.
//
// ═══ THE ANATOMY IS THE COMPONENT, NOT A CONVENTION ═══
//
// Glyph and name, then purpose, then the metadata line. Every activity renders
// through this, so the five are actually comparable — which is the thing that was
// broken before: five hand-laid-out cards, one naming its purpose, one describing
// its mechanic, one saying neither, and a metadata line written as prose per
// activity so the units did not match.
//
// The mechanic is on the DETAIL variant only. On a shelf a mentor is choosing
// between five things, which is a question about purpose; once they have chosen,
// "what happens if I send this" is the next thing they need and there is room for
// it.
//
// ═══ THE WASH IS THE ONLY THING THAT VARIES, AND IT IS FROM THE BANDS ═══
//
// Five band pairs, one per activity, so a mentor learns the colour as a name.
// Nothing else about the cover changes between them — same glyph size, same
// heading, same three-line structure — because a shelf whose items differ in
// layout is a shelf a reader has to re-parse five times.
//
// ═══ LOCKED IS A STATE OF THIS COMPONENT, NOT A DIFFERENT ONE ═══
//
// A locked cover is the same cover, at reduced emphasis, with the requirement
// stated where the metadata line goes. It is NOT a button — pressing something that
// says why it cannot be pressed is a worse experience than not being able to press
// it — but it is fully readable, because the point is that a mentor learns the
// activity exists and what it needs.

import { Lock } from "lucide-react";
import { metaLine } from "@/lib/chat/activities";
import type { ActivityDef, ActivityWash } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The band pairs, by name. A closed map rather than a template string, so a wash
 *  that does not exist is a type error instead of an undefined custom property —
 *  which resolves to `rgba(0,0,0,0)` and renders a transparent tint that nothing
 *  warns about. That exact failure cost an afternoon on the Tasks excerpt. */
const WASH: Record<ActivityWash, { bg: string; fg: string }> = {
  sand: { bg: "bg-[var(--band-sand-bg)]", fg: "text-[var(--band-sand-fg)]" },
  amber: { bg: "bg-[var(--band-amber-bg)]", fg: "text-[var(--band-amber-fg)]" },
  sage: { bg: "bg-[var(--band-sage-bg)]", fg: "text-[var(--band-sage-fg)]" },
  clay: { bg: "bg-[var(--band-clay-bg)]", fg: "text-[var(--band-clay-fg)]" },
  rose: { bg: "bg-[var(--band-rose-bg)]", fg: "text-[var(--band-rose-fg)]" },
};

export function ActivityCover({
  def,
  variant = "shelf",
  locked,
  /** What a locked cover reports about progress, when there is any. */
  progress,
  onSelect,
}: {
  def: ActivityDef;
  variant?: "shelf" | "detail";
  locked?: boolean;
  progress?: string | null;
  onSelect?: () => void;
}) {
  const wash = WASH[def.wash];
  const Glyph = def.glyph;
  const detail = variant === "detail";

  const body = (
    <>
      <span className="flex items-center gap-2.5">
        {/* THE GLYPH SITS IN THE WASH, not on the card — a full-bleed tinted card
            would make five of these on a shelf into five competing blocks of
            colour. A 32px tinted disc is enough to learn the activity by. */}
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            locked ? "bg-[var(--surface-s2)]" : wash.bg,
            locked ? "text-[var(--text-muted)]" : wash.fg
          )}
        >
          {locked ? <Lock className="size-4" /> : <Glyph className="size-4" />}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            locked ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"
          )}
          style={{ font: "var(--type-card-title)" }}
        >
          {def.name}
        </span>
      </span>

      {/* PURPOSE. Why a mentor would send this — the question they are actually
          asking on a shelf of five. */}
      <span
        className={cn(
          "mt-1.5 block",
          locked ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
        )}
        style={{ font: "var(--type-body)" }}
      >
        {def.purpose}
      </span>

      {/* MECHANIC, on the detail variant only — see the module note. */}
      {detail && !locked && (
        <span
          className="mt-2 block text-[var(--text-secondary)]"
          style={{ font: "var(--type-body)" }}
        >
          {def.mechanic}
        </span>
      )}

      {/* ═══ THE METADATA LINE, OR THE REQUIREMENT IN ITS PLACE ═══
          One slot, two possible contents, so a locked cover is the same height and
          the same shape as an open one and the shelf does not go ragged. */}
      <span className="mt-2 flex items-baseline gap-2">
        {locked && def.locked ? (
          <span
            className="block text-[var(--text-muted)]"
            style={{ font: "var(--type-field-label)" }}
          >
            {def.locked.microcopy}
            {progress && (
              // The progress figure, when there is any — a mentor who has had one
              // card answered is closer than one who has sent nothing, and a gate
              // that cannot tell them apart reads as arbitrary.
              <span className="ml-1 tabular-nums text-[var(--text-secondary)]">
                · {progress}
              </span>
            )}
          </span>
        ) : (
          <span
            className="tabular-nums text-[var(--text-muted)]"
            style={{ font: "var(--type-field-label)" }}
          >
            {metaLine(def)}
          </span>
        )}
      </span>
    </>
  );

  const shape = cn(
    "block w-full rounded-[var(--radius-inset)] border p-3 text-left",
    locked
      ? // No hover, no shadow, no pointer. Readable, not pressable.
        "border-[color:var(--border-subtle)] bg-[var(--surface-s1)]"
      : "border-[color:var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--tint-hover)]",
    RING
  );

  if (locked || !onSelect) {
    return (
      <div
        className={shape}
        /* A LOCKED COVER IS STILL ANNOUNCED, and announced as unavailable — a
           reader who cannot see the padlock needs the same information the glyph
           gives. `aria-disabled` rather than `disabled`, because this is not a
           control at all; the role is the group and the text is the reason. */
        {...(locked
          ? { role: "group", "aria-disabled": true, "aria-label": `${def.name}, not available yet` }
          : {})}
      >
        {body}
      </div>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={shape}>
      {body}
    </button>
  );
}
