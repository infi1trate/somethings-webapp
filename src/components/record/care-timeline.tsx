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

import { useImperativeHandle, useMemo, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
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
const BAND_CHIP: Record<string, string> = {
  minimal: "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]",
  mild: "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]",
  moderate: "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]",
  "moderately severe": "bg-[var(--band-rose-bg)] text-[var(--band-rose-fg)]",
  severe: "bg-[var(--band-rose-bg)] text-[var(--band-rose-fg)]",
};

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
function scoreFor(event: CareEvent): {
  value: number;
  band: string;
  bandLabel: string;
} | null {
  if (event.type !== "assessment") return null;
  const n = Number(String(event.result).match(/\d+/)?.[0]);
  if (!Number.isFinite(n)) return null;
  const instrument = event.description;
  if (instrument !== "PHQ-9" && instrument !== "GAD-7") return null;
  const band = severityFor(instrument, n);
  return {
    value: n,
    band,
    // TODO-COPY — sentence case, so the lozenge reads as a label rather than a
    // shout: "Moderately severe", not "MODERATELY SEVERE".
    bandLabel: band.charAt(0).toUpperCase() + band.slice(1),
  };
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
    // TODO-COPY
    return <span className="text-[var(--text-muted)]">Recorded automatically</span>;
  }
  return (
    <span className="text-[var(--text-muted)]">
      {author.name} · {author.role}
    </span>
  );
}

/** ═══ THE RELATIONAL LINE (Phase 2) ═══
 *
 *  What turns a flat log into a chain a supervisor can walk. One muted line under
 *  an entry saying where this one sits in its own sequence, and a link back to the
 *  one before it.
 *
 *  `previous` is ABSENT on a first occurrence, and the copy changes with it —
 *  "First flag", no link. A "previous: none" link would be a dead affordance, and
 *  the first flag in a record is a fact worth stating plainly rather than an
 *  absence to paper over. */
export interface RelationalLine {
  /** TODO-COPY. "3rd flag" / "First flag" / "Changed from F41.1". */
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
  const statusText = score ? null : String(event.result || "").trim() || null;
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
  const expandable =
    !!event.items?.length ||
    !!event.providerNote ||
    borrowsDisclosure ||
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
        superseded && "bg-[var(--surface-s1)]"
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
      <div className="flex items-start gap-3 sm:gap-4">
        {/* NOT `aria-hidden`. The gutter is the row's date at `sm` and up, and
            the inline copy below is `sm:hidden` — so exactly ONE of the two is
            rendered at any width, and `display:none` keeps the other out of the
            accessibility tree. Hiding this one as decorative would have taken
            the date out of the row's accessible name at every width above
            640px, which is where most readers are. */}
        <span
          className="hidden w-[96px] shrink-0 pt-0.5 text-right tabular-nums text-[var(--text-muted)] sm:block"
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
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)]",
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
          // Keeps the columns aligned without implying a control.
          <span aria-hidden className="mt-0.5 size-6 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          {/* ── LINE 1 · title, score lozenge, type chip ───────────────────
              NO `flex-wrap`. With wrapping, a long escalation title pushed the
              type chip onto a second line and the row became three lines deep —
              measured at 88 and 95px against a 70px two-line row, which is how
              this was caught. The two-line cap is the point of the anatomy, so
              the TITLE truncates instead and the chip holds its place. */}
          <div className="flex items-center gap-x-2">
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
            {score && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-stretch overflow-hidden rounded-[4px] text-[12px] font-medium leading-[18px]",
                  BAND_CHIP[score.band]
                )}
              >
                <span className="px-1.5 tabular-nums">{score.value}</span>
                {/* The divider is a border, not a character: a "|" would be
                    read aloud by some screen readers and would inherit the text
                    colour rather than the tint's. */}
                <span className="border-l border-current/25 px-1.5">
                  {score.bandLabel}
                </span>
              </span>
            )}

            {/* RIGHT-ALIGNED. `ml-auto` rather than `justify-between` so it
                still sits beside the title when the row is short instead of
                being pushed to the far edge of a wide table. */}
            <span
              className={cn(
                "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium",
                TONE_STYLE[TYPE_TONE[event.type]]
              )}
            >
              {TYPE_LABEL[event.type]}
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

              {event.items?.length ? (
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
                  <p
                    className="whitespace-pre-line text-[var(--text-secondary)]"
                    style={{ font: "var(--type-row-label)" }}
                  >
                    {documentedBy.providerNote}
                  </p>
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
                <p
                  className="whitespace-pre-line text-[var(--text-secondary)]"
                  style={{ font: "var(--type-row-label)" }}
                >
                  {event.providerNote}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
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

export function CareTimeline({
  events,
  ref,
}: {
  events: CareEvent[];
  /** React 19 — `ref` is a normal prop; no forwardRef needed. */
  ref?: React.Ref<CareTimelineHandle>;
}) {
  const [filter, setFilter] = useState<CareFilterId>("all");

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
      out.set(e.id, {
        /* TODO-COPY */
        lead: flagN === 1 ? "First flag" : `${ordinal(flagN)} flag`,
        ...(prevFlag ? { previous: { id: prevFlag.id, at: prevFlag.occurredAt } } : {}),
      });
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

  const rows = ordered.filter((e) => matchesFilter(e.type, filter));

  // Jumping between the two halves of an amendment chain has to survive a
  // filter: "Flags" can show a superseded entry whose correction is a
  // presentation event, so the target isn't in the DOM. Clear the filter first,
  // then scroll once the full list has painted — a dead link on a chain the
  // reader is trying to follow is worse than losing their chip selection.
  const jump = (id: string) => {
    setFilter("all");
    requestAnimationFrame(() => {
      document
        .getElementById(`care-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  // THE ONLY THING ANOTHER SURFACE MAY DO TO HISTORY.
  useImperativeHandle(ref, () => ({ jump }));

  return (
    <section aria-label="Care timeline" data-record-section="care-timeline">
      <div className="flex flex-wrap items-center gap-2">
        {CARE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(CHIP, filter === f.id ? CHIP_ON : CHIP_OFF, RING)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
        {rows.length === 0 ? (
          <p
            className="px-[var(--surface-pad-x)] py-6 text-[var(--text-secondary)]"
            style={{ font: "var(--type-row-label)" }}
          >
            {/* TODO-COPY */}
            {events.length === 0
              ? "Nothing recorded yet. Entries appear here once the first survey is assigned."
              : "No entries of this kind yet."}
          </p>
        ) : (
          <ul className="[&>li+li]:border-t [&>li+li]:border-[var(--border-subtle)]">
            {rows.map((e) => (
              <Row
                key={e.id}
                event={e}
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
                onJump={jump}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
