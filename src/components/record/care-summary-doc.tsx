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
  /** A frozen summary belongs to a committed cycle: no regeneration, and the
   *  header says which window it covers so it cannot be read as current. */
  frozen,
  engagement,
  onRefresh,
  onJumpToEvent,
}: {
  doc: CareSummaryDoc;
  canAct: boolean;
  frozen: boolean;
  /** TODO-COPY — "9 sessions · 17 exchanges · 5h average reply", demoted to a
   *  muted context line so it informs without competing with the structure. */
  engagement: string | null;
  onRefresh?: () => void;
  onJumpToEvent?: (eventId: string) => void;
}) {
  const thin = doc.contactDays < SUMMARY_MIN_CONTACT_DAYS;

  return (
    <section
      aria-label="Care summary" // TODO-COPY
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
                : `From sessions ${clinicalDate(doc.window.fromAt)} – ${clinicalDate(doc.window.toAt)}`}
              {" · "}
              {`Generated ${clinicalDate(doc.generatedAt)}`}
              {frozen && (
                <>
                  {" · "}
                  {/* TODO-COPY */}
                  <span className="text-[var(--text-muted)]">
                    previous cycle
                  </span>
                </>
              )}
            </p>
            {engagement && (
              <p className="mt-1 text-[12.5px] leading-[17px] text-[var(--text-muted)]">
                {engagement}
              </p>
            )}
          </div>

          {/* REFRESH IS THE ONLY AFFORDANCE IN THIS CARD, and only while the
              cycle's review is open. A frozen summary is a record entry. */}
          {!frozen && canAct && onRefresh && (
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

        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-[16px] text-[var(--text-muted)]">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
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
      <Element label="Session content frequency">
        {doc.themes && doc.themes.themes.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {doc.themes.themes.map((t) => (
                <li key={t.label}>
                  <span className={CHIP_NEUTRAL}>
                    {t.label}
                    <span className="ml-1.5 tabular-nums opacity-80">
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
            {/* TODO-COPY */}
            {thin
              ? `Fewer than ${SUMMARY_MIN_CONTACT_DAYS} conversation days in this window — theme frequency is not generated.`
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
              <li
                key={f.eventId}
                className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
              >
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
                ? `Fewer than ${SUMMARY_MIN_CONTACT_DAYS} conversation days, or only one comparable reading — no concordance call is attempted.`
                : "Score movement and session content point the same way this cycle."}
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
