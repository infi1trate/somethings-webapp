"use client";

// THE OVERVIEW ATTENTION REGIONS — "Action required" then "Worth a look", at the
// top of the Overview content column.
//
// ORDERING INTENT, and why it is this and not something else:
//
//   1. ACTION REQUIRED, first, always. It is the only thing on this page that
//      changes what a reader does next. Anything above it is a delay between
//      opening a record and learning that a minor's escalation has been open for
//      three days.
//   2. WORTH A LOOK, second. Real work, no deadline. It sits under Action
//      required so that a record with both reads as "these, then those" rather
//      than as one undifferentiated pile.
//   3. FUTURE OVERVIEW BLOCKS, below both — see the placeholder at the bottom of
//      this file. The identity/history blocks that will land there are CONTEXT
//      about the person; they answer "who is this", which is a question a reader
//      asks after "what needs me", never before.
//
// WITHIN Action required the order is severity descending: escalations → risk
// flags → other actions → roll-up rows. That order is NOT written here — it is
// the registry array's own index (see alertOrder), so the feed, the badges and
// this section cannot disagree about priority.
//
// BOTH SECTIONS EMPTY = NO ATTENTION CHROME AT ALL. Not an empty state, not an
// "all caught up" card, no heading. A healthy record is quiet, and the reward for
// clearing the work is that the page stops asking.
//
// READ-WIDE, ACT-NARROW. Every tier sees every card here in full. What lower
// tiers do not get is the Review button, because `onReview` is not passed —
// nothing is ever disabled. Open chat is NOT gated: reading a conversation is
// reading, which is the wide half of the rule.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionRequiredSection,
  AttentionRow,
  RollupRow,
  WorthALookSection,
} from "@/components/record/task-section";
import { FlagTaskCard } from "@/components/record/flag-task-card";
import { FlagReviewDialog, type FlagClose } from "@/components/record/flag-review-dialog";
import { clinicalDate } from "@/components/record/care-presentation";
import { alertDef } from "@/lib/record/alerts";
import {
  alertsForTeen,
  alertRoleForStore,
  splitBySignal,
  type AlertInstance,
} from "@/lib/record/record-alerts";
import { CRISIS_TYPE, FLAG_OUTCOME, type CareFlagRecord, type DemoTeen } from "@/lib/record/people-demo";
import { canActOnCare, staffActorFor } from "@/lib/record/permission-map";
import type { CareStoreSlice } from "@/lib/record/care-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { chatHrefFor } from "@/lib/record/chat";
import { toast } from "sonner";

/** TODO-COPY. Destination labels for the route affordances. */
const TAB_LABEL: Record<string, string> = {
  care: "Care",
  overview: "Overview",
  mentorship: "Mentorship",
  activity: "Activity",
};

/** Elapsed time, in the house format: everything that is not a named platform
 *  metric reads as plain elapsed time. */
