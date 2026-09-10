"use client";

// THE CARE SUMMARY, AS A DOCUMENT IN THE MAIN COLUMN.
//
// ═══ WHY THIS IS NOT THE OLD PANEL ═══
//
// `care-summary-panel.tsx` was a 320px rail with a toggle pill in the tab row —
// an ambient tool you opened when curious. Both are deleted. This is record
// content: a per-cycle clinical evidence document that sits directly above the
// review card when a review is due, because evidence belongs adjacent to the
// decision it informs.
//
// THE TRADEOFF, STATED: the persistent collapsible affordance is gone and the
// page is longer. Accepted for two reasons. Element 5's three-part statement
// cannot be read at 320px — labelled fragments need width or they wrap into
// mush — and reclaiming the column fixes History, which was rendering a
// seven-column table in two thirds of the page.
//
// ═══ CHIPS FOR EXTRACTIONS, PROSE FOR INTERPRETATION ═══
//
// Applied strictly, because a chip reads as a fact. Theme counts, content
// categories, flag tiers and the concordance result are chipped — they are
// extractions or defined categorical results. The trajectory is prose: chipping
// an interpretation would promote an AI inference to the visual status of a
// determination, and the chip treatment for symptom direction belongs to the
// clinician's Escalated/Maintained/Improved call in the care update.
//
// ═══ ABSENCE RENDERS EXPLICITLY — AN INVERSION ═══
//
// Everywhere else on this record, absence renders nothing. Here it speaks: "No
// risk flags triggered this cycle", "None this cycle", "Insufficient data". A
// missing line on a clinical record is ambiguous between "none" and "not
// checked", and the reader is about to assign a diagnostic code.
//
// DO NOT "CORRECT" THIS to the usual pattern. design-system-gaps.md row 301.

import {
  SUMMARY_MIN_CONTACT_DAYS,
  type CareSummaryDoc,
} from "@/lib/record/care-summary-doc";
import { clinicalDate } from "@/components/record/care-presentation";
import { CareSparkline } from "@/components/record/care-sparkline";
import { SegmentedControl } from "@/components/record/segmented-control";
import {
  CARE_TIME_BLOCKS,
  type CareTimeBlockId,
} from "@/lib/record/care-time-block";
import { PROVENANCE_NOTE, Provenance } from "@/components/record/provenance";
import type { CarePattern } from "@/lib/record/care-pattern";
import {
  contentTag,
  isKnownTag,
  tagAlwaysTooltips,
  tagLabel,
  tagTooltip,
  SHORT_LABEL_THRESHOLD,
  type TagCategory,
} from "@/lib/record/content-tags";
import { cn } from "@/lib/utils";


const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;


/** ═══ THEME CHIPS: ONE TINT, THE SAME FOR EVERY THEME ═══
 *
 *  "Low mood 6/8" is DESCRIPTIVE, not evaluative. Tinting themes by anything —
 *  frequency, apparent severity, the words themselves — would rank a teen's
 *  conversation topics on a colour scale, which is a judgement the extraction
 *  cannot support and the record should not imply. Sand is the quiet
 *  neutral-warm the system already carries for routine, measured 7.38:1.
 *
 *  So: all the same, always with the label, and the number does the varying. */
/** `CHIP_NEUTRAL`, `RESULT_CHIP` and `RESULT_LABEL` lived here and are deleted
 *  with the concordance element they styled — a dead style constant is an
 *  invitation to re-add the section without its rationale. The
 *  `ConcordanceResult` import went with them; the model still exports it, and
 *  `CareSummaryDoc.concordance` still carries the call. */
const CHIP_THEME =
  "inline-flex items-center rounded-full bg-[var(--band-sand-bg)] px-2.5 py-0.5 text-[12.5px] font-medium leading-[18px] text-[var(--band-sand-fg)]";

/** ═══ NEW / RESOLVED CONTENT: ROSE AND SAGE ═══
 *
 *  The one place on this card where a tint carries direction, and it is
 *  defensible because the two sets mean opposite things: content that APPEARED
 *  this cycle versus content that STOPPED. Rose for new, sage for resolved.
 *
 *  THE LABEL CARRIES THE MEANING, NOT THE TINT. Both groups are introduced by a
 *  visible "New" / "Resolved" label, and every pale bg in this family sits
 *  within 1.25:1 of every other — they are separated by hue, not lightness — so
 *  the tint is a second channel and never the only one (1.4.1). */

/** TIER TONES REUSE THE FLAG VOCABULARY the timeline already established —
 *  clay for escalation-grade, amber for risk-flag-grade, sand for routine. Not a
 *  new palette: a reader who has learned the flag colours should not have to
 *  learn a second set for the same artifact. Ratios are the tokens' own, measured
 *  in settings-tokens.css: clay 6.84:1, amber 7.24:1, sand 7.38:1.
 *
 *  THE TIER IS A PROPERTY OF THE FLAG, NEVER OF THE TEEN. */



/** ═══ THE PROVENANCE THE HEADER NO LONGER PRINTS (B3) ═══
 *
 *  Demoted, not deleted. Dates, the generated stamp and the window BASIS are what
 *  someone reconciling this record against an outside provider's notes needs, and
 *  they are useless to everyone else on every other read — which is the exact
 *  shape of an on-demand disclosure.
 *
 *  IT IS APPENDED TO THE AI NOTE RATHER THAN REPLACING IT. The ⓘ already answers
 *  "where did this text come from"; the window answers "over what period", and a
 *  reader opening one expects both. Two panels for one question would be worse
 *  than a slightly longer one.
 *
 *  THE BASIS SENTENCE IS THE POINT. "Jun 4 – Aug 31" alone does not say why those
 *  dates — a reader cannot tell a review cycle from a calendar quarter. */
