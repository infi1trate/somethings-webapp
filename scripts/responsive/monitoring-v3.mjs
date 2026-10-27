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
//   §4  cards: white with a tier contour, NO tint fill anywhere but the live
//       Tier 1 lane; the anatomy measured (header · engagement block with the
//       sparkline under the numeral · one icon-led signals row · the 2px
//       time line · the footer pill); 3-up ≥1280, 2-up below; Tier 4 as
//       registry rows; AA on every text pair, both themes
//   §5  Events: one toolbar row (range · Filters with a count badge and a
//       popover · Export); applied filters as removable chips only when
//       active; day headers sticky with their count; the 56px row's anatomy;
//       a teen's flags in a day collapse into one row; windowed by day
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
      tipVis: tip ? cs(tip).display : null, pt: cs(h).paddingTop, pb: cs(h).paddingBottom, dot: cs(h.querySelector("[data-tier-dot]")).backgroundColor,
    };
  }));
  check(hs.length === 4 && hs.every((h) => h.h3H === 24 && h.name === "17px/24px avantt" && h.extra === 0), `${layout}: four headers, each ONE line — dot · name at 17/24 · count — nothing else`, JSON.stringify(hs.map((h) => `${h.tier}:${h.h3H}:${h.name}:${h.extra}`)));
  check(hs.every((h) => h.count.startsWith(`15px ${toks.tert}`) && /tabular-nums/.test(h.count)), `${layout}: the count at 15, text-tertiary, tabular`, hs[0].count);
  check(hs.every((h) => h.info?.w === 20 && h.info.color === toks.tert && h.info.describes && h.tipVis === "none"), `${layout}: the cadence behind a 20px tertiary ⓘ, described by its hidden tooltip`, JSON.stringify(hs[0].info));
  check(hs.every((h) => h.pt === "32px" && h.pb === "16px"), `${layout}: 32 above each group, 16 to its first row`, `${hs[0].pt}/${hs[0].pb}`);
  check(hs.find((h) => h.tier === "1")?.dot === toks.t1 && hs.find((h) => h.tier === "2")?.dot === toks.t2 && ["3", "4"].every((t) => hs.find((h) => h.tier === t)?.dot === toks.strong), `${layout}: the dot is tinted for Tiers 1–2 only`);
  /* The tooltip: focus shows it, Esc hides it, hover shows it. */
  const info = page.locator('[data-tier-cadence-info="2"]');
  await info.focus();
  const onFocus = await page.evaluate(() => { const t = document.querySelector('[data-tier-header="2"] [data-tier-cadence]'); return { vis: getComputedStyle(t).display, text: t.textContent }; });
  await page.keyboard.press("Escape");
  const afterEsc = await page.evaluate(() => getComputedStyle(document.querySelector('[data-tier-header="2"] [data-tier-cadence]')).display);
  await page.locator("body").focus();
  await info.hover();
  const onHover = await page.evaluate(() => getComputedStyle(document.querySelector('[data-tier-header="2"] [data-tier-cadence]')).display);
  check(onFocus.vis === "block" && onFocus.text.length > 10 && afterEsc === "none" && onHover === "block", `${layout}: the tooltip shows on focus and on hover, and Esc dismisses it`, JSON.stringify({ onFocus, afterEsc, onHover }));
  const empty = await page.evaluate(() => { const e = document.querySelector("[data-t1-empty]"); const s = e && getComputedStyle(e); return e ? { text: e.textContent.trim(), style: s.borderTopStyle, w: s.borderTopWidth, color: s.borderTopColor, r: s.borderTopLeftRadius, bg: s.backgroundColor, fs: s.fontSize, c: s.color, center: s.justifyContent } : null; });
  check(empty?.text === "Nothing in crisis" && empty.style === "dashed" && empty.w === "1px" && empty.color === toks.bd && empty.r === "20px" && empty.bg === "rgba(0, 0, 0, 0)" && empty.fs === "15px" && empty.c === toks.sec && empty.center === "center", `${layout}: Tier 1 empty — a dashed 1px contour, 20px, centred, 15 text-secondary, no fill`, JSON.stringify(empty));
  await page.screenshot({ path: `${OUT}/s3-headers-${layout}.png`, clip: { x: 248, y: 400, width: 1248, height: 520 } });
  await ctx0.close();
}

