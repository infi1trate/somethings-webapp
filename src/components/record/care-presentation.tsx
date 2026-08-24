"use client";

// PRESENTATION SPINE + CADENCE (MO-9.1 Prompt B, Phase 1).
//
// The presentation is the page's spine and the first thing read: statement at
// display weight, code beneath, provenance under that. Cadence is its paired
// card — assigned survey, last assessment, next review due.
//
// CLINICAL DATES ARE EXPLICIT DATES. The elapsed-time standard ("3d", "2 weeks")
// governs secondary lines everywhere else in this product and is deliberately
// SUSPENDED for the provenance line: "assigned 4 months ago" is unusable to
// anyone reconciling this record against an outside provider's notes, and a
// diagnosis date is a fact of record rather than a recency signal. The cadence
// COUNTDOWN keeps the elapsed framing, because a countdown is a distance and not
// a date of record — so the cadence card deliberately carries both forms.
//
// TWO MODES. Resting: the spine, with a quiet "Change" text action for the
// supervisor tier and NO action affordance at all below it. Reference: when a
// review is pending the action slot takes the top and this card demotes beneath
// it, rendering as the comparison — current → recommended.
//
// NO "STAGE" DEBUG CHIP. The Figma exploration carried one; cadence state is now
// legitimately rendered on the paired card, so the chip has nothing left to say.
// (It never existed in this codebase — there was no chip to delete, only a
// Figma affordance not to build.)

import { ArrowRight } from "lucide-react";
import {
  reviewDueState,
  STAGE_LABEL,
  type CareCadence,
  type CarePresentation,
  type PresentationRef,
} from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-4";
const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** Clinical dates read in full — see the module note on the suspended
 *  elapsed-time standard. */
export const clinicalDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Statement at display weight, code beneath at a smaller size. The plain
 *  statement leads because a code is not readable by the mentor who reads this
 *  page most often. */
function Statement({
  value,
  size = "display",
}: {
  value: PresentationRef;
  size?: "display" | "compact";
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "font-display font-bold text-[var(--text-primary)]",
          size === "display"
            ? "text-[22px] leading-[28px]"
            : "text-[15px] leading-[20px]"
        )}
      >
        {value.statement}
      </p>
      <p
        className={cn(
          "mt-0.5 tabular-nums text-[var(--text-secondary)]",
          size === "display" ? "text-[14px] leading-[20px]" : "text-[13px] leading-[18px]"
        )}
      >
        {value.code}
      </p>
    </div>
  );
}

/** The resting spine. `onChange` is passed ONLY for the supervisor tier — the
 *  prop being absent is how the affordance is absent, rather than a `disabled`
 *  flag that would render a control a mentor cannot use. */
export function PresentationCard({
  presentation,
  onChange,
}: {
  presentation: CarePresentation | null;
  onChange?: () => void;
}) {
  return (
    <section aria-label="Primary presentation" data-record-section="care-presentation">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        {/* TODO-COPY */}
        <h2 className={H2}>Primary presentation</h2>
        {onChange && presentation && (
          // A quiet text action, never a filled button: the filled one on this
          // page is Approve inside the action slot, and a diagnosis change is
          // deliberate rather than inviting.
          <button
            type="button"
            onClick={onChange}
            className={cn(
              "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
              RING
            )}
          >
            {/* TODO-COPY */}
            Change
          </button>
        )}
      </div>

      <div className={`mt-3 ${CARD}`}>
        {presentation ? (
          <>
            <Statement value={presentation} />
            {/* Provenance, always. Assigned-by and the review date are the two
                facts a reader needs to know how much weight this carries. */}
            <p className="mt-3 text-[13px] leading-[18px] text-[var(--text-muted)]">
              {/* TODO-COPY */}
              {`Assigned ${clinicalDate(presentation.assignedAt)} by ${presentation.assignedBy}${
                presentation.reviewedAt
                  ? ` · reviewed ${clinicalDate(presentation.reviewedAt)}`
                  : " · not yet reviewed"
              }`}
            </p>
          </>
        ) : (
          <p className="text-[15px] leading-[20px] text-[var(--text-muted)]">
            {/* TODO-COPY — an empty state, never an em dash. */}
            Not yet assigned. A presentation is set once the first survey is
            reviewed.
          </p>
        )}
      </div>
    </section>
  );
}

/** REVIEW-PENDING MODE. The same facts, demoted under the action slot and
 *  reframed as the comparison reference: what is on record, and what is being
 *  recommended in its place. */
export function PresentationReference({
  presentation,
  recommended,
}: {
  presentation: CarePresentation | null;
  recommended: PresentationRef;
}) {
  const unchanged = presentation?.code === recommended.code;
  return (
    <section
      aria-label="Primary presentation"
      data-record-section="care-presentation"
    >
      {/* TODO-COPY */}
      <h2 className={H2}>Primary presentation</h2>
      <div className={`mt-3 ${CARD}`}>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4 sm:flex-nowrap">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[var(--text-muted)]" style={LABEL_STYLE}>
              {/* TODO-COPY */}
              On record
            </p>
            {presentation ? (
              <Statement value={presentation} size="compact" />
            ) : (
              <p className="text-[15px] leading-[20px] text-[var(--text-muted)]">
                {/* TODO-COPY */}
                Not yet assigned
              </p>
            )}
          </div>
          <ArrowRight
            className="mt-6 hidden size-4 shrink-0 text-[var(--text-muted)] sm:block"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[var(--text-muted)]" style={LABEL_STYLE}>
              {/* TODO-COPY */}
              Recommended
            </p>
            <Statement value={recommended} size="compact" />
          </div>
        </div>
        {presentation && (
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-3 text-[13px] leading-[18px] text-[var(--text-muted)]">
            {/* TODO-COPY */}
            {`On record since ${clinicalDate(presentation.assignedAt)}, assigned by ${presentation.assignedBy}.${
              unchanged ? " The recommendation keeps it." : ""
            }`}
          </p>
        )}
      </div>
    </section>
  );
}

