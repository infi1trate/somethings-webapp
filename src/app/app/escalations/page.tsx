"use client";

// /app/escalations — Escalations.
//
// ═══ PHASE 2 MOVES THE CONTENTS IN, AND IT IS A MOUNT NOT A REWRITE ═══
//
// Monitoring stops being a destination and becomes a GROUP LABEL, so the
// escalation REGION — the worklist of records with its own selection and its own
// pane — moves here. It is `MonitoringPage` under `scope="escalations"`: the same
// component, the same state, the region and the record pane and nothing else.
//
// WHY NOT A NEW COMPONENT. The region's state is the page's: the acknowledgement
// clock, the close-out set, the resolve-and-undo ledger window. A fourth copy of
// that is a fourth place for the 5-minute rule to drift, and §6 rebuilds this
// destination on its own terms anyway. See the scope's note in
// `monitoring-page.tsx` for the full reasoning.
//
// `?escalation=` IS CARRIED THROUGH, because this is where a record opens now —
// `escalationRecordHref` points here, and it used to point at `/app/monitoring`,
// which this phase found redirecting into an infinite loop through
// `/app/escalation/[id]`.
//
// THE SHELL FOLLOWS THE PERSONA. A supervisor gets the console; anyone else gets
// the mentor chrome and the honest unbuilt sentence, because these destinations
// are supervisor surfaces and pretending otherwise would put a rail they do not
// have around a page they cannot use.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, every store read behind useMounted.

import { use } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { DestinationPlaceholder } from "@/components/ia/destination-placeholder";
import { MonitoringPage } from "@/components/monitoring/monitoring-page";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function EscalationsRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = use(searchParams);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  // Gated behind `mounted`: persona is persisted, and branching on it before
  // hydration swaps the shell for one frame with no error to show for it.
  const supervisor = mounted && isSupervisorTier(persona);

  return supervisor ? (
    <AdminShell active="escalations">
      <MonitoringPage scope="escalations" focusEscalation={str(query.escalation)} />
    </AdminShell>
  ) : (
    /* THE NON-SUPERVISOR BRANCH KEEPS THE PLACEHOLDER. Its sentence is still the
       true one for them: this destination is not offered to their persona, so
       "unbuilt" is what it is from where they stand. */
    <MentorShell active="home">
      <DestinationPlaceholder title="Escalations" status="The escalation lifecycle — trigger, acknowledgement, resolution, close-out. A supervisor surface." />
    </MentorShell>
  );
}
