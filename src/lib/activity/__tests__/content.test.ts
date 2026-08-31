// A9 — CONTENT CORRECTNESS. Four fixes, each with a way to regress silently.
//
// These are not grammar tests for their own sake. Every assertion here failed
// before A9 in a way that looked like a design problem rather than a bug: an
// action row reading as history, a billing ledger with no codes in it, and a
// supervisor's shift apparently running through the small hours.

import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/activity/filters";
import { queryFeed, type FeedRow } from "@/lib/activity/query";
import {
  ALERT_TABLE,
  resolveAlertType,
  type ActivityViewer,
} from "@/lib/activity/resolve-alert-type";
import type { ActivityDomain } from "@/lib/activity/events";
import { ACTIVITY_SCENARIOS, SHIFT_START_HOUR, SIM_NOW, scenarioById } from "@/lib/activity/seed";
import { viewById } from "@/lib/activity/views";
import { markRead, type ReadOverlay } from "@/lib/activity/read-state";

/** `ReadOverlay` is a plain record — {} IS the empty overlay. */
const EMPTY_OVERLAY: ReadOverlay = {};

const scenario = (id: string) => scenarioById(id);

const viewerFor = (id: string): ActivityViewer => {
  const s = scenario(id);
  return { id: s.viewerId, role: "supervisor", caseloadTeenIds: s.caseloadTeenIds };
};

/** Every row in a view, flattened out of its day buckets. */
function rowsOf(
  scenarioId: string,
  viewId: string,
  includeActions = false,
  domains: ActivityDomain[] = []
): FeedRow[] {
  const s = scenario(scenarioId);
  return queryFeed({
    events: s.events,
    viewer: viewerFor(scenarioId),
    view: viewById(viewId),
    overlay: EMPTY_OVERLAY,
    unreadOnly: false,
    filters: { ...EMPTY_FILTERS, includeActions, domains },
    now: SIM_NOW,
  }).flatMap((d) => d.rows);
}

/** ═══ THE BILLING LEDGER, AFTER THE TAB WAS REMOVED (B2) ═══
 *
 *  Three call sites below asked for `viewId: "billing"`. That view is gone —
 *  billing is a DOMAIN and the rail is a SCOPE axis — and `viewById` falls back
 *  to the default, so those tests silently started querying My caseload. One of
 *  them caught it (no degraded rows exist in `mine` scope, which is the whole
 *  point of that scope) and the others would have kept passing against the wrong
 *  question.
 *
 *  The replacement is B2's own contract: widest scope plus the billing domain
 *  filter. `includeActions` is not needed — a domain filter now admits the full
 *  type set by itself, which is the property the tab used to carry. */
const billingLedger = (scenarioId: string) =>
  rowsOf(scenarioId, "network", false, ["billing"]);

// ═══ ITEM 2 · THE ACTION LEAK ══════════════════════════════════════════════

describe("ACTION rows stay out of the default view", () => {
  it("the raising types resolve to action for a supervisor, including as the actor", () => {
    // THE ACTOR CELL IS THE ONE THAT WAS WRONG. A raising is open work whoever
    // opened it; "activity" there put the supervisor's own raisings into the
    // record and into the unread count.
    for (const t of ["ESCALATION_RAISED", "RISK_FLAG_RAISED", "BILLING_REVIEW_OPENED"] as const) {
      expect(ALERT_TABLE[t].supervisor.actor).toBe("action");
      expect(ALERT_TABLE[t].supervisor.caseload).toBe("action");
    }
  });

  it("no row in the default view is an action", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      const rows = rowsOf(s.id, "mine");
      expect(rows.filter((r) => r.alertType === "action")).toHaveLength(0);
    }
  });

  it("no default-view sentence says the viewer raised something", () => {
    // The exact string A9 reported, and every shape of it.
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of rowsOf(s.id, "mine")) {
        expect(r.sentence).not.toMatch(/^You raised /);
        expect(r.sentence).not.toMatch(/^You opened /);
      }
    }
  });

  it("the rows are still REACHABLE — excluded, not deleted", () => {
    const withActions = rowsOf("typical-shift", "mine", true);
    expect(withActions.some((r) => r.alertType === "action")).toBe(true);
  });
});

