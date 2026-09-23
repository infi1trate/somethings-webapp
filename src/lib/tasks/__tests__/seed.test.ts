// THE GUARD ON §2.4's CONSISTENCY REQUIREMENTS.
//
// The spec states three hard invariants for seeded data — tab counts equal list
// contents, coalesced groups sum correctly, and "Closed today" counters have
// matching resolved items. Those are exactly the properties that hold when a
// fixture is written and quietly stop holding the third time someone edits it, so
// they are asserted here rather than proofread.
//
// Also pinned: the model rules that are easy to break by hand — first name + last
// initial only (locked decision 11), no duration literals outside the SLA config
// (§2.3), and the deliberate documentation tier-rank tail.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_SCENARIO_ID,
  TASK_SCENARIOS,
  tasksScenario,
} from "@/lib/tasks/seed";
import { TASK_SLA_MS, deadlineFor } from "@/lib/tasks/sla";
import {
  DOMAIN_OF_TYPE,
  TASK_DOMAINS,
  TYPE_URGENCY_RANK,
  isBreached,
  type TaskItem,
} from "@/lib/tasks/types";

/** A fixed instant to build against. The scenarios take `now` as a parameter, so
 *  a test can pin it without the fixtures themselves being frozen. */
const NOW = new Date("2026-08-26T20:05:00.000Z").getTime();

const every = (): Array<{ id: string; items: TaskItem[] }> =>
  TASK_SCENARIOS.map((s) => ({ id: s.id, items: tasksScenario(s.id, NOW) }));

describe("§2.4 — seeded data is internally consistent", () => {
  it("every item's domain matches its task type's domain, so tab counts equal list contents", () => {
    // Tab counts and list contents both derive from `domain`, so the way this can
    // go wrong is an item whose domain disagrees with its type.
    for (const { id, items } of every()) {
      for (const it of items) {
        expect(it.domain, `${id} / ${it.id}`).toBe(DOMAIN_OF_TYPE[it.taskType]);
      }
    }
  });

  it("coalesced groups sum correctly — every flag's count equals its real group size", () => {
    for (const { id, items } of every()) {
      const open = items.filter((i) => i.status !== "resolved");
      const sizes = new Map<string, number>();
      for (const it of open) {
        if (it.payload.kind !== "riskFlag") continue;
        const key = `${it.taskType}::${it.objectId}`;
        sizes.set(key, (sizes.get(key) ?? 0) + 1);
      }
      for (const it of open) {
        if (it.payload.kind !== "riskFlag") continue;
        expect(
          it.payload.conversationFlagCount,
          `${id} / ${it.id}`
        ).toBe(sizes.get(`${it.taskType}::${it.objectId}`));
      }
    }
  });

  it("every scenario with a Closed-today counter has matching resolved items", () => {
    // The counters are per domain (escalations, flags, billing). If a scenario
    // reports any, the resolved items backing them must exist.
    for (const { id, items } of every()) {
      const resolved = items.filter((i) => i.status === "resolved");
      for (const r of resolved) {
        // A resolved item without a timestamp cannot be counted as closed TODAY.
        expect(r.resolvedAt, `${id} / ${r.id}`).toBeDefined();
        expect(r.resolvedAt!, `${id} / ${r.id}`).toBeLessThanOrEqual(NOW);
      }
      // Every scenario except breach-overnight deliberately closes something, so
      // the header counters are exercised rather than only designed.
      if (id !== "breach-overnight") {
        expect(resolved.length, id).toBeGreaterThan(0);
      }
    }
  });

  it("teen and mentor names are reused across domains inside a scenario", () => {
    // §2.4: "the teen with the open escalation also has flag history." What this
    // guards against is four unrelated queues that happen to sit on one page.
    for (const { id, items } of every()) {
      const domainsByTeen = new Map<string, Set<string>>();
      for (const it of items) {
        const set = domainsByTeen.get(it.teenId) ?? new Set();
        set.add(it.domain);
        domainsByTeen.set(it.teenId, set);
      }
      const shared = [...domainsByTeen.values()].filter((s) => s.size > 1);
      expect(shared.length, `${id}: no teen appears in more than one domain`).toBeGreaterThan(0);
    }
  });

  it("no teen has an intake billing review and a monthly re-review open at once", () => {
    /* ═══ REUSE ACROSS DOMAINS IS REQUIRED; INCOHERENCE IS NOT ═══
       §2.4 wants the same teens appearing in several domains, and the bulk fill
       delivers that. What it also delivered, until the seeds were made to stride,
       was Sofia holding an INTAKE and a MONTHLY RE-REVIEW at the same time — one
       band above the other in the Billing tab, same name on both rows. An intake
       assigns a teen's first code; a re-review revises an existing one. A teen
       cannot be having both done this week.
       Caught by looking at a screenshot, which is exactly the kind of luck this
       test replaces. */
    for (const { id, items } of every()) {
      const open = items.filter((i) => i.status !== "resolved");
      const intake = new Set(
        open.filter((i) => i.taskType === "intakeBillingReview").map((i) => i.teenId)
      );
      const rereview = open
        .filter((i) => i.taskType === "monthlyReReview")
        .map((i) => i.teenId);
      for (const teenId of rereview) {
        expect(intake.has(teenId), `${id}: ${teenId} has both an intake and a re-review`).toBe(false);
      }
    }
  });

  it("the active-escalation scenario's escalated teen also has flag history", () => {
    const items = tasksScenario("active-escalation", NOW);
    const escalated = items.filter((i) => i.taskType === "activeEscalation");
    expect(escalated.length).toBeGreaterThan(0);
    for (const esc of escalated) {
      const alsoFlagged = items.some(
        (i) => i.teenId === esc.teenId && i.domain === "riskFlag"
      );
      expect(alsoFlagged, `${esc.teenDisplayName} has no flag history`).toBe(true);
    }
  });
});

