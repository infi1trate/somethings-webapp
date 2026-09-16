"use client";

// ═══ THE TWO ESCALATION TASK PANES (arch-G, G4) ═══
//
// ═══ THE PRINCIPLE THIS PHASE IS BUILT ON ═══
//
// Every task type owns a MITIGATION MODULE, extracted once and hosted by both
// its record surface and the Tasks pane. Tasks is a prioritized shell; it does
// not implement mitigation. Billing established this with `ReviewBody` (Care
// page + Tasks pane). Escalations follow it with `EscalationNoteModule`
// (Monitoring record + this pane).
//
// THE CONSEQUENCE, STATED BECAUSE IT WAS A REAL TEMPTATION: this is not a
// read-only pointer with an "Open record" button. Mitigation happens inline, as
// billing's does. A pointer pane would break the workflow premise of the whole
// page at its first escalation — a supervisor would arrive at the top of their
// queue and be sent somewhere else to do the work.
//
// ═══ TWO TASKS, TWO PANES, ONE RECORD ═══
//
// RESPONSE (5-minute SLA) is the live phase: the supervisor is ACTING, so the
// pane carries the Info summary, the timeline, and a three-value disposition —
// and deliberately NOT the note module. A clinical-legal form on screen during
// an incident invites writing instead of acting.
//
// DOCUMENTATION (24h from close) is the writing phase: the same header, the
// timeline, and the note module with its action row portalled into the sticky
// bar.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, FileText, MessageSquare, Phone } from "lucide-react";
import { BreachChip } from "@/components/tasks/chips";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
import { EscalationNoteModule } from "@/components/record/escalation-note-module";
import {
  EscalationTimeline,
  type ConversationSource,
} from "@/components/monitoring/escalation-timeline";
import { chatThreadHref } from "@/lib/record/chat";
import { PANE_LABEL } from "@/components/ui/evidence-primitives";
import { deadlineFactFor } from "@/lib/tasks/deadline-buckets";
import { RESPONSE_DISPOSITIONS } from "@/lib/tasks/escalation-response";
import { TASK_KIND_LABEL } from "@/lib/tasks/task-kind";
import { assembleTimeline, type TimelineEntry } from "@/lib/monitoring/timeline";
import { timelineSourcesFor } from "@/lib/monitoring/timeline-fixtures";
import type { EscalationRecord } from "@/lib/monitoring/escalation";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import type { DocumentationPayload, EscalationPayload, TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL = PANE_LABEL;

/** ═══ A TASK ITEM IS NOT A RECORD, AND THIS IS THE ONE SEAM ═══
 *  The task carries `escalationId` and the facts the row needs; the RECORD is
 *  Monitoring's. Until they share a store, the pane builds the record shape from
 *  the payload it has — and the two fields that do not exist upstream
 *  (acknowledgement, caregiver involvement) come through as null rather than
 *  invented. Gap row 376 is the fix. */
export function recordFromTask(item: TaskItem): EscalationRecord {
  const p = item.payload as EscalationPayload | DocumentationPayload;
  const closed = p.kind === "documentation" ? p.closedAt : null;
  return {
    id: p.escalationId,
    teenId: item.teenId,
    teenName: item.teenDisplayName,
    mentorId: item.mentorId,
    mentorName: item.mentorName,
    conversationId: item.objectId,
    triggeredAt: closed ?? item.openedAt,
    acknowledgedAt: p.kind === "documentation" ? (closed ?? item.openedAt) : null,
    resolvedAt: closed,
    /* COERCED, NOT KNOWN, for a documentation task — the payload has no 911
       field and this type's is a plain boolean. Every reader that would print or
       draw a conclusion from it branches on the PAYLOAD instead; see `Facts` and
       the timeline caveat. Gap row 213 is still the fix. */
    is911: p.kind === "escalation" ? p.is911 : false,
    caregiverInvolved: null,
    closeOutDone: [],
  };
}

function Facts({ item, rec }: { item: TaskItem; rec: EscalationRecord }) {
  const p = item.payload as EscalationPayload | DocumentationPayload;
  return (
    <dl className="grid gap-3 rounded-[var(--radius-inset)] border border-[color:var(--border-contour)] px-3.5 py-3 sm:grid-cols-3">
      {[
        /* NEEDS-COPY-NICOLE, all three labels. The Info summary the response
           phase needs and nothing more: who raised it, whether emergency
           services are involved, and who to call. */
        ["Opened by", p.kind === "escalation" ? p.flaggedBy : rec.mentorName],
        /* ═══ NOT `rec.is911` — THAT WOULD ASSERT AN ABSENCE (gap row 213) ═══
           A documentation payload carries the escalation id and the close time
           and nothing else; the 911 decision lives on the escalation record,
           which this prototype has no reader for. `recordFromTask` has to
           coerce the missing field to `false` because `EscalationRecord.is911`
           is a boolean — so reading the RECORD here would print "Not
           dispatched" on an escalation where 911 may well have been called. The
           payload is the only thing that knows whether it knows. */
        [
          "911",
          p.kind === "escalation"
            ? p.is911
              ? "Dispatched"
              : "Not dispatched"
            : /* NEEDS-COPY-NICOLE */ "On the escalation record",
        ],
        [
          "Emergency contact",
          p.kind === "escalation" ? p.emergencyContact : "—",
        ],
      ].map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className={LABEL}>{label}</dt>
          <dd className="mt-1 text-[13.5px] leading-[19px] text-[var(--text-primary)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The record-context accordion, escalation-flavoured. Same control as the
 *  billing pane's, different contents: what a supervisor consults about the
 *  RELATIONSHIP when deciding what to do about the incident. */
function EscalationContext({ rec, now }: { rec: EscalationRecord; now: number }) {
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
          {/* THE HEADLINE FACT STAYS VISIBLE, and the body does not repeat it —
              the rule G1 applied to the billing pane's accordion. */}
          {/* `now` FROM THE PAGE, NOT `Date.now()` — a call in render scope is
              impure and the React Compiler rejects it. Fourth time this rule has
              bitten in this codebase; caught by lint, not by reasoning. */}
          <span className="tabular-nums">{elapsedLabel(rec.triggeredAt, now)} since opening</span>
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
            /* NEEDS-COPY-NICOLE. Both are facts this surface already holds. */
            ["Mentor", rec.mentorName],
            ["Conversation", rec.conversationId ?? "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className={LABEL}>{label}</dt>
              <dd className="mt-1 text-[13.5px] leading-[19px] text-[var(--text-primary)]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export interface EscalationPaneHandle {
  /** The host's primary. Records a disposition on a response task, or marks the
   *  note complete on a documentation task.
   *  RETURNS WHETHER IT RECORDED, and that is deliberate: the response's gate
   *  (a disposition has to be chosen) lives in this component, and the sentence
   *  that says so lives in the host's action bar. A boolean is the smaller thing
   *  to move — the same trade `billingHandle` made. The alternative, publishing
   *  "ready" upward on every keystroke, gives the host a second copy of this
   *  component's state to keep in sync. */
  submit: () => boolean;
}

export function EscalationTaskPane({
  item,
  now,
  events,
  onResolve,
  actionSlot,
  handleRef,
  onDispositionChange,
}: {
  item: TaskItem;
  now: number;
  /** The surface's events, for the timeline's flag join. */
  events: MonitoringEvent[];
  onResolve: (item: TaskItem, detail: Record<string, unknown>) => void;
  /** Where the action row goes — the pane's sticky bar. */
  actionSlot: HTMLElement | null;
  handleRef?: React.MutableRefObject<EscalationPaneHandle | null>;
  /** Fires when the response disposition changes, so the host can clear a
   *  blocked-submit sentence that is no longer true. */
  onDispositionChange?: () => void;
}) {
  const isResponse = item.taskType === "activeEscalation";
  const rec = useMemo(() => recordFromTask(item), [item]);
  const [source, setSource] = useState<ConversationSource>("supportThread");
  const [manual, setManual] = useState<TimelineEntry[]>([]);
  const [disposition, setDisposition] = useState<string | null>(null);

  const entries = useMemo(
    () => assembleTimeline(timelineSourcesFor(rec, events, manual, now), source),
    [rec, events, manual, now, source]
  );

  const submit = (): boolean => {
    if (isResponse) {
      if (!disposition) return false;
      /* THE RESPONSE RECORDS A DISPOSITION AND A TIMESTAMP, nothing else. The
         note is the documentation task's, 24 hours later. */
      onResolve(item, { responseDisposition: disposition, respondedAt: Date.now() });
      return true;
    }
    onResolve(item, { escalationNote: "marked-complete", completedAt: Date.now() });
    return true;
  };

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = { submit };
    return () => {
      handleRef.current = null;
    };
  });

  return (
    <div className="space-y-4">
      <Facts item={item} rec={rec} />

      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Timeline</p>
        {!isResponse && (
          /* ═══ THE SAME GAP, STATED WHERE IT WOULD OTHERWISE BE INVISIBLE ═══
             `assembleTimeline` emits the dispatch entry from `record.is911`,
             which a documentation task's coerced `false` suppresses. An absent
             entry reads as "no dispatch", so the sentence says what the data
             cannot. Deleting the entry's condition would be worse: then a real
             dispatch would be missing with nothing said about it. */
          <p className="mt-1 text-[12px] leading-[17px] text-[var(--text-muted)]">
            {/* NEEDS-COPY-NICOLE */}
            The 911 decision is held on the escalation record; this task&rsquo;s data
            does not carry it, so no dispatch entry appears either way.
          </p>
        )}
        <div className="mt-2">
          <EscalationTimeline
            entries={entries}
            source={source}
            onSourceChange={setSource}
            teenName={rec.teenName}
            onLog={({ actionType, detail }) =>
              setManual((prev) => [
                ...prev,
                {
                  id: `manual-${Date.now()}`,
                  at: Date.now(),
                  source: "manual",
                  /* THE AUTHOR'S OWN WORDS, and the action type beside them. No
                     detail is a legitimate entry: "phone call, 4:12pm" is a fact
                     worth having even without a description. */
                  text: detail.trim() || "No detail recorded",
                  author: "You",
                  actionType,
                },
              ])
            }
          />
        </div>
      </div>

      <EscalationContext rec={rec} now={now} />

      {isResponse ? (
        <div>
          <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}What did you do?</p>
          {/* ═══ THE RESPONSE DISPOSITION — THREE VALUES, NO NOTE ═══
              During the live phase the supervisor is acting. Completing this
              task records WHAT THEY DID and WHEN, in three words; the
              clinical-legal record is the documentation task's job. */}
          <div
            role="radiogroup"
            aria-label="What did you do?"
            className="mt-1.5 flex flex-wrap gap-1.5"
          >
            {RESPONSE_DISPOSITIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={disposition === d.id}
                data-response-disposition={d.id}
                onClick={() => {
                  setDisposition(d.id);
                  onDispositionChange?.();
                }}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold",
                  disposition === d.id
                    ? "border-transparent bg-[var(--text-primary)] text-[var(--surface-card)]"
                    : "border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 min-h-[17px] text-[12px] leading-[17px] text-[var(--text-secondary)]" aria-live="polite">
            {RESPONSE_DISPOSITIONS.find((d) => d.id === disposition)?.consequence ?? ""}
          </p>
        </div>
      ) : (
        <div>
          <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Escalation note</p>
          <div className="mt-2">
            {/* THE MODULE, WITH ITS ACTION ROW IN THE PANE'S STICKY BAR. */}
            <EscalationNoteModule
              idPrefix={`task-${item.id}`}
              actionSlot={actionSlot}
              onMarkComplete={() => submit()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** The pane header's three tertiary ways out. The escalation record is the third,
 *  and it exists because this pane is where a supervisor learns they need the
 *  durable record — the timeline here is bounded to this escalation's window. */
export function EscalationCtas({ item }: { item: TaskItem }) {
  const p = item.payload as EscalationPayload | DocumentationPayload;
  const cta =
    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[12.5px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]";
  return (
    <>
      <Link href={`/admin/person/${encodeURIComponent(item.teenId)}?tab=care`} className={cn(cta, RING)}>
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        {/* NEEDS-COPY-NICOLE */}
        View care profile
      </Link>
      <Link href={chatThreadHref(item.teenId)} className={cn(cta, RING)}>
        <MessageSquare className="size-3.5 shrink-0" aria-hidden />
        View conversation
      </Link>
      <Link href={escalationHref(p.escalationId)} className={cn(cta, RING)}>
        <FileText className="size-3.5 shrink-0" aria-hidden />
        {/* NEEDS-COPY-NICOLE */}
        View escalation record
      </Link>
    </>
  );
}

/** The meta line for an escalation task: opened, closed, due — the three
 *  instants, each stated once. */
export function EscalationMeta({ item, now }: { item: TaskItem; now: number }) {
  const p = item.payload as EscalationPayload | DocumentationPayload;
  const closed = p.kind === "documentation" ? p.closedAt : null;
  const breached = now > item.slaDeadline;
  const isResponse = item.taskType === "activeEscalation";
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
      <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
        {/* NEEDS-COPY-NICOLE */}
        {isResponse
          ? `${elapsedLabel(item.openedAt, now)} elapsed`
          : `opened ${elapsedLabel(item.openedAt, now)} ago`}
      </span>
      {closed != null && (
        <>
          <span aria-hidden className="opacity-40">·</span>
          <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
            closed {elapsedLabel(closed, now)} ago
          </span>
        </>
      )}
      <span aria-hidden className="opacity-40">·</span>
      <span
        className={cn("tabular-nums", breached && "font-semibold text-[var(--band-clay-fg)]")}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {isResponse
          ? breached
            ? /* NEEDS-COPY-NICOLE. The five minutes are the threshold, so past it
                 the fact is how far past. */
              `response ${elapsedLabel(item.slaDeadline, now)} overdue`
            : `${elapsedLabel(now, item.slaDeadline)} to respond`
          : deadlineFactFor(item.slaDeadline, now, elapsedLabel)}
      </span>
      {breached && !isResponse && <BreachChip label="Overdue" />}
      {isResponse && (
        <span className="inline-flex items-center gap-1 text-[12px]">
          <Phone className="size-3 shrink-0" aria-hidden />
          {/* NEEDS-COPY-NICOLE */}
          {(item.payload as EscalationPayload).is911 ? "911 dispatched" : "No 911"}
        </span>
      )}
      <span className="sr-only">{TASK_KIND_LABEL[item.taskType]}</span>
    </p>
  );
}
