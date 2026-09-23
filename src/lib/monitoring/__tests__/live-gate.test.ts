// ═══════════════════════════════════════════════════════════════════════════
// THE LIVE LAYER — BUILT, WIRED, AND OFF (Phase 9)
//
// ═══ WHY A DOM CHECK CANNOT VERIFY THIS ═══
//
// `LIVE_LAYER_ENABLED` is false, so `bandStateFor` returns `"off"` and `NowBand`
// renders nothing. Every probe check on the band is therefore an assertion about
// an ABSENCE — and an absence is exactly what a missing mount looks like. The
// existing `live.off-by-default` check on Monitoring has this shape too: it
// would pass if the band had never been wired at all.
//
// "GATED OFF" IS A CLAIM ABOUT TWO THINGS, and they need different instruments:
//
//  1 · THE GATE IS THE ONLY THING IN THE WAY. Same inputs, `enabled` flipped,
//      and the state goes from "off" to a real one. That is a unit assertion.
//  2 · THE SURFACES ACTUALLY MOUNT IT. Decidable only from the source, because
//      nothing renders while the flag is false. Read here rather than grepped in
//      a shell so it fails with the other tests and names what is missing.
//
// ═══ AND IT FAILS LOUDLY THE DAY THE FLAG IS FLIPPED ═══
//
// Same posture as `surfacing.test.ts`'s two blocked constants: turning this on
// without reading what it commits to is the thing to prevent, so the assertion
// carries the instruction rather than a bare `toBe(false)`.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIVE_LAYER_ENABLED, LIVE_BAND_MAX } from "@/lib/monitoring/constants";
import {
  bandItems,
  bandStateFor,
  interrupts,
  isWithinShiftHours,
  LIVE_STATE_LINE,
  type LiveItem,
} from "@/lib/monitoring/live";

/** Block and line comments out. Crude, and a false POSITIVE is a failing test to
 *  investigate rather than a false pass — which is the right way round. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Inside `MENTOR_ONLINE_HOURS` (15.5–21), so `dormant` is not the answer for a
 *  reason unrelated to the gate. Picked with the local clock the module reads. */
function withinShift(): number {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d.getTime();
}

const ITEM: LiveItem = {
  id: "l1",
  kind: "awaitingReply",
  line: "Ava M. waiting 14m — Brandon Forant",
  at: withinShift(),
  conversationId: "tk-ava",
};

describe("the gate is the only thing between off and on", () => {
  it("is off, and flipping it is a product decision with an owner", () => {
    expect(
      LIVE_LAYER_ENABLED,
      "BLOCKED · Dr. Nissan / Meg. A live view of mentor–teen exchanges changes " +
        "what it feels like to be supervised and creates a plausible performance " +
        "effect on mentors. Before flipping this: confirm the posture, and check " +
        "that Today's band still does not compete with the escalation strip's " +
        "assertive announcement (see `interrupts`)."
    ).toBe(false);
  });

  it("returns off for inputs that would otherwise be live", () => {
    const base = {
      transport: "connected" as const,
      paused: false,
      now: withinShift(),
      items: [ITEM],
    };
    // THE SAME INPUTS, TWICE. If the enabled arm did not change the answer, the
    // band would be dead rather than gated and nothing else here would notice.
    expect(bandStateFor({ ...base, enabled: false })).toBe("off");
    expect(bandStateFor({ ...base, enabled: true })).toBe("live");
  });

  it("still distinguishes its three silences once enabled", () => {
    // `dormant`, `degraded` and `quiet` look identical if the band says nothing,
    // and on a safety surface "nothing is happening" and "I cannot tell you what
    // is happening" are the two that must not be confusable.
    const base = { enabled: true, paused: false, items: [] as LiveItem[] };
    expect(
      bandStateFor({ ...base, transport: "lost", now: withinShift() })
    ).toBe("degraded");
    expect(
      bandStateFor({ ...base, transport: "connected", now: withinShift() })
    ).toBe("quiet");
    const d = new Date();
    d.setHours(3, 0, 0, 0);
    expect(
      bandStateFor({ ...base, transport: "connected", now: d.getTime() })
    ).toBe("dormant");
    expect(isWithinShiftHours(d.getTime())).toBe(false);
    // And every silence has words. A state with no line renders an empty band,
    // which is the thing all three exist to avoid.
    for (const k of ["dormant", "degraded", "quiet", "paused"] as const) {
      expect(LIVE_STATE_LINE[k].length, k).toBeGreaterThan(20);
    }
  });

  it("caps the band and reports overflow as a count, newest first", () => {
    const many = Array.from({ length: LIVE_BAND_MAX + 3 }, (_, i) => ({
      ...ITEM,
      id: `l${i}`,
      at: withinShift() + i * 1000,
    }));
    const { shown, overflow } = bandItems(many);
    expect(shown).toHaveLength(LIVE_BAND_MAX);
    expect(overflow).toBe(3);
    // Newest first — the band is the only place on any of these surfaces where
    // recency is the ordering, because perishability is its whole contents.
    expect(shown[0].id).toBe(`l${many.length - 1}`);
  });
});

