"use client";

// ACTION SLOT (MO-9.1 Prompt B, Phase 2) — the top of the Care content column.
//
// GENERIC SHELL, SPECIFIC CONSUMERS. `ActionSlot` knows nothing about
// presentations: it is a tinted surface with a header, a body and a footer. The
// presentation review is its FIRST consumer; treatment-plan review, goal
// check-ins and crisis follow-ups will reuse the shell without touching it.
//
// ONE AT A TIME, PRIORITY-ORDERED. Exactly one consumer renders — CareTab picks
// it, and with a single consumer today that choice is a plain conditional rather
// than a resolver nobody needs yet. Two stacked demands on a page carrying a
// minor's diagnosis is how both get skimmed; when the second consumer lands, the
// priority order goes in CareTab, not in this shell.
//
// NOTHING PENDING RENDERS NOTHING. Absence is the reward state — no "all caught
// up" card, no empty frame. A healthy record is quiet.
//
// SUPERVISOR TIER ONLY, AND ABSENT BELOW IT. Mentors and lead mentors do not get
// an empty version or a disabled version of this slot; the component is never
// mounted for them (see CareTab). A greyed-out Approve would advertise a
// decision they cannot take part in.
//
// NO SHADOW. The Figma exploration's floating white box is the only shadowed
// element on that page and it breaks the surface system — this is card tone plus
// a warm tint and border from the existing semantic family.

