// ═══════════════════════════════════════════════════════════════════════════
// ONE BILLING-CODE LOZENGE (elevation pack §3 continuity)
//
// §3: "one lozenge component for billing codes across every state and every
// surface."
//
// ═══ IT WAS THREE RENDERINGS, NOT ONE ═══
//
// Found by probing for code-SHAPED text rather than by reading:
//
//   1. `BillingCodeLozenge` in `proposal-codes.tsx` — the pill, with the state
//      tones, carrying `data-billing-code`. Its only live caller was
//      `ProposalCodes`, whose only live call site is the CARE PAGE
//      (`ReviewPresentationCell` is retired, and `review-body` suppresses the
//      proposal row on Care Reviews by a registered fork).
//   2. An inline chip in `review-body.tsx` — `h-[22px] rounded-[4px]` with an
//      `--surface-s1` fill at 12px. Rendered on BOTH surfaces, so the Care
//      Reviews pane's only code lozenge was the one that was not the component.
//   3. The `Current · F33.0 …` line's code — PLAIN MONO TEXT at the
//      paragraph's inherited 12.5px. Not a lozenge at all, which is what the
//      pack means by "the third falls back on whatever the code happens to do".
//
// So the pane showed two billing codes in two treatments and a probe asking
// "what codes are on screen" could see neither.
//
// ═══ WHAT THIS ASSERTS, AND WHY IT IS A SOURCE TEST ═══
//
// The runtime half lives in `review-module-host.mjs`, which walks the rendered
// DOM for code-shaped text outside the component — that is the check that
// catches a NEW inline chip someone adds tomorrow. This file catches the same
// thing earlier and cheaper, and it can assert something the DOM cannot: that
// the lozenge is DEFINED in exactly one place. A second definition that is not
// yet rendered is still a second definition.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const OWNER = "src/components/record/proposal-codes.tsx";

/** Every `.tsx` under src/components, so a new file cannot opt out by being
 *  new. Walked rather than listed for the same reason. */
function componentFiles(dir = "src/components"): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) out.push(...componentFiles(rel));
    else if (name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

/** Comments out. Several notes QUOTE the markup they replaced — including this
 *  change's own — and a scanner reading prose would count those as the defect
 *  they describe. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

describe("the billing-code lozenge is defined once", () => {
  const files = componentFiles();

  it("scans a real set of files, so nothing below passes on an empty sweep", () => {
    /* THE INPUT IS ASSERTED. A rename of `src/components` would otherwise make
       every check here pass by finding nothing. */
    expect(files.length).toBeGreaterThan(40);
    expect(files).toContain(OWNER);
  });

  it("and only one file carries the `data-billing-code` handle", () => {
    const carriers = files.filter((f) => code(read(f)).includes("data-billing-code"));
    expect(
      carriers,
      [
        `\`data-billing-code\` is rendered from ${carriers.length} file(s):`,
        `  ${carriers.join("\n  ")}`,
        "",
        "That attribute is the handle probes use to ask what billing codes are",
        "on screen, and it belongs to exactly one component. A second emitter",
        "means a second lozenge — which is the state §3 was written to end.",
        `Render \`BillingCodeLozenge\` from ${OWNER} instead.`,
      ].join("\n")
    ).toEqual([OWNER]);
  });

  it("and no other file builds its own code chip out of mono + a fill", () => {
    /* ═══ THE SHAPE OF THE DEFECT, NOT ITS TEXT ═══
       The removed chip was `inline-flex … rounded-[4px] border … bg-…
       font-mono … tabular-nums`. What made it a second lozenge was a
       MONO+TABULAR run carrying its own background — that is the pattern, and
       it is what this looks for on a single className. A mono figure with no
       fill is a figure (the age columns are exactly that); a mono figure
       wearing a surface is a chip. */
    /* ═══ THE ALLOW-LIST, EACH WITH ITS REASON ═══ A file here renders a mono
       figure that is NOT a code and needs a fill for a measured reason. */
    const ALLOWED: Record<string, string> = {
      /* (Monitoring v4) The strip's response clock was the one entry; the
         strip is deleted and the queue's Response cell wears no fill, so the
         list is empty — an entry for a file that does not exist would be an
         exemption for whatever is created at that path next. */
    };
    const offenders: string[] = [];
    for (const f of files) {
      if (f === OWNER || f in ALLOWED) continue;
      for (const m of code(read(f)).matchAll(/className=(?:"([^"]*)"|\{cn\(([\s\S]{0,400}?)\)\})/g)) {
        const cls = m[1] ?? m[2] ?? "";
        if (!/font-mono|--font-mono/.test(cls)) continue;
        if (!/tabular-nums/.test(cls)) continue;
        if (!/\bbg-\[/.test(cls)) continue;
        offenders.push(`${f} :: ${cls.replace(/\s+/g, " ").slice(0, 90)}`);
      }
    }
    expect(
      offenders,
      [
        "A mono, tabular run with its own background outside the lozenge owner:",
        `  ${offenders.join("\n  ")}`,
        "",
        "That is the anatomy of the inline chip §3 removed from `review-body`.",
        "If this is a billing code, render `BillingCodeLozenge`. If it is a",
        "different kind of figure that genuinely needs a fill, it is not a",
        "counter-example to §3 — add it to this test's allow-list with a reason.",
      ].join("\n")
    ).toEqual([]);
  });

  it("the owner exports it, so it can be reached without copying it", () => {
    /* The component was module-private for its whole life, which is the
       mechanical reason the second chip existed: `review-body` could not have
       used it. */
    expect(code(read(OWNER))).toMatch(/export function BillingCodeLozenge/);
  });

  it("and offers the four tones the surfaces actually need", () => {
    const src = code(read(OWNER));
    for (const tone of ["onRecord", "proposed", "changed", "identity"] as const) {
      expect(src, `${OWNER} no longer offers the \`${tone}\` tone`).toContain(tone);
    }
  });
});

