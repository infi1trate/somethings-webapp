"use client";

// CARE ASSISTANT RAIL — a scoped assistant about ONE teen, on the Care tab.
//
// WHY THE RAIL CAME BACK, AND AS SOMETHING ELSE. The old rail was a content card
// (an AI summary and a notes list) sitting permanently beside the record, and it
// was deleted because it gave care updates a second home and cost the history
// table 320px it needed. This is not that: it is a TOOL, it is collapsible, and
// the reader decides when the width is worth spending.
//
// IT ALSO FIXES "SUMMARY OF WHAT?". The relocated care narrative is now the
// assistant's OPENING STATE — a summary about this teen, inside a tool about this
// teen, under a line that says so. The same paragraph read as unattributed
// commentary when it floated in the main column.
//
// AVAILABLE TO EVERY TIER. Mentors, lead mentors, supervisors and admins all
// read it; read-wide means read. The only thing that varies is the summary
// refresh, which is a supervisor action and is simply not passed below that tier
// — the rail contains NO other affordance that could leak, by construction: it
// cannot approve, write, amend or close anything, and it never authors a record
// entry.
//
// TYPOGRAPHY IS SUBORDINATE. 13px, secondary ink, never bold body. The main
// column's clinical text is 15px primary. A reader must be able to tell, without
// reading a word, which of the two is the record and which is a machine's
// commentary on it.
//
// PROVENANCE IS PINNED, NOT SCROLLED. The line sits under the header, outside the
// thread's scroll container, so it cannot be pushed off by a long conversation.

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  MessagesSquare,
  PanelRightClose,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { chatHrefFor } from "@/lib/record/chat";
import {
  ASSISTANT_DELAY_MS,
  ASSISTANT_ERROR_TRIGGER,
  ASSISTANT_PROVENANCE,
  ASSISTANT_SCOPE,
  SUGGESTED_QUESTIONS,
  askCareAssistant,
  type AssistantFacts,
  type AssistantTurn,
} from "@/lib/record/care-assistant";
import type { CareAiSummary } from "@/lib/record/care-demo";
import { clinicalDate } from "@/components/record/care-presentation";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;
/** Subordinate body: 13px secondary, never bold. */
const SUB = "text-[13px] leading-[19px] text-[var(--text-secondary)]";

let seq = 0;
const nextId = () => `turn-${++seq}`;

// ── Collapsed launcher ──────────────────────────────────────────────────────

export function AssistantLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      /* TODO-COPY */
      aria-label="Open the care assistant"
      className={cn(
        "sticky top-6 flex w-11 shrink-0 flex-col items-center gap-2 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-2 py-3",
        "text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
        RING
      )}
    >
      <Sparkles className="size-4" aria-hidden />
      {/* Vertical label so the launcher stays a slim edge rather than a button
          with a caption. */}
      <span
        className="text-[11px] font-semibold tracking-wide"
        style={{ writingMode: "vertical-rl" }}
      >
        {/* TODO-COPY */}
        Assistant
      </span>
    </button>
  );
}

// ── The rail ────────────────────────────────────────────────────────────────

