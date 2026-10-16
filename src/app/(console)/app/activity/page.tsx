"use client";

// Activity — static route, wins over /app/[section]. TWO SURFACES, ONE ROUTE.
//
// ONE ROUTE BY INSTRUCTION: the recon found an Activity item already present in
// BOTH sidebars (mentor and supervisor), so a second route would have meant two
// pages behind one nav item. Instead this page branches on the viewing persona:
//
//   · SUPERVISOR TIER → the Activity LEDGER (components/activity), a cross-teen
//     operational feed with saved views, day grouping and a per-viewer read
//     overlay.
//   · MENTOR / LEAD    → the EXISTING profile-update feed, byte-for-byte
//     unchanged below. Standing rule 7: add alongside, do not modify. Its
//     page-level read receipt, its row copy and its deep links are untouched.
//
// The mentor feed (PUR §4.4) carries the profile-update-review entries. Entries
// are marked read on arrival (the sidebar badge counts unread), and each row
// deep-links to the settings tab that hosts the field.

import { use, useEffect } from "react";
import { AppChrome } from "@/components/app-shell/app-chrome";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isMentorVisibleActivity } from "@/lib/onboarding/profile-update";
import { gatedFieldMeta, relTime } from "@/lib/onboarding/profile-update";
import { accountFieldLabel } from "@/lib/record/account-fields";
import { useMounted } from "@/lib/use-mounted";
import { ActivityLedger } from "@/components/activity/activity-ledger";
import { isSupervisorTier } from "@/lib/record/permission-map";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// §6 copy — requested: 1 field names the field; several counts them.
function entryText(item: ActivityItem): string {
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
function entryHref(item: ActivityItem): string {
  // Account lives on the user record (self-view) now.
  if (item.type === "staff_account_edit") return "/app/profile?tab=account";
  if (item.type === "profile_unpublished" || item.type === "profile_republished")
    return "/app/profile?tab=profile";
  const surface = gatedFieldMeta(item.fieldIds[0])?.surface;
  return surface ? `/app/profile?tab=${surface}` : "/app/profile";
}

export default function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // use(searchParams) PROP PATTERN — never useSearchParams, and no page-root
  // Suspense (standing rule 3).
  const query = use(searchParams);
  // A8's object-scoped deep link: /app/activity?objectId=<teenId>&domain=billing.
  // The Teens list's billing code points here, because the append-only ledger IS
  // the code's history.
  const objectId = typeof query.objectId === "string" ? query.objectId : null;
  const domain = typeof query.domain === "string" ? query.domain : null;
  /** `?scope=mine|team`. B2's deep-link contract: scope picks the rail, domain
   *  picks the filter. Read through `use(searchParams)` like everything else on
   *  this page — never `useSearchParams` (standing rule 3). */
  const scope = typeof query.scope === "string" ? query.scope : null;
  /** `?event=<eventId>` — B3's handover link. Restores the selected row; the
   *  scope and filters restore from their own params. */
  const eventId = typeof query.event === "string" ? query.event : null;
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const activity = useOnboardingStore((s) => s.activity);
  const markActivityRead = useOnboardingStore((s) => s.markActivityRead);

  // SUPERVISOR TIER GETS THE LEDGER. Gated behind `mounted` like every other
  // store read on this page: persona lives in persisted state, so branching on it
  // before hydration would render the mentor feed for one frame and then swap —
  // a mismatch that produces no console error at all.
  const supervisor = mounted && isSupervisorTier(persona);

  // Arriving here clears the sidebar badge (§4.4) — read receipts are
  // page-level, not per-row. MENTOR FEED ONLY: the ledger has its own per-row,
  // per-scope overlay (standing rules 9 and 10) and must not be blanket-marked.
  useEffect(() => {
    if (mounted && !supervisor) markActivityRead();
  }, [mounted, supervisor, markActivityRead]);

  const items = mounted
    ? activity
        .filter(isMentorVisibleActivity)
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];

  if (supervisor) {
    return (
      <AppChrome active="activity">
        <ActivityLedger
          initialTeenId={objectId}
          initialDomain={domain}
          initialScope={scope}
          initialEventId={eventId}
        />
      </AppChrome>
    );
  }

  return (
    <AppChrome active="activity">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          Activity
        </h1>

        {items.length === 0 ? (
          <div className="mt-4 flex min-h-[40vh] items-center justify-center">
            <p className="max-w-sm text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Nothing here yet. When there&apos;s something new, it&apos;ll show
              up here.
            </p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-s0)]">
            {items.map((item) => {
              const requested = item.type === "profile_changes_requested";
              return (
                <li key={item.id}>
                  <Link
                    href={entryHref(item)}
                    className={cn(
                      "flex min-h-11 items-center gap-3.5 px-[var(--card-pad)] py-4 transition-colors hover:bg-[var(--tint-faint)]",
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
    </AppChrome>
  );
}
