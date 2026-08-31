// A12's HARD RULE, asserted. "Add a test: selecting a degraded network-scope row
// returns no object detail."
//
// The gate is the point of this file. Everything else here exists so that a change
// which loosens the gate has to break something loud.

import { describe, expect, it } from "vitest";
import type { ActivityDomain, ActivityEvent } from "@/lib/activity/events";
import { EMPTY_FILTERS } from "@/lib/activity/filters";
import { objectDetailFor, DEGRADED_MESSAGE } from "@/lib/activity/inspector";
import { queryFeed, type FeedRow } from "@/lib/activity/query";
import type { ActivityViewer } from "@/lib/activity/resolve-alert-type";
import { ACTIVITY_SCENARIOS, SIM_NOW, STAFF, scenarioById } from "@/lib/activity/seed";
import { ACTIVITY_VIEWS, viewByIdStrict } from "@/lib/activity/views";

const viewerFor = (scenarioId: string): ActivityViewer => {
  const s = scenarioById(scenarioId);
  return { id: s.viewerId, role: "supervisor", caseloadTeenIds: s.caseloadTeenIds };
};

function rowsOf(
  scenarioId: string,
  viewId: string,
  includeActions = true,
  /** The DOMAIN axis, which is separate from the view's SCOPE axis. Added when
   *  the billing view was found to be fictional here (gap row 325): a billing
   *  ledger is the widest scope PLUS this filter, and without the parameter the
   *  only way to express it was the id that no longer exists. */
  domains: ActivityDomain[] = []
): FeedRow[] {
  const s = scenarioById(scenarioId);
  return queryFeed({
    events: s.events,
    viewer: viewerFor(scenarioId),
    view: viewByIdStrict(viewId),
    overlay: {},
    unreadOnly: false,
    filters: { ...EMPTY_FILTERS, includeActions, domains },
    now: SIM_NOW,
  }).flatMap((d) => d.rows);
}

const detail = (scenarioId: string, row: FeedRow) =>
  objectDetailFor({
    row,
    events: scenarioById(scenarioId).events,
    viewer: viewerFor(scenarioId),
    now: SIM_NOW,
  });

// ═══ THE GATE ══════════════════════════════════════════════════════════════

describe("a degraded network-scope row returns no object detail", () => {
  it("every degraded row in the Network view returns null", () => {
    const rows = rowsOf("network-wide", "network");
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.degraded)).toBe(true);
    for (const r of rows) {
      expect(detail("network-wide", r), r.sentence).toBeNull();
    }
  });

  it("holds across every scenario and every view, not just the network one", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      // EVERY REGISTERED VIEW, read from the registry. The typed list still had
      // "billing" in it long after that view was removed, so this loop covered
      // `mine` twice and believed it had covered three views.
      for (const viewId of ACTIVITY_VIEWS.map((v) => v.id)) {
        for (const r of rowsOf(s.id, viewId)) {
          if (!r.degraded) continue;
          expect(detail(s.id, r), `${s.id}/${viewId}`).toBeNull();
        }
      }
    }
  });

  it("returns null rather than a blanked object — there is no half to render", () => {
    const degraded = rowsOf("network-wide", "network")[0];
    const d = detail("network-wide", degraded);
    // Null, specifically. An object with empty fields would let a component render
    // a heading and an empty list, which is a leak of "this teen exists".
    expect(d).toBeNull();
    expect(DEGRADED_MESSAGE).toBe(
      "Full context is available for mentees on your caseload."
    );
  });

  it("THE GATE IS DERIVED, NOT TRUSTED: a lying row still gets nothing", () => {
    // A caller that hands over a row with `degraded: false` — a hand-built row, or
    // one produced for a different viewer — must not thereby earn detail.
    const degraded = rowsOf("network-wide", "network")[0];
    const lying: FeedRow = { ...degraded, degraded: false };
    expect(detail("network-wide", lying)).toBeNull();
  });

  it("clause (a): the viewer's OWN row about an off-caseload teen DOES open", () => {
    // network-wide seeds Lydia's own past approval for Theo, who has left her
    // caseload. A5 clause (a) keeps it open, so the inspector must too — otherwise
    // the pane contradicts the row sitting next to it.
    // WAS `rowsOf("network-wide", "billing")`, which `viewById` answered with My
    // caseload — the exact opposite of this test's subject, an OFF-caseload teen.
    // It passed anyway because Lydia's own approval survives in `mine` too, so it
    // was asserting clause (a) against a scope where the clause is not needed.
    // Widest scope is the one that makes the assertion mean something.
    const own = rowsOf("network-wide", "network", true, ["billing"]).find(
      (r) => r.actorIsSelf && r.eventType === "BILLING_REVIEW_COMPLETE"
    );
    expect(own).toBeDefined();
    expect(own!.degraded).toBe(false);
    const d = detail("network-wide", own!);
    expect(d).not.toBeNull();
    expect(d!.kind).toBe("teen");
  });
});

