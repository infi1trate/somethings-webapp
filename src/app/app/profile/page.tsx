"use client";

// Mentor self-view — the mentor's own USER RECORD, on the shared UserRecordShell
// (viewer = { role:'mentor', isSelf:true }). Flattens the old "Your profile" →
// "Profile" → "Chat" recursion: an identity header (the mentor's name is the
// focal point) over PEER tabs — Profile · First moments · Schedule · Account.
// Account is home from Settings (read-mostly); Schedule holds online-hours.
// Warm, never supervisory: no capacity counts, no attention alert, no Notes.
// The Profile tab's editor keeps its own live phone Preview (behavior identical
// to before) — the shell's formal rail slot is reserved for the staff follow-up.

import { use, useEffect, useState } from "react";
import { AppChrome } from "@/components/app-shell/app-chrome";
import { useRouter } from "next/navigation";
import {
  UserRecordShell,
  type UserRecordTab,
} from "@/components/record/user-record-shell";
import { MatchingProfileEditor } from "@/components/profile-editor/matching-profile-editor";
import { FirstMomentsEditor } from "@/components/profile-editor/first-moments-editor";
import { AccountEditor } from "@/components/profile-editor/account-editor";
import { ActiveHoursEditor } from "@/components/record/active-hours";
import { LEGACY_TAB_ALIASES } from "@/components/settings/tabs-config";
import { MEMBERSHIP_GROUPS, JOIN_DATE } from "@/components/record/organization";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { useMounted } from "@/lib/use-mounted";

const SELF_TABS: UserRecordTab[] = [
  { id: "profile", label: "Profile" },
  { id: "first-moments", label: "First moments" },
  { id: "schedule", label: "Schedule" },
  { id: "account", label: "Account" },
];

const INTRO =
  "mt-1 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]";

