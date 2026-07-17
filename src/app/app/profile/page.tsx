"use client";

// Mentor settings. Tabs are driven by the §3 registry (order + role
// visibility) — never hardcoded (Phase 2). Profile = direct-save account
// basics; Matching profile = the review-loop editor (untouched); Schedule +
// Mentorships land in later phases. Only opens once the mentor is published.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { MatchingProfileEditor } from "@/components/profile-editor/matching-profile-editor";
import { FirstMomentsEditor } from "@/components/profile-editor/first-moments-editor";
import { ProfileSettingsEditor } from "@/components/profile-editor/profile-settings-editor";
import { RolesPermissionsEditor } from "@/components/profile-editor/roles-permissions-editor";
import { SettingsTabBar } from "@/components/settings/tab-bar";
import { tabsForRole, type SettingsRole } from "@/components/settings/tabs-config";
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

export default function MentorProfileSettingsPage() {
  const mounted = useMounted();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const everPublished = useOnboardingStore((s) => s.publishedSnapshot !== null);
  // First registry tab (Profile) is the default view.
  const [tab, setTab] = useState<string>(() => tabsForRole("mentor")[0].id);
  const [profileDirty, setProfileDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // §4: role-aware surface. The DEV toggle's Admin side reaches this page with
  // ?role=admin (see /admin/users → mentor row). Registry role-filtering does
  // the actual gating: tabsForRole("mentor") never includes permissions.
  const role: SettingsRole =
    mounted &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("role") === "admin"
      ? "admin"
      : "mentor";

  // §6 unsaved-changes guard: switching away from a dirty Profile tab prompts
  // inline (never a browser alert). Other tabs keep their own dirty models —
  // the Matching tab's edits live in the persisted store, so nothing is lost
  // when leaving it.
  const requestTab = (next: string) => {
    if (tab === "profile" && next !== "profile" && profileDirty) {
      setPendingTab(next);
      return;
    }
    setTab(next);
  };
  const leaveWithoutSaving = () => {
    if (pendingTab) setTab(pendingTab);
    setProfileDirty(false); // the editor unmounts; its local edits are gone
    setPendingTab(null);
  };

  if (!mounted) {
    return (
      <MentorShell active="home">
        <div className="min-h-dvh" />
      </MentorShell>
    );
  }

  // This screen only exists once the mentor has been published (it then stays
  // available through post-publish in_review / rejected states).
  if (!everPublished) {
    return (
      <MentorShell active="home">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold">Not available yet</h1>
          <p className="text-sm text-muted-foreground">
            Your profile settings open up once your profile is approved and live.
          </p>
          <Button variant="outline" onClick={() => router.push("/app")}>
            Back to home
          </Button>
        </div>
      </MentorShell>
    );
  }

  const name = draft.firstName?.trim();

  return (
    <MentorShell active="home">
      <div className="mx-auto w-full max-w-6xl px-6 py-6 lg:px-10">
        <SettingsTabBar
          role={role}
          activeId={tab}
          onChange={requestTab}
          className="mb-6"
        />

        {tab === "profile" && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Profile
            </h1>
            <p className="mt-2 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Your account basics. Teens see two of these: your photo — it&apos;s
              your avatar in chats — and your pronouns.
            </p>
            <div className="mt-5 max-w-3xl">
              <ProfileSettingsEditor onDirtyChange={setProfileDirty} />
            </div>
          </div>
        )}

        {tab === "matching" && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {name
                ? `Editing ${name}'s Matching Profile`
                : "Editing your Matching Profile"}
            </h1>
            <p className="mt-2 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Open a section to edit it — every change updates the live preview on
              the right, exactly what teens see.
            </p>
            <div className="mt-6">
              <MatchingProfileEditor />
            </div>
          </div>
        )}

        {tab === "first-moments" && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              First moments
            </h1>
            <p className="mt-2 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
              What teens get the first time they open your chat — your first
              messages, then your story.
            </p>
            <div className="mt-6">
              <FirstMomentsEditor />
            </div>
          </div>
        )}

        {tab === "schedule" && (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            Scheduling — block out time off and vacations against your set
            schedule. Coming in a later milestone.
          </div>
        )}

        {tab === "permissions" && role === "admin" && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Roles &amp; permissions
            </h1>
            <p className="mt-2 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Review pending profile changes, manage matching capacity, and
              control this mentor&apos;s account status.
            </p>
            <div className="mt-5">
              <RolesPermissionsEditor />
            </div>
          </div>
        )}
      </div>

      {/* Unsaved-changes guard (§6) — inline prompt, not a browser alert. */}
      <Dialog
        open={pendingTab !== null}
        onOpenChange={(open) => !open && setPendingTab(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              You have unsaved changes on your Profile. They&apos;ll be lost if
              you switch tabs now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setPendingTab(null)}>
              Stay
            </Button>
            <Button className="min-h-11" onClick={leaveWithoutSaving}>Leave without saving</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MentorShell>
  );
}
