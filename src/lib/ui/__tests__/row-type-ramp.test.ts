// ═══════════════════════════════════════════════════════════════════════════
// THE ROWS' INLINE TYPE, AGAINST BLOOM'S RAMP (row layout §1)
//
// ═══ WHY `view-presets.test.ts` DID NOT ALREADY CATCH THIS ═══
//
// That test says, in its own words, that an invented pair is "the defect the
// last pass retired from these rows (11, 13 and 13.5px)". It reads
// `ROW_GEOMETRY`, and the geometry table is genuinely clean.
//
// THE ROWS DO NOT GET ALL THEIR TYPE FROM THE TABLE. The table owns line 1 and
// line 2 of the identity lockup; everything else on a row — the age figure, the
// cadence label, the chips, the empty states — is an inline `text-[Npx]` class,
// and no test looked at those. So the ramp guard passed while `text-[13px]` sat
// on the age column of every row on Care Reviews, which is what §1 came back
// for. 13px was not retired from these rows; it was retired from the part of
// them a test could see.
//
// ═══ TWO ASSERTIONS, BECAUSE THERE ARE TWO DEFECTS ═══
//
//   1. AN INVENTED SIZE — 11px and 13px are not steps on Bloom's ramp at all.
//      This is the worse one: the ramp has five stops and a sixth value is off
//      any scale, not merely mispaired.
//   2. A MISPAIRED LEADING — a ramp size with a line-height the ramp does not
//      give it. `16/20` where the ramp says `16/24`.
//
// A SIZE WITH NO DECLARED LEADING IS NEITHER, AND MY FIRST VERSION FAILED ON
// IT. `text-[12px]` alone is five of the matches here, and it is usually a
// wrapper whose children carry their own pair, or an element inheriting a
// correct leading — so calling it off-ramp flagged four compliant elements.
// It is only a defect when nothing upstream sets a leading, which the measured
// `text-[13px]` case was (it rendered at 19.5px, the 1.5 fallback). That
// distinction needs a browser, so this file does not guess at it: the
// unpaired count is asserted as a FIGURE, so it cannot grow unnoticed, and the
// pair checks apply to declared pairs only.
//
// ═══ A REGISTER, NOT A POLICY ═══
//
// The same shape as `review-body-fork-registry`: this does not forbid an
// off-ramp value, because the surviving ones are load-bearing and ripping them
// out is not this pass's scope. It asserts that the SET is the set written down
// here, so a new one turns red until somebody argues for it. Each entry says
// where it is and why it is still there — a bare allow-list would just be the
// defect, spelled differently.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** The row surfaces. `event-list` is Risk Flags' own row, which shares the
 *  geometry table and nothing else. */
const FILES = [
  "src/components/tasks/worklist.tsx",
  "src/components/tasks/review-row.tsx",
  "src/components/monitoring/event-list.tsx",
] as const;

/** Bloom's ramp, measured off `settings-tokens.css` and stated the same way
 *  `view-presets.test.ts` states it. Size -> the one leading that goes with it. */
const RAMP = new Map([
  [32, 40],
  [24, 32],
  [16, 24],
  [14, 20],
  [12, 16],
]);

