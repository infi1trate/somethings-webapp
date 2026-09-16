"use client";

// THE DETAIL PANE (§5). One frame, three bodies, a sticky footer per task type.
//
// SHARED FRAME: header (teen + age, mentor, domain chip, opened time, breach chip)
// → independently scrolling body → sticky footer action bar. The footer is sticky
// because the body can be long and the decision must never be below the fold on a
// surface whose entire job is deciding.
//
// THIS IS WHERE FLAGGED CONTENT LIVES, AND THE ONLY PLACE (locked decision 12).
// The quoted excerpt renders here and nowhere else; the worklist has no code path
// to it.
//
// ESCALATIONS ARE READ-ONLY (§5, locked decision 3). Nothing on the escalation body
// mutates state and its single footer action routes out. `resolveWithUndo` throws
// if handed one, so the rule is enforced twice — once by not offering a control,
// once by the utility refusing.
//
// ONE PRIMARY BUTTON PER REGION. With the Next-up strip gone the page has no
// primary above the list at all, so the footer's confirm — "primary within the
// pane" in §5's words — is the only filled button on the surface. It uses
// PillButton; every other control here is a RecordButton.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ExternalLink, MessageSquare } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { RecordButton } from "@/components/record/record-button";
import { ReviewBody } from "@/components/record/review-body";
import { billingReviewFor } from "@/lib/tasks/billing-presentation";
import type { ReviewDecision } from "@/lib/record/review-draft";
import {
  BillingReview,
  type BillingCommitDetail,
  type BillingSubmitHandle,
} from "@/components/tasks/billing-review";
import { elapsedLabel } from "@/components/tasks/strips";
import { chatThreadHref } from "@/lib/record/chat";
import {
  EscalationCtas,
  EscalationMeta,
  EscalationTaskPane,
  type EscalationPaneHandle,
} from "@/components/tasks/escalation-task-pane";
import type { CompletedEntry } from "@/components/tasks/completed-group";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import { deadlineFactFor } from "@/lib/tasks/deadline-buckets";
import { TASK_KIND_LABEL } from "@/lib/tasks/task-kind";
// Still used by the BILLING pane's Notes link — a different block from the
// risk-flag excerpt. (It read "AI-summary link" until that block's label became
// "Notes"; the link itself is unchanged.)
import {
  buildConversation,
  conversationHref,
  firstNameOf,
} from "@/lib/tasks/conversation";
import { ConversationExcerpt } from "@/components/tasks/conversation-excerpt";
import {
  isBreached,
  type BillingPayload,
  type RiskFlagPayload,
  type TaskItem,
} from "@/lib/tasks/types";
import { tierLabel } from "@/lib/tasks/bands";
import { isEscalationTask } from "@/lib/tasks/escalation-state";
import { dispositionDetail, dispositionFor } from "@/lib/tasks/disposition";
import {
  PANE_LABEL,
  PaneChip,
  SystemBlock,
} from "@/components/ui/evidence-primitives";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ THE PANE PRIMITIVES MOVED TO `ui/evidence-primitives.tsx` ═══
 *
 *  `LABEL`, `SystemBlock`, `QuoteBlock` and `Chip` were defined here and are now
 *  imported, unchanged, because the Activity evidence pane needs the same section
 *  rhythm. The alternative was a second `QuoteBlock` that starts identical and
 *  drifts — and a teen's own message rendered two subtly different ways on two
 *  staff surfaces is the drift that matters least to a developer and most to a
 *  reader. The rationale comments travelled with them, including the gap-row
 *  citations (218, 219, 290).
 *
 *  ALIASED SO THE BODIES BELOW ARE UNTOUCHED: this file's call sites still read
 *  `LABEL` and `<Chip>`, so the extraction changed no rendered DOM here. */
const LABEL = PANE_LABEL;
const Chip = PaneChip;


/** ═══ THE EXCERPT FAILS INDEPENDENTLY ═══
 *
 *  Its own state, threaded from the pane rather than derived from the pane's, so
 *  an excerpt that cannot load never blocks the rest of the body or the resolve
 *  actions. That is the whole requirement: a supervisor who cannot see the
 *  transcript can still act on the flag, and one who can see it is not waiting on
 *  anything else. */
export type ExcerptState = "ready" | "loading" | "error";

// ── Bodies ──────────────────────────────────────────────────────────────────

