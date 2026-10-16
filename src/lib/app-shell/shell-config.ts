// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE PAGE TELLS THE PERSISTENT SHELL (SUP-1, prerequisite for SUP-2)
//
// ═══ WHY THIS EXISTS ═══
// Every console route used to render `<AppChrome>` itself, so the whole shell
// (rail, bars, content panel) unmounted and remounted on every navigation.
// The support panel must survive route changes "on the same thread, with scroll
// position intact" (SUP standing rule 4), which nothing inside a remounting
// shell can do. So the shell moved into `src/app/(console)/layout.tsx` and
// persists, and the pages keep calling `<AppChrome active="…">` — which now
// only REPORTS its two settings here instead of rendering the chrome.
//
// AN EXTERNAL STORE, NOT CONTEXT STATE: the page reports from a layout effect,
// and setting a parent's React state from a child effect is what this repo's
// `react-hooks/set-state-in-effect` rule rejects. A store write is not a React
// setState, and `useSyncExternalStore` reads it without tearing.
//
// ═══ THE CLOCK, AND WHY IT IS HERE ═══
// The shell fixed its badge clock at mount (`useState(() => Date.now())`), and
// because it remounted per route that clock refreshed on every navigation. A
// persistent shell would freeze it for the whole session, so the clock is now
// bumped on each pathname change instead — the same refresh cadence as before,
// without reading `Date.now()` during render.

import { useSyncExternalStore } from "react";

export interface ShellConfig {
  active: string;
  bottomInset?: "panel" | "surface";
}

let config: ShellConfig | null = null;
let navNow = Date.now();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Called by `AppChrome` from a layout effect. A no-op when nothing changed, so
 *  a re-rendering page does not re-render the shell. */
export function reportShellConfig(next: ShellConfig): void {
  if (config && config.active === next.active && config.bottomInset === next.bottomInset) return;
  config = { ...next };
  emit();
}

/** NULL until a page has reported — on the server, and for the frame before
 *  hydration. The shell renders with no active item for that frame, which is
 *  inside the correction the persona gate already makes on a hard load. */
export function useShellConfig(): ShellConfig | null {
  return useSyncExternalStore(subscribe, () => config, () => null);
}

/** Refresh the shell's clock. Called on every pathname change. */
export function bumpNavClock(): void {
  navNow = Date.now();
  emit();
}

/** The shell's "now" for badge counts, fixed between navigations. */
export function useNavClock(): number {
  return useSyncExternalStore(subscribe, () => navNow, () => navNow);
}
