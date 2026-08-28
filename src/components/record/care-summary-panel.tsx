"use client";

// CARE SUMMARY PANEL — a static, read-only reading of how one mentee's care is
// going, on the Care tab's collapsible rail.
//
// WAS THE CARE ASSISTANT. The thread, the input, the send control, the three
// prompt pills, the mocked responder and the four guardrail refusal paths are all
// gone — deleted, not flagged off. There is nothing to refuse here because the
// reader cannot ask this panel anything.
//
// THIS PANEL CARRIES NO ACTIONS AT ANY TIER except the moment links and the
// refresh control. Read-wide, act-narrow: mentors and lead mentors read it, and
// there is nothing on it for anyone to press that changes the record.
//
// ═══════════════════════════════════════════════════════════════════════════
// GUARDRAIL 2 — THE SUMMARY IS NOT A SAFETY MECHANISM. Read this before adding
// anything to `Worth watching`.
//
// Risk detection belongs to the flag and escalation pipeline, which has an owner,
// a clock and a resolution path. This panel has none of those. So it MUST NEVER
// BE THE ONLY PLACE A CONCERN SURFACES, and it never authors a warning of its
// own:
//
//   · A flag exists in the window  → the panel POINTS AT IT, using the flag's own
//     recorded reason. It does not restate the concern in its own words.
//   · An observable pattern, no flag → the panel says the pattern, and then says
//     plainly that nothing has been raised, with a line directing the reader to
//     the normal path. It does not escalate, score, or imply urgency.
//
// If you are here to add "and this looks serious" to a reading: raise a flag
// instead. That is the mechanism. This is a description of a window.
//
// GUARDRAIL 1 — SENTIMENT IS NEVER SCORED. `How they sound` renders WORDS AND AT
// MOST A DIRECTION. There is no numeric value, no 1–10, no gauge, no severity
// band, no coloured fill and no emoji. A number describing a child's emotional
// state, rendered to a mentor, is out of bounds — the metric slot on that
// dimension holds one phrase and deliberately cannot hold a figure.
//
// GUARDRAIL 3/4/5 — no clinical or diagnostic language, no prediction, no
// verbatim message content. Readings describe what was discussed and how often;
// they never name a condition, never say "at risk of" or "likely to", and never
// quote. A reader who wants the words follows a moment link, which is the only
// route to message text anywhere on this surface.
//
// GUARDRAIL 7 — NOTHING HERE IS WRITTEN TO THE RECORD. This component has no
// store writer and appends no history entry. The refresh control re-stamps a
// per-viewer timestamp and nothing else.
// ═══════════════════════════════════════════════════════════════════════════
//
// THE SURVEY SCORE IS NOT RESTATED. That number is the page's spine — the
// Primary presentation card above owns it. This panel is the conversational
// layer, and repeating the figure would be the same fact in two places.

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  MessagesSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { chatHrefFor } from "@/lib/record/chat";
import {
  MIN_DAYS_ENGAGED,
  MIN_EXCHANGES,
  type CareReading,
  type ReadingDimension,
} from "@/lib/record/care-reading";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
/** 11.5px muted — the eyebrow scale, below the 12px field-label stop. */
const EYEBROW = "text-[11.5px] leading-[16px] text-[var(--text-muted)]";

/** TODO-COPY. Provenance, one line, always visible without scrolling. */
export const SUMMARY_FOOTER =
  "AI-generated from conversation and engagement in this window, for context only — not a clinical determination.";

// ── Closed state ────────────────────────────────────────────────────────────

/** ONE CONTROL, ONE PLACE — open AND close, in the tab row, in both directions.
 *  The panel has no close icon of its own; Esc also closes it.
 *
 *  ACTIVE IS FILLED — the same ink fill the primary buttons use, so "on" is
 *  unmistakable at a glance and at any zoom. */
