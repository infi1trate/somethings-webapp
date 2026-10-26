"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE GUIDED ASSESSMENT (pack v9.0, Part 2) — a focused form
//
// ═══ SUPERSEDES THE DECK (Supersessions 1–2) ═══ v8's `AssessmentDeck` +
// `CoverageRail` abstracted the instrument into six coordinates (Q1…Q6 and a
// letter), and its review ledger read the supervisor's short labels where the
// questions were. Both are deleted. The instrument is always whole now:
//
//   EVERY QUESTION, ALWAYS, AS ITSELF  number · the FULL verbatim C-SSRS text
//          · an answer chip (— / Yes / No / Not needed). Unfocused questions
//          sit one type step down and one ink step muted — full text,
//          wrapped, NEVER clamped (a blocked constant). Skipped questions dim
//          with "Not needed"; their text stays readable.
//   EXACTLY ONE FOCUSED QUESTION in every capture state: the full type step,
//          the emphasis ring, ASK {TEEN} (the question, the chart's example,
//          Ask in chat) and {TEEN}'S ANSWER (Yes / No, "Record what {teen}
//          tells you."). Q6 nests its three-month follow-up on a Yes.
//   THE FORM IS THE REVIEW  Once complete nothing is focused — the ONE
//          zero-focus state — every answer is visible, and the risk chip, the
//          "In a sentence or two…" note and Submit rise in at the bottom.
//          Tapping any question from review re-enters capture there; the chip
//          recomputes on the next record.
//
// ═══ DIRECTION ═══ A record advances focus to the next REQUIRED unanswered
// question in instrument order (`nextCard`), with a soft scroll-and-settle;
// tapping a question moves focus there. The skip rule, never-discard and
// amend-un-skip are `lib/tiering/deck.ts`'s, unchanged.
//
// Modes: holder (the mentor, interactive) · observer (the supervisor, live
// and read-only — answers arrive in place with the quiet tick) · readonly
// (after Submit).

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { EscalationState, MessageOrigin } from "@/lib/chat/types";
import { ASSESSMENT_QUESTIONS, RISK_LABEL, assessmentOf, riskLevel, type AssessmentQuestion } from "@/lib/tiering/escalation";
import { afterRecord, deckProgress, nextCard, segmentState, skipEnded, skippedIds, skipStarted, type SegmentState } from "@/lib/tiering/deck";
import { BODY, Field, LABEL, OVERLINE, Primary, RING, RiskChip, TITLE } from "@/components/chat/escalation/controls";
import { Quote } from "@/components/chat/escalation/quote";
import { cn } from "@/lib/utils";

export type AssessmentMode = "holder" | "observer" | "readonly";

/** The page's mount: an answer stamped after it ARRIVED here, and ticks. */
const MOUNTED_AT = Date.now();
const TOTAL = ASSESSMENT_QUESTIONS.length;

/* TODO-COPY, every string below. */
const SKIP_LINE = "not needed — no ideation indicated";
const SKIP_SAID = "Questions 3 to 5 not needed — no ideation indicated.";
const UNSKIP_SAID = "Questions 3 to 5 are needed again.";
const NOT_NEEDED = "Not needed";

type Answers = ReturnType<typeof assessmentOf>["answers"];

const qn = (id: string) => ASSESSMENT_QUESTIONS.findIndex((q) => q.id === id) + 1;
const word = (v?: "yes" | "no") => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
/** "Q3–5" / "Q4–5" / "Q5". */
function rangeOf(ids: string[]): string {
  const n = ids.map(qn).sort((a, b) => a - b);
  return n.length === 1 ? `Q${n[0]}` : `Q${n[0]}–${n[n.length - 1]}`;
}
const reduceMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce");

