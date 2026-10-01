// ═══════════════════════════════════════════════════════════════════════════
// A BAND TINT IS A PAIR, NOT TWO COLOURS
//
// ═══ WHY THIS EXISTS AND WHAT IT DELIBERATELY DOES NOT ASSERT ═══
//
// The `New presentation` pill maps a Figma `sky` accent that Bloom does not
// have. Sage was chosen with the cost on the table and confirmed as "for now",
// so a test that pinned `--band-sage-*` would freeze a held decision and turn
// red on the day somebody makes the real one.
//
// WHAT IS NOT PROVISIONAL is the shape of the choice. Every `--band-*` tint in
// this product ships as a `-bg`/`-fg` COUPLE whose contrast was measured when
// the token landed — `settings-tokens.css` records the ratio in a comment beside
// each one ("7.38:1 on sand", "5.41:1 on sage"). The failure this guards is
// picking a ground from one family and an ink from another, or from nowhere:
// that produces a pairing nobody measured, on a clinical surface, and it looks
// exactly like a considered choice.
//
// SO: the hue is free, the pairing is not.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const TOKENS = read("src/app/settings-tokens.css");

/** Every `--band-<family>-<slot>` the stylesheet actually declares. */
function declaredBands(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of TOKENS.matchAll(/--band-([a-z]+)-(bg|fg)\s*:/g)) {
    const fam = m[1];
    if (!out.has(fam)) out.set(fam, new Set());
    out.get(fam)!.add(m[2]);
  }
  return out;
}

/** Call sites that paint a band tint as an inline style pair. Listed rather
 *  than discovered, because a sweep would also catch the row chip and the task
 *  band, which take their family from a severity TABLE — and a table is the
 *  pairing guarantee, so they are not the thing at risk. */
const INLINE_PAIR_SITES = [
  "src/components/record/proposal-codes.tsx",
  "src/components/tasks/worklist.tsx",
] as const;

describe("band tints ship as measured pairs", () => {
  const bands = declaredBands();

  it("the stylesheet declares some, so nothing below passes on an empty set", () => {
    /* THE INPUT IS ASSERTED. A rename of the token prefix would otherwise make
       every check here vacuous. */
    expect(bands.size).toBeGreaterThanOrEqual(3);
    for (const [fam, slots] of bands) {
      expect(slots.has("bg"), `--band-${fam}-bg is missing`).toBe(true);
      expect(slots.has("fg"), `--band-${fam}-fg is missing`).toBe(true);
    }
  });

  it("and every inline band colour names a family the stylesheet declares", () => {
    const bad: string[] = [];
    for (const f of INLINE_PAIR_SITES) {
      for (const m of read(f).matchAll(/--band-([a-z]+)-(bg|fg)/g)) {
        if (!bands.has(m[1])) bad.push(`${f} :: --band-${m[1]}-${m[2]}`);
      }
    }
    expect(
      bad,
      [
        "A `--band-*` family is referenced that `settings-tokens.css` does not declare:",
        `  ${bad.join("\n  ")}`,
        "",
        "An undeclared custom property resolves to nothing, so the element",
        "renders with no ground or no ink — and in a `style` attribute there is",
        "no build step to catch it.",
      ].join("\n")
    ).toEqual([]);
  });

  it("and the New-presentation pill takes its ground and ink from ONE family", () => {
    const src = read("src/components/record/proposal-codes.tsx");
    /* The pill's own style block, so a band reference elsewhere in the file —
       the `changed` tone's amber — cannot satisfy this. */
    const block = src.match(
      /data-anno-ref="new-presentation-pill"[\s\S]{0,600}?\}\}/
    )?.[0];
    expect(block, "the pill's style block was not found").toBeTruthy();
    const fams = [...(block ?? "").matchAll(/--band-([a-z]+)-(bg|fg)/g)];
    expect(
      fams.length,
      "the pill should name exactly one ground and one ink"
    ).toBe(2);
    const [a, b] = fams;
    expect(
      a[1],
      [
        `The pill paints --band-${a[1]}-${a[2]} against --band-${b[1]}-${b[2]}.`,
        "",
        "A band tint is a measured couple — `settings-tokens.css` records each",
        "pair's contrast beside it — so mixing families produces a ratio nobody",
        "checked on a surface that carries clinical codes.",
        "",
        "THE HUE IS FREE: sage is held 'for now' and swapping the family is a",
        "one-line change. Swapping only ONE of the two is the defect.",
      ].join("\n")
    ).toBe(b[1]);
    expect(new Set([a[2], b[2]]), "one must be the bg and one the fg").toEqual(
      new Set(["bg", "fg"])
    );
  });
});
