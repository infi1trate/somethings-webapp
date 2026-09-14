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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { RecordButton } from "@/components/record/record-button";
import { Dsm5SearchDialog } from "@/components/record/dsm5-search";
import {
  BillingReview,
  type BillingCommitDetail,
  type BillingSubmitHandle,
} from "@/components/tasks/billing-review";
import { BreachChip } from "@/components/tasks/chips";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
// Still used by the BILLING pane's Notes link — a different block from the
// risk-flag excerpt. (It read "AI-summary link" until that block's label became
// "Notes"; the link itself is unchanged.)
import { chatHrefFor } from "@/lib/record/chat";
import {
  buildConversation,
  conversationHref,
  firstNameOf,
} from "@/lib/tasks/conversation";
import { ConversationExcerpt } from "@/components/tasks/conversation-excerpt";
import {
  isBreached,
  type BillingPayload,
  type DocumentationPayload,
  type EscalationPayload,
  type RiskFlagPayload,
  type TaskItem,
} from "@/lib/tasks/types";
import { tierLabel } from "@/lib/tasks/bands";
import { slaLabelFor } from "@/lib/tasks/sla";
import {
  PANE_LABEL,
  PaneChip,
  ScoreLozenge,
  SystemBlock,
} from "@/components/ui/evidence-primitives";
import { severityFor } from "@/lib/record/care-demo";
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

