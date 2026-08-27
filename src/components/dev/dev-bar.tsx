"use client";

// THE DEV BAR — one slim strip, fixed along the bottom, full width.
//
// ═══════════════════════════════════════════════════════════════════════════
// IT REPLACES THE FLOATING DOCKS. There were three pieces of dev chrome floating
// over the product at different corners and z-indexes — the persona pill, the
// Activity simulator, the Tasks scenario switcher — and each new one had to dodge
// the last (`bottom-20 rather than bottom-4` is a real comment in the Tasks
// switcher). This is one bar instead, and it does NOT overlay: the body carries
// bottom padding equal to the bar's height, so no product pixel sits underneath
// it. That is the difference between a dev tool and an obstruction.
//
// ═══ TWO ORTHOGONAL AXES, AND CROSSING THEM IS THE POINT ═══
//
//   AXIS 1 · ROLE      who is viewing. Store-backed, as it already was.
//   AXIS 2 · SCENARIO  which record, and what state it is in. URL-backed.
//
// They are separate controls, never a combined list, because the permutations are
// the thing worth inspecting: "review overdue with an open escalation" × "mentor
// viewing" must show the same record with the action affordances ABSENT rather
// than disabled, and that is only checkable if the two can be set independently.
//
// ═══ SWITCHING ROLE ON A RECORD DOES NOT NAVIGATE AWAY ═══
//
// The old pill hard-navigated every persona to a fixed destination (`/app/team`
// for three of the four) — correct for entering a persona cold, and useless for
// the crossing above: it threw away the record you were inspecting. So on a
// record route the role change is a STORE WRITE ONLY. Persona is reactive state,
// every surface reads it through the store, and React re-renders the same record
// through the new lens with no reload. Off a record route the old destinations
// still apply, because there is no record to hold.
//
// Scenario changes are `router.push`, so they are client-side too. Nothing in
// this bar reloads the page except the destructive reset, which must.
//
// ═══ GATING ═══
//
// NOT gated by environment, deliberately and per instruction: the established
// convention in this codebase is that dev chrome renders in every environment
// (see the note this file replaces — "Mounted from the root layout in ALL
// environments so reviewers can switch personas"). There is no NODE_ENV check
// anywhere in src, and adding one only here would make this the single surface
// reviewers could not reach on the deployed demo.
//
// WHAT IT IS GATED BY IS THE ROLE ITSELF. The bar sets the viewer; it does not
// grant anything. Every capability behind it is still decided by the same
// permission map the product uses — `isSupervisorTier`, `canActOnCare` — so
// selecting Supervisor here is exactly equivalent to being one, and selecting
// Mentor genuinely loses the supervisor affordances rather than hiding them.
// A real deployment gates this by not shipping mock data, which is the honest
// boundary for a prototype whose entire dataset is fixtures.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import type { Persona } from "@/lib/types";
import {
  SCENARIO_PARAM,
  STAFF_SCENARIOS,
  TEEN_SCENARIOS,
  scenarioById,
  scenarioHref,
} from "@/lib/dev/record-scenarios";
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

/** The bar's height, exported so the body's padding cannot drift from it. */
export const DEV_BAR_H = 40;

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Where each persona lands when there is no record to hold. Unchanged from the
 *  pill this replaces. */
const PERSONAS: { key: Persona; label: string; dest: string }[] = [
  { key: "mentor", label: "Mentor", dest: "__mentor__" },
  { key: "lead-mentor", label: "Lead mentor", dest: "/app/team" },
  { key: "supervisor", label: "Supervisor", dest: "/app/team" },
  { key: "admin", label: "Admin", dest: "/app/team" },
];

/** Mentor's landing screen, computed from the mentor's CURRENT state so the lens
 *  mirrors where they would actually be. Lifted verbatim from the old pill. */
function mentorDest(): string {
  const s = useOnboardingStore.getState();
  if (s.publishedSnapshot === null) {
    if (s.status === "in_review" || s.status === "rejected") {
      return "/onboarding/submitted";
    }
    return "/hub";
  }
  if (s.profileUpdate !== null) return "/app/profile";
  if (!s.enteredHome) return "/onboarding/submitted";
  return "/app";
}

function resetToNewMentor() {
  const s = useOnboardingStore.getState();
  s.reset();
  s.setPersona("new-mentor");
  // THE ONE HARD NAVIGATION. A wiped store must rehydrate from scratch.
  window.location.assign("/invite/demo-invite-token");
}