export function CareAssistantRail({
  teenId,
  teenName,
  summary,
  summaryRefreshedAt,
  onRefreshSummary,
  facts,
  onCollapse,
}: {
  teenId: string;
  teenName: string;
  summary: CareAiSummary | null;
  summaryRefreshedAt: number | null;
  /** Supervisor tier only. Absent below — the rail's ONLY tier-varying element. */
  onRefreshSummary?: () => void;
  facts: AssistantFacts;
  onCollapse: () => void;
}) {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const updatedAt = summaryRefreshedAt ?? summary?.generatedAt ?? null;

  /** EPHEMERAL BY CONSTRUCTION. Turns live in component state — never in the
   *  store, never in the record. Navigating away loses them, which is correct:
   *  nothing the assistant says is a record entry, and persisting a thread into
   *  the store would be the first step toward treating it as one. */
  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const id = nextId();
    setTurns((t) => [...t, { id, question: q, reply: null, pending: true }]);
    setDraft("");
    window.setTimeout(() => {
      // The error path is a named trigger so the state is demonstrable.
      if (q.toLowerCase().includes(ASSISTANT_ERROR_TRIGGER)) {
        setTurns((t) =>
          t.map((x) => (x.id === id ? { ...x, pending: false, error: true } : x))
        );
        return;
      }
      const reply = askCareAssistant(q, facts);
      setTurns((t) =>
        t.map((x) => (x.id === id ? { ...x, pending: false, reply } : x))
      );
    }, ASSISTANT_DELAY_MS);
  };

  return (
    <aside
      aria-label="Care assistant"
      data-record-section="care-assistant"
      className="sticky top-6 flex max-h-[calc(100dvh-3rem)] min-w-0 flex-col rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <p
          className="flex items-center gap-1.5 text-[var(--text-muted)]"
          style={LABEL_STYLE}
        >
          <Sparkles className="size-3.5" aria-hidden />
          {/* TODO-COPY */}
          Care assistant
        </p>
        <button
          type="button"
          onClick={onCollapse}
          /* TODO-COPY */
          aria-label="Collapse the care assistant"
          className={cn(
            "-m-1.5 shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          <PanelRightClose className="size-4" aria-hidden />
        </button>
      </div>

      {/* ── 1 · SCOPE, stated before anything is asked ──────────────────── */}
      <p className={cn("mt-2 px-4", SUB)}>{ASSISTANT_SCOPE}</p>

      {/* ── PROVENANCE, PINNED. Outside the scroll container below, so a long
          thread can never push it off. ─────────────────────────────────── */}
      <p
        className="mt-2.5 border-y border-[var(--border-subtle)] bg-[var(--surface-s1)] px-4 py-2 text-[12px] leading-[17px] text-[var(--text-muted)]"
      >
        {ASSISTANT_PROVENANCE}
      </p>

      {/* ── SCROLLING BODY: summary → suggestions → thread ──────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* 2 · CARE SUMMARY NARRATIVE — the assistant's opening state. */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
              {/* TODO-COPY */}
              {`Where ${teenName} is`}
            </p>
            {onRefreshSummary && (
              <button
                type="button"
                onClick={onRefreshSummary}
                /* TODO-COPY */
                aria-label="Refresh the care summary"
                className={cn(
                  "-m-1.5 shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                <RefreshCw className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <p className={cn("mt-1.5", SUB)}>
            {summary?.text ?? (
              /* TODO-COPY — before a trend exists to describe. */
              <span className="text-[var(--text-muted)]">Not enough data yet.</span>
            )}
          </p>
          {updatedAt && (
            <p className="mt-1.5 text-[12px] leading-[17px] text-[var(--text-muted)]">
              {/* Clinical-adjacent date: explicit, not elapsed. */}
              {`Updated ${clinicalDate(updatedAt)}`}
            </p>
          )}
        </div>

        {/* 3 · SUGGESTED QUESTIONS */}
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
          <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
            {/* TODO-COPY */}
            Try asking
          </p>
          <ul className="mt-2 space-y-1.5">
            {SUGGESTED_QUESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ask(s)}
                  className={cn(
                    "flex w-full items-start gap-1.5 rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-left",
                    "text-[13px] leading-[18px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  <ChevronRight
                    className="mt-0.5 size-3.5 shrink-0 text-[var(--text-muted)]"
                    aria-hidden
                  />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* 4 · THREAD */}
        {turns.length > 0 && (
          <div className="mt-4 space-y-3">
            {turns.map((t) => (
              <TurnRow key={t.id} turn={t} teenId={teenId} />
            ))}
          </div>
        )}
      </div>

      {/* ── INPUT, pinned at the foot ───────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="flex items-center gap-2 border-t border-[var(--border-subtle)] px-4 py-3"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          /* TODO-COPY */
          aria-label={`Ask about ${teenName}`}
          placeholder={`Ask about ${teenName}…`}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-2.5",
            "text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            RING
          )}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          /* TODO-COPY */
          aria-label="Send"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-contour)] text-[var(--text-primary)] transition-colors",
            "hover:bg-[var(--tint-hover)] disabled:opacity-40",
            RING
          )}
        >
          <Send className="size-3.5" aria-hidden />
        </button>
      </form>
    </aside>
  );
}

/** A turn, with the conversation link pointed at the right person. */
function TurnRow({ turn, teenId }: { turn: AssistantTurn; teenId: string }) {
  const r = turn.reply;
  const refusal =
    r && (r.kind === "refuse_clinical" || r.kind === "refuse_scope" || r.kind === "route_risk");
  return (
    <div className="border-t border-[var(--border-subtle)] pt-3">
      <p className="text-[13px] font-semibold leading-[19px] text-[var(--text-primary)]">
        {turn.question}
      </p>

      {turn.pending && (
        <p className={cn("mt-1.5", SUB)} aria-live="polite">
          {/* TODO-COPY */}
          Looking through the record…
        </p>
      )}

      {turn.error && (
        <p className="mt-1.5 text-[13px] leading-[19px] text-[var(--state-error)]">
          {/* TODO-COPY. An ERROR, distinct from a refusal: the assistant did not
              decline, it failed — and nothing reached the record either way. */}
          Something went wrong reaching the assistant. Nothing was recorded — try
          again.
        </p>
      )}

      {r && (
        <>
          {refusal && (
            <p
              className="mt-1.5 flex items-center gap-1.5 text-[var(--text-muted)]"
              style={LABEL_STYLE}
            >
              <ShieldAlert className="size-3" aria-hidden />
              {/* TODO-COPY. Names WHICH guardrail fired, so the boundary is
                  legible rather than mysterious. */}
              {r.kind === "route_risk"
                ? "Routed to the escalation path"
                : r.kind === "refuse_clinical"
                  ? "Not a clinical determination"
                  : "Outside this record"}
            </p>
          )}
          <p className={cn("mt-1.5", SUB)}>{r.text}</p>
          {r.linkConversation && (
            <Link
              href={chatHrefFor(teenId)}
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
                RING
              )}
            >
              <MessagesSquare className="size-3.5" aria-hidden />
              {/* TODO-COPY */}
              Open the conversation
            </Link>
          )}
          {r.linkEscalation && (
            <p className={cn("mt-1.5 text-[var(--text-muted)]", SUB)}>
              {/* TODO-COPY. Points at the workflow WITHOUT offering to start it:
                  raising an escalation is a mentor's judgement, and a button here
                  would let the assistant's guess start a safety process. */}
              Escalations are raised from the conversation and appear in the task
              region at the top of this page.
            </p>
          )}
        </>
      )}
    </div>
  );
}
