"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A NEW TIER 1, ANNOUNCED ONCE (Monitoring v4, §1)
//
// The strip's `role="alert"` interrupted a screen reader on every render of a
// state that persisted. What a reader needs is the EVENT: one polite line,
// "New Tier 1 escalation: {teen}", the first time an unconfirmed Tier 1
// appears while the page is open. What was already there on load is not
// news — the queue states it. A DOM write, not state: nothing re-renders.

import { useEffect, useRef } from "react";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";

export function Tier1Arrivals({ teens }: { teens: MonitoringTeen[] }) {
  const said = useRef<HTMLParagraphElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const live = teens.filter((t) => t.t1 && t.t1.escalation.confirmedTier === undefined);
  const key = live.map((t) => t.t1!.escalation.id).join(",");
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    /* The first render with data is the baseline, not an arrival. */
    if (seen.current === null) {
      if (ids.length || teens.length) seen.current = new Set(ids);
      return;
    }
    const fresh = live.filter((t) => !seen.current!.has(t.t1!.escalation.id));
    for (const t of fresh) seen.current.add(t.t1!.escalation.id);
    /* TODO-COPY */
    if (fresh.length && said.current) said.current.textContent = fresh.map((t) => `New Tier 1 escalation: ${t.teen}`).join(". ");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the ids
  }, [key, teens.length]);
  return <p ref={said} data-t1-arrivals role="status" aria-live="polite" className="sr-only" />;
}
