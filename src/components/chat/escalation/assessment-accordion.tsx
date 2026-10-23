"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE ASSESSMENT ACCORDION (pack v6.1, Component A)
//
// ═══ WHY ═══ Crisis information arrives non-linearly — teens volunteer
// answers out of order, and supervisors learn facts before the form asks for
// them. Both documentation surfaces must support guided sequential use and
// random-access capture with equal grace.
//
// ═══ SUPERSEDES (Supersessions 1, 3, 4) ═══ the one-question-at-a-time card,
// its "Question n of 6" header and the collapsed answered group (v5.0); the
// fixed y-offset guarantee (replaced by BOUNDED MOVEMENT: compact rows are a
// fixed height, exactly one row is expanded, the expanded card scrolls fully
// into view); and the supervisor's "Assessment in progress · 3 of 6" count,
// now this accordion read-only and filling in live.
//
//   COMPACT ROW   the short label (what the question assesses) and the answer
//                 state at the right — "—" ghost / Yes / No. An answered row
//                 recedes one ink step. Fixed height; the label never
//                 truncates.
//   EXPANDED ROW  the two-zone card, unchanged: ASK {TEEN} (the question
//                 VERBATIM, the chart's example, Ask in chat) and {TEEN}'S
//                 ANSWER (Yes / No, "Record what {teen} tells you."). Q6
//                 nests its follow-up on a Yes.
//
// ═══ ONE ROW OPEN ═══ On load, the first unanswered. On a record, the row
// collapses with its answer in it — a breath — and the next unanswered opens,
// top-down (make it magical 1: capture is seen, then the path continues; one
// motion, never two). A linear user never notices the accordion; a non-linear
// one taps any row.
//
//   holder    the mentor (or a supervisor after take-over): answer, re-open
//             to change, review, Submit
//   observer  the supervisor while the mentor assesses: read-only, live — an
//             arriving answer lands with one soft tick (make it magical 2)
//   readonly  after Submit, both lenses

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { EscalationState } from "@/lib/chat/types";
import type { MessageOrigin } from "@/lib/chat/types";
import { ASSESSMENT_QUESTIONS, answeredCount, assessmentOf, riskLevel, type AssessmentQuestion } from "@/lib/tiering/escalation";
import { afterAnswer, assessmentComplete, firstOpenQuestion, questionComplete, questionOf } from "@/lib/tiering/assessment-rows";
import { BODY, Field, LABEL, OVERLINE, Primary, RING, RiskChip, TITLE } from "@/components/chat/escalation/controls";
import { Quote } from "@/components/chat/escalation/quote";
import { cn } from "@/lib/utils";

export type AssessmentMode = "holder" | "observer" | "readonly";

/** The page's mount: an answer stamped after it ARRIVED here, and ticks. */
const MOUNTED_AT = Date.now();
/** The record-and-advance breath: the answer is seen in the collapsing row
 *  before the next row opens. Zero under reduced motion. */
const BREATH_MS = 180;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce");

