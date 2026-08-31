// THE VIEW REGISTRY, AND THE TWO WAYS TO ASK IT A QUESTION.
//
// ═══ WHY A TEST FILE FOR A THREE-LINE LOOKUP ═══
//
// Because the lookup's FORGIVINGNESS was the bug (gap row 325). Three tests
// asked for `"billing"` after that view was removed, `viewById` answered with My
// caseload, and they carried on passing against a different question. Only one
// failed, by luck — it asserted degraded rows exist, and `mine` scope has none.
//
// So the contract worth pinning is not "the lookup returns a view". It is:
// production forgives an unknown id because its input is a URL, tests do not
// because their input is a claim about the registry.

import { describe, expect, it } from "vitest";
import {
  ACTIVITY_VIEWS,
  DEFAULT_VIEW_ID,
  viewById,
  viewByIdStrict,
} from "@/lib/activity/views";

describe("the view registry", () => {
  it("is the two SCOPE views, and billing is not among them", () => {
    // The rail is a scope axis; billing is a domain and travels in the filter.
    // B2 removed the third tab, and this is the assertion that keeps it removed.
    expect(ACTIVITY_VIEWS.map((v) => v.id)).toEqual(["mine", "network"]);
    expect(ACTIVITY_VIEWS.some((v) => v.id === "billing")).toBe(false);
  });

  it("has a default that exists in it", () => {
    // A default pointing at a removed id would make `viewById` return undefined
    // through a non-null assertion — a crash rather than a fallback.
    expect(ACTIVITY_VIEWS.some((v) => v.id === DEFAULT_VIEW_ID)).toBe(true);
  });
});

describe("viewById forgives, because its input is a URL", () => {
  it("returns the named view when it exists", () => {
    expect(viewById("network").id).toBe("network");
  });

  it("falls back to the default for an unknown id rather than throwing", () => {
    // A stale bookmark or a mistyped `?scope=` should land the reader on the
    // feed. This is the behaviour tests must NOT rely on.
    expect(viewById("billing").id).toBe(DEFAULT_VIEW_ID);
    expect(viewById("").id).toBe(DEFAULT_VIEW_ID);
  });
});

describe("viewByIdStrict throws, because its input is a claim", () => {
  it("returns the named view when it exists", () => {
    expect(viewByIdStrict("mine").id).toBe("mine");
    expect(viewByIdStrict("network").id).toBe("network");
  });

  it("throws on the exact id that caused row 325", () => {
    expect(() => viewByIdStrict("billing")).toThrow(/Unknown activity view "billing"/);
  });

  it("names the registered ids in the message, and says where billing went", () => {
    // The failure a reader meets is "billing is gone"; the next question is
    // always "so what do I use instead". The message answers it.
    let message = "";
    try {
      viewByIdStrict("billing");
    } catch (e) {
      message = String(e);
    }
    expect(message).toContain("mine, network");
    expect(message).toMatch(/that is a filter and not a view/i);
  });

  it("throws on every unknown id, not just the one we remember", () => {
    for (const id of ["", "Mine", "team", "all", "undefined"]) {
      expect(() => viewByIdStrict(id)).toThrow();
    }
  });
});
