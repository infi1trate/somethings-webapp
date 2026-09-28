// ═══════════════════════════════════════════════════════════════════════════
// ONE ROW ANATOMY, AND IT CANNOT FORK AGAIN (Phase K.1)
//
// K.1 calls the forked row the headline break: the Today preview and the Care
// Reviews list rendered the same object two ways. The rendered parity is
// measured in the browser — `today-parity` in the probe suite compares all
// seven fields on both surfaces — and a DOM check cannot see the thing that
// matters here, which is whether the two surfaces are still reading one
// definition or have merely been edited into agreement.
//
// So this reads the source. Two expressions that agree today diverge on the
// next edit to either, and that is exactly how the age defect in K.2 happened
// one file along.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COL_AGE,
  COL_AGE_BOX,
  COL_PRESENTATION,
  proposalCaption,
} from "@/components/tasks/review-row";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SHARED = "src/components/tasks/review-row.tsx";
const CONSUMERS = [
  "src/components/tasks/worklist.tsx",
  "src/components/today/today-page.tsx",
];

describe("the column geometry has one definition", () => {
  it("exports the measured widths, and the age box is derived not restated", () => {
    expect(COL_PRESENTATION).toBe(144);
    expect(COL_AGE).toBe(72);
    /* The header and the cell share one number. A second literal would be the
       drift that made the header line up with none of the cells. */
    expect(COL_AGE_BOX).toBe(COL_AGE + 24);
  });

  it.each(CONSUMERS)("%s declares no column width of its own", (rel) => {
    const src = stripComments(read(rel));
    expect(
      /const\s+COL_(PRESENTATION|AGE)\s*=/.test(src),
      `${rel} declares a column constant; it should import from review-row.tsx`
    ).toBe(false);
  });

  it.each(CONSUMERS)("%s imports the shared anatomy", (rel) => {
    expect(read(rel)).toContain('from "@/components/tasks/review-row"');
  });
});

describe("the caption is one expression", () => {
  it("names each proposal kind", () => {
    /* Assign, change and renewal — the three kinds `proposalKindFor` derives.
       Asserted through the shared helper rather than through the label table,
       because the helper is what both surfaces call. */
    expect(proposalCaption(null, "F41.1")).toBeTruthy();
    expect(proposalCaption("F33.0", "F33.1")).toBeTruthy();
    expect(proposalCaption("F33.1", "F33.1")).toBeTruthy();
    /* A change and a renewal must not read the same — the caption is the only
       carrier of the kind since §4.4 took that job off the lozenge count. */
    expect(proposalCaption("F33.0", "F33.1")).not.toBe(proposalCaption("F33.1", "F33.1"));
  });

  it.each(CONSUMERS)("%s does not build the caption itself", (rel) => {
    const src = stripComments(read(rel));
    expect(
      /PROPOSAL_LABEL\s*\[/.test(src),
      `${rel} indexes PROPOSAL_LABEL directly; it should call proposalCaption`
    ).toBe(false);
  });
});

describe("neither surface renders its own copy of a shared cell", () => {
  /* ═══ THE CELLS THAT MUST NOT BE REIMPLEMENTED ═══
     `ProposalCodes` is the codes renderer and `discFor` the disc colour
     derivation. Both are reached THROUGH the shared cells now; a consumer
     importing them directly is building its own version of a cell that exists.
     `review-row.tsx` itself is the one legitimate importer. */
  it.each(CONSUMERS)("%s reaches the codes and the disc through the shared cells", (rel) => {
    const src = stripComments(read(rel));
    expect(
      /from "@\/components\/record\/proposal-codes"/.test(src) &&
        /\bProposalCodes\b/.test(src),
      `${rel} imports ProposalCodes directly; it should use ReviewPresentationCell`
    ).toBe(false);
    expect(
      /\bdiscFor\s*\(/.test(src),
      `${rel} calls discFor directly; it should use ReviewDisc`
    ).toBe(false);
  });

  it("and the shared module is the one place they are imported", () => {
    const src = read(SHARED);
    expect(src).toContain('from "@/components/record/proposal-codes"');
    expect(src).toContain('from "@/lib/tasks/avatar"');
  });
});

describe("the age cell reads the one age expression (K.2)", () => {
  it("imports it from lib/ia/age rather than restating it", () => {
    const src = read(SHARED);
    expect(src).toContain('from "@/lib/ia/age"');
    const stripped = stripComments(src);
    expect(
      /Math\.(floor|round|ceil)\s*\(/.test(stripped),
      "review-row.tsx computes an age itself"
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WHAT IS STILL FORKED, STATED — SO THE CLAIM IS EXACT
//
// The worklist's IDENTITY COLUMN still renders its own two spans. Its caption
// is a JSX branch over four states (resolving / billing / disposition / mentor)
// and its sizes come from the row's preset geometry, so passing a string and a
// class would not express it. The TREATMENT is single-sourced — the name's face
// and size, the caption's ink — and every other field is literally the shared
// component.
//
// This is asserted rather than left as a comment, so that consuming
// `ReviewIdentityCell` in the worklist makes this test fail and prompts the note
// to be deleted along with the fork.
// ═══════════════════════════════════════════════════════════════════════════

describe("the one remaining fork is named", () => {
  it("is the worklist's identity column, and nothing else", () => {
    const src = stripComments(read("src/components/tasks/worklist.tsx"));
    expect(
      /ReviewIdentityCell/.test(src),
      "the worklist now consumes ReviewIdentityCell — delete this test and the note above it"
    ).toBe(false);
    /* And Today DOES consume it, so the shared cell is not dead code. */
    expect(stripComments(read("src/components/today/today-page.tsx"))).toContain(
      "ReviewIdentityCell"
    );
  });
});
