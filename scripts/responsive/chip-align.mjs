// THE INLINE AVATAR CHIP'S OPTICAL ALIGNMENT.
//
// ═══ WHY CAP HEIGHT IS MEASURED, NOT ASSUMED ═══
//
// A circle reads as centred when its centre sits on the middle of the CAP-HEIGHT
// BAND — the band from the baseline up to the top of a capital. That band is a
// property of the typeface, not of the font-size, so it is measured off the
// rendered font rather than taken as a ratio. TWK Lausanne's cap ratio is not
// something to guess at when the browser will report it.
//
// `TextMetrics.actualBoundingBoxAscent` on a capital letter gives the cap height
// directly. Canvas is used only as a ruler here — nothing is drawn.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const MEASURE = `(() => {
  const rows = [...document.querySelectorAll("[data-row-id]")];
  // A row whose sentence carries an inline chip.
  const withChip = rows.find((r) => r.querySelector("span.inline-flex svg, span.inline-flex img, span.inline-flex span[class*=rounded-full]"));
  const chipUnit = withChip?.querySelector("span.inline-flex.whitespace-nowrap");
  if (!chipUnit) return { none: true, rows: rows.length };

  // The sentence paragraph the unit sits inside.
  const sentence = chipUnit.closest("p");
  const cs = getComputedStyle(sentence);

  // ── CAP HEIGHT, from the rendered font.
  const cv = document.createElement("canvas").getContext("2d");
  cv.font = cs.font || \`\${cs.fontWeight} \${cs.fontSize} \${cs.fontFamily}\`;
  const capH = cv.measureText("H").actualBoundingBoxAscent;

  // ── The chip and a plain capital in the same line, as boxes.
  const chip = chipUnit.firstElementChild;
  const chipBox = chip.getBoundingClientRect();
  const nameSpan = chipUnit.lastElementChild;
  const nameBox = nameSpan.getBoundingClientRect();

  // The text's cap band: its baseline is nameBox.bottom minus the descender, and
  // the cap top is baseline - capH. Rather than model the descender, measure the
  // baseline directly with a zero-width range trick.
  /** ═══ A ZERO-HEIGHT INLINE-BLOCK IS THE ONLY HONEST BASELINE RULER ═══
   *  The first version measured an inline-block containing "H" and took its
   *  BOTTOM as the baseline. That is wrong: an inline-block's height is its line
   *  box, so its bottom edge sits a descender BELOW the baseline — which pushed
   *  the computed cap-band centre down and reported the chip as perfectly centred
   *  when the brief says it is visibly low.
   *  A zero-height, zero-width inline-block has no line box to sit in, so its
   *  bottom margin edge IS placed on the parent's baseline. */
  const probe = document.createElement("span");
  probe.style.cssText = "display:inline-block;width:0;height:0;";
  nameSpan.appendChild(probe);
  const baseline = probe.getBoundingClientRect().bottom;
  probe.remove();

  const capTop = baseline - capH;
  const capCentre = (baseline + capTop) / 2;
  const chipCentre = chipBox.top + chipBox.height / 2;

  return {
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    capHeight: +capH.toFixed(2),
    chipDiameter: Math.round(chipBox.height),
    chipVsCap: +(chipBox.height / capH).toFixed(2),
    capCentre: +capCentre.toFixed(2),
    chipCentre: +chipCentre.toFixed(2),
    // POSITIVE = the chip sits BELOW the cap band's centre, which is the defect.
    offset: +(chipCentre - capCentre).toFixed(2),
    unitClasses: chipUnit.className,
    /** ═══ THE NAME MUST STILL SIT ON THE SENTENCE'S BASELINE ═══
     *  align-top on the unit is what stops it growing the line box, and the
     *  risk it introduces is that the NAME inside travels with the chip and
     *  leaves the surrounding text behind. Measured against a probe placed in the
     *  paragraph OUTSIDE the unit. */
    nameBaselineDelta: (() => {
      const outside = document.createElement("span");
      outside.style.cssText = "display:inline-block;width:0;height:0;";
      sentence.appendChild(outside);
      const outer = outside.getBoundingClientRect().bottom;
      outside.remove();
      const inner = document.createElement("span");
      inner.style.cssText = "display:inline-block;width:0;height:0;";
      nameSpan.appendChild(inner);
      const innerB = inner.getBoundingClientRect().bottom;
      inner.remove();
      // Both probes are on the LAST line of the paragraph when it wraps, so
      // compare only when the unit is on that line; otherwise report null.
      const sameLine = Math.abs(outer - innerB) < 30;
      return sameLine ? +(innerB - outer).toFixed(2) : null;
    })(),
  };
})()`;

