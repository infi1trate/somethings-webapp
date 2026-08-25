"use client";

// CARE TASK REGION (Prompt B Phase 1) — zero or more open tasks, second in the
// page order, under the care summary.
//
// WAS A SINGLE SLOT. `ActionSlot` documented "ONE AT A TIME, PRIORITY-ORDERED …
// two stacked demands on a page carrying a minor's diagnosis is how both get
// skimmed". That was the right instinct and the wrong conclusion: escalations,
// risk flags and presentation reviews are all page-level work needing mitigation,
// more than one can be open at once, and they are not necessarily worked
// consecutively. Hiding the second one does not make it not exist — it makes the
// page lie about how much is outstanding. So the region takes a LIST.
//
// ORDER IS SEVERITY DESCENDING: open escalations → open risk flags →
// presentation review. Sorting happens in `careTasksFor` so the ordering rule
// lives with the data rather than in JSX.
//
// NO OPEN TASKS RENDERS NOTHING. Absence is the reward state — no empty frame,
// no "all caught up" card. A healthy record is quiet.
//
// TWO VISUAL TIERS, HONESTLY ASSIGNED. This is the rule the old slot broke.
//
//   ROUTINE (presentation review) — plain card tone, contour hairline. NO tinted
//   fill, NO left accent bar, NO warning icon. A scheduled cadence review is
//   ordinary work; the old slot gave it a warm tint, a 3px accent edge and an
//   AlertCircle, which is alarm chrome on the most predictable event in the
//   product. If routine work looks urgent, real urgency stops reading.
//   Prominence comes from POSITION (second on the page) and SCALE (a heading-
//   weight recommendation), plus a single saturated eyebrow line — a mark, not
//   a wash.
//
//   EXCEPTION (escalations, risk flags) — tinted surface in the critical or
//   warning family per severity, with the state named IN WORDS. This is the ONLY
//   tinted treatment anywhere on the Care page.
//
// The old slot's tint had a real justification — measured, the warm tint alone
// sat at 1.02:1 against the panel behind it, so the accent edge was carrying the
// boundary. That argument still holds for the EXCEPTION tier, which keeps both
// the tint and the accent. It does not license tinting routine work.
//
// READ-WIDE, ACT-NARROW — and read-wide means READ. Every tier sees every task
// here: a mentor who raised an escalation needs to see that it is still open, and
// a lead mentor reading a record needs to know a review is outstanding on it.
// What lower tiers do NOT get is the acting half — the review card's provider
// note and action row are not rendered for them, because the callbacks are not
// passed. Nothing is disabled anywhere.
//
// This is a change: `pendingReviewFor` used to be called only when the viewer
// could act, so lower tiers could not see that a review existed at all. That
// enforced act-narrow by breaking read-wide.

import { AlertCircle } from "lucide-react";
import { PresentationReviewCard } from "@/components/record/care-review-card";
import {
  flagResultLabel,
  openFlagsFor,
  type PresentationReview,
} from "@/lib/record/care-demo";
import type { CareFlagRecord } from "@/lib/record/people-demo";

/** FEATURE CHECK (Prompt B Phase 1). The escalation / risk-flag card is a STUB:
 *  it reports the flag and its state and offers no way to resolve one, because
 *  the resolution workflow is explicitly fast-follow. Flip this to false to take
 *  the whole exception tier off the page in one line if the stub reads as a
 *  promise the product cannot yet keep. */
const SHOW_FLAG_TASKS = true;

const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

// ── The task union ──────────────────────────────────────────────────────────

export type CareTask =
  | { kind: "flag"; flag: CareFlagRecord }
  | { kind: "presentation_review"; review: PresentationReview };

/** Every open task on a teen, in the order the region renders them.
 *
 *  The review sorts LAST regardless of how old it is: an overdue cadence review
 *  is still routine, and a flag raised this morning outranks it. Severity is the
 *  sort key, not recency. */
