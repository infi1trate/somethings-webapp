// THE TIMELINE ASSEMBLER — the deterministic core of the escalation record.
//
// WHY THIS IS TESTED RATHER THAN LOOKED AT. Every entry on this surface is a
// claim about when something happened during a crisis, and the two ways it can
// be wrong are both invisible in a screenshot: an entry inside the window that
// was dropped, and an entry outside it that was kept. A probe reads what
// rendered; this reads what the rules produce.
//
// THE ASSERTIONS ARE AN INDEPENDENT TRANSCRIPTION of the contract stated in
// `timeline.ts` — the window is [trigger, resolution], every source is filtered
// to it, manual entries are not, message text is verbatim, and the order is
// chronological. Rewritten from the contract rather than from the code, so a
// rewrite of the code that agrees with itself still fails here.

import { describe, expect, it } from "vitest";
import {
  assembleTimeline,
  escalationWindow,
  withinWindow,
  type TimelineEntry,
  type TimelineSources,
} from "@/lib/monitoring/timeline";
import type { EscalationRecord } from "@/lib/monitoring/escalation";

const NOW = 1_760_000_000_000;
const MINUTE = 60_000;
const HOUR = 3_600_000;

function rec(o: Partial<EscalationRecord> = {}): EscalationRecord {
  return {
    id: "e1",
    teenId: "tk-1",
    teenName: "Naomi R.",
    mentorId: "m1",
    mentorName: "Maria Lopez",
    conversationId: "conv-1",
    triggeredAt: NOW - 2 * HOUR,
    acknowledgedAt: null,
    resolvedAt: NOW - HOUR,
    is911: false,
    caregiverInvolved: null,
    closeOutDone: [],
    ...o,
  };
}

function sources(o: Partial<TimelineSources> = {}): TimelineSources {
  return {
    record: o.record ?? rec(),
    support: [],
    teen: [],
    flags: [],
    noteEvents: [],
    manual: [],
    ...o,
  };
}

const msg = (at: number, text: string, id = `m-${at}`) => ({
  id,
  sender: "mentor" as const,
  senderName: "Maria Lopez",
  at,
  text,
});

const manual = (at: number, text = "Phoned the guardian"): TimelineEntry => ({
  id: `man-${at}`,
  at,
  source: "manual",
  text,
  author: "You",
  actionType: "phoneCall",
});

describe("the window", () => {
  it("opens at the trigger and closes at the resolution", () => {
    const w = escalationWindow(rec());
    expect(w.from).toBe(NOW - 2 * HOUR);
    expect(w.to).toBe(NOW - HOUR);
  });

  it("has no end while the escalation is active — not `now`", () => {
    /* `now` would silently exclude anything arriving while a reader looks at
       the page, which on a live escalation is the whole point. */
    expect(escalationWindow(rec({ resolvedAt: null })).to).toBeNull();
    expect(withinWindow(NOW + HOUR, escalationWindow(rec({ resolvedAt: null })))).toBe(true);
  });

  it("excludes a moment before the trigger, at either end", () => {
    const w = escalationWindow(rec());
    expect(withinWindow(NOW - 3 * HOUR, w)).toBe(false);
    expect(withinWindow(NOW - 30 * MINUTE, w)).toBe(false);
    expect(withinWindow(NOW - 90 * MINUTE, w)).toBe(true);
  });
});

describe("what the assembler states about the record itself", () => {
  it("always opens with the escalation being opened, attributed to the mentor", () => {
    const [first] = assembleTimeline(sources(), "supportThread");
    expect(first.text).toMatch(/Escalation opened/);
    expect(first.author).toBe("Maria Lopez");
    expect(first.at).toBe(NOW - 2 * HOUR);
  });

  it("states no acknowledgement when none is recorded", () => {
    /* An entry stamped at a borrowed instant is worse than no entry: it asserts
       a moment nobody stored. The pane says the absence in words. */
    const out = assembleTimeline(sources(), "supportThread");
    expect(out.some((e) => /Acknowledged/.test(e.text))).toBe(false);
  });

  it("attributes a 911 dispatch to the trigger and says why", () => {
    const out = assembleTimeline(sources({ record: rec({ is911: true }) }), "supportThread");
    const dispatch = out.find((e) => e.source === "dispatch");
    expect(dispatch?.at).toBe(NOW - 2 * HOUR);
    expect(dispatch?.text).toMatch(/no status history exists/);
  });

  it("says nothing about 911 when the record says nothing", () => {
    expect(
      assembleTimeline(sources(), "supportThread").some((e) => e.source === "dispatch")
    ).toBe(false);
  });
});

