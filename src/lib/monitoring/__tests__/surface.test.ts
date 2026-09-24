// COVERAGE, PRACTICE, THE LIVE BAND, THE DISPOSITION MODEL, AND ALL 39 FIXTURES.

import { describe, expect, it } from "vitest";
import {
  COVERAGE_CREDIT_RULE_UNRESOLVED,
  FLAG_REVIEW_SLA,
  LIVE_BAND_MAX,
  LIVE_LAYER_ENABLED,
} from "@/lib/monitoring/constants";
import {
  coverageLine,
  coverageProgress,
  creditsCoverage,
  type SupervisedConversation,
} from "@/lib/monitoring/coverage";
import { bandItems, bandStateFor, interrupts, type LiveItem } from "@/lib/monitoring/live";
import { DISPOSITION_VALUES, dispositionById, resolves } from "@/lib/monitoring/disposition";
import { MONITORING_SCENARIOS, monitoringData } from "@/lib/monitoring/scenarios";
import { isSettled, recordLifecycleOf } from "@/lib/monitoring/escalation";

const NOW = new Date("2026-09-15T18:30:00").getTime(); // inside shift hours
const MINUTE = 60_000;
const HOUR = 3_600_000;

function convo(o: Partial<SupervisedConversation> & { id: string }): SupervisedConversation {
  return {
    teenId: o.id,
    teenName: "Ava M.",
    mentorId: "m1",
    mentorName: "Brandon Forant",
    lastActivityAt: NOW - HOUR,
    reviewedAt: null,
    eventCount: 0,
    ...o,
  };
}

describe("coverage", () => {
  it("is progress against a period and never a count of what is left", () => {
    const p = coverageProgress([convo({ id: "a", reviewedAt: NOW }), convo({ id: "b" })], new Set());
    expect(p).toMatchObject({ reviewed: 1, total: 2, period: "shift" });
    const line = coverageLine(p);
    expect(line).toBe("1 of 2 conversations reviewed this shift");
    /* THE INBOX READING MUST NOT APPEAR. "1 unreviewed" is the same number said
       the way this view exists to avoid. */
    expect(line).not.toMatch(/unreviewed|remaining|left|inbox/i);
  });

  it("credits a conversation whose flag was reviewed, without asking for it twice", () => {
    expect(COVERAGE_CREDIT_RULE_UNRESOLVED).toBe("flag-review-or-open");
    expect(creditsCoverage("event-review")).toBe(true);
    expect(creditsCoverage("conversation-open")).toBe(true);
    // The explicit mark is the rule that is NOT in force.
    expect(creditsCoverage("explicit-mark")).toBe(false);
  });

  it("counts a session credit as reviewed even when the fixture says otherwise", () => {
    const p = coverageProgress([convo({ id: "a" })], new Set(["a"]));
    expect(p.reviewed).toBe(1);
  });

  it("is complete rather than undefined when nobody is supervised", () => {
    expect(coverageProgress([], new Set()).fraction).toBe(1);
  });
});

/* ═══ THE `mentor practice` BLOCK IS GONE (addendum §2.1) ═══
   It tested the five deterministic timing rules in `lib/monitoring/practice.ts`
   — each threshold either side of its constant, the shift-hours gate, and that
   every emitted event named what it was measured against and did not claim a
   measurement it had not made. The module is deleted, so these were the only
   tests of code that no longer exists.
   THE STANDING RULE THEY ENCODED OUTLIVES THEM and is worth restating where a
   future producer will read it: a fabricated practice assessment feeding a
   mentor's record is forbidden, so any rule that cannot measure must say it did
   not. `stubbed` was how this file made that checkable. */
describe("the live band", () => {
  const item = (at: number): LiveItem => ({ id: `l${at}`, kind: "awaitingReply", line: "x", at, conversationId: "c" });

  it("is off by default, pending a clinical decision", () => {
    expect(LIVE_LAYER_ENABLED).toBe(false);
    expect(bandStateFor({ enabled: LIVE_LAYER_ENABLED, transport: "connected", paused: false, now: NOW, items: [] })).toBe("off");
  });

  it("separates dormant, degraded, quiet and paused", () => {
    const base = { enabled: true, transport: "connected" as const, paused: false, items: [] as LiveItem[] };
    expect(bandStateFor({ ...base, now: NOW })).toBe("quiet");
    expect(bandStateFor({ ...base, now: new Date("2026-09-16T02:00:00").getTime() })).toBe("dormant");
    expect(bandStateFor({ ...base, transport: "lost", now: NOW })).toBe("degraded");
    expect(bandStateFor({ ...base, paused: true, now: NOW })).toBe("paused");
    expect(bandStateFor({ ...base, now: NOW, items: [item(NOW)] })).toBe("live");
  });

  it("degraded outranks every other state, including paused and off-hours", () => {
    /* THE FAILURE MODE THAT MATTERS MOST: silence because the socket dropped must
       never be reported as a quiet shift. */
    expect(
      bandStateFor({ enabled: true, transport: "lost", paused: true, now: new Date("2026-09-16T02:00:00").getTime(), items: [] })
    ).toBe("degraded");
  });

  it("caps the band and collapses the rest to a count", () => {
    const many = Array.from({ length: LIVE_BAND_MAX + 4 }, (_, i) => item(NOW - i * MINUTE));
    const { shown, overflow } = bandItems(many);
    expect(shown).toHaveLength(LIVE_BAND_MAX);
    expect(overflow).toBe(4);
    // Newest first — perishability is the band's whole contents.
    expect(shown[0].at).toBeGreaterThan(shown[1].at);
  });

  it("lets only an escalation interrupt", () => {
    expect(interrupts("escalationTriggered")).toBe(true);
    for (const k of ["awaitingReply", "mentorOffline", "outreachWindow", "wentActive", "flagArrived"] as const) {
      expect(interrupts(k)).toBe(false);
    }
  });
});

