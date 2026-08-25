"use client";

// PRESENTATION REVIEW CARD (Prompt B Phase 2) — ONE surface, sectioned by
// hairlines and vertical rhythm. Replaces the old action slot, which was a
// tinted box containing FIVE nested white panels: recommendation, rationale,
// survey, provider note, and a card per survey inside the aggregate disclosure.
// Containers inside containers, and the nesting was doing the sectioning that
// typography and a hairline do here.
//
// ROUTINE TIER. Plain card tone, contour hairline, no tinted fill, no left
// accent bar, no warning icon. A scheduled cadence review is ordinary work; the
// old slot dressed it as an alert. Prominence comes from position, scale, and a
// single saturated EYEBROW line — a mark, not a wash.
//
// SECTION ORDER, top to bottom: eyebrow → recommendation → rationale → survey
// evidence → provider note → actions. Hairlines between, generous rhythm.
//
// PROVENANCE IS NEVER OPTIONAL. The rationale carries a label saying which kind
// it is, muted and small, ABOVE prose that reads as body text. Unattributed
// clinical prose on a minor's record is the thing this label exists to prevent.
//
// THE "mentorship signal" IN THE AI LABEL IS FORWARD-LOOKING BY DECISION. Nothing
// in this codebase computes a mentorship signal, and the AI summary's own
// provenance line was narrowed for exactly that reason. The user's call was to
// keep this label verbatim because the signal is coming — so this is a known,
// accepted overstatement, not an oversight. Do not "fix" it; see
// RATIONALE_SOURCE_LABEL.

import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { clinicalDate } from "@/components/record/care-presentation";
import { ScoreChip } from "@/components/record/score-chip";
import {
  RATIONALE_SOURCE_LABEL,
  STAGE_LABEL,
  type AssessmentItem,
  type CareReviewDecision,
  type PresentationReview,
} from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;
/** The hairline that does the sectioning a nested card used to do. */
const SECTION = "mt-5 border-t border-[var(--border-subtle)] pt-5";

/** The three-column breakdown, as a LOOSE table: no borders, no header fill, no
 *  surrounding card. Hairlines between rows only. */
