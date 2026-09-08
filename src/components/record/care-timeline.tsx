"use client";

// CARE TIMELINE — the teen record's append-only history (MO-9.1).
//
// READ-ONLY FOR EVERYONE, every tier. Nothing here mutates, so there is no
// permission branch in this component at all: the action affordances that
// supervisors get live outside it. That is the "read-wide, act-narrow" rule
// expressed structurally rather than as a disabled state.
//
// ROWS ARE NOT PRESSABLE. There is nothing to drill into in v1, so no row-level
// navigation and no trailing chevron implying it. The chevron on the left of the
// row is a DISCLOSURE control — it rotates, carries aria-expanded, and sits with
// the content it opens rather than in the trailing position a navigation chevron
// occupies everywhere else in this product.
//
// AMENDMENT CHAINS ARE VISIBLE, not merely stored. A superseded entry keeps
// rendering, muted, labelled "Amended on [date]" with a jump to the correction;
// the correction says "Amends [date] entry". Nothing is hidden or overwritten.
//
// Provenance renders on EVERY row — person, system, or AI. A reader must never
// have to infer who wrote a rationale.

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Sparkles, X } from "lucide-react";
import { QuoteBlock } from "@/components/ui/evidence-primitives";
import { TonalChip, type ChipTone } from "@/components/record/tonal-chip";
import { HoverNote } from "@/components/record/hover-note";
import {
  riskCategory,
  TIER_ACTION,
  TIER_LABEL,
  type RiskTier,
} from "@/lib/record/risk-taxonomy";
import { CRISIS_TYPE, type CareFlagRecord } from "@/lib/record/people-demo";
import { chatThreadHref } from "@/lib/record/chat";
import {
  severityFor,
  CARE_FILTERS,
  TYPE_LABEL,
  TYPE_TONE,
  matchesFilter,
  type CareEvent,
  type CareFilterId,
} from "@/lib/record/care-demo";
import { AssessmentChip } from "@/components/record/care-update-view";
import { FieldProvenanceNote } from "@/components/record/field-provenance-note";
import { ScoreLozenge } from "@/components/ui/evidence-primitives";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const CHIP =
  "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF =
  "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

/** Pill tone → the semantic families. No raw values, and deliberately not the
 *  PRD's purple: the token system already separates these four weights. */
/** ═══ SEVERITY BANDS, SEMANTIC TINT (B4) ═══
 *
 *  mild → sage, moderate → amber, moderately severe → rose, severe → rose.
 *  `minimal` joins sage: it is the settled end of the same scale, and giving it
 *  a fourth colour would imply a distinction the instruments do not draw.
 *
 *  MODERATELY SEVERE AND SEVERE SHARE ROSE, by the brief. They are one step
 *  apart on a five-step ladder and the LABEL is what separates them — which is
 *  the rule for every tint in this system, since the pale fills are within
 *  1.25:1 of each other and are distinguished by hue rather than lightness. So
 *  the label is never dropped to save space; the lozenge shrinks instead.
 *  Ratios are the tokens' own, measured in settings-tokens.css: sage 6.10:1,
 *  amber 7.24:1, rose 5.93:1. Row 312. */
/* THE TINT TABLE AND THE LOZENGE MARKUP MOVED to ui/evidence-primitives, because
   the Tasks billing pane shows the same instrument, the same number and the same
   band, and a supervisor should not have to work out whether two differently
   shaped readings mean the same thing. The reasoning above travelled with it. */

/** ═══ THE SCORE LOZENGE'S DATA ═══
 *
 *  Read from the event's OWN fields, never from a selected object or a shared
 *  seed value: `description` is the instrument and `result` is "11 — moderate".
 *
 *  THE BAND IS RE-DERIVED with `severityFor` rather than parsed out of `result`.
 *  Parsing prose is how a header ends up disagreeing with its own history — the
 *  same reasoning that put `code` on `CareEvent` as a separate machine-readable
 *  field instead of parsing it back out of `result`. If the two ever disagree,
 *  the instrument's own thresholds win.
 *
 *  Returns null for every non-assessment row, and for an assessment whose result
 *  carries no parseable number — absence renders no lozenge, which is correct and
 *  better than a lozenge reading "NaN". */
/** ═══ THE DISCLOSURE BODY — ONE RENDERER, TWO CALL SITES (D) ═══
 *
 *  Both sites used to be the same three lines of JSX rendering
 *  `event.providerNote` as one pre-line block, and both had to grow a per-field
 *  disclosure. Two copies of that is two places for it to be wrong, and the
 *  borrowed-documentation path is the one a reader reaches least often — so it
 *  is the copy that would have been missed.
 *
 *  THE FLAT STRING IS STILL THE FALLBACK, and not as a defensive gesture. Risk
 *  flags, escalations and presentation changes all carry free prose with no
 *  fields in it — AND SO DO MOST `care_update` ROWS. t17 alone has 19 of them:
 *  "Guardian contact logged", "Mentor coaching note", "Activity completed" —
 *  operational log entries that reuse the `care_update` type and have no
 *  structured body behind them at all, against 2 that do.
 *
 *  So this branch is NOT "is this a care update". It is "does this row have the
 *  three-field clinical form behind it", which is the narrower question and the
 *  only one that can be answered honestly — a check on `type` would have put
 *  clinical-form labels and a provenance footnote over a note about a phone
 *  call. Measured, after a test asserting the type-based version failed.
 *
 *  (That two different things share one event type is a real modelling defect,
 *  and it is not this component's to fix. Reported.) */
function NoteBody({ event }: { event: CareEvent }) {
  const NOTE = "whitespace-pre-line text-[var(--text-secondary)]";
  const FONT = { font: "var(--type-row-label)" } as const;

  if (!event.noteSections?.length)
    return (
      <p className={NOTE} style={FONT}>
        {event.providerNote}
      </p>
    );

  return (
    <div className="space-y-2">
      {event.noteSections.map((s) => (
        <div key={s.id}>
          {/* THE LABEL IS ITS OWN ELEMENT NOW. It used to be a line inside the
              pre-line string, which rendered identically to the prose under it —
              a heading only because it happened to be first. Structuring the
              note was forced by the disclosure; making the label look like a
              label is what that structure buys. */}
          <p className="text-[var(--text-muted)]" style={FONT}>
            {s.label}
          </p>
          <p className={NOTE} style={FONT}>
            {s.text}
          </p>
          <FieldProvenanceNote state={s.provenance} />
        </div>
      ))}
    </div>
  );
}

function scoreFor(event: CareEvent): { value: number; band: string } | null {
  if (event.type !== "assessment") return null;
  const n = Number(String(event.result).match(/\d+/)?.[0]);
  if (!Number.isFinite(n)) return null;
  const instrument = event.description;
  if (instrument !== "PHQ-9" && instrument !== "GAD-7") return null;
  const band = severityFor(instrument, n);
  // The sentence-cased label lives on the lozenge itself now — see `bandLabel`
  // in ui/evidence-primitives.
  return { value: n, band };
}

const TONE_STYLE: Record<string, string> = {
  neutral:
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  warm: "bg-[var(--alert-warm-bg)] text-[var(--alert-warm-fg)]",
  warning: "bg-[var(--alert-warning-bg)] text-[var(--alert-warning-fg)]",
  critical:
    "bg-[var(--alert-critical-bg)] text-[var(--alert-critical-fg)]",
};

const dateOf = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Provenance line. Always rendered — the whole point is that a reader never has
 *  to guess. AI carries an icon so it reads differently at a glance. */
/** Just the name, for a sentence that already has its own framing. `Provenance`
 *  renders the same union as a labelled line; this is for inline prose. A care
 *  update is always person-authored, so the fallback is defensive only. */
function personName(author: CareEvent["author"]): string {
  return author.kind === "person" ? author.name : "a supervisor"; // TODO-COPY
}

function Attribution({ author }: { author: CareEvent["author"] }) {
  if (author.kind === "ai") {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
        <Sparkles className="size-3" aria-hidden />
        {/* TODO-COPY */}
        AI generated{author.model ? ` · ${author.model}` : ""}
      </span>
    );
  }
  if (author.kind === "system") {
    /* ═══ "RAISED BY", NOT "LAST EDITED BY" — A FLAGGED DEVIATION ═══
       The given format is "Last edited by {name}, {role}", and it assumes a
       human editor. A moderation classifier does not EDIT anything: it raises a
       match. "Last edited by Moderation" would attribute an editorial act to a
       process, on a record where who edited what is the thing being audited.
       So the system variant says what happened instead. Named as a deviation
       rather than absorbed — it is veto-able. TODO-COPY. */
    return (
      <span className="text-[var(--text-muted)]">
        {/* The system author carries no name in the model — the source IS the
            system — so the product's own name stands in rather than a blank. */}
        Raised by Somethings
      </span>
    );
  }
  /* ═══ A SYSTEM SOURCE WEARING A PERSON'S SHAPE ═══
     `author.kind === "system"` is NOT how the moderation flags arrive. They are
     built from `raisedBy: "Somethings" / raisedByRole: "System"` and reach here
     as `kind: "person"`, so the branch above never fires for them — measured,
     not assumed: the row rendered "Last edited by Somethings, System", which is
     exactly the sentence B2 forbids.
     So the source is detected by ROLE. The underlying fix is that a system
     source should not be modelled as a person at all, which is a data change
     across `careFlagsFor` and its fixtures; reported rather than done here. */
  if (author.role === "System") {
    return (
      <span className="text-[var(--text-muted)]">
        {/* TODO-COPY */}
        Raised by {author.name}
      </span>
    );
  }
  /* "Last edited by {name}, {role}" — a COMMA between name and role, per the
     given format, where the rest of this sub-line uses middots. The comma is
     doing different work: the middot separates independent facts, and the role
     is not independent of the name it qualifies. TODO-COPY. */
  return (
    <span className="text-[var(--text-muted)]">
      Last edited by {author.name}, {author.role}
    </span>
  );
}

