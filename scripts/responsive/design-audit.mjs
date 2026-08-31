// PHASE 10 MEASUREMENTS. Typography and spacing claims, measured on the running
// app rather than read off the source — measure (CPL), leading ratios, and how
// much of the spacing in use is off the 4/8px scale.
import { launch, openView, VIEWPORTS, readStoreVersion, BASE } from "./harness.mjs";

const version = await readStoreVersion();
const browser = await launch();
const out = [];

const SURFACES = [
  { id: "care", url: "/admin/person/t17?tab=care&scenario=longitudinal", seed: { persona: "supervisor" } },
  { id: "tasks", url: "/app/tasks", seed: { persona: "supervisor" } },
  { id: "activity", url: "/app/activity", seed: { persona: "supervisor" } },
];

for (const s of SURFACES) {
  const { context, page } = await openView(browser, { id: s.id, url: s.url, seed: s.seed }, { label: s.id, width: 1440, height: 2400 }, version);
  await page.waitForTimeout(1300);
  out.push(await page.evaluate((id) => {
    const main = document.querySelector("main");
    if (!main) return { id, missing: true };

    // ── MEASURE: characters per line for real prose blocks (>= 60 chars of text,
    //    a single text node, not a label). Estimated from the rendered width and
    //    the average glyph advance, which is what a reader actually experiences.
    const prose = [];
    for (const el of main.querySelectorAll("p, blockquote p, li")) {
      const t = (el.textContent ?? "").trim();
      if (t.length < 60 || el.children.length > 1) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 80) continue;
      const cs = getComputedStyle(el);
      // Measure one line's worth by rendering a canvas with the same font.
      const c = document.createElement("canvas").getContext("2d");
      c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const avg = c.measureText("abcdefghijklmnopqrstuvwxyz ").width / 27;
      prose.push({
        cpl: Math.round(r.width / avg),
        px: parseFloat(cs.fontSize),
        lh: parseFloat(cs.lineHeight),
        ratio: Math.round((parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)) * 100) / 100,
        sample: t.slice(0, 40),
      });
    }

    // ── SPACING: every margin/padding/gap actually applied inside `main`,
    //    bucketed by whether it lands on the 4px scale.
    const spacing = new Map();
    for (const el of main.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      for (const prop of ["marginTop", "marginBottom", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "rowGap", "columnGap"]) {
        const v = parseFloat(cs[prop]);
        if (!Number.isFinite(v) || v === 0) continue;
        spacing.set(v, (spacing.get(v) ?? 0) + 1);
      }
    }
    const vals = [...spacing.entries()].sort((a, b) => b[1] - a[1]);
    const onScale = vals.filter(([v]) => v % 4 === 0);
    const offScale = vals.filter(([v]) => v % 4 !== 0);
    const total = vals.reduce((n, [, c]) => n + c, 0);
    const offTotal = offScale.reduce((n, [, c]) => n + c, 0);

    return {
      id,
      prose: prose.slice(0, 8),
      proseOutOfRange: prose.filter((p) => p.cpl < 45 || p.cpl > 75).length,
      proseCount: prose.length,
      spacing: {
        distinctValues: vals.length,
        offScaleShare: Math.round((offTotal / total) * 100),
        topOffScale: offScale.slice(0, 8).map(([v, c]) => `${v}px×${c}`),
        topOnScale: onScale.slice(0, 6).map(([v, c]) => `${v}px×${c}`),
      },
    };
  }, s.id));
  await context.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
