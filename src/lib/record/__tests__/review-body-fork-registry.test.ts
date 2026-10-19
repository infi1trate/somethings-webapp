// ═══════════════════════════════════════════════════════════════════════════
// THE SHARED MODULE'S FORKS ARE A REGISTER, NOT A HABIT (parity pack §1.3)
//
// §1.3: "Add a parity check that fails loudly. The two hosts diverging should
// be a build or test failure, not something discovered in a screenshot four
// passes later."
//
// ═══ WHY `review-body-parity` DOES NOT ALREADY DO THIS ═══
//
// That probe renders the module on both surfaces and compares 17 snapshots
// byte-for-byte, and it passes — it passed while `View AI notes` was missing
// from one host, which is the divergence §1 was written about. It is not
// broken: it compares the MODULE, and the module is identical. What differs is
// a HOST INPUT (`notes={null}` on one side), which no amount of comparing the
// module can see.
//
// So there are two ways these hosts can drift and only one was guarded:
//
//   1. A NEW `surface`-GATED BRANCH inside the module. Cheap to add, invisible
//      in review, and each one is a place the two hosts render differently on
//      purpose. Four exist and all four are argued in place.
//   2. A HOST INPUT that silences a whole section. `notes` is the case in
//      point: pass null and the AI-notes disclosure hides itself, with no
//      divergence anywhere in the module to find.
//
// THIS FILE GUARDS BOTH BY COUNTING THEM. It does not judge whether a fork is
// right — that is a decision, and decisions belong in the prose beside them.
// It asserts that the NUMBER of forks matches a figure written here, so adding
// one turns red until somebody writes down why. A register, not a policy.
//
// THE FAILURE MESSAGE HAS TO TEACH, because the person who trips this will be
// mid-change and will not have read this header.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const MODULE_PATH = "src/components/record/review-body.tsx";
const MODULE = read(MODULE_PATH);

/** Comments out: several of them QUOTE the gate while explaining it. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

// ═══ 1 · THE FORK COUNT ═══════════════════════════════════════════════════

/** ═══ THE REGISTER ═══
 *
 *  Every `surface`-gated divergence in the shared module, with what it does.
 *  Read off the module at the time of the parity pack and argued at its own
 *  site — this list is the index, not the reasoning.
 *
 *  TO ADD ONE: argue it where it lives, then add a line here. The count below
 *  is what makes that two steps instead of one.
 */
const REGISTERED_FORKS = [
  "the lozenge row is suppressed on Care Reviews (the list already states the kind and the codes)",
  "the change-presentation button's noun matches the pane's heading",
  "the assessments heading is one word rather than a sentence",
  "the view-results phrase goes `sr-only`, the chevron carrying it on screen",
] as const;

describe("the shared module's surface forks are all registered", () => {
  const gates = code(MODULE).match(/surface === "care-reviews"/g) ?? [];

  it(`has exactly ${REGISTERED_FORKS.length} of them`, () => {
    expect(
      gates.length,
      [
        `${MODULE_PATH} now has ${gates.length} \`surface === "care-reviews"\` gates,`,
        `but ${REGISTERED_FORKS.length} are registered in this test.`,
        "",
        "A new gate means the two hosts render differently on purpose. That is",
        "allowed — the fork is authorised — but it must be a RECORDED decision:",
        "argue it where it lives, then add a line to REGISTERED_FORKS here.",
        "If you REMOVED one, delete its line. Either way this number moves",
        "deliberately, which is the whole point of it existing.",
      ].join("\n")
    ).toBe(REGISTERED_FORKS.length);
  });

  it("and the module still defaults to the Care page, so that host cannot drift by accident", () => {
    /* `surface = "care"` as the default parameter is what makes every fork
       opt-in. If this flips, the Care page silently inherits Care Reviews'
       divergences — the exact direction §1 says the freeze protects. */
    expect(code(MODULE)).toMatch(/surface\s*=\s*"care"/);
  });
});

// ═══ 2 · THE HOST INPUTS THAT CAN SILENCE A SECTION ═══════════════════════

describe("a host that silences a section says why", () => {
  const HOST = "src/components/tasks/billing-review.tsx";
  const src = read(HOST);

  /* `notes={null}` is the AI-notes divergence §1 opened with. It is NOT drift:
     `aiNotesFor` needs a `CareSummaryDoc`, the doc is keyed by a record teen
     id, and no task-fixture teen exists on the record side — Gap 432, pinned by
     `teen-namespaces.test.ts`. So the host cannot supply the input.
     WHAT THIS ASSERTS is that the hard-coded null keeps its explanation. The
     day somebody deletes the comment and leaves the null, this says so. */
  it("the hard-coded null still carries its reason", () => {
    expect(src, `${HOST} no longer passes notes={null}`).toMatch(/notes=\{null\}/);
    expect(
      src,
      [
        `${HOST} passes notes={null} with no recorded reason.`,
        "",
        "That null is why `View AI notes` does not render on Care Reviews. It is",
        "a DATA blocker (Gap 432: no task-fixture teen exists on the record",
        "side), not a product decision — and an unexplained null here reads as",
        "the latter. Keep the explanation with the code.",
      ].join("\n")
    ).toMatch(/aiNotesFor|CareSummaryDoc|Gap 432/);
  });

  it("and the namespace gap it depends on is still the pinned fact", () => {
    /* If the two teen namespaces ever intersect, the blocker lifts and this
       whole section becomes buildable — so the day that pin changes, somebody
       should be sent here. */
    const pin = read("src/lib/tasks/__tests__/teen-namespaces.test.ts");
    expect(pin).toMatch(/shares not one id/);
  });
});
