"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CONTEXT RAIL, COLLAPSED TO A STRIP (SUP-2)
//
// On `/app/chat` the support panel and the context rail are mutually
// exclusive: two stacked right-hand auxiliary panels compress the conversation,
// which is the primary task on that screen. So while Support is open the rail
// collapses to this strip — its tabs as a column of icon buttons — and one
// click on any of them brings the rail back on that tab and closes Support.
//
// 56 wide: a 40px target with 8px either side, which is the narrowest column
// that still holds a full-size hit area (SC 2.5.8; the bar's 40 is the bar).

import { History, ShieldAlert, Sparkles, UserRound, Wrench } from "lucide-react";
import { RAIL_TAB_LABEL, type RailTab } from "@/components/chat/rail/rail";
import { cn } from "@/lib/utils";

const ICON: Record<RailTab, typeof History> = {
  escalation: ShieldAlert,
  assist: Sparkles,
  profile: UserRound,
  toolkit: Wrench,
  timeline: History,
};

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function RailStrip({
  tabs,
  active,
  onOpen,
}: {
  tabs: readonly RailTab[];
  active: RailTab;
  /** Reopen the rail on this tab. The caller closes Support. */
  onOpen: (tab: RailTab) => void;
}) {
  return (
    <nav
      aria-label="Conversation tools"
      data-rail-strip
      className="flex h-full flex-col items-center gap-2 border-l border-[color:var(--border-subtle)] py-3"
    >
      {tabs.map((t) => {
        const Icon = ICON[t];
        return (
          <button
            key={t}
            type="button"
            data-rail-strip-tab={t}
            onClick={() => onOpen(t)}
            /* TODO-COPY. "Open" because it brings the rail back; the label is
               the tab's own word. */
            aria-label={`Open ${RAIL_TAB_LABEL[t]}`}
            title={RAIL_TAB_LABEL[t]}
            className={cn(
              "flex size-10 items-center justify-center rounded-[var(--radius-lrg)] transition-colors",
              t === active
                ? "bg-[var(--surface-s2)] text-[var(--text-primary)]"
                : "text-[var(--icon-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            <Icon aria-hidden className="size-5" strokeWidth={1.75} />
          </button>
        );
      })}
    </nav>
  );
}
