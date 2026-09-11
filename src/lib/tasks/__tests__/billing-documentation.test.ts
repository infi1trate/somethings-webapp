// A BILLING CODE IS NOT COMMITTED WITHOUT DOCUMENTATION.
//
// The gate itself is DOM behaviour — three fields, a focus move and a live
// region — and it is verified in the browser rather than here. What this file
// holds are the claims a unit test can actually decide, and every one of them
// was a real defect or a real risk during the build:
//
//   · the documentation has to reach the LEDGER, because the ledger is the audit
//     trail. A commit that wrote the code to the event and the prose somewhere
//     else would be two records of one decision with only one of them
//     discoverable.
//   · the field order has to be ONE list. The Care page keeps two — a render
//     order and a validation order — and they disagree, which is why its focus
//     lands on the second field of an empty form.
//   · the three field ids have to match the ones `CareUpdateFields` types its
//     `errors` map against, which this surface declares locally rather than
//     importing (see the note there).

import { describe, expect, it } from "vitest";
import { buildResolveEvent } from "@/lib/tasks/ledger";
import { tasksScenario } from "@/lib/tasks/seed";
import { CARE_UPDATE_SECTIONS, CARE_UPDATE_ASSESSMENTS } from "@/lib/record/care-demo";

const NOW = Date.UTC(2026, 8, 11, 12);

const aBillingItem = () =>
  tasksScenario("typical-shift", NOW).find(
    (i) => i.payload.kind === "billing" && !i.resolvedAt
  )!;

const detail = {
  outcome: "confirmed" as const,
  code: "F33.1",
  changed: true,
  documentation: {
    clinical: "Score moved into the moderate band.",
    diagnostic: "The readings support the updated specifier.",
    assessment: "escalated" as const,
  },
  provenance: {
    clinical: { state: "authored" as const },
    diagnostic: { state: "authored" as const },
  },
};

describe("the commit carries its documentation to the ledger", () => {
  it("puts all three fields on the event payload", () => {
    const ev = buildResolveEvent(aBillingItem(), NOW, detail)!;
    const payload = ev.payload as Record<string, unknown>;
    expect(payload.documentation).toEqual(detail.documentation);
    // And the code still rides along — the documentation is in ADDITION to what
    // the commit already recorded, not a replacement for it.
    expect(payload.code).toBe("F33.1");
    expect(payload.outcome).toBe("confirmed");
  });

  it("puts the per-field provenance on it too", () => {
    /* THE AUDIT-RELEVANT DIFFERENCE. `ai_inserted` means a model's draft is on
       the record unedited; `ai_assisted` means a person revised it. Once notes
       can be inserted here, that distinction is the one thing a reviewer of a
       committed code cannot reconstruct — so it is stored, per field, because one
       claim can be authored while the next one down is not. */
    const payload = buildResolveEvent(aBillingItem(), NOW, detail)!.payload as Record<
      string,
      unknown
    >;
    expect(payload.provenance).toEqual(detail.provenance);
  });

  it("does not drop the documentation when the outcome is a renewal", () => {
    // `unchanged` is a confirmed renewal, and it is documented to the same
    // standard — "nothing changed" is a clinical judgement, not the absence of
    // one.
    const ev = buildResolveEvent(aBillingItem(), NOW, {
      ...detail,
      outcome: "unchanged" as const,
      changed: false,
    })!;
    expect((ev.payload as Record<string, unknown>).documentation).toEqual(
      detail.documentation
    );
  });
});

describe("the three fields are the record's three fields", () => {
  it("uses the labels the care update defines, not its own", () => {
    /* ONE VOCABULARY. If this surface grew its own field names, two documents on
       one teen's record would use different words for the same clinical claim.
       The prose sections come from `CARE_UPDATE_SECTIONS`; the ids this surface
       validates are those two plus the assessment. */
    expect(CARE_UPDATE_SECTIONS.map((s) => s.id)).toEqual(["clinical", "diagnostic"]);
  });

  it("offers exactly the record's three assessment values", () => {
    expect(CARE_UPDATE_ASSESSMENTS.map((a) => a.value)).toEqual([
      "escalated",
      "maintained",
      "improved",
    ]);
  });
});
