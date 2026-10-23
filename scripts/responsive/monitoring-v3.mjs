// ═══════════════════════════════════════════════════════════════════════════
// MONITORING v3 — parity, stability, calmer cards, cleaner Events
//
//   §1  header parity with Care Reviews, measured against it: the title, the
//       date line, the toolbar row's y and height, the shared pill control
//   §2  a tab switch moves nothing: every header/toolbar/hero rect identical
//       across Watch ↔ Events; the toggle hides in place; the hero's labels
//       are one set; the content cross-fades (120ms; none reduced)
//   §3  tier headers: one line at 17/24, the count 15 tertiary tabular, the
//       cadence behind an ⓘ (tooltip on hover AND focus, Esc dismisses,
//       aria-describedby); 32 above, 16 below; the dot tinted for 1–2 only;
//       the same dashed "Nothing in crisis" lane in both views
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/monitoring-v3";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open(path, { extra = {}, width = 1512, height = 1000, theme, reduced = false } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript(
    ([k, v, t]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        if (t) localStorage.setItem("somethings.theme", t);
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona: "supervisor", ...extra }, version: VERSION }, theme]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1100);
  return { ctx, page };
}
const tok = (page, v, prop = "backgroundColor") => page.evaluate(([v, prop]) => { const e = document.createElement("span"); e.style[prop === "color" ? "color" : "background"] = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; }, [v, prop]);
const header = (page) =>
  page.evaluate(() => {
    const r = (el) => (el ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()) : null);
    const h1 = document.querySelector("main h1");
    const sub = document.querySelector('main [data-anno-ref="page-purpose"]');
    const row = document.querySelector("[data-page-toolbar]") ?? document.querySelector('[data-anno-ref="care-tabs"]')?.parentElement;
    const s = (el) => (el ? getComputedStyle(el) : null);
    return { h1: r(h1), h1f: `${s(h1)?.fontSize}/${s(h1)?.lineHeight} ${s(h1)?.fontFamily.split(",")[0]}`, sub: r(sub), subf: `${s(sub)?.fontSize}/${s(sub)?.lineHeight} ${s(sub)?.fontFamily.split(",")[0]}`, subColor: s(sub)?.color, subText: sub?.textContent.trim(), row: r(row), rowH: row ? Math.round(row.getBoundingClientRect().height) : null };
  });