export default function MentorSelfRecord({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mounted = useMounted();
  const router = useRouter();
  // use(searchParams) prop pattern (invariant 5 — never useSearchParams; no
  // page-root Suspense). Re-renders with fresh values on client-side navs.
  const query = use(searchParams);
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const publishedSnapshot = useOnboardingStore((s) => s.publishedSnapshot);
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  const everPublished = publishedSnapshot !== null;

  const rawTab = typeof query.tab === "string" ? query.tab : null;
  const aliasedTab = rawTab ? (LEGACY_TAB_ALIASES[rawTab] ?? rawTab) : null;
  const queryTab = SELF_TABS.some((t) => t.id === aliasedTab) ? aliasedTab : null;
  const openParam = typeof query.open === "string" ? query.open : null;

  const [tab, setTab] = useState<string>(queryTab ?? "profile");
  const [prevQueryTab, setPrevQueryTab] = useState(queryTab);
  if (queryTab !== prevQueryTab) {
    setPrevQueryTab(queryTab);
    if (queryTab) setTab(queryTab);
  }

  // §6 unsaved-changes guard on the Account tab (its rows hold in-progress
  // edits) — leaving a dirty Account prompts inline instead of dropping them.
  const [accountDirty, setAccountDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // ═══ THE GUARD NOW COVERS EVERY WAY OUT, NOT JUST A TAB CHANGE ═══
  //
  // `pendingTab` handles the in-page tab switch and always did. `pendingExit`
  // handles the three paths that previously dropped edits in silence: a nav
  // link (the Phase 2 bottom bar, the rail, the More sheet), browser Back and
  // swipe-back, and reload/close. See `use-unsaved-changes-guard.ts` for why
  // each needs a different mechanism.
  //
  // `null` in `pendingExit` means BACK — there is no href to resume, so
  // confirming pops history rather than pushing a destination.
  const [pendingExit, setPendingExit] = useState<
    { href: string | null } | null
  >(null);

  const dirtyOnAccount = tab === "account" && accountDirty;
  useUnsavedChangesGuard({
    when: dirtyOnAccount,
    onBlocked: (href) => setPendingExit({ href }),
  });

  const applyTab = (id: string) => {
    setTab(id);
    router.replace(`/app/profile?tab=${id}`, { scroll: false });
  };
  const requestTab = (id: string) => {
    if (tab === "account" && id !== "account" && accountDirty) {
      setPendingTab(id);
      return;
    }
    applyTab(id);
  };
  const leaveWithoutSaving = () => {
    const next = pendingTab;
    setAccountDirty(false);
    setPendingTab(null);
    if (next) applyTab(next);
  };
  /** Confirming an EXIT (not a tab change). Clearing `accountDirty` first tears
   *  the guard's listeners down, so the navigation below is not re-intercepted
   *  by the very hook that paused it. */
  const leaveThePage = () => {
    const target = pendingExit?.href ?? null;
    setAccountDirty(false);
    setPendingExit(null);
    // Deferred a tick so the guard's cleanup (which returns its history
    // sentinel) runs before we navigate, rather than racing it.
    setTimeout(() => {
      if (target) router.push(target);
      else router.back();
    }, 0);
  };

  // Only the mentor's OWN record is wired this pass; other personas have no
  // self-view yet — send them to home (scaffold).
  const isMentorPersona =
    !mounted || persona === "mentor" || persona === "new-mentor";
  useEffect(() => {
    if (mounted && !isMentorPersona) router.replace("/app");
  }, [mounted, isMentorPersona, router]);

  if (!mounted || !isMentorPersona) {
    return (
      <AppChrome active="home">
        <div className="min-h-dvh" />
      </AppChrome>
    );
  }

  /* ═══ THE RECORD NO LONGER WAITS FOR APPROVAL (addendum §2.6) ═══
   *
   *  This returned "Not available yet · Your record opens up once your profile
   *  is approved and live" whenever `publishedSnapshot === null`. The avatar →
   *  account popover → Profile path led here, so a mentor who had not been
   *  published had a route to their own record and a dead end at the end of it.
   *
   *  ═══ IT WAS AN APPROVAL CHECK DOING A PERMISSION CHECK'S JOB ═══
   *
   *  `everPublished` answers "can teens see this person", which is a real and
   *  necessary question — it gates the PUBLIC profile. It was being asked about
   *  the SELF view, where it answers nothing: the draft exists from the first
   *  onboarding step, every tab on this page edits the draft, and the editors
   *  were already reachable from Settings while this page refused to show them.
   *
   *  WHAT REPLACES IT IS A STATUS, NOT A GATE. `statusText` below already
   *  distinguishes the states, so an unpublished mentor sees their record with
   *  it labelled unpublished — which is the true thing, and the thing the old
   *  sentence was trying to say by withholding the page. The one case this does
   *  NOT change is what teens see: nothing here publishes anything.
   *
   *  (`everPublished` is still read — see `statusText`.) */

  // ── Identity ──────────────────────────────────────────────────────────────
  const firstName = draft.firstName?.trim() ?? "";
  const lastName = draft.lastName?.trim() ?? "";
  const name =
    `${firstName} ${lastName}`.trim() || draft.displayName?.trim() || "You";
  const avatarSrc = publishedSnapshot?.accountPhoto ?? draft.accountPhoto ?? null;
  const initial = (firstName[0] || "S").toUpperCase();
  const meta = [
    draft.pronouns.join(", "),
    MEMBERSHIP_GROUPS.join(", "),
    `Joined ${JOIN_DATE}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppChrome active="home">
      <UserRecordShell
        avatar={{ src: avatarSrc, initial }}
        name={name}
        role="mentor"
        // The viewer is in the app, so they are online by definition.
        /* ═══ THREE STATES, AND THEY ARE DIFFERENT FACTS ═══
           NEEDS-COPY-NICOLE on the first. Never published is not the same as
           published-then-hidden: one is waiting on a review, the other is a
           choice somebody made. Collapsing them would tell a mentor in review
           that they had hidden themselves. */
        statusText={
          !everPublished ? "Not published yet" : profileHidden ? "Unpublished" : undefined
        }
        statusAriaLabel={`Mentor, ${
          !everPublished ? "not published yet" : profileHidden ? "unpublished" : "active"
        }`}
        meta={meta}
        sectionsLabel="Profile sections"
        tabs={SELF_TABS}
        activeTab={tab}
        onTabChange={requestTab}
      >
        {tab === "profile" && (
          <div>
            <p className={INTRO}>
              Everything teens see on your match card, in one place. Open a
              section to edit it; the preview shows exactly what teens get.
            </p>
            <div className="mt-6">
              <MatchingProfileEditor initialOpen={openParam} />
            </div>
          </div>
        )}

        {tab === "first-moments" && (
          <div>
            {/* TODO-COPY. Dropped "then your story": the story is curated by a
                lead mentor or supervisor and the mentor doesn't see it, so
                naming it here would advertise content this tab can't open. */}
            <p className={INTRO}>
              What teens get the first time they open your chat.
            </p>
            <div className="mt-6">
              <FirstMomentsEditor />
            </div>
          </div>
        )}

        {tab === "schedule" && (
          <div className="max-w-3xl">
            <p className={INTRO}>Your active hours — when you&apos;re around for teens.</p>
            <div className="mt-5">
              <ActiveHoursEditor editable />
            </div>
          </div>
        )}

        {tab === "account" && (
          <div className="max-w-3xl">
            <p className={INTRO}>
              Your personal details, plus the phone and email you use for
              Somethings. Nothing here is shown to teens.
            </p>
            <div className="mt-5">
              <AccountEditor
                role="mentor"
                initialOpen={openParam}
                onDirtyChange={setAccountDirty}
              />
            </div>
          </div>
        )}
      </UserRecordShell>

      {/* Unsaved-changes guard (§6) — inline prompt, not a browser alert.
          ONE dialog for both kinds of departure: a tab change (`pendingTab`) and
          leaving the page entirely (`pendingExit`). The copy differs because the
          consequence differs — switching tabs keeps you on the page. */}
      <Dialog
        open={pendingTab !== null || pendingExit !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPendingTab(null);
          setPendingExit(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            {/* TODO-COPY */}
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              {pendingExit
                ? "You have unsaved changes on your Account. They\u2019ll be lost if you leave this page now."
                : "You have unsaved changes on your Account. They\u2019ll be lost if you switch tabs now."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setPendingTab(null);
                setPendingExit(null);
              }}
            >
              Stay
            </Button>
            <Button
              className="min-h-11"
              onClick={pendingExit ? leaveThePage : leaveWithoutSaving}
            >
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppChrome>
  );
}