describe("locked decision 11 — first name + last initial, maximum", () => {
  it("no display name contains a surname", () => {
    // "Riley T." passes; "Riley Thompson" does not. The rule is that the second
    // token, if present, is a single letter and a full stop.
    for (const { id, items } of every()) {
      for (const it of items) {
        const parts = it.teenDisplayName.trim().split(/\s+/);
        expect(parts.length, `${id} / ${it.teenDisplayName}`).toBeLessThanOrEqual(2);
        if (parts.length === 2) {
          expect(parts[1], `${id} / ${it.teenDisplayName}`).toMatch(/^[A-Z]\.$/);
        }
      }
    }
  });
});

describe("§2.1 / §2.3 — deadlines and breach", () => {
  it("every slaDeadline equals the config's own computation", () => {
    // Catches a hand-written deadline, which is how a duration literal sneaks in
    // outside the config.
    for (const { id, items } of every()) {
      for (const it of items) {
        const fromOpen = deadlineFor(it.taskType, it.openedAt);
        if (it.payload.kind === "documentation") {
          // Documentation's clock starts at the escalation's CLOSE, so its
          // deadline is allowed to differ from an openedAt-derived one.
          expect(
            it.slaDeadline,
            `${id} / ${it.id}`
          ).toBe(deadlineFor(it.taskType, it.payload.closedAt));
        } else {
          expect(it.slaDeadline, `${id} / ${it.id}`).toBe(fromOpen);
        }
      }
    }
  });

  /* ═══ RETARGETED — "ENTIRELY" STOPPED BEING REACHABLE (Phase 4) ═══
     A flag has no published review deadline, so a scenario cannot put every item
     past one. The scenario's own description narrowed with it, from "Everything
     past its SLA" to "Every deadline past its SLA".
     STRICTER, NOT LOOSER: the old form was one universal quantifier. This
     asserts BOTH halves — every deadline-bearing item breached, and every flag
     not — so a fixture that quietly stopped containing flags, or one that
     re-acquired a flag deadline, both fail. */
  it("breaches every deadline in breach-overnight, and no flag", () => {
    const items = tasksScenario("breach-overnight", NOW).filter(
      (i) => i.status !== "resolved"
    );
    const withDeadline = items.filter((i) => i.slaDeadline != null);
    const flags = items.filter((i) => i.payload.kind === "riskFlag");
    expect(withDeadline.length).toBeGreaterThan(0);
    expect(flags.length).toBeGreaterThan(0);
    for (const it of withDeadline) {
      expect(isBreached(it, NOW), `${it.id} should be breached`).toBe(true);
    }
    for (const it of flags) {
      expect(it.slaDeadline, `${it.id} deadline`).toBeNull();
      expect(isBreached(it, NOW), `${it.id} must not breach`).toBe(false);
    }
  });

  it("the quiet-day scenario has nothing breached", () => {
    const items = tasksScenario("quiet-day", NOW).filter(
      (i) => i.status !== "resolved"
    );
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(isBreached(it, NOW), `${it.id} should not be breached`).toBe(false);
    }
  });

  it("no TaskItem carries a stored breach flag", () => {
    // Structural: §2.1 says breach is always derived. A stored field would go
    // stale the moment the clock passed it.
    const [first] = tasksScenario(DEFAULT_TASK_SCENARIO_ID, NOW);
    for (const forbidden of ["isBreached", "breached", "overdue"]) {
      expect(forbidden in first).toBe(false);
    }
  });
});

