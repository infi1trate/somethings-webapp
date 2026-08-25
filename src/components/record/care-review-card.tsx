"use client";

// PRESENTATION REVIEW CARD (Prompt B Phase 2) — ONE surface, sectioned by
// hairlines and vertical rhythm. Replaces the old action slot, which was a
// tinted box containing FIVE nested white panels: recommendation, rationale,
// survey, provider note, and a card per survey inside the aggregate disclosure.
// Containers inside containers, and the nesting was doing the sectioning that
// typography and a hairline do here.
//
// ROUTINE TONE ON THE SHARED LABEL BAND (task-card.tsx). The band carries NO
// fill for a review — a scheduled cadence review is ordinary work — while the
// escalation and risk-flag cards tint theirs. Same anatomy, different
// temperature, and the action sits in the same place on all three.
//
// SECTION ORDER: band ("Review due · 90-day review" + Approve top right) →
// recommendation + code → AI rationale (30/90-day only) → survey evidence,
// collapsed to one line → provider note. Hairlines between, no nested cards.
//
// SHORT ENOUGH THAT THE NOTE AND THE BUTTON SHARE A SCREEN. That was the point
// of moving Approve into the band: with the button at the top and the note as
// the last body section, a supervisor no longer scrolls past their own reasoning
// to reach the commit. The helper text stating the requirement rides under the
// button, so it is read before the reach rather than found after the click.
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

import { useRef, useState } from "react";
import { ChevronRight, MoreHorizontal, Sparkles } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskCard } from "@/components/record/task-card";
import {
  DecisionNote,
  gateHelp,
  noteReady as isNoteReady,
} from "@/components/record/decision-footer";
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
const SECTION = "mt-4 border-t border-[var(--border-subtle)] pt-4";

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
  const noteReady = isNoteReady(note);
  const overflowTrigger = useRef<HTMLButtonElement | null>(null);
  // One flag for the whole acting half of the card.
  const canAct = !!onApprove;

  const outcome: CareReviewDecision["outcome"] =
    currentCode === null
      ? "presentation_assigned"
      : currentCode === review.recommended.code
        ? "presentation_reviewed"
        : "presentation_changed";

  return (
    <TaskCard
      tone="routine"
      section="care-review-card"
      ariaLabel="Presentation review"
      /* TODO-COPY */
      type="Review due"
      meta={STAGE_LABEL[review.stage]}
      actions={
        canAct && (
          <>
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
              className="h-9 px-5 text-[14px]"
            >
              {/* TODO-COPY */}
              Approve
            </PillButton>
            {/* CHANGE IS A SECONDARY ACTION, in the overflow — one primary per
                region, and changing a minor's diagnosis is not the thing to
                make easiest. It opens the same DSM-5 modal the care summary's
                "Change presentation" does. */}
            {onChangeRequest && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={overflowTrigger}
                    type="button"
                    /* TODO-COPY */
                    aria-label="More review actions"
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-contour)] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                      RING
                    )}
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                {/* preventFocusRestore: opening a dialog from a menu item
                    otherwise loses the focus trap, because the menu returns
                    focus to its trigger AFTER the dialog mounts. */}
                <DropdownMenuContent
                  align="end"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <DropdownMenuItem onSelect={() => onChangeRequest()}>
                    {/* TODO-COPY */}
                    Change presentation…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )
      }
      actionHelp={canAct ? gateHelp(noteReady, "Approving") : undefined}
      /* PROVENANCE, same slot as the flag cards'. It answers a real question
         rather than restating the band: a supervisor looking at a recommendation
         needs to know whether the SCHEDULE surfaced it or a person proposed it —
         a cadence review and a colleague's proposal deserve different reading.
         TODO-COPY. */
      footer={
        review.rationale.source === "supervisor"
          ? `Proposed by ${actor} · ${actorRole}`
          : "Raised by the care cadence"
      }
    >
      {/* 1 · RECOMMENDATION. ~20px statement, code beneath. */}
      <div>
        <p className="text-[20px] font-normal leading-[26px] tracking-[-0.2px] text-[var(--text-primary)]">
          {review.recommended.statement}
        </p>
        <p className="mt-1 text-[13px] leading-[18px] tabular-nums text-[var(--text-secondary)]">
          {review.recommended.code}
        </p>
      </div>

      {/* 2 · RATIONALE — only where a human or a model actually wrote one.
          A `templated` rationale is the intake mapping restating the score it
          was just handed; it told a supervisor nothing the survey evidence
          below does not already show, while a provenance label gave it a
          clinician's authority. Intake reviews have none, by design. */}
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

      {/* 3 · SURVEY EVIDENCE, one line, expandable. */}
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
            {/* TODO-COPY */}
            <Disclosure label="Surveys in this period">
              <table className="w-full text-left">
                <tbody>
                  {review.aggregate.surveys.map((sv) => (
                    <tr
                      key={sv.at}
                      className="border-t border-[var(--border-subtle)]"
                    >
                      <td className="py-1.5 pr-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                        {clinicalDate(sv.at)}
                      </td>
                      <td className="py-1.5 pr-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                        {sv.instrument}
                      </td>
                      <td className="py-1.5 text-right">
                        <ScoreChip score={sv.score} severity={sv.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Disclosure>
          </>
        )}
      </div>

      {/* 4 · PROVIDER NOTE. The shared gate — same grammar as the flag review
          modal's close note. ABSENT below supervisor tier: a note field with no
          button to enable is furniture. */}
      {canAct && (
        <div className={SECTION}>
          <DecisionNote
            id={`note-${review.id}`}
            /* TODO-COPY */
            label="Provider note"
            value={note}
            onChange={setNote}
            /* TODO-COPY */
            placeholder="What you looked at, and why you are approving this."
          />
        </div>
      )}
    </TaskCard>
  );
}
