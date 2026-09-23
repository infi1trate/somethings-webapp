"use client";

// ═══ THE ESCALATION TIMELINE — READ-ONLY, ATTRIBUTED, NO NARRATIVE ═══
//
// Every entry names its source and its time. Nothing here is generated: message
// content is quoted verbatim and system events are stated in the system's own
// words. §G8 defers AI annotation and the gate is with Meg — this is the shape
// that would host it and it holds assembled facts only.
//
// BOUNDED AND INTERNALLY SCROLLABLE, so a fifty-entry crisis cannot push the
// action row out of reach. One more scroll region than the pane would otherwise
// have, and the same argument the conversation excerpt makes applies: bounded,
// marked, `overscroll-contain`, so a reader can see which box their gesture
// belongs to. Reported rather than assumed — see the phase report.

import { useState } from "react";
import { Phone, PlusCircle } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import {
  MANUAL_ACTION_TYPES,
  SOURCE_LABEL,
  manualActionLabel,
  type TimelineEntry,
} from "@/lib/monitoring/timeline";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function timeOf(at: number): string {
  /* THE SURFACE'S ONE CLOCK FORMAT — `deadlineFactFor`, `childTimeLabel` and the
     completed group all use this. */
  return new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
function dayOf(at: number): string {
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export type ConversationSource = "supportThread" | "teenConversation";

function Entry({ e }: { e: TimelineEntry }) {
  const manual = e.source === "manual";
  return (
    <li
      data-timeline-entry={e.id}
      data-source={e.source}
      /* HAND-LOGGED IS A DIFFERENT KIND OF EVIDENCE, and the probe asserts the
         distinction rather than trusting the class string that draws it. */
      data-timeline-manual={manual ? "true" : "false"}
      className="flex gap-3 border-t border-[color:var(--border-subtle)] px-3 py-2.5 first:border-t-0"
    >
      <span
        data-timeline-time
        className="w-14 shrink-0 pt-0.5 text-[11.5px] tabular-nums text-[var(--text-secondary)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {timeOf(e.at)}
      </span>
      <span className="min-w-0 flex-1">
        <span data-timeline-label className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {/* ═══ THE SOURCE IS ON EVERY ENTRY, ALWAYS ═══
              The attribution requirement, and the type has no "unknown" member —
              an entry without a source cannot be constructed. */}
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-px text-[10.5px] uppercase tracking-wide",
              manual
                ? /* MANUALLY ENTERED IS VISUALLY DISTINCT: an assembled fact and
                     a remembered one are different kinds of evidence, and a
                     reader auditing this later has to be able to tell them
                     apart at a glance. Border rather than fill, so it reads as
                     annotated rather than as more urgent. */
                  "border border-[color:var(--border-contour)] text-[var(--text-primary)]"
                : "bg-[var(--surface-s1)] text-[var(--text-secondary)]"
            )}
          >
            {SOURCE_LABEL[e.source]}
          </span>
          {e.actionType && (
            <span className="shrink-0 text-[12px] font-semibold text-[var(--text-primary)]">
              {manualActionLabel(e.actionType)}
            </span>
          )}
          {e.author && (
            <span className="shrink-0 text-[12px] text-[var(--text-secondary)]">{e.author}</span>
          )}
          {e.afterWindow && (
            <span className="shrink-0 text-[11.5px] text-[var(--text-muted)]">
              {/* NEEDS-COPY-NICOLE. The timestamp is when it was LOGGED, and on a
                  closed escalation that is not when it happened. Saying so is
                  the difference between a record and a guess. */}
              logged after the escalation closed
            </span>
          )}
        </span>
        <span
          data-timeline-text
          className={cn(
            "mt-0.5 block text-[13px] leading-[19px] text-[var(--text-primary)]",
            /* VERBATIM CONTENT IS QUOTED, so a reader can see it is somebody's
               words rather than the system's account of them. */
            e.verbatim && "italic"
          )}
        >
          {e.verbatim ? `“${e.text}”` : e.text}
        </span>
      </span>
    </li>
  );
}

/** ═══ THE SOURCE IS THIS COMPONENT'S STATE NOW (Phase 6) ═══
 *
 *  It was `source` + `onSourceChange`, lifted into the caller — and TWO callers
 *  each kept their own copy, along with their own `added` map and their own
 *  `assembleTimeline(timelineSourcesFor(...))` call. Lifting state is right when
 *  something else needs to read it; nothing did. Both copies existed because the
 *  escalation record had two panes.
 *
 *  THE DE-FORK WAS TRIED BEFORE AND BACKED OUT, because both panes passed the
 *  props and changing one broke the other. Phase 6 retired the unrouted pane, so
 *  there is one caller and the state can live where it is used.
 *
 *  THE CALLER STILL SUPPLIES THE ENTRIES, and that split is deliberate: which
 *  SOURCE a reader is looking at is a view preference and belongs here, while
 *  WHAT the timeline contains is a join over the record, the flags and the
 *  manual log — and that is the page's data, not this component's. */