// ── §4 · THE CARDS ──────────────────────────────────────────────────────────
console.log("\n── §4 · the cards, streamlined");
const lum = (rgb) => { const m = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const theme of ["light", "dark"]) {
  const ctx0 = await b.newContext({ viewport: { width: 1512, height: 1000 } });
  await ctx0.addInitScript(([k, v, t]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("somethings.theme", t); localStorage.setItem("somethings.monitoring.layout", "cards"); sessionStorage.setItem("seeded", "1"); } }, [KEY, { state: { persona: "supervisor", monitoringScenarioId: "tiers-monitor" }, version: VERSION }, theme]);
  const page = await ctx0.newPage();
  await page.goto(`${BASE}/app/monitoring`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1100);
  const T = { raised: await tok(page, "--surface-raised"), sunken: await tok(page, "--surface-sunken"), t1soft: await tok(page, "--t1-soft"), t2soft: await tok(page, "--t2-soft"), bd: await tok(page, "--border-default", "color"), tert: await tok(page, "--text-tertiary", "color"), prim: await tok(page, "--text-primary", "color"), sec: await tok(page, "--text-secondary", "color"), muted: await tok(page, "--text-muted", "color"), t2mix: await page.evaluate(() => { const e = document.createElement("span"); e.style.color = "color-mix(in srgb, var(--t2) 45%, transparent)"; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; }) };
  const fills = await page.evaluate(([a, b2]) => [...document.querySelectorAll("[data-monitoring-cards] *")].filter((el) => { const bg = getComputedStyle(el).backgroundColor; return (bg === a || bg === b2) && !el.closest("[data-t1-live]"); }).length, [T.t1soft, T.t2soft]);
  check(fills === 0, `${theme}: no tint fill anywhere in the cards view but the live Tier 1 lane`, String(fills));
  const cards = await page.evaluate(() => [...document.querySelectorAll("[data-monitoring-card]")].map((c) => {
    const cs = (e) => (e ? getComputedStyle(e) : null);
    const r = (e) => e?.getBoundingClientRect();
    const av = c.querySelector("[data-tier-avatar]"), name = c.querySelector("h4"), mentor = c.querySelector("[data-card-mentor]"), tag = c.querySelector("[data-tier-tag]");
    const lab = c.querySelector("[data-card-metric-label]"), num = c.querySelector("[data-card-days]"), of = c.querySelector("[data-card-days-label]"), sp = c.querySelector("[data-sparkline]");
    const bars = [...(sp?.children ?? [])];
    const sig = [...c.querySelectorAll("[data-card-signal]")];
    const tit = c.querySelector("[data-card-tit]"), track = c.querySelector("[data-tit-track]"), cap = c.querySelector("[data-tit-caption]");
    const pill = c.querySelector("[data-card-review]");
    return {
      tier: c.dataset.tier, bg: cs(c).backgroundColor, bw: cs(c).borderTopWidth, bc: cs(c).borderTopColor, radius: cs(c).borderTopLeftRadius, pad: cs(c).paddingTop, shadow: cs(c).boxShadow,
      av: Math.round(r(av).width), name: `${cs(name).fontSize}/${cs(name).lineHeight} ${cs(name).fontFamily.split(",")[0]}`, mentor: `${cs(mentor).fontSize} ${cs(mentor).color}`, tag: `${cs(tag).fontSize}/${cs(tag).lineHeight} ${cs(tag).backgroundColor}`,
      lab: lab?.textContent.trim(), labStyle: `${cs(lab).fontSize}/${cs(lab).lineHeight} ${cs(lab).color} ${cs(lab).textTransform}`,
      num: `${cs(num).fontSize}/${cs(num).lineHeight}`, of: of?.textContent.trim(), ofStyle: `${cs(of).fontSize} ${cs(of).color}`, baseline: Math.abs(r(num).bottom - r(of).bottom) <= 6,
      sp: sp ? { w: Math.round(r(sp).width), h: Math.round(r(sp).height), under: r(sp).top >= r(num).bottom - 1, gap: cs(sp).columnGap, radius: cs(bars[0]).borderTopLeftRadius, last: cs(bars.at(-1)).backgroundColor, rest: [...new Set(bars.slice(0, -1).map((x) => cs(x).backgroundColor))] } : null,
      sig: sig.map((g) => ({ name: g.dataset.cardSignal, words: g.getAttribute("aria-label"), title: g.getAttribute("title"), top: Math.round(r(g).top), icon: Math.round(r(g.querySelector("svg")).width), iconC: cs(g.querySelector("svg")).color, num: `${cs(g.querySelector("[data-signal-count]")).fontSize} ${cs(g.querySelector("[data-signal-count]")).color} ${cs(g.querySelector("[data-signal-count]")).fontVariantNumeric}`, detail: g.querySelector("[data-signal-detail]") ? `${cs(g.querySelector("[data-signal-detail]")).fontSize} ${cs(g.querySelector("[data-signal-detail]")).color}` : null, zero: g.querySelector("[data-signal-count]").textContent === "0" })),
      sigGap: cs(c.querySelector("[data-card-stats]")).columnGap, labels: /Risk flags|Surveys|Time in tier/.test(c.innerText),
      tit: tit ? { h: Math.round(r(track).height), bg: cs(track).backgroundColor, cap: `${cs(cap).fontSize} ${cs(cap).color}`, right: Math.abs(r(cap).right - r(tit).right) <= 1, text: cap.textContent.trim() } : null,
      pill: pill ? { bg: cs(pill).backgroundColor, f: `${cs(pill).fontSize}/${cs(pill).lineHeight}`, border: cs(pill).borderTopWidth } : null,
    };
  }));
  check(cards.length > 0 && cards.every((c) => c.tier !== "4"), `${theme}: Tiers 2–3 are cards; Tier 4 is not`, cards.map((c) => c.tier).join());
  check(cards.every((c) => c.bg === T.raised && c.bw === "1px" && c.radius === "20px" && c.pad === "20px" && /0px 1px 2px/.test(c.shadow)), `${theme}: every card white, a 1px contour, 20px radius, 20 in, the soft elevation`, JSON.stringify(cards[0] && { bg: cards[0].bg, bw: cards[0].bw }));
  const t2 = cards.find((c) => c.tier === "2"), t3 = cards.find((c) => c.tier === "3");
  check(t2?.bc === T.t2mix && t3?.bc === T.bd, `${theme}: tier as contour — Tier 2 the t2 hue at 45%, Tier 3 border-default`, `${t2?.bc} · ${t3?.bc}`);
  check(cards.every((c) => c.av === 40 && c.name === "17px/22px avantt" && c.mentor === `13px ${T.sec}` && /^11px\/16px/.test(c.tag)), `${theme}: header — a 40px avatar, the name 17/22, the mentor 13 secondary, the 11/16 tag`, JSON.stringify(cards[0] && { av: cards[0].av, n: cards[0].name, t: cards[0].tag }));
  check(cards.every((c) => c.lab === "Engagement · 7 days" && c.labStyle === `11px/16px ${T.tert} uppercase` && c.num === "32px/36px" && /^of \d+ days$/.test(c.of) && c.ofStyle === `15px ${T.sec}` && c.baseline), `${theme}: ENGAGEMENT · 7 DAYS, the numeral 32/36, “of N days” 15 on its baseline`, JSON.stringify(cards[0] && { l: cards[0].labStyle, of: cards[0].of }));
  check(cards.every((c) => c.sp?.w === 120 && c.sp.h === 20 && c.sp.under && c.sp.gap === "3px" && c.sp.radius === "3px" && c.sp.last === T.prim && c.sp.rest.length === 1 && c.sp.rest[0] === T.tert), `${theme}: the 120×20 sparkline under the numeral — 3px bars apart, tertiary, the last in primary`, JSON.stringify(cards[0]?.sp));
  check(cards.every((c) => c.sig.length === 3 && new Set(c.sig.map((g) => g.top)).size === 1 && c.sigGap === "20px" && !c.labels), `${theme}: the signals are ONE line of three, 20 apart, no labels`, JSON.stringify(cards[0]?.sig.map((g) => g.top)));
  check(cards.every((c) => c.sig.every((g) => g.icon === 16 && g.iconC === T.tert && g.words && g.words === g.title && /^(Risk flags|Escalations|Surveys): \d+/.test(g.words) && (g.zero ? g.detail === null && g.num.startsWith(`15px ${T.muted}`) : g.num.startsWith(`15px ${T.prim}`)) && /tabular-nums/.test(g.num) && (g.detail === null || g.detail === `13px ${T.sec}`))), `${theme}: each signal — 16px tertiary icon, 15 tabular number (a zero muted, no detail), 13 secondary detail, named in words and on hover`, JSON.stringify(cards[0]?.sig[0]));
  check(cards.filter((c) => c.tit).every((c) => c.tit.h === 2 && c.tit.bg === T.sunken && c.tit.cap === `13px ${T.sec}` && c.tit.right && /^Day \d+ of \d+$/.test(c.tit.text)), `${theme}: time in tier — a 2px sunken track, “Day N of M” right-aligned, no label`, JSON.stringify(cards.find((c) => c.tit)?.tit));
  check(cards.filter((c) => c.pill).every((c) => c.pill.bg === T.sunken && c.pill.f === "12px/16px" && c.pill.border === "0px"), `${theme}: the footer's reason pill — sunken, 12/16, no border`, JSON.stringify(cards.find((c) => c.pill)?.pill));
  /* AA, every text pair on the card. */
  const pairs = [["secondary", T.sec], ["tertiary label", T.tert], ["muted zero", T.muted], ["primary", T.prim]].map(([n, c]) => [n, ratio(c, T.raised)]);
  check(pairs.every(([, r]) => r >= 4.5), `${theme}: AA on the card — ${pairs.map(([n, r]) => `${n} ${r.toFixed(2)}`).join(" · ")}`);
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('[data-tier-group="3"] [data-card-grid]')).gridTemplateColumns.split(" ").length);
  check(cols === 3, `${theme} @1512: 3-up`, String(cols));
  const t4 = await page.evaluate(() => { const g = document.querySelector('[data-tier-group="4"]'); const rows = [...g.querySelectorAll("[data-monitoring-row]")]; return { cards: g.querySelectorAll("[data-monitoring-card]").length, rows: rows.length, h: rows.map((r) => Math.round(r.getBoundingClientRect().height)), show: g.querySelector("[data-tier4-toggle]")?.textContent.trim(), header: !!g.querySelector('[role="columnheader"]') }; });
  check(t4.cards === 0 && t4.rows === 2 && t4.h.every((h) => h === 64) && t4.show === "Show all 100" && t4.header, `${theme}: Tier 4 — two 64px registry rows with their column header, then “Show all 100”`, JSON.stringify(t4));
  if (theme === "light") {
    await page.locator('[data-tier-group="4"] [data-tier4-toggle]').click();
    await page.waitForTimeout(400);
    const open4 = await page.evaluate(() => ({ rendered: document.querySelectorAll('[data-tier-group="4"] [data-monitoring-row]').length, win: document.querySelector('[data-tier-group="4"] [data-tier4-window]')?.dataset.tier4Window }));
    check(open4.rendered > 2 && open4.rendered < 100 && !!open4.win, "Show all opens the registry windowed — a slice rendered, not all 100", JSON.stringify(open4));
  }
  await page.evaluate(() => document.querySelector('[data-tier-group="2"]').scrollIntoView({ block: "start" }));
  await page.screenshot({ path: `${OUT}/s4-cards-${theme}.png` });
  await ctx0.close();
}
{
  const ctx0 = await b.newContext({ viewport: { width: 1200, height: 1000 } });
  await ctx0.addInitScript(([k, v]) => { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("somethings.monitoring.layout", "cards"); }, [KEY, { state: { persona: "supervisor", monitoringScenarioId: "tiers-monitor" }, version: VERSION }]);
  const page = await ctx0.newPage();
  await page.goto(`${BASE}/app/monitoring`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('[data-tier-group="3"] [data-card-grid]')).gridTemplateColumns.split(" ").length);
  check(cols === 2, "@1200: 2-up below 1280", String(cols));
  await ctx0.close();
}

