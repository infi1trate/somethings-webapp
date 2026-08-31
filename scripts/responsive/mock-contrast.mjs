// MEASURE the two device-mock pairs. One mode per browser context — never a
// `.dark` toggle and a getComputedStyle in the same JS turn (that lesson cost
// an hour once).
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3003";
const URL = `${BASE}/onboarding/preview`;

const PROBE = `(() => {
  const lum = (c) => { const s = c.map(v => v/255).map(v => v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4); return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2]; };
  const parse = (s) => { const m = String(s).match(/[\\d.]+/g); return m ? m.slice(0,4).map(Number) : null; };
  const over = (fg, bg) => fg.length < 4 || fg[3] === 1 ? fg.slice(0,3) : fg.slice(0,3).map((v,i) => v*fg[3] + bg[i]*(1-fg[3]));
  // OPACITY COMPOSITES TOO — the bug my first checker had.
  const eff = (el) => { let o = 1, n = el; while (n && n.nodeType === 1) { const v = parseFloat(getComputedStyle(n).opacity); if (!isNaN(v)) o *= v; n = n.parentElement; } return o; };
  // ═══ START AT THE ELEMENT ITSELF, NOT ITS PARENT ═══
  // A button carries "bg-primary text-white" on ONE element, so the text sits on
  // that element's own background. Starting the walk at parentElement measured
  // white-on-primary as white-on-page and reported a phantom 1:1 — the fourth
  // time a checker of mine has been wrong in this family, so: measure the
  // checker against a case whose answer you already know, every time.
  const bgOf = (el) => {
    let n = el;
    while (n) {
      const cs = getComputedStyle(n);
      const c = parse(cs.backgroundColor);
      if (c && (c.length < 4 || c[3] > 0.98)) return { rgb: c.slice(0,3), img: cs.backgroundImage !== "none", node: n.className?.toString?.().slice(0,60) };
      n = n.parentElement;
    }
    return { rgb: [255,255,255], img: false, node: "(root)" };
  };
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x,y)=>y-x); return (l1+0.05)/(l2+0.05); };
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const t = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(" ").trim();
    if (!t) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden") continue;
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    const o = eff(el);
    const comp = over(o < 1 ? [...fg.slice(0,3), (fg[3] ?? 1) * o] : fg, bg.rgb);
    const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const rr = ratio(comp, bg.rgb);
    // ═══ A GRADIENT ANCESTOR IS "UNKNOWN", NOT "FAILING" ═══
    // backgroundColor reads transparent on a node painted by background-image,
    // so the walk keeps climbing and reports the ratio against an ancestor the
    // text never sits on. That produced three phantom 1:1 rows the first time.
    // Report them separately so a real failure is never buried in them.
    const bucket = bg.img ? "unknown" : "fail";
    // IS IT INSIDE THE LIGHT-LOCKED DEVICE SCREEN? Without this the report cannot
    // distinguish "the mock is broken" from "something ELSE on the page shows the
    // same string" — and the page does render these labels twice.
    const inMock = !!el.closest(".theme-light");
    if (rr < need) out.push({ text: t.slice(0, 34), px, ratio: +rr.toFixed(2), need, bucket, inMock, fg: comp.map(v=>Math.round(v)).join(","), bg: bg.rgb.join(","), over: bg.node });
  }
  return out;
})()`;

for (const mode of ["light", "dark"]) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ colorScheme: mode, viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const fails = await p.evaluate(PROBE);
  const real = fails.filter(f => f.bucket === "fail");
  const unknown = fails.filter(f => f.bucket === "unknown");
  console.log(`\n═══ ${mode.toUpperCase()} — ${real.length} failing, ${unknown.length} unmeasurable (gradient bg) ═══`);
  for (const f of real) console.log(`  ${f.ratio}:1 (need ${f.need})  ${f.px}px  "${f.text}"  ${f.inMock ? "[in device screen]" : "[page chrome]"}  fg=${f.fg} on bg=${f.bg}`);
  for (const f of unknown) console.log(`  [unmeasurable] ${f.px}px "${f.text}" — ancestor paints a gradient`);
  await b.close();
}
