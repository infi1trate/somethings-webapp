"use client";

// ═══════════════════════════════════════════════════════════════════════════
// APPEARANCE — TWO THEMES, ONE TOGGLE, AND LIGHT IS THE EXPLICIT DEFAULT
//
// ═══ THE HISTORY, BECAUSE IT SETS THE SHAPE ═══
//
// This was a three-way control (light / dark / system) defaulting to `"system"`,
// with a pre-hydration script that read `prefers-color-scheme`. That default is
// what made it a safety problem rather than a preference: any supervisor whose
// OS was in dark mode got an INVERTED CLINICAL SURFACE, automatically, with no
// action and no way to know it had happened — on the surface where a missed flag
// has the highest cost. The restructure forced light and removed both controls.
//
// ═══ WHAT COMES BACK, AND WHAT DOES NOT (addendum §2.5, §3.5) ═══
//
// BACK: the theme, and ONE toggle for it, in the rail's footer.
//
// NOT BACK: `"system"`. The type is two-valued now, so the OS preference cannot
// be read at all — not by this module, not by the pre-paint script. A
// supervisor whose machine flips to dark at sunset must not have a clinical
// surface change underneath them mid-shift without choosing it, and the way to
// guarantee that is to have no code path that consults the OS.
//
// THE DEFAULT IS LIGHT, EXPLICITLY. A stored choice wins; nothing stored means
// light. So the only route to dark is a person pressing the toggle.
//
// ═══ THE CONDITION ATTACHED TO RESTORING IT ═══
//
// Every contrast measurement in this phase's report is run in BOTH themes. The
// earlier pass measured 142 light / 91 dark tokens with zero dark-only, which
// establishes that the theme RESOLVES — a different claim from its passing
// contrast, and only one of the two had been checked.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useSyncExternalStore } from "react";
import { useMounted } from "@/lib/use-mounted";

/** TWO VALUES. `"system"` is not one of them — see the module note. */
export type ThemeChoice = "light" | "dark";

export const THEME_STORAGE_KEY = "somethings.theme";
export const THEME_DEFAULT: ThemeChoice = "light";

/** The one place the stored value is interpreted, mirrored by the pre-paint
 *  script in `layout.tsx` — anything that is not exactly `"dark"` is light, so
 *  a stale `"system"` from an earlier build reads as light rather than as the
 *  OS preference it used to mean. */
export function themeFromStored(raw: string | null): ThemeChoice {
  return raw === "dark" ? "dark" : THEME_DEFAULT;
}

/** ═══ AN EXTERNAL STORE, NOT STATE IN AN EFFECT ═══
 *
 *  The theme lives in `localStorage`, which is external mutable state that the
 *  server cannot see — the exact case `useSyncExternalStore` exists for. The
 *  obvious shape (state, plus an effect that reads storage and calls setState)
 *  is rejected outright by the React Compiler's lint as `set-state-in-effect`,
 *  and it is rejected for a real reason rather than a stylistic one: it renders
 *  once with a value it knows to be provisional.
 *
 *  THE SERVER SNAPSHOT IS ALWAYS LIGHT, which is what keeps SSR and the first
 *  paint agreeing. The pre-paint script has already put `.dark` on `<html>` by
 *  then if that is the stored choice, so the DOCUMENT is right before React
 *  knows; this hook catches up on the first client render. */
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  /* ANOTHER TAB COUNTS. `storage` fires only in other documents, which is
     exactly the case this cannot learn about any other way. */
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readStored(): ThemeChoice {
  try {
    return themeFromStored(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    /* Private mode, blocked storage. Light, and no theme is remembered. */
    return THEME_DEFAULT;
  }
}

function serverSnapshot(): ThemeChoice {
  return THEME_DEFAULT;
}

function applyTheme(choice: ThemeChoice) {
  document.documentElement.classList.toggle("dark", choice === "dark");
}

export function useAppearance() {
  const mounted = useMounted();
  const theme = useSyncExternalStore(subscribe, readStored, serverSnapshot);

  const setTheme = useCallback((choice: ThemeChoice) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      /* The choice still applies to this session; it just is not remembered. */
    }
    applyTheme(choice);
    for (const cb of listeners) cb();
  }, []);

  return { theme, setTheme, mounted };
}
