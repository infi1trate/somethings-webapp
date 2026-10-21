"use client";

// THE ROSTER, READ THROUGH THE ONE TIER STORE.
//
// "Live" is no longer a scenario id: it is a teen in the Tier 1 lane — an
// open Tier 1 escalation, confirmed or not — whichever surface raised it. A
// mentor raising Tier 1 in the chat lights the strip here, because both read
// the same record.

import { useMemo } from "react";
import { tierRoster, type MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { useTiering } from "@/lib/tiering/use-tiering";

export function useTierRoster(now: number): { teens: MonitoringTeen[]; live: boolean; ready: boolean } {
  const t = useTiering(now);
  const teens = useMemo(
    () => (t.ready ? tierRoster({ stateFor: t.stateFor, escalationsFor: t.escalationsFor, liveMentorName: t.liveMentorName, now }) : []),
    [t, now]
  );
  return { teens, live: teens.some((x) => x.tier === 1), ready: t.ready };
}