export function AssessmentAccordion({
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
  /** Holder only: Submit with the mentor's sentence. */
  onSubmit?: (summary: string) => void;
  /** Read-only: whose summary the quote shows ("You" / the mentor). */
  summaryBy?: string;
}) {
  const a = assessmentOf(e);
  const answers = a.answers;
  const interactive = mode === "holder" && a.submittedAt === null;
  const [openId, setOpenId] = useState<string | null>(interactive ? firstOpenQuestion(answers) : null);
  const [announce, setAnnounce] = useState("");
  const [summary, setSummary] = useState(e.mentorSummary ?? "");
  const [tried, setTried] = useState(false);
  const uid = useId();
  const listRef = useRef<HTMLOListElement>(null);
  /** Set by an auto-advance: the next expansion takes focus. */
  const advanced = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), []);

  /* ═══ BOUNDED MOVEMENT ═══ Whatever opens is scrolled fully into view —
     "nearest", so a card already visible does not move at all. The panel's
     64px scroll margin clears the sticky Care tab bar (measured: without it
     a card scrolled up from below landed under the bar). After an
     auto-advance, focus goes to the new card's first control. */
  /* Q6's Yes grows the open card by its follow-up — which re-runs this, so
     the grown card is brought fully into view too (measured: it overran). */
  const followShown = openId !== null && !!questionOf(openId)?.followUp && answers[openId]?.value === "yes";
  useEffect(() => {
    if (!openId) return;
    const panel = listRef.current?.querySelector<HTMLElement>(`[data-acc-panel="${openId}"]`);
    panel?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    if (advanced.current) {
      advanced.current = false;
      panel?.querySelector<HTMLElement>("button, textarea")?.focus({ preventScroll: true });
    }
  }, [openId, followShown]);

  const record = (id: string, v: "yes" | "no") => {
    if (!onAnswer) return;
    onAnswer(id, v);
    const next = afterAnswer(answers, id, v);
    const q = questionOf(id)!;
    /* A Q6 Yes is not complete until its follow-up is: the row stays open. */
    if (!questionComplete(next, q)) return;
    /* TODO-COPY */
    setAnnounce(`${q.assesses} recorded · ${answeredCount(next)} of ${ASSESSMENT_QUESTIONS.length} answered`);
    const target = firstOpenQuestion(next);
    setOpenId(null);
    advanced.current = target !== null;
    if (timer.current !== null) window.clearTimeout(timer.current);
    /* The six done: focus goes to what comes next — the summary — rather
       than falling to the page. */
    const land = () => {
      setOpenId(target);
      if (target === null) listRef.current?.closest("[data-assessment-accordion]")?.querySelector<HTMLElement>('[data-exchange-field="mentor-summary"]')?.focus();
    };
    if (reducedMotion()) land();
    else timer.current = window.setTimeout(land, BREATH_MS);
  };

  const risk = riskLevel(answers);
  const n = answeredCount(answers);
  const complete = assessmentComplete(answers);

  return (
    <div data-assessment-accordion data-acc-mode={mode} className="space-y-3">
      <p data-acc-live role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <ol ref={listRef} data-acc-rows className="divide-y divide-[color:var(--border-subtle)] overflow-hidden rounded-[var(--radius-inset)] bg-[var(--surface-s1)]">
        {ASSESSMENT_QUESTIONS.map((q) => (
          <Row
            key={q.id}
            q={q}
            uid={uid}
            name={name}
            answers={answers}
            mode={interactive ? "holder" : mode === "holder" ? "readonly" : mode}
            open={openId === q.id}
            onToggle={() => setOpenId((o) => (o === q.id ? null : q.id))}
            onAnswer={record}
            onUseWording={onUseWording}
          />
        ))}
      </ol>
      {/* ═══ THE FOOTER ═══ The progress line; the live risk chip once
          anything is answered; and, the six done, the review ledger's note and
          Submit — the rows above ARE the ledger's rows now, so they are not
          listed twice. */}
      <div data-acc-footer className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p data-assessment-progress className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY */}
            {n} of {ASSESSMENT_QUESTIONS.length} answered
          </p>
          {risk && (
            <span data-review-risk>
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
        {interactive && complete && onSubmit && (
          <div data-review-ledger className="space-y-3">
            <Field slot="mentor-summary" label={`In a sentence or two, what's going on with ${name}`} value={summary} onChange={setSummary} invalid={tried && !summary.trim()} />
            {tried && !summary.trim() && (
              <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
                {/* TODO-COPY */}
                Add a sentence for your supervisor.
              </p>
            )}
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
          </div>
        )}
        {!interactive && e.mentorSummary && a.submittedAt !== null && (
          <Quote slot="mentor-summary" text={e.mentorSummary} who={summaryBy ?? "Mentor's summary"} at={a.submittedAt} />
        )}
      </div>
    </div>
  );
}

