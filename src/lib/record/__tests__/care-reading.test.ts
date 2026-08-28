// THE CARE SUMMARY'S GUARDRAILS, ASSERTED OVER EVERY TEEN IN THE FIXTURE.
//
// Phase 3's rules are not style preferences — they are the conditions under which
// it is acceptable to render a generated paragraph about a child to a mentor. A
// grep proves them once, on the day someone runs it. These prove them on every
// commit, over every teen, in every dimension, including the readings a future
// edit adds.

import { describe, expect, it } from "vitest";
import {
  MIN_DAYS_ENGAGED,
  MIN_EXCHANGES,
  READING_WINDOW_DAYS,
  careReadingFor,
  replyTimeLabel,
} from "@/lib/record/care-reading";
import { DEMO_TEENS } from "@/lib/record/people-demo";

const NOW = new Date("2026-08-26T20:05:00.000Z").getTime();

const allReadings = () =>
  DEMO_TEENS.map((t) => ({ id: t.id, reading: careReadingFor(t.id, NOW) }));

/** Every string this panel could ever render for a teen. */
const allProse = () => {
  const out: { teen: string; where: string; text: string }[] = [];
  for (const { id, reading } of allReadings()) {
    if (!reading) continue;
    for (const d of reading.dimensions) {
      out.push({ teen: id, where: `${d.id}.label`, text: d.label });
      out.push({ teen: id, where: `${d.id}.reading`, text: d.reading });
      for (const m of d.metrics ?? [])
        out.push({ teen: id, where: `${d.id}.metric`, text: m });
      if (d.moment)
        out.push({ teen: id, where: `${d.id}.moment`, text: d.moment.label });
      if (d.flagPointer)
        out.push({ teen: id, where: `${d.id}.flag`, text: d.flagPointer.label });
    }
  }
  return out;
};

// ═══ GUARDRAIL 1 · SENTIMENT IS NEVER SCORED ═══════════════════════════════

