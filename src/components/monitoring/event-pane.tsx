"use client";

// ═══ THE REVIEW PANE ═══
//
// ═══ THE CONTROL THIS REPLACES WAS THE DEFECT ═══
//
// "Was this flagged correctly?  No | Yes", with Yes styled primary. One question
// standing in for two unrelated judgments — whether the classifier was right,
// and what should happen to the teen — and on a self-harm-language flag it was a
// one-tap path to closure that recorded no clinical judgment at all.
//
// Two axes now. The clinical disposition is required and is the only thing that
// can close an event. Classifier accuracy is optional, never primary, never
// pre-selected, and resolves nothing.
//
// NEITHER AXIS USES A DISABLED BUTTON. A disabled control announces nothing,
// gives no reason, and in this codebase is already recorded as unreliably
// reachable for keyboard users. Resolving without a disposition surfaces inline
// guidance AT the control instead — not a toast, which would be gone before a
// reader looked back at the thing it was about.

import { riskCategoryLabel } from "@/lib/record/risk-taxonomy";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, EyeOff, FileText, ShieldAlert } from "lucide-react";
import { ConversationExcerpt } from "@/components/tasks/conversation-excerpt";
import { EscalationNoteModule } from "@/components/record/escalation-note-module";
import {
  EscalationTimeline,
  type ConversationSource,
} from "@/components/monitoring/escalation-timeline";
import { assembleTimeline, type TimelineEntry } from "@/lib/monitoring/timeline";
import { manualFixturesFor, timelineSourcesFor } from "@/lib/monitoring/timeline-fixtures";
import { BreachChip } from "@/components/tasks/chips";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
import { PANE_LABEL, PaneChip, SystemBlock } from "@/components/ui/evidence-primitives";
import { buildConversation, conversationHref, firstNameOf } from "@/lib/tasks/conversation";
import type { RiskFlagPayload } from "@/lib/tasks/types";
import {
  ACCURACY_VALUES,
  DISPOSITION_REQUIRED_HINT,
  DISPOSITION_VALUES,
  dispositionById,
  type DispositionValue,
} from "@/lib/monitoring/disposition";
import { EVENT_KIND_LABEL, type MonitoringEvent } from "@/lib/monitoring/event";
import {
  ackDeadline,
  ackStateFor,
  closeOutOf,
  isActive,
  type EscalationRecord,
  RECORD_LIFECYCLE_LABEL,
  recordLifecycleOf,
} from "@/lib/monitoring/escalation";
import type { CompliancePath } from "@/lib/monitoring/scenarios";
import { ageLabel } from "@/components/monitoring/event-list";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL = PANE_LABEL;

/** ═══ ROLE LABELLING, EVERYWHERE THE TWO NAMES MEET ═══
 *  "Naomi R. to Maria Lopez" is ambiguous about which name is the teen, and the
 *  state where identifying the teen instantly matters most is exactly the state
 *  where the pattern was least clear. NEEDS-COPY-NICOLE on both labels. */
export function RolePair({
  teenName,
  mentorName,
  tone = "default",
}: {
  teenName: string | null;
  mentorName: string;
  tone?: "default" | "onFill";
}) {
  /* ═══ NO OPACITY ON THE FILL ═══
     `opacity-80` on white over the escalation red measured 4.2:1 and axe caught
     it. The role label is already distinguished by size, case and tracking, so
     it does not need to be dimmer — and on the one saturated treatment on the
     page, dimmer was the wrong direction anyway. */
  const muted = tone === "onFill" ? "" : "text-[var(--text-secondary)]";
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      {teenName && (
        <span className="inline-flex items-baseline gap-1">
          <span className={cn("text-[11px] uppercase tracking-wide", muted)}>Teen</span>
          <span className="text-[14px] font-semibold leading-[20px]">{teenName}</span>
        </span>
      )}
      <span className="inline-flex items-baseline gap-1">
        <span className={cn("text-[11px] uppercase tracking-wide", muted)}>Mentor</span>
        <span className="text-[14px] leading-[20px]">{mentorName}</span>
      </span>
    </span>
  );
}