// ── §5 · EVENTS ─────────────────────────────────────────────────────────────
console.log("\n── §5 · Events: a calm log");
{
  const { ctx, page } = await open("/app/monitoring?tab=events", { extra: { chatScenarioId: "escalation-active" } });
  await page.evaluate(() => document.querySelector("[data-events]").scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  const T = { tert: await tok(page, "--text-tertiary", "color"), sec: await tok(page, "--text-secondary", "color"), prim: await tok(page, "--text-primary", "color"), strong: await tok(page, "--surface-sunken-strong"), t1: await tok(page, "--t1"), t1ink: await tok(page, "--t1-ink", "color") };
  const tb = await page.evaluate(() => {
    const r = (e) => e?.getBoundingClientRect();
    const g = document.querySelector("[data-range-group]"), f = document.querySelector("[data-filters-button]"), x = document.querySelector("[data-export-csv]");
    return { tops: [g, f, x].map((e) => Math.round(r(e).top)), hs: [g, f, x].map((e) => Math.round(r(e).height)), chipsOut: document.querySelectorAll("[data-filter-chip], [data-filter-picker]").length, applied: !!document.querySelector("[data-applied-filters]"), badge: !!document.querySelector("[data-filters-badge]"), exportRight: Math.abs(r(x).right - r(document.querySelector("[data-events-filter]")).right) <= 1 };
  });
  check(new Set(tb.tops).size === 1 && tb.hs.every((h) => h === 44) && tb.exportRight, "one toolbar row: range · Filters · Export CSV at the right, all 44 tall", JSON.stringify(tb));
  check(tb.chipsOut === 0 && !tb.applied && !tb.badge, "no loose chip rows: types, tiers and pickers live in the popover; nothing applied, no second row, no badge", JSON.stringify(tb));
  await page.locator("[data-filters-button]").click();
  await page.waitForTimeout(200);
  const pop = await page.evaluate(() => { const p = document.querySelector("[data-filters-popover]"); const ids = [...(p?.querySelectorAll("[data-filter-chip]") ?? [])].map((c) => c.dataset.filterChip); return { kinds: ids.filter((i) => !/^t\d$/.test(i)).length, tiers: ids.filter((i) => /^t\d$/.test(i)).length, pickers: [...(p?.querySelectorAll("[data-filter-picker]") ?? [])].map((x) => x.dataset.filterPicker).join() }; });
  check(pop.kinds === 4 && pop.tiers === 4 && pop.pickers === "mentor,supervisor", "the popover holds event types, tiers, mentor and supervisor", JSON.stringify(pop));
  await page.locator('[data-filter-chip="note"]').click();
  await page.locator('[data-filter-chip="t4"]').click();
  await page.locator('[data-filter-picker="mentor"]').fill("noah");
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const ap = await page.evaluate(() => ({ chips: [...document.querySelectorAll("[data-applied-chip]")].map((c) => `${c.dataset.appliedChip}=${c.textContent.trim()}`), badge: document.querySelector("[data-filters-badge]")?.textContent, label: document.querySelector("[data-filters-button]")?.getAttribute("aria-label") }));
  check(ap.chips.length === 3 && ap.badge === "3" && ap.label === "Filters, 3 applied", "applied: a second row of removable chips, and the badge counts them", JSON.stringify(ap));
  await page.locator('[data-applied-chip="mentor"]').click();
  await page.waitForTimeout(200);
  const ap2 = await page.evaluate(() => document.querySelectorAll("[data-applied-chip]").length);
  await page.locator("[data-clear-filters]").click();
  await page.waitForTimeout(200);
  const ap3 = await page.evaluate(() => ({ row: !!document.querySelector("[data-applied-filters]"), badge: !!document.querySelector("[data-filters-badge]") }));
  check(ap2 === 2 && !ap3.row && !ap3.badge, "removing a chip clears that filter; Clear all clears the row", JSON.stringify({ ap2, ...ap3 }));
  const sum = await page.evaluate(() => { const e = document.querySelector("[data-events-summary]"); const s = getComputedStyle(e); return { f: `${s.fontSize} ${s.color}`, tab: [...e.querySelectorAll("span")].every((x) => getComputedStyle(x).fontVariantNumeric.includes("tabular-nums")) }; });
  check(sum.f === `13px ${T.sec}` && sum.tab, "the summary: one sentence, 13 secondary, numerals tabular", JSON.stringify(sum));
  const day = await page.evaluate(() => { const h = document.querySelector("[data-day-header]"); const s = getComputedStyle(h); const c = h.querySelector("[data-day-count]"); return { f: `${s.fontSize}/${s.lineHeight} ${s.fontFamily.split(",")[0]}`, pos: s.position, pt: s.paddingTop, pb: s.paddingBottom, text: h.textContent.trim(), cc: getComputedStyle(c).color }; });
  check(day.f === "13px/18px avantt" && day.pos === "sticky" && day.pt === "24px" && day.pb === "8px" && /^Today · \d+$/.test(day.text) && day.cc === T.tert, "day headers: sticky, 13/18 (Avantt), the count tertiary after a middle dot, 24 above and 8 below", JSON.stringify(day));
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-event]:not([data-event-run]) ")].slice(0, 12).map((li) => {
    const cs = (e) => getComputedStyle(e);
    const grid = li.firstElementChild, t = li.querySelector("[data-event-time]"), circ = li.querySelector('span[aria-hidden].size-7'), glyph = circ?.querySelector("svg"), teen = li.querySelector("[data-event-teen]"), mentor = teen?.nextElementSibling, det = li.querySelector("[data-event-detail]"), st = li.querySelector("[data-event-chip]"), dot = li.querySelector("[data-open-dot]"), chev = li.querySelector("[data-event-expand]");
    return { kind: li.dataset.eventKind, tier: li.dataset.eventTier, state: li.dataset.eventState, h: Math.round(grid.getBoundingClientRect().height), r: cs(li).borderTopLeftRadius, time: `${cs(t).fontSize} ${cs(t).color} ${Math.round(t.getBoundingClientRect().width)}`, circ: circ && `${Math.round(circ.getBoundingClientRect().width)} ${cs(circ).backgroundColor}`, glyph: glyph && cs(glyph).color, teen: `${cs(teen).fontSize} ${cs(teen).fontFamily.split(",")[0]}`, mentor: mentor && `${cs(mentor).fontSize} ${cs(mentor).color}`, det: `${cs(det).fontSize} ${cs(det).color}`, st: st && `${cs(st).fontSize} ${cs(st).color}`, dot: dot && `${Math.round(dot.getBoundingClientRect().width)} ${cs(dot).backgroundColor}`, chev: cs(chev).opacity };
  }));
  check(rows.length > 0 && rows.every((x) => x.h >= 56 && x.r === "12px" && x.time.startsWith(`13px ${T.tert} 64`) && x.circ === `28 ${T.strong}` && x.teen === "15px avantt" && x.mentor === `13px ${T.sec}` && x.det === `14px ${T.sec}`), "rows: ≥56 tall, 12px radius; time 13 tertiary in a 64 column; a 28px soft circle; teen 15; mentor 13; detail 14 secondary", JSON.stringify(rows[0]));
  check(rows.filter((x) => x.st).every((x) => x.st === `13px ${T.tert}`) && rows.every((x) => x.chev === "0"), "the state is quiet text (13 tertiary); the chevron waits for hover", JSON.stringify(rows.map((x) => x.st).slice(0, 3)));
  const opens = rows.filter((x) => x.state === "open");
  check(opens.length > 0 && opens.every((x) => x.dot === `6 ${Number(x.tier) <= 2 ? T.t1 : T.sec}`) && rows.filter((x) => x.state !== "open").every((x) => !x.dot), "a 6px dot only while Open — the alert hue for Tiers 1–2 alone", JSON.stringify(opens.map((x) => [x.tier, x.dot])));
  /* And the other half of the rule: an OPEN Tier 3 escalation's dot is
     neutral. The fixture's only open one is Tier 1, so raise a Tier 3 on Sam
     as his mentor, then read it here as the supervisor. */
  {
    const m = await b.newContext({ viewport: { width: 1512, height: 1000 } });
    await m.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem("seeded", "1"); } }, [KEY, { state: { persona: "mentor", chatScenarioId: "active-mentorship" }, version: VERSION }]);
    const mp = await m.newPage();
    await mp.goto(`${BASE}/app/chat/t14`, { waitUntil: "networkidle" });
    await mp.waitForTimeout(1100);
    if (!(await mp.locator("[data-care-panel]").count())) await mp.locator('[data-rail-tab="care"]').click();
    await mp.locator('[data-tier-action="escalate"]').click();
    await mp.locator('[data-tier-row="3"]').click();
    await mp.locator("[data-tier-field=note]").fill("Probe: a Tier 3 raise.");
    await mp.locator("[data-tier-cta=raise]").click();
    await mp.waitForTimeout(500);
    const st = await mp.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
    await m.close();
    const sv = await open("/app/monitoring?tab=events", { extra: { chatScenarioId: "active-mentorship", escalations: st.escalations, tierEvents: st.tierEvents } });
    const t3 = await sv.page.evaluate(() => { const r = [...document.querySelectorAll('[data-event][data-event-state="open"]')].find((x) => x.dataset.eventTier === "3"); const d = r?.querySelector("[data-open-dot]"); return d ? getComputedStyle(d).backgroundColor : null; });
    check(t3 === T.sec, "an open Tier 3 escalation's dot is neutral — never the alert hue", String(t3));
    await sv.ctx.close();
  }
  const t1e = rows.find((x) => x.kind === "escalation" && x.tier === "1");
  check(!t1e || t1e.glyph === T.t1ink, "a Tier 1 escalation's glyph is the t1 ink", JSON.stringify(t1e?.glyph));
  /* The collapsed run. */
  const run = await page.evaluate(() => { const r = document.querySelector("[data-event-run]"); return r ? { n: Number(r.dataset.eventRun), detail: r.querySelector("[data-event-detail]")?.textContent.trim(), teen: r.querySelector("[data-event-teen]")?.textContent } : null; });
  check(!!run && run.n >= 2 && new RegExp(`^${run.n} flags( today)? · [^·]+$`).test(run.detail), "a teen's flags in a day collapse into one row: “N flags today · <the newest flag's words>”", JSON.stringify(run));
  await page.locator("[data-event-run]").first().hover();
  await page.waitForTimeout(300); // the chevron's opacity transition
  const hov = await page.evaluate(() => getComputedStyle(document.querySelector("[data-event-run] [data-event-expand]")).opacity);
  await page.locator("[data-event-run] [data-event-expand]").first().click();
  await page.waitForTimeout(200);
  const nested = await page.evaluate(() => document.querySelectorAll("[data-event-run] [data-run-flags] [data-event]").length);
  check(hov === "1" && nested === run?.n, "hovered, its chevron shows; expanded, the individual flags", `${hov} · ${nested} of ${run?.n}`);
  /* The record, expanded: inset 16. */
  const plain = page.locator("[data-event]:not([data-event-run]):not([data-run-flags] *)").first();
  await plain.hover();
  await plain.locator("[data-event-expand]").click();
  await page.waitForTimeout(200);
  const rec = await page.evaluate(() => { const r = document.querySelector("[data-event-record]"); const li = r.closest("[data-event]"); return { inset: Math.round(r.getBoundingClientRect().left - li.getBoundingClientRect().left), pad: getComputedStyle(r).paddingLeft, link: r.querySelector("[data-event-timeline]")?.textContent.trim() ?? null }; });
  check(rec.inset === 16 && rec.pad === "16px", "the expanded record, inset 16, with Open timeline › where there is one", JSON.stringify(rec));
  await page.screenshot({ path: `${OUT}/s5-events.png` });
  /* Windowed by day, at 90d. */
  await page.locator('[data-range="90d"]').click();
  await page.waitForTimeout(500);
  const w = await page.evaluate(() => ({ days: document.querySelectorAll("[data-event-day]").length, rendered: document.querySelectorAll("[data-day-rendered]").length, rows: document.querySelectorAll("[data-event]").length }));
  await page.evaluate(() => { const sc = [...document.querySelectorAll("*")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 400); sc.scrollTop = sc.scrollHeight; });
  await page.waitForTimeout(700);
  const end = await page.evaluate(() => { const days = [...document.querySelectorAll("[data-event-day]")]; return { lastRendered: !!days.at(-1)?.dataset.dayRendered, rendered: document.querySelectorAll("[data-day-rendered]").length, firstRendered: !!days[0]?.dataset.dayRendered }; });
  check(w.days > 20 && w.rendered < w.days && end.lastRendered && end.rendered < w.days, "90d is windowed by day: only the days near the scroll render — the end renders when reached", JSON.stringify({ ...w, ...end }));
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
