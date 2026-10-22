// ═══════════════════════════════════════════════════════════════════════════
// THE ESCALATION EXCHANGE — one record, four stages, two lenses (pack v2.0)
//
// `EscalationState` (lib/chat/types.ts) is the one escalation record. The
// chat writes it, the user record reads it, Monitoring's Tier 1 lane reads
// it. Everything here reads it the same way, so the mentor's panel and the
// supervisor's panel cannot disagree about where the escalation is.
//
// ═══ SUPERSEDES pack v1 Phases 2–3, IN PLACE ═══
//   · The 5-step checklist and the 6 placeholder safety-check cards were two
//     question sets; they are one sequential assessment now (below), and both
//     old components are deleted.
//   · The mentor's Resolve — which doubled as the crisis note — is retired
//     (answered 2026-10-21): the crisis note is the supervisor's (S2), and the
//     supervisor closes a Tier 1–2 escalation (S4).
//   · The flat stacked panel is a staged baton panel: `stageFor` below.

import type { CrisisNote, EscalationOutcome, EscalationState, SafetyCheck } from "@/lib/chat/types";
import { CRISIS_TYPE } from "@/lib/record/people-demo";
import type { TierState } from "@/lib/tiering/events";
import { isAlertTier, type RaiseTarget, type Tier } from "@/lib/tiering/tiers";

/** A record with no `requested` predates tiering. Every escalation raised
 *  before it was a crisis escalation, so Tier 1 is the honest default. */
export const escalationTarget = (e: EscalationState): RaiseTarget => e.requested ?? 1;

/** The tier this escalation is working at: the supervisor's confirmation
 *  if there is one, the mentor's request otherwise. */
export function workingTier(e: EscalationState, state: TierState): Tier | "platform" {
  if (e.confirmedTier !== undefined) return e.confirmedTier;
  if (state.pending?.escalationId === e.id) return state.pending.tier;
  return escalationTarget(e);
}

/** The assessment applies to Tier 1–2 escalations only. */
export const needsAssessment = (t: Tier | "platform") => t === 1 || t === 2;

export const EMPTY_SAFETY: SafetyCheck = { answers: {}, submittedAt: null };
export const assessmentOf = (e: EscalationState): SafetyCheck => e.safetyCheck ?? EMPTY_SAFETY;

/** The open escalation, or nothing — a resolved record is history. */
export const isOpen = (e: EscalationState | undefined | null): e is EscalationState => !!e && e.resolvedAt === null;

// ── THE ASSESSMENT ──────────────────────────────────────────────────────────

/** ═══ THE SANCTIONED WORDING — VERBATIM, A BLOCKED CONSTANT ═══
 *
 *  The clinical team's plain-language phrasing chart, word for word,
 *  including Q3's parenthetical example and Q6's examples and its 3-month
 *  follow-up. It replaces the "verbatim Columbia text pending" placeholders.
 *  Changing a word here needs the clinical team's sign-off. */
export interface AssessmentQuestion {
  id: string;
  /** What it assesses — the supervisor's label, never shown to the teen. */
  assesses: string;
  text: string;
  example?: string;
  /** Asked only when this question's answer is Yes. */
  followUp?: { id: string; text: string };
}

export const ASSESSMENT_QUESTIONS: readonly AssessmentQuestion[] = [
  { id: "q1", assesses: "Wish to be dead (passive)", text: "Have you wished you were dead or wished you could go to sleep and not wake up?" },
  { id: "q2", assesses: "Non-specific active thoughts", text: "Have you actually had any thoughts of killing yourself?" },
  {
    id: "q3",
    assesses: "Method, no intent",
    text: "Have you thought about how you might do that?",
    example: "e.g., “I thought about pills, but I’d never actually do it.”",
  },
  { id: "q4", assesses: "Intent, no specific plan", text: "Have you had these thoughts and had some intention of acting on them?" },
  { id: "q5", assesses: "Plan and intent", text: "Have you started to work out the details of how to kill yourself? Do you intend to carry out this plan?" },
  {
    id: "q6",
    assesses: "Preparatory acts or past attempts",
    text: "Have you ever done anything, started to do anything, or prepared to do anything to end your life?",
    example: "Examples: gathering pills, giving away possessions, saying final goodbyes, self-harm with intent to die.",
    followUp: { id: "q6b", text: "Was this within the past 3 months?" },
  },
];

