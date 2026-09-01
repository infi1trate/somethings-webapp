// THE PANE'S DERIVATIONS AND FIXTURES.
//
// These are tested rather than clicked because both derivations read the WHOLE
// event store and return a slice of it — the kind of thing that looks right on
// the one row you happen to open and is wrong on the next.
import { describe, expect, it } from "vitest";
import {
  ICD10,
  HCPCS,
  INSTRUMENTS,
  bandFor,
  codeHistoryFor,
  codeLabel,
  codeSystem,
  isImprovement,
  readingsFor,
  reviewDocumentFor,
  reviewerNoteFor,
} from "@/lib/activity/pane-fixtures";
import { ACTIVITY_SCENARIOS } from "@/lib/activity/seed";

describe("code systems (brief item 12)", () => {
  it("never lets a billing review change codes across systems", () => {
    // THE DEFECT THIS EXISTS FOR: the seed once drew `code` from a list mixing
    // ICD-10 with the HCPCS service code H0038 while `previousCode` was ICD-10,
    // so rows rendered "F32.9 → H0038" — a diagnosis becoming a service line.
    let checked = 0;
    for (const s of ACTIVITY_SCENARIOS) {
      for (const e of s.events) {
        if (e.eventType !== "BILLING_REVIEW_COMPLETE") continue;
        const to = e.payload.code;
        const from = e.payload.previousCode;
        if (typeof to !== "string" || typeof from !== "string") continue;
        checked++;
        expect(codeSystem(to), `${s.id}/${e.id}: ${from} → ${to}`).toBe(
          codeSystem(from)
        );
        expect(codeSystem(to)).not.toBe("unknown");
      }
    }
    expect(checked).toBeGreaterThan(3);
  });

  it("keeps the two systems disjoint", () => {
    const icd = new Set<string>(ICD10.map((c) => c.code));
    // Widened to string: the two lists have disjoint literal types, so `has`
    // on the narrow set rejects an HCPCS code at COMPILE time — which is a nice
    // property and also means the runtime assertion could not be written. The
    // cast keeps the runtime check honest without weakening either type.
    for (const h of HCPCS) expect(icd.has(h.code)).toBe(false);
  });

  it("labels every code it ships", () => {
    for (const c of [...ICD10, ...HCPCS]) expect(codeLabel(c.code)).toBe(c.label);
    expect(codeLabel("ZZ9.9")).toBeNull();
  });
});

describe("instruments", () => {
  it("ships the real item counts", () => {
    // A screen labelled PHQ-9 showing seven items teaches the wrong thing about
    // a tool a supervisor actually uses.
    expect(INSTRUMENTS["PHQ-9"].items).toHaveLength(9);
    expect(INSTRUMENTS["GAD-7"].items).toHaveLength(7);
    expect(INSTRUMENTS["WHO-5"].items).toHaveLength(5);
  });

  it("bands cover the whole range with no gap", () => {
    for (const inst of Object.values(INSTRUMENTS)) {
      for (let score = 0; score <= inst.max; score++) {
        expect(bandFor(inst.id, score), `${inst.id}@${score}`).toBeTruthy();
      }
      expect(inst.bands[inst.bands.length - 1].upTo).toBe(inst.max);
    }
  });

  it("reads WHO-5 in the opposite direction", () => {
    // The one instrument here where higher is BETTER. A trend strip that tinted
    // "down" as good would be actively misleading on it.
    expect(isImprovement("PHQ-9", 14, 9)).toBe(true);
    expect(isImprovement("GAD-7", 9, 14)).toBe(false);
    expect(isImprovement("WHO-5", 9, 14)).toBe(true);
    expect(isImprovement("WHO-5", 14, 9)).toBe(false);
    expect(isImprovement("PHQ-9", 9, 9)).toBeNull();
  });
});

