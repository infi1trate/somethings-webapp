// ═══════════════════════════════════════════════════════════════════════════
// /app/monitoring — THE TIERED OVERVIEW, measured (proto/monitoring-merge)
//
// Ported from the separate prototype's probe (`scripts/prototype/monitoring.mjs`
// in the retired :3010 clone) when the page folded into this app. What changed
// in the port, so a reader can tell a moved claim from a weakened one:
//
//   · BASE is :3000 and the route is `/app/monitoring`, seeded as a supervisor.
//   · Monitor / Alert are the dev bar's Scenario axis (`Tiers · Monitor`,
//     `Tiers · Alert`), driven through the real dev bar — not a prototype
//     toolbar, which no longer exists.
//   · Every colour is read off THIS app's tokens. The port substituted
//     `--error-strong` → `--state-error`, `--text-disabled` →
//     `--state-inactive`, `--border-strong` → `--border-default` and Elevation 2
//     → `--shadow-panel`; the checks follow the substitution rather than a hex.
//   · The hero's hairlines are its grid's 1px gaps now (so it can wrap), not a
//     border-left per cell — the check measures the gap.
//   · The sound toggle is gone, and Join no longer opens a mitigation layer
//     (out of scope, `TODO(monitoring)`): Join answers the alert, and that is
//     what is checked.
//   · Storage that throws is scoped to the layout key: this app's persona lives
//     in storage too, and blocking all of it measures the persona gate instead.
//
// ADDED IN THE PORT (step 7): the nav names Monitoring and Chats under the
// Monitoring group and nothing else; the badge is teens needing review and
// follows the scenario; the retired routes land here in one hop with their
// params; and nothing scrolls sideways at a phone or a tablet.
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PATH = "/app/monitoring";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/monitoring-tiers";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
async function open(width = 1512, opts = {}) {
  const ctx = await b.newContext({
    viewport: { width, height: opts.height ?? 982 },
    deviceScaleFactor: opts.dpr ?? 1,
    reducedMotion: opts.reducedMotion ?? "no-preference",
  });
  /* MONITORING v2: CARDS ARE THE DEFAULT. Steps written against the list seed
     it; `layout: "default"` leaves storage empty to test a fresh session. */
  await ctx.addInitScript(
    ([k, v, layout]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        if (layout !== "default") localStorage.setItem("somethings.monitoring.layout", layout);
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona: "supervisor", monitoringScenarioId: opts.scenario ?? "tiers-monitor" }, version: VERSION }, opts.layout ?? "list"]
  );
  /* THE THEME COMES FROM STORAGE, not `emulateMedia`: this app applies a
     `.dark` class from `somethings.theme` and never reads the OS preference
     (`monitoring-contrast.mjs` measured light twice before learning that). */
  if (opts.theme) {
    await ctx.addInitScript((t) => localStorage.setItem("somethings.theme", t), opts.theme);
  }
  if (opts.blockLayout) {
    await ctx.addInitScript(() => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k) {
        if (k === "somethings.monitoring.layout") throw new Error("blocked");
        return get.call(this, k);
      };
      Storage.prototype.setItem = function (k, v) {
        if (k === "somethings.monitoring.layout") throw new Error("blocked");
        return set.call(this, k, v);
      };
    });
  }
  const page = await ctx.newPage();
  await page.goto(`${BASE}${opts.path ?? PATH}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return { ctx, page };
}
/* THE DEV BAR'S SCENARIO AXIS, clicked as a person would. */
const setMode = async (page, mode) => {
  await page.locator('[data-dev-bar-root] button[aria-label^="Scenario:"]').first().click();
  await page.waitForTimeout(200);
  await page.locator("button", { hasText: new RegExp(`^Tiers · ${mode === "alert" ? "Alert" : "Monitor"}$`) }).first().click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
};
/* A token's resolved value, for comparing a computed style to it. */
const tok = (page, v, prop = "color") =>
  page.evaluate(
    ([v, prop]) => {
      const e = document.createElement("span");
      const key = prop === "color" ? "color" : prop === "shadow" ? "boxShadow" : "backgroundColor";
      e.style[key] = `var(${v})`;
      document.body.appendChild(e);
      const c = getComputedStyle(e)[key];
      e.remove();
      return c;
    },
    [v, prop]
  );
const rgbOf = (c) => c.replace(/^rgba?\(/, "").replace(/\)$/, "").split(",").slice(0, 3).join(",").replace(/\s/g, "");
/* Tailwind composes `shadow-[…]` into a STACK of `--tw-*` layers (four
   transparent zeros, then the token), so a computed shadow equals the token
   only as its last layer. `wears` is that comparison. */
const wears = (shadow, token) => shadow === token || shadow.endsWith(`, ${token}`);
const shadowHas = (shadow, color) => shadow.replace(/\s/g, "").includes(rgbOf(color));

/* THE IDENTITY DISC IS NOT TIER COLOUR. `RecordAvatar` hashes a name to one
   of five Bloom tints, the same on every surface in the app, and two of its
   inks ARE the tier inks' Bloom steps (avatar-brown-fg = apricot/800 = t2-ink,
   avatar-rose-fg = blush/950 = t1-ink — measured on teen-t4-0). The rule is
   about what CARRIES TIER, so the disc is excluded by name, not by loosening
   the colours; whether Monitoring should neutralise it is a design question in
   the report. */
const AVATAR = "[data-tier-ring] > span";

/* ═══ RETARGETED (Tiering & Escalation pack, 2026-10-20) ═══ The roster is
   derived from the one tier store now, and its cast is RECORD teens: the
   board's Juniper / Leo / Mia / Ava / Theo / Ravi became Jordan (t13), Imani
   (t21), Riley (t15), Naomi (t17), Simone (t19) and Ravi (t22). Jordan moves
   INTO the Tier 1 lane on an alert rather than being added, so active teens
   are 106 in both modes. Tier 3 is "Medium risk"; "★ Recommended T1" is the
   canon's "Requested: Tier 1". The seeded store has no mentor name, so the
   live mentor reads "The mentor". */

// ── STEP 1 · title row and hero metrics ────────────────────────────────────
{
  console.log("\n── step 1 · the title row and the hero metrics (1512)");
  const { ctx, page } = await open(1512, { dpr: 2 });
  const t = await page.evaluate(() => {
    const h = document.querySelector("[data-monitoring] h1");
    /* (Monitoring v3, §1) The shared PageHeader's purpose line. */
    const sub = document.querySelector('[data-monitoring] [data-anno-ref="page-purpose"]');
    const s = (e) => getComputedStyle(e);
    return { h: h?.textContent.trim(), hfs: s(h).fontSize, hlh: s(h).lineHeight, hff: s(h).fontFamily, sub: sub?.textContent.trim(), subff: s(sub).fontFamily };
  });
  /* RETARGETED (Monitoring v3, §1): Care Reviews' header — 32/40 Avantt, and
     the date line in the sans, regular, text-secondary. */
  check(t.h === "Monitoring" && t.hfs === "32px" && t.hlh === "40px" && /avantt/i.test(t.hff), "Monitoring, in the heading face at Care Reviews' 32/40", `${t.hfs}/${t.hlh} · ${t.hff.split(",")[0]}`);
  check(/^[A-Z][a-z]+day [A-Z][a-z]+ \d{1,2}, \d{4} · \d+ on watch · 2 supervisors on shift$/.test(t.sub ?? "") && !/mono/i.test(t.subff), "the sans date line: “Friday October 23, 2026 · N on watch · 2 supervisors on shift”", t.sub);

  const hero = await page.evaluate(() => {
    const bar = document.querySelector("[data-hero-metrics]");
    const s = getComputedStyle(bar);
    const cells = [...bar.querySelectorAll("[data-hero-cell]")].map((c) => {
      const [num, label, detail] = [c.querySelector("span.font-display"), c.children[1], c.children[2]];
      const cs = getComputedStyle(c);
      const dot = c.querySelector("[data-crisis-dot]");
      return {
        label: label.textContent.trim(), value: num.textContent.trim(), detail: detail.textContent.trim(),
        nfs: getComputedStyle(num).fontSize, nlh: getComputedStyle(num).lineHeight, nnum: getComputedStyle(num).fontVariantNumeric,
        lfs: getComputedStyle(label).fontSize, lc: getComputedStyle(label).color, dfs: getComputedStyle(detail).fontSize, dff: getComputedStyle(detail).fontFamily,
        bg: cs.backgroundColor, hot: c.dataset.hot === "true",
        dot: dot ? { w: Math.round(dot.getBoundingClientRect().width), anim: getComputedStyle(dot).animationName } : null,
        clickable: !!c.closest("a,button") || c.querySelector("a,button") !== null,
      };
    });
    return { radius: s.borderRadius, shadow: s.boxShadow, bg: s.backgroundColor, gap: s.columnGap, cols: s.gridTemplateColumns.split(" ").length, cells };
  });
  const [secondary, raised, subtle, elev1] = [await tok(page, "--text-secondary"), await tok(page, "--surface-raised", "bg"), await tok(page, "--border-subtle", "bg"), await tok(page, "--elevation-1", "shadow")];
  /* MONITORING v2: WAS 16px and Elevation 1 — "keep as built; round to 20px
     and swap to --el-soft". */
  const elSoftHero = await tok(page, "--el-soft", "shadow");
  check(hero.radius === "20px" && wears(hero.shadow, elSoftHero) && hero.cells.every((c) => c.bg === raised), "one raised surface: 20px, the soft elevation, every cell on surface-raised", `${hero.radius} · ${hero.cells[0].bg}`);
  check(hero.cells.map((c) => c.label).join("|") === "In crisis|High risk|Risk flags|Escalations|Active teens", "five cells, in order — one label set on both tabs (Monitoring v3, §2)", hero.cells.map((c) => c.label).join(" · "));
  check(hero.cols === 5 && hero.gap === "1px" && hero.bg === subtle, "five across, divided by 1px border-subtle hairlines", `${hero.cols} · ${hero.gap} · ${hero.bg}`);
  check(hero.cells.every((c) => c.nfs === "32px" && c.nlh === "36px" && /tabular-nums/.test(c.nnum)), "numerals 32/36, tabular");
  check(hero.cells.every((c) => c.lfs === "13px" && c.lc === secondary && c.dfs === "11px" && /mono/i.test(c.dff)), "labels 13px secondary, details 11px mono");
  check(hero.cells.every((c) => !c.clickable), "not clickable");
  const crisis0 = hero.cells[0];
  check(crisis0.value === "0" && !crisis0.hot && crisis0.dot?.w === 10 && crisis0.dot.anim === "none", "Monitor: In crisis 0, a quiet 10px dot, no pulse", JSON.stringify(crisis0.dot));
  check(hero.cells[1].value === "2" && /1 review due/.test(hero.cells[1].detail), "High risk 2, with its 1 review due — derived", hero.cells[1].detail);
  check(hero.cells[4].value === "106", "Monitor: 106 active teens — every record teen plus Tier 4's generated rows", hero.cells[4].value);
  await page.screenshot({ path: `${OUT}/01-monitor-1512.png` });

  await setMode(page, "alert");
  const hot = await page.evaluate(() => {
    const c = document.querySelector('[data-hero-cell="In crisis"]');
    const n = c.querySelector("span.font-display");
    const d = c.querySelector("[data-crisis-dot]");
    return { value: n.textContent, hot: c.dataset.hot, bg: getComputedStyle(c).backgroundColor, nc: getComputedStyle(n).color, dbg: getComputedStyle(d).backgroundColor, anim: getComputedStyle(d).animationName, dc: getComputedStyle(c.children[2]).color, active: document.querySelector('[data-hero-cell="Active teens"] span.font-display').textContent };
  });
  const t1 = await tok(page, "--t1");
  const t1soft = await tok(page, "--t1-soft", "bg");
  check(hot.value === "1" && hot.hot === "true" && hot.bg === t1soft && hot.nc === t1 && hot.dbg === t1 && hot.anim !== "none", "Alert: In crisis 1, the cell tints t1-soft, numeral and dot t1, the dot pulses", JSON.stringify({ v: hot.value, bg: hot.bg, anim: hot.anim }));
  check(hot.dc === secondary, "its detail falls back to secondary on t1-soft (tertiary is 4.39:1)", hot.dc);
  check(hot.active === "106", "Alert: still 106 — the Tier 1 teen MOVED into the lane, derived, not typed", hot.active);
  await page.screenshot({ path: `${OUT}/02-alert-1512.png` });
  await ctx.close();

  const rm = await open(1512, { reducedMotion: "reduce", scenario: "tiers-alert" });
  const anim = await rm.page.evaluate(() => getComputedStyle(document.querySelector("[data-crisis-dot]")).animationName);
  check(anim === "none", "reduced motion: the dot does not pulse — and it is still there", anim);
  await rm.ctx.close();
}

// ── STEP 2 · the Tier 1 lane, Monitor and Alert ────────────────────────────
{
  console.log("\n── step 2 · the Tier 1 lane");
  const { ctx, page } = await open(1512, { dpr: 2 });
  const empty = await page.evaluate(() => {
    const g = document.querySelector('[data-tier-group="1"]');
    const h = g.querySelector("h3");
    const e = g.querySelector("[data-t1-empty]");
    const s = e && getComputedStyle(e);
    return { h3: h?.textContent.replace(/\s+/g, " ").trim(), text: e?.textContent.trim(), bg: s?.backgroundColor, border: s && `${s.borderTopWidth} ${s.borderTopColor}`, color: s?.color, live: !!g.querySelector("[data-t1-live]") };
  });
  const [tertiary, borderDefault, raised, canvas] = [await tok(page, "--text-tertiary"), await tok(page, "--border-default"), await tok(page, "--surface-raised", "bg"), await tok(page, "--surface-canvas", "bg")];
  check(/^Tier 1 · Active crisis\s*0/.test(empty.h3 ?? ""), "its own h3 group header, naming the tier", empty.h3);
  /* ═══ MONITORING v2 (Part B) ═══ WAS "a raised hairline surface". Keylines are down: the one
     keyline is the LIVE lane's, so the empty lane is a canvas tint inside the
     raised container. */
  /* RETARGETED (Monitoring v3, §3): the canvas tint was invisible in the
     cards view (canvas on canvas). The same lane in both views now: a 1px
     dashed border-default contour, no fill, 15 text-secondary. */
  check(empty.text === "Nothing in crisis" && empty.bg === "rgba(0, 0, 0, 0)" && /^1px/.test(empty.border) && !empty.live, "Monitor: a dashed contour, no fill, 'Nothing in crisis'", JSON.stringify(empty));
  await setMode(page, "alert");
  const live = await page.evaluate(() => {
    const r = document.querySelector("[data-t1-live]");
    const s = getComputedStyle(r);
    const ring = r.querySelector("[data-tier-ring]");
    const dot = r.querySelector("[data-presence-dot]");
    const join = r.querySelector("[data-t1-join]");
    const rec = r.querySelector("[data-requested-tier]");
    const flags = r.querySelector("[data-t1-flags]");
    return {
      bg: s.backgroundColor, border: `${s.borderTopWidth} ${s.borderTopColor}`, leftBorder: s.borderLeftWidth === s.borderTopWidth && s.borderLeftColor === s.borderTopColor,
      ring: !!ring, dot: !!dot,
      text: r.textContent.replace(/\s+/g, " ").trim(),
      rec: rec && { color: getComputedStyle(rec).color, border: `${getComputedStyle(rec).borderTopStyle} ${getComputedStyle(rec).borderTopColor}`, text: rec.textContent.trim() },
      flags: flags && { color: getComputedStyle(flags).color, text: flags.textContent.replace(/\s+/g, " ").trim() },
      join: join && { bg: getComputedStyle(join).backgroundColor, color: getComputedStyle(join).color, text: join.textContent.trim(), label: join.getAttribute("aria-label"), h: Math.round(join.getBoundingClientRect().height) },
    };
  });
  const [t1, t1soft, t1ink, ok, okink] = [await tok(page, "--t1"), await tok(page, "--t1-soft", "bg"), await tok(page, "--t1-ink"), await tok(page, "--ok"), await tok(page, "--ok-ink")];
  check(live.bg === t1soft && live.border === `1px ${t1}` && live.leftBorder, "Alert: t1-soft with a 1px t1 keyline, all round (no left bar)", `${live.bg} · ${live.border}`);
  /* ═══ MONITORING v2 (Part B) ═══ WAS "the avatar carries the t1 ring". No rings anywhere; the
     only one is the green presence dot, and Jordan's mentor is in session. */
  check(!live.ring && live.dot, "no avatar ring — the live lane's one keyline, and the presence dot", JSON.stringify({ ring: live.ring, dot: live.dot }));
  check(/Jordan T\./.test(live.text) && /The mentor/.test(live.text) && /Mentor in session/.test(live.text), "teen, mentor, presence — a record teen", live.text.slice(0, 80));
  const secondaryInk = await tok(page, "--text-secondary");
  check(live.rec?.text === "Requested: Tier 1" && /^dashed/.test(live.rec.border) && live.rec.color === secondaryInk, "Requested: Tier 1 — dashed, in words, awaiting a supervisor", JSON.stringify(live.rec));
  check(live.flags?.text.startsWith("4 · 24h") && live.flags.color === t1ink, "the flag signal in t1-ink", JSON.stringify(live.flags));
  check(/^Join · [01]:[0-5]\d$/.test(live.join?.text ?? "") && live.join.bg === t1ink && live.join.color === "rgb(255, 255, 255)" && live.join.h >= 24, "a red Join with the response clock", JSON.stringify(live.join));
  const t0 = await page.locator("[data-t1-join]").textContent();
  await page.waitForTimeout(2100);
  const t1txt = await page.locator("[data-t1-join]").textContent();
  check(t0 !== t1txt, "and the clock runs", `${t0} → ${t1txt}`);
  await page.screenshot({ path: `${OUT}/03-lane-alert-1512.png` });
  await ctx.close();
}

// ── STEP 3 · the list view ─────────────────────────────────────────────────
const ENGINE = `(() => {
  if (window.__c) return;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, u) => { const a = t[3]; return [t[0]*a+u[0]*(1-a), t[1]*a+u[1]*(1-a), t[2]*a+u[2]*(1-a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let base = [255,255,255,1]; if (st.length && st[st.length-1][3] >= 1) base = st.pop(); while (st.length) base = over(st.pop(), base); return base; };
  window.__c = { rgba, ratio, bgOf };
})()`;
{
  console.log("\n── step 3 · the list view (1512)");
  const { ctx, page } = await open(1512, { dpr: 2, scenario: "tiers-alert" });
  const t = await page.evaluate(() => {
    const table = document.querySelector('[data-monitoring-list][role="table"]');
    const heads = [...table.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent.trim());
    const rows = [...table.querySelectorAll("[data-monitoring-row]")];
    const geo = rows.map((r) => {
      const b = r.getBoundingClientRect();
      const s = getComputedStyle(r);
      return { id: r.dataset.monitoringRow, tier: +r.dataset.tier, top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), radius: s.borderRadius, bg: s.backgroundColor, shadow: s.boxShadow, bt: `${s.borderTopWidth} ${s.borderTopColor}`, bl: `${s.borderLeftWidth} ${s.borderLeftColor}`, cellsX: [...r.querySelectorAll(':scope > [role="cell"]')].map((c) => Math.round(c.getBoundingClientRect().left)), ring: !!r.querySelector("[data-tier-ring]"), avatarBg: getComputedStyle(r.querySelector("[data-tier-avatar]")).backgroundColor, tag: r.querySelector("[data-tier-tag]")?.dataset.tierTag, tagBg: getComputedStyle(r.querySelector("[data-tier-tag]")).backgroundColor };
    });
    const h3 = [...table.querySelectorAll("h3")].map((h) => h.textContent.replace(/\s+/g, " ").trim());
    const groups = [...table.querySelectorAll('[role="rowgroup"][data-tier-group]')].map((g) => ({ tier: g.dataset.tierGroup, labelled: !!document.getElementById(g.getAttribute("aria-labelledby") ?? "") }));
    return { heads, geo, h3, groups };
  });
  check(t.heads.join("|") === "Teen|Mentor|Days on platform|Days engaged|Risk flags|Escalations|Surveys", "a table with the seven column headers", t.heads.join(" · "));
  check(t.h3.some((h) => /^Tier 1 · Active crisis/.test(h)) && t.h3.some((h) => /^Tier 2 · High risk/.test(h)) && t.h3.some((h) => /^Tier 3 · Medium risk/.test(h)) && t.h3.some((h) => /^Tier 4 · General/.test(h)), "each tier is an h3 naming it", t.h3.map((h) => h.split(/\d+$/)[0]).join(" | "));
  check(t.groups.length >= 3 && t.groups.filter((g) => g.tier !== "1").every((g) => g.labelled), "each tier rowgroup is labelled by its heading", `${t.groups.length} groups`);
  const body = t.geo;
  /* ═══ MONITORING v2 (Part B) ═══ WAS 52 / 10px / 4px apart. */
  check(body.length > 0 && body.every((r) => r.h === 64 && r.radius === "14px"), "rows 64 tall, 14px radius", [...new Set(body.map((r) => `${r.h}/${r.radius}`))].join(","));
  const gaps = body.slice(1).map((r, i) => (r.tier === body[i].tier ? r.top - body[i].bottom : null)).filter((g) => g !== null);
  check(gaps.length > 0 && gaps.every((g) => g === 8), "8px between rows in a tier", [...new Set(gaps)].join(","));
  const cols = body[0].cellsX.map((_, i) => new Set(body.map((r) => r.cellsX[i])).size);
  check(cols.length === 7 && cols.every((n) => n === 1), "subgrid: every column starts at one x across all tiers", cols.join(","));
  /* AND THE TRACKS ARE THE TABLE'S, not each row's own (seven equal columns
     would align too, which is why alignment alone is not the check). */
  const tracks = await page.evaluate(() => {
    const hx = [...document.querySelectorAll('[data-monitoring-list] [role="columnheader"]')].map((h) => Math.round(h.getBoundingClientRect().left));
    const row = document.querySelector("[data-monitoring-row]");
    const cells = [...row.querySelectorAll(':scope > [role="cell"]')].map((c) => c.getBoundingClientRect());
    return { hx, cx: cells.map((c) => Math.round(c.left)), teen: Math.round(cells[0].width), mentor: Math.round(cells[1].width) };
  });
  check(tracks.hx.every((x, i) => Math.abs(x - tracks.cx[i]) <= 1), "the column headers sit over the cells", `${tracks.hx.join(",")} / ${tracks.cx.join(",")}`);
  check(tracks.teen > tracks.mentor * 1.8, "Teen holds its wide track against Mentor's", `${tracks.teen} vs ${tracks.mentor}`);
  const [t2, t2soft, borderSubtle, secondary, raised, elSoft, canvas, sunken, t1ink, t2inkBg] = [await tok(page, "--t2"), await tok(page, "--t2-soft", "bg"), await tok(page, "--border-subtle"), await tok(page, "--text-secondary"), await tok(page, "--surface-raised", "bg"), await tok(page, "--el-soft", "shadow"), await tok(page, "--surface-canvas", "bg"), await tok(page, "--surface-sunken", "bg"), await tok(page, "--t1-ink", "bg"), await tok(page, "--t2-ink", "bg")];
  const by = (tier) => body.filter((r) => r.tier === tier);
  check(by(2).length > 0 && by(2).every((r) => r.bg === t2soft && (/^0px/.test(r.bt) || /rgba\(0, 0, 0, 0\)$/.test(r.bt)) && r.shadow === "none"), "T2: t2-soft, no keyline (nothing visible at its edge)", JSON.stringify(by(2)[0] && { bg: by(2)[0].bg, bt: by(2)[0].bt }));
  /* ═══ MONITORING v2 (Part B) ═══ T3 WAS Elevation 1; T4 WAS transparent on border-default. */
  check(by(3).length > 0 && by(3).every((r) => r.bg === raised && wears(r.shadow, elSoft)), "T3: surface-raised with the soft elevation — elevation is the signifier");
  check(by(4).length > 0 && by(4).every((r) => r.bg === canvas && r.bt === `1px ${borderSubtle}` && r.shadow === "none"), "T4: surface-canvas, a border-subtle hairline, no shadow", JSON.stringify(by(4)[0] && { bg: by(4)[0].bg, bt: by(4)[0].bt }));
  check(body.every((r) => r.bl === r.bt && !/inset/.test(r.shadow)), "no coloured bar or left border on any row");
  /* ═══ MONITORING v2 (Part B) ═══ WAS "rings: t2, text-secondary, none" and a lozenge per row. */
  check(body.every((r) => !r.ring && r.avatarBg === sunken), "no avatar rings anywhere — every avatar a neutral sunken disc", [...new Set(body.map((r) => r.avatarBg))].join(","));
  check(body.every((r) => r.tag === String(r.tier)) && by(2).every((r) => r.tagBg === t2inkBg) && body.filter((r) => r.tier >= 3).every((r) => r.tagBg === "rgba(0, 0, 0, 0)"), "every row's tag says its tier — filled in the tier ink for T2, outlined for T3–4", JSON.stringify([...new Set(body.map((r) => `${r.tier}:${r.tagBg}`))]));

  /* ALERT COLOUR IS TIERS 1–2 ONLY: nothing on a T3 / T4 row computes to t1,
     t2 or their inks — text, fill or border. */
  const alert = await page.evaluate((AVATAR) => {
    const probe = (v) => { const e = document.createElement("span"); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const red = ["--t1", "--t2", "--t1-ink", "--t2-ink"].map(probe);
    const hits = [];
    const rows = document.querySelectorAll('[data-monitoring-row][data-tier="3"], [data-monitoring-row][data-tier="4"]');
    for (const r of rows)
      for (const el of [r, ...r.querySelectorAll("*")]) {
        if (el.closest(AVATAR)) continue;
        const s = getComputedStyle(el);
        for (const c of [s.color, s.backgroundColor, s.borderTopColor, s.boxShadow]) if (red.some((x) => c.includes(x.slice(4, -1)))) hits.push(r.dataset.monitoringRow);
      }
    return { n: rows.length, hits: [...new Set(hits)] };
  }, AVATAR);
  check(alert.n > 0 && alert.hits.length === 0, "no red or amber anywhere on a Tier 3 or 4 row — the slow-burn glyph included", `${alert.n} rows ${alert.hits.join(",")}`);

  const tones = await page.evaluate(() => {
    /* v2: the tone sits on the NUMBER (and the glyph), not a wrapper. */
    const num = (id, col) => document.querySelector(`[data-monitoring-row="${id}"] [role="cell"]:nth-child(${col}) [data-glyph-count] span.font-mono`);
    const flag = (id) => getComputedStyle(num(id, 5)).color;
    const zero = getComputedStyle(num("t22", 5)).color;
    const theo = document.querySelector('[data-monitoring-row="t19"] [role="cell"]:nth-child(5)').textContent;
    const secondEl = document.querySelector('[data-monitoring-row="t21"] [data-row-second]');
    const second = secondEl?.textContent;
    const secondFf = secondEl && getComputedStyle(secondEl).fontFamily;
    const spark = [...document.querySelectorAll('[data-monitoring-row="t21"] [data-sparkline] > span')].map((b) => ({ w: Math.round(b.getBoundingClientRect().width), x: Math.round(b.getBoundingClientRect().left), bg: getComputedStyle(b).backgroundColor }));
    const sparkH = Math.round(document.querySelector('[data-monitoring-row="t21"] [data-sparkline]').getBoundingClientRect().height);
    return { mia: flag("t15"), leo: flag("t21"), zero, theo, second, secondFf, spark, sparkH };
  });
  const [t2ink, primary, tertiary, sparkInk, muted] = [await tok(page, "--t2-ink"), await tok(page, "--text-primary"), await tok(page, "--text-tertiary"), await tok(page, "--border-strong", "bg"), await tok(page, "--text-muted")];
  check(tones.mia === t2ink && tones.leo === primary, "T2 flags tone only on a surge (Riley t2-ink, Imani ink)", `${tones.mia} / ${tones.leo}`);
  /* WAS state-inactive (the clone's text-disabled), which step 8 measured at
     2.1:1 — a "0" is content. Tertiary is the quietest ink that is text. */
  /* ═══ MONITORING v2 (Part B) ═══ Zero is text-muted (answered on the context report: Bloom's
     text/disabled measures ~1.5:1, and a "0" is content). */
  check(tones.zero === muted, "a zero count on an untinted row is text-muted — quiet, and still AA", tones.zero);
  const tintZero = await page.evaluate(() => getComputedStyle(document.querySelector('[data-monitoring-row="t15"] [role="cell"]:nth-child(6) [data-glyph-count] span.font-mono')).color);
  check(tintZero === secondary, "on a t2 tint a zero falls back to secondary", tintZero);
  check(/↗/.test(tones.theo), "Simone's slow-burn reads ↗, in neutral ink", tones.theo);
  check(tones.second === "From T1 · Fri · Day 3 of 7" && !/mono/i.test(tones.secondFf ?? "mono"), "the second line: review reason · Day N of M, in the sans — mono retreats", `${tones.second} · ${tones.secondFf?.slice(0, 30)}`);
  check(tones.spark.length === 7 && tones.spark.every((b) => b.w === 4 && b.bg === sparkInk) && tones.spark.slice(1).every((b, i) => b.x - tones.spark[i].x === 6) && tones.sparkH === 18, "the sparkline: 7 bars, 4px, 2px apart, 18 tall, border-strong", JSON.stringify(tones.spark.slice(0, 2)));

  /* TEXT ON THE TINTS ≥ 4.5:1 — every text node on a T1 or T2 surface. */
  const contrast = await page.evaluate(([ENGINE]) => {
    eval(ENGINE);
    const { rgba, ratio, bgOf } = window.__c;
    const out = [];
    for (const r of document.querySelectorAll('[data-monitoring-row][data-tier="2"], [data-t1-live]')) {
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!n.textContent.trim() || el.closest(".sr-only") || el.closest('[aria-hidden="true"]')) continue;
        out.push({ t: n.textContent.trim().slice(0, 24), r: Math.round(ratio(rgba(getComputedStyle(el).color), bgOf(el)) * 100) / 100 });
      }
    }
    return out;
  }, [ENGINE]);
  const texts = contrast.filter((c) => !/^[A-Z]$/.test(c.t));
  const low = texts.filter((c) => c.r < 4.5);
  check(texts.length > 0 && low.length === 0, "every text on t1-soft / t2-soft is ≥ 4.5:1", low.length ? JSON.stringify(low) : `${texts.length} texts, lowest ${Math.min(...texts.map((c) => c.r))}:1`);
  await page.screenshot({ path: `${OUT}/04-list-alert-1512.png` });
  await ctx.close();
}

// ── STEP 4 · the card view and the toggle ──────────────────────────────────
{
  console.log("\n── step 4 · the toggle and the card view (1512)");
  const { ctx, page } = await open(1512, { dpr: 2, scenario: "tiers-alert", layout: "default" });
  const tg = await page.evaluate(() => {
    const g = document.querySelector("[data-layout-group]");
    const gs = getComputedStyle(g);
    const bs = [...g.querySelectorAll("button")].map((b) => {
      const r = b.getBoundingClientRect();
      const s = getComputedStyle(b);
      return { v: b.dataset.layoutToggle, w: Math.round(r.width), h: Math.round(r.height), pressed: b.getAttribute("aria-pressed"), label: b.getAttribute("aria-label"), bg: s.backgroundColor, shadow: s.boxShadow };
    });
    return { role: g.getAttribute("role"), radius: gs.borderRadius, border: gs.borderTopWidth, bg: gs.backgroundColor, h: Math.round(g.getBoundingClientRect().height), right: Math.round(g.getBoundingClientRect().right), titleRow: Math.round(document.querySelector("[data-page-toolbar]").getBoundingClientRect().right), bs };
  });
  /* RETARGETED (Monitoring v3, §1): the pill control's language — an s2
     track, 44 tall like the row, the pressed view raised on card white with
     the tile shadow — right-aligned in the toolbar. */
  const [raised, elev1, s2] = [await tok(page, "--surface-card", "bg"), await tok(page, "--shadow-tile", "shadow"), await tok(page, "--surface-s2", "bg")];
  check(tg.role === "group" && tg.bg === s2 && tg.h === 44 && Math.abs(tg.right - tg.titleRow) <= 1, "a 44px pill track, right-aligned in the toolbar", JSON.stringify({ bg: tg.bg, h: tg.h, right: tg.right, row: tg.titleRow }));
  check(tg.bs.length === 2 && tg.bs.every((b) => b.w === 44 && b.h === 36 && b.label), "two 44×36 named icon segments", tg.bs.map((b) => `${b.label} ${b.w}×${b.h}`).join(" · "));
  const on = tg.bs.find((b) => b.pressed === "true");
  /* MONITORING v2: WAS "list pressed by default". Cards are the primary view
     for a new session; the list is one tap away and persists. */
  check(on?.v === "cards" && on.bg === raised && wears(on.shadow, elev1) && tg.bs.find((b) => b.v === "list").pressed === "false", "cards pressed by default for a new session: raised, the tile shadow, aria-pressed", JSON.stringify(on));
  check(!!(await page.$("[data-monitoring-cards]")) && !(await page.$("[data-monitoring-list]")), "and the cards are what a new session sees");

  /* ═══ RETARGETED (Monitoring v3, §4) ═══ The v2 card anatomy that lived
     here — the 2×2 of labelled signals, the 96×24 sparkline beside the
     numeral, T2's amber fill, the "no lines" rule (a tier contour is one now)
     — is superseded; `monitoring-v3.mjs` §4 measures the v3 card. What still
     holds is checked here: the cards replace the list in place, each is an
     article named by its teen, and Tier 4 is not a card. */
  const c = await page.evaluate(() => {
    const root = document.querySelector("[data-monitoring-cards]");
    const cards = [...root.querySelectorAll("[data-monitoring-card]")].map((a) => ({ tier: +a.dataset.tier, tagName: a.tagName, name: document.getElementById(a.getAttribute("aria-labelledby"))?.textContent.trim() }));
    return { list: !!document.querySelector("[data-monitoring-list]"), lane: !!root.querySelector('[data-tier-group="1"] [data-t1-live]'), cards };
  });
  check(!c.list && c.lane, "the cards replace the list in place; the Tier 1 lane stays", JSON.stringify({ list: c.list, lane: c.lane }));
  const cs = c.cards;
  check(cs.length > 0 && cs.every((x) => x.tagName === "ARTICLE" && x.name) && cs.every((x) => x.tier !== 4), "each card is an article named by its teen; Tier 4 is not a card", cs.slice(0, 3).map((x) => x.name).join(", "));
  const alert = await page.evaluate((AVATAR) => {
    const probe = (v) => { const e = document.createElement("span"); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const red = ["--t1", "--t2", "--t1-ink", "--t2-ink"].map(probe);
    const hits = [];
    for (const r of document.querySelectorAll('[data-monitoring-card][data-tier="3"], [data-monitoring-card][data-tier="4"]'))
      for (const el of [r, ...r.querySelectorAll("*")]) { if (el.closest(AVATAR)) continue; const s = getComputedStyle(el); for (const v of [s.color, s.backgroundColor, s.borderTopColor, s.boxShadow]) if (red.some((x) => v.includes(x.slice(4, -1)))) hits.push(r.dataset.monitoringCard); }
    return [...new Set(hits)];
  }, AVATAR);
  check(alert.length === 0, "no red or amber on a Tier 3 or 4 card", alert.join(","));
  const contrast = await page.evaluate(([ENGINE]) => {
    eval(ENGINE);
    const { rgba, ratio, bgOf } = window.__c;
    const out = [];
    for (const r of document.querySelectorAll('[data-monitoring-card][data-tier="2"]')) {
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!n.textContent.trim() || el.closest(".sr-only") || el.closest('[aria-hidden="true"]')) continue; out.push({ t: n.textContent.trim().slice(0, 20), r: Math.round(ratio(rgba(getComputedStyle(el).color), bgOf(el)) * 100) / 100 }); }
    }
    return out;
  }, [ENGINE]);
  const low = contrast.filter((x) => x.r < 4.5);
  check(contrast.length > 0 && low.length === 0, "every text on a t2 card is ≥ 4.5:1", low.length ? JSON.stringify(low) : `${contrast.length} texts, lowest ${Math.min(...contrast.map((x) => x.r))}:1`);
  await page.screenshot({ path: `${OUT}/05-cards-alert-1512.png` });

  /* PERSISTED: a reload keeps the cards. */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check(!!(await page.$("[data-monitoring-cards]")) && (await page.locator('[data-layout-toggle="cards"]').getAttribute("aria-pressed")) === "true", "the choice survives a reload");
  await ctx.close();

  /* LAYOUT STORAGE THAT THROWS: the page still renders, on the default. */
  const blocked = await open(1512, { blockLayout: true, layout: "default" });
  const errors = [];
  blocked.page.on("pageerror", (e) => errors.push(String(e)));
  await blocked.page.reload({ waitUntil: "networkidle" });
  await blocked.page.waitForTimeout(900);
  const cardsOk = !!(await blocked.page.$("[data-monitoring-cards]"));
  await blocked.page.locator('[data-layout-toggle="list"]').click().catch(() => {});
  await blocked.page.waitForTimeout(300);
  const listOk = !!(await blocked.page.$("[data-monitoring-list]"));
  check(listOk && cardsOk && errors.length === 0, "blocked storage: the default cards render and the toggle still works", JSON.stringify({ listOk, cardsOk, errors: errors.slice(0, 2) }));
  await blocked.ctx.close();
}

// ── STEP 5 · the alert strip ───────────────────────────────────────────────
{
  console.log("\n── step 5 · the alert strip (1512)");
  const { ctx, page } = await open(1512, { dpr: 2 });
  check(!(await page.$("[data-alert-strip]")), "Monitor: no strip");
  await setMode(page, "alert");
  const st = await page.evaluate(([ENGINE]) => {
    eval(ENGINE);
    const { rgba, ratio, bgOf } = window.__c;
    const el = document.querySelector("[data-alert-strip]");
    if (!el) return null;
    const s = getComputedStyle(el);
    const h1 = document.querySelector("[data-monitoring] h1").getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const texts = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (!n.textContent.trim() || e.closest('[aria-hidden="true"]')) continue; texts.push({ t: n.textContent.trim().slice(0, 18), r: Math.round(ratio(rgba(getComputedStyle(e).color), bgOf(e)) * 100) / 100 }); }
    const dot = el.querySelector("[data-alert-dot]");
    return {
      role: el.getAttribute("role"), bg: s.backgroundColor, text: el.querySelector("[data-alert-text]").textContent.replace(/\s+/g, " ").trim(),
      timer: el.querySelector("[data-alert-timer]").textContent.replace(/\s+/g, " ").trim(), timerFf: getComputedStyle(el.querySelector("[data-alert-timer]")).fontFamily,
      lane: document.querySelector("[data-t1-join]")?.textContent.trim(),
      dot: getComputedStyle(dot).animationName,
      join: (() => { const j = el.querySelector("[data-alert-join]"); return { bg: getComputedStyle(j).backgroundColor, c: getComputedStyle(j).color, t: j.textContent.trim() }; })(),
      ack: el.querySelector("[data-alert-ack]")?.textContent.trim(),
      above: r.bottom <= h1.top,
      sound: /sound/i.test(el.textContent),
      texts,
    };
  }, [ENGINE]);
  const errBg = await tok(page, "--state-error", "bg");
  const errFg = await tok(page, "--state-error");
  check(st?.role === "alert" && st.bg === errBg, "Alert: role=alert, on --state-error", st?.bg);
  check(/^Tier 1 · The mentor flagged Jordan T\. · unconfirmed · note \+ C-SSRS · \d{1,2}:\d{2} (AM|PM)$/.test(st?.text ?? ""), "the pack's sentence, from the data", st?.text);
  check(/^\d:\d\d left$/.test(st?.timer ?? "") && /mono/i.test(st.timerFf) && !st.sound, "a mono response timer chip, and no sound toggle", st?.timer);
  check(st?.lane?.endsWith(st.timer.split(" ")[0]), "the strip and the lane show one clock", `${st?.timer.split(" ")[0]} / ${st?.lane}`);
  check(st?.dot !== "none", "the dot pulses");
  check(st?.join.bg === "rgb(255, 255, 255)" && st.join.c === errFg && st.join.t === "Join session" && st.ack === "Acknowledge", "Join session white and primary, then Acknowledge", JSON.stringify(st?.join));
  check(st?.above, "above the page title, at the top of the canvas");
  const low = (st?.texts ?? []).filter((x) => x.r < 4.5);
  check(st?.texts.length > 0 && low.length === 0, "every text on the strip is ≥ 4.5:1", low.length ? JSON.stringify(low) : `${st?.texts.length} texts, lowest ${Math.min(...(st?.texts ?? []).map((x) => x.r))}:1`);
  await page.screenshot({ path: `${OUT}/06-strip-alert-1512.png` });

  /* ACKNOWLEDGE ends it; the lane stays live; Join from the lane does not bring it back. */
  await page.locator("[data-alert-ack]").click();
  await page.waitForTimeout(300);
  /* RETARGETED (Monitoring v3, §6): acknowledging is a state, not a
     dismissal — the strip stays, the clock stops, it says so. */
  const acked = await page.evaluate(() => ({ s: document.querySelector("[data-alert-strip]")?.dataset.alertStrip, who: document.querySelector("[data-alert-holder]")?.textContent.trim(), stopped: !!document.querySelector("[data-alert-timer][data-stopped]") }));
  check(acked.s === "acknowledged" && acked.who === "· Acknowledged by you" && acked.stopped && !!(await page.$("[data-t1-live]")), "Acknowledge: the strip stays, its clock stopped, “Acknowledged by you”; the lane stays live", JSON.stringify(acked));
  /* ═══ JOIN GOES INTO THE CONVERSATION (pack v3.0, Workstream A) ═══ It
     was a no-op with a TODO; with Chats gone from a supervisor's nav it is
     their door into the chat. So the claim is now two: it lands on the
     conversation, and coming back does not raise the answered strip. */
  await page.locator("[data-t1-join]").click();
  await page.waitForURL(/\/app\/chat\/t13$/, { timeout: 8000 }).catch(() => {});
  check(new URL(page.url()).pathname === "/app/chat/t13", "Join lands on Jordan's conversation", new URL(page.url()).pathname);
  /* BACK, not a fresh load: the answered state is this session's, and a
     reload is a new session. */
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check((await page.evaluate(() => document.querySelector("[data-alert-strip]")?.dataset.alertStrip)) === "joined", "and back on Monitoring, the joined alert is the slim bar — the full strip does not come back");

  /* A NEW ALERT is a new strip, on a fresh clock. */
  await setMode(page, "monitor");
  check(!(await page.$("[data-alert-strip]")) && !!(await page.$("[data-t1-empty]")), "back to Monitor: no strip, the lane calm");
  await setMode(page, "alert");
  const again = await page.evaluate(() => document.querySelector("[data-alert-timer]")?.textContent.trim());
  check(/^(1:00|0:59|0:58) left/.test(again ?? ""), "Monitor then Alert again: a new strip, the clock from 1:00", again);

  /* JOIN from the strip answers the alert (the session hand-off is TODO). */
  await page.locator("[data-alert-join]").click();
  await page.waitForTimeout(500);
  check((await page.evaluate(() => document.querySelector("[data-alert-strip]")?.dataset.alertStrip)) === "joined" && new URL(page.url()).pathname === PATH, "Join session collapses the strip to the slim bar and stays on the page (navigation is TODO(monitoring))", page.url());
  await ctx.close();

  const rm = await open(1512, { reducedMotion: "reduce", scenario: "tiers-alert" });
  const a = await rm.page.evaluate(() => { const d = document.querySelector("[data-alert-dot]"); return d && { anim: getComputedStyle(d).animationName, w: Math.round(d.getBoundingClientRect().width) }; });
  check(a?.anim === "none" && a.w === 10, "reduced motion: no pulse, the dot still there", JSON.stringify(a));
  await rm.ctx.close();
}

// ── STEP 6 · Tier 4 collapsed, windowed when shown ─────────────────────────
for (const layout of ["list", "cards"]) {
  console.log(`\n── step 6 · Tier 4 in the ${layout} (1512)`);
  const { ctx, page } = await open(1512);
  if (layout === "cards") {
    await page.locator('[data-layout-toggle="cards"]').click();
    await page.waitForTimeout(300);
  }
  /* (Monitoring v3, §4) Tier 4 is the registry's rows in BOTH views. */
  const item = "[data-monitoring-row]";
  const rendered = () => page.evaluate((item) => document.querySelectorAll(`[data-tier-group="4"] ${item}`).length, item);
  const c = await page.evaluate(() => {
    const g = document.querySelector('[data-tier-group="4"]');
    const b = g.querySelector("[data-tier4-toggle]");
    const r = b.getBoundingClientRect();
    const hdr = g.querySelector("h3").closest("div").parentElement.getBoundingClientRect();
    return { text: b.textContent.trim(), exp: b.getAttribute("aria-expanded"), ff: getComputedStyle(b).fontFamily, bg: getComputedStyle(b).backgroundColor, h: Math.round(r.height), w: Math.round(r.width), rowW: Math.round((g.querySelector("[data-monitoring-row]") ?? g).getBoundingClientRect().width), rightGap: Math.round(hdr.right - r.right), count: g.querySelector("h3 [data-tier-count]")?.textContent, controls: !!document.getElementById(b.getAttribute("aria-controls")) };
  });
  const preview = 2;
  check((await rendered()) === preview, `collapsed: a ${preview}-row preview`, `${await rendered()}`);
  /* ═══ MONITORING v2 (Part B) ═══ WAS "a mono ghost button, right-aligned" in the header. In the
     list it is a quiet full-width button inside the container, after the
     preview rows; the cards keep it in the header (until the card pass). */
  check(c.text === "Show all 100" && c.exp === "false" && c.controls && !/mono/i.test(c.ff) && c.bg === "rgba(0, 0, 0, 0)" && c.h >= 44 && Math.abs(c.w - c.rowW) <= 2, `${layout}: Show all 100 — quiet, full width inside the container, ≥ 44 tall, controlling the group`, JSON.stringify(c));
  check(c.count === "100", "the header still counts all of Tier 4", c.count);

  /* Clicked in-page: the dev bar is fixed at the bottom of the viewport. */
  await page.evaluate(() => document.querySelector("[data-tier4-toggle]").click());
  await page.waitForTimeout(500);
  const open1 = await page.evaluate(() => ({ exp: document.querySelector("[data-tier4-toggle]").getAttribute("aria-expanded"), text: document.querySelector("[data-tier4-toggle]").textContent.trim() }));
  /* MONITORING v2: the cards are taller, so Tier 4 opens below the fold and
     the window holds one row until it is scrolled to — bring it into view
     before counting what renders. */
  await page.evaluate(() => document.querySelector('[data-tier-group="4"]').scrollIntoView());
  await page.waitForTimeout(400);
  const n1 = await rendered();
  check(open1.exp === "true" && open1.text === "Show fewer", "expanded: aria-expanded, Show fewer", JSON.stringify(open1));
  check(n1 > preview && n1 < 100, "only a window renders, not all 100", `${n1} of 100`);

  /* Scroll to the end: the last teen renders, and the window stays small. */
  await page.evaluate(() => {
    const sc = [...document.querySelectorAll("*")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 200);
    (sc ?? document.scrollingElement).scrollTop = 1e7;
  });
  await page.waitForTimeout(500);
  const last = await page.evaluate((item) => [...document.querySelectorAll(`[data-tier-group="4"] ${item}`)].map((e) => e.dataset.monitoringRow ?? e.dataset.monitoringCard), item);
  check(last.includes("teen-gen-79") && last.length < 100, "scrolled to the end: the last teen is there, the window still small", `${last.length} rendered, last ${last.at(-1)}`);
  if (layout === "list") {
    const align = await page.evaluate(() => {
      const hx = [...document.querySelectorAll('[data-monitoring-list] [role="columnheader"]')].map((h) => Math.round(h.getBoundingClientRect().left));
      const r = document.querySelector('[data-tier-group="4"] [data-monitoring-row]');
      return { hx, cx: [...r.querySelectorAll(':scope > [role="cell"]')].map((c) => Math.round(c.getBoundingClientRect().left)) };
    });
    check(align.hx.every((x, i) => Math.abs(x - align.cx[i]) <= 1), "windowed rows keep the table's columns", `${align.hx.join(",")} / ${align.cx.join(",")}`);
  }
  await page.screenshot({ path: `${OUT}/07-tier4-${layout}-end-1512.png` });
  await page.evaluate(() => document.querySelector("[data-tier4-toggle]").click());
  await page.waitForTimeout(400);
  check((await rendered()) === preview, "Show fewer collapses it again", `${await rendered()}`);
  await ctx.close();
}

// ── STEP 7 · in this app: nav, badge, retired routes, narrow widths ────────
{
  console.log("\n── step 7 · the nav, the badge, the retired routes (1512)");
  const { ctx, page } = await open(1512);
  const nav = () =>
    page.evaluate(() => {
      const rail = document.querySelector('[data-anno-ref="app-rail"]');
      const btn = rail?.querySelector('[data-rail-group="monitoring"]');
      const items = btn ? [...document.getElementById(btn.getAttribute("aria-controls")).querySelectorAll("a")] : [];
      const all = rail ? [...rail.querySelectorAll("nav a")].map((a) => a.textContent.replace(/\s+/g, " ").trim()) : [];
      return {
        group: btn?.textContent.trim(),
        /* What is SEEN: the badge's digits are aria-hidden beside an sr-only
           "N needing review", so textContent reads "44 needing review". */
        items: items.map((a) => {
          const seen = a.cloneNode(true);
          seen.querySelectorAll(".sr-only, span.rounded-full").forEach((e) => e.remove());
          const badge = a.querySelector("span.rounded-full");
          return { text: seen.textContent.replace(/\s+/g, " ").trim(), href: a.getAttribute("href"), current: a.getAttribute("aria-current"), badge: badge?.querySelector('[aria-hidden="true"]')?.textContent.trim() ?? null, sr: badge?.querySelector(".sr-only")?.textContent.trim() ?? null };
        }),
        stale: all.filter((t) => /Escalations|Risk Flags/i.test(t)),
      };
    });
  const n = await nav();
  /* Chats left the supervisor's nav (pack v3.0, Supersession 7). */
  check(n.group === "Monitoring" && n.items.map((i) => i.text).join("|") === "Monitoring", "the Monitoring group holds Monitoring alone — no Chats", JSON.stringify(n.items.map((i) => i.text)));
  check(n.items[0]?.href === "/app/monitoring" && n.items[0].current === "page", "Monitoring is the current page, at /app/monitoring", JSON.stringify(n.items[0]));
  check(n.stale.length === 0, "no Escalations or Risk Flags item anywhere in the rail", n.stale.join(","));
  check(n.items[0]?.badge === "4" && n.items[0].sr === "4 needing review", "Monitor: the badge is teens needing review (4), and says so to a screen reader", `${n.items[0]?.badge} · ${n.items[0]?.sr}`);
  await setMode(page, "alert");
  const n2 = await nav();
  check(n2.items[0]?.badge === "5", "Alert: the badge follows the scenario (5)", n2.items[0]?.badge);

  for (const [from, to] of [
    ["/app/escalations", "/app/monitoring"],
    ["/app/escalations?escalation=esc-1", "/app/monitoring?escalation=esc-1"],
    ["/app/risk-flags?flag=f-9", "/app/monitoring?flag=f-9"],
    ["/app/escalation/esc-1", "/app/monitoring?escalation=esc-1"],
  ]) {
    const seen = [];
    const onNav = (f) => f === page.mainFrame() && seen.push(new URL(f.url()).pathname);
    page.on("framenavigated", onNav);
    await page.goto(`${BASE}${from}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    page.off("framenavigated", onNav);
    const u = new URL(page.url());
    const hops = seen.filter((p, i) => p !== seen[i - 1]);
    /* ONE HOP: the only paths the frame visits are the retired one and this
       page — the old record loop went /app/escalation → /app/escalations →
       /app/escalation and never settled. */
    const src = new URL(`${BASE}${from}`).pathname;
    check(u.pathname + u.search === to && hops.every((p) => p === src || p === PATH) && hops.at(-1) === PATH, `${from} → ${to}, one hop`, `${u.pathname}${u.search} via ${hops.join(" → ")}`);
  }
  await ctx.close();

  for (const width of [375, 768]) {
    console.log(`\n── step 7 · nothing scrolls sideways (${width})`);
    for (const layout of ["list", "cards"]) {
      const { ctx, page } = await open(width, { scenario: "tiers-alert", height: width < 600 ? 844 : 1024 });
      if (layout === "cards") {
        await page.locator('[data-layout-toggle="cards"]').click();
        await page.waitForTimeout(300);
      }
      const m = await page.evaluate(() => {
        const canvas = document.querySelector("[data-monitoring]").parentElement.closest('[class*="@container/canvas"]');
        const reg = document.querySelector("[data-monitoring-list-scroll]");
        const strip = document.querySelector("[data-alert-strip]");
        const grid = document.querySelector('[data-tier-group="2"] [data-card-grid]');
        return {
          canvas: canvas ? [canvas.scrollWidth, canvas.clientWidth] : null,
          doc: [document.documentElement.scrollWidth, innerWidth],
          strip: strip && [strip.scrollWidth, strip.clientWidth],
          region: reg && { sw: reg.scrollWidth, cw: reg.clientWidth, tab: reg.tabIndex, role: reg.getAttribute("role"), name: reg.getAttribute("aria-label") },
          cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : null,
          hero: getComputedStyle(document.querySelector("[data-hero-metrics]")).gridTemplateColumns.split(" ").length,
        };
      });
      check(m.canvas && m.canvas[0] <= m.canvas[1] && m.doc[0] <= m.doc[1], `${layout}: the canvas and the page do not scroll sideways`, `canvas ${m.canvas?.join("/")} · doc ${m.doc.join("/")}`);
      check(m.strip && m.strip[0] <= m.strip[1], `${layout}: the strip wraps inside its width`, m.strip?.join("/"));
      check(m.hero === (width < 600 ? 2 : 3), `${layout}: the hero wraps to ${width < 600 ? 2 : 3} across`, `${m.hero}`);
      if (layout === "list") check(m.region && m.region.sw > m.region.cw && m.region.tab === 0 && m.region.role === "region" && m.region.name, "list: the table scrolls inside a focusable, named region", JSON.stringify(m.region));
      else check(m.cols === (width < 600 ? 1 : 2), `cards: ${width < 600 ? 1 : 2} across`, `${m.cols}`);
      await page.screenshot({ path: `${OUT}/08-${layout}-alert-${width}.png` });
      await ctx.close();
    }
  }
}

