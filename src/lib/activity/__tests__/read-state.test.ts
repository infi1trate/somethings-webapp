// THE GUARD ON STANDING RULE 10 (and 11).
//
// Rule 10's failure mode is not a crash. An overlay keyed only by
// (viewerId, eventId) renders correctly in every screenshot and makes the unread
// badge quietly wrong the first time someone switches scope. The first test here
// is the only thing that fails when that key loses its scope segment.

import { describe, expect, it } from "vitest";
import {
  clearRow,
  clearedEventIds,
  getRowState,
  markRead,
  overlayKey,
  restoreRow,
  seedOverlay,
  unreadCount,
  type ReadOverlay,
} from "@/lib/activity/read-state";

const VIEWER = "sup-lydia";
const EVENTS = ["ev-1", "ev-2", "ev-3"];

/** A fresh overlay where everything is unread — i.e. empty, because absent means
 *  unread. */
const empty = (): ReadOverlay => ({});

describe("rule 10 — read state is per scope", () => {
  it("marking read in 'mine' leaves the same event unread in 'all'", () => {
    let overlay = empty();
    overlay = markRead(overlay, VIEWER, "mine", ["ev-1"]);

    expect(getRowState(overlay, VIEWER, "mine", "ev-1")).toBe("read");
    // THE ASSERTION THAT MATTERS. If scope leaves the key, this is "read".
    expect(getRowState(overlay, VIEWER, "all", "ev-1")).toBe("unread");
  });

  it("the unread count in one scope is unaffected by marking the other read", () => {
    let overlay = seedOverlay(EVENTS, EVENTS, VIEWER); // all three unread, both scopes
    expect(unreadCount(overlay, VIEWER, "mine", EVENTS)).toBe(3);
    expect(unreadCount(overlay, VIEWER, "all", EVENTS)).toBe(3);

    overlay = markRead(overlay, VIEWER, "mine", EVENTS);

    expect(unreadCount(overlay, VIEWER, "mine", EVENTS)).toBe(0);
    // The badge on the other scope must not have moved.
    expect(unreadCount(overlay, VIEWER, "all", EVENTS)).toBe(3);
  });

  it("the key carries all three segments", () => {
    // Structural: a key that has lost a segment cannot round-trip two scopes.
    expect(overlayKey(VIEWER, "mine", "ev-1")).not.toBe(
      overlayKey(VIEWER, "all", "ev-1")
    );
  });

  it("two viewers do not share read state", () => {
    let overlay = empty();
    overlay = markRead(overlay, VIEWER, "mine", ["ev-1"]);
    expect(getRowState(overlay, "sup-omar", "mine", "ev-1")).toBe("unread");
  });
});

describe("rule 11 — clearing is never deleting", () => {
  it("a cleared row is still returned by a query that asks for cleared rows", () => {
    let overlay = empty();
    overlay = clearRow(overlay, VIEWER, "mine", "ev-2");

    expect(getRowState(overlay, VIEWER, "mine", "ev-2")).toBe("cleared");
    // Retrievable — the whole point of "cleared" over "deleted".
    expect(clearedEventIds(overlay, VIEWER, "mine", EVENTS)).toEqual(["ev-2"]);
  });

  it("clearing keeps the overlay entry rather than removing it", () => {
    let overlay = empty();
    overlay = clearRow(overlay, VIEWER, "mine", "ev-2");
    expect(Object.keys(overlay)).toContain(overlayKey(VIEWER, "mine", "ev-2"));
  });

  it("a cleared row does not count toward unread", () => {
    let overlay = seedOverlay(EVENTS, EVENTS, VIEWER);
    expect(unreadCount(overlay, VIEWER, "mine", EVENTS)).toBe(3);
    overlay = clearRow(overlay, VIEWER, "mine", "ev-1");
    expect(unreadCount(overlay, VIEWER, "mine", EVENTS)).toBe(2);
  });

  it("marking read does not resurrect a cleared row", () => {
    // The row-marks-read-on-view observer fires on anything on screen, including
    // cleared rows surfaced by the Cleared items filter.
    let overlay = clearRow(empty(), VIEWER, "mine", "ev-2");
    overlay = markRead(overlay, VIEWER, "mine", ["ev-2"]);
    expect(getRowState(overlay, VIEWER, "mine", "ev-2")).toBe("cleared");
  });

  it("clearing is scoped too", () => {
    const overlay = clearRow(empty(), VIEWER, "mine", "ev-2");
    expect(getRowState(overlay, VIEWER, "all", "ev-2")).toBe("unread");
  });
});

describe("restore returns a row to read, not unread", () => {
  it("restoring a cleared row makes it read", () => {
    let overlay = clearRow(empty(), VIEWER, "mine", "ev-3");
    overlay = restoreRow(overlay, VIEWER, "mine", "ev-3");

    // NOT "unread": the viewer cleared it and then went and fetched it back, so
    // they have seen it twice. Pushing the badge up by one here would read as the
    // app inventing work.
    expect(getRowState(overlay, VIEWER, "mine", "ev-3")).toBe("read");
    expect(unreadCount(overlay, VIEWER, "mine", EVENTS)).toBe(2); // ev-1, ev-2
  });
});

describe("seeding a scenario", () => {
  it("names exactly the unread rows and marks the rest read explicitly", () => {
    const overlay = seedOverlay(EVENTS, ["ev-2"], VIEWER);
    expect(unreadCount(overlay, VIEWER, "mine", EVENTS)).toBe(1);
    expect(getRowState(overlay, VIEWER, "mine", "ev-1")).toBe("read");
    expect(getRowState(overlay, VIEWER, "mine", "ev-2")).toBe("unread");
  });

  it("seeds both scopes, so the rule-10 bug cannot look correct on first load", () => {
    const overlay = seedOverlay(EVENTS, ["ev-2"], VIEWER);
    expect(unreadCount(overlay, VIEWER, "all", EVENTS)).toBe(1);
  });
});

describe("the module exposes no delete", () => {
  it("has no export that removes an overlay entry", async () => {
    const mod = await import("@/lib/activity/read-state");
    const names = Object.keys(mod);
    for (const forbidden of ["deleteRow", "removeRow", "purge", "reset"]) {
      expect(names).not.toContain(forbidden);
    }
  });
});
