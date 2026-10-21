// ═══════════════════════════════════════════════════════════════════════════
// THE ESCALATION, READ THROUGH THE TIER MODEL (pack v1.0)
//
// `EscalationState` (lib/chat/types.ts) is the one escalation record — the
// chat writes it, the user record reads it, Monitoring's Tier 1 lane reads
// it. The tiering fields are optional on the type so an older record still
// reads; everything here supplies the default once, so no consumer guesses.

import type { EscalationState, SafetyCheck } from "@/lib/chat/types";
import { EXITS_TO, T1_NO_THREAT_EXIT, isAlertTier, type RaiseTarget, type Tier } from "@/lib/tiering/tiers";

/** A record with no `requested` predates tiering. Every escalation raised
 *  before it was a crisis escalation, so Tier 1 is the honest default. */
export const escalationTarget = (e: EscalationState): RaiseTarget => e.requested ?? 1;

/** The safety check applies to Tier 1–2 escalations only. */
export const needsSafetyCheck = (e: EscalationState) => isAlertTier(escalationTarget(e));

export const EMPTY_SAFETY: SafetyCheck = { answers: {}, submittedAt: null };
export const safetyOf = (e: EscalationState): SafetyCheck => e.safetyCheck ?? EMPTY_SAFETY;

/** ═══ C-SSRS — A PLACEHOLDER, AND IT SAYS SO ON SCREEN ═══
 *
 *  BLOCKED CONSTANT. The screener's question text must be the Columbia
 *  protocol's, verbatim — no paraphrase, not even a "friendlier" one. It is
 *  not in the repo, so until it is supplied each question renders as an
 *  explicit placeholder (answered 2026-10-20: "Use a placeholder for now").
 *  Six questions, ids stable, so swapping the text in is this array alone. */
export const SAFETY_QUESTIONS: readonly { id: string; text: string }[] = Array.from({ length: 6 }, (_, i) => ({
  id: `cssrs-${i + 1}`,
  text: `C-SSRS question ${i + 1} — verbatim Columbia protocol text pending`,
}));

export const SAFETY_PLACEHOLDER = true;

/** ═══ HOW A TIER 1 CRISIS NOTE STEPS DOWN ═══ The resolution IS the crisis
 *  note. Submitting it requests a step down — Tier 2 by default, Tier 3 when
 *  the outcome is "no longer a threat" — and a supervisor's confirmation is
 *  what completes it. Tier 2 and 3 escalations close without a tier request:
 *  their exit is the tier's own document, later. */
export const NO_THREAT_OUTCOME = "no-threat";

export function stepDownFor(e: EscalationState, outcomeId: string): Tier | null {
  if (escalationTarget(e) !== 1) return null;
  return outcomeId === NO_THREAT_OUTCOME ? T1_NO_THREAT_EXIT : EXITS_TO[1];
}

/** The open escalation, or nothing — a resolved record is history. */
export const isOpen = (e: EscalationState | undefined | null): e is EscalationState => !!e && e.resolvedAt === null;
