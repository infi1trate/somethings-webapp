// ═══════════════════════════════════════════════════════════════════════════
// MONITORING · EVENTS (Monitoring v2, Part A) — measured against acceptance
//
//   1  Watch · Events: a tablist that deep-links (?tab=events), arrows move
//   2  filters compose; the summary line and the hero bar read the same range
//   3  the stream: newest first, grouped by day, sticky headers under the
//      sticky filter row, the empty and end states
//   4  a row expands to its record and links to the teen's timeline; tier
//      changes wear the audit lozenge
//   5  Export CSV respects the filter and carries the audit columns
//   6  contrast, both themes; keyboard on every control
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open(path, { theme, width = 1440, height = 1000 } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, acceptDownloads: true });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona: "supervisor", chatScenarioId: "escalation-active" }, version: VERSION }]
  );
  if (theme) await ctx.addInitScript((t) => localStorage.setItem("somethings.theme", t), theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  page.__errors = errors;
  return { ctx, page };
}
const state = (page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-event]")];
    /* (Monitoring v3, §2) One label set on both tabs; the range moved into
       the detail's first fragment — keyed back together as "Escalations · 30d". */
    const hero = Object.fromEntries([...document.querySelectorAll("[data-hero-cell]")].map((c) => [`${c.dataset.heroCell} · ${(c.querySelector("[data-hero-detail]")?.textContent ?? "").split(" · ")[0]}`, Number(c.querySelector("span.font-display")?.textContent)]));
    return {
      tab: document.querySelector('[data-monitoring-tab][aria-selected="true"]')?.dataset.monitoringTab,
      url: location.pathname + location.search,
      rows: rows.length,
      kinds: [...new Set(rows.map((r) => r.dataset.eventKind))],
      esc: rows.filter((r) => r.dataset.eventKind === "escalation").length,
      flags: rows.filter((r) => r.dataset.eventKind === "flag").length,
      tierChanges: rows.filter((r) => r.dataset.eventKind === "tier_change").length,
      summary: document.querySelector("[data-events-summary]")?.textContent ?? "",
      hero,
      days: [...document.querySelectorAll("[data-day-header]")].map((h) => h.textContent),
      times: rows.map((r) => r.querySelector("time")?.getAttribute("datetime")),
      empty: document.querySelector("[data-events-empty]")?.textContent ?? null,
      end: document.querySelector("[data-events-end]")?.textContent ?? null,
    };
  });
const num = (summary, re) => Number((summary.match(re) ?? [])[1]);

