// THE GUARD ON STANDING RULE 12 — network-scope degradation, enforced at the
// data layer.
//
// THE TRAP THE BRIEF NAMES, and it is a real one: the obvious assertion
// ("payload is absent") passes trivially if the query returns nothing at all. A
// query with a bug that drops every network row would look like perfect privacy.
// So every case here asserts PRESENCE as well as absence — the row IS returned,
// the teen's first name IS there, and only the payload is gone.
//
// ═══════════════════════════════════════════════════════════════════════════
// A FINDING THESE TESTS SURFACED, worth reading before changing them.
//
// THE NETWORK VIEW AS SPECIFIED CONTAINS ONLY DEGRADED ROWS — necessarily, not by
// accident. Its `types` list is [notification] (A3 step 3), and for a supervisor
// only the NETWORK relationship resolves to notification; actor and caseload
// resolve to activity or action. So a full-detail row can never satisfy the
// Network view's type filter.
//
// Which means clause (a) does NOT manifest in Network. It manifests in MY
// CASELOAD: a supervisor's own row about a reassigned teen stays in their own
// ledger, with its payload and its first-person voice. That is still exactly the
// case the brief says matters — "a supervisor's own past rows retroactively lose
// their detail" — it just surfaces one view over.
//
// The cases below therefore each use the view that can actually contain the row,
// and there is an explicit test at the bottom pinning the all-degraded property
// of Network so that it is a documented invariant rather than a surprise.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/lib/activity/events";
import { queryFeed } from "@/lib/activity/query";
import type { ActivityViewer } from "@/lib/activity/resolve-alert-type";
import { ACTIVITY_SCENARIOS, SIM_NOW } from "@/lib/activity/seed";
import { viewByIdStrict } from "@/lib/activity/views";

const NETWORK = viewByIdStrict("network");
const MINE = viewByIdStrict("mine");
// IMPORTED, NOT RESTATED. This was a hardcoded copy of the old SIM_NOW literal,
// which meant the seed's clock and the test's clock were two facts that happened
// to agree — and stopped agreeing the moment A9 moved the shift window.
const NOW = SIM_NOW;

/** A colleague's row about a teen outside the viewer's caseload. Rich payload on
 *  purpose — a thin one would let a broken query pass. */
const OTHERS_ROW: ActivityEvent = {
  id: "ev-net-1",
  eventType: "ESCALATION_CLOSED",
  actorId: "sup-omar",
  actorType: "staff",
  objectType: "teen",
  objectId: "teen-elena",
  occurredAt: "2026-08-26T17:05:00.000Z",
  payload: {
    teenId: "teen-elena",
    code: "F33.1",
    categories: ["ABUSE_DISCLOSURE"],
    riskTier: "high",
    reason: "clinical detail that must never reach network scope",
  },
};

/** The SAME shape, but the viewer is the actor. Clause (a). */
const MY_OWN_ROW: ActivityEvent = {
  ...OTHERS_ROW,
  id: "ev-net-2",
  actorId: "sup-lydia",
};

const viewer = (caseloadTeenIds: string[]): ActivityViewer => ({
  id: "sup-lydia",
  role: "supervisor",
  caseloadTeenIds,
});

const allRows = (days: ReturnType<typeof queryFeed>) =>
  days.flatMap((d) => d.rows);

