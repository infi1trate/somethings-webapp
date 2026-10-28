"use client";

// THE ROSTER, READ THROUGH THE ONE TIER STORE.
//
// "Live" is no longer a scenario id: it is a teen in the Tier 1 lane — an
// open Tier 1 escalation, confirmed or not — whichever surface raised it. A
// mentor raising Tier 1 in the chat lights the strip here, because both read
// the same record.

import { useMemo } from "react";
import { monitoringEvents, type MonitoringEvent } from "@/lib/monitoring/events";
import { tierRoster, type MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { useTiering } from "@/lib/tiering/use-tiering";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { monitoringMock } from "@/lib/monitoring/monitoring.mock";

export function useTierRoster(now: number): { teens: MonitoringTeen[]; live: boolean; ready: boolean; events: MonitoringEvent[] } {
  const t = useTiering(now);
  /* ═══ THE DEV BAR'S MONITORING SCENARIO (Monitoring v3, §6) ═══ A transform
     of the same derived data — never a second source. */
  const mock = monitoringMock(useOnboardingStore((s) => s.monitoringScenarioId));
  const teens = useMemo(() => {
    if (!t.ready) return [];
    const base = tierRoster({ stateFor: t.stateFor, escalationsFor: t.escalationsFor, liveMentorName: t.liveMentorName, now, eventsFor: t.eventsFor, nameOf: t.nameOf, viewerId: t.viewer.id });
    return mock?.roster ? mock.roster(base) : base;
  }, [t, now, mock]);
  /* ═══ THE EVENTS TAB READS THE SAME STORE (Monitoring v2) ═══ Derived
     beside the roster, from the same tiering read, so the two tabs cannot
     disagree about a teen. */
  const events = useMemo(() => {
    if (!t.ready) return [];
    const base = monitoringEvents({ roster: teens, eventsFor: t.eventsFor, escalationsFor: t.escalationsFor, nameOf: t.nameOf, now });
    return mock?.events ? mock.events(base, now) : base;
  }, [t, teens, now, mock]);
  return { teens, live: teens.some((x) => x.tier === 1), ready: t.ready, events };
}
