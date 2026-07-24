"use client";

// Mentor settings. Tabs are driven by the §3 registry (order + role
// visibility) — never hardcoded (Phase 2; re-keyed in Phase 9, decision #10):
// Profile = the teen-facing editor (Match card + Chat groups, review-gated);
// Account = locked personal details + phone/email change flows; First moments
// and Schedule unchanged. Only opens once the mentor is published.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { MatchingProfileEditor } from "@/components/profile-editor/matching-profile-editor";
import { FirstMomentsEditor } from "@/components/profile-editor/first-moments-editor";
import { SettingsTabBar } from "@/components/settings/tab-bar";
import {
  LEGACY_TAB_ALIASES,
  roleForPersona,
  tabsForRole,
  type SettingsRole,
} from "@/components/settings/tabs-config";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

export default function MentorProfileSettings({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mounted = useMounted();
  const router = useRouter();
  // The page's searchParams prop (a Promise in this Next version, unwrapped
  // with React's use()) — NOT useSearchParams: that hook demands a Suspense
  // boundary on prerendered routes, and a page-root <Suspense> silently
  // breaks hard-load hydration here. The prop opts the route into dynamic
  // rendering and re-renders with fresh values on client-side navs.
  const query = use(searchParams);
  const persona = useOnboardingStore((s) => s.persona);
  const everPublished = useOnboardingStore((s) => s.publishedSnapshot !== null);
  // First registry tab (Profile) is the default view. Deep link (?tab=profile
  // etc.) — activity rows land on the tab hosting the flagged field; legacy
  // pre-Phase-9 ids ("matching") resolve via the alias map. URL changes
  // re-apply via the render-time state-adjust pattern below.
  const rawTab = typeof query.tab === "string" ? query.tab : null;
  const aliasedTab = rawTab ? (LEGACY_TAB_ALIASES[rawTab] ?? rawTab) : null;
  const queryTab =
    aliasedTab && tabsForRole("mentor").some((t) => t.id === aliasedTab)
      ? aliasedTab
      : null;
  const [tab, setTab] = useState<string>(
    queryTab ?? tabsForRole("mentor")[0].id
  );
  const [prevQueryTab, setPrevQueryTab] = useState(queryTab);
  if (queryTab !== prevQueryTab) {
    setPrevQueryTab(queryTab);
    if (queryTab) setTab(queryTab);
  }

  // §4 Phase 10: role derives from the dev persona (roleForPersona); the
  // Supervisor console still reaches this page with ?role=supervisor (legacy
  // ?role=admin aliased) — the query wins so console links work regardless of
  // the toggle's persona. Registry role-filtering does the actual gating.
  const roleParam = typeof query.role === "string" ? query.role : null;
  const role: SettingsRole = !mounted
    ? "mentor"
    : roleParam === "supervisor" || roleParam === "admin"
      ? "supervisor"
      : roleForPersona(persona);
  // Clamp the active tab to the role's tab set. Lead Mentors have NO tabs here
  // now (their account moved to Settings) — they're redirected below; guard
  // against the empty set so the pre-redirect render can't crash.
  const allowedTabs = tabsForRole(role);
  const effectiveTab = allowedTabs.some((t) => t.id === tab)
    ? tab
    : (allowedTabs[0]?.id ?? tab); // empty set (Lead) returns early below
  // Deep link: which section/row to open on arrival (sidebar avatar → its
  // persona's photo editor). Editors handle their own ids.
  const openParam = typeof query.open === "string" ? query.open : null;

  // Deep-link redirects (evaluated post-mount so role is settled):
  //  • record-04b: staff "permissions" links live on the Mentor Record.
  //  • settings-02: Account moved to the universal Settings surface — every
  //    ?tab=account (and mentor ?tab=permissions, which aliases to account)
  //    redirects there. Lead Mentors have no teen-facing profile at all, so
  //    the whole page redirects them to their account in Settings.
  //  • settings-03: Schedule moved to Settings › Availability ("Online hours").
  useEffect(() => {
    if (!mounted) return;
    if (rawTab === "permissions" && role !== "mentor") {
      router.replace("/admin/mentor");
    } else if (aliasedTab === "account") {
      router.replace("/app/settings?section=account");
    } else if (aliasedTab === "schedule") {
      router.replace("/app/settings?section=availability");
    } else if (role === "lead") {
      router.replace("/app/settings?section=account");
    }
  }, [mounted, rawTab, aliasedTab, role, router]);

  if (!mounted) {
    return (
      <MentorShell active="home">
        <div className="min-h-dvh" />
      </MentorShell>
    );
  }

  // Roles with no profile tabs (Lead Mentor) are being redirected to Settings
  // by the effect above — render a quiet shell until the replace lands.
  if (allowedTabs.length === 0) {
    return (
      <MentorShell active="home">
        <div className="min-h-dvh" />
      </MentorShell>
    );
  }

  // This screen only exists once the mentor has been published.
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

  return (
    <MentorShell active="home">
      <div className="mx-auto w-full max-w-6xl px-6 py-6 lg:px-10">
        <SettingsTabBar
          role={role}
          activeId={effectiveTab}
          onChange={setTab}
          className="mb-6"
        />

        {effectiveTab === "profile" && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Your profile
            </h1>
            <p className="mt-2 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Everything teens see, in one place — your match card and your
              chat. Open a section to edit it; the preview shows exactly what
              teens get.
            </p>
            <div className="mt-6">
              <MatchingProfileEditor initialOpen={openParam} />
            </div>
          </div>
        )}

        {effectiveTab === "first-moments" && (
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
      </div>
    </MentorShell>
  );
}
