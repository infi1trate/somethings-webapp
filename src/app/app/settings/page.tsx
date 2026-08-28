"use client";

// Universal Settings — now PREFS ONLY (the IA restructure): how the app behaves
// for me, not who I am. Sections: Security, Notifications, Appearance, Language,
// Accessibility, Audio & video. Account (identity) and Availability (schedule)
// moved home to the user record (/app/profile) — this page redirects their old
// deep links there. Layout: inside the mentor app shell, a left section rail +
// the active section on the right; ?section= via the use(searchParams) prop
// pattern (invariant 5). Rail degrades to a top scroller on narrow (gaps #101).

import { use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { EdgeFades, useEdgeOverflow } from "@/components/ui/scroll-affordance";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { roleForPersona } from "@/components/settings/tabs-config";
import { settingsSectionsForRole } from "@/components/settings/settings-sections";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { DevSection } from "@/components/settings/dev-section";
import { SecuritySection } from "@/components/settings/security-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import {
  BeingSetUp,
  ComingSoonSection,
} from "@/components/settings/section-placeholders";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-[var(--surface-pad-y)]";

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mounted = useMounted();
  const router = useRouter();
  const persona = useOnboardingStore((s) => s.persona);
  const query = use(searchParams);

  const rawSection = typeof query.section === "string" ? query.section : null;

  // Account + Availability moved to the user record — retarget their old deep
  // links (flips the settings-02/03 moves).
  const movedTo =
    rawSection === "account"
      ? "/app/profile?tab=account"
      : rawSection === "availability"
        ? "/app/profile?tab=schedule"
        : null;
  useEffect(() => {
    if (mounted && movedTo) router.replace(movedTo);
  }, [mounted, movedTo, router]);

  // Role gates the section set (identical across roles today). Pre-mount
  // defaults to mentor; the list is the same, so there's no hydration flip.
  const role = mounted ? roleForPersona(persona) : "mentor";
  const navScrollRef = useRef<HTMLElement | null>(null);
  const navEdges = useEdgeOverflow(navScrollRef);
  // The Dev section appears ONLY while the dev bar is hidden — it exists to
  // bring it back. Pre-mount this reads its default (`false`), so the section is
  // absent on the server and appears after rehydration: the same shape as the
  // role gate above, and it cannot flip a section the reader was already on
  // because the only way to reach it is for the flag to already be true.
  const devBarHidden = useOnboardingStore((st) => st.devBarHidden);
  const sections = settingsSectionsForRole(role, {
    devBarHidden: mounted && devBarHidden,
  });
  const active = sections.find((s) => s.id === rawSection) ?? sections[0];

  // Sections that render their own hairline card groups (heading above them).
  const isFormSection =
    active.id === "security" || active.id === "notifications";

  const go = (id: string) => router.push(`/app/settings?section=${id}`);

  if (mounted && movedTo) {
    return (
      <MentorShell active="settings">
        <div className="min-h-dvh" />
      </MentorShell>
    );
  }

  return (
    <MentorShell active="settings">
      <div className="px-6 py-6 lg:px-10">
        <h1
          className="text-[var(--text-primary)]"
          style={{
            font: "var(--type-display)",
            letterSpacing: "var(--type-display-tracking)",
          }}
        >
          Settings
        </h1>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row">
          {/* Section rail — top scroller on narrow, left column at sm+.
              
              ═══ THE PATTERN IS KEPT; THE INDICATOR IS ADDED (Phase 6) ═══
              
              The scroller/sidebar switch is right and stays. What it lacked is
              the affordance: below `sm` this is a horizontally scrolling row of
              six chips whose native scrollbar appears only on hover on macOS and
              never on touch — so on a phone there was nothing on screen saying
              four more sections existed past the edge. Same standard the record
              tab strip was held to in Phase 3 (Nielsen #6).
              
              THE WRAPPER AND THE FADES ARE `sm:hidden`-scoped: above `sm` this is
              a vertical column that cannot overflow horizontally, and a fade
              there would be a permanent grey smudge marking nothing. */}
          <div className="relative min-w-0 sm:contents">
            <nav
              ref={navScrollRef}
              aria-label="Settings sections"
              className="-mx-1 flex gap-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:w-52 sm:shrink-0 sm:flex-col sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
            >
              {sections.map((s) => {
                const isActive = s.id === active.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-[14px] leading-[20px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
                      isActive
                        ? "bg-[var(--surface-card)] font-medium text-[var(--text-primary)]"
                        : "font-normal text-[var(--text-secondary)] hover:bg-[var(--surface-card)]/60 hover:text-[var(--text-primary)]",
                    )}
                  >
                    <s.icon className="size-4 shrink-0" aria-hidden />
                    {s.label}
                  </button>
                );
              })}
            </nav>
            <EdgeFades
              edges={navEdges}
              surface="var(--surface-s1)"
              className="sm:hidden"
            />
          </div>

          {/* Active section */}
          <div className="min-w-0 flex-1">
            {isFormSection ? (
              <div className="max-w-3xl">
                <h2
                  className="text-[var(--text-primary)]"
                  style={{ font: "var(--type-card-title)" }}
                >
                  {active.label}
                </h2>
                <p
                  className="mt-1 text-[var(--text-secondary)]"
                  style={{ font: "var(--type-row-label)" }}
                >
                  {active.description}
                </p>
                <div className="mt-5">
                  {active.id === "notifications" ? (
                    <NotificationsSection />
                  ) : (
                    <SecuritySection />
                  )}
                </div>
              </div>
            ) : (
              <section
                aria-label={active.label}
                className={cn(CARD, "max-w-[640px]")}
              >
                <h2
                  className="text-[var(--text-primary)]"
                  style={{ font: "var(--type-card-title)" }}
                >
                  {active.label}
                </h2>
                <p
                  className="mt-1 text-[var(--text-secondary)]"
                  style={{ font: "var(--type-row-label)" }}
                >
                  {active.description}
                </p>
                <div className="mt-4">
                  {active.id === "appearance" ? (
                    <AppearanceSection />
                  ) : active.id === "dev" ? (
                    <DevSection />
                  ) : active.status === "coming-soon" ? (
                    <ComingSoonSection />
                  ) : (
                    <BeingSetUp label={active.label} />
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </MentorShell>
  );
}