// ── §1 · HEADER PARITY ─────────────────────────────────────────────────────
console.log("\n── §1 · header parity with Care Reviews (1512)");
{
  const cr = await open("/app/care-reviews");
  const ref = await header(cr.page);
  const refTabs = await cr.page.evaluate(() => { const t = document.querySelector('[data-anno-ref="care-tabs"]'); const a = t?.querySelector('[aria-checked="true"]'); const r = t?.getBoundingClientRect(); return { y: Math.round(r?.y ?? 0), h: Math.round(r?.height ?? 0), bg: t && getComputedStyle(t).backgroundColor, seg: a && `${Math.round(a.getBoundingClientRect().height)} ${getComputedStyle(a).backgroundColor} ${getComputedStyle(a).boxShadow.slice(-40)}` }; });
  await cr.ctx.close();
  for (const path of ["/app/monitoring", "/app/monitoring?tab=events"]) {
    const { ctx, page } = await open(path);
    const m = await header(page);
    const tabs = await page.evaluate(() => { const t = document.querySelector("[data-monitoring-tabs]"); const a = t?.querySelector('[aria-selected="true"]'); const r = t?.getBoundingClientRect(); return { role: t?.getAttribute("role"), y: Math.round(r?.y ?? 0), h: Math.round(r?.height ?? 0), bg: t && getComputedStyle(t).backgroundColor, seg: a && `${Math.round(a.getBoundingClientRect().height)} ${getComputedStyle(a).backgroundColor} ${getComputedStyle(a).boxShadow.slice(-40)}` }; });
    const sec = await tok(page, "--text-secondary", "color");
    check(m.h1?.x === ref.h1?.x && m.h1?.y === ref.h1?.y && m.h1f === ref.h1f && m.h1f.startsWith("32px/40px"), `${path}: the title is Care Reviews' — same place, same ${ref.h1f}`, `${m.h1f} @ ${m.h1?.x},${m.h1?.y}`);
    check(m.sub?.y === ref.sub?.y && m.subf === ref.subf && m.subColor === sec && !/mono/i.test(m.subf), `${path}: the date line — same place, ${ref.subf}, text-secondary, not mono`, m.subf);
    check(/^[A-Z][a-z]+day [A-Z][a-z]+ \d{1,2}, \d{4} · \d+ on watch · 2 supervisors on shift$/.test(m.subText ?? "") && m.subText.startsWith(ref.subText), `${path}: “${ref.subText} · N on watch · 2 supervisors on shift”`, m.subText);
    check(tabs.y === refTabs.y && tabs.h === refTabs.h && tabs.h === 44 && m.rowH === 44, `${path}: the toolbar row at Care Reviews' y, 44 tall`, `${tabs.y}/${tabs.h} vs ${refTabs.y}/${refTabs.h}`);
    check(tabs.role === "tablist" && tabs.bg === refTabs.bg && tabs.seg === refTabs.seg, `${path}: Watch · Events is Care Reviews' pill control — track, thumb, shadow — as a tablist`, `${tabs.seg} | ${refTabs.seg}`);
    const order = await page.evaluate(() => { const ys = ["main h1", "[data-page-toolbar]", "[data-hero-metrics]", "#monitoring-tabpanel"].map((q) => document.querySelector(q)?.getBoundingClientRect().top ?? -1); return ys.every((y, i) => i === 0 || y > ys[i - 1]); });
    check(order, `${path}: title → toolbar → hero → content`);
    await page.screenshot({ path: `${OUT}/s1-${path.includes("events") ? "events" : "watch"}.png`, clip: { x: 0, y: 0, width: 1512, height: 460 } });
    await ctx.close();
  }
}

// ── §2 · NOTHING MOVES ON A TAB SWITCH ─────────────────────────────────────
console.log("\n── §2 · a tab switch moves nothing");
const frame = (page) =>
  page.evaluate(() => {
    const q = ["main h1", '[data-anno-ref="page-purpose"]', "[data-page-toolbar]", "[data-monitoring-tabs]", "[data-layout-group]", "[data-hero-metrics]", ...[...document.querySelectorAll("[data-hero-cell]")].map((_, i) => `[data-hero-cell]:nth-child(${i + 1})`)];
    return Object.fromEntries(q.map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return [s, r ? [r.x, r.y, r.width, r.height].map(Math.round).join(",") : null]; }));
  });
