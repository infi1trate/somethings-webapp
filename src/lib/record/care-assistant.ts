// CARE ASSISTANT — the mocked responder, behind ONE module so a real backend
// swaps in without touching a component.
//
// TODO-DATA: every answer below is a fixture. `askCareAssistant` is the entire
// seam — it takes a question plus the teen's own derived care facts and returns a
// typed reply. A real implementation replaces this function and nothing else.
//
// ────────────────────────────────────────────────────────────────────────────
// THE CLASSIFIER IN HERE IS NOT A SAFETY MECHANISM. Read this before trusting it.
//
// Routing below is keyword matching. That is adequate for a prototype whose job
// is to prove the REFUSAL PATHS EXIST and are designed — the brief's requirement
// that guardrails be "an explicit refusal path with copy, not prompt hope" — and
// it is nowhere near adequate as an actual guard. Keyword matching FAILS OPEN: it
// misses paraphrase, it misses spelling, it misses any question that means the
// same thing in different words, and anyone can walk around it in one attempt.
//
// When the real backend lands, every guardrail here must be enforced SERVER-SIDE
// on both the request and the response, and the scoping in particular must be a
// hard DATA boundary — the model should never be handed another teen's record,
// rather than being asked not to mention it. What this module should keep is the
// SHAPE: the reply kinds, the refusal copy, and the rule that a refusal is a
// first-class reply rather than an error.
// ────────────────────────────────────────────────────────────────────────────

import type { CareCadence, CarePresentation } from "@/lib/record/care-demo";

/** What kind of reply came back. The UI renders each differently, and a refusal
 *  is a legitimate reply rather than a failure. */
export type ReplyKind =
  /** A scoped, non-diagnostic answer about this teen. */
  | "answer"
  /** Asked for a clinical determination — redirected to the record and the
   *  review flow. The assistant does not opine on a diagnosis. */
  | "refuse_clinical"
  /** Asked to compare teens, or for cohort statistics. Out of scope by
   *  construction, not by preference. */
  | "refuse_scope"
  /** Apparent risk surfaced. Routed to the escalation workflow rather than
   *  answered with management advice. */
  | "route_risk"
  /** Nothing on file to answer from. */
  | "no_data";

export interface AssistantReply {
  kind: ReplyKind;
  text: string;
  /** Renders a link to the conversation surface. The assistant PARAPHRASES and
   *  points; it never quotes. */
  linkConversation?: boolean;
  /** Renders a pointer to the escalation path. */
  linkEscalation?: boolean;
}

export interface AssistantTurn {
  id: string;
  question: string;
  reply: AssistantReply | null;
  /** True while the mocked responder is "thinking". */
  pending: boolean;
  /** Set when the responder itself failed — distinct from a refusal. */
  error?: boolean;
}

/** TODO-COPY. The scope line, stated before anything is asked. */
export const ASSISTANT_SCOPE =
  "Answers cover this mentee only — their surveys, their care history and their mentorship activity.";

/** TODO-COPY. Persistent provenance. Must stay visible without scrolling. */
export const ASSISTANT_PROVENANCE =
  "AI-generated, for context only — not a clinical determination.";

/** TODO-COPY. Care-oriented, non-diagnostic, and deliberately NOT one of them a
 *  question about the presentation — a suggested prompt that gets refused would
 *  be a trap the product laid itself. */
export const SUGGESTED_QUESTIONS = [
  "How has contact changed this month?",
  "Summarise what's happened since the last review",
  "What has their survey trend been?",
  "What should I read before my next check-in?",
] as const;

// ── Routing ─────────────────────────────────────────────────────────────────
// Ordered most-restrictive first: a question that trips risk AND asks for a
// diagnosis routes to RISK, because the safer refusal wins a tie.

const RISK = [
  "suicid", "self-harm", "self harm", "kill", "hurt themsel", "hurt himself",
  "hurt herself", "overdose", "abuse", "unsafe", "danger", "crisis",
  "emergency", "threat", "weapon", "run away", "runaway",
];
const CLINICAL = [
  "diagnos", "presentation", "billing", "code", "f33", "f41", "f32", "f43",
  "dsm", "should we change", "depressed", "anxiety disorder", "prescribe",
  "medication", "treatment plan", "severity",
];
const CROSS_TEEN = [
  "other teen", "other mentee", "compared to", "compare to", "average",
  "cohort", "everyone else", "other kids", "across teens", "all mentees",
  "benchmark", "percentile", "rank",
];
const CONTENT = [
  "exact words", "verbatim", "what did they say", "what did she say",
  "what did he say", "quote", "transcript", "read me the", "show me the message",
];

const hit = (q: string, list: string[]) => list.some((k) => q.includes(k));

export interface AssistantFacts {
  teenName: string;
  presentation: CarePresentation | null;
  cadence: CareCadence;
  /** Oldest → newest, on the locked instrument. */
  scores: number[];
  instrument: string | null;
  /** Days since each side last sent — the only contact data that exists. */
  mentorLastSentDaysAgo?: number;
  menteeLastSentDaysAgo?: number;
  daysInMentorship: number;
  openFlagCount: number;
}

/** The one question that makes the mocked responder fail, so the ERROR state is
 *  demonstrable rather than designed-and-never-seen. TODO-DATA. */
export const ASSISTANT_ERROR_TRIGGER = "force error";

