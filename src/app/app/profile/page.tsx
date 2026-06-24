"use client";

// Mentor settings → profile editing. Lives in the mentor app (not admin) and only
// opens up once the mentor is published. Tabs: Schedule (stub) + Matching Profile
// (the live editor). Editing + submitting re-enters the review loop (Phase B/C).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { MatchingProfileEditor } from "@/components/profile-editor/matching-profile-editor";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "schedule", label: "Schedule" },
  { key: "matching", label: "Matching Profile" },
] as const;

export default function MentorProfileSettingsPage() {
  const mounted = useMounted();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const everPublished = useOnboardingStore((s) => s.publishedSnapshot !== null);
  const [tab, setTab] = useState<string>("matching");

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
        <div role="tablist" aria-label="Profile settings" className="mb-6 flex gap-1 border-b">
          {TABS.map((t) => {
            const selected = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {selected && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />
                )}
              </button>
            );
          })}
        </div>

        {tab === "matching" ? (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {name
                ? `Editing ${name}'s Matching Profile`
                : "Editing your Matching Profile"}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Open a section to edit it — every change updates the live preview on
              the right, exactly what teens see.
            </p>
            <div className="mt-6">
              <MatchingProfileEditor />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            Scheduling — block out time off and vacations against your set
            schedule. Coming in a later milestone.
          </div>
        )}
      </div>
    </MentorShell>
  );
}
