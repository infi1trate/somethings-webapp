// ═══════════════════════════════════════════════════════════════════════════
// MONITORING v4 — no strips, a real Tier 1 queue, the elevation pass, the tray
//
// One claim per line of the brief's acceptance list, measured on the page:
//
//   §1  no alert strip in the codebase or the DOM; the cue and its mute live
//       with the tray (Web Audio, counted through a stubbed AudioContext)
//   §2  the hero's In-crisis cell is a button that lands on the queue
//   §3  the queue: a soft 40% container, six columns, a stepper, a response
//       state — "0:00 left" never appears — sorted by response state, the
//       action following the holder (Join · Observe · Resume)
//   §4  Tier 1 renders as rows in the card view too
//   §5  the tray: "Needs you now" above everything, keyboard reachable, never
//       cleared by a look, counted in the badge
//   §6  no amber or red FILLS but the 40% container and Join — a fill being a
//       surface at least 24px on both axes; dots and lozenges are marks
//   §7  AA on every visible text, light and dark, page and tray
//   §8  a tab switch moves nothing; reduced motion stills the dot and fade
//
// Scenarios are picked THROUGH THE DEV BAR, by label, as a person would.
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/monitoring-v4";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const ENGINE = `(() => {
  if (window.__c) return;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, u) => { const a = t[3]; return [t[0]*a+u[0]*(1-a), t[1]*a+u[1]*(1-a), t[2]*a+u[2]*(1-a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let base = [255,255,255,1]; if (st.length && st[st.length-1][3] >= 1) base = st.pop(); while (st.length) base = over(st.pop(), base); return base; };
  const sweep = (root) => { const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!n.textContent.trim() || el.closest(".sr-only") || el.closest('[aria-hidden="true"]')) continue; const s = getComputedStyle(el); if (s.visibility === "hidden") continue; const px = parseFloat(s.fontSize); const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700); out.push({ t: n.textContent.trim().slice(0, 24), r: Math.round(ratio(rgba(s.color), bgOf(el)) * 100) / 100, need: large ? 3 : 4.5 }); } return out; };
  window.__c = { rgba, ratio, bgOf, sweep };
})()`;

const b = await chromium.launch();
async function open({ width = 1512, height = 982, persona = "supervisor", scenario = "m3-quiet", layout = "list", theme, reducedMotion, path = "/app/monitoring" } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: reducedMotion ?? "no-preference" });
  await ctx.addInitScript(([k, v, layout, theme]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(k, JSON.stringify(v));
      localStorage.setItem("somethings.monitoring.layout", layout);
      if (theme) localStorage.setItem("somethings.theme", theme);
      sessionStorage.setItem("seeded", "1");
    }
    /* Count the cue without hearing it: every chime is two oscillators. */
    window.__osc = 0;
    if (window.AudioContext) {
      const o = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () { window.__osc++; return o.call(this); };
    }
  }, [KEY, { state: { persona, chatScenarioId: "active-mentorship", monitoringScenarioId: scenario }, version: VERSION }, layout, theme ?? null]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}
const pick = async (page, label) => {
  await page.locator('[data-dev-bar-root] button[aria-label^="Scenario:"]').first().click();
  await page.waitForTimeout(200);
  await page.locator("button", { hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first().click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
};
const queue = (page) => page.evaluate(() => [...document.querySelectorAll("[data-t1-row]")].map((r) => ({ id: r.dataset.t1Row, response: r.querySelector("[data-t1-response]")?.textContent.trim(), kind: r.querySelector("[data-t1-response]")?.dataset.t1Response, step: r.querySelector("[data-t1-stage]")?.dataset.t1Stage, steps: r.querySelectorAll("[data-step]").length, holder: r.querySelector("[data-t1-holder]")?.dataset.t1Holder, action: r.querySelector("[data-t1-action]")?.dataset.t1Action })));
const bell = (page) => page.locator("[data-activity-bell]:visible").first();

// ── §1 · no strip anywhere ─────────────────────────────────────────────────
console.log("\n── §1 · no alert strip — in the code or on the page");
{
  const hits = execSync(`grep -rlE "data-alert-|AlertStrip|tier1-alert-strip|from \\"@/lib/monitoring/alert-clock" src || true`, { encoding: "utf8" }).trim();
  check(hits === "", "no alert strip in the codebase (component, clock, or its hooks)", hits.replace(/\n/g, " · "));
  const { ctx, page, errors } = await open();
  const seen = [];
  for (const label of ["Quiet shift", "Alert · unconfirmed (1)", "Alert · overdue", "Confirmed by you", "Six Tier 1s", "Held by Sarah"]) {
    await pick(page, label);
    seen.push({ label, strip: await page.locator("[data-alert-strip]").count(), alert: await page.locator('[data-monitoring] [role="alert"]').count(), texts: (await queue(page)).map((r) => r.response) });
  }
  check(seen.every((s) => s.strip === 0 && s.alert === 0), "no strip and no role=alert in any Tier 1 state", JSON.stringify(seen.map((s) => [s.label, s.strip, s.alert])));
  const all = seen.flatMap((s) => s.texts);
  check(all.length >= 11 && !all.some((t) => /0:00|left/.test(t)), "“0:00 left” cannot appear — a response is a state", `${all.length} responses · ${[...new Set(all.map((t) => t.replace(/\d/g, "n")))].join(" | ")}`);
  check(errors.length === 0, "no page errors across the six", errors.join(" | "));
  await ctx.close();
}