/** Mocked latency, so the loading state is real rather than theoretical. */
export const ASSISTANT_DELAY_MS = 550;

/** THE SEAM. Swap this for a real call; keep the reply shape. */
export function askCareAssistant(
  question: string,
  f: AssistantFacts
): AssistantReply {
  const q = question.trim().toLowerCase();
  const who = f.teenName;
  const n = f.scores.length;

  // 1 · RISK ROUTES TO THE WORKFLOW. The assistant does not advise on managing
  // risk — it points at the path that puts a human on it. TODO-COPY.
  if (hit(q, RISK)) {
    return {
      kind: "route_risk",
      text: `That needs a person, not a summary. If you have seen something that puts ${who} at risk, raise an escalation from this record — a supervisor is notified and it stays tracked until it is closed. I can't advise on managing risk.`,
      linkEscalation: true,
    };
  }

  // 2 · NO CLINICAL DETERMINATIONS. Redirect to the record and the review flow.
  if (hit(q, CLINICAL)) {
    return {
      kind: "refuse_clinical",
      text: `I don't make clinical determinations. ${who}'s presentation on record, who assigned it and when it was last reviewed are in the care summary above, and changing it goes through the review flow so it carries a supervisor's note.`,
    };
  }

  // 3 · SCOPED TO THIS MENTEE. Not a preference — the assistant is handed one
  // record and has nothing else to compare against.
  if (hit(q, CROSS_TEEN)) {
    return {
      kind: "refuse_scope",
      text: `I only see ${who}'s record, so I can't compare them with anyone else or give you cohort figures.`,
    };
  }

  // 4 · NEVER VERBATIM CONTENT. Paraphrase and point.
  if (hit(q, CONTENT)) {
    return {
      kind: "answer",
      text: `I don't repeat what anyone wrote. I can describe the shape of the contact, and the conversation itself is one click away if you need the words.`,
      linkConversation: true,
    };
  }

  // ── Scoped answers, from the record's own derived facts ──────────────────

  if (q.includes("contact") || q.includes("message") || q.includes("talk")) {
    const m = f.mentorLastSentDaysAgo;
    const t = f.menteeLastSentDaysAgo;
    if (m === undefined && t === undefined) {
      return {
        kind: "no_data",
        text: `I don't have contact history for ${who} yet.`,
      };
    }
    const last = Math.min(m ?? Number.POSITIVE_INFINITY, t ?? Number.POSITIVE_INFINITY);
    const sender =
      (t ?? Number.POSITIVE_INFINITY) <= (m ?? Number.POSITIVE_INFINITY)
        ? who
        : "their mentor";
    const when = last === 0 ? "today" : last === 1 ? "yesterday" : `${last} days ago`;
    return {
      kind: "answer",
      // EVENTS, NOT CONTENT — who sent last and how long ago, never what.
      text: `The most recent message was ${when}, from ${sender}. Across ${f.daysInMentorship} days in mentorship the exchange has kept going. I'd read the conversation itself rather than take my word on the tone.`,
      linkConversation: true,
    };
  }

  if (q.includes("trend") || q.includes("survey") || q.includes("score")) {
    if (n < 2) {
      return {
        kind: "no_data",
        text: `${who} has ${n === 0 ? "no completed surveys" : "one completed survey"} on file, which isn't enough for a trend.`,
      };
    }
    const first = f.scores[0];
    const last = f.scores[n - 1];
    const dir = last === first ? "held level" : last > first ? "risen" : "come down";
    return {
      kind: "answer",
      text: `Across ${n} ${f.instrument ?? "survey"} results the score has ${dir}, from ${first} to ${last}. The breakdown for each is in the history table.`,
    };
  }

  if (q.includes("review") || q.includes("since") || q.includes("happened")) {
    if (!f.presentation?.reviewedAt) {
      return {
        kind: "no_data",
        text: `Nothing on ${who}'s record has been reviewed yet, so there's no "since" to summarise.`,
      };
    }
    const open =
      f.openFlagCount > 0
        ? `, and ${f.openFlagCount} open ${f.openFlagCount === 1 ? "item" : "items"} in the task region above`
        : ", and nothing outstanding in the task region";
    return {
      kind: "answer",
      text: `Since the last review there ${n === 1 ? "has been 1 survey" : `have been ${n} surveys`} on file${open}. The entries themselves are in the history table.`,
    };
  }

  if (q.includes("read") || q.includes("check-in") || q.includes("check in")) {
    return {
      kind: "answer",
      text: `Before your next check-in I'd read the current care update and the most recent survey — both are in the main column. If anything there surprises you, the conversation is the place to look next.`,
      linkConversation: true,
    };
  }

  if (q.includes("mind") || q.includes("feeling") || q.includes("going on")) {
    return {
      kind: "answer",
      text: `I can't tell you what's on ${who}'s mind — that's in the conversation, and it isn't mine to paraphrase into a summary. What the record shows is continued contact and ${n > 0 ? `${n} completed ${n === 1 ? "survey" : "surveys"}` : "no completed surveys yet"}.`,
      linkConversation: true,
    };
  }

  // Fallback: honest about not following, rather than confidently vague.
  return {
    kind: "answer",
    text: `I'm not sure I follow. I can talk about ${who}'s survey history, their care timeline and how contact has gone — one of the suggested questions is a good start.`,
  };
}
