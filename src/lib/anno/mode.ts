"use client";

// THE ANNOTATION MODE — R1.
//
// ═══ ONE THREE-STATE CONTROL, NOT THREE TOGGLES ═══
//
// Off, View, Place are mutually exclusive readings of the same question: is the
// reviewer looking at the product, at the comments on it, or adding one. Three
// independent toggles would allow states that mean nothing — "place but not
// view" — and would make the reader assemble the mode themselves. So there is
// one value with three legal readings, and the control is a radiogroup.
//
// ═══ WHY sessionStorage ═══
//
// The brief asks for persistence "across navigation within the session", which is
// exactly `sessionStorage`'s lifetime: it survives every route change and full
// reload in this tab, and dies when the tab does. `localStorage` would be wrong
// in a specific way — a reviewer who left Place mode armed would find the app
// still armed tomorrow, wondering why their clicks were being intercepted. The
// review-draft module already sets this precedent for session-scoped state.
//
// ═══ WHY A MODULE STORE AND NOT THE ZUSTAND STORE ═══
//
// `somethings.mentor-onboarding` is the persisted product store, and the mode is
// neither product state nor persistent. Keeping it out means the annotation layer
// can be deleted without touching a store that everything else reads, and it
// keeps a review-tool concern out of the app's own state shape.

import { useSyncExternalStore } from "react";

export type AnnoMode = "off" | "view" | "place";

const KEY = "somethings.anno.mode";

export const MODE_LABEL: Record<AnnoMode, string> = {
  off: "Off",
  view: "View",
  place: "Place",
};

/** What each mode actually does, for the control's `title` and for the reader who
 *  has not been told. Written as consequences, not names. */
export const MODE_HINT: Record<AnnoMode, string> = {
  off: "No comment layer. The prototype behaves exactly as it would without it.",
  view: "Show existing comments. The prototype stays clickable underneath.",
  place: "Click anywhere to leave a comment. Esc to stop.",
};

let current: AnnoMode | null = null;
const listeners = new Set<() => void>();

function read(): AnnoMode {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "view" || v === "place" ? v : "off";
  } catch {
    /* Private mode, blocked storage. Off is the safe default: the layer does not
       mount, so a storage failure can never leave the prototype covered by
       something the reviewer cannot turn off. */
    return "off";
  }
}

export function getMode(): AnnoMode {
  if (current === null) current = read();
  return current;
}

export function setMode(next: AnnoMode): void {
  if (current === next) return;
  current = next;
  try {
    sessionStorage.setItem(KEY, next);
  } catch {
    /* Not persisting is survivable; refusing to change mode is not. */
  }
  for (const fn of [...listeners]) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** ═══ THE SERVER SNAPSHOT IS ALWAYS `off` ═══
 *
 *  `sessionStorage` does not exist during SSR, so the server cannot know the
 *  mode — and guessing would be a hydration mismatch on every page. Rendering
 *  `off` on the server and letting the real value arrive at hydration is the same
 *  shape `use-mounted.ts` uses, and it has a second benefit: the layer's first
 *  paint is always "not mounted", so it can never flash over the product. */
export function useAnnoMode(): AnnoMode {
  return useSyncExternalStore(subscribe, getMode, () => "off");
}

/** TEST SEAM. */
export function __resetModeForTests(): void {
  current = null;
}

/* ══════════════════════════ THE DRAWER ══════════════════════════════════
 *
 *  Open/closed lives here rather than in its own module because it is the same
 *  kind of thing as the mode: session-scoped review-tool state that several
 *  unrelated components need to read. The dev bar's toggle sets it, the layer
 *  renders it, and neither imports the other.
 *
 *  NOT PERSISTED, and that is the difference from the mode. A mode is a stance a
 *  reviewer holds across pages; an open drawer is a thing they are doing right
 *  now, and restoring it on the next page load would cover the prototype for
 *  someone who had moved on. */
let drawerOpen = false;
const drawerListeners = new Set<() => void>();

export function isDrawerOpen(): boolean {
  return drawerOpen;
}

export function setDrawerOpen(next: boolean): void {
  if (drawerOpen === next) return;
  drawerOpen = next;
  for (const fn of [...drawerListeners]) fn();
}

function subscribeDrawer(fn: () => void): () => void {
  drawerListeners.add(fn);
  return () => drawerListeners.delete(fn);
}

export function useDrawerOpen(): boolean {
  return useSyncExternalStore(subscribeDrawer, isDrawerOpen, () => false);
}