// ── §1 · the cue and its mute live with the tray ───────────────────────────
console.log("\n── §1 · the audible cue and its mute, in the tray");
{
  const { ctx, page } = await open();
  /* An AudioContext starts only after a gesture on the page. */
  await page.mouse.click(700, 140);
  const osc = () => page.evaluate(() => window.__osc);
  check((await osc()) === 0, "the baseline is silent — what is already waiting is not an arrival");
  await pick(page, "Alert · unconfirmed (1)");
  check((await osc()) === 2, "an unconfirmed Tier 1 arriving plays one two-note cue", `${await osc()} oscillators`);
  check((await page.locator("[data-monitoring] [data-t1-cue-toggle], [data-monitoring] [data-sound-toggle]").count()) === 0, "no sound control on the page — it lives with the tray");
  await bell(page).click();
  await page.waitForTimeout(300);
  const tg = page.locator("[data-activity-popover] [data-t1-cue-toggle]");
  const t0 = { n: await tg.count(), pressed: await tg.getAttribute("aria-pressed"), name: await tg.getAttribute("aria-label"), inHeader: await page.evaluate(() => !!document.querySelector("[data-activity-popover] > div:first-child [data-t1-cue-toggle]")), w: await tg.evaluate((e) => Math.round(e.getBoundingClientRect().width)) };
  check(t0.n === 1 && t0.inHeader && t0.pressed === "false" && /Mute/.test(t0.name ?? "") && t0.w >= 40, "the tray header holds the mute: a 40px pressed-state toggle, unpressed", JSON.stringify(t0));
  await tg.click();
  check((await tg.getAttribute("aria-pressed")) === "true", "pressing it mutes (aria-pressed)");
  await page.keyboard.press("Escape");
  await pick(page, "Six Tier 1s");
  check((await osc()) === 2, "muted: new arrivals are silent", `${await osc()} oscillators`);
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state.t1CueMuted, KEY);
  check(stored?.supervisor === true && Object.keys(stored).length === 1, "persisted per persona", JSON.stringify(stored));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await bell(page).click();
  await page.waitForTimeout(300);
  check((await page.locator("[data-activity-popover] [data-t1-cue-toggle]").getAttribute("aria-pressed")) === "true", "and it survives a reload");
  await ctx.close();
  const m = await open({ persona: "mentor", path: "/app" });
  await bell(m.page).click();
  await m.page.waitForTimeout(300);
  check((await m.page.locator("[data-t1-cue-toggle]").count()) === 0 && (await m.page.locator("[data-needs-you-now]").count()) === 0, "a mentor's tray has neither the mute nor Needs you now");
  await m.ctx.close();
}