describe("ACTION rows use past-tense record voice (§5.1)", () => {
  it("an escalation raised by the viewer reads agentlessly", () => {
    const rows = rowsOf("typical-shift", "mine", true);
    const raised = rows.filter((r) => r.eventType === "ESCALATION_RAISED");
    expect(raised.length).toBeGreaterThan(0);
    for (const r of raised) {
      expect(r.sentence).toMatch(/^An escalation opened for \w+\.$/);
    }
  });

  it("the article agrees with the noun", () => {
    // "A escalation opened" was live for as long as the branch was system-only.
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of rowsOf(s.id, "mine", true)) {
        expect(r.sentence).not.toMatch(/\bA escalation\b/);
        expect(r.sentence).not.toMatch(/\bAn billing\b/);
        expect(r.sentence).not.toMatch(/\bAn risk\b/);
      }
    }
  });

  it("ACTIVITY rows keep first person — the change is scoped to actions", () => {
    const rows = rowsOf("typical-shift", "mine");
    expect(rows.some((r) => r.sentence.startsWith("You "))).toBe(true);
  });
});

// ═══ ITEM 3 · BILLING CODES ════════════════════════════════════════════════

describe("billing codes render where detail is granted", () => {
  it("a completed review the viewer performed carries its code", () => {
    const rows = rowsOf("typical-shift", "billing", true).filter(
      (r) => r.eventType === "BILLING_REVIEW_COMPLETE" && r.count === 1
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.payload).toBeDefined();
      expect(r.sentence).toMatch(/ — [A-Z]\d/);
    }
  });

  it("clause (a): the viewer's own past review keeps its code after reassignment", () => {
    // network-wide seeds exactly this — Lydia's own approval for a teen who has
    // since left her caseload. It is the row A5 clause (a) exists for.
    const rows = billingLedger("network-wide").filter(
      (r) => r.actorId === viewerFor("network-wide").id && r.eventType === "BILLING_REVIEW_COMPLETE"
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.sentence.includes("H0038"))).toBe(true);
  });

  it("out-of-caseload rows stay code-free (A5)", () => {
    const degraded = billingLedger("network-wide").filter((r) => r.degraded);
    expect(degraded.length).toBeGreaterThan(0);
    for (const r of degraded) {
      expect(r.payload).toBeUndefined();
      expect(r.sentence).not.toMatch(/ — /);
      // The rich network payload's code, specifically.
      expect(r.sentence).not.toContain("F33.1");
    }
  });

  it("a code never appears on a review that has not completed", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of billingLedger(s.id)) {
        if (r.eventType === "BILLING_REVIEW_COMPLETE") continue;
        expect(r.sentence).not.toMatch(/ — /);
      }
    }
  });

  it("a coalesced group states no single code for a batch", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of billingLedger(s.id)) {
        if (r.count > 1) expect(r.sentence).not.toMatch(/ — /);
      }
    }
  });
});

// ═══ ITEM 4 · SHIFT WINDOWS ════════════════════════════════════════════════

describe("every seeded event falls inside a shift window", () => {
  const hourOf = (iso: string) => {
    const d = new Date(iso);
    return d.getHours() + d.getMinutes() / 60;
  };

  it("nothing lands between midnight and the shift start", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const e of s.events) {
        const h = hourOf(e.occurredAt);
        expect(
          h >= SHIFT_START_HOUR,
          `${s.id} ${e.id} ${e.eventType} at ${new Date(e.occurredAt).toLocaleString()}`
        ).toBe(true);
      }
    }
  });

  it("nothing lands after the day it belongs to", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const e of s.events) {
        expect(hourOf(e.occurredAt)).toBeLessThan(24);
        expect(new Date(e.occurredAt).getTime()).toBeLessThanOrEqual(SIM_NOW);
      }
    }
  });

  it("SIM_NOW is mid-shift, not five minutes into it", () => {
    const h = hourOf(new Date(SIM_NOW).toISOString());
    expect(h).toBeGreaterThan(SHIFT_START_HOUR + 2);
  });

  it("day assignment is preserved, so coalescing groups keep their members", () => {
    // heavy-day's seven-flag conversation must still be seven events on one day.
    const s = scenario("heavy-day");
    const flags = s.events.filter((e) => e.objectId === "conv-maya-heavy");
    expect(flags).toHaveLength(7);
    const days = new Set(flags.map((e) => new Date(e.occurredAt).toDateString()));
    expect(days.size).toBe(1);
  });

  it("relative spacing survives: the seven-flag cluster stays a cluster", () => {
    const s = scenario("heavy-day");
    const times = s.events
      .filter((e) => e.objectId === "conv-maya-heavy")
      .map((e) => new Date(e.occurredAt).getTime())
      .sort((a, b) => a - b);
    const spanMinutes = (times[times.length - 1] - times[0]) / 60_000;
    // An even spread across an eight-hour window would put these ~80 minutes
    // apart. Affine placement keeps the whole batch inside a working stretch.
    expect(spanMinutes).toBeLessThan(180);
  });
});

