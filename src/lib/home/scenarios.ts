// ═══════════════════════════════════════════════════════════════════════════
// THE TODAY SCENARIO GROUP (Today rebuild, Phase J.2, J.3)
//
// ═══ WHY A COMPOSITION AND NOT A FOURTH DATA SOURCE ═══
//
// Today has no data of its own. It reads `tasksScenario(...)` and
// `monitoringData(...)` with the same arguments the destinations use, and that
// is deliberate — it is what makes the cards a MIRROR of each destination
// rather than a second opinion about it. A `todayScenarioId` that built its own
// items would be exactly the parallel source Phase A exists to have removed.
//
// So a Today scenario is a NAMED SETTING OF THE EXISTING AXES: a task fixture,
// a monitoring fixture, and a pin set. Selecting one writes those three and
// nothing else. The group is a shortcut through controls that already existed,
// which is why picking one and then reading the Tasks axis shows the fixture it
// selected rather than a fourth value the other surfaces cannot see.
//
// ═══ J.2 — THE NAME IS "Today" ═══
//
// The route is `/app/today`, nav says "Today", and the loader domain is
// `Home` (`HOME_LOAD_STAGES`, `homeLoadPlanFor`). The group is registered as
// **Today**, matching the route and the label a reader sees. The loader
// inconsistency is REPORTED, not renamed — renaming a loader domain is a
// change to a different surface's contract and this pack does not own it.
//
// ═══ J.5 — VOCABULARY ═══
//
// Every name here is checked against the prohibited list: no "patient", no
// "caseload", no "churn", no "at risk", no conversation synonyms. "Mentee" is
// used rather than "teen", per J.5, pending Nicole.
// AND THE EXISTING "Heavy caseload" SCENARIO IS LEFT ALONE. It violates the
// same list, it is on the Tasks axis rather than this one, and renaming it
// silently is the drift pattern this pack exists to prevent. Reported.

import { DEMO_TEENS } from "@/lib/record/people-demo";

export interface TodayScenario {
  id: string;
  /** NEEDS-COPY-NICOLE. */
  label: string;
  /** NEEDS-COPY-NICOLE. */
  description: string;
  /** A `TASK_SCENARIOS` id. */
  tasks: string;
  /** A monitoring scenario id, or null to derive flags from the task fixture. */
  monitoring: string | null;
  /** `DEMO_TEENS` ids to pin, in pin order — index 0 pinned first. */
  pins: string[];
  /** Which report-backs this scenario serves, so the set is checkable against
   *  J.3 rather than drifting from it. */
  serves: string;
}

/* ═══ THE PIN SET IS DRAWN FROM `DEMO_TEENS`, NOT FROM THE TASK ROSTER ═══
   `PinnedMentees` resolves ids against `DEMO_TEENS` (`t1`…`t26`) while
   `obligationFor` reads task items keyed by the task roster (`tk-*`). The two
   namespaces have ZERO overlap — gap 432, pinned by `teen-namespaces.test.ts`.
   The consequence is measured and reported rather than worked around: every
   pinned row's obligation field reads "Nothing open", so J.3's "mixed
   open/nothing-open" half is not reachable from any fixture. `obligationFor`
   itself is correct and proven by unit test with matching ids on both sides.
   Bridging the namespaces is a data-model change and is not this pack's. */
const PIN_POOL = ["t1", "t2", "t3", "t4", "t5"];

export const TODAY_SCENARIOS: TodayScenario[] = [
  {
    id: "shift-start-backlog",
    /* NEEDS-COPY-NICOLE */
    label: "Shift-start backlog",
    /* ═══ J.3's ROW SAID "All three destinations open" AND THAT IS NOT
           BUILDABLE ALONGSIDE ITS OTHER HALF ═══
       MEASURED: `directiveCardId` tries tone `breach` then `attention` over
       DIRECTIVE_ORDER, and the Care Reviews card's tone can only be
       `attention` or `clear` — its `breach` arm was removed with
       `CARE_REVIEW_SLA`. So any open escalation or open flag takes the
       directive, the rationale names that destination, and the preview shows
       it. Care Reviews leads only when the other two are clear.
       The row is named for I.2 and I.3 — the "4 of 16" disclosure and `See
       all` — so the sixteen win and the other two are clear. "All three
       destinations open" is `typical-shift`, which already existed and which
       A/B/H.2 are measured on. Reported rather than reconciled by building a
       fixture that satisfies the sentence and not the purpose. */
    description: "16 care reviews open, oldest 3d. Care Reviews leads.",
    tasks: "care-review-backlog",
    monitoring: null,
    pins: [],
    serves: "A, B, H.2, I.2, I.3 — the 4-of-16 disclosure and See all",
  },
  {
    id: "all-clear",
    /* NEEDS-COPY-NICOLE */
    label: "All clear",
    description: "Nothing open anywhere. No badges, no start-here module.",
    tasks: "all-clear",
    monitoring: null,
    pins: [],
    serves: "A (no badge at zero), B (zero-state lines), I.6 (no module)",
  },
  {
    id: "escalation-leads",
    /* NEEDS-COPY-NICOLE */
    label: "Escalation leads",
    description: "Escalations hold the oldest work; care reviews are newer.",
    tasks: "active-escalation",
    monitoring: null,
    pins: [],
    serves: "I.1 — FORK I-1, the preview follows the rationale's type",
  },
  {
    id: "preview-under-cap",
    /* NEEDS-COPY-NICOLE */
    label: "Preview under cap",
    description: "Exactly 2 open of the recommended type; no See all.",
    tasks: "preview-under-cap",
    monitoring: null,
    pins: [],
    serves: "I.3.3 — show what exists, state the true total, never pad",
  },
  {
    id: "pins-three",
    /* NEEDS-COPY-NICOLE */
    label: "Pins — three",
    description: "3 mentees pinned, each with an assigned mentor.",
    tasks: "typical-shift",
    monitoring: null,
    pins: PIN_POOL.slice(0, 3),
    serves: "F — the row contract and ordering by pin time",
  },
  {
    id: "pins-at-cap",
    /* NEEDS-COPY-NICOLE */
    label: "Pins — at cap",
    description: "5 mentees pinned, which is the cap.",
    tasks: "typical-shift",
    monitoring: null,
    pins: PIN_POOL,
    serves: "E.8 — the at-cap toggle explains rather than disabling. F.2",
  },
];

export function todayScenarioById(id: string | null | undefined): TodayScenario | null {
  if (!id) return null;
  return TODAY_SCENARIOS.find((s) => s.id === id) ?? null;
}

/** Pin entries for a scenario, stamped so `pins[0]` is the OLDEST pin — F.3
 *  orders by pin time ascending, so the stamps have to increase with the index
 *  or the rendered order would not match the array the fixture declares. */
export function pinsFor(scenario: TodayScenario, now: number) {
  return scenario.pins.map((id, i) => ({
    id,
    at: now - (scenario.pins.length - i) * 60_000,
  }));
}

/** Every pinned id resolves to a real demo mentee. Exported for the test, which
 *  is what stops a typo here rendering as a silently missing row — the
 *  component drops an id it cannot resolve. */
export function unresolvedPins(): string[] {
  const known = new Set(DEMO_TEENS.map((t) => t.id));
  return TODAY_SCENARIOS.flatMap((s) => s.pins).filter((id) => !known.has(id));
}