// ── §2 · the hero's In-crisis cell is a button ─────────────────────────────
console.log("\n── §2 · the In-crisis cell is a button onto the queue");
{
  const { ctx, page } = await open({ scenario: "m4-six-t1" });
  const cell = page.locator('[data-hero-cell="In crisis"]');
  const c = await cell.evaluate((e) => ({ tag: e.tagName, type: e.getAttribute("type"), name: e.getAttribute("aria-label"), detail: e.querySelector("[data-hero-detail]")?.textContent, bg: getComputedStyle(e).backgroundColor, raised: (() => { const p = document.createElement("span"); p.style.background = "var(--surface-raised)"; document.body.appendChild(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; })() }));
  check(c.tag === "BUTTON" && c.type === "button" && /Tier 1 queue/.test(c.name ?? ""), "a real button, named for where it goes", c.name);
  check(c.detail === "4 awaiting · oldest 14m overdue" && c.bg === c.raised, "its detail reads the queue; no fill", `${c.detail} · ${c.bg}`);
  await cell.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const f = await page.evaluate(() => document.activeElement?.dataset.t1Row);
  check(f === "t13", "Enter lands focus on the queue's first row — the longest overdue", f);
  await ctx.close();
}

// ── §3 · the queue ─────────────────────────────────────────────────────────
console.log("\n── §3 · the Tier 1 queue");
{
  const { ctx, page } = await open({ scenario: "m4-six-t1", theme: "light" });
  const g = await page.evaluate(() => {
    const c = document.querySelector("[data-t1-queue]");
    return { bg: getComputedStyle(c).backgroundColor, radius: getComputedStyle(c).borderRadius, heads: [...c.querySelectorAll('[data-t1-headers] [role="columnheader"]')].map((h) => h.textContent.trim()), cells: [...c.querySelectorAll("[data-t1-row]")].map((r) => r.querySelectorAll(':scope > [role="cell"]').length) };
  });
  check(/0\.4\)$/.test(g.bg) && g.radius === "20px", "a soft container: 20px, t1-soft at 40%", g.bg);
  check(g.heads.length === 6 && g.cells.every((n) => n === 6), "six columns, headed, every row six cells", g.heads.join(" · "));
  const rows = await queue(page);
  check(rows.every((r) => r.steps === 4), "every row carries the four-step stepper");
  check(rows.map((r) => r.id).join(",") === "t13,t17,t22,t15,t19,t21", "sorted by response state: overdue longest first, then least time left, then confirmed oldest first", rows.map((r) => `${r.id} ${r.response}`).join(" | "));
  check(rows.find((r) => r.id === "t17")?.action === "observe" && rows.find((r) => r.id === "t19")?.action === "observe" && rows.find((r) => r.id === "t13")?.action === "join" && rows.find((r) => r.id === "t21")?.holder === "you", "the action follows the holder: Sarah's → Observe, nobody's → Join, yours → You", JSON.stringify(rows.map((r) => [r.id, r.holder, r.action])));
  check(rows.find((r) => r.id === "t19")?.response === "Confirmed by Sarah · 0:48" && rows.find((r) => r.id === "t21")?.response === "Confirmed by you · 0:36", "confirmed rows say who and how long", rows.slice(4).map((r) => r.response).join(" | "));
  const before = rows.find((r) => r.id === "t22").response;
  await page.waitForTimeout(1300);
  const after = (await queue(page)).find((r) => r.id === "t22").response;
  check(before !== after && /to confirm$/.test(after), "the window counts down live", `${before} → ${after}`);
  await page.locator('[data-t1-row="t13"] [data-t1-action="join"]').click();
  await page.waitForURL(/\/app\/chat\/t13/).catch(() => {});
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check((await queue(page)).find((r) => r.id === "t13")?.action === "resume", "Join, then back: Resume");
  await page.screenshot({ path: `${OUT}/04-queue-list-1512.png` });
  await ctx.close();
}

// ── §4 · Tier 1 is rows in the card view ───────────────────────────────────
console.log("\n── §4 · Tier 1 in the card view");
{
  const { ctx, page } = await open({ scenario: "m4-six-t1", layout: "cards" });
  const c = await page.evaluate(() => ({ cards: !!document.querySelector("[data-monitoring-cards]"), rows: document.querySelectorAll('[data-monitoring-cards] [data-tier-group="1"] [data-t1-row]').length, t1cards: document.querySelectorAll('[data-monitoring-card][data-tier="1"]').length }));
  check(c.cards && c.rows === 6 && c.t1cards === 0, "the card view renders Tier 1 as the same six rows — never cards", JSON.stringify(c));
  await page.locator('[data-tier-group="1"]').screenshot({ path: `${OUT}/05-queue-cards-1512.png` });
  await ctx.close();
}

