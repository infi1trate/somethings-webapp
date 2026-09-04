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
  return (
    `${PROVENANCE_NOTE} ` +
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
const DAY_MS = 86_400_000;

export function summaryMetaLine(
  window: { fromAt: number; toAt: number },
  exchanges: number | null
): string {
  const days = Math.max(0, (window.toAt - window.fromAt) / DAY_MS);
  // TODO-COPY on both forms.
  const period =
    days < 7 ? "First week" : `${Math.max(1, Math.round(days / 7))}-week analysis`;
  // A record with no conversation content yet says nothing about volume rather
  // than claiming "0 exchanges", which reads as a measurement instead of an
  // absence.
  return exchanges && exchanges > 0
    ? `${period} · ${exchanges} exchanges`
    : period;
}

export function CareSummaryDocCard({
  doc,
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
      <header className="border-b border-[color:var(--border-subtle)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2
              className="text-[var(--text-primary)]"
              style={{ font: "var(--type-card-title)" }}
            >
              {/* TODO-COPY */}
              Care summary
            </h2>
            {/* ═══ ONE LINE (B1) ═══
                `--text-secondary` at 13px, the same token the two-line block
                used — measured 7.63:1 on `--surface-card`, well clear of 4.5:1,
                so demoting the prose costs nothing in legibility.

                THERE IS NO "PREVIOUS CYCLE" STATE HERE, AND CANNOT BE. A
                "· previous cycle" label used to sit in this block for a frozen
                summary. The two ideas are mutually exclusive by construction: the
                window is the interval SINCE THE LAST CODE UPDATE, and
                `presentation_reviewed` is a code event — so approving a review
                opens a new window in the same act that commits the old one.
                Driving the flow proved it: after an approval the header read
                "Aug 28 – Aug 28 · previous cycle", a zero-length window labelled
                as a past one. THIS CARD IS ALWAYS THE LIVE CYCLE; the committed
                one is a History entry with its own frozen window. Gap row 305. */}
            <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
              {summaryMetaLine(doc.window, exchanges)}
            </p>
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
            {/* TODO-COPY — element 1 refuses rather than hedging. Direction of
                change needs two comparable readings, and prose carries no
                confidence marker, so a thin sentence is indistinguishable from a
                solid one. */}
            Not enough comparable readings in this window to state a direction.
          </Refusal>
        )}

        {pattern && (
          <div className="mt-3">
            <CareSparkline
              pattern={pattern}
              onSelectEvent={onJumpToEvent ?? (() => {})}
            />
            {/* THE STRIP CARRIES ITS OWN ATTRIBUTION. It is derived from the
                same record as everything else here, but it is a separate visual
                a reader can land on without having read the header — so the
                badge travels with it rather than being inherited from six
                inches up the card. */}
            <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] leading-[16px] text-[var(--text-muted)]">
              {/* TODO-COPY. Names the axis and the two mark classes, because a
                  strip with no legend needs its shapes named somewhere. */}
              <span>
                Assessment scores and risk flags across the mentorship
              </span>
              <Provenance />
            </p>
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
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[12px] leading-[16px] text-[var(--text-muted)]">
              {/* THE DENOMINATOR STAYS — "7/9" is meaningless if a reader cannot
                  tell what nine is, and it is a fact about the window rather
                  than a disclaimer. NOT "sessions": this product has none.
                  "Theme extraction is mocked — no pipeline exists" WAS HERE and
                  is removed. It was an honest note about implementation state
                  and the wrong thing to put in a clinical reader's line of
                  sight: it described the codebase, not the record. The badge
                  beside it says the content is generated, which is the fact that
                  bears on how the number should be read. TODO-COPY. */}
              <span>
                Out of {doc.themes.conversationDays} conversation days in the
                window
              </span>
              <Provenance />
            </p>
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