// ── STEP 8 · every visible text on the page clears AA, both themes ─────────
for (const theme of ["light", "dark"])
  for (const layout of ["list", "cards"]) {
    console.log(`\n── step 8 · contrast, ${theme}, ${layout} (Alert, Tier 4 open)`);
    const { ctx, page } = await open(1512, { scenario: "tiers-alert", theme });
    if (layout === "cards") {
      await page.locator('[data-layout-toggle="cards"]').click();
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => document.querySelector("[data-tier4-toggle]")?.click());
    await page.waitForTimeout(400);
    const r = await page.evaluate(([ENGINE]) => {
      eval(ENGINE);
      const { rgba, ratio, bgOf } = window.__c;
      const out = [];
      const root = document.querySelector("[data-monitoring]");
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!n.textContent.trim() || el.closest(".sr-only") || el.closest('[aria-hidden="true"]')) continue;
        const s = getComputedStyle(el);
        const px = parseFloat(s.fontSize);
        const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
        out.push({ t: n.textContent.trim().slice(0, 22), r: Math.round(ratio(rgba(s.color), bgOf(el)) * 100) / 100, need: large ? 3 : 4.5 });
      }
      return { dark: document.documentElement.classList.contains("dark"), out };
    }, [ENGINE]);
    const low = r.out.filter((x) => x.r < x.need);
    check(r.dark === (theme === "dark"), `the ${theme} theme is the one measured`, `html.dark=${r.dark}`);
    check(r.out.length > 50 && low.length === 0, `every visible text clears AA (${theme}, ${layout})`, low.length ? JSON.stringify(low.slice(0, 6)) : `${r.out.length} texts, lowest ${Math.min(...r.out.map((x) => x.r))}:1`);
    await page.screenshot({ path: `${OUT}/09-${layout}-alert-${theme}-1512.png` });
    await ctx.close();
  }

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
