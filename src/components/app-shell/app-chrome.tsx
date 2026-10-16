"use client";

// ═══════════════════════════════════════════════════════════════════════════
// WHAT A ROUTE RENDERS: ITS CONTENT, AND TWO SETTINGS FOR THE SHELL
//
// ═══ IT USED TO RENDER THE WHOLE SHELL (and that is why it no longer does) ═══
// Every console route rendered `<AppChrome>`, so the rail, the bars and the
// content panel unmounted and remounted on every navigation. The support panel
// has to survive a route change (SUP standing rule 4), so the shell now lives
// in `src/app/(console)/layout.tsx` as `ConsoleShell` and persists.
//
// THE CALL SITES DID NOT CHANGE. All nineteen still read
// `<AppChrome active="…" bottomInset?="…">{content}</AppChrome>`; this reports
// the two settings to the persistent shell and renders the content in place.
//
// A LAYOUT EFFECT, so the shell has the page's active item before the browser
// paints a client-side navigation — no frame of the previous page's highlight.

import { useLayoutEffect } from "react";
import { reportShellConfig } from "@/lib/app-shell/shell-config";

export function AppChrome({
  active,
  bottomInset,
  children,
}: {
  active: string;
  /** Forwarded to `AppShell` — a surface passes `"surface"` when it reserves
   *  its own room above the bottom bar. See `AppShell`'s prop. */
  bottomInset?: "panel" | "surface";
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    reportShellConfig({ active, bottomInset });
  }, [active, bottomInset]);
  return <>{children}</>;
}
