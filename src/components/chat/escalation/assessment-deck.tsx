"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE ASSESSMENT DECK + COVERAGE RAIL (pack v8.0)
//
// ═══ SUPERSEDES THE ACCORDION (Supersession 1) ═══ v6.1's six-row accordion
// could collapse to nothing open. The deck cannot: an interactive deck ALWAYS
// shows exactly one active card — a question, or, once complete, the review
// card. "Zero expanded" is not a state this component can render.
//
//   RAIL   six tappable segments in instrument order — empty · Y · N ·
//          skipped (muted, struck). The current one carries the emphasis
//          ring; hover / focus reveals its short label. A tablist.
//   CARD   the verbatim question with the chart's example, Ask in chat, and
//          {TEEN}'S ANSWER (Yes / No, "Record what {teen} tells you."); Q6
//          nests its three-month follow-up on a Yes.
//   SKIP   Q1 No ∧ Q2 No → unanswered Q3–Q5 skip and the deck goes to Q6
//          (`lib/tiering/deck.ts` — the rule, a blocked constant). Recorded
//          answers are never discarded; an amend to Yes un-skips.
//
// Modes: holder (interactive), observer (the supervisor, read-only and live:
// each arriving answer ticks its segment), readonly (after Submit).

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { EscalationState, MessageOrigin } from "@/lib/chat/types";
import { ASSESSMENT_QUESTIONS, assessmentOf, riskLevel, type AssessmentQuestion } from "@/lib/tiering/escalation";
import { afterRecord, deckComplete, deckProgress, nextCard, segmentState, skipEnded, skippedIds, skipStarted, type DeckCard, type SegmentState } from "@/lib/tiering/deck";
import { BODY, Field, LABEL, OVERLINE, Primary, RING, RiskChip, TITLE } from "@/components/chat/escalation/controls";
import { Quote } from "@/components/chat/escalation/quote";
import { cn } from "@/lib/utils";

export type DeckMode = "holder" | "observer" | "readonly";

/** The page's mount: an answer stamped after it ARRIVED here, and ticks. */
const MOUNTED_AT = Date.now();

/* TODO-COPY, every string below. */
const SKIP_LINE = "not needed — no ideation indicated";
const NOT_ASKED = "Not asked — no ideation indicated";
const SKIP_SAID = "Questions 3 to 5 skipped — no ideation indicated";

const qn = (id: string) => ASSESSMENT_QUESTIONS.findIndex((q) => q.id === id) + 1;
const say = (s: SegmentState) => (s === "yes" ? "Yes" : s === "no" ? "No" : s === "skipped" ? "skipped" : "not answered");
/** "Q3–5" / "Q4–5" / "Q5". */
function rangeOf(ids: string[]): string {
  const n = ids.map(qn).sort((a, b) => a - b);
  return n.length === 1 ? `Q${n[0]}` : `Q${n[0]}–${n[n.length - 1]}`;
}