/** The questions in order, with Q6's follow-up spliced in when it applies. */
export function askedSteps(answers: SafetyCheck["answers"]): { id: string; text: string; example?: string; assesses: string; followUpOf?: string }[] {
  const out: { id: string; text: string; example?: string; assesses: string; followUpOf?: string }[] = [];
  for (const q of ASSESSMENT_QUESTIONS) {
    out.push(q);
    if (q.followUp && answers[q.id]?.value === "yes") out.push({ id: q.followUp.id, text: q.followUp.text, assesses: q.assesses, followUpOf: q.id });
  }
  return out;
}

/** The one question that is active: the first unanswered, or null when all
 *  are answered (the documentation field follows). */
export function activeStep(answers: SafetyCheck["answers"]) {
  return askedSteps(answers).find((s) => !answers[s.id]) ?? null;
}

/** "3 of 6 answered" counts the six, not the follow-up. */
export const answeredCount = (answers: SafetyCheck["answers"]) => ASSESSMENT_QUESTIONS.filter((q) => answers[q.id]).length;

/** ═══ THE RISK LEVEL — ADVISORY, NEVER A TIER (blocked constant) ═══
 *  Computed live from the answers: Low = yes limited to Q1–Q2; Moderate = yes
 *  on Q3; High = yes on any of Q4–Q6. It informs the supervisor's
 *  confirmation and never places a tier. Null until something is answered. */
export type RiskLevel = "low" | "moderate" | "high";
export function riskLevel(answers: SafetyCheck["answers"]): RiskLevel | null {
  if (Object.keys(answers).length === 0) return null;
  const yes = (id: string) => answers[id]?.value === "yes";
  if (yes("q4") || yes("q5") || yes("q6")) return "high";
  if (yes("q3")) return "moderate";
  return "low";
}
export const RISK_LABEL: Record<RiskLevel, string> = { low: "Low risk", moderate: "Moderate risk", high: "High risk" };

// ── THE STAGES ──────────────────────────────────────────────────────────────

/** ═══ ONE LIFECYCLE, TWO LENSES ═══
 *  Mentor: M1 raise · M2 assess · M3 stay with them · M4 wrap.
 *  Supervisor: S1 confirm tier · S2 guide & document · S3 outcome & debrief ·
 *  S4 close & follow-up. Both are views of the same record's fields, read
 *  here; there is no stage field to fall out of step with them. */
export type MentorStage = "M2" | "M3" | "M4";
/** S0 (pack v3.0): the mentor's assessment is still in progress — the
 *  supervisor's current node is its progress, and Confirm tier waits for it
 *  (the pack's sequence: assessment received → confirm). */
export type SupervisorStage = "S0" | "S1" | "S2" | "S3" | "S4" | "closed";

export function mentorStage(e: EscalationState, state: TierState): MentorStage {
  if (e.resolvedAt !== null) return "M4";
  const t = workingTier(e, state);
  if (needsAssessment(t) && assessmentOf(e).submittedAt === null) return "M2";
  return "M3";
}

export function supervisorStage(e: EscalationState): SupervisorStage {
  if (e.resolvedAt !== null) return "closed";
  const target = escalationTarget(e);
  if (e.confirmedTier === undefined && target !== "platform" && needsAssessment(target) && assessmentOf(e).submittedAt === null) return "S0";
  if (e.confirmedTier === undefined) return "S1";
  if (!isAlertTier(e.confirmedTier)) return "S1"; // never stays here: Tier 3–4 confirmation closes
  if (!crisisNoteComplete(e.crisisNote, e.confirmedTier)) return "S2";
  if (!e.outcome?.savedAt) return "S3";
  return "S4";
}

/** Whose move it is, from either lens. */
export function batonHolder(e: EscalationState, state: TierState): "mentor" | "supervisor" | "none" {
  if (e.resolvedAt !== null) return "none";
  return mentorStage(e, state) === "M2" ? "mentor" : "supervisor";
}