export function careTasksFor(
  teenId: string,
  review: PresentationReview | null
): CareTask[] {
  const tasks: CareTask[] = [];
  if (SHOW_FLAG_TASKS) {
    for (const flag of openFlagsFor(teenId)) tasks.push({ kind: "flag", flag });
  }
  if (review) tasks.push({ kind: "presentation_review", review });
  return tasks;
}

// ── Exception tier ──────────────────────────────────────────────────────────

const FAMILY = {
  critical: {
    bg: "var(--alert-critical-bg)",
    border: "var(--alert-critical-border)",
    accent: "var(--alert-critical-accent)",
    fg: "var(--alert-critical-fg)",
  },
  warning: {
    bg: "var(--alert-warning-bg)",
    border: "var(--alert-warning-border)",
    accent: "var(--alert-warning-accent)",
    fg: "var(--alert-warning-fg)",
  },
} as const;

/** TODO-COPY. Names the KIND, not the severity — a reader does not need to be
 *  told that an escalation is serious. */
const KIND_LABEL = {
  escalation: "Escalation",
  risk_flag: "Risk flag",
} as const;

/** STUB. Reports the flag; resolves nothing. The resolution workflow is
 *  fast-follow, and a Resolve button that opened nothing would be worse than no
 *  button — so there is none, for every tier. */
function FlagTask({ flag }: { flag: CareFlagRecord }) {
  const f = FAMILY[flag.severity];
  return (
    <section
      aria-label={`${KIND_LABEL[flag.kind]} — open`}
      data-record-section="care-task-flag"
      // TINT *AND* LEFT ACCENT. Measured, the alert tints sit near 1:1 against
      // the surface behind this column, so the tint alone is a boundary nobody
      // can see; the 3px accent is the same semantic family and carries it at
      // real contrast, with no shadow involved.
      className="rounded-[var(--radius-elevated)] border border-l-[3px] px-[var(--surface-pad-x)] py-4"
      style={{
        backgroundColor: f.bg,
        borderColor: f.border,
        borderLeftColor: f.accent,
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* The warning icon belongs HERE and only here. */}
        <AlertCircle
          className="mt-0.5 size-4 shrink-0"
          style={{ color: f.accent }}
          aria-hidden
        />
        <div className="min-w-0">
          <p
            className="flex flex-wrap items-center gap-x-2"
            style={{ ...LABEL_STYLE, color: f.fg }}
          >
            {KIND_LABEL[flag.kind]}
            <span aria-hidden style={{ color: f.accent }}>
              ·
            </span>
            {/* STATE IN WORDS, never colour alone. */}
            <span>{flagResultLabel(flag)}</span>
          </p>
          <p className="mt-1.5 text-[15px] leading-[20px] text-[var(--text-primary)]">
            {flag.reason}
          </p>
          <p className="mt-1.5 text-[13px] leading-[18px] text-[var(--text-muted)]">
            {/* TODO-COPY. Who raised it — the old escalation event said
                "Recorded automatically", which was never true of an escalation. */}
            {`Raised by ${flag.raisedBy} · ${flag.raisedByRole}`}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── The region ──────────────────────────────────────────────────────────────

export function CareTaskRegion({
  tasks,
  reviewProps,
}: {
  tasks: CareTask[];
  /** Everything the review card needs beyond the review itself. Passed as one
   *  object so adding a second acting consumer later does not reshape this
   *  component's signature. */
  reviewProps: Omit<
    React.ComponentProps<typeof PresentationReviewCard>,
    "review"
  >;
}) {
  // NOTHING OPEN RENDERS NOTHING.
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-4" data-record-section="care-task-region">
      {tasks.map((t) =>
        t.kind === "flag" ? (
          <FlagTask key={t.flag.id} flag={t.flag} />
        ) : (
          <PresentationReviewCard
            key={t.review.id}
            review={t.review}
            {...reviewProps}
          />
        )
      )}
    </div>
  );
}
