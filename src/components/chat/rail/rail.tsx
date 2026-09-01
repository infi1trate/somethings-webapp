"use client";

// THE RAIL — four panels behind four LABELLED tabs.
//
// ═══ THE TABS CARRY WORDS. THIS IS THE WHOLE POINT OF THE COMPONENT ═══
//
// The surface this replaces put four unlabelled icons in the rail's top-right
// corner: a sparkle, a person, a grid, a clock. Nothing named them, nothing
// showed which was selected, and there is no icon in any vocabulary that means
// "documentation timeline" — so the only way to learn what the grid did was to
// press it, and the only way to remember was to have pressed it recently.
//
// Four words solve it, and cost 28 pixels of height. A mentor can see which panel
// they are in, a screen reader announces "Toolkit, tab, 3 of 4", and nobody has
// to build a mental map of glyphs.
//
// `SegmentedControl` with `semantics="tabs"` is used rather than a hand-rolled
// row, because it already carries the parts that are easy to get wrong: roving
// tabindex so Tab leaves the control instead of walking it, ←/→/Home/End moving
// selection and focus together, `aria-controls` pointing only from the selected
// tab (the others' panels are not in the DOM), and a measured thumb.
//
// ═══ THE PANEL SET DEPENDS ON `kind`, NOT ON A SECOND RAIL ═══
//
// A support thread has no teen profile to read and no activities to send. It gets
// two tabs, from the same component, because the alternative is a second rail
// that starts identical and drifts.

import { useId, useState } from "react";
import { SegmentedControl } from "@/components/record/segmented-control";
import { PanelEmpty, PanelShell } from "@/components/chat/rail/rail-panel";
import type { ChatThread } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export type RailTab = "assist" | "profile" | "toolkit" | "timeline";

/** TODO-COPY. Short enough that four fit a 320px column at 11px without
 *  truncating — measured, not assumed. */
const LABEL: Record<RailTab, string> = {
  assist: "Assist",
  profile: "Profile",
  toolkit: "Toolkit",
  timeline: "Timeline",
};

/** WHICH TABS A THREAD GETS. A support thread has no profile canvas and no
 *  activity shelf; it keeps Assist and Timeline, which are about the working
 *  relationship rather than about a teen. */
export function tabsFor(kind: ChatThread["kind"]): RailTab[] {
  return kind === "teen"
    ? ["assist", "profile", "toolkit", "timeline"]
    : ["assist", "timeline"];
}

export function Rail({
  thread,
  className,
}: {
  thread: ChatThread;
  className?: string;
}) {
  const tabs = tabsFor(thread.kind);
  const [tab, setTab] = useState<RailTab>(tabs[0]);
  const panelId = useId();

  /* ═══ THE SELECTED TAB IS NOT PERSISTED, AND THAT IS A DECISION ═══
     It is per-thread UI that is worthless after a reload, and storing it would
     mean a localStorage write every time a mentor glances at Profile. It also
     resets to Assist when the thread changes, which is right: the panel that
     opens on a conversation should be the one that says what to do next, not
     whichever one you happened to leave open on somebody else. */
  const active = tabs.includes(tab) ? tab : tabs[0];

  return (
    <div
      data-slot="chat-rail"
      className={cn(
        "flex h-full min-h-0 flex-col bg-[var(--surface-card)]",
        className
      )}
    >
      <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-4 py-2.5">
        <SegmentedControl
          options={tabs.map((t) => ({
            value: t,
            label: LABEL[t],
            controls: `${panelId}-panel`,
          }))}
          value={active}
          onChange={setTab}
          semantics="tabs"
          fullWidth
          size="sm"
          /* TODO-COPY. Names the region, not the widget: a reader hearing
             "Conversation tools" knows what the four tabs are for. */
          ariaLabel="Conversation tools"
        />
      </div>

      <div
        id={`${panelId}-panel`}
        role="tabpanel"
        tabIndex={-1}
        // THE FLEXIBLE ROW. The tab bar is `shrink-0`; this absorbs the rest and
        // hands it to the panel, whose own middle row is what scrolls.
        className="min-h-0 flex-1"
      >
        <PanelShell>
          {/* ═══ PHASE 1 SCAFFOLDS ═══
              Four honest empty states. Each one NAMES WHAT LANDS THERE rather
              than saying "coming soon" — a mentor reading these learns what the
              rail is for, which is more than the built version of three of these
              panels would teach them today. Phases 3, 5 and 7 replace them. */}
          {active === "assist" && (
            <PanelEmpty title="Where to start">
              {/* TODO-COPY */}
              One suggestion at a time, based on what has happened in this
              conversation — with the option to do it or to leave it.
            </PanelEmpty>
          )}
          {active === "profile" && (
            <PanelEmpty title={`About ${thread.displayName.split(" ")[0]}`}>
              {/* TODO-COPY */}
              What this teen has chosen to share about themselves, in their own
              words.
            </PanelEmpty>
          )}
          {active === "toolkit" && (
            <PanelEmpty title="Things to send">
              {/* TODO-COPY */}
              Conversation starters, question sets and photo swaps. Each one says
              what it is for before you send it.
            </PanelEmpty>
          )}
          {active === "timeline" && (
            <PanelEmpty title="What has happened">
              {/* TODO-COPY */}
              Activities sent, notes written and escalations raised, in order.
            </PanelEmpty>
          )}
        </PanelShell>
      </div>
    </div>
  );
}