export function CareSummaryLauncher({
  onToggle,
  open,
  /** True when the reading changed since this reader last opened the panel. */
  hasUpdate = false,
}: {
  onToggle: () => void;
  open: boolean;
  hasUpdate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      /* TODO-COPY */
      aria-label="Care summary"
      className={cn(
        "sticky top-6 flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2",
        "text-[13px] font-semibold transition-colors",
        open
          ? "border-[color:var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverse)]"
          : "border-[color:var(--border-contour)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      <Sparkles className="size-4 shrink-0" aria-hidden />
      {/* TODO-COPY */}
      Care summary
      {hasUpdate && !open && (
        // NEVER COLOUR ALONE — the dot is decorative, the label carries the fact.
        <>
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-[var(--text-inverse)] mix-blend-difference"
          />
          {/* TODO-COPY */}
          <span className="sr-only">Updated since you last opened this</span>
        </>
      )}
    </button>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** The trend arrow. DIRECTION ONLY, never a magnitude, and it sits inside the
 *  muted caption rather than beside the prose — this line is evidence. */
function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : ArrowRight;
  /* TODO-COPY */
  const label =
    trend === "up" ? "trending up" : trend === "down" ? "trending down" : "level";
  return (
    <>
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">{label}</span>
    </>
  );
}

/** ONE DIMENSION: label, reading, then the supporting line.
 *
 *  NO CHIPS, NO LARGE NUMERALS, NO COLOURED FILLS in the metric line — it is a
 *  muted caption and it must stay subordinate to the sentence above it. The
 *  prose carries the meaning; this is what the prose is based on. */
function Dimension({ d }: { d: ReadingDimension }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <p className="text-[12.5px] font-medium leading-[16px] text-[var(--text-secondary)]">
        {d.label}
      </p>

      <p
        className="mt-1.5 text-[14px] text-[var(--text-primary)]"
        style={{ lineHeight: 1.55 }}
      >
        {d.reading}
      </p>

      {/* THE SUPPORTING LINE. Three shapes, one slot — data points, a moment
          link, or a flag pointer. Never two of them at once. */}
      {d.metrics && d.metrics.length > 0 && (
        <p className={cn("mt-1.5 flex flex-wrap items-center gap-x-1.5", EYEBROW)}>
          {d.metrics.map((m, i) => (
            <span key={m} className="inline-flex items-center gap-1">
              {i > 0 && <span aria-hidden>·</span>}
              {m}
            </span>
          ))}
          {d.trend && <TrendArrow trend={d.trend} />}
        </p>
      )}

      {/* MOMENT LINK. The label names WHEN, never what was said — following it is
          the only way to reach message text from this panel. */}
      {d.moment && (
        <p className="mt-1.5">
          <Link
            href={chatHrefFor(d.moment.conversationWith)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md text-[11.5px] leading-[16px]",
              "text-[var(--text-secondary)] underline decoration-[color:var(--border-contour)] underline-offset-2",
              "transition-colors hover:text-[var(--text-primary)] hover:decoration-[color:var(--text-primary)]",
              RING
            )}
          >
            <MessagesSquare className="size-3 shrink-0" aria-hidden />
            {d.moment.label}
            <span aria-hidden>→</span>
          </Link>
        </p>
      )}

      {/* THE FLAG POINTER — guardrail 2. The flag's OWN recorded reason, not a
          re-authored version of it, plus when it was raised. */}
      {d.flagPointer && (
        <p className={cn("mt-1.5", EYEBROW)}>
          {/* TODO-COPY */}
          {`Flagged ${d.flagPointer.raisedDaysAgo === 0 ? "today" : d.flagPointer.raisedDaysAgo === 1 ? "yesterday" : `${d.flagPointer.raisedDaysAgo} days ago`} — ${d.flagPointer.label}`}
        </p>
      )}

      {/* NO FLAG ON RECORD — guardrail 2's other branch. The panel states the
          absence and points at the mechanism; it does not become the mechanism. */}
      {d.noFlagOnRecord && (
        <p className={cn("mt-1.5", EYEBROW)}>
          {/* TODO-COPY */}
          Nothing has been raised for this period. Raise a flag from this record if
          it needs one.
        </p>
      )}
    </div>
  );
}

/** TODO-COPY. "From conversations Aug 5–26" — the window, stated out loud. */
function windowLabel(startAt: number, endAt: number): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  const sameMonth = start.getMonth() === end.getMonth();
  const left = `${month(start)} ${start.getDate()}`;
  const right = sameMonth
    ? String(end.getDate())
    : `${month(end)} ${end.getDate()}`;
  return `From conversations ${left}–${right}`;
}

/** TODO-COPY. Explicit date, not elapsed time — the provenance line's standard
 *  everywhere on this record. */