// ── THE CRISIS NOTE (S2) ────────────────────────────────────────────────────

export type CrisisSectionId = "subtype" | "safety-plan" | "resources" | "referral" | "emergency";

/** In order. Section 5 renders for Tier 1 only — Tier 2 skips it entirely. */
export function crisisSections(tier: Tier): CrisisSectionId[] {
  return tier === 1 ? ["subtype", "safety-plan", "resources", "referral", "emergency"] : ["subtype", "safety-plan", "resources", "referral"];
}

export const CRISIS_SECTION_LABEL: Record<CrisisSectionId, string> = {
  subtype: "Clinical subtype",
  "safety-plan": "Safety plan",
  resources: "Resources shared",
  referral: "Referral",
  emergency: "Emergency contact and services",
};

/** ═══ THE CLINICAL SUBTYPE LIST ═══ The chart's own list was not in the
 *  pack; answered 2026-10-21 ("use your judgement"): the record's existing
 *  crisis-type vocabulary, so a crisis note and the record's flag history
 *  name a crisis the same way. A blocked constant once the chart's list is
 *  supplied. */
export const CLINICAL_SUBTYPES = CRISIS_TYPE;

/** Verbatim from the chart. */
export const CRISIS_TAGS = [
  { id: "housing", label: "Housing" },
  { id: "food", label: "Food" },
  { id: "healthcare", label: "Healthcare access" },
  { id: "transportation", label: "Transportation" },
  { id: "financial", label: "Financial" },
] as const;

export const SAFETY_PLAN_STATUS = [
  { id: "created", label: "Created" },
  { id: "updated", label: "Updated" },
  { id: "maintained", label: "Maintained" },
] as const;

/** Verbatim from the chart. The referral list is `REFERRAL_TYPE`
 *  (people-demo), which this list replaced (answered 2026-10-21). */
export const EMERGENCY_SERVICES = [
  { id: "welfare_check", label: "911 welfare check" },
  { id: "ems", label: "EMS" },
  { id: "cps", label: "CPS / DCFS" },
  { id: "mobile_crisis", label: "Mobile crisis" },
] as const;

/** A section counts as done once its question is answered — "no" is an
 *  answer, and a "yes" needs its list. */
export function sectionDone(note: CrisisNote | undefined, id: CrisisSectionId): boolean {
  if (!note) return false;
  switch (id) {
    case "subtype":
      return !!note.subtype;
    case "safety-plan":
      return !!note.safetyPlan?.status;
    case "resources":
      return note.resources?.shared === false || (note.resources?.shared === true && !!note.resources.list.trim());
    case "referral":
      return note.referral?.made === false || (note.referral?.made === true && note.referral.list.length > 0);
    case "emergency":
      return (
        (note.contact?.engaged === false || (note.contact?.engaged === true && !!note.contact.details.trim())) &&
        (note.services?.contacted === false || (note.services?.contacted === true && note.services.which.length > 0))
      );
  }
}

export const crisisNoteComplete = (note: CrisisNote | undefined, tier: Tier) => crisisSections(tier).every((s) => sectionDone(note, s));

/** The one section open: the first not yet done. */
export const activeSection = (note: CrisisNote | undefined, tier: Tier) => crisisSections(tier).find((s) => !sectionDone(note, s)) ?? null;

// ── THE OUTCOME (S3) ────────────────────────────────────────────────────────

/** TODO-COPY, all six — clinical review owed with the rest. */
export const OUTCOMES = [
  { id: "stabilized", label: "Resolved / stabilized — safe, with a plan" },
  { id: "guardian", label: "A guardian or trusted adult is with them" },
  { id: "911", label: "Emergency services (911) responded" },
  { id: "mobile_crisis", label: "Mobile crisis responded" },
  { id: "referred", label: "Referred on for care" },
  { id: "no_response", label: "Could not reach them" },
] as const;
export type OutcomeId = (typeof OUTCOMES)[number]["id"];

/** ═══ AUTO-TAGGED FROM WHAT THE NOTE ALREADY SAYS ═══ 911 or EMS in the
 *  services section pre-selects 911; mobile crisis in services or the
 *  referral pre-selects mobile crisis; any other referral pre-selects
 *  "referred". Editable — a pre-fill, never a determination. */