function Row({
  q,
  uid,
  name,
  answers,
  mode,
  open,
  onToggle,
  onAnswer,
  onUseWording,
}: {
  q: AssessmentQuestion;
  uid: string;
  name: string;
  answers: ReturnType<typeof assessmentOf>["answers"];
  mode: AssessmentMode;
  open: boolean;
  onToggle: () => void;
  onAnswer: (id: string, v: "yes" | "no") => void;
  onUseWording?: (t: string, origin?: MessageOrigin) => void;
}) {
  const a = answers[q.id];
  const done = questionComplete(answers, q);
  const head = `${uid}-${q.id}-h`;
  const panel = `${uid}-${q.id}-p`;
  /* The observer's arrival tick: keyed on the answer's own stamp, so it
     plays once per answer that landed while this page was open. */
  const arrived = mode === "observer" && !!a && a.at >= MOUNTED_AT;
  /* A row with nothing to read yet has nothing to expand for an observer. */
  const expandable = mode === "holder" || !!a;
  return (
    <li data-acc-row={q.id} data-acc-state={a ? (done ? "answered" : "partial") : "untouched"} data-acc-open={open || undefined}>
      <button
        type="button"
        id={head}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? panel : undefined}
        disabled={!expandable}
        onClick={onToggle}
        className={cn("flex h-12 w-full items-center gap-2 px-3 text-left disabled:cursor-default", expandable && "hover:bg-[var(--tint-hover)]", RING)}
        style={LABEL}
      >
        {/* Answered rows recede one ink step; the label never truncates —
            it may take two lines inside the fixed 48px row. */}
        <span data-acc-label className={cn("min-w-0 flex-1 break-words", a ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]")}>
          {q.assesses}
        </span>
        <span data-acc-value key={a?.at} className={cn("shrink-0 tabular-nums", a ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]", arrived && "tier-settle")}>
          {a ? (
            a.value === "yes" ? "Yes" : "No"
          ) : (
            <>
              <span aria-hidden>—</span>
              <span className="sr-only">, not answered</span>
            </>
          )}
        </span>
        {expandable && <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 text-[var(--icon-secondary)] transition-transform motion-reduce:transition-none", open && "rotate-180")} />}
      </button>
      {open && expandable && (
        <div id={panel} role="region" aria-labelledby={head} data-acc-panel={q.id} className="scroll-mt-16 scroll-mb-3 bg-[var(--surface-raised)] px-3 pt-1 pb-3">
          {mode === "holder" ? <AskCard q={q} name={name} answers={answers} onAnswer={onAnswer} onUseWording={onUseWording} /> : <ReadCard q={q} answers={answers} />}
        </div>
      )}
    </li>
  );
}

/** ═══ THE TWO-ZONE CARD (pack v4.0, Supersession 2), unchanged ═══ */
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
        /* ═══ Q6'S FOLLOW-UP, NESTED ═══ Verbatim, its own Ask and answer. */
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
      className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3.5 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
      style={BODY}
    >
      {/* TODO-COPY */}
      Ask in chat <ArrowRight aria-hidden className="size-3.5" />
    </button>
  );
}

/** The answer zone: on a sunken well, subordinate to the asking, never
 *  disabled. Re-opened, the recorded answer is shown pressed. */
function AnswerZone({ id, name, value, onAnswer }: { id: string; name: string; value: "yes" | "no" | undefined; onAnswer: (id: string, v: "yes" | "no") => void }) {
  return (
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
          labelled group: as radios, an arrow key would answer a clinical
          question by accident. `aria-pressed` shows what is recorded. */}
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

/** Read-only: the question VERBATIM and the answer; Q6's follow-up with it. */
function ReadCard({ q, answers }: { q: AssessmentQuestion; answers: ReturnType<typeof assessmentOf>["answers"] }) {
  const follow = q.followUp && answers[q.followUp.id] ? q.followUp : null;
  const say = (v: "yes" | "no" | undefined) => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
  return (
    <div data-acc-read className="space-y-2" style={LABEL}>
      <p data-answer-verbatim className="text-[var(--text-primary)]">
        &ldquo;{q.text}&rdquo; <span className="text-[var(--text-secondary)]">— {say(answers[q.id]?.value)}</span>
      </p>
      {follow && (
        <p data-answer-verbatim={follow.id} className="border-l-2 border-[color:var(--border-subtle)] pl-3 text-[var(--text-primary)]">
          &ldquo;{follow.text}&rdquo; <span className="text-[var(--text-secondary)]">— {say(answers[follow.id]?.value)}</span>
        </p>
      )}
    </div>
  );
}
