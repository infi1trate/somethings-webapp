// THE PROVENANCE A COMMITTED RECORD CARRIES, AND WHAT THE TWO READ SURFACES GET.
//
// Workstream D put the same disclosure on two surfaces that render the same
// record through entirely different code: the Care update card walks
// `CARE_UPDATE_SECTIONS` over `CareUpdateRecord`, and History renders a
// `CareEvent` built by `careUpdateToEvent`. A disclosure is only as good as the
// weaker of those two paths, and only the second one has a seam a test can hold.
//
// SO THIS FILE ASSERTS ON THE SEAM: that the event carries per-field provenance
// at all, that it agrees with the record it was built from, that the flat
// `providerNote` still carries every word (it is the search haystack — a row a
// reader cannot find is a row that is not on the surface), and that the fixture
// roster actually contains the three cases the disclosure has to handle.
//
// WHY THE FIXTURE ASSERTIONS ARE HERE AND NOT ONLY IN THE SCENARIO SUITE: the
// component cannot be proven by a fixture that does not exist, and "we have a
// record where the FIRST field discloses and the second does not" is a claim
// about the demo data that a person editing prose can break without noticing.

import { describe, expect, it } from "vitest";
import {
  CARE_UPDATE_SECTIONS,
  careTimelineFor,
  fixtureCareUpdatesFor,
  type CareEvent,
  type CareUpdateRecord,
} from "@/lib/record/care-demo";
import { discloses } from "@/lib/record/field-provenance";

const NOW = Date.UTC(2026, 8, 8);

/** ═══ TWO KINDS OF `care_update` ROW, AND THE DIFFERENCE IS THE WHOLE TEST ═══
 *
 *  `structuredRows` are the ones built from a `CareUpdateRecord` — the
 *  three-field clinical form. `logRows` are free-prose operational entries that
 *  reuse the same event type: "Guardian contact logged", "Mentor coaching note".
 *  t17 carries 19 of the second kind and 2 of the first, which is the opposite
 *  of what the type name suggests and was found by an assertion that assumed
 *  otherwise and failed.
 *
 *  Going through `careTimelineFor` rather than `careUpdateToEvent` (module-
 *  private) is deliberate: it is the path History actually takes, so these
 *  cannot pass while the timeline builds its rows some other way. */
function updateRows(teenId: string): CareEvent[] {
  return careTimelineFor(teenId, NOW, undefined).filter(
    (e) => e.type === "care_update"
  );
}

/** The rows a `CareUpdateRecord` is behind, matched by id rather than by
 *  "has sections" — a filter on the thing under test would make every
 *  assertion below vacuous the moment the field stopped being set. */
function structuredRows(teenId: string): CareEvent[] {
  const ids = new Set(updates(teenId).map((u) => `ce-cu-${u.id}`));
  return updateRows(teenId).filter((e) => ids.has(e.id));
}

function updates(teenId: string): CareUpdateRecord[] {
  return fixtureCareUpdatesFor(teenId, NOW);
}

