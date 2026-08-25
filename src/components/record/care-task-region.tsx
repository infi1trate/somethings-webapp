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
// ONE ANATOMY, THREE TONES — the label band (see task-card.tsx). Every task is
// the same card; only the band changes temperature. This replaces the previous
// split, where a flag was a whole-card tint plus a 3px left-edge accent bar and a
// review was an untinted card with a coloured eyebrow: two anatomies for two
// things a supervisor works the same way, and the flag half broke rule 3 twice.
//
// The old accent bar had a real justification — measured, the alert tints sat
// near 1:1 against the surface behind this column, so the bar was carrying the
// boundary a tint could not. The band solves that differently and better: it is
// closed by a hairline, so the boundary is structural rather than chromatic, and
// the tint only has to be perceptible rather than load-bearing.
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

import { PresentationReviewCard } from "@/components/record/care-review-card";
import { ChatAction } from "@/components/admin/chat-action";
import {
  CategoryChip,
  TaskCard,
  type TaskTone,
} from "@/components/record/task-card";
import { RecordButton } from "@/components/record/record-button";
import { clinicalDate } from "@/components/record/care-presentation";
import {
  openFlagsFor,
  type CareStoreSlice,
  type PresentationReview,
} from "@/lib/record/care-demo";
import {
  categoryLabel,
  type CareFlagRecord,
} from "@/lib/record/people-demo";

/** FEATURE CHECK (Prompt B Phase 1). The escalation / risk-flag card is a STUB:
 *  it reports the flag and its state and offers no way to resolve one, because
 *  the resolution workflow is explicitly fast-follow. Flip this to false to take
 *  the whole exception tier off the page in one line if the stub reads as a
 *  promise the product cannot yet keep. */
const SHOW_FLAG_TASKS = true;

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
  review: PresentationReview | null,
  store: CareStoreSlice = {}
): CareTask[] {
  const tasks: CareTask[] = [];
  if (SHOW_FLAG_TASKS) {
    // Closures come from the store, so a flag closed in-session leaves the
    // region immediately — the whole reward of finishing the work.
    for (const flag of openFlagsFor(teenId, store))
      tasks.push({ kind: "flag", flag });
  }
  if (review) tasks.push({ kind: "presentation_review", review });
  return tasks;
}

// ── Flag tasks ──────────────────────────────────────────────────────────────

/** TODO-COPY. Names the KIND, not the severity — a reader does not need to be
 *  told that an escalation is serious. */
const KIND_LABEL = {
  escalation: "Escalation",
  risk_flag: "Risk flag",
} as const;


/** An open flag. Reports the concern, its categories and where the discussion
 *  is; the decision itself happens in the review modal, because reviewing a
 *  conversation cannot happen inline.
 *
 *  `onReview` absent = read tier. Mentors and lead mentors see the whole card —
 *  a mentor who raised an escalation needs to see it is still open — and get no
 *  action, never a disabled one. */
function FlagTask({
  flag,
  teenName,
  now,
  onReview,
}: {
  flag: CareFlagRecord;
  teenName: string;
  /** Fixed at the page's mount. Calling Date.now() in render is impure and the
   *  lint rule is right to reject it — a re-render would silently move every
   *  date on the card. */
  now: number;
  onReview?: (flag: CareFlagRecord, trigger: HTMLElement) => void;
}) {
  const tone: TaskTone = flag.severity === "critical" ? "critical" : "warning";
  const cats = flag.categories ?? [];
  const at = now - flag.daysAgo * 86_400_000;

  return (
    <TaskCard
      tone={tone}
      section="care-task-flag"
      ariaLabel={`${KIND_LABEL[flag.kind]} — open`}
      type={KIND_LABEL[flag.kind]}
      /* TODO-COPY. "Crisis" is the ONLY extra chrome a crisis elevation gets —
         the word does the work, per the brief. */
      meta={flag.crisis ? "Open · Crisis" : "Open"}
      actions={
        onReview && (
          <RecordButton onClick={(e) => onReview(flag, e.currentTarget)}>
            {/* TODO-COPY — the ellipsis says a modal opens. */}
            Review…
          </RecordButton>
        )
      }
      footer={
        flag.source === "system"
          ? /* TODO-COPY */ `System-detected from chat · ${clinicalDate(at)}`
          : /* TODO-COPY */ `Raised by ${flag.raisedBy} · ${flag.raisedByRole} · ${clinicalDate(at)}`
      }
    >
      {/* THE CONCERN, in plain language. Never message content. */}
      <p className="text-[15px] leading-[22px] text-[var(--text-primary)]">
        {flag.reason}
      </p>

      {cats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {/* MAPPED display names only. An unknown value renders
              "Uncategorised" — never the raw constant. */}
          {cats.map((c) => (
            <CategoryChip key={c} label={categoryLabel(c)} />
          ))}
        </div>
      )}

      {/* THE SHARED TERTIARY, not a text link. A card body has no column header
          to lean on, so the affordance needs a button's shape — and reusing the
          directory's tertiary means the two cannot drift. Left-aligned beneath
          the concern and the category chips. */}
      <div className="mt-3 -ml-3">
        <ChatAction
          personId={flag.conversationWith ?? ""}
          name={teenName}
          /* TODO-COPY */
          label="Open chat"
        />
      </div>
    </TaskCard>
  );
}

// ── The region ──────────────────────────────────────────────────────────────

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";

export function CareTaskRegion({
  tasks,
  teenName,
  now,
  onReviewFlag,
  reviewProps,
}: {
  tasks: CareTask[];
  now: number;
  /** For the discussion link's label — named, so the link says who. */
  teenName: string;
  /** Supervisor tier only; absent below. Takes the trigger element so the modal
   *  can hand focus back to the button that opened it. */
  onReviewFlag?: (flag: CareFlagRecord, trigger: HTMLElement) => void;
  /** Everything the review card needs beyond the review itself. Passed as one
   *  object so adding a second acting consumer later does not reshape this
   *  component's signature. */
  reviewProps: Omit<
    React.ComponentProps<typeof PresentationReviewCard>,
    "review"
  >;
}) {
  // NOTHING OPEN RENDERS NOTHING — the header included. A section heading over
  // an empty stack is the "all caught up" card by another name.
  if (tasks.length === 0) return null;

  return (
    <section
      aria-label="Action required"
      data-record-section="care-task-region"
    >
      {/* A REAL SECTION HEADER, on the same rhythm as Care summary / Care update
          / History — the region used to float above the page with no heading of
          its own, so a stack of task cards read as chrome rather than as a
          section a reader could name. The count is part of the heading because
          "two things need you" is the first thing worth knowing. */}
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        {/* TODO-COPY */}
        <h2 className={H2}>{`Action required · ${tasks.length}`}</h2>
        {/* RESERVED SLOT for a future "View all in Tasks" link. Deliberately
            empty: the Tasks page does not exist yet (its route falls through the
            unbuilt-section placeholder), and a link to a placeholder reads as a
            broken promise. The slot exists so adding it later is one line and
            does not re-flow the header. */}
        <span />
      </div>

      <div className="mt-3 space-y-4">
      {tasks.map((t) =>
        t.kind === "flag" ? (
          <FlagTask
            key={t.flag.id}
            flag={t.flag}
            teenName={teenName}
            now={now}
            onReview={onReviewFlag}
          />
        ) : (
          <PresentationReviewCard
            key={t.review.id}
            review={t.review}
            {...reviewProps}
          />
        )
      )}
      </div>
    </section>
  );
}
