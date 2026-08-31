// EVERY WEIGHT A TYPE TOKEN ASKS FOR MUST HAVE A FILE BEHIND IT.
//
// ═══ THE DANGER ROW 330 NAMES IS SILENCE ═══
//
// Requesting an absent font weight does not fail. The browser SYNTHESISES it —
// it smears the 400 face to fake a 500 — and the result looks close enough that
// nobody notices, while the token reads like a considered decision. That is
// exactly what happened: `--type-label-sm` and `--type-field-label` both declared
// `500`, a weight with no file in `src/app/fonts/`, and the ramp appeared to
// implement Bloom's Label stops when it was rendering faux-bold Lausanne 400.
//
// Only two cuts are loaded: TWK Lausanne 400 and Avantt Bold 700. Bloom's ramp
// also wants Lausanne 700, Avantt Regular and Geist Mono, none of which are in
// the repo. Until they ship, the honest position is that the ramp is implemented
// in two faces — and this test is what keeps "honest" from decaying back into
// "synthesised the moment someone types 500".
//
// IT PARSES BOTH SIDES rather than hardcoding either. Hardcoding the available
// weights would make the test pass the moment someone edits the list instead of
// the fonts; reading `layout.tsx` means shipping a real face is what turns the
// test green, which is the only thing that should.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

/** `--font-lausanne` → the weights that actually have a file. */
function loadedFaces(): Map<string, Set<string>> {
  const src = read("src/app/layout.tsx");
  const faces = new Map<string, Set<string>>();
  // Each localFont({ variable: "--font-x", … src: [ { … weight: "n" } ] })
  for (const block of src.split("localFont({").slice(1)) {
    const variable = /variable:\s*"(--font-[a-z-]+)"/.exec(block)?.[1];
    if (!variable) continue;
    const body = block.slice(0, block.indexOf("});"));
    const weights = new Set(
      [...body.matchAll(/weight:\s*"(\d+)"/g)].map((m) => m[1])
    );
    faces.set(variable, weights);
  }
  return faces;
}

/** `--type-x: <weight> <size>/<leading> var(--font-y)` → the pairs it requests. */
function requestedPairs(): Array<{ token: string; weight: string; family: string }> {
  const css = read("src/app/settings-tokens.css");
  const out: Array<{ token: string; weight: string; family: string }> = [];
  const re =
    /(--type-[a-z0-9-]+):\s*(\d{3})\s+[\d.]+px\s*\/\s*[\d.]+px\s+var\((--font-[a-z-]+)\)/g;
  for (const m of css.matchAll(re)) {
    out.push({ token: m[1], weight: m[2], family: m[3] });
  }
  return out;
}

describe("the type ramp only asks for faces that exist", () => {
  const faces = loadedFaces();
  const pairs = requestedPairs();

  it("finds both sides of the question", () => {
    // If either parser silently returns nothing, every assertion below passes
    // vacuously — which is the failure mode a test like this actually has.
    expect(faces.size).toBeGreaterThanOrEqual(2);
    expect(pairs.length).toBeGreaterThanOrEqual(10);
  });

  it("loads exactly the two cuts row 330 says it loads", () => {
    // Not a style rule — a tripwire. When a third face lands, this fails and
    // whoever added it is pointed at row 330 to retire the compromises.
    expect([...faces.get("--font-lausanne")!].sort()).toEqual(["400"]);
    expect([...faces.get("--font-avantt")!].sort()).toEqual(["700"]);
  });

  it("never requests a weight with no file behind it", () => {
    const synthesised = pairs.filter((p) => {
      const available = faces.get(p.family);
      return !available || !available.has(p.weight);
    });
    // The message has to name the token, or the failure is a hunt.
    expect(
      synthesised.map((p) => `${p.token} wants ${p.weight} of ${p.family}`)
    ).toEqual([]);
  });

  it("declares a family for every weighted token", () => {
    // A shorthand missing its `var(--font-…)` falls back to the inherited family,
    // which is how a display token quietly renders in the body face.
    const css = read("src/app/settings-tokens.css");
    const weighted = [...css.matchAll(/(--type-[a-z0-9-]+):\s*(\d{3})\s+[^;]+;/g)];
    const missing = weighted
      .filter((m) => !/var\(--font-[a-z-]+\)/.test(m[0]))
      .map((m) => m[1]);
    expect(missing).toEqual([]);
  });
});
