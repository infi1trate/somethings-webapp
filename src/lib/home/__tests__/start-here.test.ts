// ═══════════════════════════════════════════════════════════════════════════
// THE BOUNDED PREVIEW (Today rebuild, Phase I)
//
// The hazard this file exists for is I.3's, and it is a safety one: a
// supervisor who clears four items and sees an empty preview must not be able
// to conclude the queue is empty. Every claim below is either that hazard or
// the ordering promise the module makes to justify showing only four.
//
// WHY THE CAP IS TESTED AS A SLICE RATHER THAN AS A LENGTH. `items.length <= 4`
// passes for a module that runs a DIFFERENT query when the queue is long — a
// "top 4 by something else" would satisfy it. The claim is that the shown four
// are the first four of the full ordered list, so the test compares against
// `startHereCandidates` and checks identity, not size.

import { describe, expect, it } from "vitest";
import {
  PREVIEW_CAP,
  startHereCandidates,
  startHerePreview,
} from "@/lib/home/start-here";
import { openCounts } from "@/lib/ia/open-counts";
import { todayCards, todayRationale } from "@/lib/home/today";
import { DESTINATION_ORDER } from "@/lib/ia/destinations";
import { shiftFactsFor } from "@/lib/tasks/shift";
import { TASK_SCENARIOS, tasksScenario } from "@/lib/tasks/seed";
import { monitoringData } from "@/lib/monitoring/scenarios";

const NOW = 1_800_000_000_000;
const MONITORING = [null, "clean-day", "surge", "flag-repeat-pattern"];

function inputsFor(taskId: string, monId: string | null) {
  const items = tasksScenario(taskId, NOW);
  const data = monitoringData(monId, taskId, NOW);
  return {
    items,
    facts: shiftFactsFor(items, NOW),
    events: data.events,
    escalations: data.escalations,
    conversations: data.conversations,
    classifierDegraded: data.classifier === "degraded",
    now: NOW,
  };
}

/** Every fixture pair, so a claim is never carried by one lucky scenario. */
function everyPair(): Array<{ label: string; input: ReturnType<typeof inputsFor> }> {
  const out: Array<{ label: string; input: ReturnType<typeof inputsFor> }> = [];
  for (const sc of TASK_SCENARIOS) {
    for (const mon of MONITORING) {
      /* ═══ `sc.id`, NOT `String(sc)` ═══
         `TASK_SCENARIOS` holds `{ id, label, description, build }` objects.
         An earlier revision of this file stringified the OBJECT, which handed
         `tasksScenario` "[object Object]" — an unknown id that falls back to a
         default fixture. Every "pair" was then the same fixture five times, and
         the guards below still passed because that one fixture has enough data
         to satisfy them. A loop that looks exhaustive and is not is worse than
         a loop that is obviously narrow. */
      out.push({ label: `${sc.id}/${mon ?? "none"}`, input: inputsFor(sc.id, mon) });
    }
  }
  return out;
}

describe("the preview is ordered oldest-first and the cap is a slice of it", () => {
  it("orders ascending by the age field it displays", () => {
    let checked = 0;
    for (const { label, input } of everyPair()) {
      for (const d of DESTINATION_ORDER) {
        const all = startHereCandidates(d, input);
        for (let i = 1; i < all.length; i++) {
          expect(
            all[i].at,
            `${label}/${d}: item ${i} is older than the one before it`
          ).toBeGreaterThanOrEqual(all[i - 1].at);
        }
        if (all.length > 1) checked++;
      }
    }
    /* THE GUARD: the loop above is vacuously true over empty lists, so a
       fixture change that emptied every destination would leave this test
       green while asserting nothing. */
    expect(checked, "no destination had two items to compare").toBeGreaterThan(0);
  });

  it("shows the FIRST four of the full list, not four chosen another way", () => {
    let capped = 0;
    for (const { label, input } of everyPair()) {
      for (const d of DESTINATION_ORDER) {
        const all = startHereCandidates(d, input);
        const preview = startHerePreview(d, input);
        if (all.length === 0) {
          expect(preview, `${label}/${d}: empty set must preview nothing`).toBeNull();
          continue;
        }
        expect(preview).not.toBeNull();
        expect(preview!.items.map((i) => i.id)).toEqual(
          all.slice(0, PREVIEW_CAP).map((i) => i.id)
        );
        expect(preview!.items.length).toBeLessThanOrEqual(PREVIEW_CAP);
        if (all.length > PREVIEW_CAP) capped++;
      }
    }
    expect(capped, "no fixture exercised the cap").toBeGreaterThan(0);
  });
});

