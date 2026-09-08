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

import { useEffect, useRef, useState } from "react";
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
import { careReadingFor } from "@/lib/record/care-reading";
import { carePatternFor } from "@/lib/record/care-pattern";
import { CareSummaryDocCard } from "@/components/record/care-summary-doc";
import { careSummaryFor, commitFor } from "@/lib/record/care-summary-doc";
import {
  CareUpdateByline,
  CareUpdateBodyView,
} from "@/components/record/care-update-view";
import {
  CareUpdateCompose,
  type DiagnosticPrefill,
} from "@/components/record/care-update-compose";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Dsm5SearchDialog } from "@/components/record/dsm5-search";
import { CareReviewWorkspace } from "@/components/record/care-review-workspace";
import {
  clearReviewDraft,
  readReviewDraft,
  type ReviewDecision,
} from "@/lib/record/review-draft";
import {
  REVIEW_NOUN,
  type PresentationReview,
  cadenceFor,
  careTimelineFor,
  latestCareUpdateFor,
  pendingReviewFor,
  weightedNowFor,
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
import Link from "next/link";
import { useOnboardingStore } from "@/lib/onboarding/store";
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
  /** ═══ THE OVERLAY'S STATE IS THE PAGE'S ═══
   *  The trigger sits in the shell's tab row, which this component does not
   *  render, so the two halves share one piece of state rather than each keeping
   *  their own. Optional so a caller that never shows a trigger still works —
   *  the rail is then the only way in, which is correct above 1100px. */
  summaryOverlayOpen = false,
  onSummaryOverlayChange,
}: {
  teen: DemoTeen;
  summaryOverlayOpen?: boolean;
  onSummaryOverlayChange?: (open: boolean) => void;
}) {
  // NO `summaryState` PROP ANY MORE. It existed to make the old panel's loading
  // and error states reachable for review, and those states are gone with it:
  // the evidence document is DERIVED from the record, synchronously, so there is
  // no call to be slow or to fail. If generation ever becomes a real async step
  // it needs its own states — and a real pending shape, not a prop override.
  // Fixed at mount so a re-render can't shift every date underneath the reader
  // mid-session. STILL SSR-UNSAFE ON ITS OWN — see the `mounted` gate before the
  // return, which is what makes this legal (gap row 291).
  const [now] = useState(() => Date.now());
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const careReviews = useOnboardingStore((s) => s.careReviews);
  const careUpdates = useOnboardingStore((s) => s.careUpdates);
  /** THE REFRESH STAMP, STILL READ AND NO LONGER WRITTEN (B2).
   *
   *  The Refresh button is gone, so nothing calls `refreshCareSummary` any more —
   *  but this map is persisted store state and any record stamped by the old
   *  button keeps its date, which is why the READ stays. Deleting the field would
   *  cost a migration to remove a number that is correct where it exists and
   *  absent everywhere else, and `summaryDocBase.generatedAt` is the fallback for
   *  every record that never had one. Read without a writer, deliberately. */
  const summaryRefreshed = useOnboardingStore((s) => s.careSummaryRefreshedAt);
  const approveCareReview = useOnboardingStore((s) => s.approveCareReview);
  const addCareUpdate = useOnboardingStore((s) => s.addCareUpdate);
  const careFlagClosures = useOnboardingStore((s) => s.careFlagClosures);
  const careSummaryCommits = useOnboardingStore((s) => s.careSummaryCommits);
  // The match/unmatch log, so the Mentor metric names who they are matched with
  // NOW rather than whoever the fixture row still points at.
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);

  // The one gate on this page. Read is wide; action is narrow.
  const canAct = canActOnCare(persona);

  const [composing, setComposing] = useState(false);
  const [amending, setAmending] = useState<CareUpdateRecord | null>(null);
  const [searching, setSearching] = useState(false);

  /** ═══ THE REVIEW DRAWER, AND THE ONE RULE THE SHELL ENFORCES ═══
   *
   *  Main column + rail + drawer must never all render. That is enforced HERE,
   *  in the grid template and the rail's own mount condition, rather than by
   *  each component minding its own width — a per-component rule is one someone
   *  forgets on the day a fourth panel arrives.
   *
   *  It is also not merely a layout preference: the summary node carries
   *  document-global SVG ids, so two mounts break the visible one (gap row 309).
   *  The rail unmounting is what lets the drawer hold the same node. */
  const [reviewOpen, setReviewOpen] = useState(false);
  const [closingReview, setClosingReview] =
    useState<PresentationReview | null>(null);
  // The column no longer needs a fitted height: the panel is fixed against the
  // viewport now (see `useViewportAnchor`), so the column only has to hold the
  // digest or the summary, both of which size themselves.
  /** The post-commit confirmation the attention card compresses into
   *  (Workstream F). Null at rest; set for one render pass after a commit. */
  const [reviewed, setReviewed] = useState<{
    code: string;
    changed: boolean;
  } | null>(null);
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
    // ONLY HERE. The other two slice constructions (record-task-regions,
    // mentee-table) feed `presentationFor`/`cadenceFor`/`pendingReviewFor`,
    // none of which read summary events — History is rendered on this tab
    // alone, so passing them elsewhere would add a read nothing consumes.
    summaries: careSummaryCommits[teen.id] ?? [],
  };
  const events = careTimelineFor(teen.id, now, store);
  const presentation = presentationFor(teen.id, now, store);
  const cadence = cadenceFor(teen.id, now, store);
  // `scoreSeriesFor` is read by the care summary rail, not here — the metrics
  // row's sparkline is gone with the survey-cell merge.
  /** THE READING. One call, one place — replaces `careAiSummaryFor`, which
   *  consumed assessments only and produced a paragraph about survey movement.
   *  The panel is the CONVERSATIONAL layer now, so the reading is built from the
   *  engagement window instead and deliberately does not restate the score. */
  const reading = careReadingFor(teen.id, now, store);

  /** THE MIDDLE HORIZON. Null is a designed outcome — most records have no
   *  pattern and the block renders nothing at all. */
  /** THE STRIP'S GATE, not the narrative's — the Care pattern card that needed
   *  the stricter one is gone, and the strip only claims "these are the scores".
   *  Row 315. */
  const pattern = carePatternFor(teen.id, now, store, "strip");
  /** So the timeline strip can filter and scroll History. A read, not a write. */
  const timelineRef = useRef<CareTimelineHandle>(null);
  const setSummaryOverlayOpen = (open: boolean) =>
    onSummaryOverlayChange?.(open);

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
  /** ═══ THE PENDING CODE CHANGE, OWNED HERE ═══
   *
   *  It used to live in the workspace, which is where the control was. The
   *  control moved to the card's TITLE BLOCK — the workspace's PARENT — so the
   *  value moved up to the component that owns the review's lifecycle: this one
   *  reads the draft, builds the workspace and handles the commit. `null` means
   *  unchanged. The card sets and displays it; the workspace labels its CTA and
   *  commits it; both read this one value, so they cannot disagree.
   *
   *  ═══ SEEDED FROM THE DRAFT AT MOUNT, NOT ONLY AT OPEN ═══
   *
   *  Declared here, BELOW `review`, because the initialiser needs the review's
   *  id — and it needs to be an initialiser rather than an effect because the
   *  workspace is MOUNTED WHILE THE CARD IS COLLAPSED. Starting at `null` and
   *  seeding on open was measured writing `decision: null` over a stored change
   *  on the very first render after a reload: the workspace's persist effect saw
   *  a value that differed from its restored pristine snapshot and dutifully
   *  saved it. A supervisor's pending code change would have been lost by
   *  loading the page.
   *
   *  `readReviewDraft` is a synchronous string read that returns null without a
   *  window, and `hasSavedDraft` below already makes the same call every render.
   *  `expandCard` re-seeds on each open, which is what keeps this honest once
   *  the draft has been discarded or committed. */
  const [decision, setDecision] = useState<ReviewDecision | null>(() =>
    review ? (readReviewDraft(teen.id, review.id)?.decision ?? null) : null
  );
  /** THE EVIDENCE DOCUMENT for this cycle. Window = last code update → now, so
   *  it is cadence-agnostic — see `care-summary-doc.ts`. */
  const summaryDocBase = careSummaryFor(teen.id, now, store);
  /** THE GENERATED LINE MUST NAME THE LAST REFRESH, not this render. `now` is
   *  fixed at mount, so without this a summary refreshed ten minutes ago would
   *  claim it was generated at page load — a timestamp that reads as fresher
   *  than the document is. */
  const summaryDoc = summaryDocBase
    ? {
        ...summaryDocBase,
        generatedAt: summaryRefreshed[teen.id] ?? summaryDocBase.generatedAt,
      }
    : null;
  /** Engagement demoted to one muted context line — informs without competing
   *  with the clinical structure. Null when there is nothing to say.
   *
   *  SCOPE IS IN THE STRING, and the day count is gone. `careReadingFor` is
   *  unwindowed, so it describes the mentorship rather than this cycle; its day
   *  count also duplicated the theme element's denominator with a DIFFERENT
   *  number under the same words. See the prop's note in `care-summary-doc.tsx`. */
  /* ═══ THE ENGAGEMENT SENTENCE WAS BUILT HERE, AND THAT WAS THE BUG (B1) ═══
     It read "21 exchanges across the mentorship" while the line above it named a
     WINDOW — `careReadingFor` is unwindowed, so one header carried two numbers
     about two different periods. The card now composes both halves from
     `doc.window` and a raw count; see `summaryMetaLine`. */

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
    },
    /** ═══ THE DRAWER PASSES ITS COMMIT IN ═══
     *  The modal path leaves this undefined and the commit is read from state,
     *  where `documentPresentation` put it before opening the form. The drawer
     *  has no such round trip — it decides and commits in one act — and reading
     *  `committing` after a `setCommitting` in the same handler would read the
     *  previous render's value. Explicit beats a state write it would then have
     *  to race. */
    commitOverride?: PendingCommit
  ) => {
    const at = meta.at;
    const updateId = `cu-${teen.id}-${at}`;
    const commit = commitOverride ?? committing;

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

    /** ═══ THE SUCCESS MOMENT (Workstream D) ═══
     *
     *  An append-only correction is a RELATIONSHIP between two entries, and the
     *  moment it exists is the only moment a reader is thinking about that
     *  relationship. So the record scrolls to the new entry and its "Amends the
     *  {date} entry" link lights up briefly — the teaching happens once, at the
     *  point of creation, instead of in a paragraph nobody reads.
     *
     *  IT REUSES `jump`, which already scrolls and highlights under a
     *  `motion-reduce` guard, rather than growing a second highlight mechanism.
     *  The id is derivable: a care update's timeline event is `ce-cu-${updateId}`
     *  (see `careUpdateToEvent`), so the target exists as soon as the write lands.
     *
     *  AMENDMENTS ONLY. A plain update has no relationship to teach, and scrolling
     *  the page on every save would be motion for its own sake.
     *
     *  `requestAnimationFrame` because the row does not exist yet: the store write
     *  above is synchronous but React has not re-rendered, so `getElementById`
     *  would return null this tick. `jump` has its own inner frame, so this is one
     *  frame for the render and one for the scroll. */
    if (meta.amends) {
      requestAnimationFrame(() => {
        timelineRef.current?.jump(`ce-cu-${updateId}`);
      });
    }

    if (commit) {
      // ═══ THE DECISION AND ITS EVIDENCE, IN ONE WRITE ═══
      //
      // The summary is frozen HERE, at the moment of approval, from the document
      // that was on screen while the decision was made — not re-derived later.
      // See `commitFor`. `documents` points at the care update written just
      // above, so History carries the pair as two cross-referenced rows.
      //
      // `summaryDoc` can be null (no window, nothing to state), and then no
      // summary is committed. A record showing an approved review with no
      // summary beside it is the truth about that decision.
      approveCareReview(
        {
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
        },
        summaryDoc
          ? commitFor(
              summaryDoc,
              `ce-cs-${commit.decisionId}`,
              at,
              `ce-cu-${updateId}`
            )
          : undefined
      );
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

  /** ═══ THE SUMMARY, ONE NODE, TWO CONTAINERS ═══
   *
   *  Rendered in the rail at `min-[1100px]` and in an overlay panel below it.
   *  Built once here rather than twice at the two mount points: the props are
   *  eight lines of wiring, and two copies is how the overlay ends up a version
   *  behind the rail the first time one of them changes.
   *
   *  MOUNTED IN ONE PLACE AT A TIME. `railOpen` gates the rail copy, for the
   *  same reason `PreviewDisclosure` had to: the preview inside carries
   *  document-global SVG ids, so two copies duplicate them and the visible one's
   *  `url(#…)` references resolve into a `display:none` subtree (row 309). */
  const summaryNode = summaryDoc ? (
    <CareSummaryDocCard
      doc={summaryDoc}
      pattern={pattern}
      /* THE COUNT, NOT A SENTENCE (B1). The card composes the meta line from its
         own window; handing it a pre-formatted string was how a windowed period
         and an UNWINDOWED exchange count ended up in one sentence. */
      exchanges={reading?.exchanges ?? null}
      onJumpToEvent={(id) => {
        // FROM THE OVERLAY, JUMPING MUST ALSO CLOSE IT — History is behind the
        // panel, so scrolling to a row the reader cannot see is worse than not
        // moving at all.
        setSummaryOverlayOpen(false);
        timelineRef.current?.jump(id);
      }}
    />
  ) : null;

  /** The review the panel is rendering: the live one, or the one on its way
   *  out. */
  const panelReview = review ?? closingReview;
  const reviewInProgress = (reviewOpen && !!review) || !!closingReview;

  /** ═══ OPENING THE CARD, AND WHERE FOCUS AND THE PAGE GO ═══
   *
   *  Focus lands on the decision row's first control — the first thing this flow
   *  asks anyone to do — via a tick the workspace watches, so no other re-render
   *  can pull the caret out of a field mid-sentence.
   *
   *  AND THE PAGE FOLLOWS THE CARD. Expanding adds several hundred pixels below
   *  the header band, so on anything short of a tall window the form opens under
   *  the fold and a reader is left looking at a card that visibly did something
   *  out of sight. One smooth scroll puts the band near the top; `motion-reduce`
   *  jumps instead, which the spec allows.
   *  Deferred a frame so the row exists to scroll to. */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [workspaceFocus, setWorkspaceFocus] = useState(0);
  const expandCard = () => {
    /* SEEDED FROM THE DRAFT AT THE MOMENT OF OPENING. The workspace used to do
       this in its own initialiser; with the value up here, the open is the hook.
       Reading session storage is a synchronous string lookup — the same read
       `hasSavedDraft` already makes on every render. */
    setDecision(review ? (readReviewDraft(teen.id, review.id)?.decision ?? null) : null);
    setReviewOpen(true);
    setWorkspaceFocus((n) => n + 1);
    requestAnimationFrame(() => {
      const band = cardRef.current?.querySelector(
        '[data-record-section="care-review-card"]'
      );
      band?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  };

  /** ═══ THE PANEL, BUILT ONCE ═══
   *  Handed to whichever container is showing the slot — the right column above
   *  1100px, the sheet below it. One element in one variable rather than two JSX
   *  sites, because two would remount the form on every breakpoint crossing and
   *  take the draft's scroll position with it. */
  /** ═══ IS THERE A DRAFT TO ADVERTISE ═══
   *  Read on each render rather than tracked in state: the workspace writes the
   *  draft on every keystroke, and a mirrored boolean would be a second source
   *  for the same fact — wrong for exactly as long as it took to notice. Reading
   *  session storage is a synchronous string lookup. */
  const hasSavedDraft = !!(review && !reviewOpen
    ? readReviewDraft(teen.id, review.id)
    : null);

  const workspaceNode = panelReview ? (
    <CareReviewWorkspace
      review={panelReview}
      currentCode={presentation?.code ?? null}
      decision={decision}
      onDecisionChange={setDecision}
      teenId={teen.id}
      now={now}
      focusSignal={workspaceFocus}
      onSaveAndClose={() => {
        /* NOTHING EXTRA IS SAVED HERE. The draft is already written on every
           keystroke, so this only collapses the card — which is what the label
           says and all it does. */
        setReviewOpen(false);
      }}
      onCommit={(decision: ReviewDecision, body, at) => {
        const review = panelReview;
        if (!review) return;
        const code =
          decision.kind === "change"
            ? decision.code
            : (presentation?.code ?? review.recommended.code);
        const statement =
          decision.kind === "change"
            ? decision.statement
            : (presentation?.statement ?? review.recommended.statement);
        const applies = presentation?.code !== code;
        saveUpdate(
          body,
          {
            at,
            /* ═══ NO PREFILL PROVENANCE, BECAUSE NO PREFILL HAPPENED ═══
               This recorded `{ source: <the rationale's>, edited: <text differs
               from the rationale> }`. With the field no longer seeded, `edited`
               would be TRUE on essentially every save — the user's own prose
               will not match the rationale by accident — so the record would
               claim the supervisor edited an AI draft they were never handed.
               A false provenance claim on clinical documentation is worse than
               none, so the field is omitted: nothing was inserted, so there is
               nothing to attribute.
               THIS IS THE `authored` STATE of the per-field provenance model,
               expressed by absence. Replacing it with real per-field values —
               authored / ai_inserted / ai_assisted — is the outstanding work;
               see the report. */
          },
          {
            decisionId: review.id,
            code,
            statement,
            /* TODO-COPY — `REVIEW_NOUN`, never `STAGE_LABEL` + " review". */
            what: applies
              ? `presentation change to ${code}`
              : REVIEW_NOUN[review.stage],
            applies,
          }
        );
        clearReviewDraft(teen.id, review.id);
        /* ═══ SEQUENCED, NOT SIMULTANEOUS ═══
           The panel leaves first and the card resolves after it. Both at once
           reads as the page coming apart — two things moving in different
           places for different reasons. `reviewOpen` false takes the slot back
           to the summary on this frame; `setReviewed` on the next paints the
           confirmation into the space the card was holding. */
        /* THE PANEL LEAVES UNDER ITS OWN ANIMATION. `closing` runs the settle
           in reverse for 200ms; only then does it unmount and the card resolve,
           which keeps the sequence the spec asks for and gives the exit
           something to animate rather than vanishing on the click frame. */
        /* ═══ THE CARD CLOSES ITSELF, THEN RESOLVES ═══
           One sequence, in order: the expansion collapses under its own 300ms
           transition while the card is still there, and only when it has closed
           does the card give way to the confirmation line. Simultaneous reads as
           the section coming apart — two things moving in two places at once —
           and 300 + the resolve is inside the 800ms budget. */
        setClosingReview(review);
        setReviewOpen(false);
        window.setTimeout(() => {
          setClosingReview(null);
          setReviewed({ code, changed: applies });
        }, 300);
      }}
    />
  ) : null;

  /** ═══ THE CARD OUTLIVES ITS REVIEW, BRIEFLY ═══
   *  `panelReview`, not `review`. Committing writes to the store and
   *  `pendingReviewFor` returns null on the same frame, so keying the card off
   *  `review` made it vanish instantly — measured at 80ms, gone — and there was
   *  no card left to "resolve in place". The snapshot keeps it mounted just long
   *  enough for its own expansion to close. */
  const tasks = careTasksFor(panelReview);

  // `openFlagCount` lived here for the panel's evidence strip. The strip is
  // gone and the digest counts its own from the summary document.

  /** ═══ THE CONFIRMATION HOLDS, THEN THE SECTION SETTLES ═══
   *  2.4s, not the brief's ≤800ms total. 800ms is the right budget for the
   *  MOVEMENT and the wrong one for the reading: "Reviewed · F33.1 unchanged ·
   *  just now" is six words, and a line that leaves before it can be read is a
   *  flash rather than a confirmation. The transition itself is well inside
   *  800ms; this is the hold after it.
   *  Cleared on unmount so a tab change mid-hold cannot fire into a dead tree. */
  useEffect(() => {
    if (!reviewed) return;
    const t = setTimeout(() => setReviewed(null), 2400);
    return () => clearTimeout(t);
  }, [reviewed]);

  /** The drawer is mounted from the moment it opens and STAYS mounted while
   *  minimized — hidden, not unmounted. Unmounting would drop the scroll position
   *  inside it, and restoring a review to the top of a long form is not
   *  "restores with all state". */
  /** A review is in progress from the moment it is opened until it commits or
   *  is closed. The slot renders both units throughout; `expanded` decides which
   *  one is full. */


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
      // ═══ ONE COLUMN, PERMANENTLY (Phase 2) ═══
      //
      // This was a two-track grid whose second track held the 320px Care summary
      // rail (design-system-gaps row 304). Both the rail and its tab-row trigger are deleted: the summary is a
      // full-width document in the main column now, directly above the review
      // card, because evidence belongs adjacent to the decision it informs.
      //
      // ═══ AUTHORED SPINE, DERIVED RAIL ═══
      //
      // Left: primary presentation → action required → care update → History.
      // Everything a person wrote or approved, in the order a reader needs it.
      // Right: the Care summary, which is derived. NOTHING IN THE RAIL IS EVER AN
      // AUTHORED RECORD OR HOSTS AN APPROVAL — that boundary is the reason for
      // the split, not a side effect of it, and it is why the summary is not
      // merged into the presentation card even though both describe the code.
      //
      // THE RAIL CAME BACK, AND THE REASON IT LEFT IS NOW ANSWERED. It was
      // removed because the summary's widest content could not be read at 320px
      // in a 320px rail (gap row 304). Below 1100px the rail no longer exists —
      // the summary opens as a full overlay panel from a trigger in the tab row
      // — so the narrow case is served by a container that has the whole width,
      // instead of by a column that never had enough.
      //
      // 1100px, not `lg`: at 1024 a 380px rail leaves the spine ~600px, and
      // History is a seven-column table. `min-[1100px]` is where both fit.
      /* ═══ THE MAIN COLUMN DOES NOT MOVE ═══
         One template, always. R2 swapped this between a 380px rail track and a
         520px drawer track, so opening a review reflowed the spine underneath
         the reader — every card narrowed, the metrics row rewrapped, and the
         thing they had been looking at moved. The right column now time-shares
         its own width between two units (see `CareReviewSlot`), so nothing
         outside that track notices a review at all. */
      /* ═══ ONE TEMPLATE, ALWAYS ═══
         The review used to take this track, then widen it. It happens inside the
         card now, so the right column is the care summary and nothing else — and
         the main column has no reason to reflow for a review at all. */
      className="grid grid-cols-1 items-start gap-6 min-[1100px]:grid-cols-[minmax(560px,1fr)_380px]"
    >
      <div className="min-w-0 space-y-7">
        {/* 1 · CARE SUMMARY — the spine. Leads even with a review pending. */}
        <CareSummaryCard
          teen={teen}
          presentation={presentation}
          cadence={cadence}
          now={now}
          /* ═══ THE SAME AGGREGATE THE REVIEW CARD SHOWS ═══
             Sourced HERE, a few lines from `pendingReviewFor` above, so the
             presentation card's Weighted Avg and the review card's Weighted
             column are visibly one decision rather than two derivations that
             happen to agree. `weightedNowFor` runs the same
             `weightedAggregate`, and works on records with no review pending —
             which the review's own aggregate cannot. */
          weighted={weightedNowFor(teen.id, now, store)}
          relationships={{ events: relationshipEvents }}
          onChange={canAct ? () => openDialog(setSearching) : undefined}
          onAssignSurvey={onAssignSurvey}
          liveMentorName={
            [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
            undefined
          }
        />

        {/* 2 · TASK REGION — the presentation review, and only that.
            Escalations and risk flags moved to Overview (record-level work, not
            presentation work); their HISTORY stays in the table below. Renders
            NOTHING when no review is due — absence is the reward state, and
            there is no "all caught up" card. */}
        {/* ═══ RESOLVE IN PLACE ═══
            The card that was here is gone the moment the review commits —
            `pendingReviewFor` stops returning it — so without this the section
            would simply vanish and a supervisor would be left checking History
            to find out whether their commit landed. The confirmation occupies
            the same slot, quieter than the card it replaces: one line, muted
            ink, no border, no action.
            SHIPPED AS THE STATIC SWAP, per the brief's own escape clause. The
            compress-in-place choreography is a height animation on a card that
            is already unmounted by the time the line renders, which would mean
            keeping a dead review in state purely to animate it. `motion-reduce`
            gets the same thing, which is the other half of why this is the
            honest version. */}
        {reviewed && (
          <p
            data-record-section="review-resolved"
            aria-live="polite"
            className="text-[13px] leading-[18px] text-[var(--text-muted)] transition-opacity duration-200 motion-reduce:transition-none"
          >
            {/* TODO-COPY */}
            Reviewed ·{" "}
            {reviewed.changed
              ? `changed to ${reviewed.code}`
              : `${reviewed.code} unchanged`}{" "}
            · just now
          </p>
        )}

        <div ref={cardRef}>
        <CareTaskRegion
          tasks={tasks}
          reviewProps={{
            /* ═══ ONE CALLBACK, AND IT OPENS THE WORKSPACE ═══
               `onChangeRequest` and `onApproveRequest` are gone with the ellipsis
               and the Approve button they drove. The card no longer decides
               anything: confirm and change are peer outcomes of one decision, and
               that decision — with its commit — lives only in the drawer.

               ABSENT BELOW SUPERVISOR TIER, not disabled. Passing undefined is how
               the card renders no action row at all, which is the same tier gate
               the two old callbacks carried. */
            onReviewRequest:
              canAct && review
                ? () => {
                    returnFocusTo.current =
                      document.activeElement as HTMLElement | null;
                    /* Opening always tips to the review — State 1 is the
                       default on Review, per the see-saw spec. */
                    expandCard();
                  }
                : undefined,
            /* ═══ THE CARD IS THE WORKSPACE WHEN OPEN ═══ */
            expanded: reviewInProgress,
            onCollapse: () => setReviewOpen(false),
            workspace: workspaceNode,
            /* So an in-progress review is discoverable without expanding it. */
            hasDraft: hasSavedDraft,
            currentCode: presentation?.code ?? null,
            /* THE SAME PENDING CHANGE THE WORKSPACE READS. The card owns the
               control and the delta bar; the workspace owns the CTA that commits
               it. Both read this one value, so they cannot disagree about what is
               about to happen. */
            currentStatement: presentation?.statement ?? null,
            decision,
            onDecisionChange: canAct ? setDecision : undefined,
          }}
        />
        </div>

        {/* 3 · THE ENGAGEMENT READING IS NOT A SECTION HERE. It floated in this
            column once, where it read as unattributed commentary — a reader
            could reasonably ask "summary of what?". `care-ai-summary.tsx` is
            deleted and `careAiSummaryFor` was replaced by `careReadingFor`.
            What survives of it is ONE MUTED CONTEXT LINE in the evidence
            document's header: engagement informs a clinical read without
            competing with it, and a paragraph of it above the record's own
            findings inverted that. */}

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

        {/* ═══ THE CARE PATTERN CARD WAS HERE ═══
            Heading, one to three generated sentences, a timeline strip, a
            provenance footer. The STRIP moved into the summary's trajectory
            element as `CareSparkline`; the NARRATIVE is deleted.
            Why the narrative goes: it and the trajectory sentence were two
            generated descriptions of the same scores on one page, far enough
            apart that a reader might not notice they agreed — or notice they
            didn't. One narrative, one visual.
            What is not lost: the clustering its prose described ("two fell
            within 19 days of each other") reads off two triangles 19 days apart
            on the strip's shared axis. */}
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
          {/* ═══ THE NAME LINKS TO TEAM, NOT TO A PROFILE ═══
              A staff self-profile route does not exist — that work is deferred —
              so this goes to the Team page, which is where a reader can actually
              find them today. NOT a dead link and NOT a link to nothing: the
              eventual destination is a staff profile, recorded as
              design-system-gaps row 314 so the redirect is replaced rather than
              rediscovered. */}
          <Link
            href="/app/team"
            className="rounded-sm underline underline-offset-2 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          >
            Dr. Nissan
          </Link>
          {" is the final decision-maker on all clinical notes and determinations on this page."}
        </p>
      </div>


      {/* ── THE DERIVED RAIL ──────────────────────────────────────────────
          `min-[1100px]` only. Sticky below the tab row so the summary stays
          beside whichever part of the spine the reader has scrolled to — the
          evidence is meant to be read WITH the record, not before it.

          TIER RULE: every tier reads the document; only Refresh is
          supervisor-gated, and it is ABSENT below that tier rather than
          disabled. Nothing in here approves, writes, amends or closes anything,
          and it never authors a record entry — only `approveCareReview` does.
          That is the provenance boundary the two columns exist to draw. */}
      {/* ═══ THE CARE SUMMARY RAIL — PERMANENT ═══
          Restored to exactly what it was before any of the review work: one
          in-flow column, always full, never condensed and never duplicated. The
          review no longer needs anything from this track, so nothing here has a
          reason to move — which is the point of putting the workspace inside the
          card instead. */}
      {summaryNode && !summaryOverlayOpen && (
        <aside
          /* TODO-COPY */
          aria-label="Care summary"
          className="hidden min-w-0 min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:block"
        >
          {summaryNode}
        </aside>
      )}

      {/* ── BELOW 1100px: THE SAME NODE, IN AN OVERLAY ────────────────────
          A right-edge panel rather than a bottom sheet, for the reason the
          `side` variant exists: the summary is tall — trajectory sentence,
          sparkline, three chip groups — and a sheet bounded at 90dvh minus its
          own header and close control either scrolls inside a box already the
          height of the screen or shrinks the strip past reading.
          Radix portals it, so it sits outside the grid and occupies no column. */}
      {summaryNode && (
        <Dialog open={summaryOverlayOpen} onOpenChange={setSummaryOverlayOpen}>
          <DialogContent variant="side" className="min-[1100px]:hidden">
            <DialogHeader>
              {/* TODO-COPY. A panel over the record has no context around it, so
                  it names what it is showing — and with a review in progress the
                  sheet is holding both units, so it says so. */}
              <DialogTitle>Care summary</DialogTitle>
            </DialogHeader>
            {/* ═══ THE SAME SEE-SAW, NOT A SECOND LAYOUT ═══
                Below 1100px the right column has nowhere to be, so the whole slot
                moves into the sheet the summary already used — same component,
                same two units, same tipping. R2 had a separate overlay mode for
                the drawer with its own dimensions and its own minimize control;
                that was a second implementation of one idea, and it is gone. */}
            <DialogBody>{summaryNode}</DialogBody>
          </DialogContent>
        </Dialog>
      )}

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
