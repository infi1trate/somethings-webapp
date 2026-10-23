// ═══════════════════════════════════════════════════════════════════════════
// THE CRISIS NOTE AS ROWS (pack v6.1, Component B)
//
// ═══ WHY ═══ Crisis information arrives non-linearly — teens volunteer
// answers out of order, and supervisors learn facts before the form asks for
// them. The note supports guided sequential use AND random-access capture:
// every row is reachable in any order; saving one advances to the next
// untouched row top-down, so a linear supervisor never notices the accordion.
//
// ═══ THE ROWS, IN CANONICAL ORDER ═══ The documentation chart's five
// sections (the fifth, Emergency contact and services, for Tier 1 ONLY —
// never rendered at Tier 2, a blocked constant), then Outcome, then Debrief.
// Close & follow-up is NOT a row: it is the action, not documentation, and it
// stays the timeline's own final node, gated on every row here being done.
//
// ═══ DEPENDENCIES HONOURED, NOT ENFORCED BY ORDER ═══ Outcome's suggestion is
// `autoOutcome(note)`, recomputed live from Referral and Emergency services.
// When an upstream answer changes AFTER the outcome was saved, the outcome is
// never silently edited: `outcomeNeedsReview` marks it with a quiet dot, and
// re-saving the Outcome row clears it.
//
// Derived, never stored — like the timeline's nodes. What IS stored is the
// record's own fields plus the amendment log (`CrisisNote.amendments`).

import type { CrisisNote, EscalationState } from "@/lib/chat/types";
import { REFERRAL_TYPE } from "@/lib/record/people-demo";
import {
  CLINICAL_SUBTYPES,
  CRISIS_SECTION_LABEL,
  CRISIS_TAGS,
  EMERGENCY_SERVICES,
  OUTCOMES,
  SAFETY_PLAN_STATUS,
  autoOutcome,
  crisisSections,
  sectionDone,
  type CrisisSectionId,
} from "@/lib/tiering/escalation";
import type { Tier } from "@/lib/tiering/tiers";

export type NoteRowId = CrisisSectionId | "outcome" | "debrief";

/** Tier 1: seven rows. Tier 2: six — Emergency never renders. */
export const noteRows = (tier: Tier): NoteRowId[] => [...crisisSections(tier), "outcome", "debrief"];

/** Verbatim from the documentation chart for the five sections. TODO-COPY
 *  for Outcome and Debrief, which the chart names as steps, not sections. */
export const NOTE_ROW_LABEL: Record<NoteRowId, string> = { ...CRISIS_SECTION_LABEL, outcome: "Outcome", debrief: "Debrief" };

const isSection = (id: NoteRowId): id is CrisisSectionId => id !== "outcome" && id !== "debrief";

/** The two closes that are not a chosen outcome — they never count here. */
const NOT_CHOSEN = new Set(["tier_update", "reviewed"]);

export function rowDone(e: EscalationState, id: NoteRowId): boolean {
  if (isSection(id)) return sectionDone(e.crisisNote, id);
  if (id === "outcome") return !!e.outcome?.id && !NOT_CHOSEN.has(e.outcome.id);
  return !!e.outcome?.savedAt && !!e.outcome.debrief.trim();
}

export function noteProgress(e: EscalationState, tier: Tier): { done: number; total: number } {
  const rows = noteRows(tier);
  return { done: rows.filter((r) => rowDone(e, r)).length, total: rows.length };
}

/** Every row done — the Close gate. */
export const noteComplete = (e: EscalationState, tier: Tier) => noteRows(tier).every((r) => rowDone(e, r));

/** Auto-advance: the first untouched row, TOP-DOWN from the top — not from
 *  the row just saved, so an out-of-order save never skips an earlier gap. */
export const firstUntouched = (e: EscalationState, tier: Tier): NoteRowId | null => noteRows(tier).find((r) => !rowDone(e, r)) ?? null;

/** The note's moment on the timeline: its last row's completion. */
export function noteDoneAt(e: EscalationState, tier: Tier): number | null {
  if (!noteComplete(e, tier)) return null;
  const stamps = [
    ...crisisSections(tier).map((s) => e.crisisNote?.sectionAt?.[s] ?? e.crisisNote?.updatedAt ?? null),
    e.outcome?.chosenAt ?? e.outcome?.savedAt ?? null,
    e.outcome?.savedAt ?? null,
  ].filter((x): x is number => typeof x === "number");
  return stamps.length ? Math.max(...stamps) : null;
}

/** ═══ THE REVIEW DOT ═══ The outcome was saved against one suggestion and
 *  the note now suggests another (a Referral or Emergency-services answer
 *  changed). A record from before `basis` existed is never flagged. */
export function outcomeNeedsReview(e: EscalationState): boolean {
  const o = e.outcome;
  if (!o?.id || NOT_CHOSEN.has(o.id) || o.basis === undefined) return false;
  return autoOutcome(e.crisisNote) !== o.basis;
}

const labelIn = <T extends { id: string; label: string }>(list: readonly T[], v?: string) => list.find((x) => x.id === v)?.label ?? v ?? "";

/** A section's one-line summary — the compact row's right side, and the
 *  timeline's completed sub-line. TODO-COPY ("None shared", "No referral",
 *  "Contact not engaged · No services"). */
export function sectionSummary(note: CrisisNote, id: CrisisSectionId): string {
  switch (id) {
    case "subtype":
      return [labelIn(CLINICAL_SUBTYPES, note.subtype), ...(note.tags ?? []).map((t) => labelIn(CRISIS_TAGS, t))].filter(Boolean).join(" · ");
    case "safety-plan":
      return labelIn(SAFETY_PLAN_STATUS, note.safetyPlan?.status);
    case "resources":
      return note.resources?.shared ? note.resources.list : "None shared";
    case "referral":
      return note.referral?.made ? note.referral.list.map((r) => labelIn(REFERRAL_TYPE, r)).join(", ") : "No referral";
    case "emergency":
      return [note.contact?.engaged ? "Contact engaged" : "Contact not engaged", note.services?.contacted ? note.services.which.map((s) => labelIn(EMERGENCY_SERVICES, s)).join(", ") : "No services"].join(" · ");
  }
}

/** Any row's summary, or "" while untouched. */
export function rowSummary(e: EscalationState, id: NoteRowId): string {
  if (!rowDone(e, id)) return "";
  if (isSection(id)) return sectionSummary(e.crisisNote ?? {}, id);
  if (id === "outcome") return OUTCOMES.find((o) => o.id === e.outcome?.id)?.label ?? "";
  /* TODO-COPY */
  return e.outcome?.debriefIsDraft ? "Saved · AI draft, unedited" : "Saved";
}

/** The fields one section owns — what an amendment snapshots as "before". */
export function sectionFields(note: CrisisNote | undefined, id: CrisisSectionId): Partial<CrisisNote> {
  if (!note) return {};
  switch (id) {
    case "subtype":
      return { subtype: note.subtype, tags: note.tags };
    case "safety-plan":
      return { safetyPlan: note.safetyPlan };
    case "resources":
      return { resources: note.resources };
    case "referral":
      return { referral: note.referral };
    case "emergency":
      return { contact: note.contact, services: note.services };
  }
}