/** ═══ THE RELATIONAL LINE (Phase 2) ═══
 *
 *  What turns a flat log into a chain a supervisor can walk. One muted line under
 *  an entry saying where this one sits in its own sequence, and a link back to the
 *  one before it.
 *
 *  A FIRST OCCURRENCE GETS NO LINE. This once read "First flag" with no link,
 *  on the argument that a record's first flag is a fact worth stating plainly.
 *  Reversed: it stated that the first thing in a sequence is the first thing in
 *  the sequence, and it did so at the TOP of the block, above the content the
 *  reader opened. A line whose whole job is to point backwards has nothing to
 *  do when there is nothing behind it.
 *
 *  So `previous` is effectively always present now for flags, and the builder
 *  emits no entry at all on a first occurrence — which the render's own
 *  `relational &&` guard already handles. It stays OPTIONAL on the interface
 *  because presentation changes are built through the same shape. */
export interface RelationalLine {
  /** TODO-COPY. "3rd flag" / "Changed from F41.1". */
  lead: string;
  /** The entry this one follows, when there is one. */
  previous?: { id: string; at: number };
}

/** TODO-COPY. "2nd", "3rd", "11th" — the ordinal a flag's place in the sequence
 *  reads as. Handles the teens, which is where a naive suffix table breaks. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function Row({
  event,
  amendedBy,
  amends,
  relational,
  documents,
  documentedBy,
  summarizedBy,
  landed,
  matchInDetails,
  onJump,
}: {
  event: CareEvent;
  /** The entry that supersedes this one, when there is one. */
  amendedBy?: CareEvent;
  /** The entry this one corrects, when it corrects one. */
  amends?: CareEvent;
  /** Flag, escalation and presentation-change entries only. */
  relational?: RelationalLine;
  /** ═══ THE TWO HALVES OF ONE DOCUMENTED EVENT ═══
   *
   *  `documents` — set on a care_update row: the presentation event it documents.
   *  `documentedBy` — set on a presentation_* row: the care update documenting it.
   *
   *  TWO ENTRIES, CROSS-REFERENCED, NEVER MERGED. A merged row would claim one
   *  thing happened where two did, and an append-only record cannot later take
   *  that apart. Each row reads on its own and points at its counterpart.
   *
   *  A standalone care update has neither, which is how it stays visibly
   *  standalone rather than looking like a link that failed to resolve. */
  documents?: CareEvent;
  documentedBy?: CareEvent;
  /** ═══ THE THIRD RELATION: EVIDENCE ↔ ASSESSMENT ═══
   *
   *  Set on a care_update row: the committed care summary frozen in the same act.
   *  The reciprocal of the summary row's own `documentedBy`, and DERIVED here
   *  rather than stored — the summary carries the edge, so the update needs no
   *  field of its own. That matters because a care update is append-only: a
   *  reference written onto it afterwards would be an edit to an entry someone
   *  already signed.
   *
   *  A SECONDARY LINE, NOT A DISCLOSURE TAKEOVER. Unlike `documentedBy` on a
   *  presentation row, neither of these two entries is empty without the other:
   *  the summary has its frozen findings, the update has its prose. Each keeps
   *  its own disclosure and points at the other. */
  summarizedBy?: CareEvent;
  /** True for ~1.6s after another surface jumped to this row. See `jump`. */
  landed: boolean;
  /** The query matched only inside this row's COLLAPSED expansion. Renders a
   *  quiet hint so a result never looks like a false positive. */
  matchInDetails?: boolean;
  onJump: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const superseded = !!amendedBy;
  // A presentation row is expandable when it has an update to show, even though
  // it no longer carries a note of its own.
  // A SUMMARY ROW CARRIES ITS OWN FINDINGS, so `documentedBy` must not stand in
  // for a note here the way it does on a presentation row.
  const borrowsDisclosure = !!documentedBy && event.type !== "care_summary";
  const score = scoreFor(event);

  /** ═══ WHAT LINE 2 HOLDS WHEN THERE IS NO AMENDMENT ═══
   *
   *  The row's status followed by its author, per the brief's flag example
   *  ("title; status + attribution"). Two rules make it collapse to nothing
   *  rather than to filler:
   *
   *  · THE STATUS IS DROPPED FOR ASSESSMENTS, because the lozenge on line 1 is
   *    that status — "GAD-7 [11 | Moderate]" then "11 — moderate" underneath is
   *    the same fact twice.
   *  · A SYSTEM AUTHOR IS DROPPED. "Recorded automatically" is provenance
   *    detail, not scan-level information, and it appeared on a large share of
   *    rows — so it read as furniture while pushing real attributions down.
   *    It renders in the expanded state instead. */
  /** ═══ THE STATUS MOVED TO THE LOZENGE, AND THE DURATION LEFT THE ROW ═══
   *
   *  `event.result` on a flag or escalation reads "Open" or "Resolved · 48h" —
   *  a status AND a duration in one string, rendered on the sub-line. The status
   *  is now the lozenge's second half, so rendering it here too would be the
   *  same word twice on one row.
   *
   *  THE DURATION IS DROPPED FROM THE COLLAPSED ROW ENTIRELY, which is what the
   *  pack asks: how long something stayed open is a fact about the closed
   *  episode, not a scan-level one, and it belongs with the resolution. It is
   *  picked up in the expansion — see `EscalationDetail`'s Date resolved cell. */
  const hasStatus = event.type === "escalation" || event.type === "risk_flag";
  const rawResult = String(event.result || "").trim();
  const statusWord = hasStatus
    ? (rawResult.split("·")[0].trim() || null)
    : null;
  const resolved = /resolved/i.test(rawResult);
  const statusText = score || hasStatus ? null : rawResult || null;
  const named = event.author.kind === "person";
  const line2 =
    statusText || named ? (
      <>
        {statusText && <span>{statusText}</span>}
        {statusText && named && (
          <span aria-hidden className="text-[var(--text-muted)]">
            ·
          </span>
        )}
        {named && <Attribution author={event.author} />}
      </>
    ) : null;

  /** EXPANDABLE NOW INCLUDES THE DEMOTED LINES. A row whose only extra content
   *  is its relational position or a system attribution still has to be
   *  openable, or demoting those lines would delete them. */
  const demoted =
    !!relational ||
    !!documents ||
    !!summarizedBy ||
    (event.type === "care_summary" && !!documentedBy) ||
    !!event.diagnosticPrefill ||
    (!!amends && superseded) ||
    !named;
  /** ═══ THE FIELD SET IS ITS OWN REASON TO OPEN ═══
   *
   *  This list never mentioned the flag and escalation field sets, and it needed
   *  to: the expansion below renders `EscalationDetail` / `FlagDetail` off
   *  `event.flagRecord`, so a row carrying one has a whole block of content
   *  behind a control this predicate was deciding not to draw.
   *
   *  IT SURVIVED ONLY BY ACCIDENT. Every flag and escalation used to carry a
   *  `relational` line — "First flag" on the first one — and `demoted` counts
   *  `relational` as content. Dropping that bare line took the expander with it
   *  on every record whose flag was its first, which is most of them: t13's
   *  crisis, t9, t22, t6 and the head of t21's cluster all lost the only way
   *  into their own detail.
   *
   *  So the predicate now names the field set directly. It is stated the same
   *  way the expansion dispatches on it — `flagRecord` AND the type — so the two
   *  cannot disagree about which rows have one: a closure entry carries no
   *  `flagRecord` and still takes the `providerNote` fallback. */
  const hasFieldSet =
    !!event.flagRecord &&
    (event.type === "escalation" || event.type === "risk_flag");
  const expandable =
    !!event.items?.length ||
    !!event.providerNote ||
    borrowsDisclosure ||
    hasFieldSet ||
    demoted;

  return (
    <li
      id={`care-${event.id}`}
      // A superseded entry is RECESSED, not DIMMED. A blanket opacity-60 here
      // measured 4.41:1 on its description — below AA — and the entry a
      // correction points at is precisely the one a reader must still be able to
      // read. Tone does the same job at full contrast: the row sits back on the
      // s1 surface and its description drops one ink step, which is how the rest
      // of this product says "set aside".
      className={cn(
        "px-[var(--surface-pad-x)] py-3",
        superseded && "bg-[var(--surface-s1)]",
        // See the note on `jump`. The transition is the only motion on this row,
        // and it is suppressed for a reader who asked for less.
        "transition-colors duration-500 motion-reduce:transition-none",
        landed && "bg-[var(--tint-press)]"
      )}
    >
      {/* ═══ DATE GUTTER + ROW ═══
          A fixed 96px column of right-aligned dates, then the row. The gutter is
          what makes the list scan as a timeline: the dates form a single edge a
          reader's eye can run down, which they cannot do when the date is the
          first inline token of a wrapping line.
          NOT GROUPED BY MONTH. Dividers that fire on almost every row are chrome
          (the same finding as the Activity feed's day dividers); the gutter
          carries the same information continuously and costs no vertical space. */}
      {/* ═══ ONE ROW LAYOUT, ALIGNED TO LINE ONE (E1–E4) ═══
          Before: `items-start` plus a `pt-0.5` on the date and an `mt-0.5` on the
          chevron — two magic 2px nudges approximating an alignment nobody had
          defined. The date (12px/16px) and the title (14px/20px) have different
          line boxes, so top-aligning them puts their baselines 2px apart and the
          nudges were an attempt to close that by eye.

          NOW: `--care-row-line1` is the height of line one, and the date, the
          chevron and the lozenge are all boxes of exactly that height with their
          content centred in it. That gives three things at once — the date sits on
          the title's optical centre (which for a single line of text IS baseline
          alignment, since both boxes share a centre), the chevron centres on the
          FIRST line rather than on the container, and neither moves when a second
          line appears below. A two-line row grows downward only.

          22px, NOT 20px: line one's tallest child is the type chip
          (`text-[12px] py-0.5` → 18px of line box plus 4px of padding), not the
          14px/20px title. Measuring the chip is the difference between the chevron
          being centred and being 1px high.

          THE VALUE IS LOCAL, not a token: it is the height of THIS row's first
          line, derived from this row's own children, and a global spacing token
          would imply it applies somewhere else. Flagged rather than minted. */}
      <div
        className="flex items-start gap-3 sm:gap-4"
        style={{ "--care-row-line1": "22px" } as React.CSSProperties}
      >
        {/* NOT `aria-hidden`. The gutter is the row's date at `sm` and up, and
            the inline copy below is `sm:hidden` — so exactly ONE of the two is
            rendered at any width, and `display:none` keeps the other out of the
            accessibility tree. Hiding this one as decorative would have taken
            the date out of the row's accessible name at every width above
            640px, which is where most readers are. */}
        {/* E2 · THE DATE COLUMN. 96px is sized to the longest string the
            formatter produces — "Aug 28, 2026" at `--type-row-label` with
            `tabular-nums`, which is what makes the column a straight edge rather
            than a ragged one: proportional digits change width per numeral, so
            "Jul 11" and "Aug 28" would not end at the same place.
            `h-[var(--care-row-line1)] items-center` replaces `pt-0.5`. */}
        <span
          className="hidden h-[var(--care-row-line1)] w-[96px] shrink-0 items-center justify-end text-right tabular-nums text-[var(--text-muted)] sm:flex"
          style={{ font: "var(--type-row-label)" }}
        >
          {dateOf(event.occurredAt)}
        </span>

        {expandable ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} details for ${TYPE_LABEL[event.type]} on ${dateOf(event.occurredAt)}`}
            className={cn(
              // E3 · A FIXED 24px SLOT, CENTRED ON LINE ONE. `size-6` gives the
              // 24px target; the wrapper height is line one's, so the glyph
              // cannot drift when the row gains a second line.
              "flex h-[var(--care-row-line1)] w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)]",
              "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            <ChevronRight
              className={cn("size-4 transition-transform", open && "rotate-90")}
              aria-hidden
            />
          </button>
        ) : (
          // Keeps the columns aligned without implying a control. Same slot
          // geometry as the button above, or the titles of expandable and
          // non-expandable rows would start at different x.
          <span
            aria-hidden
            className="h-[var(--care-row-line1)] w-6 shrink-0"
          />
        )}

        <div className="min-w-0 flex-1">
          {/* ── LINE 1 · title, score lozenge, type chip ───────────────────
              NO `flex-wrap`. With wrapping, a long escalation title pushed the
              type chip onto a second line and the row became three lines deep —
              measured at 88 and 95px against a 70px two-line row, which is how
              this was caught. The two-line cap is the point of the anatomy, so
              the TITLE truncates instead and the chip holds its place. */}
          {/* E4 · LINE ONE IS A KNOWN HEIGHT, and the lozenge centres in it. On a
              single-line row that is the same as centring in the row; on a
              two-line row it stays anchored here, because the chip labels the
              EVENT and not the paragraph under it. */}
          <div className="flex h-[var(--care-row-line1)] items-center gap-x-2">
            {/* THE GUTTER IS HIDDEN BELOW `sm`, so the date returns inline there
                — a 96px column plus a chevron plus a title does not fit at
                320px. Exactly one of the two renders at any width, so the
                accessible name carries the date once and never twice. */}
            <span
              className="shrink-0 tabular-nums text-[var(--text-muted)] sm:hidden"
              style={{ font: "var(--type-row-label)" }}
            >
              {dateOf(event.occurredAt)}
            </span>

            {/* `truncate` is VISUAL ONLY — `text-overflow` leaves the full
                string in the DOM, so a screen reader still reads the whole
                title and the row's accessible name is complete. `title` gives a
                pointer user the same thing on hover. */}
            <span
              title={event.description}
              className={cn(
                "min-w-0 truncate",
                superseded
                  ? "text-[var(--text-secondary)]"
                  : "text-[var(--text-primary)]"
              )}
              style={{ font: "var(--type-row-value)" }}
            >
              {event.description}
            </span>

            {/* THE SCORE LOZENGE — assessments only. One unit, square-cornered,
                so `GAD-7 [11 | Moderate]` reads as a single value rather than as
                a number that happens to sit near a word. It replaces the
                separate result line for this type, which is why assessments get
                no line 2 unless they are amended. */}
            {score && <ScoreLozenge value={score.value} band={score.band} />}

            {/* RIGHT-ALIGNED. `ml-auto` rather than `justify-between` so it
                still sits beside the title when the row is short instead of
                being pushed to the far edge of a wide table. */}
            {/* ═══ TYPE AND STATUS IN ONE LOZENGE ═══
                Only escalations and flags have a status; every other type is
                unchanged, because appending a status to a statusless type would
                invent one. "Open" keeps the type's strong tint, which is now
                RESERVED for open items; "Resolved" goes neutral and recedes on
                scan. The WORD carries the state and the tone reinforces it —
                a monochrome print and a screen reader read the same thing.

                TRUNCATION SACRIFICES THE TYPE, NOT THE STATUS. `min-w-0` and
                `truncate` on the type span alone, so a narrow container clips
                "Escalation" before it clips "Open" — the status is the
                scannable payload here, and the type is already implied by the
                row's own content. `title` carries the whole string. */}
            <span
              title={statusWord ? `${TYPE_LABEL[event.type]} · ${statusWord}` : undefined}
              className={cn(
                "ml-auto flex min-w-0 shrink items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
                statusWord && resolved
                  ? "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]"
                  : TONE_STYLE[TYPE_TONE[event.type]]
              )}
            >
              <span className="min-w-0 truncate">{TYPE_LABEL[event.type]}</span>
              {statusWord && (
                <>
                  <span aria-hidden className="shrink-0 opacity-50">
                    ·
                  </span>
                  <span className="shrink-0">{statusWord}</span>
                </>
              )}
            </span>
          </div>

          {/* ── LINE 2 · ONE LINE, OR NONE ────────────────────────────────
              Attribution, or an amendment link, and nothing else. Six secondary
              lines used to render here — relational position, what an update
              documents, the evidence pair, whether a draft was edited, and both
              directions of the amendment chain — and a row could show four of
              them at once. They are all real, and none of them is what a reader
              scanning a 30-entry table needs; they are now in the expanded
              state, which is one keystroke away and is where detail belongs.

              AMENDMENT BEATS ATTRIBUTION when both apply: that an entry has been
              superseded changes how everything else on the row should be read,
              and who wrote it does not.

              "RECORDED AUTOMATICALLY" IS GONE FROM SCAN LEVEL. A system-authored
              row with no amendment now has no line 2 at all — absence is the
              honest rendering of "nobody to name". */}
          {superseded ? (
            <p className="mt-1" style={{ font: "var(--type-row-label)" }}>
              <button
                type="button"
                onClick={() => onJump(amendedBy!.id)}
                className={cn(
                  "rounded-sm text-[var(--alert-warm-fg)] underline underline-offset-2",
                  RING
                )}
              >
                {/* TODO-COPY */}
                Amended on {dateOf(amendedBy!.occurredAt)}
              </button>
            </p>
          ) : amends ? (
            <p className="mt-1" style={{ font: "var(--type-row-label)" }}>
              <button
                type="button"
                onClick={() => onJump(amends.id)}
                className={cn(
                  "rounded-sm text-[var(--text-secondary)] underline underline-offset-2",
                  /* ═══ THE LINK IS WHAT LIGHTS UP (Workstream D) ═══
                     The row already tints when jumped to; this puts the emphasis
                     on the SENTENCE that names the relationship, because that is
                     the thing being taught. ~800ms, half the row's 1600 — the
                     link should settle before the row does, so the eye ends on the
                     text rather than on a fading rectangle.
                     `motion-reduce:transition-none` makes it a static highlight
                     that clears on the next state change rather than a fade, which
                     is what "no animation" means for a decaying cue. */
                  "-mx-1 rounded-sm px-1 transition-colors duration-[800ms] motion-reduce:transition-none",
                  landed && "bg-[var(--tint-press)] text-[var(--text-primary)]",
                  RING
                )}
              >
                {/* TODO-COPY — names the date so the pair is findable when a
                    filter or the scroll position hides its partner. */}
                {`Amends the ${dateOf(amends.occurredAt)} entry`}
              </button>
            </p>
          ) : (
            line2 && (
              // NO WRAP HERE EITHER. At 1280 the spine is 688px and
              // "F33.1 — unchanged · Dr. Amara Patel · Supervisor" wrapped,
              // making a two-line row three lines — and only at that width,
              // which is why it survived the 1024 pass. Measured at 88px against
              // a 70px row. The cap applies to both lines or it is not a cap.
              <p
                className="mt-1 flex items-center gap-x-2 overflow-hidden text-[var(--text-secondary)] [&>*]:shrink-0 [&>*:last-child]:min-w-0 [&>*:last-child]:truncate"
                style={{ font: "var(--type-row-label)" }}
              >
                {line2}
              </p>
            )
          )}

          {/* ═══ WHY A ROW SAYS IT MATCHED ═══
              A result whose match is inside a collapsed expansion looks like a
              false positive, and a reader who cannot see why a row is in their
              results stops trusting the search. The hint is ROW-LEVEL only —
              nothing is highlighted inside the expansion, and emphatically
              nothing inside a flagged quote, which renders verbatim and
              untouched. Suppressed once the row is open: the content is on
              screen by then, so the hint would be pointing at something the
              reader is already looking at. TODO-COPY. */}
          {matchInDetails && !open && (
            <p
              className="mt-1 text-[var(--text-muted)]"
              style={{ font: "var(--type-row-label)" }}
            >
              Match in details
            </p>
          )}

          {open && (
            <div className="mt-3 rounded-[var(--radius-surface)] bg-[var(--surface-s1)] p-3">
              {/* ═══ THE DEMOTED LINES ═══
                  Everything that used to render collapsed and now does not. All
                  of it is real and none of it is what a reader scanning a
                  30-entry table needs; kept together at the top of the expanded
                  block so opening a row shows its relationships before its
                  contents.
                  NOTHING WAS DELETED IN THE DEMOTION — that is the whole point
                  of the `demoted` flag on expandability: a row whose only extra
                  content is one of these still opens. */}
              {(relational ||
                documents ||
                summarizedBy ||
                (event.type === "care_summary" && documentedBy) ||
                event.diagnosticPrefill ||
                (amends && superseded) ||
                event.author.kind !== "person") && (
                <div
                  className="mb-3 space-y-1 border-b border-[color:var(--border-subtle)] pb-3 text-[var(--text-muted)]"
                  style={{ font: "var(--type-row-label)" }}
                >
                  {/* Attribution for a non-person author. Demoted from line 2
                      because "Recorded automatically" appeared on a large share
                      of rows, read as furniture, and pushed real attributions
                      down the row. */}
                  {event.author.kind !== "person" && (
                    <p>
                      <Attribution author={event.author} />
                    </p>
                  )}

                  {relational && (
                    <p>
                      {relational.lead}
                      {relational.previous && (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => onJump(relational.previous!.id)}
                            className={cn(
                              "rounded-sm underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
                              RING
                            )}
                          >
                            {/* TODO-COPY */}
                            {`previous ${dateOf(relational.previous.at)}`}
                            <span aria-hidden> →</span>
                          </button>
                        </>
                      )}
                    </p>
                  )}

                  {documents && (
                    <p>
                      {/* TODO-COPY */}
                      {"Documents the "}
                      <button
                        type="button"
                        onClick={() => onJump(documents.id)}
                        className={cn(
                          "rounded-sm underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
                          RING
                        )}
                      >
                        {`${dateOf(documents.occurredAt)} ${documents.type === "presentation_changed" ? "presentation change" : "presentation review"}`}
                        <span aria-hidden> →</span>
                      </button>
                    </p>
                  )}

                  {(summarizedBy ??
                    (event.type === "care_summary" ? documentedBy : undefined)) && (
                    <p>
                      {/* TODO-COPY. "Read alongside", not "supports" or
                          "justifies": which way the evidence pointed is a
                          finding inside the document, and this line must not
                          restate it as a conclusion. */}
                      {"Read alongside the "}
                      <button
                        type="button"
                        onClick={() =>
                          onJump((summarizedBy ?? documentedBy)!.id)
                        }
                        className={cn(
                          "rounded-sm underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
                          RING
                        )}
                      >
                        {`${dateOf((summarizedBy ?? documentedBy)!.occurredAt)} ${
                          summarizedBy ? "care summary" : "care update"
                        }`}
                        <span aria-hidden> →</span>
                      </button>
                    </p>
                  )}

                  {event.diagnosticPrefill && (
                    <p>
                      {/* TODO-COPY — the fact, not a judgement of it. "Reviewed
                          as drafted" is not a criticism: a draft that was
                          already right should not have to be edited to look
                          diligent. What matters is that a reader can tell which
                          happened. */}
                      {event.diagnosticPrefill.edited
                        ? `Diagnostic statement edited by ${personName(event.author)}`
                        : "Diagnostic statement reviewed as drafted"}
                    </p>
                  )}

                  {/* BOTH ENDS OF THE CHAIN, when a row is both an amendment and
                      itself amended. Line 2 shows the superseding link — being
                      out of date changes how the row should be read — so the
                      backward link lands here. */}
                  {amends && superseded && (
                    <p>
                      <button
                        type="button"
                        onClick={() => onJump(amends.id)}
                        className={cn(
                          "rounded-sm underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
                          RING
                        )}
                      >
                        {`Amends the ${dateOf(amends.occurredAt)} entry`}
                      </button>
                    </p>
                  )}
                </div>
              )}

              {/* ═══ THE FIELD SETS COME FIRST ═══
                  Before the assessment table and before the bare providerNote
                  fallback, because an escalation or a flag that reached here used
                  to fall all the way through to `providerNote` — one paragraph
                  where a field set belongs. `flagRecord` is set only by
                  `flagEventsFor`, so a CLOSURE entry (`ce-close-*`) still takes
                  the fallback: a closure is its own event about the flag, and its
                  note is the right thing to show. */}
              {event.flagRecord && event.type === "escalation" ? (
                <EscalationDetail
                  record={event.flagRecord}
                  occurredAt={event.occurredAt}
                />
              ) : event.flagRecord && event.type === "risk_flag" ? (
                <FlagDetail record={event.flagRecord} occurredAt={event.occurredAt} />
              ) : event.items?.length ? (
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th
                        className="pb-1 pr-3 font-medium text-[var(--text-muted)]"
                        style={{ font: "var(--type-field-label)" }}
                      >
                        {/* TODO-COPY */}
                        Question
                      </th>
                      <th
                        className="pb-1 pr-3 font-medium text-[var(--text-muted)]"
                        style={{ font: "var(--type-field-label)" }}
                      >
                        Answer
                      </th>
                      <th
                        className="pb-1 text-right font-medium text-[var(--text-muted)]"
                        style={{ font: "var(--type-field-label)" }}
                      >
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.items.map((it) => (
                      <tr key={it.question} className="align-top">
                        <td
                          className="py-1 pr-3 text-[var(--text-primary)]"
                          style={{ font: "var(--type-row-label)" }}
                        >
                          {it.question}
                        </td>
                        <td
                          className="py-1 pr-3 text-[var(--text-secondary)]"
                          style={{ font: "var(--type-row-label)" }}
                        >
                          {it.answer}
                        </td>
                        <td
                          className="py-1 text-right text-[var(--text-primary)] tabular-nums"
                          style={{ font: "var(--type-row-label)" }}
                        >
                          {it.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : borrowsDisclosure && documentedBy ? (
                /* THE PRESENTATION ENTRY CARRIES ITS CARE UPDATE. It no longer
                   has a note of its own — the update IS the documentation — so
                   opening a presentation change shows the reasoning that was
                   committed with it, in the same words, rather than a second
                   copy of the prose or a bare link. */
                <div className="space-y-2">
                  {/* D. THE DISCLOSURE FOLLOWS THE PROSE WHEREVER THE PROSE
                      GOES — including here, where a presentation-change row is
                      showing a care update it did not itself write. A reader
                      opening the code change is reading that update's words, so
                      they are owed the same footnote the update carries. */}
                  <NoteBody event={documentedBy} />
                  {documentedBy.assessment && (
                    <AssessmentChip value={documentedBy.assessment} />
                  )}
                  <button
                    type="button"
                    onClick={() => onJump(documentedBy.id)}
                    className={cn(
                      "rounded-sm py-1 text-left underline underline-offset-2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]",
                      RING
                    )}
                    style={{ font: "var(--type-row-label)" }}
                  >
                    {/* TODO-COPY */}
                    {`Open the ${dateOf(documentedBy.occurredAt)} care update`}
                    <span aria-hidden> →</span>
                  </button>
                </div>
              ) : (
                <NoteBody event={event} />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ══════════════════ THE ESCALATION AND FLAG EXPANSIONS ══════════════════
 *
 * ═══ THE N/A RULE, AND WHY IT IS NOT AN OMISSION ═══
 *
 * A field with no value renders as its LABEL PLUS AN EM-DASH, never as nothing.
 * This is an audit surface: "no safety plan was recorded" and "this row has no
 * safety plan field" are different facts, and only the first is true here. A
 * reader scanning for what was missed cannot see a row that is not drawn.
 *
 * The single exception is the brief's own: Emergency contact and Conversations
 * collapse into ONE em-dash line when both are empty, because two adjacent
 * dashes about the same absent person is a row of furniture.
 *
 * ═══ EVERYTHING HERE IS REUSED ═══
 *
 * `TonalChip` for every chip, `QuoteBlock` from `ui/evidence-primitives` for the
 * excerpt, the care update's label-over-prose rhythm for the blocks, and the
 * timeline's own `Attribution` grammar for the footer. NO NEW COMPONENT: the
 * brief expected one (a quote block) and two already existed. */

const FIELD_LABEL = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** TODO-COPY on every label string in this block. */
const EM_DASH = "\u2014";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex items-center gap-1.5 text-[var(--text-muted)]"
      style={FIELD_LABEL}
    >
      {children}
    </p>
  );
}

/** One cell of the fact grid. The value sits on its own line under the label,
 *  the same rhythm as the care update's read view. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
        {children}
      </div>
    </div>
  );
}

/** TWO COLUMNS, and a container query rather than a viewport one — this grid
 *  lives inside an inset inside a row inside a rail-flanked column, so the
 *  viewport has never been the thing that decides whether two columns fit. */
function FactGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 @[22rem]:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

/** Label over prose, exactly the care update's block. `body` absent renders the
 *  em-dash — see the N/A rule. */
function ProseBlock({
  label,
  body,
  badge,
}: {
  label: string;
  body?: string;
  /** The AI badge, on the ONE block that is model-written. */
  badge?: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel>
        {label}
        {badge}
      </FieldLabel>
      {body ? (
        <p className="mt-1 max-w-prose whitespace-pre-line text-[14px] leading-[1.55] text-[var(--text-primary)]">
          {body}
        </p>
      ) : (
        <p className="mt-1 text-[14px] leading-[1.55] text-[var(--text-muted)]">
          {EM_DASH}
        </p>
      )}
    </div>
  );
}

/** ═══ THE AI BADGE ═══
 *  The same Sparkles + wording the timeline's own `Attribution` uses for an
 *  AI author, so a model's writing is marked identically wherever it appears.
 *  It rides on ONE label in this expansion and nowhere else. */
function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
      <Sparkles className="size-3" aria-hidden />
      {/* TODO-COPY */}
      AI generated
    </span>
  );
}

/** "Resolved by X · 12 Mar 2026 at 9:32 PM". Mirrors the care update's
 *  attribution row. NOT rendered while open — the collapsed row's "Open" already
 *  carries that state, and a footer saying nothing would be the second place a
 *  reader looks for a status that is one line up. */
/** ═══ WHO, AS ONE STRING ═══
 *  Name and role together, because a name with no role is an audit line that
 *  does not say what authority the person was acting under. `filter(Boolean)`
 *  so a record missing the role degrades to the bare name rather than printing
 *  a trailing separator. */
function who(name?: string, role?: string): string | null {
  const parts = [name, role].filter(Boolean);
  return parts.length ? parts.join(" \u00b7 ") : null;
}

/* `ResolutionFooter` LIVED HERE and is deleted with its last caller. It set
   "{verb} by {who} · {date} at {time}" under a hairline at the foot of both
   field sets; those facts are labelled cells in the grids now, and a component
   nobody renders is a thing the next reader has to work out is dead. */

/** ═══ THE RESOLUTION DATE IS DERIVED FROM THE ROW, NOT FROM `Date.now()` ═══
 *
 *  The first version called `Date.now()` in the footer and lint stopped it —
 *  "Cannot call impure function during render". The rule caught a real defect,
 *  not a style point: the row's own date came from `ago(now, daysAgo)` against
 *  the timeline's fixed `now`, so a footer reading the wall clock could state a
 *  resolution date that disagrees with the entry it sits inside.
 *
 *  `occurredAt` already encodes that `now`. The gap between raise and resolution
 *  is `daysAgo - resolvedDaysAgo`, so the resolution instant is the row's own
 *  timestamp plus that gap — pure, and incapable of drifting from the row. */
function resolvedAtFrom(record: CareFlagRecord, occurredAt: number): number | null {
  if (record.resolvedDaysAgo === undefined) return null;
  const openDays = record.daysAgo - record.resolvedDaysAgo;
  return occurredAt + openDays * 86_400_000;
}

function EscalationDetail({
  record,
  occurredAt,
}: {
  record: CareFlagRecord;
  occurredAt: number;
}) {
  const d = record.escalationDetail;
  /* THE BRIEF'S ONE COMBINING EXCEPTION. Both empty is a common shape on an
     open escalation — nobody has been contacted yet — and two dashes about the
     same absent person reads as a form nobody filled in rather than as a fact. */
  const contactsBothEmpty = !d?.emergencyContact && !d?.contactConversations;
  const resolvedAt = resolvedAtFrom(record, occurredAt);
  /** How long it stayed open, in the same words the collapsed row used to carry
   *  — "same day" / "24h" / "48h" / "N days" — derived from the record's own two
   *  day counts rather than from the string that row built, so the two cannot
   *  drift now that only one of them renders. */
  const openSpan = (() => {
    if (record.resolvedDaysAgo === undefined) return null;
    const days = record.daysAgo - record.resolvedDaysAgo;
    if (days <= 0) return "same day";
    if (days === 1) return "24h";
    if (days < 3) return `${days * 24}h`;
    return `${days} days`;
  })();
  const crisisLabel = record.crisis
    ? (CRISIS_TYPE.find((c) => c.id === record.crisis!.type)?.label ?? null)
    : null;

  return (
    <div className="space-y-4">
      <FactGrid>
        <Fact label="Escalation type">
          {d?.type ? <TonalChip tone="warning">{d.type}</TonalChip> : EM_DASH}
        </Fact>
        <Fact label="Crisis sub-type">
          {crisisLabel ? <TonalChip>{crisisLabel}</TonalChip> : EM_DASH}
        </Fact>
        {/* ═══ WHO RAISED IT, WHO CLOSED IT, AND WHEN — IN THE RECORD ITSELF ═══
            None of these four were in the field set. The raiser was on line 2 of
            the COLLAPSED row and vanished there entirely when the author was not
            a person; the open date was only the row's own header; and the
            resolver and resolution date were a sentence in a footer that
            rendered only once something was resolved — so an open escalation
            documented neither who was handling it nor when it started.
            This block is the formal record of the escalation. It has to read on
            its own, without the row it came out of. */}
        <Fact label="Raised by">
          {who(record.raisedBy, record.raisedByRole) ?? EM_DASH}
        </Fact>
        <Fact label="Date opened">{dateOf(occurredAt)}</Fact>
        <Fact label="Date resolved">
          {/* STILL OPEN IS A FACT, and the em-dash is how this surface states
              one. The pair below reads "— / —" on an open escalation, which is
              the honest shape: nobody has closed it and nobody is recorded as
              having. */}
          {/* ═══ THE DURATION LANDS HERE, NOT IN AN ATTRIBUTION FOOTER ═══
              A4 puts it on "the expansion's attribution footer". That footer
              does not exist any more — it read "Resolved by {name} · {date}" and
              was removed two packs ago when its facts became labelled cells in
              this grid, so re-adding one to hold a duration would restore the
              duplication that removal fixed.
              So the duration joins the cell that already states WHEN it was
              resolved, which is the fact it qualifies: "Jun 2, 2026 · 3:18 PM ·
              48h after opening". Reported as a deviation from the pack's
              placement, not from its intent. TODO-COPY. */}
          {resolvedAt !== null
            ? `${dateOf(resolvedAt)}${d?.resolvedAtTime ? ` \u00b7 ${d.resolvedAtTime}` : ""}${
                openSpan ? ` \u00b7 ${openSpan} after opening` : ""
              }`
            : EM_DASH}
        </Fact>
        <Fact label="Resolved by">
          {who(record.resolvedBy, record.resolvedByRole) ?? EM_DASH}
        </Fact>
        {!contactsBothEmpty && (
          <Fact label="Emergency contact">
            {d?.emergencyContact ?? EM_DASH}
          </Fact>
        )}
      </FactGrid>

      {/* ═══ THE SUICIDE ASSESSMENT IS WRITTEN, NOT PICKED ═══
          It rendered as a tonal chip reading "High risk" / "Low risk", off a
          three-value union. That was wrong about the field: what a clinician
          records here is an ASSESSMENT — what was asked, what was answered, what
          was concluded — and a chip cannot hold any of it. Worse, it made the
          shortest possible summary the most prominent thing in the block, and a
          one-word severity on a suicide assessment is the last place to trade
          detail for scannability.

          SO IT MOVED OUT OF THE FACT GRID and into the prose. The grid holds the
          short scannable facts — the escalation's type, its crisis sub-type, the
          contact — and the prose holds the written record. Grouping by shape is
          what lets a free-form assessment have the width and the wrapping it
          needs instead of being squeezed into a half-column cell.

          IT IS THE FIRST PROSE BLOCK, ahead of the reason: within the written
          half it is the most consequential statement on the record. That does
          move it after "Emergency contact", which it used to precede — the one
          ordering change, and the cost of splitting a mixed list by shape.

          The em-dash path is unchanged and still means something: no assessment
          was recorded, which is a finding rather than a gap. */}
      <ProseBlock label="Suicide assessment risk" body={d?.suicideRisk} />
      <ProseBlock label="Reason for escalation" body={d?.reasonDetail} />
      <ProseBlock label="Information provided by mentor" body={d?.mentorInformation} />
      {contactsBothEmpty ? (
        <ProseBlock label="Emergency contact and conversations" />
      ) : (
        <ProseBlock
          label="Conversations with emergency contact / first responders"
          body={d?.contactConversations}
        />
      )}
      <ProseBlock label="Next steps" body={d?.nextSteps} />
      <ProseBlock label="Safety plan" body={d?.safetyPlan} />

      {/* THE RESOLUTION FOOTER IS GONE. It read "Resolved by {name} · {date} at
          {time}" under a hairline — the same two facts the grid above now states
          as labelled fields, and stating them twice on one card is how a reader
          starts wondering whether the two refer to different things. The grid is
          the better home: it is where a reader already goes for the record's
          facts, and unlike the footer it renders while the escalation is still
          open. */}
    </div>
  );
}

/** ═══ THE PRIORITY TIER, AND WHAT IT ASKS FOR ═══
 *
 *  The chip was "High risk" / "Medium risk" off a two-value scale this file
 *  invented. It now carries the playbook's tier — the same three `TIER_LABEL`
 *  gives the care summary and the commit sentence, so a flag and the document
 *  that summarises it cannot name the same judgement differently.
 *
 *  THE LABEL ALONE DOES NOT SAY WHAT TO DO. "Clinical support" names a tier; it
 *  does not tell a supervisor that it means before the next session, often
 *  inside 24 hours. That sentence is the reason the tier exists, so the chip
 *  reveals it — on hover, on focus and on click, through `HoverNote`, which is
 *  the only 1.4.13-conformant disclosure on this record.
 *
 *  TONE FOLLOWS THE TIER AND NEVER CARRIES IT ALONE (SC 1.4.1): the words
 *  differ at every level, so greyscale and a screen reader get the same three
 *  distinctions the colour does. */
const TIER_TONE: Record<RiskTier, ChipTone> = {
  imminent: "risk",
  clinicalReview: "warning",
  generalMonitoring: "neutral",
};

function PriorityChip({ tier }: { tier: RiskTier }) {
  return (
    <HoverNote
      align="left"
      /* NAMES THE TIER, because the panel is about this one — "About the
         priority" would be the same string on all three. */
      triggerLabel={`What ${TIER_LABEL[tier]} asks for`}
      triggerClassName="rounded-full"
      trigger={<TonalChip tone={TIER_TONE[tier]}>{TIER_LABEL[tier]}</TonalChip>}
    >
      <span className="block text-[12px] font-semibold leading-[17px] text-[var(--text-primary)]">
        {TIER_LABEL[tier]}
      </span>
      <span className="mt-1 block text-[12px] leading-[17px] text-[var(--text-secondary)]">
        {TIER_ACTION[tier]}
      </span>
    </HoverNote>
  );
}

function FlagDetail({
  record,
  occurredAt,
}: {
  record: CareFlagRecord;
  occurredAt: number;
}) {
  const d = record.flagDetail;
  const categories = (record.categories ?? [])
    .map((c) => riskCategory(c)?.label)
    .filter((l): l is string => !!l);

  return (
    <div className="space-y-4">
      <FactGrid>
        <Fact label="Media type">
          {d?.mediaType ? <TonalChip>{d.mediaType}</TonalChip> : EM_DASH}
        </Fact>
        <Fact label="Priority">
          {d?.priority ? <PriorityChip tier={d.priority} /> : EM_DASH}
        </Fact>
        <Fact label="Category">
          {/* THE MAPPED LABEL, never the raw value — an unmapped category is
              reported by `unmappedCategories()` and shows nothing here rather
              than leaking a wire constant onto a clinical record. */}
          {categories.length ? (
            categories.map((c) => <TonalChip key={c}>{c}</TonalChip>)
          ) : (
            EM_DASH
          )}
        </Fact>
        <Fact label="Detected">
          {`${dateOf(occurredAt)}${d?.detectedAtTime ? ` \u00b7 ${d.detectedAtTime}` : ""}`}
        </Fact>
        {/* ═══ WHO RAISED IT AND WHO LOOKED AT IT ═══
            Neither was in the field set. The raiser sat on line 2 of the
            COLLAPSED row and was dropped there whenever the author was not a
            person — which is every system-detected flag, so t21's whole cluster
            documented no origin at all. The reviewer was a footer that appeared
            only once a flag had been reviewed.
            "RAISED BY", NOT "MENTOR" — on a person-raised flag this is the
            mentor's name, and on a classifier match it is "Moderation ·
            Automated review". A label saying "Mentor" over the second would be
            the field lying about where the flag came from, which on a safety
            record is the one thing it must not do. The ROLE beside the name is
            what tells the two apart. */}
        <Fact label="Raised by">
          {who(record.raisedBy, record.raisedByRole) ?? EM_DASH}
        </Fact>
        <Fact label="Reviewed by">
          {who(record.resolvedBy, record.resolvedByRole) ?? EM_DASH}
        </Fact>
      </FactGrid>

      <div>
        <FieldLabel>Flagged content</FieldLabel>
        {d?.flaggedContent ? (
          <div className="mt-1.5">
            {/* ═══ VERBATIM. NEVER PARAPHRASED, TRUNCATED OR SUMMARISED ═══
                The exact wording is the clinical datum, so it is rendered as
                authored and wrapped in quotation marks so it can never be
                mistaken for the interface talking. `QuoteBlock` is the shared
                primitive from `ui/evidence-primitives`, reused rather than
                reinvented — its own note calls it "the one place a teen's own
                message appears on a staff surface".

                THIS SURFACE IS NEW FOR THAT, and it contradicts a rule this
                codebase calls locked. See `CareFlagRecord.flagDetail.flaggedContent`
                and the report. */}
            <QuoteBlock>{`\u201c${d.flaggedContent}\u201d`}</QuoteBlock>
          </div>
        ) : (
          <p className="mt-1 text-[14px] leading-[1.55] text-[var(--text-muted)]">
            {/* An image or a video carries no words — a real state, not a gap. */}
            {EM_DASH}
          </p>
        )}
        {record.conversationWith && (
          <Link
            href={chatThreadHref(record.conversationWith)}
            className={cn(
              "mt-2 inline-flex rounded-sm py-1 underline underline-offset-2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]",
              RING
            )}
            style={{ font: "var(--type-row-label)" }}
          >
            {/* TODO-COPY */}
            View chat context
            <span aria-hidden>&nbsp;&rarr;</span>
          </Link>
        )}
      </div>

      <ProseBlock
        label="Why this was flagged"
        body={record.momentSummary?.text}
        /* THE BADGE IS CONDITIONAL ON PROVENANCE, not on the field existing. A
           deterministic classifier's output is not a model's writing, and
           badging both the same way would let a match wear a model's hedge. */
        badge={record.momentSummary?.provenance === "ai" ? <AiBadge /> : undefined}
      />

      {/* THE REVIEW FOOTER IS GONE, for the same reason as the escalation's:
          "Reviewed by {name}" is now a labelled field above, and it renders on
          an open flag as an em-dash rather than not at all.
          THE REVIEW DATE DID NOT MOVE WITH IT, deliberately. A flag's field set
          already carries "Detected", and a second date beside it — one for when
          it was caught, one for when someone looked — is a pair readers
          transpose. The escalation grid states both because an escalation's
          open/closed span IS the thing being audited; a flag's is not. */}
    </div>
  );
}

/** WHAT THE PATTERN BLOCK CAN ASK OF HISTORY. One method, and it is a READ —
 *  filter and scroll, never a write.
 *
 *  EXPOSED AS A HANDLE RATHER THAN A PROP because `jump` already exists and
 *  already handles the part that is easy to get wrong: a target row can be
 *  filtered out of the DOM, so the filter is cleared BEFORE the scroll and the
 *  scroll waits a frame for the full list to paint. Re-implementing that at the
 *  call site is how the pattern block would end up with a dead link. */
export interface CareTimelineHandle {
  jump: (eventId: string) => void;
}

/* ══════════════════════ PAGINATION + SEARCH ══════════════════════════
 *
 * ═══ WHY PROGRESSIVE REVEAL AND NOT PAGES ═══
 *
 * A clinical record is read backwards from now, and the question is almost never
 * "what is on page 3" — it is "keep going until I find it". Numbered pages make
 * that a navigation task; revealing more in place keeps it a reading one, and it
 * leaves everything already read still on screen above.
 *
 * ═══ THE DEEP-LINK RULE IS WHAT MAKES PAGINATION SAFE ═══
 *
 * Every anchor into History — the strip's marks, the rail's flags, an amendment
 * chain, the survey dialog — targets a specific row, and pagination can hide it.
 * `jump` therefore RESOLVES rather than scrolls: it clears the filter, clears the
 * search, and reveals whole pages until the target is inside the window, and only
 * then scrolls. A link that silently lands on nothing is worse than no link. */
const PAGE_SIZE = 15;

/** Minimum query length. One character matches most of a long record, which is
 *  not a search result, it is the list again with extra steps. */
const MIN_QUERY = 2;

/** ═══ TWO HAYSTACKS PER ROW, NOT ONE ═══
 *
 *  `surface` is everything a reader can see with the row COLLAPSED; `details` is
 *  everything only its expansion shows. Both match, but the split is what lets a
 *  row say "Match in details" — a result whose match is invisible looks like a
 *  false positive, and a reader who cannot see why a row is in their results
 *  stops trusting the search.
 *
 *  Built over the event, NOT over the DOM: the expansion of a collapsed row is
 *  not rendered, so anything read from the document would miss exactly the case
 *  the hint exists for. */
type Haystack = { surface: string; details: string };

function haystackFor(event: CareEvent): Haystack {
  const surface = [
    event.description,
    event.result,
    TYPE_LABEL[event.type],
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();

  const r = event.flagRecord;
  const esc = r?.escalationDetail;
  const flag = r?.flagDetail;
  const details = [
    event.providerNote,
    // Flag and escalation field sets — the expansion's own content.
    r?.reason,
    r?.momentSummary?.text,
    r?.resolutionNote,
    ...(r?.categories ?? []).map((c) => riskCategory(c)?.label ?? ""),
    esc?.type,
    esc?.suicideRisk,
    esc?.emergencyContact,
    esc?.reasonDetail,
    esc?.mentorInformation,
    esc?.contactConversations,
    esc?.nextSteps,
    esc?.safetyPlan,
    flag?.mediaType,
    flag?.flaggedContent,
    // Assessment breakdowns.
    ...(event.items ?? []).flatMap((i) => [i.question, i.answer]),
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();

  return { surface, details };
}

export function CareTimeline({
  events,
  ref,
}: {
  events: CareEvent[];
  /** React 19 — `ref` is a normal prop; no forwardRef needed. */
  ref?: React.Ref<CareTimelineHandle>;
}) {
  const [filter, setFilter] = useState<CareFilterId>("all");
  /** What is in the field, and what the list is actually filtered by. Separate so
   *  typing never costs a re-filter of forty rows per keystroke. */
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  /** How many rows of the CURRENT result set are revealed. */
  const [visible, setVisible] = useState(PAGE_SIZE);

  /* ═══ DEBOUNCE, AND WHY THE RESET IS NOT IN HERE ═══
     `setApplied` runs inside the timeout, not in the effect body — a synchronous
     setState during an effect is what this repo's lint forbids, and an async
     callback is not that. The page reset lives in the HANDLERS instead of keying
     off `applied`: resetting where the change originates means one obvious line
     per control, rather than an effect that has to distinguish "the query
     changed" from "the query settled". */
  useEffect(() => {
    const t = setTimeout(() => setApplied(query.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Newest first, and an index of what supersedes what.
  const ordered = useMemo(
    () => [...events].sort((a, b) => b.occurredAt - a.occurredAt),
    [events]
  );
  const amendedBy = useMemo(() => {
    const m = new Map<string, CareEvent>();
    for (const e of events) if (e.amends) m.set(e.amends, e);
    return m;
  }, [events]);
  const byId = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events]
  );
  /** care_update id → the committed summary that names it. INVERTED FROM THE
   *  SUMMARY'S EDGE, so nothing is stored twice and the two can never disagree
   *  about whether they are a pair. Built over the whole event set, like
   *  `amendedBy`, so a filter chip cannot hide one half and break the other's
   *  link. */
  const summarizedBy = useMemo(() => {
    const m = new Map<string, CareEvent>();
    for (const e of events) {
      if (e.type === "care_summary" && e.documentedBy) m.set(e.documentedBy, e);
    }
    return m;
  }, [events]);

  /** ═══ THE RELATIONAL INDEX (Phase 2) ═══
   *
   *  Built once over the WHOLE event set, oldest-first, so an entry's ordinal is
   *  its place in the record rather than its place in whatever the current filter
   *  is showing. A "3rd flag" that became the "2nd flag" when the reader clicked a
   *  chip would be worse than no line at all.
   *
   *  FLAGS AND ESCALATIONS SHARE ONE SEQUENCE. They are one clinical series — the
   *  playbook routes between the tiers as a concern develops — so an escalation
   *  that followed two risk flags is the third thing in that series, not the
   *  first of a separate one. */
  const relational = useMemo(() => {
    const out = new Map<string, RelationalLine>();
    const oldestFirst = [...events].sort((a, b) => a.occurredAt - b.occurredAt);

    // ── Flags and escalations, one shared ordinal sequence.
    let prevFlag: CareEvent | null = null;
    let flagN = 0;
    for (const e of oldestFirst) {
      if (e.type !== "risk_flag" && e.type !== "escalation") continue;
      flagN += 1;
      /* ═══ NO LINE ON A FIRST OCCURRENCE ═══
         It read "First flag" — a bare line with no link, because there is no
         earlier entry to link to. The relational line exists to say where an
         entry sits in a chain and to walk back along it; on the first flag
         there is no chain yet, so the line was left stating that a record's
         first flag is its first flag, at the top of the block, above the
         content a reader opened it for.
         THE ORDINALS AND THE CHAIN ARE UNAFFECTED. `flagN` still counts from
         this entry and `prevFlag` still advances, so the next flag reads "2nd
         flag" and links back to this one — dropping the line is a rendering
         decision, not a change to the sequence. */
      if (prevFlag) {
        out.set(e.id, {
          /* TODO-COPY */
          lead: `${ordinal(flagN)} flag`,
          previous: { id: prevFlag.id, at: prevFlag.occurredAt },
        });
      }
      prevFlag = e;
    }

    // ── Presentation changes name the code they REPLACED and when it was
    //    assigned. `code` is the machine-readable field — the one that exists so
    //    nobody parses it back out of `result` prose.
    let prevPres: CareEvent | null = null;
    for (const e of oldestFirst) {
      if (
        e.type !== "presentation_assigned" &&
        e.type !== "presentation_changed"
      )
        continue;
      if (e.type === "presentation_changed" && prevPres?.code) {
        out.set(e.id, {
          /* TODO-COPY */
          lead: `Changed from ${prevPres.code}`,
          previous: { id: prevPres.id, at: prevPres.occurredAt },
        });
      }
      prevPres = e;
    }
    return out;
  }, [events]);

  /** Built once per event set. A row's searchable text does not change when the
   *  query does, and rebuilding forty of them per keystroke is work nobody asked
   *  for. */
  const haystacks = useMemo(() => {
    const m = new Map<string, Haystack>();
    for (const e of events) m.set(e.id, haystackFor(e));
    return m;
  }, [events]);

  /** Below the floor the query is IGNORED, not treated as empty-string — the
   *  difference matters for the count line, which must not claim to be filtering
   *  by a single letter it is deliberately not filtering by. */
  const q = applied.length >= MIN_QUERY ? applied : "";

  /** ═══ SEARCH ANDs WITH THE CHIP, USING THE SAME MECHANISM ═══
      The chip was already a client-side predicate over `ordered`; search is a
      second predicate in the same pass, so the two compose by construction rather
      than by one filtering the other's output. */
  const rows = useMemo(
    () =>
      ordered.filter((e) => {
        if (!matchesFilter(e.type, filter)) return false;
        if (!q) return true;
        const h = haystacks.get(e.id);
        return !!h && (h.surface.includes(q) || h.details.includes(q));
      }),
    [ordered, filter, q, haystacks]
  );

  /** A row whose ONLY match is inside its collapsed expansion. */
  const matchInDetailsOnly = (e: CareEvent): boolean => {
    if (!q) return false;
    const h = haystacks.get(e.id);
    return !!h && !h.surface.includes(q) && h.details.includes(q);
  };

  const shown = rows.slice(0, visible);
  const allShown = shown.length >= rows.length;

  /** ONE LINE, and it names both axes only when both are active. "matching X in
   *  Flags" when no chip is set would invent a filter the reader did not choose.
   *  TODO-COPY — placeholder wording. */
  const filterLabel = CARE_FILTERS.find((f) => f.id === filter)?.label ?? "";
  const countSuffix = q
    ? filter === "all"
      ? ` matching \u201c${applied}\u201d`
      : ` matching \u201c${applied}\u201d in ${filterLabel}`
    : filter === "all"
      ? ""
      : ` in ${filterLabel}`;

  /** Focus lands on the first NEWLY revealed row after Show more — but only for a
   *  keyboard activation. Moving focus after a mouse click would yank the page
   *  under a pointer user who was reading. `detail === 0` is the browser's own
   *  signal for a keyboard-triggered click. */
  const revealMore = (keyboard: boolean) => {
    const firstNew = visible;
    setVisible((v) => Math.min(v + PAGE_SIZE, rows.length));
    if (!keyboard) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const id = rows[firstNew]?.id;
        if (!id) return;
        document
          .getElementById(`care-${id}`)
          ?.querySelector<HTMLElement>("button[aria-expanded]")
          ?.focus();
      });
    });
  };

  // Jumping between the two halves of an amendment chain has to survive a
  // filter: "Flags" can show a superseded entry whose correction is a
  // presentation event, so the target isn't in the DOM. Clear the filter first,
  // then scroll once the full list has painted — a dead link on a chain the
  // reader is trying to follow is worse than losing their chip selection.
  /** ═══ THE LANDING IS MARKED, NOT JUST SCROLLED TO ═══
   *
   *  A jump from the sparkline used to clear the filter and scroll — and then
   *  stop. The reader arrived somewhere in a thirteen-row table with no signal
   *  which row they were sent to, so the two views of one record (the strip's
   *  synthesis, History's entries) stayed unconnected at the exact moment they
   *  should have snapped together.
   *
   *  A brief tint on the landed row closes that. It is MOTION THAT EXPLAINS A
   *  RELATIONSHIP rather than decoration: the thing you touched on the strip is
   *  this row.
   *
   *  · TINT, NOT AN OUTLINE OR A RING. `--tint-press` is the surface this product
   *    already uses for "you are acting on this", so nothing new enters the
   *    vocabulary.
   *  · IT FADES OUT AND LEAVES NOTHING. A permanent highlight would be a second,
   *    competing selection state next to the row's own superseded/recessed tone.
   *  · `prefers-reduced-motion` GETS THE TINT WITHOUT THE TRANSITION — the signal
   *    is the point, the fade is not. Handled in CSS, not by skipping the class.
   *  · SET AFTER the scroll is requested so the two happen together. */
  const [landedId, setLandedId] = useState<string | null>(null);
  const landedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const jump = (id: string) => {
    /* ═══ RESOLVE, DO NOT MERELY SCROLL ═══
       Three things can hide the target: the filter chip, the search query, and
       pagination. All three are cleared or opened before the scroll is asked
       for, in that order, because each one changes what "row N" means.

       CLEARING SEARCH AND FILTER IS THE CHOSEN BEHAVIOUR, stated plainly: a
       reader following a link is asking to be taken to a specific entry, and
       arriving at an empty list because their chip excluded it is the failure
       this exists to prevent. Losing a chip selection is the cheaper cost, and it
       is the same trade the filter reset already made before pagination existed.

       THE REVEAL IS BY WHOLE PAGES, not to the exact index: landing with the
       target as the last visible row would leave a "Show more" directly under
       it and nothing after, which reads as the end of the record rather than as
       the middle of it. */
    setFilter("all");
    setQuery("");
    setApplied("");
    const index = ordered.findIndex((e) => e.id === id);
    if (index >= 0) {
      const needed = Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE;
      setVisible((v) => Math.max(v, needed));
    }
    /* TWO FRAMES, not one. The single rAF was enough when the only change was a
       filter reset; revealing rows adds a second commit, and asking for a scroll
       to a row React has not painted yet lands on nothing. Measured — one frame
       reached the old row position, two reaches the new one. */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById(`care-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        setLandedId(id);
        if (landedTimer.current) clearTimeout(landedTimer.current);
        // Long enough to notice after a smooth scroll settles, short enough that
        // it never reads as state.
        landedTimer.current = setTimeout(() => setLandedId(null), 1600);
      });
    });
  };

  useEffect(
    () => () => {
      if (landedTimer.current) clearTimeout(landedTimer.current);
    },
    []
  );

  // THE ONLY THING ANOTHER SURFACE MAY DO TO HISTORY.
  useImperativeHandle(ref, () => ({ jump }));

  return (
    <section aria-label="Care timeline" data-record-section="care-timeline" data-anno-ref="care-timeline">
      {/* ═══ SEARCH SITS INLINE WITH THE CHIPS, RIGHT-ALIGNED ═══
          The brief offered a header row opposite the "History" heading or the
          chip row. The heading belongs to `care-tab`'s section, not to this
          component, so putting the field beside it would mean lifting this
          component's search state one level up and threading it back down — a
          worse shape for a purely local concern. `ml-auto` on the field pushes it
          to the right of the same row, and the row already wraps, so a narrow
          container drops it to its own line instead of squeezing the chips. */}
      <div className="flex flex-wrap items-center gap-2">
        {CARE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              // RESET TO THE FIRST PAGE — a new result set, so "visible" from the
              // old one means nothing.
              setVisible(PAGE_SIZE);
            }}
            aria-pressed={filter === f.id}
            className={cn(CHIP, filter === f.id ? CHIP_ON : CHIP_OFF, RING)}
          >
            {f.label}
          </button>
        ))}

        {/* NO BLOOM SEARCH COMPONENT EXISTS — audited. This is the roster's
            pattern (`admin/roster.tsx`): a control pill carrying the icon and a
            bare input, so the two searches on the console look like one idea. */}
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1",
            "border border-[color:var(--border-subtle)] bg-[var(--surface-card)]",
            "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus-ring)]"
          )}
        >
          <Search className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            onKeyDown={(e) => {
              /* ESC CLEARS RATHER THAN BLURS. Stops propagation so it cannot also
                 close whatever contains the record. */
              if (e.key === "Escape" && query) {
                e.stopPropagation();
                setQuery("");
                setApplied("");
                setVisible(PAGE_SIZE);
              }
            }}
            /* TODO-COPY */
            aria-label="Search history"
            placeholder="Search history"
            className="w-36 bg-transparent py-0.5 text-[13px] leading-[18px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          {query && (
            <button
              type="button"
              /* TODO-COPY */
              aria-label="Clear search"
              title="Clear search"
              onClick={() => {
                setQuery("");
                setApplied("");
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <X className="size-3.5" />
            </button>
          )}
        </span>
      </div>

      {/* ═══ THE COUNT LINE RESERVES ITS SPACE ═══
          `min-h` and a permanently-rendered node, so a result count appearing or
          changing never moves the list underneath it while someone is typing.
          `aria-live="polite"` announces the settled count — on `applied`, which is
          debounced, so a screen reader is told the result and not each keystroke. */}
      <p
        aria-live="polite"
        className="mt-2 min-h-[18px] text-[var(--text-muted)]"
        style={{ font: "var(--type-row-label)" }}
      >
        {/* TODO-COPY — PLACEHOLDER wording, one line, per the brief. */}
        {rows.length === 0
          ? ""
          : allShown
            ? `Showing all ${rows.length} ${rows.length === 1 ? "event" : "events"}${countSuffix}`
            : `Showing ${shown.length} of ${rows.length} events${countSuffix}`}
      </p>

      <div className="mt-4 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
        {rows.length === 0 ? (
          <p
            className="px-[var(--surface-pad-x)] py-6 text-[var(--text-secondary)]"
            style={{ font: "var(--type-row-label)" }}
          >
            {/* TODO-COPY */}
            {/* THREE DIFFERENT EMPTINESSES, and they must not share a sentence:
                an empty record, a chip with nothing under it, and a search with no
                hits are three different facts about why the list is blank.
                TODO-COPY — placeholders. */}
            {events.length === 0
              ? "Nothing recorded yet. Entries appear here once the first survey is assigned."
              : q
                ? "No events match"
                : "No entries of this kind yet."}
          </p>
        ) : (
          <ul className="[&>li+li]:border-t [&>li+li]:border-[var(--border-subtle)]">
            {shown.map((e) => (
              <Row
                key={e.id}
                event={e}
                matchInDetails={matchInDetailsOnly(e)}
                amendedBy={amendedBy.get(e.id)}
                relational={relational.get(e.id)}
                amends={e.amends ? byId.get(e.amends) : undefined}
                documents={e.documents ? byId.get(e.documents) : undefined}
                documentedBy={
                  e.documentedBy ? byId.get(e.documentedBy) : undefined
                }
                summarizedBy={
                  e.type === "care_update" ? summarizedBy.get(e.id) : undefined
                }
                landed={landedId === e.id}
                onJump={jump}
              />
            ))}
          </ul>
        )}
      </div>

      {/* ═══ SHOW MORE — QUIET, FULL WIDTH, AND IT DISAPPEARS ═══
          Full width of the list because it belongs to the list rather than
          sitting beside it, and quiet because revealing more of a record you are
          already reading is not a decision that needs a filled button. It is
          REMOVED, not disabled, once everything is visible: a disabled control at
          the end of a record is a dead affordance the reader has to test. */}
      {!allShown && rows.length > 0 && (
        <button
          type="button"
          onClick={(e) => revealMore(e.detail === 0)}
          className={cn(
            "mt-2 w-full rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] py-2",
            "text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
          style={{ font: "var(--type-row-label)" }}
        >
          {/* TODO-COPY */}
          {`Show ${Math.min(PAGE_SIZE, rows.length - shown.length)} more`}
        </button>
      )}

      {/* ONE CLICK BACK OUT OF A DEAD END. Only when a SEARCH produced the empty
          list — an empty chip result is cleared by the chips, which are right
          there, and a second control for it would be noise. */}
      {rows.length === 0 && q && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setApplied("");
            setVisible(PAGE_SIZE);
          }}
          className={cn(
            "mt-2 rounded-sm py-1 underline underline-offset-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]",
            RING
          )}
          style={{ font: "var(--type-row-label)" }}
        >
          {/* TODO-COPY */}
          Clear search
        </button>
      )}
    </section>
  );
}
