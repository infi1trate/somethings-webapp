"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CRISIS-NOTE DRAFT (pack v11.0 §6.6)
//
// ═══ WHY A DRAFT AT ALL ═══ Submission is ATOMIC: one "Submit crisis note"
// at the end. The assessment transmits per answer because a second person
// watches the answers arrive; the crisis note has no live reader — it is one
// author composing a clinical record, and a half-posted note is worse than
// none, because the next reader cannot tell incomplete from complete. The
// cost is interruption: a supervisor writing this during a live crisis WILL
// be pulled away. So what is recorded lives here until Submit, and survives
// navigation, a Care tab switch and a reload.
//
// ═══ WHY SESSIONSTORAGE ═══ The precedent and its reasoning are
// `lib/record/review-draft.ts`: in-progress clinical prose about a minor does
// not belong in localStorage, which outlives the session that justified
// writing it. sessionStorage dies with the tab. NOT ENCRYPTION, and it does
// not pretend to be.
//
// ═══ KEYED BY ESCALATION ═══ A draft belongs to the escalation it documents.

import { useSyncExternalStore } from "react";
import type { CrisisNote } from "@/lib/chat/types";
import type { NoteRowId } from "@/lib/tiering/note-rows";

const PREFIX = "somethings.crisis-draft.";

export interface CrisisDraft {
  /** The chart's sections, as recorded so far. */
  note: CrisisNote;
  outcome: { id: string; autoTagged: boolean; basis: string | null; chosenAt: number } | null;
  debrief: { debrief: string; debriefIsDraft: boolean; plan: string; additional: string } | null;
  /** When each row was RECORDED — the deck's "done", and `sectionAt` on
   *  submit. A row is recorded by "Record section", never by a selection. */
  recorded: Partial<Record<NoteRowId, number>>;
  /** The draft's last write — "Draft saved {time}". */
  savedAt: number;
}

const keyFor = (escalationId: string) => `${PREFIX}${escalationId}`;

function safe<T>(run: () => T, fallback: T): T {
  try {
    if (typeof sessionStorage === "undefined") return fallback;
    return run();
  } catch {
    return fallback;
  }
}

/* ═══ A SUBSCRIPTION ═══ The deck reads the draft during render, so it must
   come through `useSyncExternalStore` (sessionStorage is impure, and absent
   on the server). Snapshots are cached by their raw string, so an unchanged
   draft is the same object — the identity the hook compares. */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: CrisisDraft | null }>();

function read(escalationId: string): CrisisDraft | null {
  const raw = safe(() => sessionStorage.getItem(keyFor(escalationId)), null);
  const hit = cache.get(escalationId);
  if (hit && hit.raw === raw) return hit.value;
  let value: CrisisDraft | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CrisisDraft;
      /* A shape from an older build is discarded rather than trusted. */
      value = parsed && typeof parsed === "object" && parsed.note && parsed.recorded ? parsed : null;
    } catch {
      value = null;
    }
  }
  cache.set(escalationId, { raw, value });
  return value;
}

export function readCrisisDraft(escalationId: string): CrisisDraft | null {
  return read(escalationId);
}

export function writeCrisisDraft(escalationId: string, draft: CrisisDraft): void {
  safe(() => sessionStorage.setItem(keyFor(escalationId), JSON.stringify(draft)), undefined);
  for (const fn of listeners) fn();
}

/** Record one row: the patch merged, the row stamped the FIRST time it is
 *  recorded (an edit keeps its moment), the draft's save time now. The
 *  clock is read here, at the event, never during a render. */
export function recordCrisisRow(escalationId: string, draft: CrisisDraft, id: NoteRowId, patch: Partial<Pick<CrisisDraft, "note" | "outcome" | "debrief">>): CrisisDraft {
  const at = Date.now();
  const next: CrisisDraft = {
    ...draft,
    ...patch,
    outcome: patch.outcome ? { ...patch.outcome, chosenAt: draft.recorded.outcome ?? at } : draft.outcome,
    recorded: { ...draft.recorded, [id]: draft.recorded[id] ?? at },
    savedAt: at,
  };
  writeCrisisDraft(escalationId, next);
  return next;
}

export function clearCrisisDraft(escalationId: string): void {
  safe(() => sessionStorage.removeItem(keyFor(escalationId)), undefined);
  for (const fn of listeners) fn();
}

/** The draft for one escalation, live; `null` on the server and when none. */
export function useCrisisDraft(escalationId: string): CrisisDraft | null {
  return useSyncExternalStore(
    (on) => {
      listeners.add(on);
      return () => {
        listeners.delete(on);
      };
    },
    () => read(escalationId),
    () => null
  );
}
