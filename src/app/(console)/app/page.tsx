"use client";

// The mentor's Home — the post-approval landing ("Go to Somethings" targets
// /app). Intentionally CLEARED to a blank canvas: the old profile-preview /
// status-banner / restart-demo content was removed pending contextual Home
// features (a later pass). The app chrome — sidebar nav, account popover,
// settings gear — comes from AppChrome and stays.

import { useMounted } from "@/lib/use-mounted";
import { AppChrome } from "@/components/app-shell/app-chrome";

export default function AppHomePage() {
  const mounted = useMounted();
  if (!mounted) return null;

  return (
    <AppChrome active="home">
      {/* Blank for now — contextual Home features land here later. */}
      <div className="min-h-full" />
    </AppChrome>
  );
}
