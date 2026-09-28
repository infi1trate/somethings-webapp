// ═══════════════════════════════════════════════════════════════════════════
// J.3's TABLE, EXECUTABLE (Today rebuild, Phase J)
//
// The pack states each fixture's data state in prose — "16 care reviews open",
// "nothing open on any destination", "exactly 2 open of the recommended type".
// A fixture whose prose and behaviour disagree is worse than a missing one,
// because every report-back that names it inherits the error. So the table is
// asserted here against what the scenario actually produces.
//
// AND THE PROHIBITED VOCABULARY IS CHECKED ON THE NAMES THEMSELVES. J.5's list
// covers component and variable names, not only visible copy, and a scenario
// label is both.

import { describe, expect, it } from "vitest";
import {
  TODAY_SCENARIOS,
  pinsFor,
  todayScenarioById,
  unresolvedPins,
} from "@/lib/home/scenarios";
import { PREVIEW_CAP, startHerePreview } from "@/lib/home/start-here";
import { directiveCardId, todayCards, todayRationale } from "@/lib/home/today";
import { openCounts } from "@/lib/ia/open-counts";
import { PIN_CAP } from "@/lib/record/pinned";
import { TASK_SCENARIOS, tasksScenario } from "@/lib/tasks/seed";
import { monitoringData } from "@/lib/monitoring/scenarios";
import { shiftFactsFor } from "@/lib/tasks/shift";
import { elapsedLabel } from "@/components/tasks/strips";

const NOW = 1_800_000_000_000;

function inputFor(id: string) {
  const sc = todayScenarioById(id)!;
  const items = tasksScenario(sc.tasks, NOW);
  const data = monitoringData(sc.monitoring, sc.tasks, NOW);
  return {
    items,
    facts: shiftFactsFor(items, NOW),
    events: data.events,
    escalations: data.escalations,
    conversations: data.conversations,
    classifierDegraded: data.classifier === "degraded",
    now: NOW,
  };
}