describe("the model's own shape", () => {
  it("documentation ranks below every other task type, deliberately", () => {
    // The tail that looks like a bug: paperwork for a closed escalation is the
    // least urgent thing on the page, even though it lives in the escalation
    // domain. Pinned so a future "fix" has to argue with a test.
    // RETARGETED (Phase 4): it compared against `routineFlagReview`, the lowest
    // TIER, which no longer exists. Comparing against the max is stronger — the
    // claim was always "last", and the old form only proved "below one type".
    const ranks = Object.values(TYPE_URGENCY_RANK);
    expect(TYPE_URGENCY_RANK.escalationDocumentation).toBe(Math.max(...ranks));
    expect(TYPE_URGENCY_RANK.activeEscalation).toBe(Math.min(...ranks));
  });

  it("every task type has an urgency rank, and only a flag lacks an SLA", () => {
    for (const t of Object.keys(DOMAIN_OF_TYPE) as Array<
      keyof typeof DOMAIN_OF_TYPE
    >) {
      expect(TYPE_URGENCY_RANK[t], t).toBeGreaterThan(0);
      /* THE ONE EXCEPTION IS NAMED, NOT SKIPPED (Phase 4). A loop that just
         allowed null everywhere would pass on a build where billing lost its
         deadline too. */
      if (t === "riskFlagReview") {
        expect(TASK_SLA_MS[t], t).toBeNull();
      } else {
        expect(TASK_SLA_MS[t], t).toBeGreaterThan(0);
      }
    }
  });

  it("both billing types share one SLA — the 48h/72h conflict is carried in one place", () => {
    expect(TASK_SLA_MS.intakeBillingReview).toBe(TASK_SLA_MS.monthlyReReview);
    expect(TASK_SLA_MS.intakeBillingReview).toBe(72 * 60 * 60 * 1000);
  });

  it("the three domains are fixed and in spec order", () => {
    /* FOUR UNTIL PHASE 4. `routineFlag` was the lowest severity tier wearing a
       domain, and the ledger never believed in it — `ACTIVITY_DOMAIN_OF` mapped
       it and `riskFlag` to the same event type. */
    expect(TASK_DOMAINS).toEqual(["escalation", "riskFlag", "billing"]);
  });
});

describe("locked decision 1 — this is a worklist, not an inbox", () => {
  it("no task-surface symbol or seeded string uses the word", async () => {
    const mods = await Promise.all([
      import("@/lib/tasks/types"),
      import("@/lib/tasks/sla"),
      import("@/lib/tasks/seed"),
    ]);
    for (const m of mods) {
      for (const key of Object.keys(m)) {
        expect(key.toLowerCase()).not.toContain("inbox");
      }
    }
    for (const { id, items } of every()) {
      for (const it of items) {
        expect(JSON.stringify(it).toLowerCase(), id).not.toContain("inbox");
      }
    }
  });
});
