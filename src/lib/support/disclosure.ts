// ═══════════════════════════════════════════════════════════════════════════
// WHICH SUPPORT SECTIONS ARE OPEN (SUP-3)
//
// "Disclosure state persists per user across sessions and across route
// changes." Across routes comes free (the panel is one mount); across sessions
// is `localStorage`, keyed by persona, which is the prototype's notion of a
// user. Its own key rather than a field on the onboarding store: that store is
// versioned and migrated, and a UI preference does not need either.
//
// THE DEFAULT: Supervisors open, the rest closed. Supervisors is the 1:1
// escalation path and the most-used target; the others are broadcast and
// reference (Hick's Law: do not open on four expanded lists).

import { useSyncExternalStore } from "react";
import type { SupportSectionId } from "@/lib/support/directory";

export const DISCLOSURE_KEY = "somethings.support.disclosure";

type Disclosure = Record<SupportSectionId, boolean>;
export const DEFAULT_DISCLOSURE: Disclosure = {
  supervisors: true,
  cohorts: false,
  groups: false,
  other: false,
};

let cache: Record<string, Disclosure> | null = null;
const listeners = new Set<() => void>();

function read(): Record<string, Disclosure> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DISCLOSURE_KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, Disclosure>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

/** One stable object per persona, so `useSyncExternalStore` sees no change
 *  between reads that changed nothing. */
const snapshots = new Map<string, Disclosure>();
function snapshot(persona: string): Disclosure {
  const stored = read()[persona];
  const prev = snapshots.get(persona);
  const next = { ...DEFAULT_DISCLOSURE, ...stored };
  if (prev && (Object.keys(next) as SupportSectionId[]).every((k) => prev[k] === next[k])) return prev;
  snapshots.set(persona, next);
  return next;
}

export function setSectionOpen(persona: string, id: SupportSectionId, open: boolean): void {
  const all = read();
  cache = { ...all, [persona]: { ...DEFAULT_DISCLOSURE, ...all[persona], [id]: open } };
  try {
    localStorage.setItem(DISCLOSURE_KEY, JSON.stringify(cache));
  } catch {
    /* Private mode or a full quota: it still holds for this session. */
  }
  listeners.forEach((l) => l());
}

export function useDisclosure(persona: string): Disclosure {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      /* Another tab changed it. */
      const onStorage = (e: StorageEvent) => {
        if (e.key !== DISCLOSURE_KEY) return;
        cache = null;
        l();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => snapshot(persona),
    () => DEFAULT_DISCLOSURE
  );
}