describe("the disposition model", () => {
  it("has a value that neither closes nor escalates, and it is the open question", () => {
    /* WAS "has a path that escalates rather than resolving", over a fourth
       disposition value that §2.8 removed — escalating is a button now. The
       property worth keeping is that not every value closes the event, which
       `watching` carries. */
    const watch = DISPOSITION_VALUES.find((d) => d.effect === "watch");
    expect(watch).toBeTruthy();
    expect(resolves(watch ?? null)).toBe(false);
    expect(watch?.unresolvedQuestion).toBe(true);
  });

  it("only a resolving disposition closes anything", () => {
    for (const d of DISPOSITION_VALUES) {
      expect(resolves(d)).toBe(d.effect === "resolve");
    }
    // NO DISPOSITION RESOLVES NOTHING — the rule Phase 2's acceptance turns on.
    expect(resolves(null)).toBe(false);
    expect(resolves(dispositionById("nonsense"))).toBe(false);
  });

  it("carries the unresolved third state, flagged as the open question", () => {
    const watching = DISPOSITION_VALUES.filter((d) => d.unresolvedQuestion);
    expect(watching).toHaveLength(1);
    expect(watching[0].effect).toBe("watch");
  });

  it("states a consequence for every value, because one of them does not close", () => {
    for (const d of DISPOSITION_VALUES) expect(d.consequence.length).toBeGreaterThan(10);
  });
});

describe("flags carry age, not a deadline", () => {
  it("has no flag review SLA at all", () => {
    /* BLOCKED ON Meg, DEFAULT NONE. While this is null nothing on the surface may
       derive a flag deadline or a flag breach. */
    expect(FLAG_REVIEW_SLA).toBeNull();
  });
});

