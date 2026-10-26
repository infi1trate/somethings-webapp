"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CARE HISTORY — one module, both hosts (2026-10-26)
//
// "The exact history UI used in the care page should be the way the history is
// displayed in the care panel (history tab)." So the record's Care tab and the
// chat Care panel's History tab render THIS: the same two sections, the same
// components, from the same store slice —
//   Tier and escalation history   `RecordTierHistory` (TierHistory)
//   History                       `CareTimeline` — filters, search, the rows
// — and they can no longer tell different stories or drift apart in layout.
//
// ═══ THE ROLE GATE ═══ The History section is CLINICAL (assessment scores,
// presentation codes, clinical summaries, care updates, risk flags), so it
// renders only where clinical data may (`clinical`: supervisor and lead
// mentor — the same gate as the Care header's Clinical diagnosis). A mentor's
// DOM never receives it (the v5/v7 blocked constant); the tier and escalation
// trail is both lenses'.

import { useMemo } from "react";
import { CareTimeline, type CareTimelineHandle } from "@/components/record/care-timeline";
import { RecordTierHistory } from "@/components/record/record-tier";
import { careStoreSlice, careTimelineFor, type CareEvent } from "@/lib/record/care-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";

/** The record's section heading — one definition for both hosts. */
export const HISTORY_H2 = "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";

/** The History events for a teen, from the store — the record's own
 *  derivation (`careTimelineFor` over `careStoreSlice`). */
export function useCareHistoryEvents(teenId: string, now: number): CareEvent[] {
  const careReviews = useOnboardingStore((s) => s.careReviews);
  const careUpdates = useOnboardingStore((s) => s.careUpdates);
  const careFlagClosures = useOnboardingStore((s) => s.careFlagClosures);
  const careSummaryCommits = useOnboardingStore((s) => s.careSummaryCommits);
  return useMemo(
    () => careTimelineFor(teenId, now, careStoreSlice({ careReviews, careUpdates, careFlagClosures, careSummaryCommits }, teenId)),
    [teenId, now, careReviews, careUpdates, careFlagClosures, careSummaryCommits]
  );
}

export function CareHistorySections({
  teenId,
  firstName,
  events,
  clinical,
  historyHeadingRef,
  timelineRef,
}: {
  teenId: string;
  firstName: string;
  events: CareEvent[];
  /** Supervisor or lead mentor: the clinical History renders. */
  clinical: boolean;
  /** The record's "jump to History" focus target. */
  historyHeadingRef?: React.Ref<HTMLHeadingElement>;
  /** The record's timeline strip filters and scrolls History through this. */
  timelineRef?: React.Ref<CareTimelineHandle>;
}) {
  return (
    <>
      {/* ═══ TIER AND ESCALATION HISTORY ═══ The append-only tier and
          escalation trail, with audit lozenges. Above the care timeline
          because placement is what a reader is asked about first. */}
      <section aria-label="Tier and escalation history" data-record-tier-history>
        <h2 className={HISTORY_H2}>
          {/* TODO-COPY */}
          Tier and escalation history
        </h2>
        <div className="mt-3">
          <RecordTierHistory teenId={teenId} firstName={firstName} />
        </div>
      </section>

      {clinical && (
        <section aria-label="History" data-care-history>
          <h2 className={HISTORY_H2} ref={historyHeadingRef} tabIndex={-1}>
            History
          </h2>
          <div className="mt-3">
            <CareTimeline events={events} ref={timelineRef} />
          </div>
        </section>
      )}
    </>
  );
}
