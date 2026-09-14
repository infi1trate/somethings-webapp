// WHAT A NAV BADGE ANNOUNCES IT IS COUNTING.
//
// The badge draws a bare number, so the noun exists only in the aria label —
// which means a sighted reader can never catch this being wrong, and no visual
// check ever will. Every badge used to say "{n} unread". Tasks got a badge in
// arch-A over OPEN BILLING REVIEWS, so it announced "Tasks, 15 unread": the
// wrong noun for the object, and the messaging surface's word used as a
// substitute on a worklist, which the phase brief prohibits outright in aria
// labels.
//
// BOTH HALVES ARE ASSERTED HERE, because the fix could go wrong in two
// directions: Tasks keeping the old word, or the change leaking onto Activity,
// whose badge genuinely does count unread notifications and whose label was
// supposed to come through this untouched.

import { describe, expect, it } from "vitest";
import { NAV, badgeNounFor } from "@/components/settings/nav-items";

describe("the noun a nav badge announces", () => {
  it("does not call open work unread", () => {
    expect(badgeNounFor(NAV.tasks.id)).not.toBe("unread");
  });

  it("calls the Tasks count what it is", () => {
    expect(badgeNounFor(NAV.tasks.id)).toBe("open");
  });

  // The claim made when this landed was that Activity's label is byte-identical
  // to what it was, which is only true while the default is the old string.
  it("leaves Activity saying unread", () => {
    expect(badgeNounFor(NAV.activity.id)).toBe("unread");
  });

  // Every other destination falls through the same default rather than to
  // `undefined`, which would render the label as "15 undefined".
  it("defaults rather than returning nothing", () => {
    for (const id of Object.keys(NAV)) {
      expect(badgeNounFor(id)).toBeTruthy();
    }
    expect(badgeNounFor("a-destination-that-does-not-exist")).toBe("unread");
  });
});
