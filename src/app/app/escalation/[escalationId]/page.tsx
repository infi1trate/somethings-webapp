"use client";

// /app/escalation/[escalationId] — THE LANDING FOR EVERY ESCALATION LINK-OUT.
//
// WHY THIS ROUTE EXISTS AT ALL. Locked decision 3: escalations never resolve
// inline, they link out. Locked decision 10: the Respond strip sits above the tabs
// and is identical from every one of them. Together those make "open the
// escalation" the single most prominent action on the Tasks page — and until this
// file existed it landed on a raw Next.js 404, because the escalation flow has no
// surface in this prototype and `/app/[section]` matches one segment, not two.
//
// A 404 under the page's loudest button reads as a broken build. This says the
// true thing instead, and it deliberately does NOT invent an escalation UI: no
// timeline, no responder list, no resolve control. Inventing one here would put a
// second, unreviewed escalation design into the prototype and quietly contradict
// decision 3 by making the link-out look like a place work can be finished.
//
// THE ID IS NAMED, for the same reason the /app/[section] chat placeholder names
// the person: an honest placeholder that repeats back what you asked for reads as
// unbuilt, while a generic one reads as broken.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, every store read behind useMounted.

import { use } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function EscalationRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  void use(searchParams);
  const params = useParams<{ escalationId: string }>();
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  // Gated behind `mounted`: persona is persisted, and branching on it before
  // hydration swaps the shell for one frame with no error to show for it.
  const supervisor = mounted && isSupervisorTier(persona);

  const body = (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        Escalation
      </h1>
      <p className="max-w-[42ch] text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {/* TODO-COPY. Names the id so the deep link is visibly the one that was
            followed, and says what is missing rather than what is broken. */}
        The escalation flow isn’t part of this prototype yet — this is where{" "}
        {params.escalationId} will open.
      </p>
      {supervisor && (
        <Link
          href="/app/tasks"
          className="mt-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--text-primary)] underline decoration-[color:var(--border-contour)] underline-offset-2 transition-colors hover:bg-[var(--tint-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
        >
          {/* TODO-COPY */}
          Back to tasks
        </Link>
      )}
    </div>
  );

  // The shell follows the persona, so a supervisor stays inside the console they
  // clicked from instead of being dropped into the mentor chrome.
  return supervisor ? (
    <AdminShell active="tasks">{body}</AdminShell>
  ) : (
    <MentorShell active="tasks">{body}</MentorShell>
  );
}
