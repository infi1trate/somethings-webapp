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
import { useRouter } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
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

  // Only the mentor's OWN record is wired this pass; other personas have no
  // self-view yet — send them to home (scaffold).
  const isMentorPersona =
    !mounted || persona === "mentor" || persona === "new-mentor";
  useEffect(() => {
    if (mounted && !isMentorPersona) router.replace("/app");
  }, [mounted, isMentorPersona, router]);

  if (!mounted || !isMentorPersona) {
    return (
      <MentorShell active="home">
        <div className="min-h-dvh" />
      </MentorShell>
    );
  }

  // The record only exists once the mentor is published.
  if (!everPublished) {
    return (
      <MentorShell active="home">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold">Not available yet</h1>
          <p className="text-sm text-muted-foreground">
            Your record opens up once your profile is approved and live.
          </p>
          <Button variant="outline" onClick={() => router.push("/app")}>
            Back to home
          </Button>
        </div>
      </MentorShell>
    );
  }

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
    <MentorShell active="home">
      <UserRecordShell
        avatar={{ src: avatarSrc, initial }}
        name={name}
        role="mentor"
        // The viewer is in the app, so they are online by definition.
        online
        statusText={profileHidden ? "Unpublished" : undefined}
        statusAriaLabel={`Mentor, ${profileHidden ? "unpublished" : "active"}`}
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
            <p className={INTRO}>
              What teens get the first time they open your chat — your first
              messages, then your story.
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

      {/* Unsaved-changes guard (§6) — inline prompt, not a browser alert. */}
      <Dialog
        open={pendingTab !== null}
        onOpenChange={(open) => !open && setPendingTab(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              You have unsaved changes on your Account. They&apos;ll be lost if
              you switch tabs now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setPendingTab(null)}
            >
              Stay
            </Button>
            <Button className="min-h-11" onClick={leaveWithoutSaving}>
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MentorShell>
  );
}
