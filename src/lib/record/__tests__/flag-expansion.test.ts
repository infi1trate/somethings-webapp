// THE INVARIANT A SHIPPED REGRESSION BROKE, ASSERTED.
//
// Every flag and escalation row in History opens onto a FIELD SET —
// `EscalationDetail` / `FlagDetail` — and the timeline dispatches to it on
// `event.flagRecord` together with the event's type. The row's `expandable`
// predicate did not name that pair. It listed the assessment table, the
// provenance note, a borrowed disclosure and the "demoted" lines, and every
// flag happened to carry one of the demoted ones — a relational line, which
// read "First flag" on a first occurrence.
//
// Removing that bare line took the expander with it on every record whose flag
// was its first: t13's crisis, t9, t22, t6 and the head of t21's cluster all
// lost the only way into their own clinical detail. 419 unit tests and both
// responsive probes passed through it, because nothing asserted the pair.
//
// WHAT THIS FILE CAN AND CANNOT REACH. `vitest.config.ts` is node-only by an
// explicit decision, so the predicate itself — which lives inside a client
// component — is not importable here. What IS reachable is the half the
// predicate depends on: that a flag or escalation event always arrives carrying
// the record its field set renders from. If that holds and the predicate names
// it, the expander cannot vanish again; if the data half ever stops holding,
// this fails and says so.

import { describe, expect, it } from "vitest";
import { careTimelineFor } from "@/lib/record/care-demo";
import { DEMO_TEENS } from "@/lib/record/people-demo";

/** Fixed, so a fixture's `daysAgo` resolves to the same dates every run. */
const NOW = Date.UTC(2026, 8, 4, 12, 0, 0);

const flagRows = () =>
  DEMO_TEENS.flatMap((t) =>
    careTimelineFor(t.id, NOW, {})
      .filter((e) => e.type === "escalation" || e.type === "risk_flag")
      .map((e) => ({ teen: t.id, event: e }))
  );

describe("flag and escalation rows carry what their expansion renders", () => {
  it("finds flag rows at all — a green suite over an empty set proves nothing", () => {
    // The guard on the guard. Every assertion below is vacuously true if the
    // fixtures stop producing these rows, which is exactly how a test like this
    // rots into decoration.
    expect(flagRows().length).toBeGreaterThan(5);
  });

  it("gives every flag and escalation event a `flagRecord`", () => {
    for (const { teen, event } of flagRows()) {
      expect(event.flagRecord, `${teen} · ${event.id} (${event.type})`).toBeTruthy();
    }
  });

  it("keeps the record's kind and the event's type agreeing", () => {
    // The timeline dispatches on the pair — `flagRecord && type === "escalation"`
    // picks `EscalationDetail`. A record whose kind disagreed with its event type
    // would render the wrong field set, or fall through to the note fallback.
    for (const { teen, event } of flagRows()) {
      const expected = event.type === "escalation" ? "escalation" : "risk_flag";
      expect(event.flagRecord?.kind, `${teen} · ${event.id}`).toBe(expected);
    }
  });

  /* ═══ THE ASSERTION THAT IS NOT HERE, AND WHY ═══
   *
   *  The dispatch has a second half worth guarding: a CLOSURE entry
   *  (`ce-close-*`) carries no `flagRecord` on purpose, so it takes the
   *  `providerNote` fallback rather than a field set. It was written, and then
   *  removed after mutation testing: closures come from the store's own
   *  `careFlagClosures` slice, and with the empty store these fixtures use there
   *  are ZERO of them across all 109 events — the loop never ran, so the
   *  assertion passed while `flagRecord` was deliberately added to every
   *  closure. A test that cannot fail is worse than no test, because it reads
   *  like coverage.
   *
   *  Guarding it properly needs a store with a closure in it, which is a
   *  different fixture than this file has. Left undone rather than faked. */
});