export function DevBar() {
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const setPersona = useOnboardingStore((s) => s.setPersona);
  const router = useRouter();
  const pathname = usePathname();
  const [confirmReset, setConfirmReset] = useState(false);

  /** ═══ THE ACTIVE SCENARIO, WITHOUT `useSearchParams` ═══
   *
   *  Standing rule 3 forbids `useSearchParams` in this project — it wants a
   *  Suspense boundary, and a page-root Suspense silently breaks hard-load
   *  hydration here. The rule's escape hatch is the `use(searchParams)` PROP
   *  pattern, and that is unavailable to this component: it is mounted from the
   *  root layout, and layouts are not handed searchParams.
   *
   *  So the URL is read ONCE, on mount, from `window.location` — behind a lazy
   *  initialiser, so it never runs during SSR — and the selection is local state
   *  from then on. That also makes it reactive for the case a param-only change
   *  would otherwise miss: two scenarios can point at the SAME record (t13 is
   *  both `escalation-crisis` and `escalation-and-review`), so `usePathname`
   *  alone would not re-render when swapping between them.
   *
   *  THE URL STAYS THE SHAREABLE ARTIFACT — every change pushes it. What this
   *  does not do is follow a back/forward step, which for dev chrome is a fair
   *  trade for obeying rule 3. Noted rather than hidden. */
  const [scenarioId, setScenarioId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get(SCENARIO_PARAM) ?? "";
  });

  const active = mounted ? persona : null;
  /** A record route is one where a scenario has something to hold on to. */
  const onRecord = pathname?.startsWith("/admin/person/") ?? false;
  const scenario = scenarioById(scenarioId);

  const pickRole = (p: (typeof PERSONAS)[number]) => {
    setPersona(p.key);
    // STAY PUT ON A RECORD — see the module note. Off a record, enter the
    // persona's own destination the way the old pill did.
    if (onRecord) return;
    window.location.assign(p.dest === "__mentor__" ? mentorDest() : p.dest);
  };

  return (
    <>
      <div
        /* TODO-COPY */
        aria-label="Prototype harness"
        role="region"
        style={{ height: DEV_BAR_H }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 overflow-x-auto",
          // DASHED TOP EDGE — the convention this codebase already uses to mark
          // prototype chrome, so nobody reads a screenshot of it as product.
          "border-t border-dashed border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3",
          "text-[12px]"
        )}
      >
        <span className="shrink-0 font-semibold tracking-[0.08em] text-[var(--text-muted)]">
          DEV
        </span>

        {/* ── AXIS 1 · ROLE ─────────────────────────────────────────────── */}
        <div
          role="radiogroup"
          /* TODO-COPY */
          aria-label="Viewer role"
          className="flex shrink-0 items-center gap-0.5"
        >
          {PERSONAS.map((p) => {
            const on = active === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickRole(p)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-semibold transition-colors",
                  on
                    ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />

        {/* ── AXIS 2 · SCENARIO ─────────────────────────────────────────────
            A native select: twenty entries in a 40px strip, grouped, keyboard
            and screen-reader native for free, and it collapses to its label
            instead of eating the bar. */}
        <label className="flex shrink-0 items-center gap-1.5">
          {/* TODO-COPY */}
          <span className="text-[var(--text-muted)]">Scenario</span>
          <select
            value={scenarioId}
            onChange={(e) => {
              setScenarioId(e.target.value);
              const s = scenarioById(e.target.value);
              // CLIENT-SIDE. No reload; the record re-renders in place.
              if (s) router.push(scenarioHref(s), { scroll: false });
            }}
            className={cn(
              "min-w-[13rem] rounded-md border border-[color:var(--border-contour)] bg-[var(--surface-s1)] px-2 py-1",
              "text-[var(--text-primary)]",
              RING
            )}
          >
            <option value="">— none —</option>
            {/* TODO-COPY on both group labels. */}
            <optgroup label="Teen record">
              {TEEN_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Staff record">
              {STAFF_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {/* ── THE ACTIVE SCENARIO, NAMED. A screenshot of this bar says which
            scenario produced it and whether its data is real, which is the whole
            point of the label being here rather than in a tooltip. */}
        {scenario && (
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[var(--text-secondary)]">
              {scenario.exercises}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em]",
                scenario.data === "real"
                  ? "bg-[var(--surface-s2)] text-[var(--text-secondary)]"
                  : "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]"
              )}
            >
              {/* TODO-COPY. Mocked is the one worth flagging, so it is the one
                  that gets the tint. */}
              {scenario.data}
            </span>
          </p>
        )}

        {/* ── RESET. Destructive, so it confirms and it is last. */}
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          /* TODO-COPY */
          aria-label="Reset as a new mentor and restart onboarding"
          className={cn(
            "ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </button>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            {/* TODO-COPY */}
            <DialogTitle>Reset as a new mentor?</DialogTitle>
            <DialogDescription>
              This wipes the mentor in the store and restarts the invitation
              flow. Teen and staff fixtures are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button onClick={resetToNewMentor}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
