"use client";

// CARE — the teen record's clinical surface (MO-9.1). Supersedes the registry's
// never-built `care-journey` stub: this is the tab that houses the care journey,
// under the name the product uses.
//
// READ-WIDE, ACT-NARROW. Mentors, lead mentors and supervisors all READ this.
// Only the supervisor tier ACTS. Permissions gate AFFORDANCES, never structure —
// every tier gets the same sections, the same history, the same provenance, the
// same cadence, the same AI summary, the same care updates. Below the tier the
// affordances are ABSENT rather than disabled: the action slot is never mounted
// (its payload is never even fetched), and every optional `on*` callback below is
// simply not passed, which is how a component renders no control at all. A
// greyed-out Approve advertises a decision a mentor cannot take part in, and this
// page carries a clinical diagnosis about a minor.
//
// ONE FULL-WIDTH COLUMN. The 320px interpretive rail is GONE (Prompt A Phase 1):
// it split the page into an evidentiary column and an interpretive one, which
// meant survey breakdowns and history rows were squeezed into ~1fr minus 320px
// for the sake of a card and a list that read perfectly well inline. The rail's
// Notes segment is deleted outright — care updates now have exactly one home,
// the main column — and its AI summary moved into the column as its own card.
//
// NO PAGE HEADING echoing the tab name — the tab bar already said "Care".
//
// COLUMN ORDER (Prompt A Phase 3):
//   1. Care summary — presentation on record + the metrics band
//   2. Task region — renders NOTHING when no task is open
//   3. AI summary
//   4. Care update (current, in full)
//   5. History
//   6. Standing compliance line
//
// THE SUMMARY LEADS, ALWAYS — even with a review pending. The old layout put the
// action slot above everything, which made a routine scheduled review outrank
// the diagnosis it concerns. Severity is honest: the task region sits second,
// and absence is the reward state — no "all caught up" card.
//
// PRE-FIRST-SURVEY is the common case, not an edge case. Through the PRD's
// "snooze" period the presentation reads as an empty state (never an em dash),
// cadence says it starts at the first survey, the AI summary says there isn't
// enough data yet, and the timeline shows its designed empty state.

import { useRef, useState } from "react";
import { CareTimeline } from "@/components/record/care-timeline";
import { CareSummaryCard } from "@/components/record/care-summary";
import { RecordButton } from "@/components/record/record-button";
import {
  CareTaskRegion,
  careTasksFor,
} from "@/components/record/care-task-region";
import {
  CareUpdateByline,
  CareUpdateBodyView,
} from "@/components/record/care-update-view";
import { CareUpdateCompose } from "@/components/record/care-update-compose";
import { Dsm5SearchDialog } from "@/components/record/dsm5-search";
import {
  cadenceFor,
  careTimelineFor,
  scoreSeriesFor,
  latestCareUpdateFor,
  pendingReviewFor,
  presentationFor,
  type CareStoreSlice,
  type CareUpdateBody,
  type CareUpdateRecord,
  type PresentationRef,
} from "@/lib/record/care-demo";
import type { Dsm5Entry } from "@/lib/record/dsm5";
import { type DemoTeen } from "@/lib/record/people-demo";
import { canActOnCare, staffActorFor } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { toast } from "sonner";

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-4";

