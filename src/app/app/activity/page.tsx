"use client";

// Activity feed (PUR §4.4) — static route, wins over /app/[section]. Today it
// carries only the profile-update-review entries; other activity types land
// here later. Entries are marked read on arrival (the sidebar badge counts
// unread), and each row deep-links to the settings tab that hosts the field.

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { gatedFieldMeta, relTime } from "@/lib/onboarding/profile-update";
import { useMounted } from "@/lib/use-mounted";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// §6 copy — requested: 1 field names the field; several counts them.
function entryText(item: ActivityItem): string {
  if (item.type === "profile_update_live") {
    return "Your profile changes are live.";
  }
  if (item.fieldIds.length === 1) {
    const noun = gatedFieldMeta(item.fieldIds[0])?.noun ?? "profile";
    return `The review team requested a change to your ${noun}.`;
  }
  return `The review team requested changes to ${item.fieldIds.length} of your profile changes.`;
}

// Deep link: the settings tab hosting the first named field.
function entryHref(item: ActivityItem): string {
  const surface = gatedFieldMeta(item.fieldIds[0])?.surface;
  return surface ? `/app/profile?tab=${surface}` : "/app/profile";
}

export default function ActivityPage() {
  const mounted = useMounted();
  const activity = useOnboardingStore((s) => s.activity);
  const markActivityRead = useOnboardingStore((s) => s.markActivityRead);

  // Arriving here clears the sidebar badge (§4.4) — read receipts are
  // page-level, not per-row.
  useEffect(() => {
    if (mounted) markActivityRead();
  }, [mounted, markActivityRead]);

  const items = mounted ? [...activity].sort((a, b) => b.createdAt - a.createdAt) : [];

  return (
    <MentorShell active="activity">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          Activity
        </h1>

        {items.length === 0 ? (
          <p className="mt-4 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            Nothing here yet. When there&apos;s something new, it&apos;ll show
            up here.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
            {items.map((item) => {
              const requested = item.type === "profile_changes_requested";
              return (
                <li key={item.id}>
                  <Link
                    href={entryHref(item)}
                    className={cn(
                      "flex min-h-11 items-center gap-3.5 px-[var(--card-pad)] py-4 transition-colors hover:bg-black/[0.02]",
                      RING
                    )}
                  >
                    {requested ? (
                      <AlertCircle
                        className="size-5 shrink-0 text-orange-600"
                        aria-hidden
                      />
                    ) : (
                      <CheckCircle2
                        className="size-5 shrink-0 text-[var(--text-secondary)]"
                        aria-hidden
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-[20px] text-[var(--text-primary)]">
                        {entryText(item)}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-[16px] text-[var(--text-muted)]">
                        {relTime(item.createdAt)}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-[var(--text-muted)]"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MentorShell>
  );
}