// ── Compliance paths ────────────────────────────────────────────────────────
// SPECIFIED ONLY AS FIXTURE LINES, so what ships is the posture each line names
// and nothing more. Both are reported as under-specified.

function ExplicitMedia() {
  const [revealed, setRevealed] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);
  return (
    <div>
      <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Attached media</p>
      <div className="mt-2 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-3">
        {revealed ? (
          <>
            {/* NO DOWNLOAD AFFORDANCE, AND NO <img>. There is no media in this
                prototype; a placeholder that could be saved would be a saveable
                copy of evidence on a compliance path that exists to prevent
                exactly that. */}
            <div
              aria-label="Revealed media placeholder"
              role="img"
              className="flex h-28 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-s2)] text-[12px] text-[var(--text-secondary)]"
            >
              {/* NEEDS-COPY-NICOLE */}
              Media shown here. Do not download, screenshot or forward.
            </div>
            <p className="mt-2 text-[11.5px] leading-[16px] text-[var(--text-secondary)]">
              {/* NEEDS-COPY-NICOLE. THE LOG ENTRY IS SHOWN BACK, because "this is
                  logged" is only a deterrent if the reader sees the entry. */}
              Logged: you opened this at {logged}.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-primary)]">
              <EyeOff className="size-4 shrink-0" aria-hidden />
              {/* NEEDS-COPY-NICOLE */}
              Explicit media withheld
            </span>
            <button
              type="button"
              onClick={() => {
                setLogged(
                  new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                );
                setRevealed(true);
              }}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-contour)] px-3 text-[13px] font-semibold text-[var(--text-primary)]",
                "hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {/* NEEDS-COPY-NICOLE. The button says the consequence, so the
                  reveal is a decision rather than a click. */}
              Reveal — this is logged
            </button>
          </div>
        )}
      </div>
      <ul className="mt-2 space-y-1 text-[12px] leading-[17px] text-[var(--text-secondary)]">
        {/* NEEDS-COPY-NICOLE, all four. The checklist is SURFACED, not
            interactive: nothing here can record a filing, and a tickbox that
            recorded nothing would be worse than a list that states the steps. */}
        <li>· Preserve the conversation — do not delete or edit</li>
        <li>· Report to Clinical Ops within the shift</li>
        <li>· Note the disclosure in the teen&apos;s record</li>
        <li>· Do not forward the media outside this system</li>
      </ul>
    </div>
  );
}

function SuspectedDeath() {
  return (
    <div>
      <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Suspected death — required sequence</p>
      <ol className="mt-2 space-y-2 text-[13px] leading-[19px] text-[var(--text-primary)]">
        {/* NEEDS-COPY-NICOLE, all four. Ordered and un-tickable for the same
            reason as above: this surface cannot record any of these, and the
            sequence is the thing a supervisor needs on screen. */}
        <li>1 · Attempt verification — caregiver contact, then emergency services</li>
        <li>2 · Alert Clinical Ops immediately, whatever verification returns</li>
        <li>3 · Document the attempt, the time and who was reached</li>
        <li>4 · Deactivation is Clinical Ops&apos; call, not this surface&apos;s</li>
      </ol>
      <p className="mt-2 text-[12px] leading-[17px] text-[var(--text-secondary)]">
        {/* NEEDS-COPY-NICOLE */}
        Nothing here closes the record. The mentor should not be asked to verify.
      </p>
    </div>
  );
}

// ── Bodies ──────────────────────────────────────────────────────────────────