import { useState } from "react";
import { AlertCircle, ChevronRight, Sparkles } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { clinicalDate } from "@/components/record/care-presentation";
import {
  RATIONALE_SOURCE_LABEL,
  STAGE_LABEL,
  type AssessmentItem,
  type CareAssessment,
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

// ── The generic shell ───────────────────────────────────────────────────────

export function ActionSlot({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section
      aria-label="Action required"
      data-record-section="care-action-slot"
      // Warm family, not critical: a scheduled review coming due is expected
      // work, not an emergency. Critical stays reserved for escalations.
      //
      // TINT *AND* LEFT ACCENT. The warm --alert-*-bg tokens are built to sit on
      // WHITE cards; measured against the s1 panel this column lives on, the
      // tint alone came out at 1.02:1 — the most important region on the page
      // was separated by a difference nobody can see. The 3px accent edge is the
      // same semantic family and carries the boundary at real contrast, with no
      // shadow involved.
      className="rounded-[var(--radius-elevated)] border border-l-[3px] px-[var(--surface-pad-x)] py-4"
      style={{
        backgroundColor: "var(--alert-warm-bg)",
        borderColor: "var(--alert-warm-border)",
        borderLeftColor: "var(--alert-warm-accent)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle
          className="mt-0.5 size-4 shrink-0"
          style={{ color: "var(--alert-warm-accent)" }}
          aria-hidden
        />
        <h2
          className="font-display text-[15px] font-bold leading-[20px]"
          style={{ color: "var(--alert-warm-fg)" }}
        >
          {title}
        </h2>
      </div>
      <div className="mt-3">{children}</div>
      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}

/** A panel INSIDE the tinted slot. Card tone on the tint keeps the nested
 *  content readable without a shadow doing the separating. */
function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] p-3.5",
        className
      )}
    >
      {children}
    </div>
  );
}

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
                "pb-1 font-medium text-[var(--text-muted)]",
                i === 2 ? "text-right" : "pr-3"
              )}
              style={{ font: "var(--type-field-label)" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
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
              className="py-1 text-right tabular-nums text-[var(--text-primary)]"
              style={{ font: "var(--type-row-label)" }}
            >
              {it.points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A disclosure that reads as disclosure: the chevron LEADS and rotates, and
 *  carries aria-expanded. Never the trailing navigation position. */
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
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

/** One survey's headline: score, severity, instrument, date. */
function SurveyHead({ survey }: { survey: CareAssessment }) {
  return (
    <p className="text-[15px] leading-[20px] text-[var(--text-primary)]">
      {`${survey.score} — ${survey.severity}`}
      <span className="ml-2 text-[13px] text-[var(--text-muted)]">
        {`${survey.instrument} · ${clinicalDate(survey.at)}`}
      </span>
    </p>
  );
}

// ── The presentation-review consumer ────────────────────────────────────────

export function PresentationReviewAction({
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
  /** Opens the DSM-5 search. Selecting there POPULATES this slot's
   *  recommendation — it never commits, so the provider-note gate below still
   *  stands between a chosen code and the record. */
  onChangeRequest: () => void;
  onApprove: (d: Omit<CareReviewDecision, "teenId">) => void;
}) {
  const [note, setNote] = useState("");
  // DELIBERATE FRICTION. The PRD requires rationale on every recommendation and
  // change, so Approve cannot fire without the supervisor's own reasoning. The
  // requirement is stated in helper text BEFORE the reach for the button, not
  // as an error after — a validation message that only appears post-click
  // teaches the rule by punishing it.
  const noteReady = note.trim().length > 0;

  const outcome: CareReviewDecision["outcome"] =
    currentCode === null
      ? "presentation_assigned"
      : currentCode === review.recommended.code
        ? "presentation_reviewed"
        : "presentation_changed";

  return (
    <ActionSlot
      /* TODO-COPY */
      title="New recommended primary presentation"
      footer={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PillButton
            disabled={!noteReady}
            onClick={() =>
              onApprove({
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
              "rounded-sm text-[13px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70",
              RING
            )}
            style={{ color: "var(--alert-warm-fg)" }}
          >
            {/* TODO-COPY */}
            Change
          </button>
        </div>
      }
    >
      {/* Recommendation first: statement, then code. */}
      <Panel>
        <p className="font-display text-[17px] font-bold leading-[24px] text-[var(--text-primary)]">
          {review.recommended.statement}
        </p>
        <p className="mt-0.5 text-[13px] leading-[18px] tabular-nums text-[var(--text-secondary)]">
          {`${review.recommended.code} · ${STAGE_LABEL[review.stage]}`}
        </p>
      </Panel>

      {/* RATIONALE WITH MANDATORY PROVENANCE. The label states which kind this
          is, plainly, ABOVE the text — rationale never renders as unattributed
          prose on a page carrying a minor's diagnosis. */}
      <Panel className="mt-2.5">
        <p
          className="flex items-center gap-1.5 text-[var(--text-muted)]"
          style={LABEL_STYLE}
        >
          {review.rationale.source === "ai" && (
            <Sparkles className="size-3" aria-hidden />
          )}
          {RATIONALE_SOURCE_LABEL[review.rationale.source]}
        </p>
        <p className="mt-1.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
          {review.rationale.text}
        </p>
      </Panel>

      {/* SURVEY DATA. Intake and day 30 show the most recent survey; from day 90
          it is a recency-weighted aggregate whose expansion puts the surveys in
          the period side by side. */}
      <Panel className="mt-2.5">
        <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
          {/* TODO-COPY */}
          {review.aggregate ? "Weighted across this period" : "Most recent survey"}
        </p>
        {review.survey && (
          <>
            <div className="mt-1.5">
              <SurveyHead survey={review.survey} />
            </div>
            {/* TODO-COPY */}
            <Disclosure label="Question by question">
              <ItemTable items={review.survey.items} />
            </Disclosure>
          </>
        )}
        {review.aggregate && (
          <>
            <p className="mt-1.5 text-[15px] leading-[20px] text-[var(--text-primary)]">
              {`${review.aggregate.score} — ${review.aggregate.severity}`}
              <span className="ml-2 text-[13px] text-[var(--text-muted)]">
                {`${review.aggregate.surveys.length} surveys`}
              </span>
            </p>
            {/* TODO-COPY */}
            <Disclosure label="Compare the surveys in this period">
              <div className="grid gap-2.5 sm:grid-cols-3">
                {review.aggregate.surveys.map((s) => (
                  <div
                    key={s.at}
                    className="rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] p-2.5"
                  >
                    <p className="text-[13px] leading-[18px] text-[var(--text-muted)]">
                      {clinicalDate(s.at)}
                    </p>
                    <p className="mt-0.5 text-[15px] leading-[20px] text-[var(--text-primary)]">
                      {`${s.score} — ${s.severity}`}
                    </p>
                  </div>
                ))}
              </div>
            </Disclosure>
          </>
        )}
      </Panel>

      {/* PROVIDER NOTE — required. On a PANEL, not directly on the tint: in dark
          mode --text-muted over the warm tint measured 4.22:1, and the line that
          states the requirement is the last one that may be hard to read. */}
      <Panel className="mt-2.5">
        <label
          htmlFor={`note-${review.id}`}
          className="block text-[var(--text-muted)]"
          style={LABEL_STYLE}
        >
          {/* TODO-COPY */}
          Provider note
        </label>
        <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-muted)]">
          {/* TODO-COPY — the requirement, stated before the reach. */}
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
            "mt-2 block w-full resize-y rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5",
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
      </Panel>
    </ActionSlot>
  );
}