// ═══ REGRESSION GUARD ON THE RULES A9 MUST NOT BREAK ═══════════════════════

describe("A9 leaves rules 8-12 intact", () => {
  it("rule 9/10: read state is still keyed by scope", () => {
    const s = scenario("typical-shift");
    const id = s.events[0].id;
    const overlay = markRead(EMPTY_OVERLAY, s.viewerId, "mine", [id]);
    const viewer = viewerFor("typical-shift");
    const inMine = queryFeed({
      events: s.events, viewer, view: viewById("mine"), overlay,
      unreadOnly: false, filters: EMPTY_FILTERS, now: SIM_NOW,
    }).flatMap((d) => d.rows).find((r) => r.eventIds.includes(id));
    expect(inMine?.state).not.toBe("unread");
  });

  it("rule 8: nothing wrote an alert type onto an event", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const e of s.events) {
        expect(e).not.toHaveProperty("alertType");
      }
    }
  });

  it("rule 8: the same event still resolves differently by role", () => {
    const s = scenario("typical-shift");
    const closed = s.events.find((e) => e.eventType === "ESCALATION_CLOSED")!;
    const sup = resolveAlertType(closed, viewerFor("typical-shift"));
    const mentor = resolveAlertType(closed, {
      id: "mentor-brandon", role: "mentor",
      caseloadTeenIds: [String(closed.payload.teenId)],
    });
    expect(sup).not.toBe(mentor);
  });
});

// ═══ A10 · THE LEAD CLAUSE ═════════════════════════════════════════════════
//
// The unread row emphasises its subject-and-verb clause by rendering `lead` in a
// heavier weight and then slicing the remainder off `sentence`. That only works
// while `lead` is a genuine PREFIX — if it ever stops being one, the row silently
// renders a duplicated fragment or drops a word, with no error anywhere.

describe("row.lead is always a prefix of row.sentence", () => {
  const everyRow = () => {
    const out: FeedRow[] = [];
    for (const s of ACTIVITY_SCENARIOS) {
      for (const viewId of ["mine", "network", "billing"]) {
        for (const includeActions of [false, true]) {
          const rows = rowsOf(s.id, viewId, includeActions);
          out.push(...rows, ...rows.flatMap((r) => r.members ?? []));
        }
      }
    }
    return out;
  };

  it("holds for every row of every view of every scenario", () => {
    const rows = everyRow();
    expect(rows.length).toBeGreaterThan(50);
    for (const r of rows) {
      expect(r.sentence.startsWith(r.lead), `${r.lead} :: ${r.sentence}`).toBe(true);
    }
  });

  it("the lead is never empty and never the whole sentence with its stop", () => {
    for (const r of everyRow()) {
      expect(r.lead.length).toBeGreaterThan(0);
      // The remainder always carries at least the full stop, so slicing cannot
      // leave the sentence unterminated.
      expect(r.sentence.slice(r.lead.length)).toMatch(/\.$/);
    }
  });

  it("the lead carries the actor and the verb, not the object", () => {
    const rows = rowsOf("typical-shift", "mine");
    const self = rows.find((r) => r.lead.startsWith("You "));
    expect(self).toBeDefined();
    // "You closed" — two words, no teen name in it.
    expect(self!.lead.split(" ").length).toBe(2);
    expect(self!.lead).not.toContain("'s");
  });
});

