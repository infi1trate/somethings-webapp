"use client";

// REVIEW QUEUES — the lead/supervisor review inbox: profiles submitted for
// review, and pending profile updates.
//
// Extracted from roster.tsx when the Mentors roster merged into Team. These
// queues were living inside that roster, so folding the roster away would have
// silently removed the lead's review entry point (and the review console still
// returns here). Now both surfaces mount the same component and the flow
// survives the nav change.
//
// ACTION-ONLY: a queue renders ONLY when it holds something the viewer has to
// act on. No empty states, no zero counts — with nothing waiting the whole
// inbox renders nothing and Team is just the directory. Defaults whisper.
//
// That deliberately excludes a CHANGES-REQUESTED update: the lead already
// reviewed it and the ball is with the mentor, so it's tracking, not a task —
// which is why the count badge always scored it zero. It stays visible where it
// belongs: the mentor's record and the profile-update review screen.
//
// Store-driven: this prototype models ONE reviewable mentor, so each queue is
// either empty or holds that person. The count badge is kept because a real
// queue holds many; the per-row status pill is not, because with only the
// actionable state rendering here it could only ever read "Pending".

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { changesetSummary, relTime } from "@/lib/onboarding/profile-update";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const SECTION =
  "overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]";
const HEAD =
  "flex items-center justify-between border-b border-[var(--surface-s2)] px-5 py-3";
const COUNT =
  "flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground";
const AVATAR =
  "flex size-11 items-center justify-center overflow-hidden rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground";

export function ReviewQueues({
  /** Outer spacing. Lives on the root, not a wrapper — the component renders
   *  NOTHING when nothing needs acting on, and a wrapper would leave its
   *  margin behind on an empty inbox. Team omits it (its own space-y owns the
   *  rhythm); the roster passes mt-6 to clear the filter bar above. */
  className,
}: {
  className?: string;
}) {
  const mounted = useMounted();
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);

  const liveName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";
  const needsReview = mounted && status === "in_review";
  // Only a PENDING changeset is a task — see the changes-requested note above.
  const pendingUpdate =
    mounted && profileUpdate?.status === "pending" ? profileUpdate : null;

  // Nothing waiting on the viewer → render nothing. Not an empty state.
  if (!needsReview && !pendingUpdate) return null;

  return (
    <div className={cn("space-y-6", className)}>
      {needsReview && (
        <section className={SECTION} aria-label="Needs review">
          <div className={HEAD}>
            <h2 className="text-sm font-semibold">Needs review</h2>
            <span className={COUNT}>1</span>
          </div>
          <div className="flex items-center gap-4 px-5 py-4">
            <span className={AVATAR}>{initials(liveName)}</span>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{liveName}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Mentor · submitted for review
              </p>
            </div>
            <Button asChild className="ml-auto">
              <Link href="/admin/review">Review</Link>
            </Button>
          </div>
        </section>
      )}

      {pendingUpdate && (
        <section className={SECTION} aria-label="Profile updates">
          <div className={HEAD}>
            <h2 className="text-sm font-semibold">Profile updates</h2>
            <span className={COUNT}>1</span>
          </div>
          <div className="flex items-center gap-4 px-5 py-4">
            <span className={AVATAR}>{initials(liveName)}</span>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{liveName}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {changesetSummary(pendingUpdate)} ·{" "}
                {relTime(pendingUpdate.updatedAt)}
              </p>
            </div>
            <Button asChild className="ml-auto">
              <Link href="/admin/mentor?focus=review">Review</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