const LINE_BOX = `(() => {
  // ═══ THE COMPARISON IS THE SAME PARAGRAPH, CHIP REMOVED ═══
  // Every row in this scenario carries a chip, so "rows without one" was an empty
  // set and the check passed or failed on nothing. Cloning a real paragraph and
  // deleting the chip compares like with like — same font, same nesting, same
  // width — which is what "identical line-height with and without" actually asks.
  const cloneTest = (() => {
    const row = [...document.querySelectorAll("[data-row-id]")]
      .find((r) => (r.querySelector("p:nth-of-type(2)") ?? r.querySelector("p"))?.querySelector("span.inline-flex.whitespace-nowrap"));
    if (!row) return null;
    const p = row.querySelector("p:nth-of-type(2)") ?? row.querySelector("p");
    const withH = p.getBoundingClientRect().height;
    const clone = p.cloneNode(true);
    const unit = clone.querySelector("span.inline-flex.whitespace-nowrap");
    // Remove ONLY the avatar, keeping the name — so the text content is as close
    // to identical as it can be and any height change is the chip's doing.
    unit.firstElementChild.remove();
    clone.style.cssText = "position:absolute;visibility:hidden;";
    clone.style.width = p.getBoundingClientRect().width + "px";
    p.parentElement.appendChild(clone);
    const withoutH = clone.getBoundingClientRect().height;
    const lh = getComputedStyle(p).lineHeight;
    clone.remove();
    return { withH: +withH.toFixed(2), withoutH: +withoutH.toFixed(2), lineHeight: lh };
  })();

  // Line-height with a chip vs without, measured on real rows rather than on a
  // synthetic one — a fabricated row would not carry the same nesting.
  const rows = [...document.querySelectorAll("[data-row-id]")];
  const out = { withChip: [], without: [] };
  for (const r of rows) {
    const p = r.querySelector("p:nth-of-type(2)") ?? r.querySelector("p");
    if (!p) continue;
    const hasChip = !!p.querySelector("span.inline-flex.whitespace-nowrap");
    // ONE-LINE SENTENCES ONLY. A wrapped sentence's height is a multiple of the
    // line box plus wrapping, so comparing a 1-line row against a 2-line row
    // would measure wrapping rather than the chip.
    const lines = Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight));
    if (lines !== 1) continue;
    (hasChip ? out.withChip : out.without).push(Math.round(p.getBoundingClientRect().height * 100) / 100);
  }
  return { ...out, cloneTest };
})()`;

const WRAP_AUDIT = `(() => {
  const rows = [...document.querySelectorAll("[data-row-id]")];
  let apostropheFirst = 0, chipFirst = 0, chipUnits = 0;
  const rng = document.createRange();
  for (const r of rows) {
    const p = r.querySelector("p:nth-of-type(2)") ?? r.querySelector("p");
    if (!p) continue;
    const unit = p.querySelector("span.inline-flex.whitespace-nowrap");
    if (unit) {
      chipUnits++;
      // Is the chip the leftmost thing on its rendered line?
      const chip = unit.firstElementChild.getBoundingClientRect();
      const pBox = p.getBoundingClientRect();
      // Within 2px of the paragraph's left edge AND not on the first line.
      if (chip.left - pBox.left < 2 && chip.top - pBox.top > 4) chipFirst++;
    }
    // A line beginning with an apostrophe: walk text nodes and check each "'s".
    const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const t = n.textContent;
      const i = t.search(/[’']s\\b/);
      if (i < 0) continue;
      rng.setStart(n, i); rng.setEnd(n, Math.min(i + 2, t.length));
      const rects = [...rng.getClientRects()];
      if (!rects.length) continue;
      if (rects[0].left - p.getBoundingClientRect().left < 2) apostropheFirst++;
    }
  }
  return { rows: rows.length, chipUnits, apostropheFirst, chipFirst };
})()`;

const b = await chromium.launch();

async function activity(zoom = 1, scenario = "typical-shift") {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona: "supervisor", activityScenarioId: scenario, activityDensity: "detailed" }, version: VERSION }]
  );
  const p = await ctx.newPage();
  if (zoom !== 1) await p.addStyleTag({ content: `html { font-size: ${16 * zoom}px }` }).catch(() => {});
  await p.goto(`${BASE}/app/activity`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  return p;
}

console.log("═══ 1 · CHIP CENTRE vs CAP-HEIGHT CENTRE ═══");
for (const density of ["detailed", "dense"]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona: "supervisor", activityScenarioId: "typical-shift", activityDensity: density }, version: VERSION }]
  );
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app/activity`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(MEASURE);
  if (m.none) { console.log(`  ${density}: no chip found in ${m.rows} rows`); await ctx.close(); continue; }
  console.log(`  ── ${density} ──`);
  console.log(`     font ${m.fontSize}/${m.lineHeight}  cap height ${m.capHeight}px`);
  console.log(`     chip ${m.chipDiameter}px = ${m.chipVsCap}× cap`);
  console.log(`     cap-band centre ${m.capCentre}  chip centre ${m.chipCentre}`);
  check(Math.abs(m.offset) <= 0.75, `${density}: chip centre is on the cap-band centre`, `offset ${m.offset > 0 ? "+" : ""}${m.offset}px (positive = chip sits low)`);
  if (m.nameBaselineDelta !== null) {
    check(Math.abs(m.nameBaselineDelta) <= 0.75,
      `${density}: the name still sits on the sentence's baseline`,
      `${m.nameBaselineDelta}px off`);
  }
  await ctx.close();
}