describe("every scenario fixture", () => {
  it("is the phase file's keys, less the eight the addendum removed", () => {
    /* WAS 40: 39 from the phase file + `escalation-documented` (arch-G, G6),
       which the phase file does not list because the state it reaches did not
       exist then — nothing could be `closed · documented`, so the surface's
       finished state was unreachable and therefore unverifiable.
       NOW 33. The addendum drops the seven `mentor-*` practice fixtures with
       the destination (§2.1) and `coverage-debt` with the coverage surface
       (§2.2), and adds `flag-user-reported` (§2.8) — because the axis-2
       suppression it exercises is exactly the rule that would otherwise be
       asserted over an empty set. The count is asserted rather than the list
       because a fixture arriving unannounced is the thing worth catching. */
    expect(MONITORING_SCENARIOS).toHaveLength(33);
    /* AND NONE OF THE REMOVED ONES IS STILL REACHABLE. A key left in the
       switch with no group entry is a fixture nobody can select and nobody
       will notice is broken. */
    for (const s of MONITORING_SCENARIOS) {
      expect(s.id.startsWith("mentor-"), s.id).toBe(false);
      expect(s.id, s.id).not.toBe("coverage-debt");
    }
  });

  it("builds without throwing, for every key", () => {
    for (const s of MONITORING_SCENARIOS) {
      const data = monitoringData(s.id, "typical-shift", NOW);
      expect(data, s.id).toBeTruthy();
      expect(Array.isArray(data.events), s.id).toBe(true);
      expect(Array.isArray(data.escalations), s.id).toBe(true);
      // COVERAGE ALWAYS HAS A DENOMINATOR — a fixture with no roster would make
      // the header's only progress figure meaningless.
      expect(data.conversations.length, s.id).toBeGreaterThan(0);
    }
  });

  it("is deterministic — the same key and clock build the same surface twice", () => {
    for (const id of ["surge", "escalation-closeout", "live-busy-shift"]) {
      const a = monitoringData(id, "typical-shift", NOW);
      const b = monitoringData(id, "typical-shift", NOW);
      expect(a.events.map((e) => e.id)).toEqual(b.events.map((e) => e.id));
      expect(a.escalations.map((e) => e.id)).toEqual(b.escalations.map((e) => e.id));
    }
  });

  it("makes each named state actually true", () => {
    /* A FIXTURE THAT DOES NOT REACH ITS STATE IS WORSE THAN NO FIXTURE, because
       it is checked once and trusted after. Each assertion below is the state
       the key promises. */
    expect(monitoringData("clean-day", "typical-shift", NOW).events).toHaveLength(0);
    expect(monitoringData("classifier-degraded", "typical-shift", NOW).classifier).toBe("degraded");
    expect(monitoringData("surge", "typical-shift", NOW).events.length).toBeGreaterThanOrEqual(60);
    expect(monitoringData("coverage-debt", "typical-shift", NOW).conversations.filter((c) => c.reviewedAt == null).length)
      .toBeGreaterThan(monitoringData("coverage-debt", "typical-shift", NOW).conversations.length / 2);
    expect(monitoringData("escalation-911", "typical-shift", NOW).escalations[0].is911).toBe(true);
    expect(monitoringData("escalation-concurrent", "typical-shift", NOW).escalations.filter((e) => e.resolvedAt == null).length)
      .toBeGreaterThanOrEqual(2);
    expect(monitoringData("escalation-no-caregiver", "typical-shift", NOW).escalations[0].caregiverInvolved).toBe(false);
    /* THE TERMINAL RECORD. Asserted through `recordLifecycleOf` rather than by
       reading `closeOutDone`, because the promise the key makes is the STATE —
       a fixture that listed the right ids while the derivation disagreed would
       pass a field check and fail the reader. */
    {
      const documented = monitoringData("escalation-documented", "typical-shift", NOW)
        .escalations.find((e) => e.id === "esc-documented");
      expect(documented, "esc-documented").toBeTruthy();
      expect(recordLifecycleOf(documented!, NOW)).toBe("closedDocumented");
      /* AND IT IS SETTLED, which is what takes it out of the region and makes
         its own link the only way in — the path G6 exists to provide. */
      expect(isSettled(documented!, NOW)).toBe(true);
    }
    expect(monitoringData("explicit-media", "typical-shift", NOW).compliance).toBe("explicit-media");
    expect(monitoringData("suspected-death", "typical-shift", NOW).compliance).toBe("suspected-death");
    expect(monitoringData("flag-in-escalation", "typical-shift", NOW).events.some((e) => e.escalationOpen)).toBe(true);
    expect(monitoringData("flag-repeat-pattern", "typical-shift", NOW).events.some((e) => e.patternCount >= 3)).toBe(true);
    expect(monitoringData("flag-no-mentor-reply", "typical-shift", NOW).events.some((e) => !e.mentorReplied)).toBe(true);
    expect(monitoringData("live-transport-lost", "typical-shift", NOW).transport).toBe("lost");
    expect(monitoringData("live-paused", "typical-shift", NOW).paused).toBe(true);
    expect(monitoringData("live-busy-shift", "typical-shift", NOW).live.length).toBeGreaterThan(LIVE_BAND_MAX);
    expect(monitoringData("loading-partial", "typical-shift", NOW).load).toBe("partial");
    expect(monitoringData("teen-deactivated-midreview", "typical-shift", NOW).teenDeactivated).toBeTruthy();
  });

  it("puts the two escalation-ack fixtures either side of the real SLA", () => {
    const unacked = monitoringData("escalation-unacked", "typical-shift", NOW).escalations[0];
    const breach = monitoringData("escalation-breach", "typical-shift", NOW).escalations[0];
    expect(NOW - unacked.triggeredAt).toBeLessThan(5 * MINUTE);
    expect(NOW - breach.triggeredAt).toBeGreaterThan(5 * MINUTE);
  });

  it("puts the two dormant-band fixtures outside shift hours", () => {
    for (const id of ["live-offhours", "escalation-afterhours"]) {
      const data = monitoringData(id, "typical-shift", NOW);
      expect(data.clockOverride, id).toBeTruthy();
      expect(new Date(data.clockOverride ?? 0).getHours(), id).toBeGreaterThanOrEqual(21);
    }
  });

  it("falls back to the task scenario when no monitoring key is set", () => {
    const derived = monitoringData(null, "typical-shift", NOW);
    expect(derived.events.length).toBeGreaterThan(0);
    /* EVERY EVENT CARRIES ITS FLAG. It used to assert `subject === "teenSafety"`
       — the same claim, made against a field that no longer exists because
       there is nothing for it to distinguish this from. */
    expect(derived.events.every((e) => e.flag != null)).toBe(true);
  });
});