export function summaryProvenanceNote(
  window: { fromAt: number; toAt: number; firstCycle: boolean },
  generatedAt: number
): string {
  // TODO-COPY.
  const basis = window.firstCycle
    ? "from intake"
    : "since the last presentation update";
  /* ═══ THE CHART'S SCOPE MERGED IN FROM ITS OWN CAPTION ═══
     "Assessment scores and risk flags across the mentorship" was a line with its
     own mark under the chart. Two provenance marks four inches apart on one card
     is two things to open to learn one thing, and the chart's was the WEAKER of
     the pair: it named the axis but not the window the whole card is about.
     Only the non-duplicated half moved. The rest of that caption's mark was the
     shared `PROVENANCE_NOTE`, which this note already opens with — so the merge
     adds one sentence rather than concatenating two notes. */
  return (
    `${PROVENANCE_NOTE} ` +
    `The trajectory plots assessment scores and risk flags across the whole ` +
    `mentorship, not only this window. ` +
    `Window: ${clinicalDate(window.fromAt)} – ${clinicalDate(window.toAt)}, ${basis}. ` +
    `Generated ${clinicalDate(generatedAt)}.`
  );
}

/** ═══ THE HEADER'S ONE LINE (B1) ═══
 *
 *  Two lines of provenance prose used to sit here — "Since the last presentation
 *  update, Jun 4, 2026 – Aug 31, 2026 · Generated Aug 31, 2026" and "21 exchanges
 *  across the mentorship". Both true, both a header nobody reads twice: the dates
 *  are reconciliation detail, and the reader's actual question is how much
 *  evidence this document rests on. So one line answers it — the period and the
 *  volume — and the dates move to the ⓘ.
 *
 *  WEEKS ARE ROUNDED, NOT FLOORED. A 90-day window is 12.9 weeks; flooring calls
 *  it 12 and rounding calls it 13, and 13 is the honest description of the period
 *  someone would say out loud. `Math.max(1, …)` is the floor of last resort.
 *
 *  THE SUB-WEEK CASE IS ITS OWN SENTENCE, not a "0-week analysis": on a day-1
 *  intake record the window is hours old, and a number of weeks is the wrong unit
 *  rather than a small one. "First week" is also true on day 6, which is the
 *  point — it describes where the record IS, not how much time has elapsed.
 *
 *  THE PERIOD IS COMPUTED FROM THE WINDOW, never handed in as a string. The old
 *  engagement line was formatted in `care-tab.tsx` while the dates came from
 *  `doc.window`, so the two halves were assembled in different files from
 *  different sources.
 *
 *  ═══ TODO-DATA — THE COUNT IS STILL NOT THE WINDOW'S COUNT ═══
 *
 *  AND THIS IS THE ONE THING TO FIX NEXT. `exchanges` reaches this card from
 *  `careReadingFor`, which carries its OWN window of `READING_WINDOW_DAYS = 21`
 *  and derives the number from a hash (`engagementFor` → `h % 3`) because there is
 *  no conversation pipeline. So "13-week analysis · 21 exchanges" states a
 *  13-week period beside a count that is neither 13 weeks long nor real. It is
 *  most visible on a day-one record, where the line reads "First week · 22
 *  exchanges" for a teen with nothing on file at all.
 *
 *  This is the SAME two-periods-in-one-sentence defect the two-line header had,
 *  narrowed rather than removed: the period is now honest and the count is not.
 *  Shipping it is deliberate — the format is specified and the numbers are demo
 *  fixtures — but it needs a windowed exchange count from the data layer.
 *  `doc.contactDays` IS windowed and is the nearest real field, but it counts DAYS
 *  WITH CONTENT rather than exchanges, so substituting it would change the claim
 *  rather than fix it. */
/** ═══ ONE DATUM IN THE HEADER'S STAT ROW ═══
 *
 *  THE LABEL IS CONSTANT AND THE VALUE IS A NUMBER, which is the whole of the
 *  label-over-value pattern: the label names the measure once, at a fixed size
 *  and in a fixed place, and only the numeral changes as the block changes. A
 *  reader comparing two blocks is comparing two numerals in the same position
 *  rather than re-reading a sentence.
 *
 *  ═══ NO PLURALIZATION — THE STRINGS ARE GONE, NOT UNUSED ═══
 *
 *  The previous merged line said "9 engaged days" and needed a singular form for
 *  "1 engaged day". A LABEL DOES NOT AGREE WITH ITS VALUE: "Engaged days: 1" is
 *  correct English and "Engaged day: 1" would be wrong in a column whose header
 *  names the measure. So `plural()` and both singular strings are deleted rather
 *  than left dormant, and the copy set shrinks to two constants. */
export interface SummaryStat {
  /** TODO-COPY, both. Categorical — never agrees with `value`. */
  label: string;
  value: number;
}

