"use client";

// Dev/demo scaffolding — not product UI. ONE four-state persona control
// (Phase 10, decision #11 rev): who you are while browsing the prototype.
//   New Mentor  — mentor tab set, EMPTY data (skeleton previews, "No photo
//                 yet", empty rows). The current populated state is stashed
//                 first and restored when you switch away, so demo data is
//                 never lost; edits made INSIDE New Mentor are discarded on
//                 switch-away (dev-tool semantics — gaps.md #61).
//   Mentor      — mentor tab set, populated (the old "Mentor+login").
//   Lead Mentor — Account tab only, including the Photo row.
//   Supervisor  — replaces "Admin" (decision #12): the review console entry;
//                 mentor settings render in review mode with all five tabs.
// Mounted from the root layout in ALL environments (incl. the Vercel demo) so
// reviewers can switch personas — there's no auth gate behind it.

import { RotateCcw } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import type { Persona } from "@/lib/types";
import { cn } from "@/lib/utils";

// Populate the store for a persona without hand-writing persisted JSON:
// mutate through store actions (shape stays canonical), then hard-navigate so
// every surface rehydrates cleanly (client pushes race the everPublished
// guards — see the Phase-DEV note in git history).
function seedPublishedIfNeeded() {
  const s = useOnboardingStore.getState();
  // A mentor mid-review — submitted ("in_review") or sent back ("rejected") —
  // has state the review queue depends on. Never overwrite it; only seed a
  // demo profile when nothing is published AND nothing is awaiting review.
  // (Without this, switching to Supervisor to review a fresh submission
  // force-published it and it vanished from /admin/review.)
  if (s.status === "in_review" || s.status === "rejected") return;
  if (s.publishedSnapshot === null) {
    s.setStatus("published");
    s.capturePublishedSnapshot();
  }
}

function enterPersona(target: Persona, dest: string) {
  seedPublishedIfNeeded();
  useOnboardingStore.getState().setPersona(target);
  window.location.assign(dest);
}

// The Mentor pill's hover/focus reset: wipe the store-backed mentor and drop
// the user at the real invitation flow (WelcomeIntro → onboarding), the way a
// genuinely new mentor arrives. reset() nulls publishedSnapshot and sets
// status "invited", so the wizard's everPublished→/app and isReturning
// bounces don't fire. persona "new-mentor" is the correct lens for a
// freshly-invited mentor (drives the "joined ~5 days ago" cosmetic).
function resetToNewMentor() {
  const s = useOnboardingStore.getState();
  s.reset();
  s.setPersona("new-mentor");
  window.location.assign("/invite/demo-invite-token");
}

const PERSONAS: { key: Persona; label: string; go: () => void }[] = [
  { key: "mentor", label: "Mentor", go: () => enterPersona("mentor", "/app/profile") },
  {
    key: "lead-mentor",
    label: "Lead Mentor",
    go: () => enterPersona("lead-mentor", "/app/profile?tab=account"),
  },
  // Supervisor replaces Admin: same console destination, unchanged review
  // behavior; the settings surface renders all five tabs for this persona.
  {
    key: "supervisor",
    label: "Supervisor",
    go: () => enterPersona("supervisor", "/admin/users"),
  },
];

export function DevRoleToggle() {
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const active = mounted ? persona : null;
  const isApp =
    typeof window !== "undefined" && mounted
      ? window.location.pathname.startsWith("/app")
      : false;

  const tab = (isActive: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
      isActive
        ? "bg-foreground text-background"
        : "text-foreground hover:bg-muted"
    );

  return (
    // On /app* the §5 sidebar rail (92px) owns the bottom-left corner — shift
    // right of it so the rail's utility circles stay clear (Phase 7).
    <div
      className={cn(
        "fixed bottom-3 z-50 flex items-center gap-1 rounded-full border border-dashed border-foreground/40 bg-card/95 p-1 pl-2.5 text-xs shadow-md backdrop-blur",
        isApp ? "left-[104px]" : "left-3"
      )}
    >
      <span className="font-mono font-semibold uppercase tracking-wider text-muted-foreground">
        Dev
      </span>
      {PERSONAS.map((p) => {
        // The Mentor pill owns the new-mentor lens (its reset creates one), so
        // it stays lit while a freshly-reset mentor is onboarding.
        const isActive =
          active === p.key ||
          (p.key === "mentor" && active === "new-mentor");
        if (p.key !== "mentor") {
          return (
            <button
              key={p.key}
              type="button"
              onClick={p.go}
              className={tab(isActive)}
            >
              {p.label}
            </button>
          );
        }
        // Mentor pill + a reset control revealed on hover/focus — wipes the
        // mentor and restarts the real invite flow (keyboard-reachable via
        // focus-within; no layout shift for the other tabs).
        return (
          <span key={p.key} className="group relative flex items-center">
            <button
              type="button"
              onClick={p.go}
              className={cn(tab(isActive), "pr-6")}
            >
              {p.label}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetToNewMentor();
              }}
              aria-label="Reset as a new mentor and restart onboarding"
              title="Reset as a new mentor and restart onboarding"
              className={cn(
                "absolute right-1 flex size-5 items-center justify-center rounded-full opacity-0 outline-none transition-opacity",
                "hover:bg-black/10 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100",
                isActive ? "text-background" : "text-foreground"
              )}
            >
              <RotateCcw className="size-3" aria-hidden />
            </button>
          </span>
        );
      })}
    </div>
  );
}