export function GuidedAssessment({
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
  mode: AssessmentMode;
  onAnswer?: (id: string, v: "yes" | "no") => void;
  onUseWording?: (t: string, origin?: MessageOrigin) => void;
  onSubmit?: (summary: string) => void;
  summaryBy?: string;
}) {
  const a = assessmentOf(e);
  const answers = a.answers;
  const interactive = mode === "holder" && a.submittedAt === null && !!onAnswer;
  const live = mode === "observer";
  /** A tapped question. Null follows the form: the next required one. */
  const [picked, setPicked] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [summary, setSummary] = useState(e.mentorSummary ?? "");
  const [tried, setTried] = useState(false);
  /** The review rose in HERE, on the last needed answer (make it magical 3). */
  const [rose, setRose] = useState(false);
  const uid = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  /** Set by a record or a tap: the next focus change moves the reader too. */
  const moved = useRef(false);

  const next = nextCard(answers);
  /* ═══ THE ONE FOCUSED QUESTION ═══ Holder only: the picked question, else
     the next required one — null ONLY when complete (the review state). The
     observer and the read-only form focus nothing: they are reading. */
  const focused: string | null = interactive ? (picked ?? (next === "review" ? null : next)) : null;
  const reviewing = interactive && focused === null;

  /* ═══ FOCUS AS A LENS (make it magical 2) ═══ When the focus travels, the
     form scrolls the new question into view and keyboard focus lands on its
     first control; entering review lands on the note. Only after a record or
     a tap — never on load, which would yank the panel. */
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const behavior: ScrollBehavior = reduceMotion() ? "auto" : "smooth";
    if (focused === null) {
      reviewRef.current?.scrollIntoView({ block: "nearest", behavior });
      reviewRef.current?.querySelector<HTMLElement>("textarea")?.focus({ preventScroll: true });
      return;
    }
    const el = listRef.current?.querySelector<HTMLElement>(`[data-ga-question="${focused}"]`);
    el?.scrollIntoView({ block: "nearest", behavior });
    el?.querySelector<HTMLElement>("[data-ga-first]")?.focus({ preventScroll: true });
  }, [focused]);

  const record = (id: string, v: "yes" | "no") => {
    if (!onAnswer) return;
    onAnswer(id, v);
    const after = afterRecord(answers, id, v);
    const p = deckProgress(after);
    const q = ASSESSMENT_QUESTIONS.find((x) => x.id === id || x.followUp?.id === id)!;
    const n = qn(q.id);
    const label = id === q.followUp?.id ? `Question ${n}, within the past 3 months` : `Question ${n}`;
    const upcoming = nextCard(after);
    /* "Question 1: Yes · 2 of 3 needed answered" — the skip, once; then
       where the focus went, or the risk the review now suggests. */
    const parts = [`${label}: ${v === "yes" ? "Yes" : "No"} · ${p.done} of ${p.needed} needed answered.`];
    if (skipStarted(answers, after)) parts.push(SKIP_SAID);
    if (skipEnded(answers, after)) parts.push(UNSKIP_SAID);
    if (upcoming === "review") {
      const r = riskLevel(after);
      parts.push(`All needed questions answered.${r ? ` Assessment suggests: ${RISK_LABEL[r]}.` : ""}`);
    } else if (upcoming !== q.id) {
      parts.push(`Question ${qn(upcoming)} of ${TOTAL}.`);
    }
    setAnnounce(parts.join(" "));
    moved.current = upcoming !== q.id;
    if (upcoming === "review" && next !== "review") setRose(true);
    setPicked(null);
  };

  const pick = (id: string) => {
    if (!interactive || id === focused) return;
    moved.current = true;
    setPicked(id);
    setAnnounce(`Question ${qn(id)} of ${TOTAL}.`);
  };

  const risk = riskLevel(answers);
  const prog = deckProgress(answers);
  const skipped = [...skippedIds(answers)];

  return (
    <div data-guided-assessment data-ga-mode={mode} data-ga-focus={focused ?? "none"} data-ga-review={reviewing ? "" : undefined} className="space-y-3">
      <p data-ga-live role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {skipped.length > 0 && (
        <p data-skip-line className="text-[var(--text-secondary)]" style={LABEL}>
          {rangeOf(skipped)} {SKIP_LINE}
        </p>
      )}
      <ol ref={listRef} aria-label="Assessment questions" data-ga-list className="space-y-1.5">
        {ASSESSMENT_QUESTIONS.map((q) => (
          <QuestionGroup
            key={q.id}
            uid={uid}
            q={q}
            name={name}
            answers={answers}
            focused={focused === q.id}
            interactive={interactive}
            live={live}
            onPick={() => pick(q.id)}
            onAnswer={record}
            onUseWording={onUseWording}
          />
        ))}
      </ol>

      {/* ═══ THE FORM-TO-REVIEW EXHALE (make it magical 3) ═══ With the last
          needed answer the ring lets go and these rise in — asking becomes
          reflecting, a register change rather than a page change. */}
      {reviewing ? (
        <div ref={reviewRef} data-ga-review-block className={cn("scroll-mt-16 space-y-3 border-t border-[color:var(--border-subtle)] pt-3", rose && "ga-rise")}>
          <span data-review-risk className="inline-flex">
            <RiskChip level={risk} />
          </span>
          <Field slot="mentor-summary" label={`In a sentence or two, what's going on with ${name}`} value={summary} onChange={setSummary} invalid={tried && !summary.trim()} />
          {tried && !summary.trim() && (
            <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
              {/* TODO-COPY */}
              Add a sentence for your supervisor.
            </p>
          )}
          {onSubmit && (
            <Primary
              slot="submit-assessment"
              onClick={() => {
                setTried(true);
                if (summary.trim()) onSubmit(summary);
              }}
            >
              {/* TODO-COPY */}
              Submit to supervisor
            </Primary>
          )}
        </div>
      ) : (
        <div data-ga-footer className="flex flex-wrap items-center justify-between gap-2">
          <p data-assessment-progress className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY */}
            {prog.done} of {prog.needed} needed answered
          </p>
          {risk && (
            <span data-review-risk className="inline-flex">
              <RiskChip level={risk} />
            </span>
          )}
        </div>
      )}
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

