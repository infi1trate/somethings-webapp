"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A MENTOR'S ACTIVITY — profile and account notices (moved, 2026-10-16)
//
// This list was the mentor branch of `/app/activity`. Activity moved into the
// top bar's bell, so it lives here and the bell renders it; the copy, links and
// ordering are unchanged. Supervisors and admins get the ledger instead
// (`ActivityLedger variant="popover"`).

import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { gatedFieldMeta, isMentorVisibleActivity, relTime } from "@/lib/onboarding/profile-update";
import { accountFieldLabel } from "@/lib/record/account-fields";
import { useMounted } from "@/lib/use-mounted";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function entryText(item: ActivityItem): string {
  if (item.type === "profile_update_live") {
    return "Your profile changes are live.";
  }
  if (item.type === "profile_unpublished") {
    return "The Somethings team hid your profile from teens for now.";
  }
  if (item.type === "profile_republished") {
    return "Your profile is visible to teens again.";
  }
  if (item.type === "staff_account_edit") {
    // record-04a: staff-attributed — the mentor sees WHAT changed and that
    // the team (not they) changed it.
    return `The Somethings team updated your ${accountFieldLabel(item.fieldIds[0])}.`;
  }
  if (item.fieldIds.length === 1) {
    const noun = gatedFieldMeta(item.fieldIds[0])?.noun ?? "profile";
    return `The review team requested a change to your ${noun}.`;
  }
  return `The review team requested changes to ${item.fieldIds.length} of your profile changes.`;
}

// Deep link: the settings tab hosting the first named field.
export function entryHref(item: ActivityItem): string {
  // Account lives on the user record (self-view) now.
  if (item.type === "staff_account_edit") return "/app/profile?tab=account";
  if (item.type === "profile_unpublished" || item.type === "profile_republished")
    return "/app/profile?tab=profile";
  const surface = gatedFieldMeta(item.fieldIds[0])?.surface;
  return surface ? `/app/profile?tab=${surface}` : "/app/profile";
}


/** The visible notices, newest first — the same filter the rail's unread
 *  badge counts, so the bell's badge and its list agree. */
export function useMentorActivity(): ActivityItem[] {
  const mounted = useMounted();
  const activity = useOnboardingStore((s) => s.activity);
  return mounted
    ? activity.filter(isMentorVisibleActivity).sort((a, b) => b.createdAt - a.createdAt)
    : [];
}

export function MentorActivityList({ onNavigate, quietWhenEmpty = false }: { onNavigate?: () => void; /** Something else in the bell is showing (pack v5.0): no empty state under it. */ quietWhenEmpty?: boolean }) {
  const items = useMentorActivity();
  if (items.length === 0) {
    if (quietWhenEmpty) return null;
    return (
      <p className="px-4 py-8 text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {/* TODO-COPY */}
        Nothing here yet. When there&apos;s something new, it&apos;ll show up here.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--border-subtle)]">
      {items.map((item) => {
        const requested = item.type === "profile_changes_requested";
        return (
          <li key={item.id}>
            <Link
              href={entryHref(item)}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {requested ? (
                /* MOVED VERBATIM. A raw Tailwind palette colour, not a token —
                   flagged for the colour-token series rather than changed in a
                   move. */
                <AlertCircle className="size-5 shrink-0 text-orange-600" aria-hidden />
              ) : (
                <CheckCircle2 className="size-5 shrink-0 text-[var(--text-secondary)]" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-[20px] text-[var(--text-primary)]">
                  {entryText(item)}
                </span>
                <span className="mt-0.5 block text-[12px] leading-[16px] text-[var(--text-muted)]">
                  {relTime(item.createdAt)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
