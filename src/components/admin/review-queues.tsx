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
// Store-driven: this prototype models ONE reviewable mentor, so each queue is
// either empty or holds that person.

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
  "mt-6 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]";
const HEAD =
  "flex items-center justify-between border-b border-[var(--surface-s2)] px-5 py-3";
const COUNT =
  "flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground";
const AVATAR =
  "flex size-11 items-center justify-center overflow-hidden rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground";

export function ReviewQueues() {
  const mounted = useMounted();
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);

  const liveName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";
  const needsReview = mounted && status === "in_review";
  const update = mounted ? profileUpdate : null;
  const updateFlagged = update?.status === "changes-requested";

  return (
    <>
      <section className={SECTION} aria-label="Needs review">
        <div className={HEAD}>
          <h2 className="text-sm font-semibold">Needs review</h2>
          <span className={COUNT}>{needsReview ? 1 : 0}</span>
        </div>
        {needsReview ? (
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
        ) : (
          <p className="px-5 py-5 text-sm text-[var(--text-secondary)]">
            Nothing waiting for review right now.
          </p>
        )}
      </section>

      <section className={SECTION} aria-label="Profile updates">
        <div className={HEAD}>
          <h2 className="text-sm font-semibold">Profile updates</h2>
          <span className={COUNT}>{update && !updateFlagged ? 1 : 0}</span>
        </div>
        {update ? (
          <div
            className={cn(
              "flex items-center gap-4 px-5 py-4",
              updateFlagged && "opacity-70"
            )}
          >
            <span className={AVATAR}>{initials(liveName)}</span>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{liveName}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {changesetSummary(update)} · {relTime(update.updatedAt)}
              </p>
            </div>
            <span
              className={cn(
                "ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                updateFlagged
                  ? "border border-[color:var(--alert-warm-border)] text-[var(--alert-warm-fg)]"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {updateFlagged ? "Changes requested" : "Pending"}
            </span>
            <Button
              asChild
              variant={updateFlagged ? "outline" : "default"}
              className="ml-auto"
            >
              <Link href="/admin/mentor?focus=review">
                {updateFlagged ? "View" : "Review"}
              </Link>
            </Button>
          </div>
        ) : (
          <p className="px-5 py-5 text-sm text-[var(--text-secondary)]">
            No profile updates waiting.
          </p>
        )}
      </section>
    </>
  );
}