/** The answer chip: the state in WORDS, never colour alone. */
function AnswerChip({ state, slot }: { state: SegmentState; slot: string }) {
  return (
    <span
      data-ga-chip={slot}
      data-ga-chip-state={state}
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 whitespace-nowrap",
        state === "yes" || state === "no"
          ? "border-[color:var(--border-default)] bg-[var(--surface-s2)] text-[var(--text-primary)]"
          : state === "skipped"
            ? "border-[color:var(--border-subtle)] text-[var(--text-muted)]"
            : "border-dashed border-[color:var(--border-default)] text-[var(--text-secondary)]"
      )}
      style={LABEL}
    >
      {state === "skipped" ? (
        NOT_NEEDED
      ) : state === "empty" ? (
        <>
          <span aria-hidden>—</span>
          <span className="sr-only">Not answered</span>
        </>
      ) : (
        word(state)
      )}
    </span>
  );
}

/** ═══ ONE QUESTION GROUP ═══ Focused, it is the two-zone card; otherwise
 *  the compact row — a button for the holder (a tap moves focus here), plain
 *  for the observer and the read-only form. The text is the same verbatim
 *  string in both, at a different step. */
function QuestionGroup({
  uid,
  q,
  name,
  answers,
  focused,
  interactive,
  live,
  onPick,
  onAnswer,
  onUseWording,
}: {
  uid: string;
  q: AssessmentQuestion;
  name: string;
  answers: Answers;
  focused: boolean;
  interactive: boolean;
  live: boolean;
  onPick: () => void;
  onAnswer: (id: string, v: "yes" | "no") => void;
  onUseWording?: (t: string, origin?: MessageOrigin) => void;
}) {
  const n = qn(q.id);
  const s = segmentState(answers, q.id);
  const follow = q.followUp && answers[q.id]?.value === "yes" ? q.followUp : null;
  const followAnswer = q.followUp ? answers[q.followUp.id] : undefined;
  const headId = `${uid}-${q.id}`;
  /* The observer's quiet tick: an answer that arrived while this page was
     open settles once, in place. */
  const arrived = live && (answers[q.id]?.at ?? 0) >= MOUNTED_AT;

  if (focused) {
    return (
      <li data-ga-question={q.id} data-ga-state={s} data-ga-focused="" aria-current="step" className="scroll-mt-16">
        <section
          aria-labelledby={headId}
          data-assessment
          data-assessment-active={q.id}
          /* ═══ THE EMPHASIS RING ═══ A 2px ink border, not a raised shadow:
             the current timeline node stays the only element raised AND
             ringed (v4.0's rule). */
          className="q-swap space-y-3 rounded-[var(--radius-inset)] border-2 border-[color:var(--text-primary)] bg-[var(--surface-raised)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p id={headId} className={cn(OVERLINE, "tabular-nums text-[var(--text-muted)]")}>
              {/* TODO-COPY */}
              Question {n} of {TOTAL}
            </p>
            <AnswerChip state={s} slot={q.id} />
          </div>
          <div data-zone="ask" className="space-y-1.5">
            <p data-zone-label className={cn(OVERLINE, "text-[var(--text-muted)]")}>
              {/* TODO-COPY */}
              Ask {name}
            </p>
            <p data-question-text={q.id} className="m-0 text-[var(--text-primary)]" style={TITLE}>
              &ldquo;{q.text}&rdquo;
            </p>
            {q.example && (
              <p className="m-0 text-[var(--text-secondary)]" style={LABEL}>
                {q.example}
              </p>
            )}
            <AskInChat id={q.id} text={q.text} onUseWording={onUseWording} first />
          </div>
          <AnswerZone id={q.id} name={name} value={answers[q.id]?.value} onAnswer={onAnswer} first={!onUseWording} />
          {follow && (
            <section data-ga-followup={follow.id} aria-label="Within the past 3 months" className="space-y-2 border-l-2 border-[color:var(--border-subtle)] pl-3">
              <p data-question-text={follow.id} className="m-0 text-[var(--text-primary)]" style={BODY}>
                &ldquo;{follow.text}&rdquo;
              </p>
              <AskInChat id={follow.id} text={follow.text} onUseWording={onUseWording} />
              <AnswerZone id={follow.id} name={name} value={answers[follow.id]?.value} onAnswer={onAnswer} />
            </section>
          )}
        </section>
      </li>
    );
  }

  /* ═══ THE COMPACT ROW ═══ number · full text (14/20, one ink step muted)
     · chip. Skipped: the muted ink, "Not needed" — still readable. */
  const body = (
    <>
      <span aria-hidden className="w-4 shrink-0 pt-px text-right font-mono text-[12px] leading-[20px] tabular-nums text-[var(--text-muted)]">
        {n}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="sr-only">Question {n}: </span>
        <span data-question-text={q.id} className={cn("block break-words", s === "skipped" ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]")} style={BODY}>
          {q.text}
        </span>
        {q.followUp && followAnswer && (
          <span data-ga-followup-row={q.followUp.id} className="flex items-start justify-between gap-2 border-l-2 border-[color:var(--border-subtle)] pl-2">
            <span data-question-text={q.followUp.id} className="min-w-0 break-words text-[var(--text-secondary)]" style={LABEL}>
              {q.followUp.text}
            </span>
            <AnswerChip state={followAnswer.value} slot={q.followUp.id} />
          </span>
        )}
      </span>
      <AnswerChip state={s} slot={q.id} />
    </>
  );
  const row = "flex w-full items-start gap-2.5 rounded-[var(--radius-inset)] px-2 py-2 text-left";
  return (
    <li data-ga-question={q.id} data-ga-state={s} className={cn("scroll-mt-16", arrived && "tier-settle")}>
      {interactive ? (
        <button type="button" onClick={onPick} className={cn(row, "hover:bg-[var(--tint-hover)]", RING)}>
          {body}
        </button>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

function AskInChat({ id, text, onUseWording, first = false }: { id: string; text: string; onUseWording?: (t: string, origin?: MessageOrigin) => void; first?: boolean }) {
  if (!onUseWording) return null;
  return (
    <button
      type="button"
      data-assessment-wording={id}
      data-ga-first={first ? "" : undefined}
      onClick={() => onUseWording(text, { kind: "assessment", questionId: id })}
      className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-raised)] px-3.5 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
      style={BODY}
    >
      {/* TODO-COPY */}
      Ask in chat <ArrowRight aria-hidden className="size-3.5" />
    </button>
  );
}

function AnswerZone({ id, name, value, onAnswer, first = false }: { id: string; name: string; value: "yes" | "no" | undefined; onAnswer: (id: string, v: "yes" | "no") => void; first?: boolean }) {
  return (
    /* On a sunken well — subordinate to the asking (v4.0). */
    <section data-zone="answer" aria-labelledby={`${id}-answer`} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
      <div className="min-w-0">
        <p id={`${id}-answer`} data-zone-label className={cn(OVERLINE, "text-[var(--text-muted)]")}>
          {/* TODO-COPY */}
          {name}&rsquo;s answer
        </p>
        <p data-zone-hint className="m-0 text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY — the pack's line. */}
          Record what {name} tells you.
        </p>
      </div>
      {/* ═══ ANSWERS ARE ACTIONS, NOT A SELECTION ═══ Two buttons in a
          labelled group; `aria-pressed` shows what is recorded. */}
      <div role="group" aria-label={`${name}'s answer`} className="flex gap-1.5">
        {(["yes", "no"] as const).map((v, i) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            data-yes-no={`${id}:${v}`}
            data-ga-first={first && i === 0 ? "" : undefined}
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
