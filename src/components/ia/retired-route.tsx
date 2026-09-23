"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A ROUTE THAT USED TO BE A DESTINATION
//
// One component for `/app/home`, `/app/tasks` and `/app/monitoring`. The
// mapping lives in `lib/ia/retired-routes.ts` and is unit-tested; this is the
// three lines of chrome around it.
//
// ═══ `replace`, IN AN EFFECT, AND A LINK THAT DOES THE SAME THING ═══
//
// `replace` rather than `push`: this is a hop, not a destination, and leaving it
// in history means Back returns to a page that immediately bounces forward
// again. In an EFFECT rather than during render, because a redirect in render is
// a side effect the React Compiler rejects.
//
// AND A REAL LINK BESIDE THE SENTENCE. The effect covers the ordinary case; the
// link covers the reader whose JavaScript has not run, who has
// `prefers-reduced-motion` and a slow route transition, or who simply looks at
// the screen during the hop and wants to know where they are being taken. A
// redirect with no visible destination is indistinguishable from a hang.
//
// ═══ THE SHELL FOLLOWS THE PERSONA ═══
//
// Only a supervisor is redirected — these three routes are being retired FOR
// THEM. A mentor or lead sees the same unbuilt-section view they see today,
// byte-identical to `/app/[section]`'s, because their navigation is out of scope
// this pass and bouncing them to a supervisor destination would be worse than
// leaving them where they were.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function RetiredRoute({
  target,
  /** What the reader is being taken to, in the destination's own words. */
  destinationLabel,
  /** The mentor/lead fallback's heading — the old nav item's label, so their
   *  view is unchanged. */
  fallbackTitle,
  fallbackActive,
}: {
  target: string;
  destinationLabel: string;
  fallbackTitle: string;
  fallbackActive: string;
}) {
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const router = useRouter();
  // Gated behind `mounted`: persona is persisted state, and branching on it
  // before hydration renders one frame of the wrong branch with no error.
  const supervisor = mounted && isSupervisorTier(persona);

  useEffect(() => {
    if (!supervisor) return;
    router.replace(target);
  }, [supervisor, target, router]);

  if (supervisor) {
    return (
      <AdminShell active="today">
        <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
          <p
            role="status"
            className="max-w-[44ch] text-[14px] leading-[20px] text-[var(--text-secondary)]"
          >
            {/* NEEDS-COPY-NICOLE. It names the DESTINATION rather than saying
                "redirecting", because the reader's question is where they are
                going and not that they are going. */}
            This moved to {destinationLabel}. Taking you there…
          </p>
          <Link
            href={target}
            className={cnLink}
          >
            {/* NEEDS-COPY-NICOLE */}
            Go to {destinationLabel}
          </Link>
        </div>
      </AdminShell>
    );
  }

  /* THE EXISTING EXPERIENCE, UNCHANGED. Copy and structure lifted from
     `/app/[section]`'s placeholder so the two are indistinguishable — a mentor
     must not be able to tell that a supervisor route was retired underneath
     them. */
  return (
    <MentorShell active={fallbackActive}>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          {fallbackTitle}
        </h1>
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          Nothing here yet. When there&apos;s something new, it&apos;ll show up
          here.
        </p>
      </div>
    </MentorShell>
  );
}

const cnLink =
  `rounded-full px-3 py-1.5 text-[14px] font-semibold leading-[20px] text-[var(--text-primary)] ` +
  `underline decoration-[color:var(--border-contour)] underline-offset-2 transition-colors ` +
  `hover:bg-[var(--tint-hover)] ${RING}`;
