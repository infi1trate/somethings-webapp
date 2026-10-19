// ═══════════════════════════════════════════════════════════════════════════
// THE CONSOLE LAYOUT — ONE SHELL FOR `/app/*` AND `/admin/*` (SUP-1)
//
// A route group, so no URL changed: `(console)` is organisational and is not
// part of the path. Both trees moved under it because both render the same
// shell — `/admin/person/[id]` is where Care Reviews' "View care history"
// goes, so a layout covering `/app` alone would still drop the support panel
// on the way there.
//
// A layout persists across navigations between the routes beneath it, which
// is what lets the support panel (SUP-2) keep its open state, thread and
// scroll position across a route change. This is not a root layout:
// `src/app/layout.tsx` still is, so moving between this group and the routes
// outside it (onboarding, hub, gate) is an ordinary client navigation.

import { ConsoleShell } from "@/components/app-shell/console-shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
