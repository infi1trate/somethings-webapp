"use client";

// Installs the in-app history tracker (`lib/app-shell/nav-history.ts`) once,
// from the ROOT layout, so it counts navigations from the app's first page —
// including ones made outside the console before the user reached it. Renders
// nothing.

import { useEffect } from "react";
import { installNavHistory } from "@/lib/app-shell/nav-history";

export function NavHistoryInstaller() {
  useEffect(() => {
    installNavHistory();
  }, []);
  return null;
}