function FlagBody({
  event: e,
  now,
  compliance,
}: {
  event: MonitoringEvent;
  now: number;
  compliance: CompliancePath;
}) {
  const item = e.flag;
  if (!item) return null;
  const payload = item.payload as RiskFlagPayload;
  const conversation = buildConversation(item, payload.flaggedExcerpt, now);
  return (
    <div className="space-y-4">
      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Category</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {/* KEYED ON THE ID, LABELLED FROM THE PLAYBOOK. The key has to stay
              the id — two categories can share neither an id nor a label, but a
              label is the one a copy change could collide. */}
          {payload.categories.map((c) => (
            <PaneChip key={c}>{riskCategoryLabel(c)}</PaneChip>
          ))}
        </div>
      </div>

      {compliance === "explicit-media" && <ExplicitMedia />}
      {compliance === "suspected-death" && <SuspectedDeath />}

      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Conversation</p>
        <div className="mt-2">
          {/* `scroll={false}` — THE THIRD SCROLL REGION IS GONE. The window holds
              the flagged message and three turns either side; the pane's own
              scroll carries it, and locked decision 4's two regions hold. */}
          <ConversationExcerpt
            conversation={conversation}
            teenName={firstNameOf(item.teenDisplayName)}
            href={conversationHref(item.teenId, conversation.anchorId)}
            scroll={false}
          />
        </div>
      </div>

      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Why this was flagged</p>
        <div className="mt-2">
          {/* ATTRIBUTED AS GENERATED. The rationale is the classifier's, which is
              the whole reason axis 2 exists. */}
          <SystemBlock label="Classifier rationale">{payload.aiRationale}</SystemBlock>
        </div>
      </div>
    </div>
  );
}

function PracticeBody({ event: e, now }: { event: MonitoringEvent; now: number }) {
  const f = e.practice;
  if (!f) return null;
  return (
    <div className="space-y-4">
      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}What was measured</p>
        <p className="mt-1.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
          {EVENT_KIND_LABEL[e.kind]} — {f.measure}
        </p>
        <p className="mt-1 text-[12px] leading-[17px] text-[var(--text-secondary)]">
          {/* THE RULE IS NAMED. A practice event that does not say what it was
              measured against is an accusation. */}
          Measured against {f.againstLabel}
          {e.teenName ? ` · teen ${e.teenName}` : ""} · {ageLabel(e.at, now)}
        </p>
      </div>
      {f.stubbed && (
        <SystemBlock label="No automated measure">
          {/* NEEDS-COPY-NICOLE. THE STUB SAYS SO. Tone, presence,
              personalization, boundary and conduct adherence and attendance need
              a classifier that does not exist — so this event carries a human's
              judgment or nothing, and never a rules engine dressed as one. */}
          This kind of event has no automated measure. It was raised by a person,
          and nothing on this surface computed it.
        </SystemBlock>
      )}
    </div>
  );
}

/** ═══ THE ESCALATION BODY — ONE OBJECT, TWO CLOCKS, FOUR OBLIGATIONS ═══
 *  Read-only (locked decision 3): nothing here mutates the escalation, and the
 *  close-out items link to where the work actually happens rather than offering
 *  a tickbox that would let a supervisor mark paperwork done from a list. */