describe("codeHistoryFor — the ledger IS the history", () => {
  const scenario = ACTIVITY_SCENARIOS.find((s) => s.id === "long-history")!;

  it("returns only this teen's completed billing reviews", () => {
    const teen = scenario.events.find((e) => e.eventType === "BILLING_REVIEW_COMPLETE")!;
    const hist = codeHistoryFor(scenario.events, teen.objectId, "2099-01-01T00:00:00.000Z");
    expect(hist.length).toBeGreaterThan(0);
    for (const c of hist) expect(typeof c.to).toBe("string");
  });

  it("excludes the selected event itself", () => {
    const teen = scenario.events
      .filter((e) => e.eventType === "BILLING_REVIEW_COMPLETE")
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
    // Cutoff AT the event's own time — the pane's subject belongs in the header,
    // not in its own history.
    const hist = codeHistoryFor(scenario.events, teen.objectId, teen.occurredAt);
    expect(hist.every((c) => c.at < teen.occurredAt)).toBe(true);
  });

  it("returns newest first", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      const anyTeen = s.events.find((e) => e.eventType === "BILLING_REVIEW_COMPLETE");
      if (!anyTeen) continue;
      const hist = codeHistoryFor(s.events, anyTeen.objectId, "2099-01-01T00:00:00.000Z");
      const times = hist.map((c) => new Date(c.at).getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    }
  });

  it("creates no new history model — every row traces to an event", () => {
    const s = scenario;
    const teen = s.events.find((e) => e.eventType === "BILLING_REVIEW_COMPLETE")!;
    const hist = codeHistoryFor(s.events, teen.objectId, "2099-01-01T00:00:00.000Z");
    for (const c of hist) {
      expect(
        s.events.some(
          (e) =>
            e.eventType === "BILLING_REVIEW_COMPLETE" &&
            e.occurredAt === c.at &&
            e.payload.code === c.to
        )
      ).toBe(true);
    }
  });
});

describe("readingsFor", () => {
  const scenario = ACTIVITY_SCENARIOS.find((s) => s.id === "long-history")!;

  it("returns one instrument's readings, oldest first, capped at five", () => {
    const survey = scenario.events.find((e) => e.eventType === "SURVEY_COMPLETED")!;
    const inst = String(survey.payload.instrument);
    const rs = readingsFor(scenario.events, survey.objectId, inst, "2099-01-01T00:00:00.000Z");
    expect(rs.length).toBeGreaterThan(0);
    expect(rs.length).toBeLessThanOrEqual(5);
    const times = rs.map((r) => new Date(r.at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("includes the selected reading — it is the current value", () => {
    const survey = scenario.events.find((e) => e.eventType === "SURVEY_COMPLETED")!;
    const rs = readingsFor(
      scenario.events,
      survey.objectId,
      String(survey.payload.instrument),
      survey.occurredAt
    );
    expect(rs[rs.length - 1].at).toBe(survey.occurredAt);
  });

  it("never mixes instruments", () => {
    for (const s of ACTIVITY_SCENARIOS) {
      const survey = s.events.find((e) => e.eventType === "SURVEY_COMPLETED");
      if (!survey) continue;
      const inst = String(survey.payload.instrument);
      const rs = readingsFor(s.events, survey.objectId, inst, "2099-01-01T00:00:00.000Z");
      for (const r of rs) {
        const src = s.events.find(
          (e) => e.occurredAt === r.at && e.objectId === survey.objectId
        );
        expect(src?.payload.instrument).toBe(inst);
      }
    }
  });
});

describe("prose fixtures", () => {
  it("are deterministic per seed", () => {
    expect(reviewDocumentFor(7)).toEqual(reviewDocumentFor(7));
    expect(reviewerNoteFor(3)).toBe(reviewerNoteFor(3));
  });

  it("give every document real paragraph structure", () => {
    // A document that is one block renders as a paragraph, which is the thing
    // `DocumentPreview` exists to stop.
    for (let i = 0; i < 6; i++) {
      expect(reviewDocumentFor(i).paragraphs.length).toBeGreaterThan(1);
    }
  });

  it("carry no exclamation points — this surface is calm (standing rule 5)", () => {
    for (let i = 0; i < 6; i++) {
      for (const para of reviewDocumentFor(i).paragraphs) expect(para).not.toContain("!");
      expect(reviewerNoteFor(i)).not.toContain("!");
    }
  });
});