// ── 1 · THE TAB ───────────────────────────────────────────────────────────
console.log("\n── 1 · Watch · Events, deep-linked");
{
  const { ctx, page } = await open("/app/monitoring?tab=events");
  let s = await state(page);
  check(s.tab === "events" && s.rows > 0, "?tab=events opens on Events, with the stream", JSON.stringify({ tab: s.tab, rows: s.rows }));
  const order = await page.evaluate(() => { const t = document.querySelector("[data-monitoring-tabs]"); const toggle = document.querySelector("[data-layout-group]"); return { left: !toggle || !!(t && t.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING), toggleOnEvents: !!toggle }; });
  /* RETARGETED (Monitoring v3, §2): the toggle keeps its slot on Events —
     hidden, not unmounted — so nothing moves. */
  const hid = await page.evaluate(() => { const g = document.querySelector("[data-layout-group]"); return g ? getComputedStyle(g).visibility : null; });
  check(order.left && hid === "hidden", "the tabs sit left of the view toggle, which Events hides in place", JSON.stringify({ ...order, hid }));
  await page.locator('[data-monitoring-tab="events"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(500);
  s = await state(page);
  const focus = await page.evaluate(() => document.activeElement?.dataset.monitoringTab);
  check(s.tab === "watch" && s.url === "/app/monitoring" && focus === "watch", "ArrowLeft goes to Watch: the URL follows and focus moves", JSON.stringify({ tab: s.tab, url: s.url, focus }));
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  s = await state(page);
  check(s.tab === "events" && s.url === "/app/monitoring?tab=events", "and back, by keyboard", s.url);
  check(page.__errors.length === 0, "no page errors", page.__errors.join(" | "));
  await ctx.close();
}

// ── 2 · FILTERS COMPOSE; THE SUMMARY AND THE HERO READ THE RANGE ──────────
console.log("\n── 2 · filters compose, and the summary and hero follow them");
{
  const { ctx, page } = await open("/app/monitoring?tab=events");
  const d30 = await state(page);
  check(/^30d · /.test(d30.summary) && num(d30.summary, /· (\d+) escalations?/) === d30.esc && num(d30.summary, /· (\d+) flags?,/) === d30.flags && num(d30.summary, /· (\d+) tier changes?/) === d30.tierChanges, "the summary line counts exactly the rows below it", d30.summary);
  check(d30.hero["Escalations · 30d"] === d30.esc && d30.hero["Risk flags · 30d"] === d30.flags, "the hero's flag and escalation cells count the same range", JSON.stringify(d30.hero));
  const mono = await page.evaluate(() => [...document.querySelectorAll("[data-events-summary] span")].every((s) => /mono/.test(getComputedStyle(s).fontFamily)) && !/mono/.test(getComputedStyle(document.querySelector("[data-events-summary]")).fontFamily));
  check(mono, "numerals in mono, labels in the sans");
  /* Range, by keyboard: one tab stop, arrows select. */
  await page.locator('[data-range="30d"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  const d7 = await state(page);
  check(d7.rows < d30.rows && d7.hero["Escalations · 7d"] === d7.esc && /^7d · /.test(d7.summary), "ArrowLeft picks 7d: fewer rows, and the hero and summary say 7d", JSON.stringify({ rows: d7.rows, hero: d7.hero }));
  await page.locator('[data-range="90d"]').click();
  await page.waitForTimeout(300);
  const d90 = await state(page);
  check(d90.rows > d30.rows, "90d holds more than 30d — the generated history makes the range mean something", `${d30.rows} → ${d90.rows}`);
  await page.locator('[data-range="30d"]').click();
  /* Type chips: escalations only. */
  for (const k of ["flag", "tier_change", "note"]) await page.locator(`[data-filter-chip="${k}"]`).click();
  await page.waitForTimeout(250);
  const esc = await state(page);
  check(esc.kinds.join() === "escalation" && esc.rows === d30.esc, "type chips narrow to Escalations alone", JSON.stringify(esc.kinds));
  /* …and Tier 1 only. */
  for (const t of ["t2", "t3", "t4"]) await page.locator(`[data-filter-chip="${t}"]`).click();
  await page.waitForTimeout(250);
  const t1 = await state(page);
  const t1Tiers = await page.evaluate(() => [...document.querySelectorAll("[data-event]")].map((d) => d.dataset.eventTier));
  check(t1.rows > 0 && t1.rows < esc.rows && t1Tiers.every((t) => t === "1"), "tier chips compose with type: T1 escalations only", `${esc.rows} → ${t1.rows} · tiers ${[...new Set(t1Tiers)]}`);
  const chips = await page.evaluate(() => [...document.querySelectorAll("[data-filter-chip]")].map((c) => `${c.dataset.filterChip}:${c.getAttribute("aria-checked")}`).join(" "));
  check(/escalation:true flag:false/.test(chips) && /t1:true t2:false/.test(chips), "the chips are checkboxes that say their state", chips);
  for (const t of ["t2", "t3", "t4"]) await page.locator(`[data-filter-chip="${t}"]`).click();
  for (const k of ["flag", "tier_change", "note"]) await page.locator(`[data-filter-chip="${k}"]`).click();
  /* Mentor search, as you type. */
  await page.locator('[data-filter-picker="mentor"]').fill("noah");
  await page.waitForTimeout(250);
  const noah = await page.evaluate(() => [...document.querySelectorAll("[data-event]")].map((r) => r.querySelector("[data-event-teen] + span")?.textContent));
  check(noah.length > 0 && noah.every((m) => /^Noah/.test(m ?? "")), "the mentor picker filters as you type", `${noah.length} rows`);
  await page.locator('[data-filter-picker="mentor"]').fill("");
  await page.locator('[data-filter-picker="supervisor"]').fill("stephen");
  await page.waitForTimeout(250);
  const sup = await state(page);
  check(sup.rows > 0 && sup.rows < d30.rows, "and the supervisor picker too", `${sup.rows} rows`);
  await page.locator('[data-filter-picker="supervisor"]').fill("");
  /* Custom: two dates. */
  await page.locator('[data-range="custom"]').click();
  await page.waitForTimeout(150);
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  await page.locator("[data-range-from]").fill(today);
  await page.locator("[data-range-to]").fill(today);
  await page.waitForTimeout(250);
  const custom = await state(page);
  check(custom.days.join() === "Today" && custom.rows > 0, "Custom opens two dates; today–today is Today alone", JSON.stringify(custom.days));
  await ctx.close();
}

// ── 3 · THE STREAM ────────────────────────────────────────────────────────
console.log("\n── 3 · newest first, by day, sticky headers, empty and end");
{
  const { ctx, page } = await open("/app/monitoring?tab=events", { height: 800 });
  const s = await state(page);
  const times = s.times.map((t) => Date.parse(t));
  check(times.every((t, i) => i === 0 || t <= times[i - 1]), "newest first — a log", `${s.rows} rows`);
  check(s.days[0] === "Today" && s.days[1] === "Yesterday" && s.days.length > 3, "Today, then Yesterday, then dates", s.days.slice(0, 4).join(" · "));
  check(/^End of 30 days$/.test(s.end ?? ""), "the end of the range is named", String(s.end));
  /* Sticky: scroll, and the current day header sits just under the filter row. */
  await page.evaluate(() => { const h = [...document.querySelectorAll("[data-day-header]")][2]; h?.scrollIntoView(); });
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(300);
  const sticky = await page.evaluate(() => {
    const head = document.querySelector("[data-events-head]").getBoundingClientRect();
    const headers = [...document.querySelectorAll("[data-day-header]")].map((h) => h.getBoundingClientRect());
    const pinned = headers.filter((r) => Math.abs(r.top - head.bottom) <= 1);
    const h = document.querySelector("[data-events-head]");
    const hs = getComputedStyle(h);
    const day = getComputedStyle(document.querySelector("[data-day-header]"));
    /* A header leaving its day scrolls UNDER the filter row — which must be
       opaque and above it, so nothing reads through. */
    return { headTop: Math.round(head.top), headBottom: Math.round(head.bottom), pinned: pinned.length, opaque: !/rgba\(.*, 0(\.\d+)?\)/.test(hs.backgroundColor) && hs.backgroundColor !== "transparent", above: Number(hs.zIndex) > Number(day.zIndex) };
  });
  check(sticky.pinned === 1 && sticky.opaque && sticky.above, "scrolled: the filter row stays; exactly one day header pins right under it, and the row covers the rest", JSON.stringify(sticky));
  /* Empty: every type off. */
  for (const k of ["escalation", "flag", "tier_change", "note"]) await page.locator(`[data-filter-chip="${k}"]`).click();
  await page.waitForTimeout(200);
  const e = await state(page);
  check(e.rows === 0 && e.empty === "No events in the last 30 days", "nothing selected: the empty state names the range", String(e.empty));
  await ctx.close();
}

// ── 4 · THE RECORD, INLINE, AND THE TIMELINE LINK ─────────────────────────
console.log("\n── 4 · a row expands to its record; tier changes wear the audit lozenge");
{
  const { ctx, page } = await open("/app/monitoring?tab=events");
  const live = page.locator('[data-event-kind="escalation"][data-event-state="open"]').first();
  await live.locator("[data-event-expand]").click();
  await page.waitForTimeout(150);
  const rec = await live.evaluate((el) => ({ expanded: el.querySelector("[data-event-expand]")?.getAttribute("aria-expanded"), text: el.querySelector("[data-event-record]")?.innerText ?? "", href: el.querySelector("[data-event-timeline]")?.getAttribute("href") }));
  check(rec.expanded === "true" && /When/.test(rec.text) && /Who/.test(rec.text) && rec.href === "/app/chat/t13", "the open escalation's record: who, when — and Open timeline › to the live timeline", JSON.stringify({ href: rec.href }));
  await page.locator('[data-range="90d"]').click();
  await page.waitForTimeout(250);
  const closed = page.locator('[data-event-kind="escalation"][data-event-state="closed"]').filter({ hasText: "Imani" }).first();
  await closed.locator("[data-event-expand]").click();
  await page.waitForTimeout(150);
  const c = await closed.evaluate((el) => ({ detail: el.querySelector("[data-event-detail]")?.textContent, doc: el.querySelector("[data-event-document]")?.innerText ?? "", href: el.querySelector("[data-event-timeline]")?.getAttribute("href") }));
  check(/^Flagged Tier 1 by .+ · confirmed Tier 1 by .+ in \d+:\d\d · closed → Tier 2, /.test(c.detail ?? "") && /Crisis note/.test(c.doc) && /Clinical subtype/.test(c.doc) && c.href === "/admin/person/t21?tab=care", "Imani's closed escalation: the full audit line, the crisis note's fields, and her Care history", JSON.stringify(c).slice(0, 200));
  const note = page.locator('[data-event-kind="note"]').first();
  await note.locator("[data-event-expand]").click();
  await page.waitForTimeout(120);
  check(/fields TBD/.test(await note.innerText()), "an undefined document says fields TBD");
  const lozenges = await page.evaluate(() => [...document.querySelectorAll('[data-event-kind="tier_change"]')].every((r) => !!r.querySelector("[data-audit-lozenge]") && !r.querySelector("[data-event-chip]")));
  check(lozenges, "every tier change carries the audit lozenge, not a state chip");
  await ctx.close();
}

// ── 5 · EXPORT ────────────────────────────────────────────────────────────
console.log("\n── 5 · Export CSV respects the filter");
{
  const { ctx, page } = await open("/app/monitoring?tab=events");
  for (const k of ["flag", "tier_change", "note"]) await page.locator(`[data-filter-chip="${k}"]`).click();
  await page.waitForTimeout(250);
  const s = await state(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("[data-export-csv]").click()]);
  const text = await readFile(await dl.path(), "utf8");
  const lines = text.split("\n");
  const head = lines[0].split(",");
  check(dl.suggestedFilename() === "monitoring-events-30d.csv", "named for its range", dl.suggestedFilename());
  check(["teen", "mentor", "supervisor", "flagged_at", "confirmed_at", "closed_at", "response_seconds", "from_tier", "to_tier", "document"].every((c) => head.includes(c)), "the audit columns: teen, mentor, supervisor, flagged/confirmed/closed, response seconds, from/to tier, document", lines[0]);
  check(lines.length - 1 === s.rows && lines.slice(1).every((l) => l.startsWith("escalation,")), "one row per filtered event — escalations only, as filtered", `${lines.length - 1} rows · ${s.rows} on screen`);
  const closedRow = lines.slice(1).find((l) => /,closed,/.test(l));
  check(!!closedRow && /\d{4}-\d\d-\d\dT[\d:.]+Z,\d{4}-\d\d-\d\dT/.test(closedRow), "a closed escalation carries its ISO timestamps", closedRow?.slice(0, 120));
  await ctx.close();
}

// ── 6 · CONTRAST, BOTH THEMES ─────────────────────────────────────────────
console.log("\n── 6 · contrast");
const ENGINE = `(() => { if (window.__c) return;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, u) => { const a = t[3]; return [t[0]*a+u[0]*(1-a), t[1]*a+u[1]*(1-a), t[2]*a+u[2]*(1-a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let base = [255,255,255,1]; if (st.length && st[st.length-1][3] >= 1) base = st.pop(); while (st.length) base = over(st.pop(), base); return base; };
  window.__c = { rgba, ratio, bgOf }; })()`;
for (const theme of ["light", "dark"]) {
  const { ctx, page } = await open("/app/monitoring?tab=events", { theme });
  const low = await page.evaluate(([ENGINE]) => {
    eval(ENGINE);
    const { rgba, ratio, bgOf } = window.__c;
    const out = [];
    for (const root of document.querySelectorAll("[data-events]")) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!n.textContent.trim() || el.closest(".sr-only") || el.closest("datalist")) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
        const s = getComputedStyle(el);
        const v = Math.round(ratio(rgba(s.color), bgOf(el)) * 100) / 100;
        out.push({ t: n.textContent.trim().slice(0, 20), v });
      }
    }
    return { n: out.length, low: out.filter((x) => x.v < 4.5), min: Math.min(...out.map((x) => x.v)) };
  }, [ENGINE]);
  check(low.n > 20 && low.low.length === 0, `${theme}: every visible text on the Events tab clears AA`, low.low.length ? JSON.stringify(low.low.slice(0, 4)) : `${low.n} texts, lowest ${low.min}:1`);
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