describe("rule 12 — degradation happens in the query, not the component", () => {
  it("case 1: out of caseload, viewer is NOT the actor — the row IS returned, the teen's first name IS present, the payload is absent", () => {
    const rows = allRows(
      queryFeed({
        events: [OTHERS_ROW],
        viewer: viewer([]), // Elena is not theirs
        view: NETWORK,
        overlay: {},
        unreadOnly: false,
        now: NOW,
      })
    );

    // PRESENCE FIRST — a query that returned nothing would pass the absence
    // assertion below while being completely broken.
    expect(rows).toHaveLength(1);
    expect(rows[0].teenName).toBe("Elena");
    expect(rows[0].actorName).toBe("Omar");
    expect(rows[0].sentence).toContain("Elena");
    expect(rows[0].degraded).toBe(true);

    // ABSENCE. The KEY is gone, not blanked.
    expect(rows[0].payload).toBeUndefined();
    expect("payload" in rows[0]).toBe(false);

    // And nothing from the payload leaked into the rendered sentence.
    expect(rows[0].sentence).not.toContain("F33.1");
    expect(rows[0].sentence).not.toContain("ABUSE");
    expect(rows[0].sentence).not.toContain("high");
    expect(rows[0].sentence).not.toContain("clinical detail");
  });

  it("case 2: out of caseload, viewer IS the actor — full payload present (clause a)", () => {
    const rows = allRows(
      queryFeed({
        events: [MY_OWN_ROW],
        // Empty caseload: the teen has been reassigned away. Clause (b) fails.
        viewer: viewer([]),
        // MY CASELOAD, not Network — see the finding at the top of this file. The
        // row resolves to "activity" (the viewer is its actor), and Network admits
        // only "notification", so Network cannot contain it. My caseload can,
        // because clause (a) is in `inScope` too.
        view: MINE,
        overlay: {},
        unreadOnly: false,
        now: NOW,
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].degraded).toBe(false);
    expect(rows[0].payload).toBeDefined();
    expect(rows[0].payload?.code).toBe("F33.1");
    // AND the first-person voice survives — the other half of what clause (a)
    // protects. A ledger row about your own work must not start describing you in
    // the third person because someone else took the teen.
    expect(rows[0].sentence.startsWith("You ")).toBe(true);
  });

  it("case 3: in caseload — full payload present", () => {
    const rows = allRows(
      queryFeed({
        events: [OTHERS_ROW],
        viewer: viewer(["teen-elena"]),
        // Again My caseload: an in-caseload ESCALATION_CLOSED resolves to
        // "activity" for a supervisor, which Network does not admit.
        view: MINE,
        overlay: {},
        unreadOnly: false,
        now: NOW,
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].degraded).toBe(false);
    expect(rows[0].payload?.riskTier).toBe("high");
  });
});

describe("clause (a) also holds at the scope level", () => {
  it("a supervisor's own row about a reassigned teen stays in My caseload", () => {
    const rows = allRows(
      queryFeed({
        events: [MY_OWN_ROW],
        viewer: viewer([]),
        view: MINE,
        overlay: {},
        unreadOnly: false,
        now: NOW,
      })
    );
    // Without clause (a) in `inScope`, this row would vanish from the viewer's
    // own ledger the moment the teen moved.
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toBeDefined();
  });
});

describe("the network-wide seed carries the clause-(a) case", () => {
  it("has at least one event where the viewer is the actor and the teen is off-caseload", () => {
    const scenario = ACTIVITY_SCENARIOS.find((s) => s.id === "network-wide")!;
    const own = scenario.events.filter(
      (e) =>
        e.actorId === scenario.viewerId &&
        !scenario.caseloadTeenIds.includes(String(e.payload.teenId))
    );
    // Added in A1 per the phase instruction: Lydia's own past billing approval
    // for a teen no longer on her caseload.
    expect(own.length).toBeGreaterThan(0);
  });

  it("that row keeps its full detail in My caseload, while colleagues' rows degrade in Network", () => {
    const scenario = ACTIVITY_SCENARIOS.find((s) => s.id === "network-wide")!;
    const v: ActivityViewer = {
      id: scenario.viewerId,
      role: "supervisor",
      caseloadTeenIds: scenario.caseloadTeenIds,
    };
    const base = {
      events: scenario.events,
      viewer: v,
      overlay: {},
      unreadOnly: false,
      now: NOW,
    };

    const own = allRows(queryFeed({ ...base, view: MINE }));
    const others = allRows(queryFeed({ ...base, view: NETWORK }));

    // BOTH populations must be non-empty, or the test proves nothing.
    expect(own.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);
    expect(own.every((r) => !r.degraded && r.payload !== undefined)).toBe(true);
    expect(others.every((r) => r.degraded && r.payload === undefined)).toBe(true);
  });

  it("EVERY row the Network view returns is degraded — a documented invariant, not an accident", () => {
    // If this ever fails, a full-detail row has become reachable in Network and
    // the degradation story needs re-reading before shipping. See the finding at
    // the top of this file.
    for (const scenario of ACTIVITY_SCENARIOS) {
      const rows = allRows(
        queryFeed({
          events: scenario.events,
          viewer: {
            id: scenario.viewerId,
            role: "supervisor",
            caseloadTeenIds: scenario.caseloadTeenIds,
          },
          view: NETWORK,
          overlay: {},
          unreadOnly: false,
          now: NOW,
        })
      );
      for (const r of rows) {
        expect(r.degraded, `${scenario.id} / ${r.id}`).toBe(true);
        expect(r.payload, `${scenario.id} / ${r.id}`).toBeUndefined();
      }
    }
  });
});