const heroCells = (page) =>
  page.evaluate(() => [...document.querySelectorAll("[data-hero-cell]")].map((c) => {
    const l = c.querySelector("[data-hero-label]"), d = c.querySelector("[data-hero-detail]");
    return { label: l?.textContent, detail: d?.textContent, w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height), oneLine: [l, d].every((x) => x && x.getBoundingClientRect().height <= parseFloat(getComputedStyle(x).lineHeight) + 0.5), dotFirst: !!c.querySelector("[data-crisis-dot]") ? c.querySelector("[data-crisis-dot]").compareDocumentPosition(c.querySelector("[data-hero-value]")) === Node.DOCUMENT_POSITION_FOLLOWING : null };
  }));
{
  const { ctx, page } = await open("/app/monitoring");
  const w = await frame(page);
  const cw = await heroCells(page);
  await page.locator('[data-monitoring-tab="events"]').click();
  await page.waitForURL(/tab=events/);
  await page.waitForTimeout(600);
  const e = await frame(page);
  const ce = await heroCells(page);
  const moved = Object.keys(w).filter((k) => w[k] !== e[k]);
  check(moved.length === 0, "Watch → Events: the title, date line, toolbar, tabs, toggle slot, hero and every hero cell stay put, to the pixel", moved.map((k) => `${k}: ${w[k]} → ${e[k]}`).join(" | "));
  const tg = await page.evaluate(() => { const g = document.querySelector("[data-layout-group]"); return { present: !!g, vis: g && getComputedStyle(g).visibility, ah: g?.getAttribute("aria-hidden"), tab: [...(g?.querySelectorAll("button") ?? [])].every((x) => x.tabIndex === -1) }; });
  check(tg.present && tg.vis === "hidden" && tg.ah === "true" && tg.tab, "on Events the toggle keeps its slot: visibility hidden, aria-hidden, out of the tab order", JSON.stringify(tg));
  check(cw.map((c) => c.label).join() === ce.map((c) => c.label).join() && cw.map((c) => c.label).join(" · ") === "In crisis · High risk · Risk flags · Escalations · Active teens", "the same five labels on both tabs — only numbers and details change", ce.map((c) => c.label).join(" · "));
  check([...cw, ...ce].every((c) => c.h === 120 && c.oneLine) && new Set(cw.map((c) => c.w)).size <= 2, "every cell 120 tall, equal widths, label and detail one line each", JSON.stringify(cw.map((c) => `${c.w}×${c.h}`)));
  check(cw[0].dotFirst === true, "the In-crisis dot sits before the numeral");
  check(/^\d+ mentors · \d+ engaged$/.test(cw[4].detail ?? ""), "“N mentors · N engaged”", String(cw[4].detail));
  await page.locator('[data-monitoring-tab="watch"]').click();
  await page.waitForTimeout(600);
  const back = await frame(page);
  check(Object.keys(w).every((k) => w[k] === back[k]), "and back to Watch: still nothing moved");
  const fade = await page.evaluate(() => { const p = document.querySelector("#monitoring-tabpanel"); const s = getComputedStyle(p); return { name: s.animationName, dur: s.animationDuration, header: getComputedStyle(document.querySelector("[data-page-toolbar]")).animationName }; });
  check(fade.name === "tab-fade" && fade.dur === "0.12s" && fade.header === "none", "the content cross-fades over 120ms; the toolbar does not animate", JSON.stringify(fade));
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/monitoring", { reduced: true });
  const n = await page.evaluate(() => getComputedStyle(document.querySelector("#monitoring-tabpanel")).animationName);
  check(n === "none", "reduced motion: no cross-fade", n);
  await ctx.close();
}

