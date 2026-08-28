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

import { RefreshCw, Sparkles } from "lucide-react";
import {
  SUMMARY_MIN_CONTACT_DAYS,
  type CareSummaryDoc,
  type ConcordanceResult,
} from "@/lib/record/care-summary-doc";
import { clinicalDate } from "@/components/record/care-presentation";
import type { RiskTier } from "@/lib/record/risk-taxonomy";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** Neutral by default. The tonal chips below are the exceptions, and each one
 *  earns its tone from an existing measured pair. */
const CHIP_NEUTRAL =
  "inline-flex items-center rounded-full bg-[var(--status-neutral-bg)] px-2.5 py-0.5 text-[12.5px] font-medium leading-[18px] text-[var(--status-neutral-fg)]";

/** TIER TONES REUSE THE FLAG VOCABULARY the timeline already established —
 *  clay for escalation-grade, amber for risk-flag-grade, sand for routine. Not a
 *  new palette: a reader who has learned the flag colours should not have to
 *  learn a second set for the same artifact. Ratios are the tokens' own, measured
 *  in settings-tokens.css: clay 6.84:1, amber 7.24:1, sand 7.38:1.
 *
 *  THE TIER IS A PROPERTY OF THE FLAG, NEVER OF THE TEEN. */
const TIER_CHIP: Record<RiskTier | "unassigned", string> = {
  imminent: "bg-[var(--band-clay-bg)] text-[var(--band-clay-fg)]",
  clinicalReview: "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]",
  generalMonitoring: "bg-[var(--band-sand-bg)] text-[var(--band-sand-fg)]",
  unassigned:
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
};

/** DEFAULTS WHISPER, EXCEPTIONS SPEAK. `Diverges` is the one result that asks a
 *  supervisor to look harder, so it takes a tone; the other two stay neutral.
 *  `Insufficient data` is deliberately NOT tonal — it is a refusal, and a
 *  coloured refusal reads like a finding. */
const RESULT_CHIP: Record<ConcordanceResult, string> = {
  diverges: "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]",
  concordant:
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  insufficientData:
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
};

/** TODO-COPY */
const RESULT_LABEL: Record<ConcordanceResult, string> = {
  diverges: "Diverges",
  concordant: "Concordant",
  insufficientData: "Insufficient data",
};