describe("the event History renders carries the record's provenance", () => {
  it("puts one note section per filled prose field, in the record's own order", () => {
    const rows = structuredRows("t17");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.noteSections?.map((s) => s.id)).toEqual([
        "clinical",
        "diagnostic",
      ]);
    }
  });

  it("gives the free-prose log rows no sections — the fallback is load-bearing", () => {
    // THE CASE THAT BREAKS A TYPE-BASED CHECK. These rows are `care_update` and
    // have no clinical form behind them, so a `NoteBody` that branched on the
    // event type would put a "Clinical summary" heading and a provenance
    // footnote over a note about a guardian phone call.
    const structured = new Set(structuredRows("t17").map((e) => e.id));
    const logs = updateRows("t17").filter((e) => !structured.has(e.id));
    expect(logs.length).toBeGreaterThan(10);
    for (const row of logs) {
      expect(row.noteSections).toBeUndefined();
      // They still have prose, which is what the fallback renders.
      expect(row.providerNote).toBeTruthy();
    }
  });

  it("only ever sections fields that exist in the form's own section list", () => {
    const known = new Set(CARE_UPDATE_SECTIONS.map((s) => s.id));
    for (const row of structuredRows("t17"))
      for (const s of row.noteSections!) expect(known.has(s.id)).toBe(true);
  });

  it("agrees with the record field by field, on every roster record with updates", () => {
    // Not just t17: the mapping is a three-branch conditional, and a swap of the
    // two branches would still satisfy a single-record test whose two fields
    // happen to hold the same state.
    let checked = 0;
    for (const teenId of ["t17", "t19", "t18", "t21", "t22"]) {
      const recs = updates(teenId);
      const rows = structuredRows(teenId);
      expect(rows.length).toBe(recs.length);
      for (const rec of recs) {
        const row = rows.find((r) => r.id === `ce-cu-${rec.id}`);
        expect(row, `no row for ${rec.id}`).toBeDefined();
        const byId = new Map(row!.noteSections!.map((s) => [s.id, s]));
        expect(byId.get("clinical")?.provenance).toBe(rec.clinicalProvenance);
        expect(byId.get("diagnostic")?.provenance).toBe(
          rec.diagnosticProvenance
        );
        checked++;
      }
    }
    // The loop above is vacuous if the roster stops carrying updates.
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it("keeps every word in providerNote, because that is the search haystack", () => {
    for (const teenId of ["t17", "t19"])
      for (const row of structuredRows(teenId)) {
        expect(row.providerNote).toBeTruthy();
        for (const s of row.noteSections!) {
          expect(row.providerNote).toContain(s.text);
          expect(row.providerNote).toContain(s.label);
        }
      }
  });

  it("carries no note sections on any other event type", () => {
    // `NoteBody` branches on this field to decide whether a row has fields at
    // all. A flag or escalation acquiring one would put clinical-form labels
    // over free prose.
    const others = careTimelineFor("t17", NOW, undefined).filter(
      (e) => e.type !== "care_update"
    );
    expect(others.length).toBeGreaterThan(0);
    for (const e of others) expect(e.noteSections).toBeUndefined();
  });
});

describe("the fixture roster covers what the disclosure has to render", () => {
  it("has a record where the diagnostic field discloses and the clinical does not", () => {
    const [current] = updates("t17").sort((a, b) => b.createdAt - a.createdAt);
    expect(discloses(current.diagnosticProvenance ?? "authored")).toBe(true);
    expect(discloses(current.clinicalProvenance ?? "authored")).toBe(false);
  });

  it("has a record where the clinical field discloses and the diagnostic does not", () => {
    // THE MIRROR. Without it, a suffix wired to the wrong section renders
    // correctly across the whole roster.
    const [current] = updates("t19").sort((a, b) => b.createdAt - a.createdAt);
    expect(discloses(current.clinicalProvenance ?? "authored")).toBe(true);
    expect(discloses(current.diagnosticProvenance ?? "authored")).toBe(false);
  });

  it("has a fully authored record, which must render nothing at all", () => {
    const authored = ["t18", "t21", "t22"].flatMap(updates).filter(
      (u) =>
        !discloses(u.clinicalProvenance ?? "authored") &&
        !discloses(u.diagnosticProvenance ?? "authored")
    );
    expect(authored.length).toBeGreaterThan(0);
  });

  it("exercises both disclosing states, and ai_inserted on a superseded version", () => {
    const all = ["t17", "t19", "t18", "t21", "t22"].flatMap(updates);
    const states = new Set(
      all.flatMap((u) => [u.clinicalProvenance, u.diagnosticProvenance])
    );
    expect(states.has("ai_inserted")).toBe(true);
    expect(states.has("ai_assisted")).toBe(true);

    // THE CHAIN IS THE POINT: the same field, two versions, two different
    // states — so the disclosure is proven to be per record VERSION rather than
    // per record. Both entries keep rendering, which is why an amendment does
    // not overwrite.
    const chain = updates("t17").sort((a, b) => a.createdAt - b.createdAt);
    expect(chain).toHaveLength(2);
    expect(chain[1].amends).toBe(chain[0].id);
    expect(chain[0].diagnosticProvenance).toBe("ai_inserted");
    expect(chain[1].diagnosticProvenance).toBe("ai_assisted");
    expect(chain[0].diagnosticProvenance).not.toBe(
      chain[1].diagnosticProvenance
    );
  });
});