/** ═══ THE TWO STATS, AND WHY A ZERO IS A VALUE ═══
 *
 *  BOTH STATS ALWAYS RENDER, and an absent measurement reads `0`.
 *
 *  THAT REVERSES WHAT THIS FUNCTION USED TO DO, deliberately and on instruction.
 *  It dropped a half it had no number for, on the argument that "0 engaged days"
 *  reports a measurement where there is an absence. In a SENTENCE that argument
 *  holds — the sentence is the only thing on the line, so a zero in it is a
 *  claim. In a STAT ROW it does not: the row is a fixed frame with two columns,
 *  and a column that disappears takes its label with it, so a reader cannot tell
 *  "nothing happened this week" from "this card does not track exchanges". A zero
 *  under a standing label is the more honest of the two, and the interpretation
 *  is carried by the empty-state sentences in the sections below, which say in
 *  words what the record does and does not have.
 *
 *  THE COST, STATED: on a record with no conversation extraction the row now
 *  reads `0 / 0` where it previously showed nothing. That is a real change in
 *  what the card asserts, and it is the instructed behaviour. The exchange count
 *  remains a fixture rather than a pipeline — see the TODO-DATA note below. */
export function summaryStats(
  exchanges: number | null,
  /** Days the teen engaged in the window. Null where no extraction exists. */
  engagedDays?: number | null
): [SummaryStat, SummaryStat] {
  return [
    /* TODO-COPY — the frame's strings, lowercase and unabbreviated. */
    { label: "engaged days", value: engagedDays ?? 0 },
    /* "messages sent", NOT "exchanges". The frame names the artefact a reader
       can count in a transcript rather than this product's word for a
       back-and-forth — and it is the mock's copy, so it ships. Worth noting for
       copy review that the two are not synonyms: an exchange is a pair, a
       message is one side of it, so the same conversation yields a bigger number
       under this label. The underlying fixture is unchanged. */
    { label: "messages sent", value: exchanges ?? 0 },
  ];
}

/** ═══ WHAT A SCREEN READER HEARS ON A BLOCK CHANGE ═══
 *
 *  The stat row's DOM order is label, value, label, value — so read as it is
 *  laid out it announces "Engaged days 3 Exchanges 7", which is the shape of the
 *  visual and not the shape of a sentence. The row is therefore hidden from the
 *  accessibility tree and this string is announced in its place, inside the same
 *  live region as the range caption so the pair is ONE utterance.
 *
 *  BUILT FROM THE SAME CONSTANT LABELS, lowercased. That keeps one copy set
 *  rather than a second spoken vocabulary that could drift from the visible one —
 *  and it means a value of 1 would say "1 engaged days", which is the direct cost
 *  of deleting the singular forms. Unreachable on current fixtures (the contact
 *  floor puts a rendered engaged-day count at 0 or >= 2), and named rather than
 *  quietly worked around. */
export function summaryStatsSpoken(stats: readonly SummaryStat[]): string {
  return `${stats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(", ")}.`;
}