/** Comments stripped: several of the notes beside these classes QUOTE the old
 *  off-ramp value while explaining why it changed, and a scanner that read
 *  prose would count those. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

interface Hit {
  file: string;
  size: number;
  leading: number | null;
}

function scan(): Hit[] {
  const out: Hit[] = [];
  for (const f of FILES) {
    const src = code(read(f));
    const re = /text-\[(\d+(?:\.\d+)?)px\](?:\s+leading-\[(\d+(?:\.\d+)?)px\])?/g;
    for (const m of src.matchAll(re)) {
      out.push({
        file: f.split("/").pop()!,
        size: Number(m[1]),
        leading: m[2] === undefined ? null : Number(m[2]),
      });
    }
  }
  return out;
}

const key = (h: Hit) => `${h.file} ${h.size}`;
const pairKey = (h: Hit) => `${h.file} ${h.size}/${h.leading}`;

/** ═══ REGISTER 1 · SIZES THAT ARE NOT RAMP STEPS ═══ */
const REGISTERED_SIZES: Record<string, string> = {
  "worklist.tsx 11":
    "the overdue chip, at both row and toolbar size. 11px is BELOW Bloom's " +
    "smallest step (12) and the chip has to fit a row's trailing column beside " +
    "a 14px figure. Owed a decision rather than a silent bump: at 12px it " +
    "competes with the age it sits next to, which is the emphasis rule arch-F " +
    "set for that zone.",
  "worklist.tsx 13":
    "the overdue chip at TOOLBAR size, where it is a standalone control rather " +
    "than row furniture. 14px is the obvious target and it changes the " +
    "control's hit box, so it belongs to whoever owns the toolbar rather than " +
    "to a row pass.",
  "review-row.tsx 13":
    "the whole-page empty state's body copy and the retiring band's button. " +
    "Neither is a row — they are the list's own states — and both are 44px-tall " +
    "controls or paragraphs where 14/20 is a safe move. Left alone because §1 " +
    "scoped itself to the three row deltas and a copy block is not one.",
};

/** ═══ REGISTER 2 · DECLARED PAIRS THE RAMP DOES NOT GIVE ═══ */
const REGISTERED_PAIRS: Record<string, string> = {
  "worklist.tsx 11/14": "see the 11px entry above — the pair follows the size.",
  "worklist.tsx 13/18": "see the 13px entry above — the pair follows the size.",
  "review-row.tsx 13/18": "see the 13px entry above — the pair follows the size.",
  "review-row.tsx 16/20":
    "`NAME_CLASS`, the shared identity cell's name — Today's table only, since " +
    "the list row takes its line 1 from `ROW_GEOMETRY` (16/24). So one product " +
    "sets the same name at two leadings. 16/24 is the ramp pair; the 4px it " +
    "adds changes Today's row pitch, which is L.4's geometry and not this " +
    "pass's to move.",
};

/** How many `text-[Npx]` classes carry no `leading-` beside them. A FIGURE
 *  rather than a rule — see the header on why this cannot be judged from
 *  source.
 *  COUNTED AT THE TIME OF §1: 3 in `worklist` (11, 12, 14), 1 in `review-row`
 *  (12) and 2 in `event-list` (12, 12). I wrote 4 here first by adding the
 *  inventory up wrong, and the assertion said so with the list attached —
 *  which is the whole reason it prints the list.
 *  ═══ AND THEN MEASURED, WHICH REVERSED WHAT THIS NOTE FIRST CLAIMED ═══
 *  I wrote that all six inherit a ramp leading from an ancestor. THEY DO NOT.
 *  Measured across both row surfaces, an undeclared leading falls back to 1.5x
 *  essentially everywhere: `12px -> 18px` (the ramp says 16) on 19 elements of
 *  Care Reviews and 122 of Risk Flags, and `14px -> 21px` (says 20) on both.
 *  SO UNPAIRED IS A MILD DEFECT, NOT A NEUTRAL FACT, and this count is a debt
 *  figure rather than a clean bill. It stays a count because fixing 141
 *  elements is not a row pass, and because the rule cannot be enforced from
 *  source — only the browser knows what an element inherited.
 *  THE PAGE-WIDE SCAN FOUND MORE THAN THESE THREE FILES HOLD: 10px, 11px,
 *  12.5px and 13px all render somewhere on those two surfaces. Reported rather
 *  than registered, because this file's scope is the row components and a
 *  product-wide type audit needs its own pass. */
const UNPAIRED_COUNT = 6;

