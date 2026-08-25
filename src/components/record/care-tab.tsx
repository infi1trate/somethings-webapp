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
import { AiSummaryCard } from "@/components/record/care-ai-summary";
import { PresentationReviewAction } from "@/components/record/care-action-slot";
import {
  CareUpdateByline,
  CareUpdateBodyView,
} from "@/components/record/care-update-view";
import { CareUpdateCompose } from "@/components/record/care-update-compose";
import { Dsm5SearchDialog } from "@/components/record/dsm5-search";
import {
  cadenceFor,
  careAiSummaryFor,
  careTimelineFor,
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
  const summaryRefreshed = useOnboardingStore((s) => s.careSummaryRefreshedAt);
  const approveCareReview = useOnboardingStore((s) => s.approveCareReview);
  const addCareUpdate = useOnboardingStore((s) => s.addCareUpdate);
  const refreshCareSummary = useOnboardingStore((s) => s.refreshCareSummary);
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
  const summary = careAiSummaryFor(teen.id, now, store);
  const latestUpdate = latestCareUpdateFor(teen.id, now, store.updates ?? []);

  // Read-wide/act-narrow enforced at the SOURCE: a pending review is only ever
  // fetched for the tier that can decide it, so there is no path by which a
  // mentor renders an empty or disabled version of the slot.
  const fixtureReview = canAct ? pendingReviewFor(teen.id, now, store) : null;
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
        />

        {/* 2 · TASK REGION. Renders NOTHING when no task is open — absence is
            the reward state, and there is no "all caught up" card. Prompt B
            generalises this to escalations and risk flags; today the
            presentation review is its only consumer. */}
        {review && (
          <PresentationReviewAction
            review={review}
            currentCode={presentation?.code ?? null}
            actor={staffName}
            actorRole={staffActorFor(persona)}
            onChangeRequest={() => openDialog(setSearching)}
            onApprove={(d) => {
              approveCareReview({ ...d, teenId: teen.id });
              setProposed(null);
              // TODO-COPY
              toast("Approved. The decision is on the record.");
            }}
          />
        )}

        {/* 3 · AI SUMMARY — decision support, typographically subordinate to
            the human clinical text below it. */}
        <AiSummaryCard
          summary={summary}
          refreshedAt={summaryRefreshed[teen.id] ?? null}
          personId={teen.id}
          onRefresh={
            canAct
              ? () => {
                  refreshCareSummary(teen.id, Date.now());
                  // Honest about what a refresh does today: TODO-DATA, the text
                  // is derived from the timeline, so a refresh re-stamps rather
                  // than rewrites.
                  toast("Summary re-checked. Regeneration isn’t wired yet.");
                }
              : undefined
          }
        />

        {/* 4 · THE CURRENT CARE UPDATE, IN FULL. Older ones live in History —
            this carries the current clinical read, not an archive. */}
        {latestUpdate && (
          <section aria-label="Care update" data-record-section="care-update">
            <h2 className={H2}>Care update</h2>
            <div className={`mt-3 ${CARD}`}>
              <CareUpdateBodyView update={latestUpdate} />
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                <CareUpdateByline update={latestUpdate} />
              </div>
            </div>
          </section>
        )}

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