/* ═══ `ChangeSide` IS GONE — THE DIFF IS SHARED NOW ═══
   It lived here and the Care page had its own single-column presentation block,
   so the same clinical comparison was drawn two ways on the two surfaces that
   commit it. This one was the better of the two and became canonical:
   `record/presentation-diff.tsx` holds the framing, the three proposal kinds and
   the chip, and the Care review card renders the same component.
   ONE THING CHANGED IN THE MOVE, and it is a correctness fix rather than a
   restyle: the tint on the changed elements was `--band-sage-*`, which is
   emerald/100. Green is this product's committed-and-confirmed colour, and a
   proposal is the state before that — so the old tint said "done" on the one
   screen whose entire question is "should this happen?". It is `--band-sand-*`
   now, the warm neutral the system reserves for routine/review-due. */

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
  teenId,
  item,
  recommended,
  onChangeCode,
  onCommit,
  handleRef,
}: {
  payload: BillingPayload;
  teenId: string;
  item: TaskItem;
  recommended: { code: string; statement: string };
  onChangeCode: (trigger: HTMLElement) => void;
  onCommit: (detail: BillingCommitDetail) => void;
  handleRef: React.MutableRefObject<BillingSubmitHandle | null>;
}) {
  /* THE SURVEY'S BAND, RE-DERIVED FROM THE INSTRUMENT'S OWN THRESHOLDS rather
     than carried on the payload. Same rule the record's History follows: if a
     stored band and a computed one ever disagree, the instrument wins.
     Instruments outside the two this codebase has cut-offs for render the number
     with no band, which is honest — a lozenge asserting a severity nobody
     defined would not be. */
  const scored =
    payload.survey.instrument === "PHQ-9" || payload.survey.instrument === "GAD-7"
      ? severityFor(payload.survey.instrument, payload.survey.score)
      : null;

  return (
    <BillingReview
      item={item}
      payload={payload}
      recommended={recommended}
      onChangeCode={onChangeCode}
      onCommit={onCommit}
      handleRef={handleRef}
      rationale={
        <>
          {/* ═══ THE RATIONALE COMES FIRST ═══
              It was buried between the mentorship stats and the recommendation,
              which is the wrong order for the only paragraph on the pane that
              explains WHY the recommendation is what it is. A supervisor reads
              the reasoning, then the change, then documents it.

              ═══ THE LABEL IS "Notes", NOT "AI summary" (A3) ═══
              Two reasons, and the second is the load-bearing one. It matched the
              record's own panel, which was renamed from "AI Draft" to "AI Notes"
              at an earlier request — so this surface was the last place still
              calling the same kind of generated prose a summary. And "AI" in the
              label duplicated the provenance badge sitting beside it: the badge
              is the attribution, and a label that repeats it spends the reader's
              first glance saying the same thing twice.
              THE BADGE STILL CARRIES THE PROVENANCE. Nothing about the
              attribution weakened — `attribution="badge"` is unchanged, and it
              is what says a model wrote this. */}
          <SystemBlock
            /* TODO-COPY */
            label="Notes"
            attribution="badge"
            link={{ href: chatHrefFor(teenId), label: "View conversation" }}
          >
            {payload.aiSummary}
          </SystemBlock>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className={LABEL}>{/* TODO-COPY */}Assigned survey</p>
              {/* THE RECORD'S OWN SCORE LOZENGE, not a second way of showing a
                  reading. A supervisor sees "14 · Moderate" in the same shape
                  here and in the teen's History, so the two are obviously the
                  same fact. */}
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] leading-[20px] text-[var(--text-primary)]">
                {payload.survey.instrument}
                {scored ? (
                  <ScoreLozenge value={payload.survey.score} band={scored} />
                ) : (
                  <span className="tabular-nums text-[var(--text-secondary)]">
                    {payload.survey.score} / {payload.survey.max}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className={LABEL}>{/* TODO-COPY */}Mentorship</p>
              <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                {/* A NAMED PLATFORM METRIC keeps its own unit — "140 days",
                    never "4 months". */}
                <span className="tabular-nums">
                  {payload.mentorStats.daysInMentorship} days
                </span>{" "}
                ·{" "}
                <span className="tabular-nums">
                  {payload.mentorStats.messagesLast30}
                </span>{" "}
                messages ·{" "}
                <span className="tabular-nums">
                  {payload.mentorStats.videoLast30}
                </span>{" "}
                video
              </p>
            </div>
          </div>
        </>
      }
    />
  );
}

function EscalationBody({
  payload,
  item,
  now,
  excerptState,
  onRetryExcerpt,
}: {
  payload: EscalationPayload | DocumentationPayload;
  item: TaskItem;
  now: number;
  excerptState: ExcerptState;
  onRetryExcerpt: () => void;
}) {
  const isDocs = payload.kind === "documentation";
  /** ═══ CONTEXT, NOT EVIDENCE ═══
   *
   *  An escalation has no `flaggedExcerpt` — nothing here was flagged, so there is
   *  no line to highlight and `anchorText` is null, which anchors the excerpt to
   *  the most recent messages instead. That is the brief's fallback and it is also
   *  the honest one: highlighting an arbitrary message would assert that it
   *  triggered the escalation, and the payload does not say that.
   *
   *  NOTHING ABOUT MITIGATION MOVES. This body is read-only (§5, locked decision
   *  3) and stays so; the excerpt is one more statement, not an action. */
  const conversation = buildConversation(item, null, now);
  return (
    <div className="space-y-4">
      {/* READ-ONLY (§5). Every field here is a statement; there is no control in
          this body at all. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className={LABEL}>{/* TODO-COPY */}{isDocs ? "Closed" : "Opened"}</p>
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
            {new Date(isDocs ? payload.closedAt : item.openedAt).toLocaleString(
              "en-US",
              { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
            )}
            <span
              className="ml-2 text-[var(--text-secondary)] tabular-nums"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {elapsedLabel(isDocs ? payload.closedAt : item.openedAt, now)}
            </span>
          </p>
        </div>
        {!isDocs && (
          <div>
            <p className={LABEL}>{/* TODO-COPY */}911 status</p>
            <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
              {payload.is911 ? "911 dispatched" : "No 911 call"}
            </p>
          </div>
        )}
        {!isDocs && (
          <>
            <div>
              <p className={LABEL}>{/* TODO-COPY */}Flagged by</p>
              <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
                {payload.flaggedBy}
              </p>
            </div>
            <div>
              <p className={LABEL}>{/* TODO-COPY */}Emergency contact</p>
              <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
                {payload.emergencyContact}
              </p>
            </div>
          </>
        )}
      </div>

      {/* THE EXCERPT SITS ABOVE THE "this pane does not act" LINE, because it is
          the last piece of CONTEXT and that line closes the body. A reader who
          has just been told nothing here changes state should not then be handed
          more to read. */}
      {!isDocs && (
        <div>
          <p className={LABEL}>{/* TODO-COPY */}Recent conversation</p>
          <div className="mt-2">
            <ConversationExcerpt
              conversation={conversation}
              teenName={firstNameOf(item.teenDisplayName)}
              href={conversationHref(item.teenId, conversation.anchorId)}
              state={excerptState}
              onRetry={onRetryExcerpt}
              /* TODO-COPY. A different name from the flag pane's, because this
                 excerpt makes a weaker claim: nothing here is flagged. */
              label={`Recent conversation with ${firstNameOf(item.teenDisplayName)}`}
            />
          </div>
        </div>
      )}

      <p className="text-[13px] leading-[18px] text-[var(--text-muted)]">
        {/* TODO-COPY. States plainly that this pane does not act — the honest
            version of a read-only surface, rather than leaving a reader hunting
            for a button that is not there. */}
        {isDocs
          ? "Write-ups are completed on the escalation record."
          : "This escalation is handled in the escalation flow. Nothing here changes its state."}
      </p>
    </div>
  );
}

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
}: {
  item: TaskItem | null;
  now: number;
  /** Fires with the pane's detail; the page owns resolveWithUndo. */
  onResolve: (item: TaskItem, detail: Record<string, unknown>) => void;
  /** Where the pane publishes its keyboard-reachable actions. See PaneActions. */
  actionsRef?: React.MutableRefObject<PaneActions>;
  excerptState?: ExcerptState;
}) {
  /** RETRY IS LOCAL AND REAL. The fixture is synchronous, so "retry" is a
   *  re-render — but a reader cannot tell that, and a Retry that did nothing
   *  would be worse than none. `retryNonce` forces the excerpt to remount, which
   *  re-runs the anchor scroll and clears the error the caller set. */
  const [retryNonce, setRetryNonce] = useState(0);
  const effectiveExcerptState: ExcerptState =
    retryNonce > 0 ? "ready" : excerptState;
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const pickerTrigger = useRef<HTMLElement | null>(null);
  /** ═══ WHERE THE REVIEW PUBLISHES ITS GATE ═══
   *  The footer's Submit and the keyboard's ⌘/Ctrl+Enter both have to run the
   *  SAME three-field validation, and the state it validates lives inside the
   *  review. So the action comes up into this ref rather than the form's state
   *  going down — the same trade the `override` fix made, for the same reason:
   *  the action is the smaller thing to move. Null whenever the mounted body is
   *  not a billing review, which is what the footer checks. */
  const billingHandle = useRef<BillingSubmitHandle | null>(null);

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
          ? (correct: boolean) => onResolve(item, { flaggedCorrectly: correct })
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
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      {/* ── HEADER — pinned inside the pane. ─────────────────────────────── */}
      <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <h2 className="font-display text-[18px] font-bold leading-[26px] text-[var(--text-primary)]">
            {item.teenDisplayName}
          </h2>
          <span
            className="text-[13px] tabular-nums text-[var(--text-muted)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {elapsedLabel(item.openedAt, now)} open
          </span>
          {breached && <BreachChip label={`Past ${slaLabelFor(item.taskType)}`} />}
        </div>
        {/* ═══ THE DOMAIN LEAVES THE SUBTITLE (Part 5) ═══
            It read "to Maria Lopez · Risk flags · Red flag". The middle segment
            is the name of the SELECTED TAB, sitting four inches below the tab
            itself — a reader cannot be looking at this pane without having chosen
            that tab, so it answers a question nobody has. What is left is the two
            facts the header did not already carry: who the mentor is, and which
            tier this flag is (which is header-only by §5, and now unobstructed). */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          <span>to {item.mentorName}</span>
          {/* THE TIER, HEADER ONLY (§5). */}
          {p.kind === "riskFlag" && (
            <>
              <span aria-hidden className="opacity-40">·</span>
              <span>{tierLabel(p.tier)}</span>
            </>
          )}
        </p>
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
        {p.kind === "billing" && recommended && (
          <BillingBody
            payload={p}
            teenId={item.teenId}
            item={item}
            recommended={recommended}
            onChangeCode={(trigger) => {
              pickerTrigger.current = trigger;
              setPickerOpen(true);
            }}
            onCommit={(detail) => onResolve(item, detail)}
            handleRef={billingHandle}
          />
        )}
        {(p.kind === "escalation" || p.kind === "documentation") && (
          <EscalationBody
            payload={p}
            item={item}
            now={now}
            excerptState={effectiveExcerptState}
            onRetryExcerpt={() => setRetryNonce((n) => n + 1)}
          />
        )}
      </div>

      {/* ═══ THE FOOTER, ACTUALLY PINNED (Part 1.2) ═══
          This comment said "sticky" and the element was not — it sat in normal
          flow, so it stayed on screen only while the pane happened to fit. The
          fix is not `position: sticky` but `shrink-0` in a flex column whose
          BODY is the flexible row: the footer then sits on the pane's bottom
          edge by construction, at any content length, with no z-index and no
          overlap to reason about.
          "Was this flagged correctly?" and "Confirm {code}" are the controls a
          supervisor presses fifty times a shift. They can never leave the
          viewport. */}
      <div
        data-slot="task-pane-footer"
        className="shrink-0 border-t border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-5 py-3.5"
      >
        {p.kind === "riskFlag" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
              {/* TODO-COPY */}
              Was this flagged correctly?
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {/* EITHER ANSWER RESOLVES THE ITEM (§5). The question is feedback,
                  not a gate — "No" does not mean "leave it open". */}
              <RecordButton
                onClick={() => onResolve(item, { flaggedCorrectly: false })}
              >
                {/* TODO-COPY */}
                No
              </RecordButton>
              <PillButton
                onClick={() => onResolve(item, { flaggedCorrectly: true })}
                className="h-9 px-5 text-[14px]"
              >
                {/* TODO-COPY */}
                Yes
              </PillButton>
            </div>
          </div>
        )}

        {p.kind === "billing" && recommended && (
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
          <div className="flex flex-wrap items-center justify-end gap-2">
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
        )}

        {(p.kind === "escalation" || p.kind === "documentation") && (
          <div className="flex justify-end">
            {/* SINGLE ACTION, AND IT ROUTES OUT. Nothing on this pane resolves —
                locked decision 3, enforced here by there being no resolve control
                and in resolve.ts by the utility refusing an escalation. */}
            <Link
              href={escalationHref(payloadEscalationId(p))}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 text-[13px] font-semibold text-[var(--text-primary)]",
                "transition-colors hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {/* TODO-COPY */}
              {p.kind === "documentation" ? "Open escalation record" : "Open escalation"}
            </Link>
          </div>
        )}
      </div>

      {/* THE CODE PICKER — the record's existing searchable DSM-5 dialog, reused.
          A SEARCHABLE LIST AND NO FREE-TEXT ENTRY (§5, error prevention): a typed
          code is a code nobody validated, on a minor's billing record. */}
      {p.kind === "billing" && (
        <Dsm5SearchDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          current={p.current}
          onSelect={(entry) => {
            setOverride({ id: item.id, code: entry.code, statement: entry.statement });
            setPickerOpen(false);
          }}
          returnFocusTo={pickerTrigger}
        />
      )}
    </div>
  );
}

function payloadEscalationId(
  p: EscalationPayload | DocumentationPayload
): string {
  return p.escalationId;
}

/** Exported for the completion state's copy. */
export { AlertTriangle as PaneAlertIcon };