describe("the rows' inline type", () => {
  const found = scan();

  it("is found at all, so nothing below passes on an empty set", () => {
    /* THE INPUT IS ASSERTED. A regex that stopped matching — a Tailwind syntax
       change, a file rename — would make every check below pass by finding
       nothing, which is this repo's most-repeated probe defect. */
    expect(found.length, "the scanner matched nothing").toBeGreaterThan(10);
    expect(new Set(found.map((f) => f.file)).size, "a file stopped matching").toBe(
      FILES.length
    );
  });

  it("uses only Bloom's ramp STEPS, except the three on the register", () => {
    const bad = [...new Set(found.filter((h) => !RAMP.has(h.size)).map(key))].sort();
    expect(
      bad,
      [
        "An inline `text-[Npx]` on a row component is not a Bloom ramp step.",
        "",
        `found:      ${bad.join(" · ") || "(none)"}`,
        `registered: ${Object.keys(REGISTERED_SIZES).sort().join(" · ")}`,
        "",
        "The ramp is 32 · 24 · 16 · 14 · 12. A sixth value is off ANY scale,",
        "because Bloom ships no others — this is the 13px that sat on the age",
        "column of every Care Reviews row while the geometry-table ramp test",
        "passed.",
        "",
        "If you ADDED one: move it to a ramp step, or register it with a reason.",
        "If you FIXED one: delete its line from REGISTERED_SIZES.",
      ].join("\n")
    ).toEqual(Object.keys(REGISTERED_SIZES).sort());
  });

  it("pairs every declared leading the way the ramp pairs it, except the four registered", () => {
    const bad = [
      ...new Set(
        found
          .filter((h) => h.leading !== null && RAMP.get(h.size) !== h.leading)
          .map(pairKey)
      ),
    ].sort();
    expect(
      bad,
      [
        "A declared `text-[Npx] leading-[Mpx]` is not a Bloom ramp pair.",
        "",
        `found:      ${bad.join(" · ") || "(none)"}`,
        `registered: ${Object.keys(REGISTERED_PAIRS).sort().join(" · ")}`,
        "",
        "16/24 · 14/20 · 12/16 are the pairs in play on rows. 16/20 is the one",
        "that looks right and is not.",
      ].join("\n")
    ).toEqual(Object.keys(REGISTERED_PAIRS).sort());
  });

  it("declares a leading beside all but a known few sizes", () => {
    const unpaired = found.filter((h) => h.leading === null);
    expect(
      unpaired.length,
      [
        `${unpaired.length} inline sizes carry no \`leading-\`, and ${UNPAIRED_COUNT} is the recorded figure.`,
        `  ${unpaired.map(key).join(" · ")}`,
        "",
        "An undeclared leading is the browser's 1.5x UNLESS something upstream",
        "sets one — `text-[13px]` measured at 19.5px for exactly this reason.",
        "Most of these are wrappers whose children carry their own pair, which",
        "is why this is a count rather than a rule. If the count went UP, check",
        "the new one renders at a ramp leading; then move this number.",
      ].join("\n")
    ).toBe(UNPAIRED_COUNT);
  });

  it("registers no value that is actually compliant", () => {
    /* The registers are for exceptions. An entry for a compliant value is a
       line nobody can ever delete, because nothing will fail without it. */
    for (const k of Object.keys(REGISTERED_SIZES)) {
      const size = Number(k.split(" ")[1]);
      expect(RAMP.has(size), `${k} IS a ramp step and does not belong here`).toBe(false);
    }
    for (const k of Object.keys(REGISTERED_PAIRS)) {
      const m = k.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
      expect(m, `${k} is not a parseable size/leading key`).not.toBeNull();
      expect(
        RAMP.get(Number(m![1])) === Number(m![2]),
        `${k} IS a ramp pair and does not belong here`
      ).toBe(false);
    }
  });

  it("and every registered entry states a reason rather than just a key", () => {
    for (const [k, why] of Object.entries({
      ...REGISTERED_SIZES,
      ...REGISTERED_PAIRS,
    })) {
      expect(why.length, `${k} has no recorded reason`).toBeGreaterThan(40);
    }
  });
});