// ── §3 · TIER GROUP HEADERS ────────────────────────────────────────────────
console.log("\n── §3 · tier group headers");
for (const layout of ["cards", "list"]) {
  const ctx0 = await b.newContext({ viewport: { width: 1512, height: 1000 } });
  await ctx0.addInitScript(([k, v, l]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("somethings.monitoring.layout", l); sessionStorage.setItem("seeded", "1"); } }, [KEY, { state: { persona: "supervisor", monitoringScenarioId: "tiers-monitor" }, version: VERSION }, layout]);
  const page = await ctx0.newPage();
  await page.goto(`${BASE}/app/monitoring`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1100);
  const toks = { t1: await tok(page, "--t1"), t2: await tok(page, "--t2"), strong: await tok(page, "--border-strong"), tert: await tok(page, "--text-tertiary", "color"), sec: await tok(page, "--text-secondary", "color"), bd: await tok(page, "--border-default", "color") };
  const hs = await page.evaluate(() => [...document.querySelectorAll("[data-tier-header]")].map((h) => {
    const h3 = h.querySelector("h3"), name = h.querySelector("[data-tier-name]"), count = h.querySelector("[data-tier-count]"), info = h.querySelector("[data-tier-cadence-info]"), tip = h.querySelector("[data-tier-cadence]");
    const cs = (e) => getComputedStyle(e);
    return {
      tier: h.dataset.tierHeader, h3H: Math.round(h3.getBoundingClientRect().height),
      name: `${cs(name).fontSize}/${cs(name).lineHeight} ${cs(name).fontFamily.split(",")[0]}`, count: `${cs(count).fontSize} ${cs(count).color} ${cs(count).fontVariantNumeric}`,
      extra: [...h3.children].filter((c) => !c.matches("[data-tier-dot],[data-tier-name],[data-tier-count]")).length,
      info: info ? { w: Math.round(info.getBoundingClientRect().width), color: cs(info).color, describes: info.getAttribute("aria-describedby") === tip?.id } : null,
      tipVis: tip ? cs(tip).visibility : null, pt: cs(h).paddingTop, pb: cs(h).paddingBottom, dot: cs(h.querySelector("[data-tier-dot]")).backgroundColor,
    };
  }));
  check(hs.length === 4 && hs.every((h) => h.h3H === 24 && h.name === "17px/24px avantt" && h.extra === 0), `${layout}: four headers, each ONE line — dot · name at 17/24 · count — nothing else`, JSON.stringify(hs.map((h) => `${h.tier}:${h.h3H}:${h.name}:${h.extra}`)));
  check(hs.every((h) => h.count.startsWith(`15px ${toks.tert}`) && /tabular-nums/.test(h.count)), `${layout}: the count at 15, text-tertiary, tabular`, hs[0].count);
  check(hs.every((h) => h.info?.w === 20 && h.info.color === toks.tert && h.info.describes && h.tipVis === "hidden"), `${layout}: the cadence behind a 20px tertiary ⓘ, described by its hidden tooltip`, JSON.stringify(hs[0].info));
  check(hs.every((h) => h.pt === "32px" && h.pb === "16px"), `${layout}: 32 above each group, 16 to its first row`, `${hs[0].pt}/${hs[0].pb}`);
  check(hs.find((h) => h.tier === "1")?.dot === toks.t1 && hs.find((h) => h.tier === "2")?.dot === toks.t2 && ["3", "4"].every((t) => hs.find((h) => h.tier === t)?.dot === toks.strong), `${layout}: the dot is tinted for Tiers 1–2 only`);
  /* The tooltip: focus shows it, Esc hides it, hover shows it. */
  const info = page.locator('[data-tier-cadence-info="2"]');
  await info.focus();
  const onFocus = await page.evaluate(() => { const t = document.querySelector('[data-tier-header="2"] [data-tier-cadence]'); return { vis: getComputedStyle(t).visibility, text: t.textContent }; });
  await page.keyboard.press("Escape");
  const afterEsc = await page.evaluate(() => getComputedStyle(document.querySelector('[data-tier-header="2"] [data-tier-cadence]')).visibility);
  await page.locator("body").focus();
  await info.hover();
  const onHover = await page.evaluate(() => getComputedStyle(document.querySelector('[data-tier-header="2"] [data-tier-cadence]')).visibility);
  check(onFocus.vis === "visible" && onFocus.text.length > 10 && afterEsc === "hidden" && onHover === "visible", `${layout}: the tooltip shows on focus and on hover, and Esc dismisses it`, JSON.stringify({ onFocus, afterEsc, onHover }));
  const empty = await page.evaluate(() => { const e = document.querySelector("[data-t1-empty]"); const s = e && getComputedStyle(e); return e ? { text: e.textContent.trim(), style: s.borderTopStyle, w: s.borderTopWidth, color: s.borderTopColor, r: s.borderTopLeftRadius, bg: s.backgroundColor, fs: s.fontSize, c: s.color, center: s.justifyContent } : null; });
  check(empty?.text === "Nothing in crisis" && empty.style === "dashed" && empty.w === "1px" && empty.color === toks.bd && empty.r === "20px" && empty.bg === "rgba(0, 0, 0, 0)" && empty.fs === "15px" && empty.c === toks.sec && empty.center === "center", `${layout}: Tier 1 empty — a dashed 1px contour, 20px, centred, 15 text-secondary, no fill`, JSON.stringify(empty));
  await page.screenshot({ path: `${OUT}/s3-headers-${layout}.png`, clip: { x: 248, y: 400, width: 1248, height: 520 } });
  await ctx0.close();
}

await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