function elapsed(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

export function RecordTaskRegions({
  teen,
  now,
  onNavigate,
}: {
  teen: DemoTeen;
  /** Fixed at the page's mount — impure in render, and dates would move. */
  now: number;
  /** Route affordances hand off to the record's own tab switcher rather than
   *  pushing a URL themselves, so the shell keeps ownership of tab state. */
  onNavigate: (tabId: string) => void;
}) {
  const router = useRouter();
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const careReviews = useOnboardingStore((s) => s.careReviews);
  const careUpdates = useOnboardingStore((s) => s.careUpdates);
  const careFlagClosures = useOnboardingStore((s) => s.careFlagClosures);
  const closeCareFlag = useOnboardingStore((s) => s.closeCareFlag);

  const [reviewingFlag, setReviewingFlag] = useState<CareFlagRecord | null>(null);
  /** The control that opened the dialog, captured AT CLICK TIME. Radix's own
   *  restore does not fire in this app, and closing a task unmounts the card the
   *  trigger lived in — so on a successful close focus goes to the section
   *  heading instead of to a detached node. */
  const returnFocusTo = useRef<HTMLElement | null>(null);
  /** See ActionRequiredSection's headingRef note — a closed task takes its own
   *  trigger down with it, so focus goes to the section heading. */
  const actionHeading = useRef<HTMLHeadingElement | null>(null);

  const store: CareStoreSlice = {
    decisions: Object.values(careReviews),
    updates: Object.values(careUpdates),
    closures: Object.values(careFlagClosures),
  };

  const canAct = canActOnCare(persona);
  const role = alertRoleForStore(persona);
  const teenName = teen.goesBy ?? teen.name;
  const staffName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    staffActorFor(persona);

  const instances = alertsForTeen(teen, now, store);
  const { action, attention } = splitBySignal(instances, role);

  // Action items whose home is THIS tab render as full cards; the rest are
  // roll-up rows pointing at the tab that owns them.
  const homeOf = (i: AlertInstance) => alertDef(i.alertId)?.contextualHome;
  const full = action.filter((i) => homeOf(i) === "overview");
  const rollups = action.filter((i) => homeOf(i) !== "overview");

  const nothing = action.length === 0 && attention.length === 0;
  if (nothing) return null;

  return (
    <>
      {/* 1 · ACTION REQUIRED — the count spans full cards AND roll-ups, because
             both are work outstanding on this person. A count that omitted the
             Care-homed review would understate the record. */}
      <ActionRequiredSection count={action.length} headingRef={actionHeading}>
        {full.map((i) =>
          i.kind === "flag" ? (
            <FlagTaskCard
              key={i.key}
              instance={i}
              teenName={teenName}
              now={now}
              onReview={
                canAct
                  ? (flag, trigger) => {
                      returnFocusTo.current = trigger;
                      setReviewingFlag(flag);
                    }
                  : undefined
              }
            />
          ) : null
        )}

        {/* ROLL-UPS SHARE ONE CONTAINER, after the full cards. Deliberately last
            within the section: they are the items a reader cannot act on from
            here, so they sit below everything they can. */}
        {rollups.length > 0 && (
          <div className="overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
            {rollups.map((i) => {
              const def = alertDef(i.alertId);
              const target = def?.routeTarget ?? "care";
              const overdueDays =
                i.kind === "review" ? i.overdueDays : 0;
              return (
                <RollupRow
                  key={i.key}
                  severity={def?.severity ?? "routine"}
                  label={def?.label ?? "Task"}
                  qualifier={
                    overdueDays > 0
                      ? /* TODO-COPY */ `Overdue · ${elapsed(overdueDays)}`
                      : /* TODO-COPY */ "Open"
                  }
                  description={
                    i.kind === "review"
                      ? /* TODO-COPY */ "Presentation review, on the Care tab"
                      : (def?.rollupTemplate ?? "").replace("{name}", teenName)
                  }
                  routeLabel={TAB_LABEL[target] ?? target}
                  onRoute={() => onNavigate(target)}
                />
              );
            })}
          </div>
        )}
      </ActionRequiredSection>

      {/* 2 · WORTH A LOOK. Compact rows, no band tint, no filled button. */}
      <WorthALookSection count={attention.length}>
        {attention.map((i) => {
          const def = alertDef(i.alertId);
          const target = def?.routeTarget ?? "none";
          // "none" RENDERS NO AFFORDANCE — a fact with no destination. "chat"
          // leaves the record entirely, so it does not go through onNavigate.
          const route =
            target === "none"
              ? {}
              : target === "chat"
                ? {
                    /* TODO-COPY */
                    routeLabel: "Open chat",
                    onRoute: () => router.push(chatHrefFor(teen.id)),
                  }
                : {
                    routeLabel: TAB_LABEL[target] ?? target,
                    onRoute: () => onNavigate(target),
                  };
          if (i.kind === "hello")
            return (
              <AttentionRow
                key={i.key}
                /* TODO-COPY */
                statement={`Say hi to ${teenName}`}
                detail={
                  i.sinceMatch === 0
                    ? "matched today · no messages yet"
                    : `matched ${elapsed(i.sinceMatch)} ago · no messages yet`
                }
                {...route}
              />
            );
          if (i.kind === "activity") {
            const newest = i.activities[0];
            return (
              <AttentionRow
                key={i.key}
                /* TODO-COPY. EVENTS, NOT CONTENT — names the activity, never
                   anything the teen wrote inside it. */
                statement={
                  i.activities.length === 1
                    ? `${teenName} finished ${newest.name}`
                    : `${teenName} finished ${i.activities.length} activities`
                }
                detail={
                  i.activities.length === 1
                    ? `${elapsed(newest.daysAgo)} ago`
                    : `most recently ${newest.name} · ${elapsed(newest.daysAgo)} ago`
                }
                {...route}
              />
            );
          }
          if (i.kind === "survey")
            return (
              <AttentionRow
                key={i.key}
                /* TODO-COPY. Waiting on the TEEN, so it states a fact and asks
                   nothing of the reader. */
                statement={`${i.instrument} sent, not returned yet`}
                detail={`sent ${clinicalDate(i.sentAt)}`}
                {...route}
              />
            );
          return null;
        })}
      </WorthALookSection>

      {/* ── FUTURE OVERVIEW BLOCKS GO BELOW HERE ────────────────────────────
          Deliberately empty. This is the foundation slot the regions above were
          built on top of: relationship summary, contact cadence, tenure, and
          whatever the identity block becomes. NOTHING IS INVENTED HERE — a
          placeholder card with plausible-looking content is indistinguishable
          from a shipped feature to everyone who reviews this page, and the
          Overview's existing honesty line ("Performance history for this person
          isn't connected yet") already says the true thing.

          Whatever lands here goes AFTER both regions. See the ordering note at
          the top of this file: context answers "who is this", which is a
          question a reader asks after "what needs me". */}

      <FlagReviewDialog
        open={!!reviewingFlag}
        onOpenChange={(o) => !o && setReviewingFlag(null)}
        flag={reviewingFlag}
        teenName={teenName}
        now={now}
        returnFocusTo={returnFocusTo}
        onClose={(d: FlagClose) => {
          const flag = reviewingFlag;
          if (!flag) return;
          // STAMPED IN THE HANDLER, never in render — react-hooks/purity is right
          // to reject Date.now() in render scope.
          const at = Date.now();
          closeCareFlag({
            flagId: d.flagId,
            teenId: teen.id,
            closedAt: at,
            // Elapsed-to-resolution computed AT CLOSE so History cannot drift as
            // `now` moves.
            openDays: flag.daysAgo,
            outcome: d.outcome,
            outcomeLabel:
              FLAG_OUTCOME.find((o) => o.id === d.outcome)?.label ?? d.outcome,
            note: d.note,
            actor: staffName,
            actorRole: staffActorFor(persona),
            kind: flag.kind,
            crisisLabel: d.crisis
              ? CRISIS_TYPE.find((c) => c.id === d.crisis!.type)?.label
              : undefined,
          });
          setReviewingFlag(null);
          // AFTER the card unmounts, not before — the ref's node is gone by the
          // time this frame runs if the section emptied out, and focusing a
          // detached node is a silent no-op that lands on <body>.
          requestAnimationFrame(() => actionHeading.current?.focus());
          // TODO-COPY
          toast("Closed. The resolution is on the record.");
        }}
      />
    </>
  );
}