// ── §5 · the tray ──────────────────────────────────────────────────────────
console.log("\n── §5 · the tray's Needs you now");
for (const theme of ["light", "dark"]) {
  const { ctx, page } = await open({ scenario: "m4-six-t1", theme, path: "/app" });
  const label0 = await bell(page).getAttribute("aria-label");
  if (theme === "light") check(/^Activity, 4 Tier 1 awaiting confirmation/.test(label0 ?? ""), "the badge counts the four unconfirmed, named first", label0);
  await bell(page).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const t = await page.evaluate(([ENGINE]) => {
    eval(ENGINE);
    const pop = document.querySelector("[data-activity-popover]");
    const sec = pop.querySelector("[data-needs-you-now]");
    const firstSection = pop.querySelector("section");
    const rows = [...sec.querySelectorAll("[data-needs-row]")].map((r) => ({ id: r.dataset.needsRow, title: r.querySelector("[data-needs-title]").textContent, titleFf: getComputedStyle(r.querySelector("[data-needs-title]")).fontFamily, titleFs: getComputedStyle(r.querySelector("[data-needs-title]")).fontSize, flagged: r.querySelector("[data-needs-flagged]").textContent, flaggedFs: getComputedStyle(r.querySelector("[data-needs-flagged]")).fontSize, response: r.querySelector("[data-needs-response]").textContent, action: r.dataset.needsAction, glyph: Math.round(r.querySelector("span[aria-hidden]").getBoundingClientRect().width), go: r.querySelector("[data-needs-go]")?.textContent }));
    const opened = [...pop.querySelectorAll('[data-notice="opened"]')].map((n) => n.textContent);
    return { first: firstSection === sec, rows, opened, aa: window.__c.sweep(pop) };
  }, [ENGINE]);
  if (theme === "light") {
    check(t.first, "Needs you now is the tray's first group");
    check(t.rows.length === 4 && t.rows.map((r) => r.title).join("|") === "Confirm Tier 1 · Jordan T.|Confirm Tier 1 · Naomi R.|Confirm Tier 1 · Ravi M.|Confirm Tier 1 · Riley M.", "one row per unconfirmed Tier 1, in the queue's order", t.rows.map((r) => r.title).join(" | "));
    check(t.rows.every((r) => /Avantt/i.test(r.titleFf) && r.titleFs === "15px" && r.flaggedFs === "13px" && /^Flagged by .+( · note( \+ C-SSRS)?)?$/.test(r.flagged) && r.glyph === 28), "28px glyph · Avantt 15 title · 13 flagged line", JSON.stringify(t.rows[0]));
    check(t.rows[0].response === "Overdue 14m" && t.rows[1].action === "observe" && t.rows[0].go === "Join", "the response state and the holder's action, as on the queue", t.rows.map((r) => `${r.response} ${r.action}`).join(" | "));
    check(!t.opened.some((x) => /raised Tier 1 for (Jordan|Naomi|Ravi|Riley)/.test(x)), "the matching “raised Tier 1” notices step aside — said once", t.opened.join(" | "));
    /* Keyboard: Tab from the popover reaches the first row's action. */
    let reached = null;
    for (let i = 0; i < 6 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement?.closest("[data-needs-row]")?.dataset.needsRow ?? null);
    }
    check(!!reached, "keyboard reachable: Tab lands on a row's action", reached);
    /* A look marks the bell read — and does not clear one of these. */
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await bell(page).click();
    await page.waitForTimeout(300);
    const again = await page.locator("[data-needs-row]").count();
    await page.keyboard.press("Escape");
    const label1 = await bell(page).getAttribute("aria-label");
    check(again === 4 && /4 Tier 1 awaiting confirmation/.test(label1 ?? ""), "marking the bell read never clears an unconfirmed Tier 1", `${again} rows · ${label1}`);
    await bell(page).click();
    await page.waitForTimeout(300);
    await page.locator('[data-needs-row] [data-needs-go]').first().click();
    await page.waitForURL(/\/app\/chat\//).catch(() => {});
    check(/\/app\/chat\/t13/.test(page.url()), "Join from the tray opens the conversation", new URL(page.url()).pathname);
  }
  const low = t.aa.filter((x) => x.r < x.need);
  check(t.aa.length > 20 && low.length === 0, `the tray clears AA (${theme})`, low.length ? JSON.stringify(low.slice(0, 4)) : `${t.aa.length} texts, lowest ${Math.min(...t.aa.map((x) => x.r))}:1`);
  if (theme === "light") await page.goBack({ waitUntil: "networkidle" }).catch(() => {});
  await ctx.close();
}
for (const theme of ["light", "dark"]) {
  const { ctx, page } = await open({ scenario: "m4-six-t1", theme, path: "/app" });
  await bell(page).click();
  await page.waitForTimeout(500);
  await page.locator("[data-activity-popover]").screenshot({ path: `${OUT}/06-tray-${theme}.png` });
  await ctx.close();
}