function RiskFlagBody({
  payload,
  teenId,
  item,
  now,
  excerptState,
  onRetryExcerpt,
}: {
  payload: RiskFlagPayload;
  teenId: string;
  item: TaskItem;
  now: number;
  excerptState: ExcerptState;
  onRetryExcerpt: () => void;
}) {
  /** THE FLAGGED LINE IS THE ANCHOR, verbatim — see `buildConversation`. Built
   *  per render rather than memoised: it is a pure function of three values the
   *  pane already holds, and the fixture is ~20 objects. */
  const conversation = buildConversation(item, payload.flaggedExcerpt, now);
  return (
    <div className="space-y-4">
      {/* ═══ THE "TYPE / MESSAGE" ROW IS GONE (Part 5) ═══
          A labelled row whose value is "Message" on every flag in the system is
          not a fact, it is furniture: it costs two lines at the top of the pane —
          the first two lines, above the excerpt — to tell a supervisor something
          that has never once been different. And the excerpt directly below it is
          visibly a conversation, so even the fact it states is already stated.
          It survives as a CHIP, and only when it says something. The day flags
          start arriving from a video note or a journal entry, that chip appears
          beside the categories, where a reader is already looking for what makes
          this flag different from the last one. */}
      <div>
        <p className={LABEL}>{/* TODO-COPY */}Category</p>
        {/* PLAIN-LANGUAGE PLAYBOOK CATEGORIES (§5). Raw enum values never reach
            this surface — the seed carries prose. */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {payload.categories.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
          {payload.sourceType !== "Message" && <Chip>{payload.sourceType}</Chip>}
        </div>
      </div>

      {/* ═══ THE CONVERSATION, NOT A QUOTE (Part 1) ═══
          The `QuoteBlock` that lived here showed the flagged line alone. It
          answered "what was said"; the question this pane asks — "was this
          flagged correctly?" — is about what surrounds it. "idk it's fine" is
          unremarkable after a joke and worth a second look after a disclosure,
          and one line cannot tell those apart.
          THE STRING IS THE SAME ONE. `flaggedExcerpt` is placed verbatim at the
          anchor, so the rationale below still quotes a sentence the reader can
          see in the transcript. */}
      <div>
        <p className={LABEL}>{/* TODO-COPY */}Conversation</p>
        <div className="mt-2">
          <ConversationExcerpt
            conversation={conversation}
            teenName={firstNameOf(item.teenDisplayName)}
            href={conversationHref(teenId, conversation.anchorId)}
            state={excerptState}
            onRetry={onRetryExcerpt}
          />
        </div>
      </div>

      <div>
        <p className={LABEL}>{/* TODO-COPY */}Why this was flagged</p>
        <div className="mt-2">
          <SystemBlock label="AI rationale">{payload.aiRationale}</SystemBlock>
        </div>
      </div>
    </div>
  );
}

/* ═══ THE PRESENTATION COMPARISON: THREE OWNERS, AND NOW ONE ═══
   `ChangeSide` lived here. It became `record/presentation-diff.tsx` — a shared
   two-column Current → Recommended block with three proposal kinds and a chip —
   on the reasoning that the same clinical comparison was being drawn two ways on
   the two surfaces that commit it.
   THE PRODUCT OWNER SETTLED IT THE OTHER WAY: the Care page is the reference
   standard, so the diff was reverted OFF Care and left as a Tasks-only
   component. That made it a shared component with one consumer, which is a
   single component with extra steps.
   `review-module-02-tasks-host` ends it. This pane renders `ReviewBody` — the
   Care card's own review — so the comparison is drawn once, by the module both
   surfaces use, and `presentation-diff.tsx` is DELETED rather than kept as
   surface with no reader. Its one idea that does not survive is the two-column
   layout; what replaced it is the module's recommendation line plus an "On
   record" row in the host's context strip, which states the same two facts in
   the order a supervisor reads them. */

/** ═══ THE RECORD CONTEXT ACCORDION (arch-F, F2) ═══
 *
 *  The mentorship figures — days, messages, video — were half of a two-cell strip
 *  at the top of the pane, which put them above the recommendation they are
 *  context for. They are a thing a supervisor CONSULTS when the recommendation
 *  looks surprising, not a thing they read every time, so they are collapsed.
 *
 *  BUILT HERE RATHER THAN IN THE MODULE, and minimal by intent: the parity work
 *  specifies a Record context accordion and this pane has none (arch-F's recon
 *  confirmed the only disclosure in the module is the score strip's). This is the
 *  Tasks-only version — one section, the figures it already had — so that when
 *  the real one lands there is one place to replace and nothing of the old header
 *  left behind.
 *
 *  A REAL <button> WITH `aria-expanded`, the whole row as the target, the caret
 *  `aria-hidden` — the same arrangement the score strip settled on. */
function RecordContext({ payload }: { payload: BillingPayload }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[var(--radius-inset)] border border-[color:var(--border-contour)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-slot="record-context"
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 px-3.5 text-left",
          "transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <span className="text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]">
          {/* NEEDS-COPY-NICOLE */}
          Record context
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          {/* THE HEADLINE FIGURE STAYS VISIBLE COLLAPSED. A disclosure whose
              closed state says nothing is a disclosure nobody opens; the
              mentorship length is the one figure that changes how the rest
              reads. */}
          <span className="tabular-nums">
            {payload.mentorStats.daysInMentorship} days in mentorship
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 transition-transform motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {open && (
        <dl className="grid gap-3 border-t border-[color:var(--border-subtle)] px-3.5 py-3 sm:grid-cols-2">
          {[
            /* ═══ THE DURATION IS NOT REPEATED (arch-G, G1) ═══
               The collapsed header states "140 days in mentorship" and this list
               stated "In mentorship · 140 days" again six pixels below it. The
               header keeps the duration — it is the figure that changes how the
               other two read — and the body holds only what the header does not
               say. NEEDS-COPY-NICOLE on both labels; the window is named,
               because "62 messages" without "last 30 days" cannot be sized. */
            ["Messages, last 30 days", `${payload.mentorStats.messagesLast30}`],
            ["Video calls, last 30 days", `${payload.mentorStats.videoLast30}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className={LABEL}>{label}</dt>
              <dd className="mt-1 text-[14px] leading-[20px] tabular-nums text-[var(--text-primary)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** ═══ THE BILLING BODY — NOW A WRAPPER AROUND THE REVIEW ═══
 *
 *  What it still owns: the generated rationale block and the two survey /
 *  mentorship facts, because both are statements about THIS pane's payload and
 *  neither is part of the decision form. What it handed over: the diff, the
 *  documentation fields, the validation and the commit, all of which are now
 *  `BillingReview` — see the note on that module for why a code no longer
 *  commits without documentation. */
function BillingBody({
  payload,
  item,
  recommended,
  decision,
  onDecisionChange,
  onCommit,
  handleRef,
  onGapsChange,
  onBlocked,
}: {
  payload: BillingPayload;
  item: TaskItem;
  recommended: { code: string; statement: string };
  decision: ReviewDecision | null;
  onDecisionChange: (next: ReviewDecision | null) => void;
  onCommit: (detail: BillingCommitDetail) => void;
  handleRef: React.MutableRefObject<BillingSubmitHandle | null>;
  onGapsChange: (gaps: number) => void;
  onBlocked: () => void;
}) {
  /** ═══ THE SHARED REVIEW MODULE, FINALLY HOSTED HERE ═══
   *
   *  `review-module-01-extract` pulled `ReviewBody` out of the Care card with
   *  seventeen DOM parity snapshots proving Care did not move. This is the second
   *  half, and it retires the composition that stood in for it: a `Notes` block
   *  where Care says `Rationale`, an `Assigned survey` metadata cell and a
   *  `ScoreLozenge` where Care has a score strip with the answers behind it, a
   *  two-column `PresentationDiff`, and no provenance affordance anywhere.
   *
   *  ONE CLINICAL DECISION, ONE PRESENTATION OF IT. A supervisor who opens a
   *  review from the record and the same review from the queue was reading two
   *  arrangements of one thing with no way to tell which parts were the same.
   *
   *  ═══ WHAT THE HOST STILL OWNS, AND WHY THAT IS THE RIGHT SPLIT ═══
   *
   *  The module is the REVIEW. The host is the CONTEXT. On the Care page the
   *  context is the page itself — the summary document states the mentorship and
   *  the metadata strip states the code in force — so the module never had to
   *  carry either. Tasks has no page around its pane, so the strip below supplies
   *  both. That is what makes a shared module possible rather than a lowest
   *  common denominator.
   *
   *  ═══ THE ON-RECORD LINE IS NOT OPTIONAL HERE ═══
   *
   *  `ReviewBody` reads `currentCode` to decide WHICH KIND of proposal this is
   *  and to mark "On record" in the picker, and it never DISPLAYS it — which is
   *  fine on Care, where the strip above the card states it, and would be a
   *  regression here, where nothing else on the pane does. Recorded as a cost in
   *  `presentation-diff.tsx` during the arch-A recon, and paid here rather than
   *  carried. */
  return (
    <BillingReview
      item={item}
      payload={payload}
      recommended={recommended}
      onCommit={onCommit}
      handleRef={handleRef}
      recordContext={<RecordContext payload={payload} />}
      onGapsChange={onGapsChange}
      onBlocked={onBlocked}
    >
      {/* `canAct` AND `interactive` ARE BOTH TRUE, unconditionally. Care passes
          its card's `expanded` for `interactive` because its review lives inside
          a collapsible; this pane IS the review, so there is no collapsed state
          for a pending change to hide in. `canAct` is the tier gate, and only a
          supervisor tier reaches this route at all. */}
      <ReviewBody
        review={billingReviewFor(item, payload)}
        currentCode={payload.current?.code ?? null}
        currentStatement={payload.current?.statement ?? null}
        /* ═══ THE HOST OPTS IN (arch-F) ═══
           The code on record now renders as a quiet line beneath the
           recommendation title, where the parity spec always wanted it. Care does
           not pass this: its spine states the code above the card, and the
           seventeen parity snapshots forbid changing what that page draws. */
        showCurrentLine
        decision={decision}
        onDecisionChange={onDecisionChange}
        canAct
        interactive
      />
    </BillingReview>
  );
}

/* ═══ `EscalationBody` IS GONE (arch-G, G4) ═══
   It was the read-only pointer: four facts, a context excerpt, and a closing
   sentence whose job was to say that the work happened somewhere else.
   `EscalationTaskPane` replaces all of it — the facts as `Facts`, the mentor and
   conversation as `Record context`, and the excerpt as the timeline's TEEN
   CONVERSATION source, which shows the same messages verbatim and, unlike the
   excerpt, next to the flags and the system events that share their window. The
   link out to the full thread is not lost: `EscalationCtas` carries it.
   THE ONE THING THE SWAP COSTS, stated: the excerpt drew from
   `buildConversation(item, …)`, the surface's own conversation builder, while the
   timeline's teen messages are fixtures (G0: the support thread is not queryable
   by pair or window). Two sources for one set of messages is exactly the fork
   this file's notes warn about, and it is a gap row rather than a fix here. */

// ── The frame ───────────────────────────────────────────────────────────────

/** ═══ WHAT THE KEYBOARD CAN PRESS (Part 3) ═══
 *
 *  `y` / `n` / Enter act on the pane's controls, but the LISTENER lives on the
 *  page — one keyboard layer, one "is someone typing" guard, one dialog guard.
 *  So the pane publishes its two decisions into a ref the page holds.
 *
 *  This exists because of `override`: the recommended code is not `item`'s code
 *  once a supervisor has picked a different one from the DSM-5 dialog, and that
 *  choice is pane state. A page-level Enter that read `item.payload.recommended`
 *  would confirm the code the model suggested rather than the one on screen —
 *  silently, on a minor's billing record. Either the state moves up or the action
 *  comes down; the action is smaller. */
export interface PaneActions {
  /** Present only for flag items, at any tier. */
  answer?: (correct: boolean) => void;
  /** Present only for billing items, and it carries the OVERRIDE. */
  confirm?: () => void;
}

export function TaskPane({
  item,
  now,
  onResolve,
  actionsRef,
  /** THE EXCERPT'S OWN STATE, from the page's load-state axis. Separate from the
   *  pane's so the two can disagree — which is the point: the dev harness must be
   *  able to fail the excerpt while the pane succeeds. */
  excerptState = "ready",
  /** ═══ THE EVENTS ARE FOR THE ESCALATION TIMELINE'S FLAG JOIN ═══
   *  Not optional, and that is the point: `flagsInWindowFor` joins real flags on
   *  the same teen inside the escalation window, so a default of `[]` would make
   *  the timeline silently drop entries that exist — on the surface whose whole
   *  claim is that it shows what happened. An empty ARRAY from the page is a
   *  statement that there are no flags; an omitted prop is a wiring mistake, and
   *  the two must not look the same. */
  events,
  /** ═══ READ-ONLY, BECAUSE THE DECISION IS ALREADY A RECORD (arch-F, F4) ═══
   *  Set when the selection is a row from "Completed today". The review renders
   *  with `canAct={false}` — the module's own tier gate, which already drops the
   *  proposal chip and the picker — and the action bar is replaced by what was
   *  submitted and when. A live Submit over a closed review would offer to commit
   *  it a second time. */
  completed = null,
}: {
  item: TaskItem | null;
  now: number;
  /** Fires with the pane's detail; the page owns resolveWithUndo. */
  onResolve: (item: TaskItem, detail: Record<string, unknown>) => void;
  /** Where the pane publishes its keyboard-reachable actions. See PaneActions. */
  actionsRef?: React.MutableRefObject<PaneActions>;
  excerptState?: ExcerptState;
  events: MonitoringEvent[];
  completed?: CompletedEntry | null;
}) {
  /** RETRY IS LOCAL AND REAL. The fixture is synchronous, so "retry" is a
   *  re-render — but a reader cannot tell that, and a Retry that did nothing
   *  would be worse than none. `retryNonce` forces the excerpt to remount, which
   *  re-runs the anchor scroll and clears the error the caller set. */
  const [retryNonce, setRetryNonce] = useState(0);
  /** ═══ THE GATE'S COUNT, FOR THE FOOTER (arch-F, F3) ═══
   *  Published by `BillingReview`, whose gate owns the definition of "empty".
   *  Held here because the footer is the pane's, and stated there because a
   *  supervisor should know the commit is blocked before pressing the button
   *  rather than after. */
  const [gaps, setGaps] = useState(0);
  /** Set by a blocked submit, cleared by the next keystroke that changes the
   *  count. The difference between the two sentences is real: the count is a
   *  standing fact, this is what just happened. */
  const [blocked, setBlocked] = useState(false);
  /** ═══ STABLE, AND THAT WAS A BUG ═══
   *  These were inline arrows. `BillingReview` publishes the count from an effect
   *  keyed on `[gaps.length, onGapsChange]`, so a new function identity every
   *  render re-ran the effect every render — which called `setBlocked(false)`
   *  immediately after a blocked press set it true, and the footer never showed
   *  the blocked sentence. Measured: the status stayed "3 fields needed" through
   *  a refused submit. */
  const onGapsChange = useCallback((n: number) => {
    setGaps(n);
    setBlocked(false);
  }, []);
  const onBlocked = useCallback(() => setBlocked(true), []);
  const effectiveExcerptState: ExcerptState =
    retryNonce > 0 ? "ready" : excerptState;
  /* ═══ THE OVERRIDE BELONGS TO ONE ITEM, AND ONLY ONE ═══
     The pane does not unmount between reviews — resolving auto-advances to the
     next item in the same component — so a code picked for Jordan's intake was
     still sitting in `override` when Riley's arrived, and the footer offered to
     confirm it. On a minor's billing record.
     Fixed by STORING THE ITEM'S ID WITH THE CHOICE and deriving whether it still
     applies, rather than by resetting the state in an effect when `item` changes.
     A reset runs one render LATE: there is a frame in which the new item is on
     screen and the old code is still in state, which is precisely the frame a
     fast keyboard resolve lands in. Derivation has no such frame. */
  const [override, setOverride] = useState<
    { id: string; code: string; statement: string } | null
  >(null);
  const activeOverride =
    override && override.id === item?.id
      ? { code: override.code, statement: override.statement }
      : null;
  /* `pickerOpen` AND `pickerTrigger` WENT WITH THE PICKER. Both existed to open
     a `Dsm5SearchDialog` this pane mounted and to hand focus back to the button
     that opened it; `ReviewBody` owns that dialog and that focus return now. */
  /** ═══ WHERE THE REVIEW PUBLISHES ITS GATE ═══
   *  The footer's Submit and the keyboard's ⌘/Ctrl+Enter both have to run the
   *  SAME three-field validation, and the state it validates lives inside the
   *  review. So the action comes up into this ref rather than the form's state
   *  going down — the same trade the `override` fix made, for the same reason:
   *  the action is the smaller thing to move. Null whenever the mounted body is
   *  not a billing review, which is what the footer checks. */
  const billingHandle = useRef<BillingSubmitHandle | null>(null);
  /** ═══ THE ESCALATION PANE'S, FOR THE SAME REASON (arch-G, G4) ═══
   *  Its primary is in the footer and the state it acts on — the chosen
   *  disposition — is inside `EscalationTaskPane`. Same trade as above. */
  const escalationHandle = useRef<EscalationPaneHandle | null>(null);
  /** Set by a refused press, cleared the moment a disposition is chosen. The
   *  response has no count to state, so the only sentence it can offer is what
   *  just happened — which is why the gate is a refused submit rather than a
   *  disabled button: a disabled primary with no explanation is the failure
   *  mode the billing footer already avoids. */
  const [escalationBlocked, setEscalationBlocked] = useState(false);
  const onDispositionChange = useCallback(() => setEscalationBlocked(false), []);
  /** ═══ THE DOCUMENTATION NOTE'S ACTION ROW LANDS HERE ═══
   *  State, not a ref, because the portal has to re-render once the node exists:
   *  a ref written during commit is invisible to the render that reads it, so the
   *  row would stay in its inline fallback until something else re-rendered the
   *  pane. The module renders it inline while this is null, so the row is never
   *  absent — it moves. */
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);

  /* ═══ THE AUTO-ADVANCE CROSSFADE (Part 5) ═══
     Resolving replaces the pane's ENTIRE contents in one frame — new name, new
     excerpt, new rationale — while the reader's eye is still on the button they
     pressed. With no transition it reads as a flicker, and worse, as though
     nothing happened: the pane is the same shape in the same place with different
     words in it, and a supervisor forty flags into a shift genuinely loses track
     of whether their keystroke registered.
     120ms is the whole budget. Long enough to register as a change of subject,
     short enough that it never becomes a wait — this fires fifty times a shift,
     and anything slower would be a tax on the loop the keyboard shortcuts exist
     to speed up. Opacity only: no slide, no scale, nothing that suggests the pane
     moved somewhere.
     `motion-reduce` drops it, and the content swaps instantly. */
  /* ═══ SNAP TO ZERO, THEN FADE IN — TWO PHASES, NOT ONE FLAG ═══
     The first version toggled one boolean with the transition always declared,
     and that does NOT produce a fade in. The layout effect runs AFTER React has
     committed the new content, so the transition's start value is the previously
     painted opacity of 1 — the browser animates 1 → 0, and reversing two frames
     later gives a dip and a recovery. A flicker, which is the thing this was
     meant to remove.
     MEASURED, and it is why the phases exist: the probe sampled opacity on every
     frame across the advance and read exactly 1.00 for all 44 of them, while
     `data-faded` was correctly flipping and the element correctly carried
     `opacity-0`. The class was right and the animation was wrong.
     `snap` sets opacity 0 with NO transition, so it lands there instantly and
     invisibly; the next frame turns the transition on and goes to 1. */
  const [phase, setPhase] = useState<"idle" | "snap" | "in">("idle");
  const lastItemId = useRef<string | null>(item?.id ?? null);
  /* `useLayoutEffect`, NOT `useEffect`, and the difference is the whole effect.
     With a passive effect React paints the new content at full opacity FIRST and
     the fade-out runs after — so a reader sees the next flag flash, disappear,
     and come back. A layout effect flushes the opacity-0 state before that paint,
     so the browser never shows the intermediate frame and the transition is a
     clean fade in. */
  useLayoutEffect(() => {
    const id = item?.id ?? null;
    /* ═══ NULL IS A TRANSIENT, NOT A DESTINATION ═══
       MEASURED: the fade never fired. A resolve does not go A → B, it goes
       A → null → B — the item leaves the open set, the pane has nothing for one
       render, and the auto-advance supplies the next one. The first version
       treated the null as an item change, wrote it to `lastItemId`, and then saw
       B arrive "from nothing" and declined to fade. Opacity sampled 1.00 across
       44 frames, which is how this was found rather than by watching for a
       120ms transition with the naked eye.
       Ignoring the null keeps A on the ref, so B is correctly an advance FROM A.
       It also means leaving to a genuinely empty list does not fade — which is
       right: there is nothing to fade to. */
    if (id === null) return;
    if (lastItemId.current === id) return;
    // ONLY BETWEEN TWO ITEMS. Arriving at the first selection is not an advance —
    // fading in from nothing on open would put a delay on the pane's first paint.
    const advance = lastItemId.current !== null;
    lastItemId.current = id;
    if (!advance) return;
    setPhase("snap");
    /* ONE FRAME AT ZERO, then the fade. rAF rather than a short timer: a timer
       shorter than a frame can coalesce both style changes into a single recalc,
       and a transition with no earlier computed start value does not run at all. */
    const raf = requestAnimationFrame(() => setPhase("in"));
    return () => cancelAnimationFrame(raf);
  }, [item?.id]);

  /* PUBLISH THE KEYBOARD-REACHABLE ACTIONS. Before the early return, because
     hooks cannot live after one — and it has to handle the no-item case itself
     rather than being skipped, or the page would keep pressing the last item's
     buttons after the list emptied. */
  const payload = item?.payload;
  const confirmCode =
    payload?.kind === "billing" ? (activeOverride ?? payload.recommended) : null;
  useEffect(() => {
    if (!actionsRef) return;
    if (!item || !payload) {
      actionsRef.current = {};
      return;
    }
    actionsRef.current = {
      // Flags only, at any tier — an escalation has no correctness question,
      // and locked decision 3 says nothing on its pane resolves anything.
      answer:
        payload.kind === "riskFlag"
          ? (correct: boolean) =>
              onResolve(item, dispositionDetail(dispositionFor(correct)))
          : undefined,
      /* ═══ IT RUNS THE GATE NOW, AND IT IS NOT REACHED BY BARE ENTER ═══
         This used to call `onResolve` directly with the code and nothing else —
         the one-click commit, reachable from a list row with a single keypress.
         It now presses the review's published submit, which validates the three
         documentation fields first and refuses with focus and a live-region
         sentence when they are empty.
         Bare Enter no longer routes here: `onEnter` returns false for billing so
         the key moves the keyboard into the pane instead. `⌘/Ctrl+Enter` is what
         reaches this. */
      confirm:
        payload.kind === "billing"
          ? () => billingHandle.current?.submit()
          : undefined,
    };
  }, [actionsRef, item, payload, confirmCode, onResolve]);

  if (!item) {
    return (
      <div className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-5">
        <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          Select a task to review it.
        </p>
      </div>
    );
  }

  const p = item.payload;
  const breached = isBreached(item, now);
  const recommended =
    p.kind === "billing" ? (activeOverride ?? p.recommended) : null;

  return (
    /* ═══ THE PANE IS THE FRAME'S HEIGHT, NOT THE VIEWPORT'S (Part 1.2) ═══
     *
     *  `max-h-[calc(100dvh-8rem)]` was a GUESS at the space available — it
     *  subtracts a constant for chrome the pane cannot see, so it is wrong by
     *  whatever the header, the tab-cards and the shell's own reserves actually
     *  measure, and wrong differently at every viewport. `h-full` takes the
     *  height its grid cell was given, which is the real answer.
     *
     *  `min-h-0` for the same reason as the page root: without it the body
     *  refuses to shrink below its content and the footer is pushed out of the
     *  box rather than the body scrolling. */
    <div
      data-slot="task-pane"
      data-anno-ref="task-pane"
      /* ═══ `max-h-full`, NOT `h-full` (arch-F, F3) ═══
         With `h-full` and the action bar now hugging its content, a short review
         left ~190px of empty card BELOW the bar — the gap moved rather than
         went away, and a card that ends 190px past its own footer reads as
         unfinished. `max-h-full` lets the card end where the bar does and still
         caps it at the cell, so the overflow case is unchanged. */
      className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      {/* ── HEADER — pinned inside the pane (arch-F rebuilt it) ─────────── */}
      {/* ═══ WHAT THE OLD HEADER SAID, AND WHY EACH PART MOVED ═══
          It was: the teen's name, an age, a breach chip, and "to {mentor}".
          · THE MENTOR IS GONE. The same leftover the rows dropped in arch-E: the
            mentor does not perform a billing review, is not accountable for it,
            and cannot change its outcome — the code derives from survey data.
            This was its last display on the surface (the transcript still uses
            the field for its sender names).
          · THE TASK TYPE ARRIVED, above the heading, small — the pane's
            equivalent of the Care attention band's identifying chip, and the
            answer to "what am I being asked to do" before "about whom".
          · THE META LINE now carries the age AND the due fact in the same
            expression the row used, so a supervisor who selected a row reading
            "due 6:24 PM" sees the same words in the pane rather than a second
            spelling of the same instant.
          · THE TWO WAYS OUT live here. See the note on the CTAs. */}
      <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className={LABEL}>
              {/* NEEDS-COPY-NICOLE */}
              {TASK_KIND_LABEL[item.taskType]}
            </p>
            <h2
              /* THE PROBE'S HANDLE ON "WHOSE RECORD IS THIS" — the advance rule
                 is a statement about which record is on screen after a resolve,
                 and reading it off the heading is reading what a supervisor
                 reads. */
              data-pane-teen
              className="mt-0.5 font-display text-[20px] font-bold leading-[28px] text-[var(--text-primary)]"
            >
              {item.teenDisplayName}
            </h2>
            {isEscalationTask(item) ? (
              /* THE THREE INSTANTS AN ESCALATION HAS — opened, closed, due —
                 each stated once, and the response phase counts UP. Owned by the
                 escalation pane's own module so the two task types cannot drift
                 apart. */
              <EscalationMeta item={item} now={now} />
            ) : (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
              <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                {`${elapsedLabel(item.openedAt, now)} open`}
              </span>
              {!isEscalationTask(item) && (
                <>
                  <span aria-hidden className="opacity-40">·</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      breached && "font-semibold text-[var(--band-clay-fg)]"
                    )}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {deadlineFactFor(item.slaDeadline, now, elapsedLabel)}
                  </span>
                </>
              )}
              {/* ═══ THE CHIP IS GONE FROM HERE TOO (arch-G, G1) ═══
                  arch-F replaced its misleading label (`Past 3d`, the SLA's
                  LENGTH) with "Overdue" — still a second statement beside
                  "overdue by 9h". The meta line reads `3d open · overdue by 9h`
                  and the due fact carries the breach ink, which is the same rule
                  the rows now follow. */}
            </p>
            )}
          </div>

          {/* ═══ THE TWO WAYS OUT, AND WHY THEY ARE HERE AND NOT ON THE ROWS ═══
              At 19–100 rows, two or three controls per row puts 40–300 targets in
              a column whose only job is scanning — Hick's Law, and every one of
              them a chance to leave the queue by accident. Navigation away from
              triage is a deliberate, occasional act; selecting a row fills this
              pane instantly, so the pane header IS the row's control surface.
              TERTIARY, DELIBERATELY: text buttons with icons, no fill, no border.
              They must not compete with the recommendation title below them or
              with the footer's Submit, which is the one primary on the pane. */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1">
            {/* ═══ ONE SOURCE FOR THE SET, PER TASK KIND (arch-G, G4) ═══
                MEASURED: two "View care profile" links, identical href, side by
                side. `EscalationCtas` carries the escalation set — care profile,
                conversation, escalation record — and this link rendered
                unconditionally alongside it. A duplicated way out is not
                harmless in a cluster whose whole design note above is about not
                competing for the eye: it doubles one destination's weight
                against the two beside it. */}
            {!isEscalationTask(item) && (
              <Link
                href={`/admin/person/${encodeURIComponent(item.teenId)}?tab=care`}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[12.5px] font-semibold",
                  "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                {/* NEEDS-COPY-NICOLE */}
                View care profile
              </Link>
            )}
            {/* ═══ THE CONVERSATION OPENS AT THE TOP, AND THAT IS A GAP ═══
                `conversationHref` builds `?msg=` and nothing reads it:
                `/app/chat` redirects through `chatThreadHref`, which takes a
                person id only. So the anchor is dropped today — logged as a gap
                row rather than papered over with a link that pretends to anchor.
                FOR A BILLING REVIEW THERE IS NO ANCHOR ANYWAY: nothing here was
                flagged, so there is no relevant message to land on, and the top
                of the thread is the honest destination even once `?msg=` works. */}
            {!isEscalationTask(item) && (
              <Link
                href={chatThreadHref(item.teenId)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[12.5px] font-semibold",
                  "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                {/* NEEDS-COPY-NICOLE */}
                View conversation
              </Link>
            )}
            {/* AN ESCALATION GETS A THIRD WAY OUT — the durable record. Its own
                component, so the two escalation task types carry the same set. */}
            {isEscalationTask(item) && <EscalationCtas item={item} />}
          </div>
        </div>
        {/* THE TIER, HEADER ONLY (§5) — risk flags do not reach this surface
            today, and the line is derived rather than deleted so it cannot come
            back wrong with the row type. */}
        {p.kind === "riskFlag" && (
          <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
            {tierLabel(p.tier)}
          </p>
        )}
      </div>

      {/* ── BODY, scrolls independently ─────────────────────────────────── */}
      {/* The crossfade wraps the BODY, not the pane: the header carries the teen's
          name and the age, and fading those out would take away the one line that
          tells the reader which record they just moved to. */}
      {/* ── THE BODY IS THE ONLY SCROLLING PART OF THE PANE ──
             `overscroll-contain` so reaching its end does not scroll the page
             behind it — and the excerpt inside contains its own overscroll too,
             so three nested regions each stop at their own edge. */}
      <div
        /* Exposed for the probe — the phases are invisible by design and a
           measurement that has to infer them from a computed opacity mid-
           transition is a measurement that cannot tell "no fade" from "a fade
           that has not started". */
        data-fade-phase={phase}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4",
          /* ═══ SCROLL PADDING FOR THE STICKY BAR (arch-F, F3) ═══
             The action bar is the last child of this scroller and sticks to its
             bottom edge, so a focus move to a field near the end would land the
             field UNDER it. `scroll-pb-24` reserves the bar's height plus a
             little, so browser-driven scrolling (Tab, the gate's own focus move)
             stops short of it. WCAG 2.4.11. */
          "scroll-pb-24",
          phase === "snap"
            ? "opacity-0 transition-none"
            : "opacity-100 transition-opacity duration-[120ms] ease-out motion-reduce:transition-none"
        )}
      >
        {p.kind === "riskFlag" && (
          <RiskFlagBody
            payload={p}
            teenId={item.teenId}
            item={item}
            now={now}
            excerptState={effectiveExcerptState}
            onRetryExcerpt={() => setRetryNonce((n) => n + 1)}
          />
        )}
        {p.kind === "billing" && recommended && completed && (
          /* ═══ THE CLOSED REVIEW, AS A RECORD ═══
             The module with `canAct={false}`: no proposal chip, no picker, no
             documentation gate. What a supervisor gets is what they submitted. */
          <ReviewBody
            review={billingReviewFor(item, p)}
            currentCode={p.current?.code ?? null}
            currentStatement={p.current?.statement ?? null}
            showCurrentLine
            decision={null}
            canAct={false}
            interactive
          />
        )}
        {p.kind === "billing" && recommended && !completed && (
          <BillingBody
            payload={p}
            item={item}
            recommended={recommended}
            /* ═══ ONE OVERRIDE, TWO VOCABULARIES ═══
               The pane has always held the supervisor's pick as
               `{id, code, statement} | null`, keyed to the item so a code chosen
               for Jordan's intake cannot still be sitting there when Riley's
               arrives. The shared module speaks `ReviewDecision`. The two mean
               the same thing — `pending ?? review.recommended` on one side is
               `activeOverride ?? p.recommended` on the other — so this translates
               at the boundary rather than migrating the pane's state to a shape
               the footer and the commit would then also have to learn. */
            decision={
              activeOverride
                ? {
                    kind: "change",
                    code: activeOverride.code,
                    statement: activeOverride.statement,
                  }
                : null
            }
            onDecisionChange={(next) =>
              setOverride(
                next?.kind === "change"
                  ? { id: item.id, code: next.code, statement: next.statement }
                  : null
              )
            }
            onCommit={(detail) => onResolve(item, detail)}
            handleRef={billingHandle}
            onGapsChange={onGapsChange}
            onBlocked={onBlocked}
          />
        )}
        {(p.kind === "escalation" || p.kind === "documentation") && (
          /* ═══ MITIGATION HAPPENS HERE NOW (arch-G, G4) ═══
             `EscalationBody` was a read-only pointer: facts, a context excerpt,
             and a button that sent the reader somewhere else. That was right
             while Tasks had no escalation task type and locked decision 3 meant
             "escalations are not resolved on this surface" — it is wrong now
             that the OBLIGATIONS are tasks. The record is still Monitoring's;
             what happens here is the work the task names.
             DECISION 3 IS NOT BROKEN BY THIS: nothing here resolves the
             ESCALATION. The response task records a disposition and the
             documentation task submits a note; the escalation's own lifecycle
             belongs to the record. */
          <EscalationTaskPane
            item={item}
            now={now}
            events={events}
            onResolve={onResolve}
            actionSlot={actionSlot}
            handleRef={escalationHandle}
            onDispositionChange={onDispositionChange}
          />
        )}


      {/* ═══ THE ACTION BAR (arch-F, F3) ═══
          IT STAYS BELOW THE DOCUMENTATION, and that is not a compromise: Submit
          attests to the fields above it, and moving it up would make it possible
          to commit a code before writing its justification — and would break the
          frozen-Care behaviour it inherits. Its weakness was a TREATMENT problem.
          WHAT CHANGED: it is now the last child of the SCROLLER, `sticky
          bottom-0`, rather than a `shrink-0` sibling of it. The difference is the
          short-content case, measured before this change: with a pane taller
          than its content the flex body stretched and left a 231px gap between
          the last field and the bar, which read as two buttons floating in
          space. Sticky-inside-the-scroller puts the bar directly under the
          content when there is little, and pins it to the bottom edge when there
          is more — one rule, both cases.
          SOLID FILL, TOP HAIRLINE, SLIGHT ELEVATION. The shadow is what makes it
          read as a bar in front of the content rather than the end of it. */}
      <div
        data-slot="task-pane-footer"
        className={cn(
          "sticky bottom-0 -mx-5 -mb-4 mt-4 border-t border-[color:var(--border-subtle)]",
          "bg-[var(--surface-card)] px-5 py-3.5",
          /* ═══ AN EXISTING TOKEN, NOT A NEW VALUE ═══
             The first two attempts were arbitrary values — `shadow-[0_-1px_3px_
             rgba(0,0,0,0.04)]` and then the slash form — and BOTH resolved to
             `rgba(0,0,0,0) 0px 0px 0px 0px`: the bar shipped with no elevation
             and the probe read it back as transparent, twice. `--shadow-tile` is
             the design system's own small raised-surface shadow (the sidebar's
             active tile uses it), it is defined for both themes, and it needs no
             new token. It is omnidirectional where a bar wants an upward hint —
             noted in the report as the one place a directional elevation token
             would earn its place. */
          "shadow-[var(--shadow-tile)]"
        )}
      >
        {p.kind === "riskFlag" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
              {/* TODO-COPY */}
              Was this flagged correctly?
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {/* EITHER ANSWER RESOLVES THE ITEM (§5). The question is feedback,
                  not a gate — "No" does not mean "leave it open".
                  BOTH ROUTE THROUGH `dispositionFor` RATHER THAN WRITING THE
                  PAYLOAD HERE. Whether a THIRD disposition exists ("seen, not
                  resolved, still watching") is open question 1 in the
                  architecture preamble, blocked on Dr. Nissan and Meg. Routing
                  the two through a named vocabulary means the day it is answered
                  the compiler lists every site that has to change — see
                  `lib/tasks/disposition.ts`, which enumerates them. */}
              <RecordButton
                onClick={() =>
                  onResolve(item, dispositionDetail(dispositionFor(false)))
                }
              >
                {/* TODO-COPY */}
                No
              </RecordButton>
              <PillButton
                onClick={() =>
                  onResolve(item, dispositionDetail(dispositionFor(true)))
                }
                className="h-9 px-5 text-[14px]"
              >
                {/* TODO-COPY */}
                Yes
              </PillButton>
            </div>
          </div>
        )}

        {p.kind === "billing" && completed && (
          /* NEEDS-COPY-NICOLE. WHAT WAS SUBMITTED AND WHEN — the bar's job on a
             closed review is to state the outcome, not to offer one. */
          <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
            {completed.outcome === "unchanged"
              ? `${completed.code} confirmed`
              : `Changed to ${completed.code}`}
            <span aria-hidden className="px-1.5 opacity-40">·</span>
            <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
              {new Date(completed.at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </p>
        )}

        {p.kind === "billing" && recommended && !completed && (
          /* ═══ TWO BUTTONS, AND NEITHER NAMES THE CODE ANY MORE ═══
             It was `Confirm unchanged` (tonal, re-reviews only) and
             `Confirm {code}` (primary), and the second named its object for a
             good reason: the code on screen is not the model's suggestion once a
             supervisor has picked from the DSM-5 dialog, so a label reading
             `Confirm F41.1` beside a chosen F33.1 catches a mistake nothing
             further up the pane would.

             THE CARE PAGE'S PARADIGM REPLACES BOTH, on the product owner's call
             — `Save draft` and `Submit`. That page dropped its own
             outcome-naming label ("Submit · {code} unchanged") once the region
             above it started moving with the decision, on the grounds that the
             button was then stating the same fact a second time.

             THAT PRECONDITION IS WHY THIS IS SAFE HERE, and it is imported with
             the label rather than assumed: the diff above renders the
             override-aware `recommended`, so picking a different code re-tints
             the changed elements and flips the chip to "Change proposed → F33.1"
             in the same frame. The outcome is stated beside the evidence and it
             moves when the decision moves. A bare `Submit` without that would
             re-open exactly the defect the old label was added to close.

             AND THE TWO OUTCOMES COLLAPSED INTO ONE BUTTON. `unchanged` versus
             `confirmed` was a choice a supervisor made with a button; it is now
             DERIVED from what the diff is showing — a renewal submits as
             `unchanged`, a change as `confirmed`. Two buttons that commit the
             same three documented fields with different outcome strings was an
             invitation to press the wrong one. */
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {/* ═══ THE GATE'S STATE, OPPOSITE THE BUTTONS (arch-F, F3) ═══
                It used to exist only as an `sr-only` sentence inside the review,
                600px below the button that runs the gate: a sighted supervisor
                pressed Submit and found out then. This states it before.
                A LIVE REGION, and the only one for the gate — `role="status"` so
                the count is announced as fields are filled, and so the blocked
                sentence is announced on a failed press without a second region
                competing to say the same thing.
                CLEARED WHEN VALID: zero gaps renders nothing at all rather than
                "0 fields needed", which is a number nobody needs.
                SUBMIT STAYS ENABLED (no-disabled-buttons): pressing it while
                invalid focuses the first empty field, and this line says why. */}
            <p
              role="status"
              aria-live="polite"
              className="min-w-0 text-[12.5px] leading-[17px] text-[var(--text-secondary)]"
            >
              {gaps === 0
                ? ""
                : blocked
                  ? /* NEEDS-COPY-NICOLE */ `${gaps} field${gaps === 1 ? "" : "s"} still needed. Focus moved to the first.`
                  : /* NEEDS-COPY-NICOLE */ `${gaps} field${gaps === 1 ? "" : "s"} needed`}
            </p>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <RecordButton
              onClick={() => {
                billingHandle.current?.saveAndClose();
                /* ═══ IT HANDS THE KEYBOARD BACK, which is this pane's version
                   of the Care card closing ═══
                   On the Care page `Save draft` closes the card, and the draft is
                   already on disk by then — so the button's real effect is
                   "leave this review". This pane never closes: selecting another
                   item is how you leave it, and a `Save draft` that only
                   re-saved an already-saved draft would be a control that does
                   nothing. The codebase has removed one of those before (the
                   care summary's Refresh, whose honest label was "this does
                   almost nothing").
                   THE SELECTED ROW IS THE TARGET, found by its own semantics
                   rather than through a new prop: the worklist is a `role="tree"`
                   and exactly one `treeitem` carries `aria-selected="true"`.
                   That is the same element `onFocusPane` moves focus AWAY from,
                   so this is its inverse and needs nothing wired through the
                   page. */
                document
                  .querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]')
                  ?.focus();
              }}
            >
              {/* TODO-COPY. IT PERSISTS NOTHING EXTRA — the draft is written on
                  every keystroke — so the name says what it does: leave this
                  review without committing, and hand the keyboard back. */}
              Save draft
            </RecordButton>
            <PillButton
              onClick={() => billingHandle.current?.submit()}
              className="h-9 px-5 text-[14px]"
            >
              {/* TODO-COPY */}
              Submit
            </PillButton>
            </div>
          </div>
        )}

        {(p.kind === "escalation" || p.kind === "documentation") && (
          /* ═══ THE ACTION BAR IS THE TASK'S, NOT A LINK OUT ═══
             It held one button that routed to the record. The task is completed
             HERE now: a response records its disposition, and a documentation
             task's bar is where the note module portals its own action row —
             which is why this branch renders only the response primary and
             leaves the slot empty otherwise. */
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p
              role="status"
              aria-live="polite"
              className="min-w-0 text-[12.5px] leading-[17px] text-[var(--text-secondary)]"
            >
              {/* NEEDS-COPY-NICOLE. The response's own gate, stated rather than
                  enforced with a disabled button. */}
              {p.kind === "escalation" && escalationBlocked
                ? "Record what you did first."
                : ""}
            </p>
            {p.kind === "escalation" ? (
              <PillButton
                onClick={() => {
                  const h = escalationHandle.current;
                  if (!h) return;
                  /* THE REFUSAL IS THE MESSAGE. `submit` returns false when no
                     disposition is chosen; the sentence to its left says so. */
                  if (!h.submit()) setEscalationBlocked(true);
                }}
                className="h-9 shrink-0 px-5 text-[14px]"
              >
                {/* NEEDS-COPY-NICOLE */}
                Record response
              </PillButton>
            ) : (
              /* THE SLOT THE NOTE MODULE PORTALS INTO. */
              <span ref={setActionSlot} className="contents" />
            )}
          </div>
        )}
      </div>
      {/* ── end of the scroller, which now contains the action bar ───────── */}
      </div>

      {/* ═══ THE CODE PICKER LIVES IN THE SHARED MODULE NOW ═══
          It was a `Dsm5SearchDialog` mounted here, opened by a `Change…` button
          the pane passed down. `ReviewBody` carries its own `Change code` control
          and its own picker — including the focus-return this app's dialogs need
          by hand, and the rule that picking the code ON RECORD resolves to
          unchanged rather than producing a change from a code to itself. Two
          pickers would have been two places for that rule to live. */}
    </div>
  );
}

/** Exported for the completion state's copy. */
export { AlertTriangle as PaneAlertIcon };
