"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PEOPLE — the staff bottom-bar destination that groups Team and Mentees.
//
// ═══ A ROUTE, NOT A SHEET ═══
//
// The Phase 2A brief proposed People as a tab that opens a bottom sheet, and
// asked for the comparison rather than the assumption. The route won, for three
// reasons that are all properties of tab bars rather than opinions about menus:
//
//   · A DESTINATION HAS A URL. `/app/people?view=team` is linkable, bookmarkable
//     and restorable; a sheet is none of those, so a supervisor who lands on
//     Mentees cannot send anyone there.
//   · A TAB TAKES A SELECTED STATE. With a sheet, People is never "current" —
//     tapping it opens something and then the bar shows nothing selected, or
//     shows the page underneath still selected. Both are lies.
//   · BACK MUST WORK. A sheet dismissed by Back is a special case every user has
//     to learn; a route just works.
//
// AND THE FILE AGREES. In frame 2308:19812 the People cell is styled identically
// to Home, Chats and Tasks — same pill cell, same label treatment, no chevron, no
// disclosure affordance. Nothing in the design signals "this opens a menu". The
// grammar says destination.
//
// COST: one route and one segmented control, both of which already existed as
// components. The sheet's only advantage was avoiding this file.
//
// ═══ WHY MENTORS NEVER SEE IT ═══
//
// A mentor's bar carries Mentees directly. Grouping one option behind a chooser
// is a worse Mentees button, and `nav-items.ts` keeps that decision in one place.
// ═══════════════════════════════════════════════════════════════════════════

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { Roster } from "@/components/admin/roster";
import {
  TeamDirectory,
  type TeamScope,
} from "@/components/admin/team-directory";
import { SegmentedControl } from "@/components/record/segmented-control";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

type View = "team" | "mentees";

export default function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // `use(searchParams)` as a prop — standing rule 3. Never `useSearchParams`,
  // and no page-root Suspense.
  const query = use(searchParams);
  const router = useRouter();
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);

  const raw = typeof query.view === "string" ? query.view : null;
  const [view, setView] = useState<View>(raw === "mentees" ? "mentees" : "team");

  const scope: TeamScope = !mounted
    ? "supervisor"
    : isSupervisorTier(persona)
      ? "supervisor"
      : "lead";

  const select = (v: View) => {
    setView(v);
    // `replace`, not `push`: the two views are one destination seen two ways, so
    // Back should leave People rather than walk the toggle's history.
    router.replace(`/app/people?view=${v}`, { scroll: false });
  };

  const body = (
    <div className="px-6 py-6 lg:px-10">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        {/* TODO-COPY */}
        People
      </h1>
      <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {/* TODO-COPY */}
        The staff you work with, and the teens on the platform.
      </p>

      {/* `semantics="tabs"` so the control is announced as a tablist and gets the
          roving-tabindex keyboard model — this IS a view switch, not a filter. */}
      <SegmentedControl<View>
        className="mt-5"
        ariaLabel="People view"
        semantics="tabs"
        size="md"
        value={view}
        onChange={select}
        options={[
          { value: "team", label: "Team" },
          { value: "mentees", label: "Mentees" },
        ]}
      />

      <div className="mt-6">
        {view === "team" ? (
          <TeamDirectory scope={scope} />
        ) : (
          // Same call `/app/mentees` makes for a supervisor. `showQueues={false}`
          // because the review queues belong to Team, which is the other half of
          // this very toggle — showing them under Mentees would duplicate them
          // one tap away from themselves.
          <Roster
            role={scope === "supervisor" ? "supervisor" : "lead"}
            segment="mentees"
            showQueues={false}
          />
        )}
      </div>
    </div>
  );

  // Supervisors keep the console chrome; leads stay in the mentor app shell —
  // the role migration's "two rails, one route" rule, same as `/app/team`.
  if (mounted && isSupervisorTier(persona)) {
    return <AdminShell active="people">{body}</AdminShell>;
  }
  return <MentorShell active="people">{body}</MentorShell>;
}
