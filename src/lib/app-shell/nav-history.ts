// ═══════════════════════════════════════════════════════════════════════════
// CAN THE USER GO BACK, AND FORWARD? (SUP-1, the top bar's history control)
//
// ═══ WHY THIS EXISTS ═══
// The history control must render a DISABLED state when there is nowhere to
// go in that direction. Next's App Router exposes `router.back()` and
// `router.forward()` and nothing else — no length, no position, no
// can-go-back (node_modules/next/dist/docs/.../use-router.md; this repo found
// the same at `lib/record/origins.ts`). `history.length` counts entries but not
// where the user is among them, so it cannot answer "forward" at all.
//
// ═══ THE MECHANISM: A POSITION STAMPED INTO EACH HISTORY ENTRY ═══
// `pushState` is wrapped to increment the position and stamp it into the new
// entry's state (and to truncate "forward", which is what a push does);
// `replaceState` is wrapped to carry the current position into the replaced
// entry; `popstate` reads the stamp back off whichever entry the user landed
// on. The furthest position reached is kept in sessionStorage so a reload can
// still tell whether forward exists.
//
// NEXT'S OWN STATE IS PRESERVED. Next keeps its router tree in `history.state`
// and integrates `pushState`/`replaceState` with its router (docs: "Linking
// and navigating"); the wrappers spread the state they are given and add one
// key, so whatever Next stored is untouched and whichever patch runs first,
// both still run.
//
// THE LIMIT, STATED: history the app did not create is invisible. On a fresh
// load the position starts at 0, so "back" is disabled even if the tab has an
// earlier page from another site — the control is IN-APP history, which is the
// only history it can honestly describe.

import { useSyncExternalStore } from "react";

const STAMP = "__somethingsNavIdx";
const SESSION_KEY = "somethings.nav-history";

let idx = 0;
let max = 0;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const stampOf = (state: unknown): number | null => {
  const v = (state as Record<string, unknown> | null)?.[STAMP];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const persist = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ max }));
  } catch {
    /* private mode or blocked storage: forward detection degrades after a
       reload, nothing else does. */
  }
};

/** Install once, as early as possible. Idempotent. */
export function installNavHistory(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const h = window.history;

  const landed = stampOf(h.state);
  if (landed !== null) {
    /* A RELOAD (or a restored tab): this entry was stamped earlier. */
    idx = landed;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as { max?: number } | null;
      max = Math.max(idx, typeof saved?.max === "number" ? saved.max : idx);
    } catch {
      max = idx;
    }
  } else {
    idx = 0;
    max = 0;
  }

  const push = h.pushState.bind(h);
  const replace = h.replaceState.bind(h);
  h.pushState = function (state: unknown, unused: string, url?: string | URL | null) {
    idx += 1;
    max = idx;
    persist();
    push({ ...((state as object) ?? {}), [STAMP]: idx }, unused, url);
    emit();
  };
  h.replaceState = function (state: unknown, unused: string, url?: string | URL | null) {
    replace({ ...((state as object) ?? {}), [STAMP]: idx }, unused, url);
  };
  window.addEventListener("popstate", (e) => {
    const s = stampOf(e.state);
    if (s === null) return;
    idx = s;
    emit();
  });

  /* Stamp the entry we landed on, keeping whatever is already there. */
  replace({ ...((h.state as object) ?? {}), [STAMP]: idx }, "");
  persist();
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/* One string snapshot, so `useSyncExternalStore` compares by value. */
const snapshot = () => `${idx > 0 ? 1 : 0}${idx < max ? 1 : 0}`;

/** Whether in-app history exists behind and ahead of the current entry. Both
 *  false on the server and before install, so the control renders disabled
 *  until it knows. */
export function useNavHistory(): { canGoBack: boolean; canGoForward: boolean } {
  const s = useSyncExternalStore(subscribe, snapshot, () => "00");
  return { canGoBack: s[0] === "1", canGoForward: s[1] === "1" };
}