function ItemTable({ items }: { items: AssessmentItem[] }) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr>
          {/* TODO-COPY */}
          {["Question", "Answer", "Points"].map((h, i) => (
            <th
              key={h}
              className={cn(
                "pb-1.5 font-medium text-[var(--text-muted)]",
                i === 2 ? "text-right" : "pr-3"
              )}
              style={LABEL_STYLE}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr
            key={it.question}
            className="border-t border-[var(--border-subtle)] align-top"
          >
            <td className="py-1.5 pr-3 text-[14px] leading-[20px] text-[var(--text-primary)]">
              {it.question}
            </td>
            <td className="py-1.5 pr-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
              {it.answer}
            </td>
            <td className="py-1.5 text-right text-[14px] leading-[20px] tabular-nums text-[var(--text-primary)]">
              {it.points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A disclosure that reads as one: the chevron LEADS and rotates, and carries
 *  aria-expanded. Never the trailing navigation position. */
function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-70",
          RING
        )}
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
          aria-hidden
        />
        {label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function PresentationReviewCard({
  review,
  currentCode,
  actor,
  actorRole,
  onChangeRequest,
  onApprove,
}: {
  review: PresentationReview;
  /** The code on record, so approving can name what it replaced. */
  currentCode: string | null;
  /** The deciding supervisor's name + tier — the appended entry's author. */
  actor: string;
  actorRole: string;
  /** Opens the DSM-5 search. Selecting there POPULATES this card's
   *  recommendation — it never commits, so the provider-note gate below still
   *  stands between a chosen code and the record.
   *
   *  BOTH ARE OPTIONAL, and that is the whole tier gate. Read-wide, act-narrow:
   *  mentors and lead mentors READ this card — the recommendation, the
   *  provenance-labelled rationale and the survey evidence — and simply are not
   *  handed the callbacks, so the provider note and the action row do not render
   *  at all. There is no disabled Approve: a greyed-out button advertises a
   *  decision they cannot take part in. */
  onChangeRequest?: () => void;
  onApprove?: (d: Omit<CareReviewDecision, "teenId">) => void;
}) {
  const [note, setNote] = useState("");
  // DELIBERATE FRICTION. The PRD requires rationale on every recommendation and
  // change, so Approve cannot fire without the supervisor's own reasoning. The
  // requirement is stated in helper text BEFORE the reach for the button, never
  // as an error after — a validation message that only appears post-click
  // teaches the rule by punishing it.
  const noteReady = note.trim().length > 0;
  // One flag for the whole acting half of the card.
  const canAct = !!onApprove;

  const outcome: CareReviewDecision["outcome"] =
    currentCode === null
      ? "presentation_assigned"
      : currentCode === review.recommended.code
        ? "presentation_reviewed"
        : "presentation_changed";

  return (
    <section
      aria-label="Presentation review"
      data-record-section="care-review-card"
      className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-4"
    >
      {/* 1 · EYEBROW. The whole of this card's colour, and it is a mark rather
          than a wash: type and stage, saturated, small, sentence case. */}
      <p
        className="flex flex-wrap items-center gap-x-1.5 font-semibold"
        style={{ ...LABEL_STYLE, color: "var(--alert-warm-fg)" }}
      >
        {/* TODO-COPY */}
        Review due
        <span aria-hidden>·</span>
        {STAGE_LABEL[review.stage]}
      </p>

      {/* 2 · RECOMMENDATION. Statement at heading weight; code and stage under. */}
      <div className="mt-2.5">
        <p className="font-display text-[19px] font-bold leading-[26px] text-[var(--text-primary)]">
          {review.recommended.statement}
        </p>
        <p className="mt-0.5 text-[13px] leading-[18px] tabular-nums text-[var(--text-secondary)]">
          {`${review.recommended.code} · ${STAGE_LABEL[review.stage]}`}
        </p>
      </div>

      {/* 3 · RATIONALE — ONLY WHEN A HUMAN OR A MODEL ACTUALLY WROTE ONE.
          A `templated` rationale is machine exhaust: the intake mapping
          restating the score it was just handed ("The intake GAD-7 scored 7 in
          the mild band. The mapping returns Generalized anxiety disorder for
          that profile.") tells a supervisor nothing the survey-evidence section
          below does not already show, and dressing it in a provenance label
          gave it the same authority as a clinician's reasoning. Intake reviews
          have no rationale, by design.
          KEPT for `ai` (a genuine model-produced clinical rationale, 30- and
          90-day reviews) and for `supervisor` (a human's own reasoning) — both
          with their provenance label, because unattributed clinical prose is
          the thing that label exists to prevent. */}
      {review.rationale.source !== "templated" && (
      <div className={SECTION}>
        <p
          className="flex items-center gap-1.5 text-[var(--text-muted)]"
          style={LABEL_STYLE}
        >
          {review.rationale.source === "ai" && (
            <Sparkles className="size-3" aria-hidden />
          )}
          {RATIONALE_SOURCE_LABEL[review.rationale.source]}
        </p>
        <p className="mt-1.5 max-w-prose text-[14px] leading-[20px] text-[var(--text-primary)]">
          {review.rationale.text}
        </p>
      </div>
      )}

      {/* 4 · SURVEY EVIDENCE, collapsed by default. One line: score chip,
          instrument, date. */}
      <div className={SECTION}>
        <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
          {/* TODO-COPY */}
          {review.aggregate ? "Weighted across this period" : "Most recent survey"}
        </p>

        {review.survey && (
          <>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <ScoreChip
                score={review.survey.score}
                severity={review.survey.severity}
              />
              <span className="text-[13px] leading-[18px] text-[var(--text-muted)]">
                {`${review.survey.instrument} · ${clinicalDate(review.survey.at)}`}
              </span>
            </p>
            {/* TODO-COPY */}
            <Disclosure label="Question by question">
              <ItemTable items={review.survey.items} />
            </Disclosure>
          </>
        )}

        {review.aggregate && (
          <>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <ScoreChip
                score={review.aggregate.score}
                severity={review.aggregate.severity}
              />
              <span className="text-[13px] leading-[18px] text-[var(--text-muted)]">
                {/* TODO-COPY — recency-weighted, so the newest survey carries
                    most of the score; saying so stops a reader reconciling it
                    against a flat mean and finding a discrepancy. */}
                {`recency-weighted across ${review.aggregate.surveys.length} surveys`}
              </span>
            </p>
            {/* TODO-COPY. The contributing surveys, listed — a loose table, no
                card per survey (the old slot had one each). */}
            <Disclosure label="Surveys in this period">
              <table className="w-full text-left">
                <tbody>
                  {review.aggregate.surveys.map((s) => (
                    <tr
                      key={s.at}
                      className="border-t border-[var(--border-subtle)]"
                    >
                      <td className="py-1.5 pr-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                        {clinicalDate(s.at)}
                      </td>
                      <td className="py-1.5 pr-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                        {s.instrument}
                      </td>
                      <td className="py-1.5 text-right">
                        <ScoreChip score={s.score} severity={s.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Disclosure>
          </>
        )}
      </div>

      {/* 5 · PROVIDER NOTE. Required, and the requirement is stated before the
          reader reaches for the button. ABSENT below supervisor tier — a note
          field with no button to enable is furniture. */}
      {canAct && (
      <div className={SECTION}>
        <label
          htmlFor={`note-${review.id}`}
          className="block text-[var(--text-muted)]"
          style={LABEL_STYLE}
        >
          {/* TODO-COPY */}
          Provider note
        </label>
        <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-muted)]">
          {/* TODO-COPY — the requirement AND the permanence, stated up front. */}
          Required. Your reasoning is recorded with this decision and cannot be
          edited afterwards.
        </p>
        <textarea
          id={`note-${review.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          aria-describedby={`note-help-${review.id}`}
          className={cn(
            "mt-2 block w-full max-w-prose resize-y rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5",
            "text-[14px] leading-[20px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            RING
          )}
          /* TODO-COPY */
          placeholder="What you looked at, and why you are approving this."
        />
        <p
          id={`note-help-${review.id}`}
          className="mt-1.5 text-[13px] leading-[18px] text-[var(--text-muted)]"
        >
          {/* TODO-COPY */}
          {noteReady
            ? "Approving appends this to the record."
            : "Add a note to enable Approve."}
        </p>
      </div>
      )}

      {/* 6 · ACTIONS. Approve is the page's ONE filled button; Change is a text
          action beside it, and it is not a dead link — it opens the DSM-5 flow,
          which returns here with a new recommendation and the same note gate. */}
      {canAct && (
      <div className={cn(SECTION, "flex flex-wrap items-center gap-x-4 gap-y-2")}>
        <PillButton
          disabled={!noteReady}
          onClick={() =>
            onApprove?.({
              reviewId: review.id,
              decidedAt: Date.now(),
              note: note.trim(),
              outcome,
              code: review.recommended.code,
              statement: review.recommended.statement,
              actor,
              actorRole,
              previousCode: currentCode ?? undefined,
            })
          }
        >
          {/* TODO-COPY */}
          Approve
        </PillButton>
        <button
          type="button"
          onClick={onChangeRequest}
          className={cn(
            "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
            RING
          )}
        >
          {/* TODO-COPY */}
          Change
        </button>
      </div>
      )}
    </section>
  );
}