function updatedLabel(at: number): string {
  return `Updated ${new Date(at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

/** SKELETON PER DIMENSION, NOT A SPINNER. A spinner says "the app is busy"; three
 *  stacked shapes say "three readings are coming", which is the truer description
 *  and matches what arrives. */
function LoadingBody() {
  return (
    <div aria-live="polite" className="divide-y divide-[color:var(--border-subtle)]">
      <span className="sr-only">{/* TODO-COPY */}Loading the care summary…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="py-3.5 first:pt-0">
          <span className="block h-3 w-28 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          <span className="mt-2.5 block h-3.5 w-full rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          <span className="mt-1.5 block h-3.5 w-4/5 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          <span className="mt-2.5 block h-2.5 w-40 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ── The panel ───────────────────────────────────────────────────────────────

export function CareSummaryPanel({
  reading,
  state = "loaded",
  updatedAt,
  onCollapse,
  onRefresh,
}: {
  /** Null renders the low-data line — same as `reading.insufficient`. */
  reading: CareReading | null;
  /** `loaded` uses `reading`; the other two ignore it. */
  state?: "loaded" | "loading" | "error";
  /** Per-viewer refresh stamp, if this reader has refreshed. */
  updatedAt?: number | null;
  onCollapse: () => void;
  /** Absent for tiers that may not refresh. */
  onRefresh?: () => void;
}) {
  /** ESC CLOSES — the panel owns it, and the tab-row toggle is the only other
   *  way. `defaultPrevented` is checked because a dialog in the main column must
   *  still win Esc for itself, and Radix listens in the capture phase. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onCollapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCollapse]);

  const insufficient = state === "loaded" && (!reading || reading.insufficient);

  return (
    <aside
      /* TODO-COPY */
      aria-label="Care summary"
      data-record-section="care-summary-panel"
      // 20px — matching the page's cards, which are --radius-elevated. The brief
      // asked for 16px; the cards measure 20px and matching them is the
      // requirement that actually matters. Reported.
      //
      // ═══ THE HEIGHT SUBTRACTS THE BOTTOM CHROME (SC 2.4.11) ═══
      //
      // This was `calc(100dvh-3rem)`, inherited from the deleted
      // `care-assistant-rail.tsx` when this panel replaced it. That arithmetic
      // predates the bottom tab bar and assumes the whole viewport is available.
      // It is not: below `md` the last 56px plus the safe-area inset belong to
      // the tab bar, so a panel stuck at `top-6` and 796px tall on an 844px
      // viewport ran to y=820 — its footer, which carries the refresh control
      // and the "Updated" stamp, sat underneath the nav.
      //
      // `--nav-reserve` is the one place that figure is defined (globals.css,
      // gaps row 253) and it is already `0px` at `md` and above, so desktop
      // geometry is byte-for-byte unchanged and there is no second breakpoint to
      // keep in step.
      className="sticky top-6 flex max-h-[calc(100dvh-3rem-var(--nav-reserve))] min-w-0 flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      {/* ── HEADER: icon + title + refresh. No close icon — one control, one
          place, in the tab row. ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-3.5">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
          <Sparkles className="size-4 shrink-0" aria-hidden />
          {/* TODO-COPY */}
          Care summary
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            /* TODO-COPY */
            aria-label="Refresh the care summary"
            className={cn(
              "-m-1.5 shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            <RefreshCw className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {/* ── PROVENANCE, ABOVE THE FIRST DIMENSION AND NEVER INSIDE THE SCROLL.
          The window and the updated stamp are both requirements of being able to
          trust the reading, so they sit where they cannot be scrolled away. */}
      {reading && state === "loaded" && (
        <div className={cn("flex flex-wrap items-center gap-x-1.5 px-4 pb-3", EYEBROW)}>
          <span>{windowLabel(reading.windowStartAt, reading.windowEndAt)}</span>
          <span aria-hidden>·</span>
          <span>{updatedLabel(updatedAt ?? reading.generatedAt)}</span>
        </div>
      )}

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {state === "loading" ? (
          <LoadingBody />
        ) : state === "error" ? (
          /* NON-BLAMING, WITH A NEXT STEP. The record itself is unaffected, and
             saying so is the useful half of the message. */
          <p
            className="text-[14px] text-[var(--text-secondary)]"
            style={{ lineHeight: 1.55 }}
          >
            {/* TODO-COPY */}
            The summary didn&apos;t load. Nothing on the record is affected — try
            the refresh above.
          </p>
        ) : insufficient ? (
          /* LOW DATA: ONE HONEST LINE AND NO DIMENSIONS. A thin reading built from
             two exchanges is still a sentence a mentor would act on. */
          <>
            <p
              className="text-[14px] text-[var(--text-secondary)]"
              style={{ lineHeight: 1.55 }}
            >
              {/* TODO-COPY */}
              Not enough conversation in this window to summarize.
            </p>
            {reading && (
              <p className={cn("mt-1.5", EYEBROW)}>
                {/* TODO-COPY. States the threshold so the reader knows this is a
                    state and not a failure. */}
                {`${reading.exchanges} ${reading.exchanges === 1 ? "exchange" : "exchanges"} across ${reading.daysEngaged} ${reading.daysEngaged === 1 ? "day" : "days"} · needs ${MIN_EXCHANGES} across ${MIN_DAYS_ENGAGED}`}
              </p>
            )}
          </>
        ) : (
          /* HAIRLINES BETWEEN DIMENSIONS, no nested cards and no whole-block
             tints — structure from spacing and tone. */
          <div className="divide-y divide-[color:var(--border-subtle)]">
            {reading!.dimensions.map((d) => (
              <Dimension key={d.id} d={d} />
            ))}
          </div>
        )}
      </div>

      {/* ── FOOTER: provenance and scope, outside the scroll so it cannot be
          pushed off. */}
      <p className="border-t border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-4 py-2 text-[11.5px] leading-[16px] text-[var(--text-muted)]">
        {SUMMARY_FOOTER}
      </p>
    </aside>
  );
}