// ═══ WHAT THE PANE SAYS WHEN IT IS ALLOWED TO SPEAK ════════════════════════

describe("teen detail", () => {
  const teenRow = () => {
    const r = rowsOf("typical-shift", "mine").find(
      (x) => x.objectType === "teen" && !x.degraded
    );
    expect(r).toBeDefined();
    return r!;
  };

  it("carries the four facts A12 asks for", () => {
    const d = detail("typical-shift", teenRow())!;
    expect(d.kind).toBe("teen");
    const labels = d.fields.map((f) => f.label);
    expect(labels).toEqual(["Billing code", "Intake", "Mentor", "Open escalations"]);
    expect(d.href).toContain("/app/mentees");
  });

  it("the title is a FIRST NAME — never a surname (standing rule 6)", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of rowsOf(s.id, "mine")) {
        const d = detail(s.id, r);
        if (!d) continue;
        // One word, or a possessive conversation title. No space-separated surname.
        expect(d.title).not.toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      }
    }
  });

  it("open escalations are derived from the ledger and never negative", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      for (const r of rowsOf(s.id, "mine")) {
        const d = detail(s.id, r);
        const f = d?.fields.find((x) => x.label === "Open escalations");
        if (!f) continue;
        expect(f.value).not.toMatch(/-/);
      }
    }
  });

  it("a teen with no completed review says so rather than rendering a dash", () => {
    const rows = rowsOf("quiet-shift", "mine");
    const withoutCode = rows
      .map((r) => detail("quiet-shift", r))
      .filter((d): d is NonNullable<typeof d> => d?.kind === "teen")
      .map((d) => d.fields.find((f) => f.label === "Billing code")!.value);
    expect(withoutCode.length).toBeGreaterThan(0);
    for (const v of withoutCode) {
      expect(v).not.toBe("—");
      expect(v.length).toBeGreaterThan(3);
    }
  });
});

describe("conversation detail", () => {
  it("names the participants and counts the flags", () => {
    const row = rowsOf("heavy-day", "mine").find(
      (r) => r.objectType === "conversation" && !r.degraded
    );
    expect(row).toBeDefined();
    const d = detail("heavy-day", row!)!;
    expect(d.kind).toBe("conversation");
    expect(d.fields.map((f) => f.label)).toEqual(["Participants", "Risk flags"]);
    expect(Number(d.fields[1].value)).toBeGreaterThan(0);
    expect(d.href).toContain("/app/chat");
  });
});

describe("mentor detail — unreachable from today's fixtures, so tested directly", () => {
  it("renders role, lead mentor and review status", () => {
    // No event type produces a mentor-object row (see the note in inspector.ts and
    // gap row 237), so the branch is exercised against a synthetic event.
    const s = scenarioById("typical-shift");
    const synthetic: ActivityEvent = {
      id: "ev-synthetic-mentor",
      eventType: "PRESENTATION_REVIEW_COMPLETE",
      actorId: s.viewerId,
      actorType: "staff",
      objectType: "mentor",
      objectId: STAFF.brandon.id,
      occurredAt: new Date(SIM_NOW - 3600_000).toISOString(),
      payload: {},
    };
    const row = { ...rowsOf("typical-shift", "mine")[0], eventIds: [synthetic.id], objectType: "mentor" as const };
    const d = objectDetailFor({
      row,
      events: [...s.events, synthetic],
      viewer: viewerFor("typical-shift"),
      now: SIM_NOW,
    });
    expect(d).not.toBeNull();
    expect(d!.kind).toBe("mentor");
    expect(d!.fields.map((f) => f.label)).toEqual(["Role", "Lead mentor", "Review"]);
    expect(d!.fields[0].value).toBe("Mentor");
  });
});
