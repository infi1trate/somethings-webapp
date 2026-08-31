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
import { AlertTriangle, MessageSquare, Sparkles } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { RecordButton } from "@/components/record/record-button";
import { Dsm5SearchDialog } from "@/components/record/dsm5-search";
import { BreachChip } from "@/components/tasks/domain-tabs";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
import { chatHrefFor } from "@/lib/record/chat";
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
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]";

/** TODO-COPY. The tier, shown IN THE HEADER ONLY (§5) — red, orange and green
 *  share one body anatomy, and the tier is not repeated inside it. */
const TIER_LABEL: Record<RiskFlagPayload["tier"], string> = {
  red: "Red flag",
  orange: "Orange flag",
  green: "Standard flag",
};

/** SYSTEM-ATTRIBUTION FOR AI CONTENT (§5).
 *
 *  THE DESIGN SYSTEM HAS NO CONVENTION FOR THIS — audited: bloom-design-system_1.md
 *  has no AI/system-attribution token, component or pattern. The interim is the one
 *  this codebase already grew for the same problem on the record surface (the flag
 *  card's moment summary): an eyebrow naming the provenance, a Sparkles glyph, and
 *  a tonal inset at a step inside the card's radius — a TINT AND A RADIUS, never a
 *  border, so it reads as recessed rather than as a second card.
 *  See design-system-gaps.md row 218. */
function SystemBlock({
  label,
  children,
  link,
}: {
  label: string;
  children: React.ReactNode;
  link?: { href: string; label: string };
}) {
  return (
    <div className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3.5 py-3">
      <p className={cn("flex items-center gap-1.5", LABEL)}>
        <Sparkles className="size-3 shrink-0" aria-hidden />
        {label}
      </p>
      <p className="mt-1.5 text-[13.5px] leading-[20px] text-[var(--text-secondary)]">
        {children}
      </p>
      {link && (
        <Link
          href={link.href}
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-[var(--text-primary)]",
            "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
            RING
          )}
        >
          <MessageSquare className="size-3.5 shrink-0" aria-hidden />
          {link.label}
        </Link>
      )}
    </div>
  );
}

/** THE QUOTE BLOCK for flagged content (§5).
 *
 *  NO DESIGN-SYSTEM CONVENTION EXISTS for a quote block either — row 219. Interim:
 *  a `<blockquote>` with a left rule and the message set in a serif-neutral
 *  italic, so it reads as SOMEONE ELSE'S WORDS rather than as product copy. That
 *  distinction is the whole job here: this is the one place a teen's own message
 *  appears on a staff surface, and it must never be mistakable for the interface
 *  talking.
 *
 *  The left rule is the one place a left-edge bar is used on this surface — the
 *  record's no-left-bars rule is about severity accents on cards, and a quotation
 *  mark is not a severity signal. */
function QuoteBlock({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-2 border-[color:var(--border-strong,var(--border-contour))] pl-3.5">
      <p className="text-[14px] italic leading-[22px] text-[var(--text-primary)]">
        {children}
      </p>
    </blockquote>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-[var(--surface-s2)] px-2.5 py-0.5 text-[13px] leading-[18px] text-[var(--text-primary)]">
      {children}
    </span>
  );
}

// ── Bodies ──────────────────────────────────────────────────────────────────

function RiskFlagBody({
  payload,
  teenId,
}: {
  payload: RiskFlagPayload;
  teenId: string;
}) {
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

      <div>
        <p className={LABEL}>{/* TODO-COPY */}Flagged content</p>
        <div className="mt-2">
          <QuoteBlock>{payload.flaggedExcerpt}</QuoteBlock>
          <Link
            href={chatHrefFor(teenId)}
            // SC 2.5.8 — 126x20; `py-1.5` gives 32px. Padding rather than
            // `touchTarget()`, per gap row 290: this sits at the end of a block
            // with `mt-2.5` above it, so a bleed upward would reach its sibling.
            className={cn(
              "mt-2.5 inline-flex items-center gap-1.5 rounded-sm py-1.5 text-[13px] font-semibold text-[var(--text-primary)]",
              "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
              RING
            )}
          >
            <MessageSquare className="size-3.5 shrink-0" aria-hidden />
            {/* TODO-COPY */}
            View chat context
          </Link>
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
}: {
  payload: EscalationPayload | DocumentationPayload;
  item: TaskItem;
  now: number;
}) {
  const isDocs = payload.kind === "documentation";
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
}: {
  item: TaskItem | null;
  now: number;
  /** Fires with the pane's detail; the page owns resolveWithUndo. */
  onResolve: (item: TaskItem, detail: Record<string, unknown>) => void;
}) {
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
    <div className="flex max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="border-b border-[color:var(--border-subtle)] px-5 py-4">
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
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {p.kind === "riskFlag" && (
          <RiskFlagBody payload={p} teenId={item.teenId} />
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
          <EscalationBody payload={p} item={item} now={now} />
        )}
      </div>

      {/* ── FOOTER, sticky ─────────────────────────────────────────────── */}
      <div className="border-t border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-5 py-3.5">
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
