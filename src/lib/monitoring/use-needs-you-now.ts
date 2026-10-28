"use client";

// ═══ "NEEDS YOU NOW", READ FOR THE BELL (Monitoring v4, §4) ═══
// The supervisor's unconfirmed Tier 1s, through the same roster and the same
// row derivation the Monitoring queue reads (`t1Rows`) — so the tray and the
// queue agree on who is waiting, in what order, and how late. Not the
// events derivation: the bell needs the queue, nothing else.
//
// A mentor gets no rows: confirming a tier is a supervisor's act, and the
// mentor's DOM holds none of this.

import { useMemo, useState } from "react";
import { monitoringMock } from "@/lib/monitoring/monitoring.mock";
import { needsYouNow, t1Rows, type T1Row } from "@/lib/monitoring/t1-queue";
import { useJoined, useNowTick } from "@/lib/monitoring/t1-live";
import { tierRoster } from "@/lib/monitoring/tier-roster";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useTiering } from "@/lib/tiering/use-tiering";
import { useMounted } from "@/lib/use-mounted";

export function useNeedsYouNow(): { supervisor: boolean; rows: T1Row[] } {
  const [now] = useState(() => Date.now());
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const supervisor = mounted && isSupervisorTier(persona);
  const t = useTiering(now);
  const mock = monitoringMock(useOnboardingStore((s) => s.monitoringScenarioId));
  const teens = useMemo(() => {
    if (!supervisor || !t.ready) return [];
    const base = tierRoster({ stateFor: t.stateFor, escalationsFor: t.escalationsFor, liveMentorName: t.liveMentorName, now, eventsFor: t.eventsFor, nameOf: t.nameOf, viewerId: t.viewer.id });
    return mock?.roster ? mock.roster(base) : base;
  }, [supervisor, t, now, mock]);
  /* Membership does not depend on the clock — only the response text does —
     so the tick runs only while something is waiting. */
  const waiting = teens.some((x) => x.tier === 1 && x.t1 && x.t1.escalation.confirmedTier === undefined);
  const tick = useNowTick(now, waiting);
  const joined = useJoined();
  return { supervisor, rows: waiting ? needsYouNow(t1Rows(teens, tick, joined, mock?.holders)) : [] };
}
