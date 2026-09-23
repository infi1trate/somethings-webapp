"use client";

// ═══════════════════════════════════════════════════════════════════════════
// APPEARANCE — LIGHT, FORCED, AND THE PLUMBING LEFT STANDING
//
// This was a real three-way control (light / dark / system) with `"system"` as
// its default, a blocking script in `layout.tsx` that read
// `prefers-color-scheme` before hydration, a segmented control in Settings and a
// quick toggle in the account popover. It worked.
//
// ═══ WHY IT IS OFF, AND WHY THAT IS NOT A STYLE PREFERENCE ═══
//
// A `"system"` default means any supervisor whose OS is in dark mode got an
// INVERTED CLINICAL SURFACE, automatically, with no action and no way to know it
// had happened — on the surface where a missed flag has the highest cost. The
// dark tokens carry measured contrast ratios in `settings-tokens.css`, so they
// are not arbitrary; what was never done is testing the SURFACES in dark. A
// theme nobody audited, shipped by default to a subset of users nobody can
// identify, is a live accessibility risk rather than a constraint violation.
//
// ═══ WHAT IS REMOVED, AND WHAT IS DELIBERATELY NOT ═══
//
// REMOVED: the two controls (Settings' segmented control, the account popover's
// quick toggle) and the pre-hydration script that applied the OS preference.
//
// NOT REMOVED: the `.dark` token blocks, the `@custom-variant dark` declaration,
// and this module's API. Ripping out theme infrastructure is a larger change
// than this pass, and reversing the decision later should stay cheap — one
// constant here and two controls back. MEASURED before deciding it was safe to
// leave: ZERO dark-only tokens across both CSS files (142 light / 91 dark in
// `settings-tokens.css`, 95 / 19 in `globals.css`), so nothing in the product
// resolves correctly only under dark tokens and forcing light cannot leave
// anything unresolved.
//
// `useAppearance` KEEPS ITS SHAPE so `ui/sonner.tsx` compiles unchanged and
// reads `"light"` for its toasts. `setTheme` is a no-op that says so.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { useMounted } from "@/lib/use-mounted";

export type ThemeChoice = "light" | "dark" | "system";

/** THE ONE LEVER. Flip this and restore the two controls to bring the choice
 *  back; nothing else about the token system changed. */
export const THEME_FORCED: ThemeChoice = "light";

export function useAppearance() {
  const mounted = useMounted();

  /** ═══ BELT AND BRACES, AND THE BRACES ARE THE POINT ═══
   *  `layout.tsx` no longer applies `.dark`, so in a clean session nothing adds
   *  it. This strips it anyway: a browser that visited an earlier build has a
   *  `somethings.theme` value in localStorage and — more to the point — may have
   *  the class already on `<html>` from a cached document. One line, and it
   *  cannot be the thing that ships an inverted clinical surface. */
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return {
    theme: THEME_FORCED,
    /** A NO-OP, NOT AN ABSENT FUNCTION. Keeping the signature means a caller
     *  that still asks for a theme change compiles and does nothing visible,
     *  rather than the build breaking somewhere unrelated — and the two callers
     *  that used to exist are removed in the same commit, so today there are
     *  none. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setTheme: (_choice: ThemeChoice) => {},
    mounted,
  };
}