describe("the module renders every code through it", () => {
  const src = code(read("src/components/record/review-body.tsx"));

  it("both of the pane's codes are lozenges, not raw spans", () => {
    /* `shown.code` is the heading's; `currentCode` is the `Current ·` line's.
       Both were raw before this change, in two different ways. */
    expect(src).toMatch(/<BillingCodeLozenge\s+code=\{shown\.code\}/);
    expect(src).toMatch(/<BillingCodeLozenge\s+code=\{currentCode\}/);
  });

  it("and neither is also rendered as a bare mono span", () => {
    /* The precise regression: deleting the lozenge and putting the value back
       in a `<span className="font-mono …">`. */
    expect(
      src.match(/<span[^>]*font-mono[^>]*>\s*\{(?:currentCode|shown\.code)\}/),
      "a billing code is back in a bare mono span"
    ).toBeNull();
  });

  it("and the heading's tone is per-state, not hard-coded", () => {
    /* ═══ RETARGETED BY §3 — AND THE OLD ASSERTION WAS RIGHT WHEN WRITTEN ═══
       It pinned `tone="identity"` as a literal, with this reasoning: the
       heading's code is `shown.code`, whatever is currently picked, so a state
       tone there would be claiming something about a selection in progress.
       §3 OVERRULES THAT FOR ONE STATE. Node 4324:1111 paints the recommended
       code on a CHANGE in its "attention" tone, and §3 names live's lack of a
       "differentiated treatment" as the defect. On a change the amber is not
       saying "this is final" — it says the code MOVES, which is true the moment
       the proposal differs from the record and reverts with it.
       WHAT THE OLD ASSERTION PROTECTED IS STILL PROTECTED: every OTHER state
       stays neutral, which is the half that would have been a claim about a
       selection. So this pins the CONDITIONAL rather than either literal — a
       hard-coded `changed` fails it just as a hard-coded `identity` does. */
    expect(src).toMatch(
      /code=\{shown\.code\}[\s\S]{0,1400}?tone=\{proposalKind === "change" \? "changed" : "identity"\}/
    );
  });

  it("and the three states are each distinguishable (§3)", () => {
    /* §3: "Shipping two of three leaves the third to fall back on whatever the
       code happens to do." So the set is asserted as a set:
         assign  -> the New-presentation pill
         change  -> the amber code AND the `Current` line
         renewal -> neither, which is the one that used to be the fallback */
    expect(src, "the New-presentation pill is not gated on `assign`").toMatch(
      /proposalKind === "assign" && <NewPresentationPill \/>/
    );
    expect(src, "the subordinate line is not gated on `change`").toMatch(
      /proposalKind === "change" &&/
    );
    /* THE GLYPH WAS REPLACED BY THE WORD (product, 2026-10-05). The line
       leads with "Current" in the eyebrow style `Recommended presentation`
       uses, so the pair is asserted rather than the elbow it superseded. */
    expect(src, "the directional glyph is back — product replaced it with the word").not.toMatch(
      /<CornerLeftUp/
    );
    expect(src, "the current line no longer leads with the word `Current` in the label style").toMatch(
      /style=\{LABEL_STYLE\}>[\s{}]*Current\s*</
    );
  });
});

describe("and no surface states one code twice for nothing", () => {
  const src = code(read("src/components/record/review-body.tsx"));
  const owner = code(read(OWNER));

  /* ═══ MEASURED ON ALL FOUR RECORD FIXTURES ═══
     The recommended code rendered TWICE on the Care page, every time — the
     heading's `identity` lozenge and `ProposalCodes`' own:
       t19 change   F33.1/identity · F33.0/onRecord · F33.1/changed
       t17 renewal  F33.1/identity · F33.1/proposed
       t12 assign   F43.22/identity · F43.22/proposed
       t9  intake   F43.22/identity · F43.22/proposed
     Unifying the lozenge did not cause it — both renderings pre-date that —
     but two different shapes had been hiding it. */

  it("the Care page tells the proposal row that the heading states the code", () => {
    expect(
      src,
      [
        "`review-body` renders `ProposalCodes` without `codeStatedAbove`.",
        "",
        "The heading above it is `Recommended presentation` + code + statement,",
        "so without that flag the recommended code renders twice, six pixels",
        "apart — measured on all four record fixtures.",
      ].join("\n")
    ).toMatch(/codeStatedAbove/);
  });

  it("and the component honours it for everything except a change", () => {
    /* A CHANGE IS EXEMPT ON PURPOSE. Dropping the target from `F33.0 -> F33.1`
       leaves an arrow pointing at nothing, and the pair IS the information —
       that repeat carries the delta rather than restating identity. Asserted
       as a shape so the exemption cannot quietly widen to every kind. */
    expect(owner).toMatch(/kind === "change" \|\| !codeStatedAbove/);
  });

  it("and the flag defaults to false, so no other caller changed behaviour", () => {
    /* The retired `ReviewPresentationCell` is the other caller. A default of
       true would have silently dropped its lozenge. */
    expect(owner).toMatch(/codeStatedAbove = false/);
  });
});
