"use client";

// Appearance/theme control (settings-01). Wires the EXISTING theme system —
// the `.dark` Tailwind variant + the light/dark token blocks in globals.css —
// via a self-contained hook rather than a root next-themes provider, so
// settings-01 stays diff-free (no layout.tsx / sidebar.tsx edits; the S1
// decision defers the sidebar moon's two-way sync to settings-04). The
// choice persists in its own localStorage key (no store version bump), and
// "System" follows prefers-color-scheme live. settings-04 will point the
// sidebar moon at this same hook (shared state) and decide whether to hoist a
// root provider. See design-system-gaps.md #98/#99.

import { useCallback, useEffect, useState } from "react";
import { useMounted } from "@/lib/use-mounted";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "somethings.theme";

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

export function useAppearance() {
  // Lazy-read the stored choice (client only; SSR falls back to "system").
  // The active state is mount-gated at the call site, so an initial value
  // that differs from SSR never paints before hydration.
  const [theme, setThemeState] = useState<ThemeChoice>(() =>
    typeof localStorage === "undefined"
      ? "system"
      : ((localStorage.getItem(KEY) as ThemeChoice | null) ?? "system")
  );
  const mounted = useMounted();

  // Apply the `.dark` class on mount and whenever the choice changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the OS while the choice is "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) ?? "system") === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const setTheme = useCallback((choice: ThemeChoice) => {
    localStorage.setItem(KEY, choice);
    setThemeState(choice);
  }, []);

  return { theme, setTheme, mounted };
}
