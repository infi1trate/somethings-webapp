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
import {
  CareUpdateCompose,
  type DiagnosticPrefill,
} from "@/components/record/care-update-compose";
import { Dsm5SearchDialog } from "@/components/record/dsm5-search";
import {
  STAGE_LABEL,
  cadenceFor,
  careTimelineFor,
  scoreSeriesFor,
  latestCareUpdateFor,
  pendingReviewFor,
  presentationFor,
  type CareStoreSlice,
  type CareUpdateBody,
  type CareUpdateRecord,
  type CareReviewDecision,
  type CareUpdatePrefill,
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

/** WHAT AN OPEN CARE UPDATE FORM IS ABOUT TO COMMIT.
 *
 *  Held by `CareTab` between the DSM-5 confirm (or the review's Approve) and the
 *  form's commit. Nothing is written to the record while this is set — abandoning
 *  the form at any step leaves the presentation exactly as it was, which is the
 *  whole reason the change is carried in component state rather than staged in
 *  the store. */
interface PendingCommit {
  /** The store key for the decision this will append. A cadence review commits
   *  under the review's own id; an ad-hoc change gets a fresh one per change, so
   *  two changes in a session append two entries rather than overwriting. */
  decisionId: string;
  code: string;
  statement: string;
  /** TODO-COPY — completes "Documenting: …" in the form's header. */
  what: string;
  /** False when the code is unchanged: a cadence review can be approved without
   *  changing anything, and the commit button must not claim otherwise. */
  applies: boolean;
}

/** The decision class for a commit, from what is on record versus what is going
 *  on. Moved here from the review card, which no longer builds decisions. */
function outcomeFor(
  currentCode: string | null,
  nextCode: string
): CareReviewDecision["outcome"] {
  if (currentCode === null) return "presentation_assigned";
  return currentCode === nextCode
    ? "presentation_reviewed"
    : "presentation_changed";
}

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
  /** ═══ WHAT THE OPEN CARE UPDATE FORM IS DOCUMENTING ═══
   *
   *  THIS REPLACED THE PENDING-APPROVAL CONCEPT. A code chosen in the DSM-5
   *  dialog used to populate a synthesised `PresentationReview` so the pick
   *  travelled the approve-with-note path — which meant a supervisor's own change
   *  sat in a review queue waiting for the supervisor to approve it. That queue is
   *  gone. A confirmed pick now goes straight to the care update form, and
   *  committing the form applies the change.
   *
   *  Null for a standalone update, which changes no presentation. */
  const [committing, setCommitting] = useState<PendingCommit | null>(null);
  /** The diagnostic statement's pre-filled draft, when there is one. Only a
   *  cadence review has a rationale to draw from — an ad-hoc change has no
   *  rationale object, so this stays null on that path and the field opens
   *  empty. */
  const [prefill, setPrefill] = useState<DiagnosticPrefill | null>(null);
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
  // for everyone and its actions only for a viewer handed the callbacks.
  //
  // THE SYSTEM-RAISED REVIEW, AND ONLY THAT. An ad-hoc pick used to be
  // synthesised into a `PresentationReview` here (`pr-…-manual`) so it travelled
  // the approve-with-note path — which put a supervisor's own change into a queue
  // for that same supervisor to approve. THAT is the pending state this feature
  // removes, and removing it is why the synthesis is gone rather than disabled.
  //
  // The cadence review task itself is untouched: still raised by the system,
  // still rendered, still requires an action.
  const review = pendingReviewFor(teen.id, now, store);

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

  /** ═══ THE ONE COMMIT PATH ═══
   *
   *  A standalone update, a cadence review and an ad-hoc presentation change all
   *  land here. The difference is only whether `committing` is set.
   *
   *  IMMEDIATE, NOT PENDING. When it is set, the presentation change is applied
   *  in the same action that appends the update — there is no interim state, no
   *  `in_review`, and nothing for anyone to approve afterwards.
   *
   *  TWO ENTRIES, CROSS-REFERENCED. The update names the presentation event it
   *  documents and the decision names the update documenting it, so History can
   *  render each from the other without merging them into one row. Both ids are
   *  derived from the same two keys, so the pair cannot half-link. */
  const saveUpdate = (
    body: CareUpdateBody,
    meta: {
      at: number;
      amends?: string;
      diagnosticPrefill?: CareUpdatePrefill;
    }
  ) => {
    const at = meta.at;
    const updateId = `cu-${teen.id}-${at}`;
    const commit = committing;

    addCareUpdate({
      id: updateId,
      teenId: teen.id,
      createdAt: at,
      author: staffName,
      authorRole: staffActorFor(persona),
      body,
      amends: meta.amends,
      documents: commit ? `ce-dec-${commit.decisionId}` : undefined,
      diagnosticPrefill: meta.diagnosticPrefill,
    });

    if (commit) {
      approveCareReview({
        reviewId: commit.decisionId,
        teenId: teen.id,
        decidedAt: at,
        careUpdateId: updateId,
        outcome: outcomeFor(presentation?.code ?? null, commit.code),
        code: commit.code,
        statement: commit.statement,
        actor: staffName,
        actorRole: staffActorFor(persona),
        previousCode: presentation?.code ?? undefined,
      });
    }

    setAmending(null);
    setCommitting(null);
    setPrefill(null);
    // TODO-COPY
    toast(
      meta.amends
        ? "Amendment appended."
        : commit?.applies
          ? "Presentation changed. Both entries are on the record."
          : commit
            ? "Review recorded. Both entries are on the record."
            : "Care update saved."
    );
  };

  /** Open the form to document a presentation event. Shared by both entry
   *  points — the ad-hoc DSM-5 confirm and the review's Approve — so neither can
   *  drift into its own commit path. */
  const documentPresentation = (
    commit: PendingCommit,
    draftStatement: DiagnosticPrefill | null
  ) => {
    setCommitting(commit);
    setPrefill(draftStatement);
    setAmending(null);
    openDialog(setComposing);
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
            actor: staffName,
            actorRole: staffActorFor(persona),
            // ABSENT below supervisor tier — not disabled. Passing undefined is
            // how the card renders no action row at all.
            onChangeRequest: canAct
              ? () => openDialog(setSearching)
              : undefined,
            // APPROVE OPENS THE FORM. It commits nothing on its own — the
            // recommendation is applied when the care update commits.
            //
            // THE ONLY PLACE A PRE-FILL COMES FROM. The review carries a
            // rationale with a machine-readable provenance
            // (`templated | ai | supervisor`), so the draft and its label are
            // both derived from it rather than invented. An ad-hoc change has no
            // rationale object, which is why that path passes null and opens the
            // field empty.
            onApproveRequest:
              canAct && review
                ? () =>
                    documentPresentation(
                      {
                        decisionId: review.id,
                        code: review.recommended.code,
                        statement: review.recommended.statement,
                        // TODO-COPY
                        what:
                          presentation?.code === review.recommended.code
                            ? `${STAGE_LABEL[review.stage].toLowerCase()} review`
                            : `presentation change to ${review.recommended.code}`,
                        applies:
                          presentation?.code !== review.recommended.code,
                      },
                      {
                        source: review.rationale.source,
                        text: review.rationale.text,
                      }
                    )
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
              // ABANDONING CHANGES NOTHING. Clearing the staged commit here is
              // what makes that true for every exit — Escape, the overlay, the
              // close button — rather than only for a Cancel button.
              if (!o) {
                setAmending(null);
                setCommitting(null);
                setPrefill(null);
              }
            }}
            amending={amending}
            documenting={committing}
            prefill={prefill}
            onSave={saveUpdate}
            returnFocusTo={returnFocusTo}
          />
          <Dsm5SearchDialog
            open={searching}
            onOpenChange={setSearching}
            current={presentation}
            returnFocusTo={returnFocusTo}
            onSelect={(entry: Dsm5Entry) => {
              // FIRES ONLY FROM THE MODAL'S CONFIRM STEP (before → after), never
              // from a search row — that contract is the dialog's, and it is why
              // there is no second confirmation here.
              //
              // Still commits NOTHING. It hands the confirmed pick to the care
              // update form; the change is applied when that form commits, and
              // abandoning the form leaves the presentation untouched.
              //
              // NO PRE-FILL on this path: an ad-hoc change has no rationale
              // object to draw a draft from, so the diagnostic field opens empty
              // and the callout above it guards a blank field.
              setSearching(false);
              documentPresentation(
                {
                  decisionId: `adhoc-${teen.id}-${Date.now()}`,
                  code: entry.code,
                  statement: entry.statement,
                  // TODO-COPY
                  what: `presentation change to ${entry.code}`,
                  applies: true,
                },
                null
              );
            }}
          />
        </>
      )}
    </div>
  );
}