export function autoOutcome(note: CrisisNote | undefined): OutcomeId | null {
  const services = note?.services?.which ?? [];
  const referrals = note?.referral?.list ?? [];
  if (services.includes("welfare_check") || services.includes("ems")) return "911";
  if (services.includes("mobile_crisis") || referrals.includes("mobile_crisis")) return "mobile_crisis";
  if (note?.contact?.engaged) return "guardian";
  if (referrals.length > 0) return "referred";
  return null;
}

/** ═══ THE DEBRIEF DRAFT — FAKE AI (answered 2026-10-21) ═══
 *
 *  Stated plainly: there is no model. This assembles a draft from the
 *  record's own fields — the mentor's note and summary, the teen's and the
 *  mentor's own lines from the chat, the assessment, the crisis note — so
 *  the shape of an AI-drafted debrief can be reviewed. It drafts the
 *  NARRATIVE only; every clinical determination (tier, subtype, risk,
 *  outcome) stays the supervisor's and is never written here. Labelled as a
 *  draft on screen and fully editable before save. */
export function draftDebrief(input: {
  name: string;
  escalation: EscalationState;
  teenLines: string[];
  mentorLines: string[];
}): string {
  const { name, escalation: e, teenLines, mentorLines } = input;
  const a = assessmentOf(e);
  const risk = riskLevel(a.answers);
  const yes = ASSESSMENT_QUESTIONS.filter((q) => a.answers[q.id]?.value === "yes").map((q) => q.assesses.toLowerCase());
  const n = e.crisisNote;
  const parts = [
    `${name}'s mentor raised this${e.contextNote ? ` after ${name} shared: "${e.contextNote.replace(/\.$/, "")}."` : "."}`,
    teenLines.length ? `In the conversation, ${name} said things like "${teenLines.slice(-2).join('" and "')}".` : null,
    mentorLines.length ? `The mentor stayed with them and responded: "${mentorLines.slice(-1)[0]}".` : null,
    a.submittedAt !== null
      ? `The assessment was completed${risk ? ` and suggested ${RISK_LABEL[risk].toLowerCase()}` : ""}${yes.length ? `, with yes answers on ${yes.join(", ")}` : ""}.`
      : null,
    e.mentorSummary ? `The mentor summarised: ${e.mentorSummary}` : null,
    n?.safetyPlan?.status ? `A safety plan was ${n.safetyPlan.status}.` : null,
    n?.referral?.made ? `A referral was made.` : null,
  ];
  return parts.filter(Boolean).join(" ");
}

// ── THE CLOSE (S4) ──────────────────────────────────────────────────────────

/** ═══ WHERE A CLOSED ESCALATION STEPS DOWN TO — A BLOCKED CONSTANT ═══
 *
 *  CONFLICT, FLAGGED: the documentation flow's close-out says the teen
 *  "moves to Tier 3 Monitoring"; the tier canon says Tier 1 default-exits to
 *  Tier 2 for at least 7 days. Answered 2026-10-21: "Ship with tier 3
 *  monitoring for now. We can address the naming later." So closing moves
 *  the teen to Tier 3, from Tier 1 or 2, and the close-out copy says "Tier 3
 *  Monitoring" — although the canon's Tier 3 name elsewhere is "Medium risk".
 *  Both halves need Meg / clinical before shipping: the destination and the
 *  name. One constant each, so either is a one-line change. */
export const CLOSE_OUT_TIER: Tier = 3;
export const CLOSE_OUT_TIER_COPY = "Tier 3 Monitoring";

export const FOLLOW_UP_STATUS = [
  { id: "affirmed_stable", label: "Affirmed stable" },
  { id: "continuing", label: "Continuing monitoring" },
  { id: "re_escalated", label: "Re-escalated" },
  { id: "no_response", label: "Attempted, no response" },
] as const;

export const FOLLOW_UP_IN = [
  { days: 1, label: "Tomorrow" },
  { days: 3, label: "In 3 days" },
  { days: 7, label: "In a week" },
] as const;

export type { CrisisNote, EscalationOutcome };
