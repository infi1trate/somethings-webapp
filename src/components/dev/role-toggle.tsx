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

import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import type { Persona } from "@/lib/types";
import { cn } from "@/lib/utils";

const STORE_KEY = "somethings.mentor-onboarding";
const STASH_KEY = "somethings.mentor-onboarding.dev-stash";

// Populate the store for a persona without hand-writing persisted JSON:
// mutate through store actions (shape stays canonical), then hard-navigate so
// every surface rehydrates cleanly (client pushes race the everPublished
// guards — see the Phase-DEV note in git history).
function seedPublishedIfNeeded() {
  const s = useOnboardingStore.getState();
  if (s.publishedSnapshot === null) {
    s.setStatus("published");
    s.capturePublishedSnapshot();
  }
}

function enterNewMentor() {
  const s = useOnboardingStore.getState();
  // Stash the real state ONCE (switching New Mentor → New Mentor must not
  // overwrite the stash with the empty state).
  if (s.persona !== "new-mentor" && !localStorage.getItem(STASH_KEY)) {
    const current = localStorage.getItem(STORE_KEY);
    if (current) localStorage.setItem(STASH_KEY, current);
  }
  s.reset(); // empty draft, no snapshot
  s.setStatus("published");
  s.capturePublishedSnapshot(); // published-but-empty → settings open, all empty states
  s.setPersona("new-mentor");
  window.location.assign("/app/profile");
}

function leaveNewMentorIfStashed(target: Persona) {
  const stashed = localStorage.getItem(STASH_KEY);
  const current = useOnboardingStore.getState().persona;
  if (current === "new-mentor" && stashed) {
    // Restore the real state and stamp the target persona on it directly —
    // the store rehydrates from this JSON on the hard navigation below.
    try {
      const parsed = JSON.parse(stashed) as { state?: { persona?: string } };
      if (parsed.state) parsed.state.persona = target;
      localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
    } catch {
      localStorage.setItem(STORE_KEY, stashed); // restore as-is, worst case
    }
    localStorage.removeItem(STASH_KEY);
    return true;
  }
  return false;
}

function enterPersona(target: Exclude<Persona, "new-mentor">, dest: string) {
  if (!leaveNewMentorIfStashed(target)) {
    seedPublishedIfNeeded();
    useOnboardingStore.getState().setPersona(target);
  }
  window.location.assign(dest);
}

const PERSONAS: { key: Persona; label: string; go: () => void }[] = [
  { key: "new-mentor", label: "New Mentor", go: enterNewMentor },
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
      {PERSONAS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={p.go}
          className={tab(active === p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
