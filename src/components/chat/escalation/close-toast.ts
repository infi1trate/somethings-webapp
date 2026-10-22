// ═══════════════════════════════════════════════════════════════════════════
// THE CLOSE ARC'S TOAST (pack v4.0, Supersession 6 / Workstream F1)
//
// ═══ THE ONLY TOAST ON THIS SURFACE ═══ Nothing else in the chat or Care
// toasts; a close is the one moment whose news outlives the panel it happened
// in. "Escalation closed · Jordan moves to Tier 3 Medium risk".
//
// ═══ ONCE ═══ The supervisor gets it when they close. The mentor gets the
// SAME toast the first time they see the closed summary, and never again for
// that escalation — this session remembers (sessionStorage, guarded; a
// blocked store falls back to memory). It is a notice, never a record.
//
// TODO-COPY. The tier is named from the canon (TIER_NAME): the pack's
// wording, which differs from `CLOSE_OUT_TIER_COPY` ("Tier 3 Monitoring") —
// flagged in the report, not resolved here.

import { toast } from "sonner";
import { TIER_NAME, type Tier } from "@/lib/tiering/tiers";

const KEY = (id: string) => `somethings.close-toast.${id}`;
const shown = new Set<string>();

export function closeToastText(name: string, tier: Tier | null): string {
  return tier === null ? "Platform concern reviewed" : `Escalation closed · ${name} moves to Tier ${tier} ${TIER_NAME[tier]}`;
}

function seen(id: string): boolean {
  if (shown.has(id)) return true;
  try {
    return sessionStorage.getItem(KEY(id)) === "1";
  } catch {
    return false;
  }
}

function mark(id: string) {
  shown.add(id);
  try {
    sessionStorage.setItem(KEY(id), "1");
  } catch {
    /* Storage blocked: memory holds it for this page. */
  }
}

/** Fire the close toast for escalation `id`, at most once. */
export function announceClose(id: string, name: string, tier: Tier | null) {
  if (seen(id)) return;
  mark(id);
  toast(closeToastText(name, tier), { id: `close-${id}` });
}