describe("the conversation sources", () => {
  it("shows the chosen source and not the other one", () => {
    const s = sources({
      support: [msg(NOW - 100 * MINUTE, "support side")],
      teen: [msg(NOW - 100 * MINUTE, "teen side", "t-1")],
    });
    const support = assembleTimeline(s, "supportThread").map((e) => e.text);
    const teen = assembleTimeline(s, "teenConversation").map((e) => e.text);
    expect(support).toContain("support side");
    expect(support).not.toContain("teen side");
    expect(teen).toContain("teen side");
    expect(teen).not.toContain("support side");
  });

  it("keeps message text verbatim and marks it as such", () => {
    const text = "  she said she has the pills with her  ";
    const out = assembleTimeline(
      sources({ support: [msg(NOW - 100 * MINUTE, text)] }),
      "supportThread"
    );
    const m = out.find((e) => e.source === "supportThread");
    // NOT trimmed, NOT summarised — the standing rule.
    expect(m?.text).toBe(text);
    expect(m?.verbatim).toBe(true);
  });

  it("drops a message from outside the escalation's window", () => {
    const out = assembleTimeline(
      sources({
        support: [msg(NOW - 5 * HOUR, "last week"), msg(NOW - 100 * MINUTE, "during")],
      }),
      "supportThread"
    );
    const texts = out.map((e) => e.text);
    expect(texts).toContain("during");
    expect(texts).not.toContain("last week");
  });

  it("drops a flag from outside the window and keeps one inside it", () => {
    const out = assembleTimeline(
      sources({
        flags: [
          { at: NOW - 5 * HOUR, category: "Old" },
          { at: NOW - 100 * MINUTE, category: "Self-harm language" },
        ],
      }),
      "supportThread"
    );
    const flags = out.filter((e) => e.source === "riskFlag").map((e) => e.text);
    expect(flags).toEqual(["Flag raised — Self-harm language"]);
  });
});

describe("hand-logged entries", () => {
  it("are kept even when they fall outside the window", () => {
    /* The entry is stamped when it was LOGGED, and an out-of-band action is
       written up afterwards — so filtering them by the window deleted the one
       entry type the surface promises. */
    const out = assembleTimeline(sources({ manual: [manual(NOW)] }), "supportThread");
    expect(out.some((e) => e.source === "manual")).toBe(true);
  });

  it("and are marked when they do, so the timestamp is not read as the action's", () => {
    const late = assembleTimeline(sources({ manual: [manual(NOW)] }), "supportThread").find(
      (e) => e.source === "manual"
    );
    expect(late?.afterWindow).toBe(true);
  });

  it("are not marked when they fall inside it", () => {
    const inside = assembleTimeline(
      sources({ manual: [manual(NOW - 100 * MINUTE)] }),
      "supportThread"
    ).find((e) => e.source === "manual");
    expect(inside?.afterWindow).toBeUndefined();
  });

  it("keep the author's own words rather than a normalised version", () => {
    const out = assembleTimeline(
      sources({ manual: [manual(NOW - 100 * MINUTE, "mum has her, pills gone")] }),
      "supportThread"
    );
    expect(out.find((e) => e.source === "manual")?.text).toBe("mum has her, pills gone");
  });
});

describe("the order", () => {
  it("is chronological across every source", () => {
    const out = assembleTimeline(
      sources({
        record: rec({ is911: true }),
        support: [msg(NOW - 110 * MINUTE, "early"), msg(NOW - 70 * MINUTE, "later")],
        flags: [{ at: NOW - 90 * MINUTE, category: "Self-harm language" }],
        manual: [manual(NOW - 80 * MINUTE)],
        noteEvents: [{ at: NOW - HOUR, label: "Escalation note recorded complete" }],
      }),
      "supportThread"
    );
    const times = out.map((e) => e.at);
    expect([...times]).toEqual([...times].sort((a, b) => a - b));
  });

  it("every entry carries a source, and none of them is 'unknown'", () => {
    /* The type has no such member — an unattributed entry cannot be
       constructed — and this asserts the property the renderer relies on. */
    const out = assembleTimeline(
      sources({
        record: rec({ is911: true }),
        support: [msg(NOW - 100 * MINUTE, "x")],
        manual: [manual(NOW - 80 * MINUTE)],
      }),
      "supportThread"
    );
    expect(out.length).toBeGreaterThan(3);
    for (const e of out) {
      expect(typeof e.source).toBe("string");
      expect(e.source).not.toBe("unknown");
      expect(Number.isFinite(e.at)).toBe(true);
    }
  });
});