// ═══ A11 · DETAILED MODE MUST NOT BECOME A LEAK ════════════════════════════
//
// Detailed mode's whole purpose is to show more, which makes it the second-most
// likely place (after A12's pane) for degraded detail to escape. The defence is
// that `context` is built in the query alongside `payload` and omitted by the same
// branch — so these assert the branch, not the component.

describe("the detailed row's context line respects rule 12", () => {
  it("no degraded row anywhere carries a context line", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const viewId of ["mine", "network", "billing"]) {
        for (const r of rowsOf(s.id, viewId, true)) {
          if (!r.degraded) continue;
          expect(r.context, `${s.id}/${viewId}/${r.id}`).toBeUndefined();
        }
      }
    }
  });

  it("network scope is all-degraded and so all context-free", () => {
    const rows = rowsOf("network-wide", "network", true);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.degraded)).toBe(true);
    expect(rows.every((r) => r.context === undefined)).toBe(true);
  });

  it("full-detail rows DO carry context, or the mode would be empty", () => {
    const rows = rowsOf("typical-shift", "mine", true).filter((r) => !r.degraded);
    expect(rows.some((r) => (r.context?.length ?? 0) > 0)).toBe(true);
  });

  it("context never contains a raw wire value", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of rowsOf(s.id, "mine", true)) {
        for (const line of r.context ?? []) {
          expect(line).not.toMatch(/_/);
          expect(line).not.toMatch(/^[A-Z_]{4,}$/);
        }
      }
    }
  });

  it("a completed review states its code and where it landed", () => {
    // ═══ THIS ASSERTION WAS REVERSED, AND THE OLD REASONING WAS NOT WRONG ═══
    //
    // It used to require the OPPOSITE: the code must not appear on line 3,
    // because "the sentence already ends with it; a context line repeating it
    // reads as two different codes at a glance." That is a real concern and the
    // row does now carry "F41.1" twice — once at the end of line 2, once at the
    // start of line 3.
    //
    // Reversed because phase B1 specifies line 3 per event type explicitly, and
    // for this type it is "code + status — F41.1 · Active". The STATUS is the new
    // information and it needs the code beside it to be readable; "Active" alone
    // on line 3 would not say what is active.
    //
    // REPORTED rather than resolved silently: if the duplication is worse than
    // the ambiguity, the fix is to drop the code from the END OF LINE 2 rather
    // than from line 3, because line 3 is where the status lives. That is a
    // sentence change, and `sentences.ts` is not this phase's to edit.
    // design-system-gaps row 321.
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of billingLedger(s.id)) {
        if (r.eventType !== "BILLING_REVIEW_COMPLETE") continue;
        const code = typeof r.payload?.code === "string" ? r.payload.code : null;
        if (!code) continue;
        const context = (r.context ?? []).join(" · ");
        expect(r.sentence).toContain(code);
        // Line 3 leads with the code and names a status after it.
        expect(context).toMatch(new RegExp(`^${code.replace(".", "\\.")} · \\w`));
      }
    }
  });

  it("a coalesced group states no member's context as the group's", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of rowsOf(s.id, "mine", true)) {
        if (r.count > 1) expect(r.context).toBeUndefined();
      }
    }
  });
});

describe("the avatar economy's flag is resolved, not inferred", () => {
  it("actorIsSelf agrees with the actor id on every row", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      const viewerId = viewerFor(s.id).id;
      for (const r of rowsOf(s.id, "mine", true)) {
        expect(r.actorIsSelf).toBe(r.actorId === viewerId);
      }
    }
  });

  it("a first-person sentence and actorIsSelf never disagree", () => {
    // The layout drops the avatar on `actorIsSelf`; if that ever diverged from the
    // grammar, a row would say "You closed…" beside somebody else's avatar.
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of rowsOf(s.id, "mine", true)) {
        if (r.lead.startsWith("You ")) expect(r.actorIsSelf).toBe(true);
      }
    }
  });

  it("the system actor keeps its own treatment rather than counting as self", () => {
    const rows = rowsOf("typical-shift", "mine", true).filter((r) => r.actorIsSystem);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !r.actorIsSelf)).toBe(true);
  });
});