export function CareSummaryDocCard({
  doc,
  block,
  onBlockChange,
  rangeLine,
  /** Supervisor tier. Gates the refresh control — element 5, which it also used
   *  to gate, is removed. */
  pattern,
  exchanges,
  onJumpToEvent,
}: {
  doc: CareSummaryDoc;
  /** ═══ THE PATTERN STRIP'S DATA ═══
   *  Passed in rather than derived here: `carePatternFor` is one of the Care
   *  tab's existing store reads and this component is otherwise pure in its
   *  props. Null is a designed outcome — most records have no pattern — and the
   *  strip then renders nothing while the trajectory sentence stands alone. */
  pattern: CarePattern | null;
  /** ═══ THE BLOCK IS OWNED BY THE TAB, NOT BY THIS CARD ═══
   *  The card renders the control and reports changes; the tab holds the state
   *  and re-derives the document. That is the only arrangement in which the
   *  DOCUMENT and the CONTROL cannot disagree — a card holding its own block
   *  would be one render away from showing 30-day data under a "Recent" thumb.
   *  `onBlockChange` absent renders NO CONTROL, which is what the committed
   *  summary's read-only view wants: a frozen document has one window and
   *  offering to re-scope it would imply the freeze is negotiable. */
  block: CareTimeBlockId;
  onBlockChange?: (b: CareTimeBlockId) => void;
  /** The resolved range, from `blockRangeLine`. Passed rather than computed so
   *  the card cannot state a period the document was not built for. */
  rangeLine: string;
  /** ONE MUTED LINE, AND IT MUST NAME ITS OWN SCOPE.
   *
   *  `careReadingFor` is UNWINDOWED — it describes the whole mentorship, not
   *  this cycle — so a bare number here sits under a header stating the cycle
   *  window and silently claims to describe it. It also carried a day count,
   *  which put TWO DIFFERENT "conversation days" figures on one card: 14 from
   *  the relationship and 9 from the theme window. A reader hitting that has to
   *  decide which one the document means, and there is no way to tell.
   *
   *  So: exchanges only, scope stated. The theme element keeps the only
   *  conversation-day count on the card, with its window named.
   *
   *  TODO-COPY — "9 sessions · 17 exchanges · 5h average reply", demoted to a
   *  muted context line so it informs without competing with the structure. */
  /** THE COUNT, NOT A SENTENCE. It used to arrive pre-formatted from
   *  `care-tab.tsx`; the card owns the wording now because the card owns the
   *  window the wording is about. */
  exchanges: number | null;
  onJumpToEvent?: (eventId: string) => void;
}) {
  const thin = doc.contactDays < SUMMARY_MIN_CONTACT_DAYS;
  /* The header's two data. The period is the caption above them. */
  const stats = summaryStats(
    onBlockChange ? doc.exchanges : (doc.exchanges ?? exchanges),
    doc.themes?.conversationDays ?? null
  );

  return (
    <section
      aria-label="Care summary" // TODO-COPY
      // Same hook every other region on this record carries (care-timeline,
      // care-update, …). It is what the responsive harness and the variant
      // capture target: a crop resolved by class or nth-child re-points itself
      // silently the first time the layout changes, and then evidences the
      // wrong element while still looking like a screenshot of this one.
      data-record-section="care-summary-doc"
      data-anno-ref="care-summary-doc"
      className="rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)]"
    >
      {/* ── HEADER + PROVENANCE ────────────────────────────────────────────
          Provenance sits HERE, not in a footer: guardrail 6 requires it visible
          without scrolling, and a reader who has to scroll to learn a document is
          AI-generated has already read it as authored. */}
      {/* `pb-0`: THE STAT ROW OWNS THE BOTTOM PADDING so the vertical rule
          between the two cells can reach this border. See the row. */}
      <header className="border-b border-[color:var(--border-subtle)] px-5 pt-4 pb-0">
        {/* THE TIME BLOCK CONTROL IS RENDERED AT THE END OF THIS HEADER — see
            below the title row. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2
              className="text-[var(--text-primary)]"
              style={{ font: "var(--type-card-title)" }}
            >
              {/* TODO-COPY */}
              Care summary
            </h2>
            {/* ═══ NOTHING ELSE IS ON THE TITLE ROW ═══
                A subtitle sat here once, above the control, and the stack read
                title → counts → control → range: two text lines with the control
                wedged between them, and a reader had to hold the counts in mind
                across it to learn which period they described. Both facts are
                below the control now — see the caption and the stat row.
                THE ⓘ DOES NOT MOVE. It stays top-right on this row, which is
                where a reader looking for provenance already looks, and it
                describes the document rather than the block. */}
          </div>


          {/* ═══ REFRESH IS GONE (B2) ═══
              It re-stamped the Generated date and showed a toast saying
              regeneration was not wired — a control whose honest label was "this
              does almost nothing". The summary is DERIVED from the record, so it
              is already current whenever the record changes; there was never a
              stale state for a reader to fix. Removing it also removes the
              question it invited ("should I refresh before I read this?"), which
              is the real cost of a control nobody needs. */}
          {/* ═══ PROVENANCE, AS A MARK RATHER THAN A SENTENCE ═══
              A 20-word disclaimer used to run full-width under this header. It
              was accurate and the wrong shape: a reader who has seen it once
              skims it forever, and at body width it outweighed the findings it
              qualified. The badge is always visible and cannot be skimmed past;
              the note is one hover, focus or tap away. See `provenance.tsx`.
              GUARDRAIL 6 STILL HOLDS — attribution is visible without scrolling.
              What changed is that the EXPLANATION is now on demand, not that it
              is optional. */}
          {/* THE ⓘ NOW CARRIES THE WINDOW (B3). The AI tag inside the panel is
              unchanged — see `provenance.tsx`. */}
          <Provenance note={summaryProvenanceNote(doc.window, doc.generatedAt)} />
        </div>

        {/* ══ THE TIME BLOCK CONTROL, AND THE ONE SCOPE DECLARATION ══════════
            Rail time-block is a viewing control; clinical review windows are
            cadence-anchored and independent. Nothing below this card responds
            to it — see `care-time-block.ts` and the boundary test.

            `semantics="group"`, NOT `"tabs"`. Tabs semantics needs
            `aria-controls` pointing at a panel the segment reveals, and these
            segments reveal nothing: they re-scope the data already on screen.
            `aria-pressed` on a button group is what that is.
            THE COST, REPORTED: the shared control wires ArrowLeft/Right only
            for `tabs` (`if (!isTabs) return` in its `onKeyDown`), so this group
            is Tab-and-Enter operable rather than arrow-steppable. Adding arrow
            keys to group mode is a change to a component with six other
            consumers, so it is reported rather than made.

            `fullWidth` — four segments at the rail's 380px. Measured: they fit
            with the labels at their natural width and no truncation. */}
        {onBlockChange && (
          /* ═══ THE STACK RHYTHM (A3), IN NEAREST SPACING TOKENS ═══
             title → 8px → control → 8px → scope line → 16px → divider.
             `mt-2` is 8px and the header's own `py-4` supplies the 16px to the
             divider, so the shipped values are the asked-for ones with no
             off-scale number: measured 8 / 8 / 16.
             It was 4 / 12 / 8 / 17 before — a 4px gap under the title that read
             as a typographic accident and a 12px one that made the control look
             like it belonged to the subtitle above it rather than the line
             below. */
          <div className="mt-2">
            <SegmentedControl
              options={CARE_TIME_BLOCKS.map((b) => ({
                value: b.id,
                label: b.label,
              }))}
              value={block}
              onChange={onBlockChange}
              /* `md` (32px, 14px labels), NOT `sm` (28px, 11px) — the frame
                 draws a taller control with readable labels, and the three
                 spelled-out segments have the room at the rail width. A prop,
                 not a change to the shared control. */
              size="md"
              semantics="group"
              fullWidth
              /* TODO-COPY */
              ariaLabel="Care summary time period"
            />
            {/* ═══ THE CONTROL'S OUTPUT, THEN THE CARD'S TWO DATA ═══
                From the design frame. Two changes from the row this replaces,
                and both invert something recorded here as a decision — so both
                are named rather than quietly swapped.

                THE VALUE IS NOW ABOVE THE LABEL. Label-over-value came from the
                review's weighted strip, where a reader meets three data in a
                row and needs to know what each one IS before reading it. Here
                there are two, they are named in the frame, and the number is
                what a reader came for — so the number leads and the label
                answers "of what". The strip is unchanged; the two patterns now
                differ, which is the frame's call.

                AND THE PAIR IS JUSTIFIED, not left-aligned. The previous pack
                asked for a left-aligned pair on the argument that two data
                pushed to opposite ends of a 380px rail read as a header bar
                with a value in each corner. The frame answers that with the
                RULE: an equal two-column grid with a hairline down the middle
                is not two corners, it is two cells, and the rule is what makes
                the second column's left edge meaningful. `grid-cols-2` puts it
                at the exact midpoint of the content box.

                ═══ ONE LIVE REGION OVER CAPTION AND STATS, NOT ONE EACH ═══
                On a block change both dates and both numbers change. Two live
                nodes would announce them as two utterances in whichever order
                the mutations landed; one region announces the period and then
                what was counted in it, as a single statement. The wrapper
                carries the 8px rather than the caption, because the gap belongs
                to the group. */}
            <div aria-live="polite" className="mt-2">
              {/* ── THE REPORTING-PERIOD CAPTION ─────────────────────────────
                  `Reporting Period : {dates}` — a labelled value rather than a
                  bare range. The label carries what the dates ARE, which the
                  dates alone could not say: a reader landing on this card sees
                  a period and has to work out whether it is the review window,
                  the mentorship, or the block they just chose.

                  TWO INKS, TWO FACES, ONE SIZE. The label is Lausanne 400 in
                  `--text-muted`; the dates are Avantt Bold in `--text-primary`,
                  which is the only way this app can set bold text — Lausanne
                  ships 400 only, so `font-bold` on it renders nothing (measured:
                  identical advance at 400, 500, 600 and 700). `font-display` is
                  the existing utility for exactly this, already used by two page
                  headers.

                  14px AVANTT IS OFF THE RAMP, and that is the one place this
                  header leaves it. Bloom's Avantt stops are 16px
                  (`--type-title-sm`, `--type-card-title`), 24px and 32px; the
                  frame sets these dates at the same optical size as the label
                  beside them, which is 14px. Taking the 16px token instead would
                  make the dates as large as the CARD TITLE. So the size is the
                  frame's and the face is the system's, written the way the two
                  page headers already write it. Flagged for the design lead:
                  either a 14px Avantt step exists in Bloom and is not tokenised
                  here, or this line wants 16px.

                  THE SPACE BEFORE THE COLON IS THE FRAME'S. "Reporting Period :"
                  reads as French spacing and is unusual in English typography;
                  it is reproduced exactly as drawn and flagged rather than
                  silently corrected, since "copy the mock exactly" is the
                  instruction and a stray space is precisely the kind of thing a
                  reviewer should get to decide about. */}
              <p className="text-[14px] leading-[20px] text-[var(--text-muted)]">
                {/* TODO-COPY */}
                Reporting Period :{" "}
                <span className="font-display font-bold text-[var(--text-primary)]">
                  {rangeLine}
                </span>
              </p>

              {/* ── THE STAT ROW ─────────────────────────────────────────────
                  ═══ THE VALUE IS THE ONLY AVANTT-BOLD NUMBER IN THE CARD ═══
                  `--type-display` is 700 24px/32px Avantt — an exact Bloom step,
                  not an arbitrary size. It makes the values the largest text in
                  the card, ABOVE the 16px title, which reverses the scale rule
                  the previous pack set ("largest after the title, step down if
                  they compete"). The frame draws them at roughly 1.5x the title
                  and the reversal is deliberate there: on a card whose job is to
                  answer "how much contact was there", the counts outranking the
                  card's own name is a reasonable hierarchy. Recorded because a
                  reviewer who remembers the old rule will notice it broken.

                  `tabular-nums` so the two columns hold their positions as the
                  block changes — a proportional "1" is ~40% the width of a "9",
                  and both cuts carry real tabular figures.

                  BOTH VALUES SHARE A BASELINE BY CONSTRUCTION: the two cells are
                  grid siblings whose first child is the same style, so the value
                  lines begin at the same y without either being told a height.

                  ═══ THE RULE REACHES THE HEADER'S OWN DIVIDER ═══
                  `divide-x` draws it on the second cell's left edge, at the grid
                  midpoint. For it to meet the horizontal divider the way the
                  frame draws it, the cells have to own the header's bottom
                  padding — so the header is `pt-4 pb-0` and this row carries the
                  `pb-4`. A rule that stopped 16px short would read as a mark
                  beside the numbers rather than as the line between two cells.

                  ARIA-HIDDEN, AND ANNOUNCED IN WORDS INSTEAD. Read as laid out
                  this says "10 engaged days 50 messages sent" with no separator
                  between the two data. See `summaryStatsSpoken`. */}
              <div
                aria-hidden
                className="mt-3 grid grid-cols-2 divide-x divide-[color:var(--border-subtle)] pb-4"
              >
                {stats.map((stat, i) => (
                  <div
                    key={stat.label}
                    className={cn("flex min-w-0 flex-col", i > 0 && "pl-4")}
                  >
                    <span
                      className="text-[var(--text-primary)]"
                      /* ═══ `fontVariantNumeric` IS SET HERE, NOT AS A CLASS ═══
                         The `font` SHORTHAND resets every font longhand it does
                         not name, `font-variant-numeric` included — and an
                         inline style outranks a utility class, so
                         `className="tabular-nums"` beside `style={{ font }}`
                         silently rendered proportional figures. Measured:
                         `font-variant-numeric: normal` on the shipped span,
                         which is how the probe found it.
                         So the longhand goes in the same style object, after the
                         shorthand, where it wins by order. */
                      style={{
                        font: "var(--type-display)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {stat.value}
                    </span>
                    <span className="text-[14px] leading-[20px] text-[var(--text-muted)]">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
              <span className="sr-only">{summaryStatsSpoken(stats)}</span>
            </div>
          </div>
        )}
      </header>

      {/* ── 1 · SYMPTOM TRAJECTORY ─── one sentence, then one strip ─────── */}
      {/* ═══ THIS ELEMENT ABSORBED THE CARE PATTERN CARD ═══
          The pattern was its own card further down the page: a heading, one to
          three generated sentences, this strip, a provenance footer. Two
          generated narratives about the same scores on one page is one too many,
          and they sat far enough apart that a reader might not notice they
          agreed — or notice that they didn't.
          SO: the sentence is the only narrative and the strip is the only
          visual. The clustering the pattern's prose described ("two fell within
          19 days of each other") is legible from two triangles 19 days apart on
          a shared axis, without a sentence. */}
      <Element label="Symptom trajectory">
        {doc.trajectory ? (
          <p className="max-w-prose text-[14px] leading-[1.55] text-[var(--text-primary)]">
            {doc.trajectory}
          </p>
        ) : (
          <Refusal>
            {/* ═══ TWO DIFFERENT REFUSALS, BECAUSE THEY MEAN DIFFERENT THINGS ═══
                Element 1 refuses rather than hedging: direction of change needs
                two comparable readings, and prose carries no confidence marker,
                so a thin sentence is indistinguishable from a solid one.
                BUT INSIDE A SHORT BLOCK THE ORIGINAL WORDING LIED BY IMPLICATION.
                Surveys are monthly, so a 7-day block contains at most one — and
                "not enough comparable readings" sat directly above a chart
                showing EIGHT of them. A reader gets a full trajectory and a
                sentence denying there is one. Seen in the rendered card, not in
                the diff.
                So a block that simply has no second reading says that, and a
                record that genuinely lacks readings still says the original. The
                chart is whole-record on purpose — see its `scope` prop — and this
                is the sentence that stops the pairing reading as a contradiction.
                TODO-COPY, both. */}
            {onBlockChange && block !== "all" && (pattern?.marks?.length ?? 0) > 1
              ? doc.assessmentsInWindow === 1
                ? "One assessment in this period — a direction needs two. The chart shows the whole record."
                : "No assessment in this period — the chart shows the whole record."
              : "Not enough comparable readings in this window to state a direction."}
          </Refusal>
        )}

        {pattern && (
          <div className="mt-2">
            <CareSparkline
              pattern={pattern}
              /* THE BOX MARKS THE BLOCK, and `all` gets none — see the note on
                 the `scope` prop. The plot itself is never filtered. */
              scope={block === "all" ? null : doc.window}
              onSelectEvent={onJumpToEvent ?? (() => {})}
            />
            {/* ═══ THE CHART'S CAPTION AND ITS MARK ARE GONE ═══
                It read "Assessment scores and risk flags across the mentorship"
                beside a second provenance mark. Two marks on one card is two
                things to open to learn one thing, and this was the weaker: it
                named the axis but not the window the card is about. The sentence
                is merged into the header's mark — see `summaryProvenanceNote` —
                which already carried the shared note this one repeated. */}
          </div>
        )}
      </Element>

      {/* ── 2 · SESSION CONTENT FREQUENCY ─── extraction, so chips ──────── */}
      {/* TODO-COPY. "Conversation content", NOT "Session content": the
          footnote under this element names conversation days as the
          denominator, and a heading that says "session" above it asks the
          reader to reconcile two units for the same thing. */}
      <Element label="Conversation content frequency">
        {doc.themes && doc.themes.themes.length > 0 ? (
          <>
            {/* ═══ SPLIT ON THE TAG'S OWN CATEGORY ═══
                One flat wrap of chips put "Sleep disturbance" and "Household
                substance use" side by side as if they were the same kind of
                finding. They are not: one is what the teen is experiencing and
                one is what is happening around them, and a clinician reads the
                two for different reasons.
                THE AXIS ALREADY EXISTED. `content-tags.ts` carries `category` on
                every tag and its own note says it is "the structure a future
                grouped view needs" — this is that view, so nothing new was
                invented to build it.
                RISK JOINS SYMPTOMS. The design file puts "School avoidance"
                under Symptoms, and `school-avoidance` is a `risk` tag in the
                taxonomy — so the split is symptom-side versus environment-side,
                not a one-to-one mapping of category names. Both buckets render
                only when they have something in them; a heading over nothing
                would be a section a reader has to rule out. */}
            {THEME_GROUPS.map(({ label, has }) => {
              const rows = doc.themes!.themes.filter((t) =>
                has(contentTag(t.tagId)?.category)
              );
              if (!rows.length) return null;
              return (
                <div key={label} className="mb-3 last:mb-0">
                  <p
                    className="mb-2 text-[var(--text-tertiary)]"
                    style={{ font: "var(--type-field-label)" }}
                  >
                    {/* TODO-COPY */}
                    {label}
                  </p>
            <ul className="flex flex-wrap gap-1.5">
              {rows.map((t) => (
                <li key={t.tagId}>
                  {/* THE COUNT IS THE TRAILING SLOT, so a long tag truncates
                      and the "7/9" survives — it is the checkable part of the
                      finding and the last thing that may be cut.
                      NO `opacity-80` on it. That dropped it to 3.71:1 on the
                      chip (axe, both widths), and dimming it was backwards to
                      begin with: the label names the theme, the count is the
                      evidence. `tabular-nums` so a column of fractions aligns. */}
                  <TagChip
                    id={t.tagId}
                    className={cn(CHIP_THEME, "max-w-full")}
                    trailing={
                      <span className="ml-1.5 shrink-0 tabular-nums">
                        {t.days}/{doc.themes!.conversationDays}
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
                </div>
              );
            })}
            {/* ═══ THE ENGAGEMENT CAPTION IS GONE FROM HERE ═══
                It read "Out of {n} engagement days in the window ⓘ" under the
                chips. The fact now leads the card's subtitle, where it is a
                property of the window rather than a footnote to one section —
                and it was always the denominator for BOTH the chips above it and
                the trajectory beside them, so a caption under one of the two was
                the wrong home for it.
                NOTHING IS ORPHANED: the window's bounds, its generated date and
                the basis all live on the card-header mark, which is unchanged.
                The provenance this caption carried was the same shared note. */}
          </>
        ) : (
          <Refusal>
            {/* TODO-COPY. NEITHER BRANCH MAY ASSERT A CONTACT FIGURE. The first
                used to read "Fewer than N conversation days in this window",
                which is false wherever the mocked extraction simply has no row —
                see the note on `trajectoryFor`. Both branches now describe the
                same true thing from different directions: nothing was extracted
                for this window, or nothing has ever been extracted for this
                record. */}
            {thin
              ? "No conversation content is available for this window — theme frequency is not generated."
              : "No theme extraction available for this record."}
          </Refusal>
        )}
      </Element>

      {/* ── 3 · CONVERSATION SUMMARY ─── the qualitative read ─────────── */}
      {/* TODO-COPY on the label. It sits AFTER the frequency element because it
          reads the same window from the other direction: the chips say how often
          a theme appeared, this says what the period was like. Counts first,
          then the account of them. */}
      <Element label="Conversation summary">
        {doc.conversationSummary ? (
          <>
            <p className="max-w-prose whitespace-pre-line text-[14px] leading-[1.55] text-[var(--text-primary)]">
              {doc.conversationSummary}
            </p>
            {/* ═══ THE BADGE AND THE BASIS TRAVEL WITH THE PROSE ═══
                This is the most model-written thing on the card — several
                sentences of qualitative judgement — so it carries the shared
                provenance mark rather than inheriting one from the header. The
                note names the three inputs, because "generated" alone does not
                tell a supervisor whether the sentence about an open escalation
                came from the flag log or from somewhere softer. */}
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[12px] leading-[16px] text-[var(--text-muted)]">
              {/* TODO-COPY */}
              <span>Written from this window</span>
              <Provenance
                triggerLabel="About this conversation summary"
                note="Generated from conversation themes, risk flags and escalations inside the analysis window. It describes patterns and engagement — it is not a clinical determination and states no presentation."
              />
            </p>
          </>
        ) : (
          <Refusal>
            {/* TODO-COPY. The frequency element's voice, deliberately: the two
                refuse for the same reason on the same window, and two different
                sentences for one absence would read as two different problems. */}
            No conversation content is available for this window — a summary is
            not generated.
          </Refusal>
        )}
      </Element>

      {/* ═══ TWO ELEMENTS REMOVED ═══
          "New or resolved clinical content" and "Risk flags in window" are gone
          from this card at the product owner's call.

          THEIR DATA IS NOT. `doc.flags` still feeds `markerCounts` on the
          COMMITTED summary — the frozen record of a cycle counts its flags by
          tier — and `doc.contentDelta` is still computed. Deleting the
          producers would have quietly changed what a commit stores, which is an
          append-only artifact and a different decision from removing a section
          from a rail. The flags also still reach the reader: they are rows in
          History with a field set each, which is a fuller account than the list
          that was here. */}

      {/* ═══ SCORE-VS-CONTENT CONCORDANCE WAS ELEMENT 5, AND IS REMOVED ═══
          It was the card's most consequential section: a deterministic rule
          comparing severity-band movement against the count of qualifying risk
          markers, and where they diverged it stated the gap in three labelled
          fragments a supervisor could check against criteria.
          WHY IT GOES ANYWAY: the "content" half of the comparison came from the
          theme extraction, which is fixture data — there is no pipeline. So the
          section presented a rule about two inputs when only one was real, and
          it refused for 23 of 26 records because `contactDays` is 0 wherever the
          mock has no row. A refusal that frequent is not a designed empty state,
          it is a feature waiting for its data.
          THE MODEL IS INTACT AND UNTOUCHED: `concordanceFor`, its `reason`
          discriminator, `ConcordanceCall`, `commitFor`'s frozen `concordance`
          field and all 20 of their tests. Committed summaries already in the
          record keep their call, and History still renders it. Only the UI is
          gone, so returning it when the pipeline lands is a render, not a
          rebuild. design-system-gaps row 313. */}
    </section>
  );
}

/** ═══ THE TWO BUCKETS, IN READING ORDER ═══
 *
 *  Symptom-side first: it is what the assessment score above is about, so a
 *  reader arrives at it already holding the trajectory. Environment second, as
 *  the context that explains it.
 *
 *  `has` takes the category rather than a list of ids, so a tag added to
 *  `content-tags.ts` lands in the right bucket without being registered twice.
 *  A tag whose category is missing — an id the taxonomy does not know — falls
 *  into NEITHER bucket and renders nowhere, which is deliberate: an unmapped
 *  content tag on a clinical card should be absent and reported, not filed under
 *  a guess. */
const THEME_GROUPS: {
  label: string;
  has: (c: TagCategory | undefined) => boolean;
}[] = [
  { label: "Symptoms", has: (c) => c === "diagnostic" || c === "risk" },
  { label: "Environmental factors", has: (c) => c === "sdoh" },
];

/** One element. Hairline above, label, body. NOT a nested card — the house rules
 *  forbid those, and structure here comes from the rule and the spacing. */
function Element({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[color:var(--border-subtle)] px-5 py-4 last:border-b-0">
      <h3 className="text-[var(--text-muted)]" style={LABEL_STYLE}>
        {/* TODO-COPY */}
        {label}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** The explicit-absence treatment. Muted and unchipped: it is a statement about
 *  the record, not a result. */
function Refusal({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-prose text-[13.5px] leading-[19px] text-[var(--text-muted)]">
      {children}
    </p>
  );
}

/** A New/Resolved sub-row. Renders "None this cycle" rather than disappearing —
 *  see the inversion note at the top of the file. */
/* ══════════════════════ THE CONTENT-TAG CHIP ══════════════════════
 *
 * One component for both tag surfaces, so a chip cannot render one way in the
 * frequency element and another in the delta rows.
 *
 * ═══ THE THREE REASONS A CHIP CARRIES A TOOLTIP ═══
 *
 *  1. AN ANNOTATION — "Appetite change" excludes medication-linked change;
 *     "Suicidal ideation / self-harm ideation" excludes third-party disclosures.
 *     A supervisor acting on either has to be able to read the boundary, so
 *     these tooltip ALWAYS, truncated or not.
 *  2. A SUB-TAG — the chip shows the leaf, because "Online / cyberbullying" is
 *     what happened. "Pet" on its own is not a clinical statement, so the
 *     tooltip carries "{parent} → {leaf}".
 *  3. TRUNCATION — measured, not guessed: 54 of the 106 canonical labels are
 *     over 22 characters and several are over 50. A chip that silently cuts
 *     "Difficulty following through on tasks or instructions" to
 *     "Difficulty following…" has lost the tag.
 *
 * ═══ THE TOOLTIP IS DECIDED BY LABEL LENGTH, NOT BY MEASUREMENT ═══
 *
 * This first measured `scrollWidth > clientWidth` in a `ResizeObserver`, which
 * is the correct instinct and does not work here. MEASURED: a ResizeObserver
 * created on a fresh element in this document never fires — not on resize, not
 * even its initial callback. That is the hazard this codebase already documents
 * ("mutating the DOM inside a ResizeObserver callback makes Chrome silently stop
 * delivering notifications"): something on this page has already killed delivery
 * for the document, so any component that depends on RO here fails silently.
 *
 * So the rule is static: a chip tooltips when its label is longer than
 * `SHORT_LABEL_THRESHOLD` — which is the same 22 characters that puts a tag on
 * the short-label checklist, i.e. exactly the set at risk of truncating. 54 of
 * the 106 canonical labels qualify. A short label gets no redundant tooltip, a
 * long one always has its canonical text available, and nothing depends on a
 * measurement that cannot be taken.
 *
 * The label still truncates with an ellipsis in CSS; only the DECISION to offer
 * the full text stopped being measured.
 *
 * ═══ THE DEV GUARD ═══
 *
 * An id outside the taxonomy renders an unmissable error chip naming the value.
 * It does NOT throw: a thrown render error on a clinical record takes the page
 * down and hides the tags that ARE right. In production the id renders as-is,
 * because a degraded chip beats a blank record. */
function TagChip({
  id,
  className,
  trailing,
}: {
  id: string;
  className: string;
  /** ═══ THE COUNT GOES HERE, NOT AROUND THE CHIP ═══
   *
   *  The frequency element first wrapped this component in its own chip and
   *  passed `display: contents` so the count could sit beside the label. That
   *  cost the tooltip: an element with `display: contents` HAS NO BOX, so its
   *  `title` never fires — measured, and it would have silently removed the
   *  annotation tooltip from an annotated tag in the frequency element, which
   *  t19 actually carries (`appetite-change`).
   *
   *  So the chip owns its own box and takes a trailing slot. The label truncates
   *  inside it; whatever is passed here is `shrink-0` and survives. */
  trailing?: React.ReactNode;
}) {
  if (!isKnownTag(id)) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <span
          data-content-tag-error={id}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--state-error)] px-2.5 py-0.5 text-[12.5px] font-semibold leading-[18px] text-white"
        >
          {/* Loud, and it NAMES THE VALUE so it can be found. */}
          UNKNOWN TAG: {id}
        </span>
      );
    }
    return <span className={className}>{id}</span>;
  }

  const tag = contentTag(id)!;
  const long = tag.label.length > SHORT_LABEL_THRESHOLD;
  const tip = tagTooltip(id) ?? tag.label;
  const showTip = tagAlwaysTooltips(id) || long;

  return (
    <span
      data-content-tag={id}
      className={className}
      /* `title` RATHER THAN A CUSTOM PANEL, deliberately. It is reachable by
         pointer and by assistive tech without this element becoming a control —
         and these chips are not controls. Making one focusable to carry a
         tooltip would put fifteen tab stops into a rail section that has none.
         The full text is also the accessible name, so nothing depends on hover. */
      title={showTip ? tip : undefined}
      aria-label={showTip ? tip : undefined}
    >
      <span className="block min-w-0 truncate">{tagLabel(id)}</span>
      {trailing}
    </span>
  );
}

function Fragment({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt
        className="text-[var(--text-muted)] sm:pt-px"
        style={LABEL_STYLE}
      >
        {/* TODO-COPY */}
        {label}
      </dt>
      <dd className="max-w-prose text-[14px] leading-[1.5] text-[var(--text-primary)]">
        {value}
      </dd>
    </>
  );
}
