"use client";

// Appearance/theme control. Wires the EXISTING theme system — the `.dark`
// Tailwind variant + the light/dark token blocks in globals.css — via a
// self-contained module store rather than a root next-themes provider, so no
// layout.tsx edit is needed. The choice persists in its own localStorage key
// (no store version bump), and "System" follows prefers-color-scheme live.
//
// settings-04: this is now a SHARED store (useSyncExternalStore over a
// module-level value + listener set), so every consumer — the Appearance
// section's segmented control AND the sidebar account popover's quick toggle —
// reflects one another in real time. That two-way sync is what design-system-
// gaps.md #98 deferred here. Cross-tab and OS-preference changes propagate too.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useMounted } from "@/lib/use-mounted";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "somethings.theme";

// Module singleton — the one source of truth every hook instance reads.
let current: ThemeChoice | null = null;
const listeners = new Set<() => void>();

function read(): ThemeChoice {
  if (current !== null) return current;
  current =
    typeof localStorage === "undefined"
      ? "system"
      : ((localStorage.getItem(KEY) as ThemeChoice | null) ?? "system");
  return current;
}

function prefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const dark = choice === "dark" || (choice === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

function setThemeGlobal(choice: ThemeChoice) {
  current = choice;
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, choice);
  applyTheme(choice);
  listeners.forEach((l) => l());
}

// One subscription per mounted consumer: React re-renders it on any theme
// change, and we also keep the class in sync with OS changes (while "system")
// and cross-tab writes.
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const mq =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const onMedia = () => {
    if (read() === "system") {
      applyTheme("system");
      onChange();
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = (e.newValue as ThemeChoice | null) ?? "system";
      applyTheme(current);
      onChange();
    }
  };
  mq?.addEventListener?.("change", onMedia);
  window?.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    mq?.removeEventListener?.("change", onMedia);
    window?.removeEventListener?.("storage", onStorage);
  };
}

const getSnapshot = () => read();
const getServerSnapshot = (): ThemeChoice => "system";

export function useAppearance() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const mounted = useMounted();

  // Keep the `.dark` class in sync with the current choice on mount (SSR paints
  // no class) and whenever it changes. Idempotent across consumers.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((choice: ThemeChoice) => {
    setThemeGlobal(choice);
  }, []);

  return { theme, setTheme, mounted };
}