console.log("\n═══ 2 · LINE BOX WITH A CHIP vs WITHOUT ═══");
{
  const p = await activity();
  const lb = await p.evaluate(LINE_BOX);
  const uniq = (a) => [...new Set(a)];
  console.log(`     with chip:    ${JSON.stringify(uniq(lb.withChip))}`);
  console.log(`     without chip: ${JSON.stringify(uniq(lb.without))}`);
  const ct = lb.cloneTest;
  if (ct) {
    console.log(`     same paragraph, chip removed: ${ct.withH}px → ${ct.withoutH}px (line-height ${ct.lineHeight})`);
    check(Math.abs(ct.withH - ct.withoutH) < 0.5,
      "the chip does not change the line box", `${ct.withH} vs ${ct.withoutH}`);
  } else check(false, "found a chip paragraph to compare");
  await p.context().close();
}

console.log("\n═══ 3/4 · WRAP AUDIT (Typical shift) ═══");
for (const zoom of [1, 2]) {
  const p = await activity(zoom);
  const w = await p.evaluate(WRAP_AUDIT);
  console.log(`  ── ${zoom * 100}% ──  ${w.rows} rows, ${w.chipUnits} with a chip unit`);
  check(w.apostropheFirst === 0, `${zoom * 100}%: rows whose line begins with an apostrophe`, String(w.apostropheFirst));
  console.log(`     chip is first on a wrapped line: ${w.chipFirst}`);
  await p.context().close();
}

if (process.env.SHOT_DIR) {
  // ═══ 400%, WITH THE CAP BAND DRAWN ═══
  // A screenshot of a chip beside text cannot show alignment — the eye is the
  // thing under test. Two hairlines at the cap band's top and bottom, and one at
  // the chip's centre, make the claim checkable in the image itself.
  // TRUE MAGNIFICATION, not a root font-size change: this app's type tokens are
  // in px, so `html { font-size: 64px }` scales almost nothing. `zoom` scales the
  // rendered result, which is what "at 400% zoom" means to a reader.
  /** ═══ deviceScaleFactor, NOT zoom AND NOT root font-size ═══
   *  Two wrong turns before this. `html { font-size: 64px }` scales almost
   *  nothing, because this app's type tokens are in px. `zoom: 4` scales the
   *  render but leaves the locator's box in pre-zoom coordinates, so the element
   *  screenshot captured the wrong region entirely. `deviceScaleFactor` magnifies
   *  the RASTER at unchanged layout coordinates — which is what a reader
   *  inspecting alignment at 400% actually wants: more pixels per CSS pixel, same
   *  geometry. */
  const ctx4 = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 4 });
  await ctx4.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona: "supervisor", activityScenarioId: "typical-shift", activityDensity: "detailed" }, version: VERSION }]
  );
  const p = await ctx4.newPage();
  await p.goto(`${BASE}/app/activity`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const row = p.locator("[data-row-id]").filter({ hasText: /billing review/i }).first();
  const target = (await row.count()) ? row : p.locator("[data-row-id]").first();
  await p.evaluate(() => {
    const r = [...document.querySelectorAll("[data-row-id]")].find((x) => /billing review/i.test(x.textContent))
      ?? document.querySelector("[data-row-id]");
    const unit = r.querySelector("span.inline-flex.whitespace-nowrap");
    if (!unit) return;
    const chip = unit.firstElementChild;
    const nameSpan = unit.lastElementChild;
    const cv = document.createElement("canvas").getContext("2d");
    const cs = getComputedStyle(unit.closest("p"));
    cv.font = cs.font;
    const capH = cv.measureText("H").actualBoundingBoxAscent;
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;";
    nameSpan.appendChild(probe);
    const baseline = probe.getBoundingClientRect().bottom;
    probe.remove();
    const rowBox = r.getBoundingClientRect();
    const line = (top, color) => {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:0;right:0;top:${top - rowBox.top}px;height:1px;background:${color};z-index:9999;pointer-events:none;`;
      r.style.position = "relative";
      r.appendChild(d);
    };
    line(baseline, "rgba(0,120,255,.9)");            // baseline
    line(baseline - capH, "rgba(0,120,255,.9)");     // cap top
    line(baseline - capH / 2, "rgba(220,0,90,.95)"); // cap-band CENTRE
    const cb = chip.getBoundingClientRect();
    line(cb.top + cb.height / 2, "rgba(0,180,60,.95)"); // chip centre
  });
  await p.waitForTimeout(200);
  // Crop to the sentence itself — a whole row at 4× is mostly empty card.
  const sentenceEl = target.locator("p").nth(1);
  const shotTarget = (await sentenceEl.count()) ? sentenceEl : target;
  await shotTarget.screenshot({ path: `${process.env.SHOT_DIR}/chip-400.png` });
  await ctx4.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