describe("the total is the destination's own count, so the preview cannot imply an empty queue", () => {
  it("reports the same total the destination card reports", () => {
    for (const { label, input } of everyPair()) {
      const counts = openCounts(input);
      for (const d of DESTINATION_ORDER) {
        const preview = startHerePreview(d, input);
        if (preview == null) {
          expect(counts[d], `${label}/${d}: no preview but a non-zero count`).toBe(0);
          continue;
        }
        expect(
          preview.total,
          `${label}/${d}: preview total disagrees with the destination count`
        ).toBe(counts[d]);
      }
    }
  });

  it("always states a total, including when it is showing everything", () => {
    /* I.3.3 — "when fewer than 4 are open, show what exists and state the true
       total. Never pad." The total is a required field, so the UI cannot
       render a bare list of four with no denominator. */
    for (const { input } of everyPair()) {
      for (const d of DESTINATION_ORDER) {
        const p = startHerePreview(d, input);
        if (p == null) continue;
        expect(Number.isInteger(p.total)).toBe(true);
        expect(p.total).toBeGreaterThanOrEqual(p.items.length);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I.6.2 IS REACHABLE, AND THAT IS A REPORTED DEFECT RATHER THAN A TOLERANCE
//
// The pack: "Rationale exists, zero items of that type: impossible by
// construction — if you can reach this state, the rationale expression is
// wrong; report it."
//
// IT IS REACHABLE. MEASURED on `breach-overnight` with no monitoring override:
// one escalation record, unsettled, NOT active. `escalationObligations` over it
// reports `closeOutOverdue: 3`, so `todayRationale` names Escalations — while
// `openCounts.escalations` is `activeEscalations().length`, which is 0, and the
// preview reads the same active-only set and is empty.
//
// THE DIVERGENCE IS PHASE A's, SURFACED BY PHASE I. Phase A set one semantic,
// "open and actionable", and made the badge and the row read one expression.
// The Escalations CARD SENTENCE and the RATIONALE both also count close-out
// obligations, which that expression excludes. So the card can say "3 close-out
// items overdue" while carrying no badge and offering no preview.
//
// NOT FIXED HERE, and deliberately: the fix is a change to what
// `openCounts.escalations` means, which is the nav badge on every supervisor
// route. That is Phase A's foundation and belongs to whoever owns the
// close-out obligation model, not to the preview that found it.
//
// THE EXCEPTION IS ENUMERATED SO IT CANNOT WIDEN. Any OTHER fixture reaching
// this state fails, and if the divergence is fixed this list goes stale and the
// last assertion fails, which is the prompt to delete it.
// TWO OF THE FOUR MONITORING VARIANTS, WHICH IS ITSELF INFORMATIVE:
// `clean-day` and `flag-repeat-pattern` supply escalation records that ARE
// active, so the rationale and the preview agree there. `none` and `surge`
// leave the task fixture's own single non-active record, and they diverge.
// The defect is therefore in the RATIONALE's source, not in the fixtures.
const KNOWN_RATIONALE_WITHOUT_PREVIEW = [
  "breach-overnight/none",
  "breach-overnight/surge",
];

describe("the preview agrees with the rationale (I.2.3)", () => {
  it("previews the destination the rationale names, led by that destination's oldest", () => {
    let checked = 0;
    const diverged: string[] = [];
    for (const { label, input } of everyPair()) {
      const cards = todayCards(input);
      const rationale = todayRationale(cards, input);
      if (rationale == null) continue;
      const preview = startHerePreview(rationale.id, input);
      if (preview == null) {
        diverged.push(label);
        expect(
          KNOWN_RATIONALE_WITHOUT_PREVIEW,
          `${label}: a rationale named ${rationale.id} with nothing to preview. I.6.2 calls this impossible by construction, so the rationale expression is wrong — see the note above this block`
        ).toContain(label);
        continue;
      }
      expect(preview.destination).toBe(rationale.id);
      const all = startHereCandidates(rationale.id, input);
      expect(
        preview.items[0].id,
        `${label}: the first preview row is not the destination's oldest open item`
      ).toBe(all[0].id);
      checked++;
    }
    expect(checked, "no fixture produced a rationale WITH a preview").toBeGreaterThan(0);
    /* THE LIST IS EXACT, NOT A CEILING. A stale entry means the defect was
       fixed and this scaffolding should go. */
    expect(
      diverged.sort(),
      "the known-divergence list no longer matches what diverges — update or delete it"
    ).toEqual([...KNOWN_RATIONALE_WITHOUT_PREVIEW].sort());
  });
});

describe("a preview row carries no clinical content (I.4)", () => {
  it("renders no presentation or diagnosis code in any field", () => {
    /* The reference Figma has an ICD column and I.4 removes it. A code is
       `F33.1`-shaped; the check is over EVERY string field rather than over the
       one that would hold it, so a code arriving in the status word or as part
       of a name is caught too. */
    const CODE = /\b[A-Z]\d{2}(\.\d+)?\b/;
    let fields = 0;
    for (const { label, input } of everyPair()) {
      for (const d of DESTINATION_ORDER) {
        for (const it of startHereCandidates(d, input)) {
          for (const [key, value] of Object.entries(it)) {
            if (typeof value !== "string") continue;
            /* `href` carries an opaque id and is not read by anybody. */
            if (key === "href") continue;
            expect(
              CODE.test(value),
              `${label}/${d}: ${key} = ${JSON.stringify(value)} looks like a code`
            ).toBe(false);
            fields++;
          }
        }
      }
    }
    expect(fields, "no string fields were examined").toBeGreaterThan(0);
  });

  it("gives Risk Flags no status word, because a flag's is its category", () => {
    let seen = 0;
    for (const { input } of everyPair()) {
      for (const it of startHereCandidates("risk-flags", input)) {
        expect(it.status).toBeNull();
        seen++;
      }
    }
    expect(seen, "no flags were examined").toBeGreaterThan(0);
  });
});

describe("every row links to an individual record (I.5.2)", () => {
  it("carries an item-scoped query, never the destination's list top", () => {
    let seen = 0;
    for (const { label, input } of everyPair()) {
      for (const d of DESTINATION_ORDER) {
        const all = startHereCandidates(d, input);
        for (const it of all) {
          expect(
            it.href,
            `${label}/${d}: ${it.href} is the list top, not an item`
          ).toMatch(new RegExp(`^/app/${d}\\?(escalation|flag|review)=.+`));
          /* The id in the href is THIS item's, not a neighbour's. */
          expect(decodeURIComponent(it.href.split("=")[1])).toBe(it.id);
          seen++;
        }
      }
    }
    expect(seen, "no rows were examined").toBeGreaterThan(0);
  });
});