export function CareTab({ teen }: { teen: DemoTeen }) {
  // Fixed at mount so a re-render can't shift every date underneath the reader
  // mid-session.
  const [now] = useState(() => Date.now());
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const careReviews = useOnboardingStore((s) => s.careReviews);
  const careUpdates = useOnboardingStore((s) => s.careUpdates);
  // careSummaryRefreshedAt / refreshCareSummary / careAiSummaryFor are all
  // still in the store and the data layer — they come back into this file when
  // the AI summary lands in the rail. Removed from here rather than left as
  // unused locals so the file does not carry plumbing to nothing.
  const approveCareReview = useOnboardingStore((s) => s.approveCareReview);
  const addCareUpdate = useOnboardingStore((s) => s.addCareUpdate);
  // The match/unmatch log, so the Mentor metric names who they are matched with
  // NOW rather than whoever the fixture row still points at.
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);

  // The one gate on this page. Read is wide; action is narrow.
  const canAct = canActOnCare(persona);

  const [composing, setComposing] = useState(false);
  const [amending, setAmending] = useState<CareUpdateRecord | null>(null);
  const [searching, setSearching] = useState(false);
  // A code chosen in the DSM-5 dialog from RESTING mode. It POPULATES a
  // recommendation rather than committing — the provider-note gate still stands
  // between it and the record.
  const [proposed, setProposed] = useState<PresentationRef | null>(null);
  // The control that opened a dialog, captured AT CLICK TIME so focus can go
  // back to it on close. Radix's own restore does not fire in this app, and
  // reading activeElement once the dialog is open is already too late.
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const openDialog = (open: (v: true) => void) => {
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    open(true);
  };

  const store: CareStoreSlice = {
    decisions: Object.values(careReviews),
    updates: Object.values(careUpdates),
  };
  const events = careTimelineFor(teen.id, now, store);
  const presentation = presentationFor(teen.id, now, store);
  const cadence = cadenceFor(teen.id, now, store);
  const series = scoreSeriesFor(teen.id, now, store);
  const latestUpdate = latestCareUpdateFor(teen.id, now, store.updates ?? []);

  // READ-WIDE. This used to be `canAct ? pendingReviewFor(...) : null`, which
  // enforced act-narrow by BREAKING read-wide: a lead mentor reading a record
  // could not see that a review was outstanding on it. The review is fetched for
  // every tier now, and the gate moved to the card — which renders its evidence
  // for everyone and its provider note and actions only for a viewer who is
  // handed the callbacks.
  const fixtureReview = pendingReviewFor(teen.id, now, store);
  // A code picked from resting mode becomes a review with the SAME shape, so it
  // travels the same approve-with-note path rather than a shortcut around it.
  const review =
    fixtureReview ??
    (canAct && proposed
      ? {
          id: `pr-${teen.id}-manual`,
          stage: cadence.stage,
          recommended: proposed,
          rationale: {
            // A supervisor's own choice has no model behind it, and saying so is
            // the whole point of the provenance label — "templated from intake
            // mapping" here would credit a mapping that had no part in it.
            source: "supervisor" as const,
            // TODO-COPY
            text: "Selected directly by a supervisor from the DSM-5 list. The provider note below is the rationale of record.",
          },
          survey: cadence.lastAssessment,
          aggregate: null,
        }
      : null);

  const staffName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    staffActorFor(persona);

  // ABSENT in three cases, all of them dead tasks:
  //   · a survey is already out — offering to send the first one reads as though
  //     the send hadn't happened, and invites a second;
  //   · one has already come back — the instrument is locked by then;
  //   · the mentorship ENDED — starting a cadence on a closed record is the same
  //     empty task as proposing a billing code for one, which this page already
  //     suppresses.
  const onAssignSurvey =
    canAct &&
    cadence.assignedSurvey === null &&
    cadence.outstandingSurvey === null &&
    cadence.reviewClock !== "closed"
      ? () => toast("Assigning the first survey isn’t built yet.")
      : undefined;

  const saveUpdate = (body: CareUpdateBody, amends?: string) => {
    const at = Date.now();
    addCareUpdate({
      id: `cu-${teen.id}-${at}`,
      teenId: teen.id,
      createdAt: at,
      author: staffName,
      authorRole: staffActorFor(persona),
      body,
      amends,
    });
    setAmending(null);
    // TODO-COPY
    toast(amends ? "Amendment appended." : "Care update saved.");
  };

  return (
    <div className="space-y-7">
      <div className="min-w-0 space-y-7">
        {/* 1 · CARE SUMMARY — the spine. Leads even with a review pending. */}
        <CareSummaryCard
          teen={teen}
          presentation={presentation}
          cadence={cadence}
          now={now}
          relationships={{ events: relationshipEvents }}
          onChange={canAct ? () => openDialog(setSearching) : undefined}
          onAssignSurvey={onAssignSurvey}
          liveMentorName={
            [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
            undefined
          }
          series={series}
        />

        {/* 2 · TASK REGION. Zero or more open tasks, severity descending;
            renders NOTHING when none are open — absence is the reward state,
            and there is no "all caught up" card. Ordering lives in
            careTasksFor, with the data, not in this JSX. */}
        <CareTaskRegion
          tasks={careTasksFor(teen.id, review)}
          reviewProps={{
            currentCode: presentation?.code ?? null,
            actor: staffName,
            actorRole: staffActorFor(persona),
            // ABSENT below supervisor tier — not disabled. Passing undefined
            // is how the card renders no provider note and no action row.
            onChangeRequest: canAct
              ? () => openDialog(setSearching)
              : undefined,
            onApprove: canAct
              ? (d) => {
                  approveCareReview({ ...d, teenId: teen.id });
                  setProposed(null);
                  // TODO-COPY
                  toast("Approved. The decision is on the record.");
                }
              : undefined,
          }}
        />

        {/* 3 · AI SUMMARY — REMOVED FROM THE MAIN COLUMN this run. It
            relocates to the rail in a later prompt, and the slot is left empty
            deliberately rather than closing the gap now and reopening it then:
            reflowing this column twice would make two review passes disagree
            about where everything sits. AiSummaryCard, careAiSummaryFor and the
            refresh action all still exist and are untouched. */}

        {/* 4 · THE CURRENT CARE UPDATE, IN FULL. Older ones live in History —
            this carries the current clinical read, not an archive. */}
        <section aria-label="Care update" data-record-section="care-update">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
            <h2 className={H2}>Care update</h2>
            {/* THE SECOND CTA, in its own block's header row — a properly
                styled secondary button, delineated from the care summary's
                "Change presentation" by both position and noun. "Amend" once an
                update exists, because append-only means the existing one is
                never edited. Supervisor tier only; absent below. */}
            {canAct && (
              <RecordButton
                onClick={() => {
                  setAmending(latestUpdate ?? null);
                  openDialog(setComposing);
                }}
              >
                {/* TODO-COPY */}
                {latestUpdate ? "Amend care update" : "Write care update"}
              </RecordButton>
            )}
          </div>
          {latestUpdate ? (
            <div className={`mt-3 ${CARD}`}>
              <CareUpdateBodyView update={latestUpdate} />
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                <CareUpdateByline update={latestUpdate} />
              </div>
            </div>
          ) : (
            <div className={`mt-3 ${CARD}`}>
              <p
                className="text-[var(--text-muted)]"
                style={{ font: "var(--type-row-value)" }}
              >
                {/* TODO-COPY — an empty state, not an absent section: the
                    heading and its CTA are the affordance a supervisor needs to
                    find, and hiding the whole block until one exists hides the
                    way to write the first. */}
                No care update on file yet.
              </p>
            </div>
          )}
        </section>

        {/* 5 · HISTORY */}
        <section aria-label="History">
          <h2 className={H2}>History</h2>
          <div className="mt-3">
            <CareTimeline events={events} />
          </div>
        </section>

        {/* Prompt B Phase 4 — required compliance copy (PRD P0). A quiet
            STANDING line at the foot of the column, visible to EVERY tier.
            Deliberately NOT inside the action slot: it is true whether or not a
            review is pending, and putting it in a supervisor-only surface would
            hide it from the mentors who read this page most often. */}
        <p className="border-t border-[var(--border-subtle)] pt-4 text-[13px] leading-[18px] text-[var(--text-muted)]">
          {/* TODO-COPY — exact wording pending clinical sign-off. */}
          Dr. Nissan is the final decision-maker on all clinical notes and
          determinations on this page.
        </p>
      </div>


      {/* Both dialogs mount only for the tier that can use them. */}
      {canAct && (
        <>
          <CareUpdateCompose
            open={composing}
            onOpenChange={(o) => {
              setComposing(o);
              if (!o) setAmending(null);
            }}
            amending={amending}
            onSave={saveUpdate}
            returnFocusTo={returnFocusTo}
          />
          <Dsm5SearchDialog
            open={searching}
            onOpenChange={setSearching}
            current={presentation}
            returnFocusTo={returnFocusTo}
            onSelect={(entry: Dsm5Entry) => {
              // Populates the recommendation. Does NOT commit — the review slot
              // and its provider note still stand in the way.
              setProposed({ statement: entry.statement, code: entry.code });
              // TODO-COPY
              toast("Moved into the review. Add a note to approve it.");
            }}
          />
        </>
      )}
    </div>
  );
}
