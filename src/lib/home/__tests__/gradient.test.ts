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
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

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
    /* ═══ COMMENT-STRIPPED, AND THAT IS NOT A LOOPHOLE (L.6) ═══
       This read the WHOLE source and caught `#cc3300` inside a comment
       QUOTING a measured token value — "`--state-error` (#cc3300, 4.73:1)".
       The constraint is about raw values in CODE; a measurement recorded beside
       the decision it justifies is documentation, and forbidding it would push
       the evidence out of the file that needs it.
       IT IS THE SECOND TIME A GUARD IN THIS CODEBASE HAS CAUGHT ITS OWN
       COMMENTS — `pinned.ts` tripped the prohibited-vocabulary check the same
       way, and was fixed the same way. */
    expect(stripComments(PAGE)).not.toMatch(/#[0-9a-fA-F]{6}\b/);
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
    /* ═══ THE GLYPH IS INSIDE AN `aria-hidden` TILE NOW (L.2.1) ═══
       It was `<span aria-hidden>👋</span>` inline at body size. L.2 makes it a
       51×51 TILE, so the `aria-hidden` sits on the tile and the glyph is a
       child of it — which hides strictly more, not less. The claim is that the
       glyph is inside an `aria-hidden` subtree, and that is what is checked. */
    const tile = PAGE.slice(
      PAGE.indexOf('data-anno-ref="today-hero-tile"') - 200,
      PAGE.indexOf("👋") + 4
    );
    expect(tile).toMatch(/aria-hidden/);
    expect(tile).toContain('data-anno-ref="today-hero-tile"');
  });

  it("asserts no DATE, and its time word is computed rather than literal (L.2)", () => {
    /* ═══ SUPERSEDED: OPTION (b) BECAME OPTION (a) ═══
       This asserted the greeting carried NO time word — G.1's option (b),
       which this build shipped because supervisor timezone localisation is
       unresolved (Meg) and a computed word could be wrong for a western
       reader.
       L.2 OVERRIDES IT, and for a structural reason rather than a change of
       mind about clocks: the greeting is the PAGE TITLE now, and "Hi there" at
       32px Avantt is too thin to be one. The open item stays open.
       WHAT REPLACES THE CLAIM: the word must be COMPUTED, never literal, and
       must never read "morning" during the 1 PM – 10 PM shift. That is
       `greeting.test.ts`, which sweeps every minute of the window — a
       stronger check than this file could make, because it evaluates the
       function rather than grepping the markup.
       WHAT THIS STILL OWNS: no hardcoded time word in the component, and no
       date line. */
    /* COMMENT-STRIPPED, for the third time in this file's history and the same
       reason: the hero's `NEEDS-COPY-NICOLE` marker LISTS the four copy
       strings, which is the copy protocol working as intended. A guard that
       forbids naming a string in the marker that exists to name it is a guard
       pointed at its own protocol. */
    const src = stripComments(PAGE);
    const hero = src.slice(
      src.indexOf('data-anno-ref="today-hero"'),
      src.indexOf('data-anno-ref="today-hero"') + 2400
    );
    /* The literal words must not appear in the markup — they live in
       `GREETING_WORD`, keyed by a computed band. */
    for (const w of ["Good morning", "Good afternoon", "Good evening"]) {
      expect(hero, `the component hardcodes "${w}"`).not.toContain(w);
    }
    expect(hero, "the greeting is not computed").toContain("greetingFor(now");
    /* NO DATE LINE (L.2.4, G.1.5). */
    expect(hero).not.toContain("shiftDateLabel");
    expect(hero).not.toMatch(/toLocaleDateString/);
  });
});