// ── §6 · fills ─────────────────────────────────────────────────────────────
console.log("\n── §6 · no amber or red fills but the container and Join");
for (const theme of ["light", "dark"]) {
  for (const layout of ["list", "cards"]) {
    const { ctx, page } = await open({ scenario: "m4-six-t1", theme, layout });
    const r = await page.evaluate(([ENGINE]) => {
      eval(ENGINE);
      const { rgba } = window.__c;
      const warm = (c) => { const [r, g, b, a] = c; if (a === 0) return false; const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn; if (d === 0) return false; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r / 255 ? ((g - b) / 255 / d) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4; h = (h * 60 + 360) % 360; return s > 0.3 && (h <= 50 || h >= 330); };
      const out = [];
      for (const el of document.querySelectorAll("[data-monitoring] *")) {
        const b = el.getBoundingClientRect();
        if (b.width < 24 || b.height < 24) continue;
        if (!warm(rgba(getComputedStyle(el).backgroundColor))) continue;
        out.push(el.hasAttribute("data-t1-queue") ? "queue" : el.dataset.t1Action === "join" ? "join" : `${el.tagName}.${String(el.className).slice(0, 60)}`);
      }
      return out;
    }, [ENGINE]);
    const other = r.filter((x) => x !== "queue" && x !== "join");
    check(r.includes("queue") && r.includes("join") && other.length === 0, `only the 40% container and Join are warm fills (${theme}, ${layout})`, other.length ? other.slice(0, 3).join(" | ") : `${r.length} warm surfaces: ${[...new Set(r)].join(", ")}`);
    await ctx.close();
  }
}

// ── §7 · AA on the page ────────────────────────────────────────────────────
console.log("\n── §7 · AA on every visible text");
for (const theme of ["light", "dark"]) {
  for (const layout of ["list", "cards"]) {
    const { ctx, page } = await open({ scenario: "m4-six-t1", theme, layout });
    const r = await page.evaluate(([ENGINE]) => { eval(ENGINE); return { dark: document.documentElement.classList.contains("dark"), out: window.__c.sweep(document.querySelector("[data-monitoring]")), q: window.__c.sweep(document.querySelector("[data-t1-queue]")) }; }, [ENGINE]);
    const low = r.out.filter((x) => x.r < x.need);
    check(r.dark === (theme === "dark") && r.out.length > 50 && low.length === 0, `every visible text clears AA (${theme}, ${layout})`, low.length ? JSON.stringify(low.slice(0, 4)) : `${r.out.length} texts; queue lowest ${Math.min(...r.q.map((x) => x.r))}:1 (headers on the 40% container included)`);
    if (layout === "list") await page.locator('[data-tier-group="1"]').screenshot({ path: `${OUT}/07-queue-${theme}.png` });
    await ctx.close();
  }
}

// ── §8 · layout shift, reduced motion ──────────────────────────────────────
console.log("\n── §8 · a tab switch moves nothing; reduced motion");
{
  const { ctx, page } = await open({ scenario: "m4-six-t1" });
  const frame = () => page.evaluate(() => Object.fromEntries([["title", "[data-monitoring] h1"], ["tabs", "[data-monitoring-tab]"], ["hero", "[data-hero-metrics]"], ...[...document.querySelectorAll("[data-hero-cell]")].map((c) => [`cell:${c.dataset.heroCell}`, `[data-hero-cell="${c.dataset.heroCell}"]`])].map(([k, s]) => { const r = document.querySelector(s)?.getBoundingClientRect(); return [k, r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}` : null]; })));
  const w = await frame();
  await page.locator('[data-monitoring-tab="events"]').click();
  await page.waitForTimeout(500);
  const e = await frame();
  await page.locator('[data-monitoring-tab="watch"]').click();
  await page.waitForTimeout(500);
  const w2 = await frame();
  const moved = Object.keys(w).filter((k) => w[k] !== e[k] || w[k] !== w2[k]);
  check(moved.length === 0 && Object.keys(w).length === 8, "Watch → Events → Watch with the queue present: title, tabs, hero and every cell stay put, to the pixel", moved.map((k) => `${k}: ${w[k]} → ${e[k]}`).join(" | ") || `${Object.keys(w).length} boxes`);
  await ctx.close();
  const rm = await open({ scenario: "m4-six-t1", reducedMotion: "reduce" });
  const m = await rm.page.evaluate(() => ({ dot: getComputedStyle(document.querySelector("[data-crisis-dot]")).animationName, fade: getComputedStyle(document.querySelector("#monitoring-tabpanel") ?? document.body).animationName, lift: getComputedStyle(document.querySelector('[data-hero-cell="In crisis"]')).getPropertyValue("--tw-translate-y") }));
  check(m.dot === "none" && m.fade === "none", "reduced motion: the In-crisis dot is still, the tab content does not fade", JSON.stringify(m));
  await rm.page.hover('[data-hero-cell="In crisis"]');
  await rm.page.waitForTimeout(250);
  const t = await rm.page.evaluate(() => getComputedStyle(document.querySelector('[data-hero-cell="In crisis"]')).transform);
  check(t === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(t), "and a hovered hero cell does not lift", t);
  await rm.ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
