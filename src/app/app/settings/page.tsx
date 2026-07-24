"use client";

// Universal Settings (settings-01/02) — the account-and-preferences surface.
// Layout: inside the mentor app shell, a left section rail + the active section
// on the right. The active section lives in the URL (?section=, deep-linkable)
// via the use(searchParams) prop pattern (invariant 5 — never useSearchParams,
// no page-root Suspense). Default account. Sections + order + status come from
// the registry, never hardcoded.
//
// settings-02: Account (moved out of /app/profile) and Security are the first
// built sections. Account reuses the AccountEditor composition verbatim
// (role-aware — mentors gate their photo, staff edit theirs directly); the
// left rail carries the §6 unsaved-changes guard the tab bar used to.
//
// Rail responsiveness: the app shell has no rail-collapse precedent
// (design-system-gaps.md #101), so the simplest honest degradation — the
// section rail is a horizontal top scroller on narrow, a left column at sm+.

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { roleForPersona } from "@/components/settings/tabs-config";
import { settingsSectionsForRole } from "@/components/settings/settings-sections";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { SecuritySection } from "@/components/settings/security-section";
import { AccountEditor } from "@/components/profile-editor/account-editor";
import {
  BeingSetUp,
  ComingSoonSection,
} from "@/components/settings/section-placeholders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  // Role gates the section set (identical for all in S1 — nothing hidden
  // yet). Pre-mount defaults to mentor; the list is the same across roles so
  // there's no hydration flip.
  const role = mounted ? roleForPersona(persona) : "mentor";
  const sections = settingsSectionsForRole(role);
  // Active section derived straight from the URL (stable on hard load;
  // updates on client navs) — no local state, so ?section= is deep-linkable
  // and hydration-safe.
  const rawSection = typeof query.section === "string" ? query.section : null;
  const active = sections.find((s) => s.id === rawSection) ?? sections[0];
  // Deep link: which row to open on arrival (e.g. the settings-04 avatar edit
  // → the Account photo row). The section editors handle their own ids.
  const openParam = typeof query.open === "string" ? query.open : null;

  // §6 unsaved-changes guard, hoisted from the old profile tab bar: leaving a
  // dirty Account section (rail nav) prompts inline instead of dropping edits.
  const [accountDirty, setAccountDirty] = useState(false);
  const [pendingSection, setPendingSection] = useState<string | null>(null);

  const go = (id: string) => router.push(`/app/settings?section=${id}`);
  const requestSection = (id: string) => {
    if (active.id === "account" && id !== "account" && accountDirty) {
      setPendingSection(id);
      return;
    }
    go(id);
  };
  const leaveWithoutSaving = () => {
    const next = pendingSection;
    setAccountDirty(false); // the editor unmounts on nav; its local edits are gone
    setPendingSection(null);
    if (next) go(next);
  };

  const isFormSection = active.id === "account" || active.id === "security";

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
          {/* Section rail — top scroller on narrow, left column at sm+. */}
          <nav
            aria-label="Settings sections"
            className="-mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:w-52 sm:shrink-0 sm:flex-col sm:overflow-visible sm:px-0"
          >
            {sections.map((s) => {
              const isActive = s.id === active.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => requestSection(s.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-[14px] leading-[20px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
                    isActive
                      ? "bg-[var(--surface-card)] font-medium text-[var(--text-primary)]"
                      : "font-normal text-[var(--text-secondary)] hover:bg-[var(--surface-card)]/60 hover:text-[var(--text-primary)]"
                  )}
                >
                  <s.icon className="size-4 shrink-0" aria-hidden />
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Active section */}
          <div className="min-w-0 flex-1">
            {isFormSection ? (
              // Account / Security own their own card groups — a section
              // header sits above them, no outer card (that would double-card).
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
                  {active.id === "account" ? (
                    <AccountEditor
                      role={role}
                      initialOpen={openParam}
                      onDirtyChange={setAccountDirty}
                    />
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

      {/* Unsaved-changes guard (§6) — inline prompt, not a browser alert. */}
      <Dialog
        open={pendingSection !== null}
        onOpenChange={(open) => !open && setPendingSection(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              You have unsaved changes on your Account. They&apos;ll be lost if
              you switch sections now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setPendingSection(null)}
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
