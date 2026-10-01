// ═══════════════════════════════════════════════════════════════════════════
// NO STYLESHEET MAY GIVE THE NATIVE SCROLLBAR A SIZE
//
// ═══ THE CAUSE, AS A RULE ═══
//
// The Care Reviews gutter came back three passes running, and the reason was a
// single declaration: `.scroll-slim::-webkit-scrollbar { width: 24px }`.
// Styling that pseudo-element opts Chromium and WebKit into a CUSTOM CLASSIC
// scrollbar, which always takes layout width — on macOS's overlay default
// included. Measured on this machine's Chrome 152: an unstyled scroller reserves
// 15px, the same scroller with that rule reserves 24px. It created the gutter it
// was written to tidy.
//
// The fix hides the native bar (`display: none`, width 0) and draws a custom
// one. This test makes the cause impossible to reintroduce quietly: any
// `::-webkit-scrollbar` rule that sets a NON-ZERO width or height fails, with
// the reason in the message.
//
// ═══ WHY A SOURCE TEST AND NOT ONLY A PROBE ═══
//
// `scripts/responsive/scrollbar-gutter.mjs` measures the result with scrollbars
// shown. But every other probe in that directory runs under Playwright's
// `--hide-scrollbars`, which is how this regressed while being "verified" —
// the measuring tool could not see the defect. A source rule needs no browser
// at all, so it cannot be blinded the same way.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function cssFiles(dir = "src"): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) out.push(...cssFiles(rel));
    else if (name.endsWith(".css")) out.push(rel);
  }
  return out;
}

/** Comments out — the explanation of the cause quotes the offending rule. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ");

describe("the native scrollbar is hidden, never sized", () => {
  const files = cssFiles();

  it("scans real stylesheets, so the next check is not vacuous", () => {
    expect(files).toContain("src/app/globals.css");
  });

  it("no ::-webkit-scrollbar rule gives the bar a non-zero width or height", () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const m of code(readFileSync(join(process.cwd(), f), "utf8")).matchAll(
        /([^{}]*::-webkit-scrollbar(?![-\w])[^{]*)\{([^}]*)\}/g
      )) {
        for (const d of m[2].matchAll(/\b(width|height)\s*:\s*([^;]+)/g)) {
          const v = d[2].trim();
          if (!/^0(px)?$/.test(v)) offenders.push(`${f} :: ${m[1].trim()} { ${d[1]}: ${v} }`);
        }
      }
    }
    expect(
      offenders,
      [
        "A stylesheet gives the native scrollbar a size:",
        `  ${offenders.join("\n  ")}`,
        "",
        "Styling `::-webkit-scrollbar` opts Chromium and WebKit into a custom",
        "CLASSIC bar that always takes layout width — even on macOS overlay.",
        "This exact rule is what produced the Care Reviews gutter. Hide the",
        "native bar (`.scroll-overlay`) and render `OverlayScrollbar` instead.",
      ].join("\n")
    ).toEqual([]);
  });

  it("and the overlay utility does hide it, on both engines' paths", () => {
    const g = code(readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"));
    expect(g, "Firefox / standards path").toMatch(/\.scroll-overlay\s*\{[^}]*scrollbar-width:\s*none/);
    expect(g, "Chromium / WebKit path").toMatch(
      /\.scroll-overlay::-webkit-scrollbar\s*\{[^}]*display:\s*none/
    );
  });
});