function EscalationBody({
  rec,
  now,
  events,
}: {
  rec: EscalationRecord;
  now: number;
  /** The surface's own events, for the timeline's flag join — a real join here,
   *  because this page is where those events live. */
  events: MonitoringEvent[];
}) {
  const ack = ackStateFor(rec, now);
  const items = closeOutOf(rec, now);
  const lifecycle = recordLifecycleOf(rec, now);
  const [source, setSource] = useState<ConversationSource>("supportThread");
  /** KEYED BY RECORD, DERIVED — see the same note in `escalation-task-pane`.
   *  An initialiser would run once for the first record this pane ever showed,
   *  and every later record would inherit its entries. This pane does not
   *  unmount between selections either. */
  const [added, setAdded] = useState<Record<string, TimelineEntry[]>>({});
  const entries = assembleTimeline(
    timelineSourcesFor(
      rec,
      events,
      [...manualFixturesFor(rec), ...(added[rec.id] ?? [])],
      now
    ),
    source
  );
  return (
    <div className="space-y-4">
      {/* ═══ THE STATE, FIRST AND ONCE (arch-G, G6) ═══
          The pane opened with the acknowledgement clock, which answers a
          question only an ACTIVE record has. A reader arriving from a link has
          to be told what this record IS before being told what is owed — and on
          a terminal record the answer is "nothing", which no clock can say. */}
      <p
        data-record-lifecycle={lifecycle}
        className="text-[13px] leading-[18px] text-[var(--text-secondary)]"
      >
        {RECORD_LIFECYCLE_LABEL[lifecycle]}
        {lifecycle === "closedDocumented" && (
          <span className="ml-1.5 text-[var(--text-muted)]">
            {/* NEEDS-COPY-NICOLE. THE TERMINAL STATE SAYS IT IS TERMINAL, because
                "Closed · documented" alone still reads like a status that might
                change. */}
            — nothing further is owed on this escalation.
          </span>
        )}
      </p>
      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Acknowledgement</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] leading-[20px] text-[var(--text-primary)]">
          {ack === "acknowledged" ? (
            <>
              {/* NEEDS-COPY-NICOLE */}
              Acknowledged {ageLabel(rec.acknowledgedAt ?? now, now)}
            </>
          ) : (
            <>
              <span>Not acknowledged</span>
              {/* THE ONLY PUBLISHED RESPONSE SLA, AND THE ONE THING BREACH
                  TREATMENT IS FOR ON THIS PAGE NOW. */}
              {ack === "breached" ? (
                /* NEEDS-COPY-NICOLE. The chip NAMES THE CLOCK — "Overdue" alone
                   on a page that now has only escalation clocks would leave a
                   reader asking which one. */
                <BreachChip label={`Ack past ${elapsedLabel(ackDeadline(rec), now)}`} />
              ) : (
                <span
                  className="text-[13px] tabular-nums text-[var(--text-secondary)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {elapsedLabel(now, ackDeadline(rec))} left
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Close-out</p>
        <ul className="mt-2 space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              data-closeout={i.id}
              data-closeout-state={i.done ? "done" : i.overdue ? "overdue" : "open"}
              className="flex flex-wrap items-center gap-2 text-[13.5px] leading-[19px]"
            >
              <span className={cn(i.done ? "text-[var(--text-secondary)] line-through" : "text-[var(--text-primary)]")}>
                {i.label}
              </span>
              {i.done ? (
                <span className="text-[11.5px] text-[var(--text-secondary)]">{/* NEEDS-COPY-NICOLE */}done</span>
              ) : i.condition && !i.condition.applies ? (
                /* ═══ NO CLOCK ON AN ITEM THAT IS NOT OWED (arch-G, G6) ═══
                   MEASURED on the record: "Teen follow-up · 40m left · not
                   required — caregiver involved in treatment". Two statements
                   that contradict each other, and the countdown is the one a
                   reader acts on. `closeOutOf` computes `dueAt` for every item
                   regardless of its condition — correctly, because the
                   condition can change — so the suppression belongs here, at
                   the render, where the reason is already being stated.
                   The waiver line renders below either way. */
                null
              ) : i.overdue ? (
                <BreachChip label={`Overdue by ${elapsedLabel(i.dueAt ?? now, now)}`} />
              ) : i.dueAt != null ? (
                <span
                  className="text-[12px] tabular-nums text-[var(--text-secondary)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {elapsedLabel(now, i.dueAt)} left
                </span>
              ) : (
                /* NO PUBLISHED CLOCK — said plainly rather than borrowing the
                   note's 24h, which would invent a deadline. */
                <span className="text-[11.5px] text-[var(--text-secondary)]">{/* NEEDS-COPY-NICOLE */}no stated deadline</span>
              )}
              {i.condition && !i.condition.applies && (
                <span className="text-[11.5px] text-[var(--text-secondary)]">
                  {/* WHY IT IS NOT BEING ASKED FOR. */}
                  not required — {i.condition.note}
                </span>
              )}
              {i.condition?.applies && i.condition.note === "caregiver involvement unknown" && (
                <span className="text-[11.5px] text-[var(--text-secondary)]">
                  {/* THE BLOCKER, ON SCREEN. The field does not exist upstream,
                      so the obligation stands and says why. */}
                  required — caregiver involvement not recorded
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ═══ THE MITIGATION MODULE, HOSTED (arch-G, G3) ═══
          The record is the escalation note's durable home, so the module renders
          HERE — inline, with its action row in the flow, which is the layout a
          record wants. The Tasks documentation pane hosts the same component and
          portals the action row into its sticky bar. One implementation, two
          hosts: the principle billing established with `ReviewBody`.
          ONLY ONCE THE CRISIS IS OVER. An active escalation has nothing to
          document yet and a form on screen during an incident invites a
          supervisor to write instead of act — the response task is what exists
          during the live phase. */}
      {/* ═══ THE TIMELINE — THE SAME COMPONENT THE TASK PANE HOSTS (G5/G6) ═══
          Assembled from the record, the support thread, the teen's conversation,
          this page's own flags and hand-logged actions. Not summarised, and
          every entry names its source. The record is the timeline's durable
          home; the task pane borrows it for the window it is working in. */}
      <div>
        <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Timeline</p>
        <div className="mt-2">
          <EscalationTimeline
            entries={entries}
            source={source}
            onSourceChange={setSource}
            teenName={rec.teenName}
            onLog={({ actionType, detail }) =>
              setAdded((prev) => ({
                ...prev,
                [rec.id]: [
                  ...(prev[rec.id] ?? []),
                  {
                    id: `manual-${Date.now()}`,
                    at: Date.now(),
                    source: "manual",
                    text: detail.trim() || "No detail recorded",
                    author: "You",
                    actionType,
                  },
                ],
              }))
            }
          />
        </div>
      </div>

      {!isActive(rec) &&
        (lifecycle === "closedDocumented" ? (
          /* ═══ A TERMINAL RECORD DOES NOT OFFER A FORM ═══
             The note is recorded, so a live module here would invite a second
             one — and the prototype holds no note BODY, so rendering the fields
             read-only would show nine empty rows on a documented escalation and
             assert that nothing was written. Saying what is true and what cannot
             be shown is the honest third option. Gap row: the note body is not
             stored anywhere, so it cannot be read back. */
          <SystemBlock label="Escalation note">
            {/* NEEDS-COPY-NICOLE */}
            The escalation note is recorded. This prototype stores no note body,
            so its fields cannot be read back here.
          </SystemBlock>
        ) : (
          <div>
            <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Escalation note</p>
            <div className="mt-2">
              <EscalationNoteModule idPrefix={`rec-${rec.id}`} />
            </div>
          </div>
        ))}

      <Link
        href={escalationHref(rec.id)}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3.5 text-[13px] font-semibold text-[var(--text-primary)]",
          "hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <FileText className="size-4 shrink-0" aria-hidden />
        {/* NEEDS-COPY-NICOLE. "Escalation note", never "write-up". */}
        Open the escalation record
      </Link>
    </div>
  );
}

// ── The two axes ────────────────────────────────────────────────────────────

function DispositionAxis({
  value,
  onChange,
  hint,
  hintRef,
}: {
  value: string | null;
  onChange: (id: string) => void;
  hint: boolean;
  hintRef: React.Ref<HTMLParagraphElement>;
}) {
  const chosen = dispositionById(value);
  return (
    <div
      role="radiogroup"
      /* NEEDS-COPY-NICOLE */
      aria-label="Clinical disposition"
      aria-describedby={hint ? "disposition-hint" : undefined}
      className="min-w-0"
    >
      <p className={LABEL}>
        {/* NEEDS-COPY-NICOLE. Required, and it says so in words rather than with
            an asterisk. */}
        Clinical disposition · required
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {DISPOSITION_VALUES.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={value === d.id}
            onClick={() => onChange(d.id)}
            data-disposition={d.id}
            data-effect={d.effect}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold",
              value === d.id
                ? "border-transparent bg-[var(--text-primary)] text-[var(--surface-card)]"
                : "border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      {/* THE CONSEQUENCE, AT THE CONTROL. Which of the four is destructive is not
          guessable from the labels, and "Escalate now" does not close the event —
          a reader should know that before pressing it, not from a toast. */}
      <p
        className="mt-1.5 min-h-[17px] text-[12px] leading-[17px] text-[var(--text-secondary)]"
        aria-live="polite"
      >
        {chosen?.consequence ?? ""}
      </p>
      {hint && (
        <p
          id="disposition-hint"
          ref={hintRef}
          role="alert"
          tabIndex={-1}
          className="mt-1 text-[12.5px] font-semibold leading-[17px] text-[var(--state-error)]"
        >
          {DISPOSITION_REQUIRED_HINT}
        </p>
      )}
    </div>
  );
}

function AccuracyAxis({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div
      role="radiogroup"
      /* NEEDS-COPY-NICOLE */
      aria-label="Classifier accuracy — optional"
      className="min-w-0"
    >
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
        {/* NEEDS-COPY-NICOLE. Optional in the label, because it is optional. */}
        Classifier accuracy · optional
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ACCURACY_VALUES.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={value === a.id}
            data-accuracy={a.id}
            /* TOGGLE-OFF, because it is never pre-selected and a reader who
               picked one by accident has no other way back to "no answer". */
            onClick={() => onChange(value === a.id ? null : a.id)}
            className={cn(
              // NEVER PRIMARY-STYLED. A quiet outline at 12.5px against the
              // disposition's filled chips — the visual weight says which axis
              // resolves the event.
              "inline-flex min-h-8 items-center rounded-full border px-3 text-[12.5px]",
              value === a.id
                ? "border-[color:var(--border-contour)] bg-[var(--surface-s2)] text-[var(--text-primary)]"
                : "border-[color:var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── The pane ────────────────────────────────────────────────────────────────

export interface PaneHandle {
  /** The keyboard's `y`/`n`. ON THIS SURFACE THEY ANSWER AXIS 2 AND RESOLVE
   *  NOTHING — the old binding resolved the event, which is the defect. */
  accuracy?: (accurate: boolean) => void;
}

export function EventPane({
  event,
  escalation,
  events,
  now,
  compliance,
  deactivated,
  onResolve,
  onEscalate,
  handleRef,
}: {
  event: MonitoringEvent | null;
  escalation: EscalationRecord | null;
  /** THE WHOLE EVENT SET, not the selected one. The escalation record's timeline
   *  joins flags on the same teen inside the escalation's window, so it needs the
   *  set rather than the selection. Required, not defaulted: `[]` would make the
   *  timeline state "no flags" on a record that had them. */
  events: MonitoringEvent[];
  now: number;
  compliance: CompliancePath;
  /** The record changed under the reader. */
  deactivated: boolean;
  onResolve: (e: MonitoringEvent, detail: { disposition: DispositionValue; accuracy: string | null }) => void;
  onEscalate: (e: MonitoringEvent) => void;
  handleRef?: React.MutableRefObject<PaneHandle>;
}) {
  const [disposition, setDisposition] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const hintRef = useRef<HTMLParagraphElement | null>(null);

  /** ═══ THE HANDLE IS PUBLISHED IN AN EFFECT, NOT DURING RENDER ═══
   *  A ref write in render scope is impure and the React Compiler rejects it —
   *  caught by lint, not by reasoning, and the third time this rule has bitten in
   *  this codebase. The keyboard's `y`/`n` reach the handle after mount, which is
   *  the only time a keystroke can arrive. */
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      accuracy: (accurate: boolean) => setAccuracy(accurate ? "accurate" : "inaccurate"),
    };
  }, [handleRef]);

  const title = escalation
    ? /* NEEDS-COPY-NICOLE */ "Escalation"
    : event
      ? EVENT_KIND_LABEL[event.kind]
      : "";

  if (!event && !escalation) {
    return (
      <div className="flex h-full items-center justify-center rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-6">
        <p className="text-[13.5px] text-[var(--text-secondary)]">
          {/* NEEDS-COPY-NICOLE */}
          Choose an event to review it.
        </p>
      </div>
    );
  }

  const submit = () => {
    if (!event) return;
    const d = dispositionById(disposition);
    if (!d) {
      /* INLINE, AND FOCUS MOVES TO IT. Not a toast and not a disabled button:
         the reader asked to resolve, and the answer to "why didn't that work" has
         to be where they were looking. */
      setHint(true);
      requestAnimationFrame(() => hintRef.current?.focus());
      return;
    }
    setHint(false);
    if (d.effect === "escalate") {
      onEscalate(event);
      return;
    }
    if (d.effect === "watch") {
      /* WATCHING IS NOT A RESOLUTION. It records that the event was seen and
         leaves it in the queue — which is the state whose clinical existence is
         the open question on `DISPOSITION_VALUES`. */
      return;
    }
    onResolve(event, { disposition: d, accuracy });
  };

  return (
    <div
      data-slot="event-pane"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-5 py-4">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
          {escalation && isActive(escalation) && <AlertTriangle className="size-3.5" aria-hidden />}
          {title}
        </p>
        <div className="mt-1.5">
          <RolePair
            teenName={escalation ? escalation.teenName : (event?.teenName ?? null)}
            mentorName={escalation ? escalation.mentorName : (event?.mentorName ?? "")}
          />
        </div>
        <p className="mt-1 text-[12px] leading-[17px] text-[var(--text-secondary)]">
          {escalation
            ? `${/* NEEDS-COPY-NICOLE */ "Triggered"} ${ageLabel(escalation.triggeredAt, now)}`
            : event
              ? ageLabel(event.at, now)
              : ""}
        </p>
      </div>

      {/* THE PANE'S OWN SCROLL — one of the surface's two regions. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {deactivated && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-3 text-[13px] leading-[19px] text-[var(--text-primary)]"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="size-4 shrink-0" aria-hidden />
              {/* NEEDS-COPY-NICOLE */}
              This teen&apos;s record was deactivated while you were reviewing it.
            </span>
            <span className="mt-1 block text-[var(--text-secondary)]">
              {/* NO DISPOSITION IS OFFERED BELOW. Recording a clinical judgment
                  against a record that no longer exists would file a decision
                  nobody can act on. */}
              Nothing recorded here would reach the record. Clinical Ops owns what
              happens next.
            </span>
          </div>
        )}
        {escalation ? (
          <EscalationBody rec={escalation} now={now} events={events} />
        ) : event?.subject === "teenSafety" ? (
          <FlagBody event={event} now={now} compliance={compliance} />
        ) : event ? (
          <PracticeBody event={event} now={now} />
        ) : null}
      </div>

      {/* ═══ THE FOOTER — PINNED, AND NOT A SCROLL REGION ═══
          `shrink-0` in a flex column, so the body scrolls behind it and the
          footer is never over content: nothing focusable can end up underneath
          it (WCAG 2.4.11). */}
      <div
        data-slot="event-pane-footer"
        className="shrink-0 border-t border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-5 py-4"
      >
        {escalation ? (
          <p className="text-[12.5px] leading-[17px] text-[var(--text-secondary)]">
            {/* ═══ IT POINTED AT ITSELF (arch-G, G6) ═══
                It read "the record is where the work happens" — written when
                this pane was a summary and the record was somewhere else. Since
                G6 this IS the record: the note module is above, the timeline is
                above, and every "Open the escalation record" lands here. A
                sentence sending a reader where they already are is worse than
                no sentence.
                WHAT IS STILL TRUE is the part decision 3 actually protects, and
                that is what it says. NEEDS-COPY-NICOLE, both. */}
            {recordLifecycleOf(escalation, now) === "closedDocumented"
              ? "Nothing further is owed on this escalation. The record stays here as it ages."
              : "The escalation's own state is not changed from a queue. What is owed is above, and the note is filed here."}
          </p>
        ) : deactivated ? (
          <p className="text-[12.5px] leading-[17px] text-[var(--text-secondary)]">
            {/* NEEDS-COPY-NICOLE */}
            No disposition can be recorded against a deactivated record.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <DispositionAxis
              value={disposition}
              onChange={(id) => {
                setDisposition(id);
                setHint(false);
              }}
              hint={hint}
              hintRef={hintRef}
            />
            <div className="flex flex-wrap items-end justify-between gap-4">
              <AccuracyAxis value={accuracy} onChange={setAccuracy} />
              <button
                type="button"
                onClick={submit}
                data-action="record"
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full bg-[var(--text-primary)] px-5 text-[14px] font-semibold text-[var(--surface-card)]",
                  "transition-opacity hover:opacity-90",
                  RING
                )}
              >
                {/* NEEDS-COPY-NICOLE. NOT "Resolve": one of the four dispositions
                    escalates and one keeps the event open, so the verb has to be
                    about recording the judgment rather than about closing. */}
                Record disposition
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
