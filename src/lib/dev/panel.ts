// ═══════════════════════════════════════════════════════════════════════════
// THE DEV PANEL'S OPEN STATE (bar-02)
//
// ═══ THE SAME IDIOM THE DRAWER ALREADY USES ═══
//
// `lib/anno/mode.ts` holds the annotation drawer's open state as a module-level
// value plus a listener set, read through `useSyncExternalStore`. This mirrors
// it deliberately rather than inventing a second mechanism: the bar's toggle
// sets it, the panel renders it, and neither imports the other.
//
// ═══ NOT PERSISTED, AND THE DRAWER'S OWN REASONING IS WHY ═══
//
// "A mode is a stance a reviewer holds across pages; an open drawer is a thing
// they are doing right now, and restoring it on the next page load would cover
// the prototype for someone who had moved on." An open panel is the same kind of
// thing, and it covers up to half the screen — restoring it would be worse.
//
// THIS IS NOT THE bar-00 DEFECT REPEATED. That finding was about `devClockKey`:
// a pinned clock is part of the FIXTURE, so losing it on reload loses state a
// reviewer chose and a deeplink needs. Whether a drawer is open is not fixture
// state and no deeplink carries it.
//
// ═══ MUTUAL EXCLUSION LIVES HERE, ONE DIRECTION ONLY ═══
//
// Opening the panel closes the drawer, because a 50vh panel above the bar and a
// full-height right-edge drawer overlap in the bottom-right corner — measured:
// the drawer is `fixed inset-y-0 right-0 w-[22rem]`, so it reaches the bar.
//
// THE REVERSE IS AT THE CALL SITE, NOT HERE, and that asymmetry is deliberate:
// `mode.ts` must not import this module or the two form a cycle. The bar's
// drawer toggle closes the panel before opening the drawer. One rule, two
// enforcement points, and the one that would have been a cycle is the one that
// moved.

import { useSyncExternalStore } from "react";
import { setDrawerOpen } from "@/lib/anno/mode";
import type { AxisId } from "@/lib/dev/axes";

/** Which axis the panel should put focus on when it opens. `null` opens it with
 *  focus on the first control, which is what the keyboard shortcut does — a
 *  reviewer who pressed a shortcut has not told us which axis they want. */
export type PanelFocus = AxisId | null;

let open = false;
let focus: PanelFocus = null;
const listeners = new Set<() => void>();

/** ═══ ONE SNAPSHOT OBJECT, REPLACED ON CHANGE ═══
 *  `useSyncExternalStore` compares snapshots by identity, so the getter must
 *  return a stable reference between changes — building a fresh object on every
 *  read is the one thing it forbids, and it loops. */
let snapshot: { open: boolean; focus: PanelFocus } = { open, focus };

function publish() {
  snapshot = { open, focus };
  for (const fn of [...listeners]) fn();
}

export function isPanelOpen(): boolean {
  return open;
}

export function openDevPanel(next: PanelFocus = null): void {
  /* THE DRAWER GIVES WAY. See the header on why this direction lives here. */
  setDrawerOpen(false);
  if (open && focus === next) return;
  open = true;
  focus = next;
  publish();
}

export function closeDevPanel(): void {
  if (!open) return;
  open = false;
  focus = null;
  publish();
}

export function toggleDevPanel(next: PanelFocus = null): void {
  if (open) closeDevPanel();
  else openDevPanel(next);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const SERVER_SNAPSHOT = { open: false, focus: null } as const;

/** Closed on the server, always. The panel is a client affordance and rendering
 *  it open in SSR would flash it on every cold load. */
export function useDevPanel(): { open: boolean; focus: PanelFocus } {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

/** ═══ THE SHORTCUT, AND WHY IT IS THIS ONE ═══
 *
 *  MEASURED against what is already bound: `?` (shortcut sheet), `Enter`, `e`,
 *  `n`, `u`, `y`, `j`, `k`, `1`, `2`, `3` on the list surfaces, and
 *  `⌘/Ctrl+Enter` in the Care Reviews pane. Every single letter is spoken for by
 *  a list's keyboard navigation, so a bare key would collide with the prototype
 *  interactions the bar exists to observe.
 *
 *  A BACKTICK CHORD COLLIDES WITH NOTHING and is the conventional dev-panel key
 *  (browsers, editors and game consoles all use it for a drop-down console).
 *  `⌘` on Mac, `Ctrl` elsewhere — matched to the platform the same way the pane's
 *  submit chord is. */
export const PANEL_SHORTCUT_KEY = "`";

export function isPanelShortcut(e: KeyboardEvent): boolean {
  if (e.key !== PANEL_SHORTCUT_KEY) return false;
  return e.metaKey || e.ctrlKey;
}

/** ═══ AND IT MUST NOT FIRE INSIDE A TEXT FIELD ═══
 *  The panel's own scenario search is a text input, and so are several
 *  prototype surfaces' fields. `⌘\`` is not a character anyone types, but the
 *  guard is the repo's existing one rather than a judgement about which chords
 *  are safe — see `shortcuts.tsx`, which skips when the event target is an
 *  input, textarea, select or anything `contenteditable`. */
export function inTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable === true
  );
}
