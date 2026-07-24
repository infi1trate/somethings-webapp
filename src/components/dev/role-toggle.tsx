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

// The toggle is a PURE LENS: switching persona sets who's viewing and
// hard-navigates (so every surface rehydrates cleanly), and NEVER mutates
// mentor state — no seeding, no status writes. Fabricating a published
// profile on switch is exactly what used to clobber a mid-invite or
// just-submitted mentor.
function enterPersona(target: Persona, dest: string) {
  useOnboardingStore.getState().setPersona(target);
  window.location.assign(dest);
}

// Where the Mentor tab lands, computed from the mentor's CURRENT state so the
// lens mirrors where they'd actually be — each destination is a screen that
// self-guards for that state (see the mentor status→screen map).
function mentorDest(): string {
  const s = useOnboardingStore.getState();
  if (s.publishedSnapshot === null) {
    // Pre-publish: submitted/sent-back wait on the post-submit screen; still
    // building → the onboarding hub.
    if (s.status === "in_review" || s.status === "rejected") {
      return "/onboarding/submitted";
    }
    return "/hub";
  }
  // Published. An open post-publish edit lives in settings (ChangesBanner /
  // in-review chips surface there); a just-approved mentor who hasn't hit the
  // "Go to Somethings" CTA still gets the approved screen; otherwise home.
  if (s.profileUpdate !== null) return "/app/profile";
  if (!s.enteredHome) return "/onboarding/submitted";
  return "/app";
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
  { key: "mentor", label: "Mentor", go: () => enterPersona("mentor", mentorDest()) },
  {
    key: "lead-mentor",
    label: "Lead Mentor",
    // settings-02: Account lives in the universal Settings surface now.
    go: () => enterPersona("lead-mentor", "/app/settings?section=account"),
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
  // Both the mentor (/app*) and supervisor (/admin*) shells own the
  // bottom-left with the same 92px rail — shift the toggle clear of it on
  // either, so it never overlaps the rail's utility circles.
  const hasRail =
    typeof window !== "undefined" && mounted
      ? window.location.pathname.startsWith("/app") ||
        window.location.pathname.startsWith("/admin")
      : false;

  const tab = (isActive: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
      isActive
        ? "bg-foreground text-background"
        : "text-foreground hover:bg-muted"
    );

  return (
    // On the app/console shells the §5 sidebar rail (92px) owns the
    // bottom-left corner — shift right of it so the rail's utility circles
    // stay clear (Phase 7).
    <div
      className={cn(
        "fixed bottom-3 z-50 flex items-center gap-1 rounded-full border border-dashed border-foreground/40 bg-card/95 p-1 pl-2.5 text-xs shadow-md backdrop-blur",
        hasRail ? "left-[104px]" : "left-3"
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