export function EscalationTimeline({
  /** A function rather than an array: the entries depend on the source, which is
   *  now local, so the caller is handed the source and returns its assembly.
   *  Keeps the join in the page without putting the view state there. */
  entriesFor,
  onLog,
  /** NEEDS-COPY-NICOLE. Named so the empty state can say which source is empty. */
  teenName,
}: {
  entriesFor: (source: ConversationSource) => TimelineEntry[];
  onLog: (entry: { actionType: string; detail: string }) => void;
  teenName: string | null;
}) {
  const [source, setSource] = useState<ConversationSource>("supportThread");
  const entries = entriesFor(source);
  const [logging, setLogging] = useState(false);
  const [actionType, setActionType] = useState<string>(MANUAL_ACTION_TYPES[0].id);
  const [detail, setDetail] = useState("");

  return (
    <div data-slot="escalation-timeline">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* ═══ A REAL TABLIST, UNLIKE THE KIND CHIPS ═══
            These two genuinely swap the panel's contents — support thread or teen
            conversation — which is the claim `role="tablist"` makes and the claim
            the filter chips deliberately avoid making. */}
        <div role="tablist" aria-label="Conversation source" className="flex items-center gap-1">
          {(
            [
              ["supportThread", "Support thread"],
              ["teenConversation", "Teen conversation"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={source === id}
              data-source-tab={id}
              onClick={() => setSource(id)}
              className={cn(
                /* 44px — HIG's floor, not WCAG's 24px. This is the escalation
                   surface: every control a supervisor reaches for during an
                   incident clears the platform minimum, which the region's rows
                   already did and the pane's did not. Measured at 36. */
                "inline-flex min-h-11 items-center rounded-full px-3 text-[12.5px] font-semibold",
                source === id
                  ? "bg-[var(--surface-s2)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {/* NEEDS-COPY-NICOLE */}
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLogging((v) => !v)}
          aria-expanded={logging}
          data-action="log"
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 text-[12.5px] font-semibold text-[var(--text-primary)]",
            "hover:bg-[var(--tint-hover)]",
            RING
          )}
        >
          <PlusCircle className="size-3.5 shrink-0" aria-hidden />
          {/* NEEDS-COPY-NICOLE */}
          Log an action
        </button>
      </div>

      {logging && (
        <div className="mt-2 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)] p-3">
          <div className="flex flex-wrap gap-2">
            <label className="min-w-0 flex-1">
              <span className="text-[11.5px] uppercase tracking-wide text-[var(--text-secondary)]">
                {/* NEEDS-COPY-NICOLE */}
                Action
              </span>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                aria-label="Action type"
                className={cn(
                  "mt-1 w-full rounded-[var(--radius-control)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-2.5 py-1.5 text-[13px]",
                  RING
                )}
              >
                {MANUAL_ACTION_TYPES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-2 block">
            <span className="text-[11.5px] uppercase tracking-wide text-[var(--text-secondary)]">
              {/* NEEDS-COPY-NICOLE */}
              What happened
            </span>
            <textarea
              rows={2}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              aria-label="What happened"
              className={cn(
                "mt-1 w-full resize-y rounded-[var(--radius-control)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-2.5 py-1.5 text-[13px]",
                RING
              )}
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11.5px] leading-[16px] text-[var(--text-secondary)]">
              {/* NEEDS-COPY-NICOLE. The entry is marked as hand-entered on the
                  timeline, and saying so here is what makes that honest rather
                  than a surprise. */}
              Recorded with your name and the current time, and marked as entered
              by hand.
            </p>
            <PillButton
              onClick={() => {
                onLog({ actionType, detail });
                setDetail("");
                setLogging(false);
              }}
              className="h-9 shrink-0 px-4 text-[13px]"
            >
              {/* NEEDS-COPY-NICOLE */}
              Log it
            </PillButton>
          </div>
        </div>
      )}

      {/* BOUNDED: ~260px, about eight entries, and it scrolls rather than
          growing — the action row below it must stay reachable at any length. */}
      <div
        tabIndex={0}
        role="group"
        aria-label="Escalation timeline"
        className={cn(
          "mt-2 max-h-[260px] overflow-y-auto overscroll-contain rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]",
          RING
        )}
      >
        {entries.length === 0 ? (
          <p className="px-3 py-4 text-[12.5px] leading-[18px] text-[var(--text-secondary)]">
            {/* ═══ THE EMPTY STATE NAMES WHAT IT IS AND HOW IT FILLS ═══
                NEEDS-COPY-NICOLE. "No entries" alone would read as a failure to
                load on a surface where a missing record is the frightening
                reading. */}
            {source === "supportThread"
              ? "No support-thread messages inside this escalation's window yet. Messages between the mentor and their supervisor appear here, with system events, as they happen."
              : `No messages with ${teenName ?? "the teen"} inside this escalation's window yet. Their conversation appears here, verbatim, alongside system events.`}
          </p>
        ) : (
          <ul role="list" className="min-w-0">
            {entries.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </ul>
        )}
      </div>

      <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] leading-[16px] text-[var(--text-secondary)]">
        <Phone className="size-3 shrink-0" aria-hidden />
        {/* ═══ THE HONEST CAVEAT, ON THE SURFACE ═══
            NEEDS-COPY-NICOLE. A timeline that looks complete while omitting a
            phone call invites misplaced trust, so it says outright that
            out-of-band actions only appear if somebody logs them. */}
        Phone calls and other out-of-band actions appear only when logged by hand.
      </p>
      <p className="sr-only">
        {/* The day, once, for a screen-reader user reading entry times. */}
        {entries.length > 0 ? `Times shown are on ${dayOf(entries[0].at)}.` : ""}
      </p>
    </div>
  );
}