describe("only an escalation arrival may interrupt", () => {
  it("reserves it for escalationTriggered and nothing else", () => {
    expect(interrupts("escalationTriggered")).toBe(true);
    for (const k of [
      "awaitingReply",
      "mentorOffline",
      "outreachWindow",
      "wentActive",
      "flagArrived",
    ] as const) {
      expect(interrupts(k), k).toBe(false);
    }
  });

  it("and Today's band does not claim the announcement the strip owns", () => {
    // ═══ THE DOUBLE-INTERRUPT THIS PREVENTS ═══
    // Today already has the escalation strip at `aria-live="assertive"`. If the
    // band were also assertive, one escalation would announce twice — and the
    // band's own note says assertive "is reserved for escalation arrival, and it
    // lives on the escalation region, not here".
    /* COMMENTS STRIPPED FIRST. The band's own note contains the string
       `aria-live="assertive"` — saying that it is reserved for the escalation
       region and "not here" — so an unstripped search matches the sentence
       explaining the rule and fails the rule. Same technique as Phase 4's source
       grep, and the same reason: this codebase records what it does NOT do. */
    const band = stripComments(
      readFileSync(
        join(process.cwd(), "src/components/monitoring/now-band.tsx"),
        "utf8"
      )
    );
    expect(band).toContain('aria-live="off"');
    expect(band).not.toContain('aria-live="assertive"');
  });
});

describe("both surfaces mount it, so the absence on screen is the gate", () => {
  /** Read from source, because nothing renders while the flag is false — see the
   *  module note on why a DOM check cannot tell gated from unbuilt. */
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  for (const [name, path] of [
    ["Today", "src/components/today/today-page.tsx"],
    ["Monitoring", "src/components/monitoring/monitoring-page.tsx"],
  ] as const) {
    it(`${name} renders NowBand and feeds it the gate`, () => {
      const src = read(path);
      expect(src, `${name} does not mount NowBand`).toContain("<NowBand");
      expect(src, `${name} does not call bandStateFor`).toContain(
        "bandStateFor"
      );
      // THE GATE, NOT A LITERAL. `enabled: true` hardcoded anywhere here would
      // turn the layer on for one surface and leave the constant lying.
      expect(src).toContain("enabled: LIVE_LAYER_ENABLED");
      expect(src, `${name} hardcodes enabled`).not.toMatch(/enabled:\s*true/);
    });
  }

  it("gives Today a pause control, because auto-updating content needs one", () => {
    // WCAG 2.2.2. Page-local state: storing the preference would be a second
    // store write on a route the §4 acceptance test allows exactly one.
    const src = read("src/components/today/today-page.tsx");
    expect(src).toContain("onTogglePause");
    expect(src).toContain("setLivePaused");
    // And it must not reach the store — `shiftLastSeenAt` is the one write.
    expect(src).not.toMatch(/setLivePaused[^;]*useOnboardingStore/);
  });
});