/** One cadence row. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5">
      <span className="text-[var(--text-muted)]" style={LABEL_STYLE}>
        {label}
      </span>
      <span className="text-right text-[15px] leading-[20px] text-[var(--text-primary)]">
        {children}
      </span>
    </div>
  );
}

/** CADENCE — the page's heartbeat. Next review due is an addition beyond the
 *  PRD: the schedule runs intake → day 30 → every 90 days, and a reader must
 *  never have to compute where a teen sits in it. Both the date and the
 *  countdown render, and the countdown carries the warning family once it is
 *  inside the window or past it. */
export function CadenceCard({
  cadence,
  now,
  onAssignSurvey,
}: {
  cadence: CareCadence;
  now: number;
  /** Supervisor tier only, and only before a survey exists. Passing nothing is
   *  how the affordance is ABSENT — there is no disabled twin. */
  onAssignSurvey?: () => void;
}) {
  const due = cadence.nextReviewDue
    ? reviewDueState(cadence.nextReviewDue, now)
    : null;

  return (
    <section aria-label="Cadence" data-record-section="care-cadence">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        {/* TODO-COPY */}
        <h2 className={H2}>Cadence</h2>
        {onAssignSurvey && (
          <button
            type="button"
            onClick={onAssignSurvey}
            className={cn(
              "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
              RING
            )}
          >
            {/* TODO-COPY */}
            Assign first survey
          </button>
        )}
      </div>
      <div
        className={`mt-3 ${CARD} [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]`}
      >
        {/* TODO-COPY */}
        <Row label="Assigned survey">
          {cadence.assignedSurvey ? (
            <>
              {cadence.assignedSurvey}
              {cadence.surveyLockedAt && (
                <span className="block text-[13px] leading-[18px] text-[var(--text-muted)]">
                  {/* TODO-COPY — locked at first completion, so the scores stay
                      comparable; this is why it reads as a fact, not a choice. */}
                  {`Locked ${clinicalDate(cadence.surveyLockedAt)}`}
                </span>
              )}
            </>
          ) : cadence.outstandingSurvey ? (
            // WAITING ON THE TEEN, not unassigned. "Not yet assigned" on a record
            // whose survey went out four days ago reads as staff inaction, and
            // sends a supervisor to assign a second one.
            <>
              {cadence.outstandingSurvey.instrument}
              <span className="block text-[13px] leading-[18px] text-[var(--text-muted)]">
                {/* TODO-COPY. The send date is a date of record; how long it has
                    been waiting is a distance, so it keeps the elapsed form. */}
                {`Sent ${clinicalDate(cadence.outstandingSurvey.sentAt)} · not returned yet`}
              </span>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">Not yet assigned</span>
          )}
        </Row>

        <Row label="Last assessment">
          {cadence.lastAssessment ? (
            <>
              {`${cadence.lastAssessment.score} — ${cadence.lastAssessment.severity}`}
              <span className="block text-[13px] leading-[18px] text-[var(--text-muted)]">
                {`${cadence.lastAssessment.instrument} · ${clinicalDate(cadence.lastAssessment.at)}`}
              </span>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">None yet</span>
          )}
        </Row>

        <Row label="Next review">
          {cadence.nextReviewDue && due ? (
            <>
              {clinicalDate(cadence.nextReviewDue)}
              {/* The countdown, in the warning family once it matters. Colour
                  never carries it alone — the words say "overdue". */}
              <span
                className={cn(
                  "block text-[13px] leading-[18px]",
                  due.tone === "warning"
                    ? "font-semibold text-[var(--alert-warning-fg)]"
                    : "text-[var(--text-muted)]"
                )}
              >
                {`${due.label} · ${STAGE_LABEL[cadence.stage]}`}
              </span>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">
              {/* TODO-COPY. Two different reasons for no date, and they must not
                  share a sentence: a closed record has usually had surveys, so
                  "starts at the first survey" would contradict the history
                  printed right below it. */}
              {cadence.reviewClock === "closed"
                ? "No review scheduled — this mentorship ended"
                : "Starts at the first survey"}
            </span>
          )}
        </Row>
      </div>
    </section>
  );
}

/** The paired lockup: spine + cadence side by side in resting mode. */
export function PresentationSpine({
  presentation,
  cadence,
  now,
  onChange,
  onAssignSurvey,
}: {
  presentation: CarePresentation | null;
  cadence: CareCadence;
  now: number;
  onChange?: () => void;
  onAssignSurvey?: () => void;
}) {
  return (
    // Splits at xl, not md: the rail claims 296px from lg up, so at 1024 a
    // md:grid-cols-2 pair left ~290px per card and wrapped a clinical statement
    // across three lines. Stacked full-width below xl reads better than two
    // cramped columns.
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <PresentationCard presentation={presentation} onChange={onChange} />
      <CadenceCard cadence={cadence} now={now} onAssignSurvey={onAssignSurvey} />
    </div>
  );
}
