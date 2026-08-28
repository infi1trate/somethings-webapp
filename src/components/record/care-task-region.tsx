"use client";

// CARE'S "ACTION REQUIRED" — now the presentation review, and nothing else.
//
// WHAT MOVED AND WHY. This region used to hold escalations and risk flags
// alongside the review. They have gone to Overview, because they are RECORD-LEVEL
// work rather than clinical-presentation work: an escalation is about a
// conversation and a safety concern, not about which code a teen is carried
// under. Keeping them here meant the Care tab was the only place a supervisor
// could see them, on a tab whose subject is the presentation — and it meant
// Overview, the profile-level index, could show a record as quiet while a
// three-day-old escalation sat one tab over.
//
// WHAT STAYED. Escalation and risk-flag HISTORY is untouched: resolved flags,
// their outcomes and their elapsed-to-resolution still render in Care's History
// table exactly as before. Only the open-task cards moved. A supervisor reading
// the clinical picture still sees that this teen had an abuse disclosure escalated
// in June and how it closed — that is clinical context and belongs here.
//
// SAME SECTION NAME, SCOPED PER TAB. "Action required" on Care means "things to
// do here"; on Overview it means the same thing about the whole record. The
// heading component is shared (task-section.tsx) rather than copied, so the two
// cannot drift into a dialect each.
//
// THE COMPONENT IS NOW THIN ON PURPOSE. It exists so the Care tab keeps one named
// seam for "the work on this tab" — when a second Care-homed task lands (an
// unassigned presentation is the obvious next one), it goes in the list here
// rather than growing new JSX in care-tab.tsx.

import { PresentationReviewCard } from "@/components/record/care-review-card";
import { ActionRequiredSection } from "@/components/record/task-section";
import type { PresentationReview } from "@/lib/record/care-demo";

// ── The task union ──────────────────────────────────────────────────────────
// Still a union with one member. Deliberately not collapsed to a bare
// `review | null`: the list shape is what made adding the second task type a
// data change rather than a JSX change, and it will be needed again.

export type CareTask = { kind: "presentation_review"; review: PresentationReview };

/** Every open task whose contextual home is CARE.
 *
 *  FLAGS ARE NO LONGER READ HERE. `openFlagsFor` is not called and the store
 *  slice is not consulted for closures — the Overview regions own that entirely
 *  (see record-alerts.ts), so there is exactly one code path that turns an open
 *  flag into a card and no possibility of both tabs rendering one. */
export function careTasksFor(review: PresentationReview | null): CareTask[] {
  return review ? [{ kind: "presentation_review", review }] : [];
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
  // NO REVIEW DUE RENDERS NOTHING — heading included. Handled by the shared
  // section, which returns null at zero.
  return (
    <ActionRequiredSection count={tasks.length}>
      {tasks.map((t) => (
        <PresentationReviewCard
          key={t.review.id}
          review={t.review}
          {...reviewProps}
        />
      ))}
    </ActionRequiredSection>
  );
}
