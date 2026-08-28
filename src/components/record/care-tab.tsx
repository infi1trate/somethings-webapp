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
import {
  CareTimeline,
  type CareTimelineHandle,
} from "@/components/record/care-timeline";
import { CareSummaryCard } from "@/components/record/care-summary";
import { RecordButton } from "@/components/record/record-button";
import {
  CareTaskRegion,
  careTasksFor,
} from "@/components/record/care-task-region";
import {
} from "@/components/record/flag-review-dialog";
import { CareSummaryPanel } from "@/components/record/care-summary-panel";
import { careReadingFor } from "@/lib/record/care-reading";
import { carePatternFor } from "@/lib/record/care-pattern";
import { CarePatternBlock } from "@/components/record/care-pattern-block";
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
import {
  type DemoTeen,
} from "@/lib/record/people-demo";
import { canActOnCare, staffActorFor } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-4";

export function CareTab({
  teen,
  /** Prototype-only override so the panel's loading and error states are
   *  reachable — see the note at the call site. */
  summaryState,
}: {
  teen: DemoTeen;
  summaryState?: "loading" | "error";
}) {
  // Fixed at mount so a re-render can't shift every date underneath the reader
  // mid-session. STILL SSR-UNSAFE ON ITS OWN — see the `mounted` gate before the
  // return, which is what makes this legal (gap row 291).
  const [now] = useState(() => Date.now());
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const careReviews = useOnboardingStore((s) => s.careReviews);
  const careUpdates = useOnboardingStore((s) => s.careUpdates);
  // Back, now that the AI summary has landed in the assistant rail.
  const summaryRefreshed = useOnboardingStore((s) => s.careSummaryRefreshedAt);
  const refreshCareSummary = useOnboardingStore((s) => s.refreshCareSummary);
  const careRailOpen = useOnboardingStore((s) => s.careRailOpen);
  const setCareRailOpen = useOnboardingStore((s) => s.setCareRailOpen);
  const approveCareReview = useOnboardingStore((s) => s.approveCareReview);
  const addCareUpdate = useOnboardingStore((s) => s.addCareUpdate);
  const careFlagClosures = useOnboardingStore((s) => s.careFlagClosures);
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
  /** WHERE FOCUS GOES AFTER A CLOSE. The dialog's usual trick — hand focus back
   *  to the trigger — cannot work here: closing a task UNMOUNTS the card the
   *  trigger lived in, so focus fell to <body> and a keyboard user was dropped
   *  at the top of a long clinical page. It goes to the History heading instead,
   *  which is where the resolution they just wrote now lives. */
  const historyHeading = useRef<HTMLHeadingElement | null>(null);
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
    closures: Object.values(careFlagClosures),
  };
  const events = careTimelineFor(teen.id, now, store);
  const presentation = presentationFor(teen.id, now, store);
  const cadence = cadenceFor(teen.id, now, store);
  const series = scoreSeriesFor(teen.id, now, store);
  /** THE READING. One call, one place — replaces `careAiSummaryFor`, which
   *  consumed assessments only and produced a paragraph about survey movement.
   *  The panel is the CONVERSATIONAL layer now, so the reading is built from the
   *  engagement window instead and deliberately does not restate the score. */
  const reading = careReadingFor(teen.id, now, store);

  /** THE MIDDLE HORIZON. Null is a designed outcome — most records have no
   *  pattern and the block renders nothing at all. */
  const pattern = carePatternFor(teen.id, now, store);
  /** So the timeline strip can filter and scroll History. A read, not a write. */
  const timelineRef = useRef<CareTimelineHandle>(null);
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

  const tasks = careTasksFor(review);

  // ═══ NOTHING TIME-DERIVED UNTIL MOUNT (standing rule 3, gap row 291) ═══
  //
  // `now` comes from `useState(() => Date.now())`, whose initialiser runs on the
  // SERVER as well as the client, with a different answer each time. Nineteen
  // things on this tab are derived from it, so the server HTML and the first
  // client render disagreed and React reported a hydration mismatch — "this
  // won't be patched up" — on every one of the nine viewports. It was the only
  // view of 68 with a console error.
  //
  // The gate is the fix rather than a change to `now` itself: on the server and
  // on the first client render `mounted` is false, both produce this shell, so
  // hydration matches by construction. The real tree renders immediately after,
  // with the client's own clock. Placed AFTER every hook — an early return above
  // one would skip it.
  //
  // The alternative was seeding `now` from a module constant so both sides agree,
  // which hydrates cleanly and then shows dates relative to a stale instant until
  // the effect corrects them. A quiet shell for one frame beats a wrong date.
  if (!mounted) return <div className="min-h-[60vh]" />;

  return (
    // THE RAIL IS COLLAPSIBLE, and that is the whole reason it can come back:
    // the history table and the survey breakdowns need the full width, so the
    // reader decides when 320px is worth spending. Collapsed leaves a slim
    // launcher on the right edge rather than nothing, so the tool is findable.
    <div
      className={cn(
        "grid items-start gap-6",
        // Closed: ONE column. The trigger left this grid for the tab row, so
        // there is no second track to reserve.
        careRailOpen ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"
      )}
    >
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

        {/* 2 · TASK REGION — the presentation review, and only that.
            Escalations and risk flags moved to Overview (record-level work, not
            presentation work); their HISTORY stays in the table below. Renders
            NOTHING when no review is due — absence is the reward state, and
            there is no "all caught up" card. */}
        <CareTaskRegion
          tasks={tasks}
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

        {/* 3 · THE AI READING LIVES IN THE CARE SUMMARY PANEL, not this column.
            Floating here it read as unattributed commentary and a reader could
            reasonably ask "summary of what?"; in a named panel under a stated
            window it answers that itself. `care-ai-summary.tsx` is deleted, and
            `careAiSummaryFor` was replaced by `careReadingFor` — the panel is the
            conversational layer now rather than a second telling of the scores. */}

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

        {/* 4b · CARE PATTERN — the middle horizon, between the presentation card
            and History. FULL WIDTH, one card, no nested cards.
            
            It sits here rather than above the presentation card because the
            presentation is the page's spine: a reader establishes what is on
            record, then reads the pattern across it, then walks the entries. And
            it sits ABOVE History because it is the synthesis History is the
            evidence for — the strip's marks scroll down into it. */}
        {pattern && (
          <CarePatternBlock
            pattern={pattern}
            onSelectEvent={(id) => timelineRef.current?.jump(id)}
          />
        )}

        {/* 5 · HISTORY */}
        <section aria-label="History">
          <h2 className={H2} ref={historyHeading} tabIndex={-1}>
            History
          </h2>
          <div className="mt-3">
            <CareTimeline events={events} ref={timelineRef} />
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


      {/* ── THE CARE SUMMARY PANEL. Every tier reads it; only the refresh
          is supervisor-gated, and the rail carries no other affordance that
          could leak — it cannot approve, write, amend or close anything, and it
          never authors a record entry. ──────────────────────────────────── */}
      {careRailOpen ? (
        /* THE PANEL TAKES A READING AND NOTHING ELSE. The old rail was handed ten
           `facts` so a responder could answer questions from them; there is no
           responder now, and the reading is computed in one place
           (`careReadingFor`) rather than assembled at this call site. */
        <CareSummaryPanel
          reading={reading}
          state={summaryState ?? "loaded"}
          updatedAt={summaryRefreshed[teen.id] ?? null}
          onCollapse={() => setCareRailOpen(false)}
          onRefresh={
            canAct
              ? () => {
                  refreshCareSummary(teen.id, Date.now());
                  // HONEST ABOUT WHAT A REFRESH DOES. There is no generation
                  // step to re-run — the reading is derived — so this re-stamps
                  // the "Updated" line and says so. TODO-DATA.
                  toast("Summary re-checked. Regeneration isn’t wired yet.");
                }
              : undefined
          }
        />
      ) : null}

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
