// CARE SUMMARY ASSERTIONS — the tier gate, and contrast on every new chip.
//
// Separate from the shot script because these are pass/fail claims, not
// evidence: a screenshot of a mentor's page does not prove element 5 is ABSENT
// rather than merely scrolled past, and no screenshot measures a ratio.
import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";

const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 3200 };
const SEL = '[data-record-section="care-summary-doc"]';

const version = await readStoreVersion();
const browser = await launch();
const out = { base: BASE, tiers: [], contrast: [], keyboard: null };

// ═══ 1 · READ WIDE, ACT NARROW ═══
// Element 5 and Refresh are supervisor-only. The rule is ABSENT, never disabled:
// a disabled control still tells a mentor the affordance exists and that they
// are not trusted with it, which is a different product.
for (const persona of ["supervisor", "lead_mentor", "mentor"]) {
  const { context, page } = await openView(
    browser,
    { id: `tier-${persona}`, url: "/admin/person/t17?tab=care", seed: { persona } },
    XL,
    version
  );
  await page.waitForTimeout(700);
  const seen = await page.evaluate((sel) => {
    const card = document.querySelector(sel);
    if (!card) return { card: false };
    const t = card.textContent ?? "";
    const btns = [...card.querySelectorAll("button")];
    return {
      card: true,
      elements: [...card.querySelectorAll("[data-summary-element]")].map(
        (n) => n.getAttribute("data-summary-element")
      ),
      concordance: t.includes("Score-vs-content concordance"),
      refresh: btns.some((b) => /refresh/i.test(b.textContent ?? "")),
      // A disabled control would be a rule break, so it is checked for by name.
      disabled: btns.filter((b) => b.disabled || b.getAttribute("aria-disabled") === "true").length,
    };
  }, SEL);
  out.tiers.push({ persona, ...seen });
  await context.close();
}

// ═══ 2 · CONTRAST, ON THE SURFACE EACH CHIP ACTUALLY SITS ON ═══
const { context, page } = await openView(
  browser,
  { id: "contrast", url: "/admin/person/t17?tab=care", seed: { persona: "supervisor" } },
  XL,
  version
);
await page.waitForTimeout(700);
out.contrast = await page.evaluate((sel) => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  /** Walks up for the first non-transparent background — a chip's own bg may be
   *  transparent, and comparing text against `rgba(0,0,0,0)` reports nonsense. */
  const bgOf = (el) => {
    let n = el;
    while (n) {
      const b = getComputedStyle(n).backgroundColor;
      const p = parse(b);
      const a = b.includes("rgba") ? Number((b.match(/[\d.]+/g) ?? [])[3] ?? 1) : 1;
      if (p.length === 3 && a > 0.01) return p;
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const ratio = (fg, bg) => {
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };
  const card = document.querySelector(sel);
  const rows = [];
  for (const el of card.querySelectorAll("span,p,dt,dd,button,h2,h3,li")) {
    const txt = el.textContent?.trim() ?? "";
    if (!txt || el.children.length > 0) continue;
    const cs = getComputedStyle(el);
    // ═══ OPACITY COMPOSITES, AND IGNORING IT UNDER-REPORTS ═══
    // This scan reported 0 failures on 33 nodes while axe found 18: the theme
    // counts carried `opacity-80`, which composites the text toward its
    // background without changing `color`. Reading `color` alone measured the
    // ratio the markup intends rather than the one a reader gets. Every ancestor
    // contributes, so the factors multiply.
    let alpha = 1;
    for (let n = el; n; n = n.parentElement) {
      const o = parseFloat(getComputedStyle(n).opacity);
      if (Number.isFinite(o)) alpha *= o;
    }
    const px = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const bg = bgOf(el);
    const fg = parse(cs.color).map((c, i) => c * alpha + bg[i] * (1 - alpha));
    const r = ratio(fg, bg);
    rows.push({
      text: txt.slice(0, 44),
      alpha: Math.round(alpha * 100) / 100,
      px: Math.round(px * 10) / 10,
      ratio: Math.round(r * 100) / 100,
      floor: large ? 3 : 4.5,
      pass: r >= (large ? 3 : 4.5),
    });
  }
  return rows;
}, SEL);
await context.close();

await browser.close();
const fails = out.contrast.filter((r) => !r.pass);
console.log(JSON.stringify({ ...out, contrastFails: fails, contrastChecked: out.contrast.length }, null, 2));
