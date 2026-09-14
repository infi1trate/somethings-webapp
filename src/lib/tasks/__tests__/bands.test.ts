// WHETHER A BAND HEADER RENDERS, which arch-A changed the answer to.
//
// The predicate used to be "more than one band", on the reasoning that a single
// header repeats the tab label above it. Removing the tab row removed the label,
// so the reasoning went with it — and the failure it left was silent, because
// the band's name stayed in the group's aria label the whole time. A screen
// reader still heard "Intake — 1, group"; a sighted reader saw an unlabelled
// list of rows and had nothing on the page saying what kind of work they were.
//
// Three of the five task scenarios yield exactly one billing band, so this is
// the majority state on the scoped surface, not an edge.

import { describe, expect, it } from "vitest";
import { bandsAreMeaningful } from "@/lib/tasks/bands";
import type { TierBand } from "@/lib/tasks/bands";

const band = (id: string): TierBand =>
  ({ id, label: id, entries: [], taskCount: 1 }) as unknown as TierBand;

describe("whether band headers render", () => {
  it("labels a single band", () => {
    expect(bandsAreMeaningful([band("intake")])).toBe(true);
  });

  it("still labels several", () => {
    expect(bandsAreMeaningful([band("intake"), band("monthly")])).toBe(true);
  });

  // Not a special case so much as a consequence: with no sections there is
  // nothing to draw a header above.
  it("draws nothing when there are no bands", () => {
    expect(bandsAreMeaningful([])).toBe(false);
  });
});