export function AssessmentDeck({
  e,
  name,
  mode,
  onAnswer,
  onUseWording,
  onSubmit,
  summaryBy,
}: {
  e: EscalationState;
  name: string;
  mode: DeckMode;
  onAnswer?: (id: string, v: "yes" | "no") => void;
  onUseWording?: (t: string, origin?: MessageOrigin) => void;
  onSubmit?: (summary: string) => void;
  summaryBy?: string;
}) {
  const a = assessmentOf(e);
  const answers = a.answers;
  const interactive = mode === "holder" && a.submittedAt === null && !!onAnswer;
  const live = mode === "observer";
  /** A tapped segment. Null follows the deck: the next required card. */
  const [picked, setPicked] = useState<DeckCard | null>(null);
  const [announce, setAnnounce] = useState("");
  const [summary, setSummary] = useState(e.mentorSummary ?? "");
  const [tried, setTried] = useState(false);
  const uid = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const advanced = useRef(false);

  /* ═══ THE ACTIVE CARD ═══
     holder    the picked segment, else the deck's next card — never null
     observer  the picked segment, else the latest arrival (null only before
               the first answer, a waiting card)
     readonly  the picked segment, else the review card */
  const latest = Object.entries(answers).filter(([id]) => qn(id) > 0).sort((x, y) => y[1].at - x[1].at)[0]?.[0] ?? null;
  const active: DeckCard | null = interactive ? (picked ?? nextCard(answers)) : live ? (picked ?? latest) : (picked ?? "review");

  /* Focus follows the deck's advance, onto the new card's first control. */
  useEffect(() => {
    if (!advanced.current) return;
    advanced.current = false;
    const el = cardRef.current;
    /* The review card's next step is the summary, not its first ledger row. */
    (el?.querySelector<HTMLElement>("textarea") ?? el?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const record = (id: string, v: "yes" | "no") => {
    if (!onAnswer) return;
    onAnswer(id, v);
    const next = afterRecord(answers, id, v);
    const p = deckProgress(next);
    const q = ASSESSMENT_QUESTIONS.find((x) => x.id === id || x.followUp?.id === id)!;
    const label = id === q.followUp?.id ? "Within the past 3 months" : q.assesses;
    /* "{label}: Yes · 2 of 3 needed answered" — and the skip, once. */
    const said = `${label}: ${v === "yes" ? "Yes" : "No"} · ${p.done} of ${p.needed} needed answered`;
    setAnnounce(skipStarted(answers, next) ? `${said}. ${SKIP_SAID}` : skipEnded(answers, next) ? `${said}. Questions 3 to 5 are needed again` : said);
    advanced.current = nextCard(next) !== id;
    setPicked(null);
  };

  const risk = riskLevel(answers);
  const prog = deckProgress(answers);
  const complete = deckComplete(answers);
  const skipped = [...skippedIds(answers)];
  /* The skip ripple plays only when the skip happened HERE, while this page
     was open — not on every load of an already-skipped record. */
  const skipFresh = skipped.length > 0 && Math.max(answers.q1?.at ?? 0, answers.q2?.at ?? 0) >= MOUNTED_AT;

  return (
    <div data-assessment-deck data-deck-mode={mode} data-deck-active={active ?? "waiting"} className="space-y-3">
      <p data-deck-live role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <CoverageRail
        uid={uid}
        answers={answers}
        active={active}
        live={live}
        skipFresh={skipFresh}
        onPick={(id) => setPicked(id)}
      />
      {skipped.length > 0 && (
        <p data-skip-line className="text-[var(--text-secondary)]" style={LABEL}>
          {rangeOf(skipped)} {SKIP_LINE}
        </p>
      )}
      <div ref={cardRef} id={`${uid}-card`} role="tabpanel" aria-labelledby={active && active !== "review" ? `${uid}-seg-${active}` : undefined} data-deck-card={active ?? "waiting"} className="scroll-mt-16">
        <div key={active ?? "waiting"} className="q-swap">
          {active === null ? (
            <p data-deck-waiting className="text-[var(--text-secondary)]" style={BODY}>
              {/* TODO-COPY */}
              No answers yet. They appear here as {name}&rsquo;s mentor records them.
            </p>
          ) : active === "review" ? (
            <ReviewCard
              answers={answers}
              name={name}
              interactive={interactive}
              onPick={(id) => setPicked(id)}
              summary={summary}
              setSummary={setSummary}
              tried={tried}
              onSubmit={
                interactive && complete && onSubmit
                  ? () => {
                      setTried(true);
                      if (summary.trim()) onSubmit(summary);
                    }
                  : undefined
              }
            />
          ) : interactive ? (
            <AskCard q={ASSESSMENT_QUESTIONS.find((x) => x.id === active)!} name={name} answers={answers} onAnswer={record} onUseWording={onUseWording} />
          ) : (
            <ReadCard q={ASSESSMENT_QUESTIONS.find((x) => x.id === active)!} answers={answers} />
          )}
        </div>
      </div>
      <div data-deck-footer className="flex flex-wrap items-center justify-between gap-2">
        <p data-assessment-progress className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}
          {prog.done} of {prog.needed} needed answered
        </p>
        {risk && (
          /* ═══ THE CALM UNDERLINE (make it magical 3) ═══ On the observer's
             rail, a complete assessment settles into one quiet rule beneath
             the chip. */
          <span data-review-risk data-deck-settled={live && complete ? "" : undefined} className={cn("inline-flex pb-1", live && complete && "deck-settle border-b-2 border-[color:var(--border-strong)]")}>
            <RiskChip level={risk} />
          </span>
        )}
      </div>
      {interactive && (
        <p className="text-[var(--text-muted)]" style={LABEL}>
          {/* TODO-COPY — the pack's line, once. */}
          Your supervisor sees each answer as you give it.
        </p>
      )}
      {!interactive && e.mentorSummary && a.submittedAt !== null && (
        <Quote slot="mentor-summary" text={e.mentorSummary} who={summaryBy ?? "Mentor's summary"} at={a.submittedAt} />
      )}
    </div>
  );
}

/** ═══ THE COVERAGE RAIL ═══ One row of six; the state is a letter and a
 *  shape, never colour alone — Y, N, an empty well, a struck skipped mark. */
function CoverageRail({
  uid,
  answers,
  active,
  live,
  skipFresh,
  onPick,
}: {
  uid: string;
  answers: ReturnType<typeof assessmentOf>["answers"];
  active: DeckCard | null;
  live: boolean;
  skipFresh: boolean;
  onPick: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (ev: React.KeyboardEvent, i: number) => {
    const n = ASSESSMENT_QUESTIONS.length;
    const to = ev.key === "ArrowRight" ? (i + 1) % n : ev.key === "ArrowLeft" ? (i - 1 + n) % n : ev.key === "Home" ? 0 : ev.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    ev.preventDefault();
    refs.current[to]?.focus();
  };
  const focusIdx = Math.max(0, ASSESSMENT_QUESTIONS.findIndex((q) => q.id === active));
  let skipOrder = 0;
  return (
    <div role="tablist" aria-label="Assessment questions" data-coverage-rail className="grid grid-cols-6 gap-1.5">
      {ASSESSMENT_QUESTIONS.map((q, i) => {
        const s = segmentState(answers, q.id);
        const on = active === q.id;
        const at = answers[q.id]?.at ?? 0;
        const arrived = live && at >= MOUNTED_AT;
        const ripple = s === "skipped" && skipFresh ? skipOrder++ : -1;
        return (
          <button
            key={`${q.id}:${s}`}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-seg-${q.id}`}
            aria-selected={on}
            aria-controls={`${uid}-card`}
            tabIndex={i === focusIdx ? 0 : -1}
            aria-label={`Question ${i + 1}, ${q.assesses}: ${say(s)}`}
            data-segment={q.id}
            data-segment-state={s}
            onClick={() => onPick(q.id)}
            onKeyDown={(ev) => onKey(ev, i)}
            style={ripple >= 0 ? { animationDelay: `${ripple * 70}ms` } : undefined}
            className={cn(
              "group relative flex h-10 min-w-0 flex-col items-center justify-center rounded-[10px] border tabular-nums",
              s === "empty" && "border-dashed border-[color:var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)]",
              (s === "yes" || s === "no") && "border-[color:var(--border-default)] bg-[var(--surface-s2)] text-[var(--text-primary)]",
              s === "skipped" && "border-[color:var(--border-subtle)] bg-[var(--surface-s1)] text-[var(--text-muted)]",
              /* THE EMPHASIS RING is a 2px ink border, not a box-shadow
                 ring: the current timeline node stays the only element that
                 is raised AND ringed (v4.0's rule, measured). */
              on && "border-2 border-solid border-[color:var(--text-primary)]",
              arrived && "tier-settle",
              ripple >= 0 && "seg-skip",
              RING
            )}
          >
            <span aria-hidden className={cn("text-[11px] leading-[14px]", s === "skipped" && "line-through")}>
              Q{i + 1}
            </span>
            <span aria-hidden data-segment-mark className="text-[12px] leading-[14px]" style={{ fontFamily: "var(--font-mono)" }}>
              {s === "yes" ? "Y" : s === "no" ? "N" : s === "skipped" ? "–" : "·"}
            </span>
            {/* Press / hover / focus reveals the short label. */}
            <span aria-hidden data-segment-label className="pointer-events-none absolute bottom-full left-1/2 z-[4] mb-1.5 hidden -translate-x-1/2 rounded-md bg-[var(--text-primary)] px-2 py-1 text-[11px] leading-[14px] whitespace-nowrap text-[var(--text-inverse)] group-hover:block group-focus-visible:block group-active:block">
              {q.assesses}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** ═══ THE ACTIVE CARD — the v4.0 two zones, unchanged ═══ */
function AskCard({ q, name, answers, onAnswer, onUseWording }: { q: AssessmentQuestion; name: string; answers: ReturnType<typeof assessmentOf>["answers"]; onAnswer: (id: string, v: "yes" | "no") => void; onUseWording?: (t: string, origin?: MessageOrigin) => void }) {
  const follow = q.followUp && answers[q.id]?.value === "yes" ? q.followUp : null;
  return (
    <div data-assessment data-assessment-active={q.id} className="space-y-3">
      <section data-zone="ask" aria-labelledby={`${q.id}-ask`} className="space-y-1.5">
        <p id={`${q.id}-ask`} data-zone-label className={cn(OVERLINE, "text-[var(--text-muted)]")}>
          {/* TODO-COPY */}
          Ask {name}
        </p>
        <p data-question-text className="text-[var(--text-primary)]" style={TITLE}>
          &ldquo;{q.text}&rdquo;
        </p>
        {q.example && (
          <p className="text-[var(--text-secondary)]" style={LABEL}>
            {q.example}
          </p>
        )}
        <AskInChat id={q.id} text={q.text} onUseWording={onUseWording} />
      </section>
      <AnswerZone id={q.id} name={name} value={answers[q.id]?.value} onAnswer={onAnswer} />
      {follow && (
        <section data-acc-followup={follow.id} aria-labelledby={`${follow.id}-ask`} className="space-y-2 border-l-2 border-[color:var(--border-subtle)] pl-3">
          <p id={`${follow.id}-ask`} className="text-[var(--text-primary)]" style={BODY}>
            &ldquo;{follow.text}&rdquo;
          </p>
          <AskInChat id={follow.id} text={follow.text} onUseWording={onUseWording} />
          <AnswerZone id={follow.id} name={name} value={answers[follow.id]?.value} onAnswer={onAnswer} />
        </section>
      )}
    </div>
  );
}

function AskInChat({ id, text, onUseWording }: { id: string; text: string; onUseWording?: (t: string, origin?: MessageOrigin) => void }) {
  if (!onUseWording) return null;
  return (
    <button
      type="button"
      data-assessment-wording={id}
      onClick={() => onUseWording(text, { kind: "assessment", questionId: id })}
      className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-raised)] px-3.5 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
      style={BODY}
    >
      {/* TODO-COPY */}
      Ask in chat <ArrowRight aria-hidden className="size-3.5" />
    </button>
  );
}

function AnswerZone({ id, name, value, onAnswer }: { id: string; name: string; value: "yes" | "no" | undefined; onAnswer: (id: string, v: "yes" | "no") => void }) {
  return (
    /* On a sunken well — subordinate to the asking (v4.0), with no card
       inside the node card. */
    <section data-zone="answer" aria-labelledby={`${id}-answer`} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
      <div className="min-w-0">
        <p id={`${id}-answer`} data-zone-label className={cn(OVERLINE, "text-[var(--text-muted)]")}>
          {/* TODO-COPY */}
          {name}&rsquo;s answer
        </p>
        <p data-zone-hint className="text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY — the pack's line. */}
          Record what {name} tells you.
        </p>
      </div>
      {/* ═══ ANSWERS ARE ACTIONS, NOT A SELECTION ═══ Two buttons in a
          labelled group; `aria-pressed` shows what is recorded. */}
      <div role="group" aria-label={`${name}'s answer`} className="flex gap-1.5">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            data-yes-no={`${id}:${v}`}
            onClick={() => onAnswer(id, v)}
            className={cn(
              "inline-flex min-h-9 min-w-14 items-center justify-center rounded-full border px-3 hover:bg-[var(--tint-hover)]",
              value === v ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)] text-[var(--text-primary)]" : "border-[color:var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-primary)]",
              RING
            )}
            style={BODY}
          >
            {v === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Read-only: the question VERBATIM and its answer. */
function ReadCard({ q, answers }: { q: AssessmentQuestion; answers: ReturnType<typeof assessmentOf>["answers"] }) {
  const s = segmentState(answers, q.id);
  const follow = q.followUp && answers[q.followUp.id] ? q.followUp : null;
  const word = (v?: "yes" | "no") => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
  return (
    <div data-acc-read className="space-y-2" style={LABEL}>
      <p className={cn(OVERLINE, "text-[var(--text-muted)]")}>
        Q{qn(q.id)} · {q.assesses}
      </p>
      <p data-answer-verbatim className="text-[var(--text-primary)]">
        &ldquo;{q.text}&rdquo; <span className="text-[var(--text-secondary)]">— {s === "skipped" ? NOT_ASKED : word(answers[q.id]?.value)}</span>
      </p>
      {follow && (
        <p data-answer-verbatim={follow.id} className="border-l-2 border-[color:var(--border-subtle)] pl-3 text-[var(--text-primary)]">
          &ldquo;{follow.text}&rdquo; <span className="text-[var(--text-secondary)]">— {word(answers[follow.id]?.value)}</span>
        </p>
      )}
    </div>
  );
}

/** ═══ THE REVIEW CARD — the deck's last card ═══ The ledger: one row per
 *  question, a skipped row reading "Not asked — no ideation indicated"; then,
 *  for the holder, the note and Submit. A row taps back to its question. */
function ReviewCard({
  answers,
  name,
  interactive,
  onPick,
  summary,
  setSummary,
  tried,
  onSubmit,
}: {
  answers: ReturnType<typeof assessmentOf>["answers"];
  name: string;
  interactive: boolean;
  onPick: (id: string) => void;
  summary: string;
  setSummary: (s: string) => void;
  tried: boolean;
  onSubmit?: () => void;
}) {
  return (
    <div data-review-ledger className="space-y-3">
      <p className={cn(OVERLINE, "text-[var(--text-muted)]")}>
        {/* TODO-COPY */}
        Review
      </p>
      <ol className="space-y-1">
        {ASSESSMENT_QUESTIONS.map((q) => {
          const s = segmentState(answers, q.id);
          const follow = q.followUp && answers[q.followUp.id];
          return (
            <li key={q.id} data-ledger-row={q.id} data-ledger-state={s}>
              <button
                type="button"
                onClick={() => onPick(q.id)}
                /* A skipped row STACKS — the label over "Not asked — …" — so
                   the long reason never crushes the label into a column
                   (measured: "Met / hod, / no / inte / nt"). */
                className={cn("flex min-h-8 w-full gap-x-2 rounded-[var(--radius-inset)] px-2 py-1 text-left hover:bg-[var(--tint-hover)]", s === "skipped" ? "flex-col items-start" : "items-center", RING)}
                style={LABEL}
              >
                <span className="min-w-0 flex-1 break-words text-[var(--text-secondary)]">{q.assesses}</span>
                <span data-ledger-value className={cn(s === "skipped" ? "text-[var(--text-muted)]" : "shrink-0 text-right text-[var(--text-primary)]")}>
                  {s === "skipped" ? NOT_ASKED : s === "empty" ? "—" : `${say(s)}${follow ? ` · past 3 months: ${follow.value === "yes" ? "Yes" : "No"}` : ""}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {interactive && onSubmit && (
        <>
          <Field slot="mentor-summary" label={`In a sentence or two, what's going on with ${name}`} value={summary} onChange={setSummary} invalid={tried && !summary.trim()} />
          {tried && !summary.trim() && (
            <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
              {/* TODO-COPY */}
              Add a sentence for your supervisor.
            </p>
          )}
          <Primary slot="submit-assessment" onClick={onSubmit}>
            {/* TODO-COPY */}
            Submit to supervisor
          </Primary>
        </>
      )}
    </div>
  );
}