export function CareSummaryDocCard({
  doc,
  /** Supervisor tier. Gates element 5 and the refresh control, nothing else. */
  canAct,
  engagement,
  onRefresh,
  onJumpToEvent,
}: {
  doc: CareSummaryDoc;
  canAct: boolean;
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
  engagement: string | null;
  onRefresh?: () => void;
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
            <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
              {/* TODO-COPY — the window is stated in the header precisely so a
                  previous cycle's summary cannot be mistaken for a current read. */}
              {doc.window.firstCycle
                ? `From intake, ${clinicalDate(doc.window.fromAt)} – ${clinicalDate(doc.window.toAt)}`
                : // TODO-COPY. NOT "From sessions" — this product has no
                  // sessions, and the theme element two elements down says so
                  // out loud. The window is the interval since the last code
                  // update; naming that is both accurate and more useful than
                  // naming a unit of contact.
                  `Since the last presentation update, ${clinicalDate(doc.window.fromAt)} – ${clinicalDate(doc.window.toAt)}`}
              {" · "}
              {`Generated ${clinicalDate(doc.generatedAt)}`}
              {/* ═══ THERE IS NO "PREVIOUS CYCLE" STATE HERE, AND CANNOT BE ═══
                  A "· previous cycle" label used to sit here, for a frozen
                  summary. It is removed because the two ideas are mutually
                  exclusive by construction: the window is the interval SINCE THE
                  LAST CODE UPDATE, and `presentation_reviewed` is a code event —
                  so approving a review opens a new window in the same act that
                  commits the old one. A frozen document can never be the one
                  this card derives.
                  Driving the flow proved it: after an approval the header read
                  "Aug 28 – Aug 28 · previous cycle" — a zero-length window
                  labelled as a past one. THIS CARD IS ALWAYS THE LIVE CYCLE.
                  The committed cycle is a History entry carrying its own frozen
                  window and findings. design-system-gaps row 305. */}
            </p>
            {engagement && (
              <p className="mt-1 text-[12.5px] leading-[17px] text-[var(--text-muted)]">
                {engagement}
              </p>
            )}
          </div>

          {/* REFRESH IS THE ONLY AFFORDANCE IN THIS CARD. No frozen check: see
              the note above — the card never renders a committed cycle. */}
          {canAct && onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              /* TODO-COPY */
              aria-label="Regenerate the care summary"
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              {/* TODO-COPY */}
              Refresh
            </button>
          )}
        </div>

        {/* NOT `flex-wrap`, and NOT `items-center`. Wrapping let the icon break
            onto a line of its own above the sentence at 320px, where it read as
            an orphaned glyph rather than as a marker on the provenance line.
            `items-start` with a nudge aligns it to the first line of text
            instead, and the text wraps beside it as one block. */}
        <p className="mt-3 flex items-start gap-x-1.5 text-[12px] leading-[16px] text-[var(--text-muted)]">
          <Sparkles className="mt-[2px] size-3.5 shrink-0" aria-hidden />
          {/* TODO-COPY — the four facts guardrail 6 names: that it is
              AI-generated, the window (above), the sources, and that it is
              context for a coding decision rather than a determination. */}
          <span>
            AI-generated from {doc.sources.join(", ").toLowerCase()}. Context for
            a coding decision — not itself a clinical determination.
          </span>
        </p>
      </header>

      {/* ── 1 · SYMPTOM TRAJECTORY ─── prose, never chipped ─────────────── */}
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
      </Element>

      {/* ── 2 · SESSION CONTENT FREQUENCY ─── extraction, so chips ──────── */}
      {/* TODO-COPY. "Conversation content", NOT "Session content": the
          footnote under this element names conversation days as the
          denominator, and a heading that says "session" above it asks the
          reader to reconcile two units for the same thing. */}
      <Element label="Conversation content frequency">
        {doc.themes && doc.themes.themes.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {doc.themes.themes.map((t) => (
                <li key={t.label}>
                  <span className={CHIP_NEUTRAL}>
                    {t.label}
                    {/* NO `opacity-80`. It dropped this to 3.71:1 on the chip
                        (axe, both widths) — and dimming it was backwards to
                        begin with: "7/9" is the checkable part of the finding,
                        the thing a supervisor reads the element FOR. The label
                        names the theme; the count is the evidence. `tabular-nums`
                        stays so a column of fractions aligns. */}
                    <span className="ml-1.5 tabular-nums">
                      {t.days}/{doc.themes!.conversationDays}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-[16px] text-[var(--text-muted)]">
              {/* TODO-COPY — the denominator is named, because "7/9" is
                  meaningless if the reader cannot tell what nine is. NOT
                  "sessions": this product has no sessions. */}
              Out of {doc.themes.conversationDays} conversation days in the
              window. Theme extraction is mocked — no pipeline exists.
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

      {/* ── 3 · NEW OR RESOLVED ─── categories, so chips ────────────────── */}
      <Element label="New or resolved clinical content">
        {doc.contentDelta === null ? (
          <Refusal>
            {/* TODO-COPY — first cycle: "resolved" has no prior code to be
                relative to. Stated rather than rendered as an empty row. */}
            First cycle — there is no prior code for new or resolved content to be
            measured against.
          </Refusal>
        ) : (
          <div className="space-y-2.5">
            <DeltaRow label="New" items={doc.contentDelta.added} />
            <DeltaRow label="Resolved" items={doc.contentDelta.resolved} />
          </div>
        )}
      </Element>

      {/* ── 4 · RISK FLAGS IN WINDOW ───────────────────────────────────── */}
      <Element label="Risk flags in window">
        {doc.flags.length === 0 ? (
          <Refusal>
            {/* TODO-COPY — never omitted. This card is not a safety mechanism;
                it reports what the existing pipeline raised and links to it. */}
            No risk flags triggered this cycle.
          </Refusal>
        ) : (
          <ul className="space-y-2">
            {doc.flags.map((f) => (
              /* ═══ ONE FLAG, ONE BLOCK ═══
                 At 320px a single wrapping row split each flag across two lines
                 at a different point — "Imminent risk · Aug 25" then "Open ·
                 Open in History", but the next flag broke after "Open" — and a
                 reader scanning the list could not tell which fragment belonged
                 to which flag. So the row STACKS below `sm`: identity and date
                 on the first line, status and link beneath, the same way every
                 time. It stays one line from `sm` up, where it fits. */
              <li
                key={f.eventId}
                className="flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5"
              >
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-medium leading-[18px]",
                      TIER_CHIP[f.tier]
                    )}
                  >
                    {f.tierLabel}
                  </span>
                  <span className="text-[13.5px] leading-[19px] text-[var(--text-primary)]">
                    {clinicalDate(f.at)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[13.5px] leading-[19px] text-[var(--text-muted)]">
                    {/* TODO-COPY */}
                    {f.resolved ? "Resolved" : "Open"}
                  </span>
                {onJumpToEvent && (
                  <button
                    type="button"
                    onClick={() => onJumpToEvent(f.eventId)}
                    className={cn(
                      "rounded-sm py-1 text-[13px] text-[var(--text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--text-primary)]",
                      RING
                    )}
                  >
                    {/* TODO-COPY */}
                    Open in History
                    <span aria-hidden> →</span>
                  </button>
                )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Element>

      {/* ── 5 · SCORE-VS-CONTENT CONCORDANCE ─── supervisor tier only ────
          ABSENT below supervisor, not disabled. Concordance reasoning is entirely
          about the coding decision — severity tiers, what a code implies,
          thresholds — and has no meaning for a mentor supporting the teen.
          FLAGGED: this gating awaits product confirmation. */}
      {canAct && (
        <Element label="Score-vs-content concordance">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-medium leading-[18px]",
              RESULT_CHIP[doc.concordance.result]
            )}
          >
            {RESULT_LABEL[doc.concordance.result]}
          </span>

          {doc.concordance.statement ? (
            /* THE THREE-PART STATEMENT — labelled fragments, not a paragraph and
               not a table. "Score and content diverge" is not acceptable output:
               each fragment names something a supervisor can check against
               criteria. A definition list is the honest markup for label/value
               pairs, and it keeps the labels readable by a screen reader in
               order. */
            <dl className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
              <Fragment
                label="Current code implies"
                value={doc.concordance.statement.codeImplies}
              />
              <Fragment
                label="Content meets"
                value={doc.concordance.statement.contentMeets}
              />
              <Fragment label="Gap" value={doc.concordance.statement.gap} />
            </dl>
          ) : (
            <p className="mt-2.5 max-w-prose text-[13.5px] leading-[19px] text-[var(--text-muted)]">
              {/* TODO-COPY — an explicit refusal, never a hedged sentence that
                  reads like a finding. */}
              {doc.concordance.result === "insufficientData"
                ? // TODO-COPY. NAMES THE ACTUAL MISSING INPUT. The single
                  // combined sentence this replaces asserted "fewer than
                  // N conversation days" about records with months of contact —
                  // see the note on `ConcordanceCall.reason`.
                  doc.concordance.reason === "readings"
                  ? "Only one comparable reading in this window — no concordance call is attempted."
                  : "No conversation content is available for this window — no concordance call is attempted."
                : // TODO-COPY. "Conversation content", not "session content":
                  // same reason as the window line above.
                  "Score movement and conversation content point the same way this cycle."}
            </p>
          )}
        </Element>
      )}
    </section>
  );
}

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
function DeltaRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span
        className="shrink-0 text-[var(--text-muted)]"
        style={LABEL_STYLE}
      >
        {/* TODO-COPY */}
        {label}
      </span>
      {items.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <li key={i}>
              <span className={CHIP_NEUTRAL}>{i}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13.5px] leading-[19px] text-[var(--text-muted)]">
          {/* TODO-COPY */}
          None this cycle
        </span>
      )}
    </div>
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
