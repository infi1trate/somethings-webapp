"use client";

// CARE ASSISTANT RAIL — a scoped assistant about ONE teen, on the Care tab.
// This pass rebuilds its PRESENTATION only; no capability changed.
//
// WHY THE RAIL EXISTS AS A TOOL RATHER THAN A CONTENT CARD: the old rail held
// record content (an AI summary and a notes list), which gave care updates a
// second home and cost the history table 320px permanently. This one holds no
// record content, and it collapses — the reader decides when the width is worth
// spending.
//
// CLOSED STATE IS A HORIZONTAL PILL, NOT A ROTATED TAB. The previous launcher set
// its label with `writing-mode: vertical-rl`, which is unreadable at a glance,
// survives no translation gracefully, and is a genuine accessibility problem:
// rotated text defeats magnification and reflow. A pill at the top right of the
// content column costs one row of height and reads instantly.
//
// DISCLAIMERS MOVED TO THE FOOTER, MERGED INTO ONE LINE. They used to be two
// stacked blocks at the TOP of the panel — the most valuable space in it — so a
// reader met two caveats before any content. The scope and the provenance are one
// sentence pair at the foot now, still outside the scrolling thread so they cannot
// be pushed off, but no longer the first thing in the panel.
//
// NO CHAT COMPONENT WAS REUSED, DELIBERATELY. `first-chat-preview.tsx` has bubbles
// and is the only thread-like thing in the product, but its header says "FIXED
// IDENTITY — DO NOT THEME": it simulates the TEEN-facing mobile app with
// hard-coded whites and purples that must not follow a staff member's appearance
// setting. Reusing it would drag the teen palette into staff chrome and break
// dark mode. What IS reused are the main column's chip components — TonalChip,
// ScoreChip — so a structured answer looks native rather than pasted.
//
// TYPOGRAPHY IS SUBORDINATE TO THE RECORD, but the snapshot is prose, not a
// caption: 14px at 1.55 against the main column's 15px primary. A reader must be
// able to tell which is the record and which is commentary on it, without the
// commentary being unpleasant to read.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  MessagesSquare,
  PanelRightClose,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { chatHrefFor } from "@/lib/record/chat";