describe("no sentiment score anywhere", () => {
  it("the `sound` dimension carries a direction phrase and no digit", () => {
    let checked = 0;
    for (const { id, reading } of allReadings()) {
      const sound = reading?.dimensions.find((d) => d.id === "sound");
      if (!sound) continue;
      checked++;
      // Exactly one metric, and it is words.
      expect(sound.metrics, id).toHaveLength(1);
      expect(sound.metrics![0], id).not.toMatch(/\d/);
      // No trend arrow on this dimension — a direction phrase already says it,
      // and an arrow beside "harder" starts to read as a magnitude.
      expect(sound.trend, id).toBeUndefined();
      expect(sound.reading, id).not.toMatch(/\b\d+\s*(\/|out of)\s*\d+\b/);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("no reading contains a scale, a gauge or a score word", () => {
    const banned = /\b(score|scored|scoring|rating|rated|out of (five|ten|10|5)|\d\s*\/\s*(5|10)|severity|band)\b/i;
    for (const p of allProse()) {
      expect(banned.test(p.text), `${p.teen} ${p.where}: ${p.text}`).toBe(false);
    }
  });

  it("no emoji anywhere in the prose", () => {
    for (const p of allProse()) {
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(p.text), p.where).toBe(false);
    }
  });
});

// ═══ GUARDRAIL 3 · NO CLINICAL OR DIAGNOSTIC LANGUAGE ══════════════════════

describe("no clinical or diagnostic language", () => {
  const banned = [
    "depress", "anxious", "anxiety disorder", "manic", "bipolar", "ptsd",
    "diagnos", "dsm", "phq", "gad-7", "gad7", "comorbid", "symptom",
    "disorder", "episode", "prognosis", "clinical picture", "presentation of",
    "moderate-severe", "mild", "moderate", "severe", "minimal",
  ];
  it("no banned clinical term appears in any reading", () => {
    for (const p of allProse()) {
      for (const term of banned) {
        expect(
          p.text.toLowerCase().includes(term),
          `${p.teen} ${p.where} contains "${term}": ${p.text}`
        ).toBe(false);
      }
    }
  });
});

// ═══ GUARDRAIL 4 · NO PREDICTION ═══════════════════════════════════════════

describe("no forward-looking claim about the teen", () => {
  const banned = [
    "at risk of", "likely to", "unlikely to", "will probably", "expect them",
    "expected to", "on track to", "heading for", "trending toward",
    "may disengage", "could disengage", "risk of disengag", "churn",
    "predict", "forecast", "probability", "if this continues",
  ];
  it("no predictive phrasing appears in any reading", () => {
    for (const p of allProse()) {
      for (const term of banned) {
        expect(
          p.text.toLowerCase().includes(term),
          `${p.teen} ${p.where} contains "${term}": ${p.text}`
        ).toBe(false);
      }
    }
  });

  it("readings are past or present tense, never 'will'", () => {
    for (const p of allProse()) {
      expect(/\bwill\b/i.test(p.text), `${p.teen} ${p.where}: ${p.text}`).toBe(false);
    }
  });
});

// ═══ GUARDRAIL 5 · NO VERBATIM CONTENT ═════════════════════════════════════

describe("no message content is rendered", () => {
  it("no reading contains a quotation mark", () => {
    for (const p of allProse()) {
      // Curly and straight, opening and closing.
      expect(/["“”]/.test(p.text), `${p.teen} ${p.where}: ${p.text}`).toBe(false);
    }
  });

  it("no reading says it is quoting", () => {
    const banned = /\b(said|wrote|texted|messaged|in their words|verbatim|quote)\b/i;
    for (const p of allProse()) {
      // "Said a parent has changed shift pattern" is a PARAPHRASE and would trip
      // a naive check, so this asserts the absence of quoting MACHINERY rather
      // than of reported speech: a quotation mark plus an attribution verb.
      if (banned.test(p.text)) {
        expect(/["“”]/.test(p.text), `${p.teen} ${p.where} attributes AND quotes`).toBe(false);
      }
    }
  });
});

// ═══ GUARDRAIL 2 · NEVER THE ONLY PLACE A CONCERN SURFACES ═════════════════

describe("Worth watching never authors a warning", () => {
  it("every Worth watching row either points at a flag or says none exists", () => {
    let checked = 0;
    for (const { id, reading } of allReadings()) {
      const w = reading?.dimensions.find((d) => d.id === "worthWatching");
      if (!w) continue;
      checked++;
      const hasPointer = !!w.flagPointer;
      const saysNone = w.noFlagOnRecord === true;
      // Exactly one of the two. Neither would make this panel the sole carrier.
      expect(hasPointer !== saysNone, `${id}: pointer=${hasPointer} none=${saysNone}`).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("a healthy record shows three dimensions, not four with a filler row", () => {
    // THE FLOOR IS THE THREE UNCONDITIONAL ONES. `worthWatching` is the only
    // conditional dimension, so a record with nothing to watch has exactly three
    // and none of them is a "nothing to report" row.
    const healthy = allReadings().filter(
      (r) => r.reading && !r.reading.insufficient && r.reading.dimensions.length === 3
    );
    expect(healthy.length).toBeGreaterThan(0);
    for (const h of healthy) {
      expect(h.reading!.dimensions.map((d) => d.id), h.id).toEqual([
        "showingUp",
        "sound",
        "whatsNew",
      ]);
    }
  });
});

// ═══ THE SURVEY SCORE IS NOT RESTATED ══════════════════════════════════════

describe("the panel does not duplicate the page's spine", () => {
  it("the `sound` reading carries no figure of any kind", () => {
    // WHERE A NUMBER WOULD BE A SENTIMENT SCORE. The engagement dimension
    // legitimately counts days and exchanges in its prose ("answering on 13 of
    // the last 21 days"), so a blanket digit ban there would forbid the one place
    // a figure is the right answer. Restatement of the survey score is prevented
    // by the VOCABULARY bans above instead — "score", "band", "PHQ", "GAD-7" and
    // every severity word are unavailable in any dimension, which is what makes a
    // score impossible to state rather than merely absent today.
    for (const { id, reading } of allReadings()) {
      const sound = reading?.dimensions.find((d) => d.id === "sound");
      if (!sound) continue;
      expect(/\d/.test(sound.reading), `${id}: ${sound.reading}`).toBe(false);
    }
  });
});

// ═══ STRUCTURE AND THE LOW-DATA THRESHOLD ══════════════════════════════════

describe("structure", () => {
  it("the window is 21 days and is stated as a real range", () => {
    expect(READING_WINDOW_DAYS).toBe(21);
    const r = careReadingFor("t15", NOW)!;
    expect(Math.round((r.windowEndAt - r.windowStartAt) / 86_400_000)).toBe(21);
    expect(r.windowEndAt).toBe(NOW);
  });

  it("a loaded reading has three or four dimensions in fixed order", () => {
    const order = ["showingUp", "sound", "whatsNew", "worthWatching"];
    for (const { id, reading } of allReadings()) {
      if (!reading || reading.insufficient) continue;
      const ids = reading.dimensions.map((d) => d.id);
      expect(ids.length, id).toBeGreaterThanOrEqual(3);
      expect(ids.length, id).toBeLessThanOrEqual(4);
      // Always present, always first two.
      expect(ids[0], id).toBe("showingUp");
      expect(ids[1], id).toBe("sound");
      // Never out of order.
      const positions = ids.map((x) => order.indexOf(x));
      expect(positions, id).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it("every reading is one or two sentences, never a paragraph", () => {
    for (const { id, reading } of allReadings()) {
      for (const d of reading?.dimensions ?? []) {
        const sentences = d.reading.split(/\.\s+/).filter(Boolean).length;
        expect(sentences, `${id} ${d.id}: ${d.reading}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("the metric line holds at most three data points", () => {
    for (const { id, reading } of allReadings()) {
      for (const d of reading?.dimensions ?? []) {
        expect((d.metrics ?? []).length, `${id} ${d.id}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("low data renders no dimensions at all", () => {
    const sparse = allReadings().filter((r) => r.reading?.insufficient);
    expect(sparse.length, "no sparse teen in the fixture").toBeGreaterThan(0);
    for (const s of sparse) {
      expect(s.reading!.dimensions).toHaveLength(0);
      // And it failed the threshold for a stated reason.
      const belowOne =
        s.reading!.exchanges < MIN_EXCHANGES ||
        s.reading!.daysEngaged < MIN_DAYS_ENGAGED;
      expect(belowOne, s.id).toBe(true);
    }
  });

  it("a teen who has never messaged is low-data, not a hashed guess", () => {
    const never = DEMO_TEENS.find((t) => t.menteeLastSentDaysAgo === undefined);
    expect(never).toBeDefined();
    const r = careReadingFor(never!.id, NOW)!;
    expect(r.insufficient).toBe(true);
    expect(r.exchanges).toBe(0);
    expect(r.daysEngaged).toBe(0);
  });

  it("the mock never contradicts the real recency stamps", () => {
    // A teen silent for 15+ days cannot have a busy window ending today.
    for (const t of DEMO_TEENS) {
      if ((t.menteeLastSentDaysAgo ?? 0) < 15) continue;
      const r = careReadingFor(t.id, NOW)!;
      expect(r.insufficient, t.id).toBe(true);
    }
  });

  it("at least two moment links exist in the mock", () => {
    const moments = allReadings()
      .flatMap((r) => r.reading?.dimensions ?? [])
      .filter((d) => d.moment);
    expect(moments.length).toBeGreaterThanOrEqual(2);
    for (const m of moments) {
      // Names WHEN, never what: a date and the word "conversation".
      expect(m.moment!.label).toMatch(/conversation/i);
    }
  });

  it("reply times render compactly", () => {
    expect(replyTimeLabel(35)).toBe("35m");
    expect(replyTimeLabel(240)).toBe("4h");
    expect(replyTimeLabel(2880)).toBe("2d");
  });
});
