// ═══════════════════════════════════════════════════════════════════════════
// MONITORING v3 §6 — every scenario reachable, and each one true to its name
// (Monitoring v4 §5: the strip scenarios replaced by the queue's states)
//
// All twenty, picked THROUGH THE DEV BAR (its Scenario menu, by label, as a
// person would), each asserted on the state it promises, then the OTHER tab
// opened too — and zero console errors across both. Reset last.
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1512, height: 1000 } });
await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("somethings.monitoring.layout", "cards"); sessionStorage.setItem("seeded", "1"); } }, [KEY, { state: { persona: "supervisor", monitoringScenarioId: "m3-quiet" }, version: VERSION }]);
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
await page.goto(`${BASE}/app/monitoring`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const pick = async (label) => {
  await page.locator('[data-dev-bar-root] button[aria-label^="Scenario:"]').first().click();
  await page.waitForTimeout(200);
  await page.locator("button", { hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first().click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
};
const q = (fn, arg) => page.evaluate(fn, arg);
const tally = () => q(() => { const t = {}; for (const d of document.querySelectorAll("[data-event-day]")) for (const kv of (d.dataset.dayKinds ?? "").split(",")) { const [k, n] = kv.split(":"); if (k) t[k] = (t[k] ?? 0) + Number(n); } return Object.values(t).reduce((a, x) => a + x, 0); });
const otherTab = async () => {
  const on = await q(() => document.querySelector('[data-monitoring-tab][aria-selected="true"]')?.dataset.monitoringTab);
  await page.locator(`[data-monitoring-tab="${on === "events" ? "watch" : "events"}"]`).click();
  await page.waitForTimeout(700);
  return on;
};

const queue = () => q(() => [...document.querySelectorAll("[data-t1-row]")].map((r) => ({ id: r.dataset.t1Row, response: r.querySelector("[data-t1-response]")?.textContent.trim(), kind: r.querySelector("[data-t1-response]")?.dataset.t1Response, step: r.querySelector("[data-t1-stage]")?.dataset.t1Stage, holder: r.querySelector("[data-t1-holder]")?.textContent.trim(), action: r.querySelector("[data-t1-action]")?.dataset.t1Action })));
const SCENARIOS = [
  /* ═══ MONITORING v4, §5 ═══ The strip scenarios left with the strips;
     these are the queue's states, asserted on the queue's rows. */
  ["Quiet shift", "watch", async () => { const r = await q(() => ({ strip: !!document.querySelector("[data-alert-strip]"), empty: !!document.querySelector("[data-t1-empty]"), rows: document.querySelectorAll("[data-t1-row]").length, t2: document.querySelectorAll('[data-monitoring-card][data-tier="2"]').length, t3: document.querySelectorAll('[data-monitoring-card][data-tier="3"]').length })); return [!r.strip && r.empty && r.rows === 0 && r.t2 === 2 && r.t3 === 4, r]; }],
  ["Alert · unconfirmed (1)", "watch", async () => { const a = await queue(); await page.waitForTimeout(1300); const r = await queue(); return [r.length === 1 && r[0].kind === "window" && /^0:\d\d to confirm$/.test(r[0].response) && a[0].response !== r[0].response && r[0].step === "confirmed" && r[0].action === "join", { before: a[0]?.response, ...r[0] }]; }],
  ["Alert · overdue", "watch", async () => { const r = await queue(); return [r.length === 2 && r[0].id === "t13" && r[0].response === "Overdue 2m" && r[1].kind === "window" && !r.some((x) => /0:00|left/.test(x.response)), r]; }],
  ["Confirmed by you", "watch", async () => { const r = await queue(); return [r.length === 1 && r[0].response === "Confirmed by you · 0:48" && r[0].step === "note" && r[0].holder === "You" && r[0].action === "join", r[0]]; }],
  ["Six Tier 1s", "watch", async () => { const r = await queue(); return [r.length === 6 && r.map((x) => x.id).join(",") === "t13,t17,t22,t15,t19,t21" && r.filter((x) => x.kind === "overdue").length === 2, r.map((x) => `${x.id}:${x.response}`)]; }],
  ["Held by Sarah", "watch", async () => { const r = await queue(); return [r.length === 1 && r[0].holder === "Sarah" && r[0].action === "observe", r[0]]; }],
  ["Recommended tier pending", "watch", async () => { const r = await q(() => ({ chips: document.querySelectorAll("[data-monitoring-cards] [data-requested-tier], [data-monitoring-cards] [data-card-review]").length, reqs: [...document.querySelectorAll("[data-card-review]")].map((p) => p.textContent).filter((t) => /^Confirm Tier/.test(t)).length })); return [r.reqs >= 2, r]; }],
  ["Empty Tier 2 and Tier 3", "watch", async () => { const r = await q(() => ({ e2: document.querySelector('[data-tier-empty="2"]')?.textContent, e3: document.querySelector('[data-tier-empty="3"]')?.textContent, cards: document.querySelectorAll("[data-monitoring-card]").length })); return [!!r.e2 && !!r.e3 && r.cards === 0, r]; }],
  ["Tier 4 expanded", "watch", async () => { await q(() => document.querySelector('[data-tier-group="4"]').scrollIntoView()); await page.waitForTimeout(400); const r = await q(() => ({ exp: document.querySelector('[data-tier-group="4"] [data-tier4-toggle]')?.getAttribute("aria-expanded"), rows: document.querySelectorAll('[data-tier-group="4"] [data-monitoring-row]').length })); return [r.exp === "true" && r.rows > 2 && r.rows < 100, r]; }],
  ["Long names and many presence chips", "watch", async () => { const r = await q(() => { const cards = [...document.querySelectorAll("[data-monitoring-card]")]; return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, contained: cards.every((c) => [...c.querySelectorAll("*")].every((el) => el.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1)), long: cards.some((c) => /Wolfeschlegel|Montgomery/.test(c.textContent)) }; }); return [r.overflow <= 0 && r.contained && r.long, r]; }],
  ["Reduced motion", "watch", async () => { const r = await q(() => ({ attr: document.documentElement.dataset.motion, dot: getComputedStyle(document.querySelector("[data-crisis-dot]")).animationName, fade: getComputedStyle(document.querySelector("#monitoring-tabpanel")).animationName })); return [r.attr === "reduce" && r.dot === "none" && r.fade === "none", r]; }],
  ["Dark mode", "watch", async () => { const r = await q(() => ({ dark: document.documentElement.classList.contains("dark"), bg: getComputedStyle(document.querySelector("[data-monitoring-card]")).backgroundColor })); return [r.dark && r.bg !== "rgb(255, 255, 255)", r]; }],
  ["Empty range", "events", async () => { const r = await q(() => ({ empty: document.querySelector("[data-events-empty]")?.textContent, range: document.querySelector('[data-range][aria-checked="true"]')?.dataset.range })); return [r.range === "24h" && /^No events/.test(r.empty ?? ""), r]; }],
  ["Sparse", "events", async () => { const n = await tally(); const range = await q(() => document.querySelector('[data-range][aria-checked="true"]')?.dataset.range); return [range === "7d" && n === 4, { n, range }]; }],
  ["Dense", "events", async () => { const n = await tally(); const r = await q(() => ({ range: document.querySelector('[data-range][aria-checked="true"]')?.dataset.range, days: document.querySelectorAll("[data-event-day]").length, rendered: document.querySelectorAll("[data-day-rendered]").length, sticky: getComputedStyle(document.querySelector("[data-day-header]")).position })); return [r.range === "90d" && n >= 400 && r.rendered < r.days && r.sticky === "sticky", { n, ...r }]; }],
  /* The log stays newest-first, so "at the top of Today" is the open
     escalation inside Today's group, wearing its dot. */
  ["Open escalation present", "events", async () => { const r = await q(() => { const day = document.querySelector("[data-event-day]"); const open = day?.querySelector('[data-event][data-event-state="open"]'); return { day: day?.dataset.eventDay, open: !!open, kind: open?.dataset.eventKind, dot: !!open?.querySelector("[data-open-dot]") }; }); return [r.day === "Today" && r.open && r.kind === "escalation" && r.dot, r]; }],
  ["Collapsed repeats", "events", async () => { const r = await q(() => { const run = document.querySelector('[data-event-day="Today"] [data-event-run]'); return { n: run && Number(run.dataset.eventRun), teen: run?.querySelector("[data-event-teen]")?.textContent, detail: run?.querySelector("[data-event-detail]")?.textContent.trim() }; }); return [r.n === 5 && r.teen === "Jordan T." && /^5 flags today · /.test(r.detail ?? ""), r]; }],
  ["Filters active", "events", async () => { const r = await q(() => ({ badge: document.querySelector("[data-filters-badge]")?.textContent, chips: document.querySelectorAll("[data-applied-chip]").length })); return [r.badge === "2" && r.chips === 2, r]; }],
  ["Custom range", "events", async () => { const r = await q(() => { const f = document.querySelector("[data-range-from]")?.value, t = document.querySelector("[data-range-to]")?.value; return { range: document.querySelector('[data-range][aria-checked="true"]')?.dataset.range, f, t, days: f && t ? Math.round((Date.parse(t) - Date.parse(f)) / 864e5) : null }; }); return [r.range === "custom" && r.days === 21, r]; }],
  ["Export ready", "events", async () => { await page.waitForTimeout(400); const r = await q(() => [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.textContent.trim())); return [r.some((t) => /^Exported monitoring-events-30d\.csv/.test(t)), r]; }],
];

console.log("\n── §6 · every scenario, through the dev bar");
for (const [label, tab, assert] of SCENARIOS) {
  const before = errors.length;
  await pick(label);
  const t = await q(() => document.querySelector('[data-monitoring-tab][aria-selected="true"]')?.dataset.monitoringTab);
  const shown = await q(() => document.querySelector('[data-dev-bar-root] button[aria-label^="Scenario:"]')?.getAttribute("aria-label"));
  const [ok, detail] = await assert();
  check(ok && t === tab && shown?.includes(label), `${label} — on ${tab}, named in the bar, and true to its name`, JSON.stringify(detail).slice(0, 220));
  const was = await otherTab();
  await page.waitForTimeout(300);
  await otherTab();
  check(errors.length === before, `${label} — both tabs render with no console errors`, errors.slice(before).join(" | ").slice(0, 200));
  void was;
}
await pick("Reset — no scenario");
const reset = await q((k) => JSON.parse(localStorage.getItem(k)).state.monitoringScenarioId, KEY);
check(reset === null, "Reset clears the scenario", String(reset));
await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
