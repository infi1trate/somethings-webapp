"use client";

// /app/escalation/[escalationId] — THE LANDING FOR EVERY ESCALATION LINK-OUT.
//
// ═══ IT USED TO BE A PLACEHOLDER, AND THAT WAS RIGHT ONCE (arch-G, G6) ═══
//
// Locked decision 3 says escalations never resolve inline, they link out — so
// "open the escalation" was the loudest action on the Tasks page while pointing
// at a route that did not exist, and a raw Next 404 under a page's loudest
// button reads as a broken build. This file said the true thing instead and
// deliberately did NOT invent an escalation UI, because a second, unreviewed
// escalation design would have contradicted decision 3 by making the link-out
// look like a place work can be finished.
//
// THE RECORD EXISTS NOW. arch-mon gave Monitoring the escalation region and the
// record pane; arch-G, G6 gave that record its timeline, its note module and a
// terminal `closed · documented` state. So the honest destination is no longer a
// sentence about the flow being unbuilt — it is the record, and this route's job
// is to carry the id to it.
//
// A REDIRECT RATHER THAN A SECOND RENDER OF THE RECORD. Rendering it here would
// be the exact fork the note above refused: two escalation surfaces, drifting.
// The record lives on one page, and every link-out lands on that page with the
// record selected. Monitoring states it plainly when the id is not in the
// current data set, which is the reachability limit this prototype has.
//
// THE MENTOR BRANCH KEEPS THE PLACEHOLDER. Monitoring is supervisor-only, so
// sending a mentor there would land them on the honest-unbuilt placeholder of a
// DIFFERENT page, about a surface they are not offered. The sentence they had is
// still the true one for them.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, every store read behind useMounted.

import { use, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { escalationRecordHref } from "@/components/tasks/strips";
import { useMounted } from "@/lib/use-mounted";

export default function EscalationRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  void use(searchParams);
  const params = useParams<{ escalationId: string }>();
  const mounted = useMounted();
  const router = useRouter();
  const persona = useOnboardingStore((s) => s.persona);
  // Gated behind `mounted`: persona is persisted, and branching on it before
  // hydration swaps the shell for one frame with no error to show for it.
  const supervisor = mounted && isSupervisorTier(persona);
  const id = params.escalationId;

  /* `replace`, NOT `push`. This route is a hop, not a destination — leaving it
     in history would make Back bounce a reader through it on the way out.
     IN AN EFFECT, not in render: a redirect during render is a side effect the
     React Compiler rejects, and the visible fallback below is what a reader
     sees for the one frame it takes. */
  useEffect(() => {
    if (!supervisor) return;
    router.replace(escalationRecordHref(id));
  }, [supervisor, id, router]);

  const body = (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        Escalation
      </h1>
      <p
        role="status"
        className="max-w-[42ch] text-[14px] leading-[20px] text-[var(--text-secondary)]"
      >
        {supervisor ? (
          <>
            {/* NEEDS-COPY-NICOLE. One frame, usually — but a reader on a slow
                machine gets a sentence rather than an empty page, and it names
                the id so a failed hop is visibly the one that was followed. */}
            Opening the record for {id}…
          </>
        ) : (
          <>
            {/* TODO-COPY. UNCHANGED FOR A MENTOR: the escalation record is a
                supervisor surface, so for them this genuinely is unbuilt. */}
            The escalation flow isn’t part of this prototype yet — this is where{" "}
            {id} will open.
          </>
        )}
      </p>
      <Link
        href={supervisor ? escalationRecordHref(id) : "/app/tasks"}
        className="mt-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--text-primary)] underline decoration-[color:var(--border-contour)] underline-offset-2 transition-colors hover:bg-[var(--tint-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      >
        {/* NEEDS-COPY-NICOLE. THE LINK IS THE FALLBACK FOR THE REDIRECT, so the
            record is reachable by hand if the hop does not run. */}
        {supervisor ? "Open the record" : "Back to tasks"}
      </Link>
    </div>
  );

  // The shell follows the persona, so a supervisor stays inside the console they
  // clicked from instead of being dropped into the mentor chrome.
  return supervisor ? (
    /* `escalations`, NOT `monitoring`. Monitoring is a group label now and has
       no rail item, so the old id selected nothing and this hop rendered with
       the whole rail unselected. */
    <AdminShell active="escalations">{body}</AdminShell>
  ) : (
    <MentorShell active="tasks">{body}</MentorShell>
  );
}