describe("the group is wired to real fixtures", () => {
  it("names a task scenario that exists, for every entry", () => {
    const known = new Set(TASK_SCENARIOS.map((s) => s.id));
    for (const sc of TODAY_SCENARIOS) {
      expect(known, `${sc.id} names an unknown task fixture: ${sc.tasks}`).toContain(
        sc.tasks
      );
    }
  });

  it("pins only ids that resolve to a real demo mentee", () => {
    /* `PinnedMentees` DROPS an id it cannot resolve, so a typo here would
       render as a silently shorter list rather than as an error. */
    expect(unresolvedPins()).toEqual([]);
  });

  it("never pins more than the cap the toggle enforces", () => {
    for (const sc of TODAY_SCENARIOS) {
      expect(sc.pins.length, `${sc.id} pins past the cap`).toBeLessThanOrEqual(PIN_CAP);
    }
  });

  it("stamps pins so index 0 is the oldest, which is the order F.3 renders", () => {
    const sc = todayScenarioById("pins-three")!;
    const pins = pinsFor(sc, NOW);
    expect(pins.map((p) => p.id)).toEqual(sc.pins);
    for (let i = 1; i < pins.length; i++) {
      expect(pins[i].at, `pin ${i} is not newer than the one before it`).toBeGreaterThan(
        pins[i - 1].at
      );
    }
  });

  it("has a unique id per entry and resolves each one", () => {
    const ids = TODAY_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(todayScenarioById(id)?.id).toBe(id);
    expect(todayScenarioById(null)).toBeNull();
    expect(todayScenarioById("nope")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// J.5 — VOCABULARY, ON THE NAMES
// ═══════════════════════════════════════════════════════════════════════════

describe("no scenario name uses prohibited vocabulary (J.5)", () => {
  /* "patient", "caseload", "churn", "at risk", and conversation synonyms
     including "chat"/"chats". "Care" is not "caseload" and "Care Reviews" is
     the destination's own name, so the pattern is anchored on whole words. */
  const BANNED =
    /\b(patients?|caseloads?|churn|at[\s-]risk|chats?|messages?|messaging|texts?|DMs?)\b/i;

  it.each(
    TODAY_SCENARIOS.flatMap((s) => [
      [`${s.id} · id`, s.id],
      [`${s.id} · label`, s.label],
      [`${s.id} · description`, s.description],
    ] as const)
  )("%s", (_where, text) => {
    expect(BANNED.test(text), `"${text}" matches ${BANNED.exec(text)?.[0]}`).toBe(false);
  });

  it("prefers 'mentee' over 'teen' in names, pending Nicole (J.5)", () => {
    for (const sc of TODAY_SCENARIOS) {
      expect(
        /\bteens?\b/i.test(`${sc.id} ${sc.label} ${sc.description}`),
        `${sc.id} says "teen"; J.5 asks for "mentee" on this surface`
      ).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// J.3's DATA STATES
// ═══════════════════════════════════════════════════════════════════════════

describe("shift-start backlog — the 4-of-16 disclosure (I.2, I.3)", () => {
  const input = () => inputFor("shift-start-backlog");

  it("opens 16 care reviews and nothing on the other two destinations", () => {
    const c = openCounts(input());
    expect(c["care-reviews"]).toBe(16);
    expect(c.escalations).toBe(0);
    expect(c["risk-flags"]).toBe(0);
  });

  it("puts Care Reviews at the head of the ladder, so the preview is care reviews", () => {
    /* THE WHOLE REASON THE OTHER TWO ARE ZERO. `directiveCardId` tries tone
       `breach` then `attention`, and the Care Reviews card can only ever be
       `attention` or `clear` — so any open escalation or flag would outrank it
       and this fixture would preview the wrong type. */
    const i = input();
    const cards = todayCards(i);
    expect(directiveCardId(cards)).toBe("care-reviews");
    expect(todayRationale(cards, i)?.id).toBe("care-reviews");
  });

  it("shows exactly 4 of 16, oldest first, and the oldest is 3d", () => {
    const i = input();
    const p = startHerePreview("care-reviews", i)!;
    expect(p.items.length).toBe(PREVIEW_CAP);
    expect(p.total).toBe(16);
    for (let n = 1; n < p.items.length; n++) {
      expect(p.items[n].at).toBeGreaterThanOrEqual(p.items[n - 1].at);
    }
    /* ═══ THE LABELS MUST AGREE, NOT JUST THE IDENTITIES (I.2.3) ═══
       This used to check only that the first item's age fell in a range, and
       that is how the real defect got through: the card said "oldest 3d ago",
       the rationale said "— 3d", and the preview row rendered "2d", because
       `ageOf` rounded while `elapsedLabel` floors. Same item, three lines
       apart, two answers — which is exactly the self-contradiction I.2.3
       forbids, and an identity check cannot see it.
       So the RENDERED strings are compared. */
    const ageHours = (NOW - p.items[0].at) / 3_600_000;
    expect(ageHours, "the oldest is no longer over three whole days").toBeGreaterThanOrEqual(72);
    const card = todayCards(i).find((c) => c.id === "care-reviews")!;
    expect(card.state).toContain("16 open");
    expect(card.state).toContain("oldest 3d");
    expect(todayRationale(todayCards(i), i)!.reason).toContain("3d");
    expect(
      elapsedLabel(p.items[0].at, NOW),
      "the preview row's age disagrees with the card and rationale above it"
    ).toBe("3d");
  });

  it("leaves something beyond the shown set, so See all has a reason to render", () => {
    const p = startHerePreview("care-reviews", input())!;
    expect(p.total).toBeGreaterThan(p.items.length);
  });
});

describe("all clear — nothing open anywhere (A, B, I.6)", () => {
  it("counts zero on every destination", () => {
    const c = openCounts(inputFor("all-clear"));
    expect(c.escalations).toBe(0);
    expect(c["risk-flags"]).toBe(0);
    expect(c["care-reviews"]).toBe(0);
  });

  it("renders no start-here module at all (I.6.1)", () => {
    const i = inputFor("all-clear");
    const cards = todayCards(i);
    expect(directiveCardId(cards)).toBeNull();
    expect(todayRationale(cards, i)).toBeNull();
  });

  it("still reports work closed today, so a cleared board is not an empty load", () => {
    /* A fixture of zero items would ALSO count zero open, and would empty the
       footer too — making "all clear" indistinguishable from a failed load. */
    const i = inputFor("all-clear");
    const closed = Object.values(i.facts.closedToday).reduce<number>(
      (n, v) => n + (v ?? 0),
      0
    );
    expect(closed).toBeGreaterThan(0);
  });
});

describe("escalation leads — the preview follows the rationale's type (I.1)", () => {
  it("puts Escalations at the head and previews escalations", () => {
    const i = inputFor("escalation-leads");
    const cards = todayCards(i);
    expect(directiveCardId(cards)).toBe("escalations");
    const r = todayRationale(cards, i)!;
    expect(r.id).toBe("escalations");
    expect(startHerePreview(r.id, i)!.destination).toBe("escalations");
  });

  it("and care reviews are open but newer, which is what makes it a real contest", () => {
    const i = inputFor("escalation-leads");
    expect(openCounts(i)["care-reviews"]).toBeGreaterThan(0);
  });
});

describe("preview under cap — show what exists, never pad (I.3.3)", () => {
  it("opens exactly 2 of the recommended type and states 2 of 2", () => {
    const i = inputFor("preview-under-cap");
    const cards = todayCards(i);
    const r = todayRationale(cards, i)!;
    expect(r.id).toBe("care-reviews");
    const p = startHerePreview(r.id, i)!;
    expect(p.items.length).toBe(2);
    expect(p.total).toBe(2);
    /* NOT PADDED to the cap, and nothing left over — so `See all` must not
       render, which is the half of I.3.2 this fixture exists to show. */
    expect(p.total).toBeLessThan(PREVIEW_CAP);
    expect(p.total).toBe(p.items.length);
  });
});

describe("the pin fixtures (E.8, F)", () => {
  it("pins three, and five at the cap", () => {
    expect(todayScenarioById("pins-three")!.pins.length).toBe(3);
    expect(todayScenarioById("pins-at-cap")!.pins.length).toBe(PIN_CAP);
  });

  /* ═══ THE "MIXED open/nothing-open" HALF OF J.3 IS NOT REACHABLE ═══
     `PinnedMentees` resolves ids against `DEMO_TEENS` (`t1`…`t26`) while
     `obligationFor` reads task items keyed by the task roster (`tk-*`). The two
     namespaces have ZERO overlap — gap 432 — so every pinned row's obligation
     reads "Nothing open" regardless of fixture. `obligationFor` itself is
     correct and `pinned-rows.test.ts` proves it with matching ids on both
     sides; the gap is the demo-data wiring.
     ASSERTED RATHER THAN NOTED, so that bridging the namespaces makes this fail
     and prompts the fixture to grow the mixed case it was asked for. */
  it("and cannot yet show a mixed obligation state — gap 432, asserted", () => {
    const taskTeens = new Set(inputFor("pins-three").items.map((i) => i.teenId));
    const pinned = todayScenarioById("pins-three")!.pins;
    const overlap = pinned.filter((id) => taskTeens.has(id));
    expect(
      overlap,
      "a pinned id now matches a task-fixture teen — gap 432 may be closed, so give the pin fixtures a mixed open/nothing-open state (J.3)"
    ).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE TWO AGE FORMATTERS AGREE — AT A VALUE WHERE THEY USED NOT TO
//
// The assertion in the backlog block above compares the card's rendered age
// against the preview row's, and it is a real check — but the fixture's oldest
// is now over 72 hours, where `Math.round` and `Math.floor` give the same
// answer. A mutation restoring `Math.round` to `ageOf` therefore passed it.
//
// So the invariant is asserted at the value that DISCRIMINATES. 66 hours is
// 2.75 days: floor says 2d, round says 3d, and that difference is what put
// "oldest 3d ago" on a card three lines above a row reading "2d".
// ═══════════════════════════════════════════════════════════════════════════

const HOUR_MS = 3_600_000;

const openReview = (id: string, openedAt: number) =>
  ({
    id,
    teenId: `tk-${id}`,
    teenDisplayName: "Ada N.",
    taskType: "intakeBillingReview",
    domain: "billing",
    status: "open",
    openedAt,
    slaDeadline: null,
    payload: {
      kind: "billing",
      isReReview: false,
      current: null,
      recommended: { code: "F41.1", statement: "Generalized anxiety disorder" },
    },
  }) as unknown as import("@/lib/tasks/types").TaskItem;

describe("Today's age formatter agrees with the row formatter (I.2.3)", () => {
  /* 66h floors to 2d and rounds to 3d — the discriminating case. 60h and 84h
     are the same trap one bucket either side. */
  it.each([
    [66, "2d"],
    [60, "2d"],
    [84, "3d"],
    [36, "1d"],
  ])("at %ih both say %s", (hours, want) => {
    const at = NOW - hours * HOUR_MS;
    const input = {
      items: [openReview("solo", at)],
      facts: shiftFactsFor([openReview("solo", at)], NOW),
      events: [],
      escalations: [],
      conversations: [],
      classifierDegraded: false,
      now: NOW,
    } as unknown as Parameters<typeof todayCards>[0];

    const card = todayCards(input).find((c) => c.id === "care-reviews")!;
    expect(card.state, `the card's age at ${hours}h`).toContain(`oldest ${want} ago`);
    expect(elapsedLabel(at, NOW), `the row's age at ${hours}h`).toBe(want);
  });
});