import { ScoreChip } from "@/components/record/score-chip";
import {
  ASSISTANT_DELAY_MS,
  ASSISTANT_ERROR_TRIGGER,
  ASSISTANT_FOOTER,
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
/** 11.5px muted — the eyebrow scale, below the 12px field-label stop. */
const EYEBROW = "text-[11.5px] leading-[16px] text-[var(--text-muted)]";
/** Fully rounded, tonal, tappable — prompt pills and the input share it. */
const PILL =
  "rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-s1)]";

let seq = 0;
const nextId = () => `turn-${++seq}`;

// ── Closed state ────────────────────────────────────────────────────────────

export function AssistantLauncher({
  onOpen,
  /** True when the snapshot changed since this reader last opened the rail. */
  hasUpdate = false,
}: {
  onOpen: () => void;
  hasUpdate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      /* TODO-COPY */
      aria-label="Open the care assistant"
      className={cn(
        "sticky top-6 flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3.5 py-2",
        "text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      <Sparkles className="size-4 shrink-0" aria-hidden />
      {/* TODO-COPY. Horizontal, readable, translatable — see the module note on
          why the rotated label is gone. */}
      Care assistant
      {hasUpdate && (
        // NEVER COLOUR ALONE: the dot is decorative and the label carries the
        // fact, so a reader who cannot see it still hears it.
        <span
          role="img"
          /* TODO-COPY */
          aria-label="Snapshot updated since you last opened this"
          className="size-1.5 shrink-0 rounded-full bg-[var(--alert-warm-accent)]"
        />
      )}
    </button>
  );
}

// ── Thread ──────────────────────────────────────────────────────────────────

/** THINKING, NOT SPINNING. A spinner says "the app is busy"; three settling dots
 *  say "someone is composing an answer", which is the truer description of what
 *  is happening and the calmer one to sit beside. Reduced-motion falls back to a
 *  static row, because a pulsing dot is exactly what that preference is for. */
function Thinking() {
  return (
    <p className="flex items-center gap-1.5" aria-live="polite">
      <span className="sr-only">{/* TODO-COPY */}Composing an answer…</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="size-1.5 rounded-full bg-[var(--text-muted)] motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </p>
  );
}

/** The one place a refusal is named. A refusal is a DECISION the assistant made,
 *  and a reader should see that rather than assume it failed to answer. Muted,
 *  never tinted — severity belongs to the task label band alone. */
function RefusalMark({ kind }: { kind: string }) {
  return (
    <p className={cn("flex items-center gap-1.5", EYEBROW)}>
      <ShieldAlert className="size-3 shrink-0" aria-hidden />
      {/* TODO-COPY */}
      {kind === "route_risk"
        ? "Routed to the escalation path"
        : kind === "refuse_clinical"
          ? "Not a clinical determination"
          : "Outside this record"}
    </p>
  );
}

function Turn({ turn, teenId }: { turn: AssistantTurn; teenId: string }) {
  const r = turn.reply;
  const refusal =
    r &&
    (r.kind === "refuse_clinical" ||
      r.kind === "refuse_scope" ||
      r.kind === "route_risk");

  return (
    <div className="space-y-3">
      {/* USER TURN — right-aligned tonal bubble. */}
      <div className="flex justify-end">
        <p className="max-w-[88%] rounded-2xl rounded-br-md bg-[var(--surface-s1)] px-3 py-2 text-[13px] leading-[19px] text-[var(--text-primary)]">
          {turn.question}
        </p>
      </div>

      {/* ASSISTANT TURN — left-aligned typeset text, NOT a bubble. A heavy
          bubble on both sides makes the machine a peer in the conversation; set
          as prose with a mark at the first line, it reads as commentary. */}
      <div className="flex gap-2">
        <Sparkles
          className="mt-0.5 size-3.5 shrink-0 text-[var(--text-muted)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {turn.pending && <Thinking />}

          {turn.error && (
            <p className="text-[13px] leading-[19px] text-[var(--state-error)]">
              {/* TODO-COPY. An ERROR, distinct from a refusal: the assistant did
                  not decline, it failed — and nothing reached the record either
                  way. */}
              Something went wrong reaching the assistant. Nothing was recorded —
              try again.
            </p>
          )}

          {r && (
            <>
              {refusal && <RefusalMark kind={r.kind} />}
              <p
                className={cn(
                  "text-[13.5px] text-[var(--text-primary)]",
                  refusal && "mt-1.5"
                )}
                style={{ lineHeight: 1.55 }}
              >
                {r.text}
              </p>

              {/* STRUCTURED ELEMENTS, using the MAIN COLUMN'S chips so an answer
                  looks native rather than pasted in. */}
              {r.chips && r.chips.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {r.chips.map((c) => (
                    <ScoreChip key={`${c.score}-${c.severity}`} {...c} />
                  ))}
                </p>
              )}

              {r.table && r.table.length > 0 && (
                <table className="mt-2 w-full text-left">
                  <tbody>
                    {r.table.map((row) => (
                      <tr
                        key={row[0]}
                        className="border-t border-[var(--border-subtle)]"
                      >
                        <td className="py-1 pr-3 text-[13px] leading-[19px] text-[var(--text-muted)]">
                          {row[0]}
                        </td>
                        <td className="py-1 text-right text-[13px] leading-[19px] tabular-nums text-[var(--text-primary)]">
                          {row[1]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {r.bullets && r.bullets.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {r.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex gap-2 text-[13px] leading-[19px] text-[var(--text-primary)]"
                    >
                      <span aria-hidden className="text-[var(--text-muted)]">
                        ·
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {/* LINKS BACK INTO THE RECORD. An answer that names a place should
                  take you there. */}
              {r.linkSection && (
                <button
                  type="button"
                  onClick={() => {
                    document
                      .querySelector(`[data-record-section="${r.linkSection}"]`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "mt-1.5 rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
                    RING
                  )}
                >
                  {/* TODO-COPY */}
                  {r.linkSectionLabel ?? "Show me"}
                </button>
              )}

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
                <p className={cn("mt-1.5", EYEBROW)}>
                  {/* TODO-COPY. Points at the workflow WITHOUT offering to start
                      it: raising an escalation is a person's judgement, and a
                      button here would let the assistant's guess begin a safety
                      process. */}
                  Escalations are raised from the conversation and appear under
                  Action required.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── The panel ───────────────────────────────────────────────────────────────

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
  const [inFlight, setInFlight] = useState(false);
  /** Once a conversation has started the prompts collapse behind one control —
   *  four pills above a live thread is the panel competing with itself. */
  const [promptsOpen, setPromptsOpen] = useState(false);
  const threadEnd = useRef<HTMLDivElement | null>(null);
  const updatedAt = summaryRefreshedAt ?? summary?.generatedAt ?? null;
  const started = turns.length > 0;

  // Follow the thread as it grows. Smooth, and only when something was added.
  useEffect(() => {
    if (started) threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, started]);

  /** EPHEMERAL BY CONSTRUCTION. Turns live in component state — never the store,
   *  never the record. Navigating away loses them, which is correct: nothing the
   *  assistant says is a record entry, and persisting a thread would be the first
   *  step toward treating it as one. */
  const ask = (question: string) => {
    const q = question.trim();
    if (!q || inFlight) return;
    const id = nextId();
    setTurns((t) => [...t, { id, question: q, reply: null, pending: true }]);
    setDraft("");
    setInFlight(true);
    window.setTimeout(() => {
      setInFlight(false);
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
      // 20px — matching the page's cards. The brief said 16px; the cards are
      // actually --radius-elevated (20px), and matching them is the requirement
      // that matters. Reported.
      className="sticky top-6 flex max-h-[calc(100dvh-3rem)] min-w-0 flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      {/* ── HEADER: icon + title + collapse. Nothing else. ──────────────── */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
          <Sparkles className="size-4 shrink-0" aria-hidden />
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

      {/* ── SCROLLING BODY: snapshot → thread ───────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {/* THE SNAPSHOT. Eyebrow + paragraph IS the lockup — the old "Where
            [Name] is" header was a third element saying what the eyebrow and the
            prose already say between them. */}
        <div className="pb-4">
          <div className="flex items-center justify-between gap-2">
            <p className={EYEBROW}>
              {/* TODO-COPY */}
              {updatedAt ? `Snapshot · updated ${clinicalDate(updatedAt)}` : "Snapshot"}
            </p>
            {onRefreshSummary && (
              <button
                type="button"
                onClick={onRefreshSummary}
                /* TODO-COPY */
                aria-label="Refresh the snapshot"
                className={cn(
                  "-m-1.5 shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                <RefreshCw className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <p
            className={cn(
              "mt-2 max-w-[46ch] text-[14px]",
              summary ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            )}
            style={{ lineHeight: 1.55 }}
          >
            {/* TODO-COPY on the empty state — same scale as the narrative, so an
                empty snapshot reads as a state rather than a broken caption. */}
            {summary?.text ?? "Not enough data yet."}
          </p>
        </div>

        {/* A hairline separates the snapshot from the conversation. */}
        {started && (
          <div className="space-y-5 border-t border-[var(--border-subtle)] py-4">
            {turns.map((t) => (
              <Turn key={t.id} turn={t} teenId={teenId} />
            ))}
            <div ref={threadEnd} />
          </div>
        )}
      </div>

      {/* ── COMPOSER: prompts + input, pinned. ──────────────────────────── */}
      <div className="border-t border-[var(--border-subtle)] px-4 pt-3">
        {/* PILLS, NOT CHEVRON ROWS. The old rows led with a left chevron, which
            reads as navigation — "this takes me somewhere" — when the actual
            affordance is "this asks a question". Once a conversation is running
            they collapse behind one control. */}
        {started ? (
          <button
            type="button"
            onClick={() => setPromptsOpen((o) => !o)}
            aria-expanded={promptsOpen}
            className={cn(
              "mb-2.5 inline-flex items-center gap-1.5 rounded-sm text-[12.5px] font-semibold text-[var(--text-secondary)] transition-opacity hover:opacity-70",
              RING
            )}
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                !promptsOpen && "-rotate-90"
              )}
              aria-hidden
            />
            {/* TODO-COPY */}
            Suggested questions
          </button>
        ) : null}

        {(!started || promptsOpen) && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className={cn(
                  PILL,
                  "px-3 py-1.5 text-left text-[12.5px] leading-[16px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className={cn(
            "mb-3 flex items-center gap-1 py-1 pl-3.5 pr-1",
            PILL,
            inFlight && "opacity-60"
          )}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={inFlight}
            /* TODO-COPY */
            aria-label={`Ask about ${teenName}`}
            placeholder={`Ask about ${teenName}…`}
            className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || inFlight}
            /* TODO-COPY */
            aria-label="Send"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)] transition-opacity",
              "disabled:opacity-30",
              RING
            )}
          >
            <Send className="size-3" aria-hidden />
          </button>
        </form>
      </div>

      {/* ── FOOTER: scope + provenance, ONE line, outside the scroll. ───── */}
      <p className="border-t border-[var(--border-subtle)] bg-[var(--surface-s1)] px-4 py-2 text-[11.5px] leading-[16px] text-[var(--text-muted)]">
        {ASSISTANT_FOOTER}
      </p>
    </aside>
  );
}
