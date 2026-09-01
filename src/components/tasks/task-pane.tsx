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

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { RecordButton } from "@/components/record/record-button";
import { Dsm5SearchDialog } from "@/components/record/dsm5-search";
import { BreachChip } from "@/components/tasks/domain-tabs";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
// Still used by the BILLING pane's AI-summary link — a different block from the
// risk-flag excerpt, and unaffected by Part 1.
import { chatHrefFor } from "@/lib/record/chat";
import {
  buildConversation,
  conversationHref,
  firstNameOf,
} from "@/lib/tasks/conversation";
import { ConversationExcerpt } from "@/components/tasks/conversation-excerpt";
import {
  DOMAIN_LABEL,
  isBreached,
  type BillingPayload,
  type DocumentationPayload,
  type EscalationPayload,
  type RiskFlagPayload,
  type TaskItem,
} from "@/lib/tasks/types";
import { slaLabelFor } from "@/lib/tasks/sla";
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

/** TODO-COPY. The tier, shown IN THE HEADER ONLY (§5) — red, orange and green
 *  share one body anatomy, and the tier is not repeated inside it. */
const TIER_LABEL: Record<RiskFlagPayload["tier"], string> = {
  red: "Red flag",
  orange: "Orange flag",
  green: "Standard flag",
};

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
      <div>
        <p className={LABEL}>{/* TODO-COPY */}Type</p>
        <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
          {payload.sourceType}
        </p>
      </div>

      <div>
        <p className={LABEL}>{/* TODO-COPY */}Category</p>
        {/* PLAIN-LANGUAGE PLAYBOOK CATEGORIES (§5). Raw enum values never reach
            this surface — the seed carries prose. */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {payload.categories.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
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

function BillingBody({
  payload,
  teenId,
  recommended,
  onChangeCode,
}: {
  payload: BillingPayload;
  teenId: string;
  recommended: { code: string; statement: string };
  onChangeCode: (trigger: HTMLElement) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className={LABEL}>{/* TODO-COPY */}Current primary presentation</p>
        {payload.current ? (
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
            {payload.current.statement}{" "}
            <span
              className="text-[var(--text-secondary)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {payload.current.code}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-muted)]">
            {/* TODO-COPY. Intake: there is nothing on record yet, which is the
                reason this review exists. */}
            None on record — this is the first assignment.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className={LABEL}>{/* TODO-COPY */}Assigned survey</p>
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
            {payload.survey.instrument}{" "}
            <span className="tabular-nums">
              {payload.survey.score} / {payload.survey.max}
            </span>
          </p>
        </div>
        <div>
          <p className={LABEL}>{/* TODO-COPY */}Mentorship</p>
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {/* A NAMED PLATFORM METRIC keeps its own unit — "140 days", never
                "4 months". */}
            <span className="tabular-nums">
              {payload.mentorStats.daysInMentorship} days
            </span>{" "}
            ·{" "}
            <span className="tabular-nums">
              {payload.mentorStats.messagesLast30}
            </span>{" "}
            messages ·{" "}
            <span className="tabular-nums">{payload.mentorStats.videoLast30}</span>{" "}
            video
          </p>
        </div>
      </div>

      <SystemBlock
        label="AI summary"
        link={{ href: chatHrefFor(teenId), label: "View conversation" }}
      >
        {payload.aiSummary}
      </SystemBlock>

      {/* RECOMMENDED PRESENTATION. Descriptor first at display weight, code in
          mono — a code is not a sentence and a supervisor reads the words. */}
      <div className="rounded-[var(--radius-inset)] border border-[color:var(--border-contour)] px-3.5 py-3">
        <p className={LABEL}>{/* TODO-COPY */}Recommended primary presentation</p>
        <p className="mt-1.5 text-[15px] leading-[22px] text-[var(--text-primary)]">
          {recommended.statement}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span
            className="text-[14px] text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {recommended.code}
          </span>
          <RecordButton
            onClick={(e) => onChangeCode(e.currentTarget)}
            className="min-h-8 px-3 text-[12.5px]"
          >
            {/* TODO-COPY — the ellipsis says a picker opens. */}
            Change…
          </RecordButton>
        </div>
      </div>
    </div>
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

export function TaskPane({
  item,
  now,
  onResolve,
  /** THE EXCERPT'S OWN STATE, from the page's load-state axis. Separate from the
   *  pane's so the two can disagree — which is the point: the dev harness must be
   *  able to fail the excerpt while the pane succeeds. */
  excerptState = "ready",
}: {
  item: TaskItem | null;
  now: number;
  /** Fires with the pane's detail; the page owns resolveWithUndo. */
  onResolve: (item: TaskItem, detail: Record<string, unknown>) => void;
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
  const [override, setOverride] = useState<{ code: string; statement: string } | null>(null);
  const pickerTrigger = useRef<HTMLElement | null>(null);

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
    p.kind === "billing" ? (override ?? p.recommended) : null;

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
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          <span>to {item.mentorName}</span>
          <span aria-hidden className="opacity-40">·</span>
          <span>{DOMAIN_LABEL[item.domain]}</span>
          {/* THE TIER, HEADER ONLY (§5). */}
          {p.kind === "riskFlag" && (
            <>
              <span aria-hidden className="opacity-40">·</span>
              <span>{TIER_LABEL[p.tier]}</span>
            </>
          )}
        </p>
      </div>

      {/* ── BODY, scrolls independently ─────────────────────────────────── */}
      {/* ── THE BODY IS THE ONLY SCROLLING PART OF THE PANE ──
             `overscroll-contain` so reaching its end does not scroll the page
             behind it — and the excerpt inside contains its own overscroll too,
             so three nested regions each stop at their own edge. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
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
            recommended={recommended}
            onChangeCode={(trigger) => {
              pickerTrigger.current = trigger;
              setPickerOpen(true);
            }}
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* RE-REVIEWS GET A SECOND, TONAL ACTION (§5): confirming that nothing
                changed is a different decision from confirming a new code, and an
                intake has no "unchanged" to confirm. */}
            {p.isReReview && (
              <RecordButton
                onClick={() =>
                  onResolve(item, {
                    outcome: "unchanged",
                    code: p.current?.code ?? null,
                  })
                }
              >
                {/* TODO-COPY */}
                Confirm unchanged
              </RecordButton>
            )}
            <PillButton
              onClick={() =>
                onResolve(item, {
                  outcome: "confirmed",
                  code: recommended.code,
                  changed: recommended.code !== p.recommended.code,
                })
              }
              className="h-9 px-5 text-[14px]"
            >
              {/* TODO-COPY */}
              Confirm code
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
            setOverride({ code: entry.code, statement: entry.statement });
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
