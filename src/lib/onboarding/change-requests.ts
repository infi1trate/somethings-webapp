// Derived state for the mentor revision loop. The source of truth is each
// ChangeRequest's `baselineValue` (snapshot at "needs changes" entry) plus the
// live draft — so an edit is auto-detected, never just stored as a boolean.
// Shared by the dock, the per-step note card, and the welcome-back modal so they
// all read the same item the same way.

import type { AddressedState, ChangeRequest, MentorDraft } from "@/lib/types";

// Stable comparison for JSON-serialisable field values (strings, arrays,
// objects). null/undefined collapse together.
const norm = (v: unknown): string => JSON.stringify(v ?? null);

/** Deep snapshot of a field value, captured as the comparison anchor. */
export function snapshotValue(v: unknown): unknown {
  return v === undefined ? null : JSON.parse(JSON.stringify(v));
}

function fieldValue(draft: MentorDraft, fieldKey: string): unknown {
  return (draft as unknown as Record<string, unknown>)[fieldKey];
}

/** True once the governed field differs from its baseline (auto-detected). */
export function isEdited(req: ChangeRequest, draft: MentorDraft): boolean {
  return norm(fieldValue(draft, req.fieldKey)) !== norm(req.baselineValue);
}

/** Derived precedence: edited > confirmed-unchanged > none. Reverting an edit
 *  back to baseline recomputes to none (or confirmed, if that flag was set). */
export function addressedStateOf(
  req: ChangeRequest,
  draft: MentorDraft
): AddressedState {
  if (isEdited(req, draft)) return "edited";
  if (req.confirmedUnchanged) return "confirmed-unchanged";
  return "none";
}

export function isAddressed(req: ChangeRequest, draft: MentorDraft): boolean {
  return addressedStateOf(req, draft) !== "none";
}

export function changeProgress(reqs: ChangeRequest[], draft: MentorDraft) {
  const addressed = reqs.filter((r) => isAddressed(r, draft)).length;
  const total = reqs.length;
  return { addressed, total, allDone: total > 0 && addressed === total };
}

export function firstUnaddressed(
  reqs: ChangeRequest[],
  draft: MentorDraft
): ChangeRequest | null {
  return reqs.find((r) => !isAddressed(r, draft)) ?? null;
}

export function requestsForStep(
  reqs: ChangeRequest[],
  stepId: string
): ChangeRequest[] {
  return reqs.filter((r) => r.stepId === stepId);
}
