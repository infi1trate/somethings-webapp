// ═══════════════════════════════════════════════════════════════════════════
// THE GRADIENT IS DECORATIVE, AND THAT IS CHECKABLE FROM THE SOURCE
//
// G.2.5: it "carries no meaning. It does not indicate state, priority, recency
// or urgency, and it does not change with data." Contrast is measured in the
// DOM and reported; what a DOM check cannot prove is that NO INPUT COULD EVER
// change it — a gradient that varied only on a fixture nobody tried would pass
// every rendering assertion.
//
// So the claim is asserted structurally: the token is a constant in the design
// system, and the component that applies it references the token and nothing
// else. There is no expression for data to enter through.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const TOKENS = read("src/app/settings-tokens.css");
const PAGE = read("src/components/today/today-page.tsx");

describe("the token is a documented design-system extension (G.2.2)", () => {
  it("exists in the token file, in both themes", () => {
    /* Bloom had NO gradient token — audited in Phase 0.6, where the only
       matches for "gradient" were comments about a removed chart. G.2 requires
       a new one to be documented in the design system rather than committed as
       a one-off value in a component. */
    const hits = TOKENS.match(/--gradient-header:/g) ?? [];
    expect(hits, "the token is missing, or defined for only one theme").toHaveLength(2);
  });

  it("is warm — its light stop is an existing warm token's value", () => {
    /* G.2.2's default: warm the gradient into the base's family. The base is
       `--surface-s1` #f6f4ef, warm neutral cream, shared with every supervisor
       route. The top stop is `--band-sand-bg` #f4efe1 — an EXISTING warm
       token, so the extension adds a gradient and no new hue.
       A COOL WASH IS THE THING THIS FORBIDS: the reference mock's is cool, and
       cool on a warm base reads as two palettes rather than one system. */
    expect(TOKENS).toContain("#f4efe1");
    const block = TOKENS.slice(TOKENS.indexOf("--gradient-header:"));
    const firstStop = block.match(/#([0-9a-f]{6})/i)?.[1];
    expect(firstStop).toBeDefined();
    const [r, , b] = (firstStop as string).match(/../g)!.map((h) => parseInt(h, 16));
    // WARM = red channel above blue. A cool wash inverts that, and this is the
    // one property that distinguishes the two without naming a specific hue.
    expect(r, `#${firstStop} is not warm (r ${r} <= b ${b})`).toBeGreaterThan(b);
  });

  it("fades to zero alpha, so it bounds nothing (G.2.4, option a)", () => {
    /* A gradient with a visible edge would bound an arbitrary subset and imply
       a relationship that does not exist (Law of Common Region). Both themes'
       final stop must be fully transparent. */
    const blocks = TOKENS.split("--gradient-header:").slice(1);
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      const def = b.slice(0, b.indexOf(";"));
      expect(def, `a stop is not transparent: ${def.replace(/\s+/g, " ")}`).toMatch(
        /\/\s*0\s*\)/
      );
    }
  });
});

describe("it cannot vary with data (G.2.5)", () => {
  it("is applied from the token alone, with no expression", () => {
    const applied = PAGE.slice(
      PAGE.indexOf('data-anno-ref="today-page"'),
      PAGE.indexOf('data-anno-ref="today-page"') + 1600
    );
    expect(applied).toContain('backgroundImage: "var(--gradient-header)"');
    /* NO TERNARY, NO TEMPLATE, NO PROP. If the value were ever computed, this
       is the line it would be computed on. */
    expect(applied).not.toMatch(/backgroundImage:\s*[^"]*\?/);
    expect(applied).not.toMatch(/backgroundImage:\s*`/);
  });

  it("commits no raw colour in the component — tokens only", () => {
    // The standing constraint: raw values live in the token file and nowhere
    // else. A hex anywhere in the page component would be one.
    expect(PAGE).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("one decorative glyph on the page, and it is the wave (G, budget)", () => {
  it("renders exactly one pictographic character in the source", () => {
    /* G: "Exactly one decorative glyph exists on the page." Superseded #5
       removed the section-header glyphs; Phase D's obligation clock was
       removed for the same reason when this budget was applied. The chevrons
       that remain are lucide navigation affordances, not decoration. */
    const emoji = PAGE.match(/\p{Extended_Pictographic}/gu) ?? [];
    expect(emoji, `found ${emoji.length}: ${emoji.join(" ")}`).toHaveLength(1);
    expect(emoji[0]).toBe("👋");
  });

  it("hides it from assistive tech, because the text carries the meaning", () => {
    /* G.1.3. Emoji rendering varies across platforms and fonts, so the glyph
       can never be the sole carrier of anything. */
    const greeting = PAGE.slice(
      PAGE.indexOf('data-anno-ref="today-greeting"'),
      PAGE.indexOf('data-anno-ref="today-greeting"') + 900
    );
    expect(greeting).toMatch(/<span aria-hidden[^>]*>\s*👋/);
  });

  it("asserts no time of day and no date (G.1.2, G.1.5)", () => {
    /* OPTION (b). The greeting carries no time word at all, so it cannot be
       wrong for a reader whose timezone this product does not know — which is
       an open item owned by Meg. And no date line: G.1.5 permits one only if
       computed, and it is not required. */
    const greeting = PAGE.slice(
      PAGE.indexOf('data-anno-ref="today-greeting"'),
      PAGE.indexOf('data-anno-ref="today-greeting"') + 900
    );
    for (const w of ["morning", "afternoon", "evening", "tonight"]) {
      expect(greeting.toLowerCase(), `the greeting says "${w}"`).not.toContain(w);
    }
  });
});
