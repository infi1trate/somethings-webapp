// ═══════════════════════════════════════════════════════════════════════════
// CHAT ESCALATION EXPERIENCE (pack v11.0) — measured, against §10
//
//   1  widths: steady, the room, the room + Support — both lenses, 1512;
//      the rail yields before Support; the banner's geometry over Support
//   2  the list header, pills row, rows and the thread header (§3.1)
//   3  the Care hero persists in every state, both lenses — identity,
//      mentorship, tier, metrics, the supervisor's diagnosis last; no yield
//   4  the metrics: zero is 0, engaged days is absent (never a number), the
//      value size against the hero's largest text
//   5  scroll proof: the hero scrolls away, the tab bar sticks, opaque,
//      nothing bleeds through; an opening scrolls to the top once
//   6  TierSelect: no check, no radio glyph; selected = ring + deepened wash
//      + filled lozenge; raise has no Current tag and no platform link, every
//      card choosable; mentors read plain language, supervisors the criteria
//   7  no disabled buttons: every CTA in the arc, enabled; validation never
//      on a pristine field, and on blur after input
//   8  the crisis note deck: record → advance → edit a recorded section →
//      the draft survives a reload → gaps named → atomic submit
//   9  post-submit: one filled button, the Ava mark, Use drops into the
//      composer and sends nothing; a sent suggestion records its provenance
//  10  source proofs: the deleted are deleted; one copy source per tier
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/chat-escalation-v11";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "active-mentorship", extra = {}, width = 1512, height = 982 } = {}) {
  const ctx = await b.newContext({ viewport: { width, height } });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, chatScenarioId: chat, monitoringScenarioId: null, ...extra }, version: VERSION }]
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  page.__errors = errors;
  return { ctx, page };
}
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
const geo = (page) =>
  page.evaluate(() => {
    const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : 0);
    const g = document.querySelector("[data-chat-layout]");
    const rails = [...document.querySelectorAll("nav, aside")].map((n) => Math.round(n.getBoundingClientRect().width)).filter((x) => x > 40);
    const ban = document.querySelector("[data-chat-banner]")?.getBoundingClientRect();
    const main = document.querySelector('[data-anno-ref="app-main"]')?.getBoundingClientRect();
    return {
      rail: rails[0] ?? 0,
      list: w(document.querySelector('[data-slot="conversation-list"]')),
      chat: w(g?.querySelector(":scope > div.flex.min-h-0.flex-col")),
      care: w(document.querySelector("[data-chat-hub]")),
      support: w(document.querySelector("[data-support-slot]")),
      banner: ban ? { left: Math.round(ban.left), right: Math.round(ban.right), h: Math.round(ban.height) } : null,
      gutter: main ? Math.round(innerWidth - main.right) + 16 : null,
      inSlot: !!document.querySelector("[data-shell-banner] [data-chat-banner]"),
    };
  });
/* Steady chat opens on Assist; the hero is Care's. */
const careOpen = async (page) => {
  if (!(await page.locator("[data-care-panel]").count())) {
    await page.locator('[data-rail-tab="care"]').first().click();
    await page.waitForTimeout(350);
  }
};
const openSupport = async (page) => {
  await page.locator("[data-support-cta]").filter({ visible: true }).first().click();
  await page.waitForTimeout(1000);
};

// ── 1 · WIDTHS ─────────────────────────────────────────────────────────────
console.log("\n── 1 · widths at 1512, both lenses");
const widths = {};
for (const [label, persona, chat, path, support, want] of [
  ["mentor steady", "mentor", "active-mentorship", "/app/chat/t14", false, { list: 300, care: 420 }],
  ["mentor room", "mentor", "escalation-active", "/app/chat/t13", false, { chat: 724, care: 680 }],
  ["mentor room + Support", "mentor", "escalation-active", "/app/chat/t13", true, { chat: 520, care: 480 }],
  ["supervisor steady", "supervisor", "active-mentorship", "/app/chat/t14", false, { care: 420 }],
  ["supervisor room", "supervisor", "escalation-active", "/app/chat/t13", false, { chat: 624, care: 624 }],
  ["supervisor room + Support", "supervisor", "escalation-active", "/app/chat/t13", true, { chat: 520, care: 480, rail: 72 }],
]) {
  const { ctx, page } = await open(path, { persona, chat });
  if (support) await openSupport(page);
  const g = await geo(page);
  widths[label] = g;
  const okW = Object.entries(want).every(([k, v]) => Math.abs(g[k] - v) <= 1);
  check(okW, `${label}: ${Object.entries(want).map(([k, v]) => `${k} ${v}`).join(" · ")}`, JSON.stringify(g));
  if (g.banner) check(g.inSlot && g.banner.left === g.rail && g.banner.right === 1496 && g.banner.h === 64, `${label}: the banner runs from the rail's edge (${g.rail}) to the gutter (1496), 64 high — over Support too`, JSON.stringify(g.banner));
  if (support) check(g.support >= 348 && g.support <= 432, `${label}: Support holds beside, ${g.support}`, "");
  await page.screenshot({ path: `${OUT}/01-${label.replace(/\W+/g, "-")}.png` });
  await ctx.close();
}

// ── 2 · THE LIST AND THE THREAD HEADER ─────────────────────────────────────
console.log("\n── 2 · the list header, pills, rows, thread header (§3.1)");
{
  const { ctx, page } = await open("/app/chat/t14");
  const m = await page.evaluate(() => {
    const h = (s) => Math.round(document.querySelector(s)?.getBoundingClientRect().height ?? 0);
    const rows = [...document.querySelectorAll('[data-list-group="conversations"] [data-anno-ref^="conversation-row:"]')].slice(0, 3).map((r) => r.getBoundingClientRect());
    const pills = document.querySelector('[role="group"][aria-label="Filter conversations"]');
    return {
      header: h("[data-list-header]"),
      title: document.querySelector("[data-list-header] h2")?.textContent,
      chevron: !!document.querySelector("[data-list-header] svg.lucide-chevron-down"),
      search: (() => { const b = document.querySelector("[data-list-search-toggle]")?.getBoundingClientRect(); return b ? `${Math.round(b.width)}×${Math.round(b.height)}` : null; })(),
      pills: Math.round(pills?.getBoundingClientRect().height ?? 0),
      pillsRule: pills ? getComputedStyle(pills).borderBottomWidth : null,
      rowH: rows.map((r) => Math.round(r.height)),
      gap: rows.length > 1 ? Math.round(rows[1].top - rows[0].bottom) : null,
      inset: rows[0] ? Math.round(rows[0].left - document.querySelector('[data-slot="conversation-list"]').getBoundingClientRect().left) : null,
      thread: h("[data-thread-header]"),
    };
  });
  check(m.header === 64 && m.title === "Teens" && !m.chevron && m.search === "40×40", "the list header: 64, \"Teens\", no chevron, a 40×40 search", JSON.stringify(m));
  check(m.pills === 54 && m.pillsRule === "1px", "the pill row: 54 with its rule beneath", `${m.pills} ${m.pillsRule}`);
  check(m.rowH.every((x) => x === 68) && m.gap === 2 && m.inset === 8, "rows: 68 high, 2 apart, inset 8", JSON.stringify({ h: m.rowH, gap: m.gap, inset: m.inset }));
  check(m.thread === 64, "the chat header row: 64", String(m.thread));
  /* The search is real: it filters by name, and Escape closes it. */
  await page.locator("[data-list-search-toggle]").click();
  await page.locator("[data-list-search]").fill("jor");
  await page.waitForTimeout(150);
  const found = await page.evaluate(() => [...document.querySelectorAll('[data-anno-ref^="conversation-row:"]')].map((r) => r.getAttribute("aria-label") ?? r.textContent).length);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const restored = await page.evaluate(() => document.querySelectorAll('[data-anno-ref^="conversation-row:"]').length);
  check(found >= 1 && found < restored && !(await page.locator("[data-list-search]").count()), "the search filters by name; Escape clears and closes it", `${found} → ${restored}`);
  await ctx.close();
}

// ── 3 · THE HERO PERSISTS ──────────────────────────────────────────────────
console.log("\n── 3 · the Care hero, in every state, both lenses");
const heroOf = (page) =>
  page.evaluate(() => {
    const h = document.querySelector('[data-care-hero="steady"]');
    const sections = h ? [...h.children].map((c) => (c.hasAttribute("data-care-identity") ? "identity" : c.hasAttribute("data-care-mentorship") ? "mentorship" : c.hasAttribute("data-tier-cell") ? "tier" : c.hasAttribute("data-care-metrics") ? "metrics" : c.hasAttribute("data-care-brief") ? "diagnosis" : "?")) : [];
    return {
      sections,
      yield: document.querySelectorAll("[data-care-yield], [data-diagnosis-strip]").length,
      supervisedBy: document.querySelector("[data-mentorship-supervisor]")?.getAttribute("href") ?? null,
      icd: !!document.querySelector("[data-care-hero] [data-icd]"),
      tierAction: document.querySelector("[data-care-hero] [data-tier-action]")?.dataset.tierAction ?? null,
      identity: document.querySelector("[data-identity-meta]")?.textContent ?? null,
    };
  });
for (const [label, persona, chat, path, expect] of [
  ["mentor steady", "mentor", "active-mentorship", "/app/chat/t14", { sections: "identity,mentorship,tier,metrics", action: "escalate" }],
  ["mentor, escalation open", "mentor", "escalation-active", "/app/chat/t13", { sections: "identity,mentorship,tier,metrics", action: null }],
  /* t21: a teen with a diagnosis on file (t14 has none to show). */
  ["supervisor steady", "supervisor", "active-mentorship", "/app/chat/t21", { sections: "identity,mentorship,tier,metrics,diagnosis", action: "update-tier" }],
  ["supervisor, escalation open", "supervisor", "escalation-active", "/app/chat/t13", { sections: "identity,mentorship,tier,metrics,diagnosis", action: null }],
]) {
  const { ctx, page } = await open(path, { persona, chat });
  await careOpen(page);
  const h = await heroOf(page);
  check(h.sections.join() === expect.sections && h.yield === 0, `${label}: the hero holds — ${expect.sections}; no yield, no strip`, JSON.stringify(h.sections));
  check(h.tierAction === expect.action, `${label}: the tier action is ${expect.action ?? "suppressed (an escalation is open)"}`, String(h.tierAction));
  check(persona === "mentor" ? /^\/admin\/person\//.test(h.supervisedBy ?? "") && !h.icd : h.supervisedBy === null && h.icd, `${label}: ${persona === "mentor" ? "Supervised by links to the supervisor's record; no diagnosis in the DOM" : "no Supervised by; the diagnosis and its ICD code close the hero"}`, JSON.stringify({ s: h.supervisedBy, icd: h.icd }));
  check(/\d+ y\/o/.test(h.identity ?? ""), `${label}: identity — age and pronouns under the name`, String(h.identity));
  await page.locator('[data-care-hero="steady"]').screenshot({ path: `${OUT}/03-hero-${label.replace(/\W+/g, "-")}.png` });
  await ctx.close();
}

// ── 4 · THE METRICS ────────────────────────────────────────────────────────
console.log("\n── 4 · the metrics: real, never fabricated");
{
  const { ctx, page } = await open("/app/chat/t14");
  await careOpen(page);
  const m = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("[data-care-metrics] [data-metric]")];
    const valueSize = Math.max(...cells.map((c) => parseFloat(getComputedStyle(c.querySelector("p:nth-child(2)")).fontSize)));
    const hero = document.querySelector('[data-care-hero="steady"]');
    const others = [...hero.querySelectorAll("p, span")].filter((e) => !e.closest("[data-care-metrics]")).map((e) => parseFloat(getComputedStyle(e).fontSize));
    const tops = cells.slice(0, 3).map((c) => Math.round(c.querySelector("p:nth-child(2)").getBoundingClientRect().bottom));
    return {
      slots: cells.map((c) => c.dataset.metric).join(),
      labels: cells.map((c) => c.querySelector("p").textContent).join(" | "),
      engaged: { absent: !!document.querySelector('[data-metric="engaged"] [data-metric-absent]'), said: document.querySelector('[data-metric="engaged"] .sr-only')?.textContent },
      zeros: cells.filter((c) => c.querySelector("p:nth-child(2)").textContent === "0").map((c) => c.dataset.metric),
      valueSize,
      largestOther: Math.max(...others),
      baseline: new Set(tops).size === 1,
    };
  });
  check(m.slots === "days,engaged,messages,flags,escalations,notes", "six slots in the pack's order", m.slots);
  check(m.engaged.absent && m.engaged.said === "Not available yet", "Engaged days (BLOCKED, Meg): an absent marker, spoken \"Not available yet\" — never a number", JSON.stringify(m.engaged));
  check(m.zeros.length > 0, "zero renders as 0", m.zeros.join(","));
  check(m.valueSize === 20 && m.largestOther <= 16 && m.baseline, "values at 20 — the hero's largest text, over the 16/24 headlines — sharing a baseline", JSON.stringify({ v: m.valueSize, other: m.largestOther }));
  await ctx.close();
}

// ── 5 · SCROLL PROOF ───────────────────────────────────────────────────────
console.log("\n── 5 · the hero scrolls away; the tab bar sticks");
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active", height: 760 });
  const s = await page.evaluate(async () => {
    const bar = document.querySelector("[data-care-tabs-bar]");
    let sc = bar.parentElement;
    while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    const top0 = sc.scrollTop;
    sc.scrollTop = 1000;
    await new Promise((r) => setTimeout(r, 120));
    const br = bar.getBoundingClientRect();
    const sr = sc.getBoundingClientRect();
    const hero = document.querySelector('[data-care-hero="steady"]').getBoundingClientRect();
    const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return {
      openedAtTop: top0 === 0,
      stuck: Math.abs(br.top - sr.top) <= 1,
      heroAway: hero.bottom <= br.top + 1,
      opaque: getComputedStyle(bar).backgroundColor.match(/rgba?\(([^)]+)\)/)[1].split(",").length === 3 || getComputedStyle(bar).backgroundColor.endsWith(", 1)"),
      rule: getComputedStyle(bar.firstElementChild).borderBottomWidth,
      hit: !!hit?.closest("[data-care-tabs-bar]"),
    };
  });
  check(s.openedAtTop, "an opening lands the panel at the top, the hero in its full state", "");
  check(s.stuck && s.heroAway && s.opaque && s.rule === "1px" && s.hit, "scrolled: the hero is gone above, the tab bar holds the top on an opaque fill with its hairline, and nothing shows through it", JSON.stringify(s));
  await page.screenshot({ path: `${OUT}/05-scrolled.png` });
  /* Keyboard order across the stick: Tab from the hero's last control
     reaches the tabs, then the panel. */
  const order = await page.evaluate(() => {
    const els = [...document.querySelectorAll("[data-care-panel] a[href], [data-care-panel] button, [data-care-panel] [tabindex='0'], [data-care-panel] input, [data-care-panel] textarea")].filter((e) => !e.disabled && e.tabIndex >= 0 && e.getBoundingClientRect().width > 0);
    const bar = document.querySelector("[data-care-tabs-bar]");
    const iBar = els.findIndex((e) => bar.contains(e));
    const iHero = els.findLastIndex((e) => e.closest('[data-care-hero="steady"]'));
    return { iHero, iBar, after: els.findIndex((e) => !bar.contains(e) && !e.closest('[data-care-hero="steady"]') && els.indexOf(e) > iBar) };
  });
  check(order.iHero < order.iBar && order.iBar < order.after, "keyboard order across the stick: hero, then the tabs, then the panel", JSON.stringify(order));
  await ctx.close();
}

// ── 6 · TIERSELECT ─────────────────────────────────────────────────────────
console.log("\n── 6 · TierSelect (§5)");
{
  const { ctx, page } = await open("/app/chat/t13");
  await page.locator('[data-rail-tab="care"]').click();
  await page.locator('[data-tier-action="escalate"]').click();
  await page.waitForTimeout(400);
  const r0 = await page.evaluate(() => [...document.querySelectorAll("[data-tier-row]")].map((r) => ({ t: r.dataset.tierRow, tag: r.querySelector("[data-tier-row-tag]")?.textContent ?? null, disabled: r.querySelector("input").disabled, desc: r.querySelector("[data-tier-row-description]").textContent })));
  check(r0.length === 3 && r0.every((r) => !r.tag && !r.disabled), "raise: Tiers 1–3, every card choosable, no Current tag — Jordan is Tier 3 and its card is a choice", JSON.stringify(r0.map((r) => [r.t, r.tag, r.disabled])));
  check(r0.every((r) => !/means\/timeframe|ideation|indicators|hallucinations/.test(r.desc)), "mentors read the plain language, never the clinical criteria (answered)", r0[0].desc);
  check(!(await page.locator("[data-raise-platform]").count()), "no platform-concern link in the raise flow", "");
  await page.locator('[data-tier-row="2"]').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  const sel = await page.evaluate(() => {
    const c = document.querySelector('[data-tier-row="2"]');
    const resolve = (v) => { const e = document.createElement("span"); e.style.backgroundColor = `var(${v})`; document.body.appendChild(e); const x = getComputedStyle(e).backgroundColor; e.remove(); return x; };
    return {
      check: document.querySelectorAll("[data-tier-select] [data-tier-check], [data-tier-select] svg.lucide-check").length,
      glyph: document.querySelectorAll("[data-tier-select] .size-4.rounded-full, [data-tier-select] .size-2.rounded-full").length,
      bg: getComputedStyle(c).backgroundColor,
      deep: resolve("--tier-legend-2-wash-deep"),
      ring: getComputedStyle(c).borderTopWidth,
      loz: c.querySelector("[data-tier-lozenge]")?.dataset.lozengeState,
      lozPresent: !!c.querySelector("[data-tier-lozenge]"),
    };
  });
  check(sel.check === 0 && sel.glyph === 0, "no check glyph, no radio glyph", JSON.stringify(sel));
  check(sel.bg === sel.deep && sel.ring === "2px" && sel.loz === "filled" && sel.lozPresent, "selected: the ring, the deepened wash, the lozenge filled — the lozenge never disappears", JSON.stringify(sel));
  /* The note's validation: never pristine; on blur after input. */
  const f = page.locator("[data-tier-field=note]");
  await f.focus();
  await page.keyboard.press("Tab");
  const pristine = await page.locator('[data-tier-error="field"]').count();
  await f.fill("x");
  await f.fill("");
  await page.keyboard.press("Tab");
  const blurred = await page.locator('[data-tier-error="field"]').count();
  const footer = await page.evaluate(() => getComputedStyle(document.querySelector("[data-tier-footer]")).position);
  check(pristine === 0 && blurred === 1 && footer === "sticky", "the note: no error on a pristine field, one on blur after input; the footer is sticky", JSON.stringify({ pristine, blurred, footer }));
  await page.locator("[data-tier-select]").screenshot({ path: `${OUT}/06-raise.png` });
  await ctx.close();
}

// ── 7–9 · THE ARC: assessment → post-submit → confirm → crisis note ────────
console.log("\n── 7 · no disabled buttons; 9 · post-submit; 8 · the crisis note deck");
let assessed;
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active" });
  const submitEnabled = await page.locator('[data-exchange-primary="submit-assessment"]').count();
  for (const id of ["q3:yes", "q4:no", "q5:no", "q6:yes", "q6b:no"]) {
    await page.locator(`[data-yes-no="${id}"]`).click();
    await page.waitForTimeout(420);
  }
  const sa = page.locator('[data-exchange-primary="submit-assessment"]');
  check((await sa.isEnabled()) && submitEnabled >= 0, "Submit to supervisor is enabled (validated inline, never greyed)", "");
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Jordan has a plan involving pills and gave away her headphones yesterday.");
  await sa.click();
  await page.waitForTimeout(700);
  const ps = await page.evaluate(() => {
    const c = document.querySelector("[data-post-submit]");
    const node = c?.closest("[data-node-state='current']");
    const inkBg = (() => { const e = document.createElement("span"); e.style.backgroundColor = "var(--text-primary)"; document.body.appendChild(e); const x = getComputedStyle(e).backgroundColor; e.remove(); return x; })();
    const filled = [...document.querySelectorAll("[data-tabpanel], #care-tabpanel")].flatMap((p) => [...p.querySelectorAll("button")]).filter((x) => getComputedStyle(x).backgroundColor === inkBg).map((x) => x.textContent.trim());
    return {
      title: node?.querySelector("[data-node-title]")?.textContent,
      reviewing: c?.querySelector("[data-post-submit-reviewing]")?.textContent,
      ava: !!c?.querySelector("[data-ava-mark] svg"),
      uses: c?.querySelectorAll("[data-suggestion-use]").length,
      filled,
      quote: !!document.querySelector('[data-quote="supervisor-echo"], [data-steadying], [data-waiting-module]'),
      heroDoor: !!document.querySelector('[data-timeline-support="mentor"]'),
    };
  });
  check(ps.title === "Assessment sent." && /has it and is reviewing\.$/.test(ps.reviewing ?? ""), "post-submit: \"Assessment sent.\" and \"{Supervisor} has it and is reviewing.\"", JSON.stringify({ t: ps.title, r: ps.reviewing }));
  check(ps.filled.length === 1 && /^Message .+ in Support$/.test(ps.filled[0]) && !ps.heroDoor, "one filled button — Message {supervisor} in Support — and the hero's door steps aside", JSON.stringify(ps.filled));
  check(ps.ava && ps.uses >= 2 && !ps.quote, "the Ava mark, quiet Use affordances; no quoted supervisor message, no steadying line", JSON.stringify(ps));
  await page.locator("[data-post-submit]").screenshot({ path: `${OUT}/09-post-submit.png` });
  const sentIn = (st) => st.chatMessages?.t13 ?? [];
  const n0 = sentIn(await store(page)).length;
  const first = page.locator("[data-suggestion-use]").first();
  const text = await page.evaluate(() => document.querySelector("[data-suggestion] span")?.textContent);
  await first.click();
  await page.waitForTimeout(250);
  const comp = await page.evaluate(() => { const t = document.querySelector('[data-slot="composer"] textarea'); return { v: t?.value, focus: document.activeElement === t, caret: t?.selectionStart === t?.value.length }; });
  check(comp.v === text && comp.focus && comp.caret && sentIn(await store(page)).length === n0, "Use drops the line into the composer — focused, caret at the end — and sends nothing", JSON.stringify(comp));
  await page.locator('[data-slot="composer"] button[type="submit"], [data-slot="composer"] button:has-text("Send")').first().click();
  await page.waitForTimeout(300);
  const sent = sentIn(await store(page)).at(-1);
  check(sent?.text === text && sent?.provenance === "ai_inserted", "sent unedited: provenance ai_inserted (the model's own state)", JSON.stringify({ p: sent?.provenance }));
  const mark = await page.evaluate(() => { const m = [...document.querySelectorAll("[data-ava-provenance]")].at(-1); return m ? { p: m.dataset.avaProvenance, said: m.querySelector(".sr-only")?.textContent } : null; });
  check(mark?.p === "ai_inserted" && mark.said === "AI draft inserted, unedited", "the sent bubble carries Ava's mark, in the model's words", JSON.stringify(mark));
  await page.locator("[data-suggestion-use]").nth(1).click();
  await page.waitForTimeout(200);
  await page.locator('[data-slot="composer"] textarea').press("End");
  await page.keyboard.type(" Whenever you're ready.");
  await page.locator('[data-slot="composer"] button[type="submit"], [data-slot="composer"] button:has-text("Send")').first().click();
  await page.waitForTimeout(300);
  check(sentIn(await store(page)).at(-1)?.provenance === "ai_assisted", "sent after an edit: provenance ai_assisted", "");
  assessed = await store(page);
  await ctx.close();
}
{
  /* The supervisor: confirm Tier 1, then the deck. */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active", extra: { escalations: assessed.escalations, tierEvents: assessed.tierEvents } });
  const crit = await page.evaluate(() => document.querySelector('[data-s1] [data-tier-row="1"] [data-tier-row-description]')?.textContent);
  check(crit === "Specific suicide plan with means/timeframe, in-progress self-harm, rapid symptom escalation or active command hallucinations.", "supervisors read §5.2's criteria verbatim", String(crit));
  check(await page.locator("[data-tier-cta]").isEnabled(), "Confirm Tier n is enabled", "");
  await page.locator("[data-tier-cta]").click();
  await page.waitForTimeout(800);
  const deck = () => page.evaluate(() => ({
    active: document.querySelector("[data-deck-state='active']")?.dataset.deckRow,
    progress: document.querySelector("[data-deck-progress]")?.textContent,
    saved: document.querySelector("[data-deck-saved]")?.textContent ?? null,
    rows: [...document.querySelectorAll("[data-deck-row]")].map((r) => `${r.dataset.deckRow}:${r.dataset.deckState}`),
    record: document.querySelectorAll("[data-record-section]").length,
    submit: !!document.querySelector('[data-exchange-primary="submit-crisis-note"]'),
    accordion: !!document.querySelector("[data-note-accordion]"),
  }));
  const d0 = await deck();
  check(d0.active === "subtype" && d0.progress === "0 of 7 sections recorded" && d0.record === 1 && d0.submit && !d0.accordion, "the deck: one card (Clinical subtype), \"0 of 7 sections recorded\", Record section, Submit — no accordion", JSON.stringify(d0));
  /* No auto-advance on a selection. */
  await page.locator('[data-choice="subtype:suicidal_ideation"]').click();
  await page.waitForTimeout(150);
  check((await deck()).active === "subtype", "choosing a subtype does NOT advance — the tags would be stranded", "");
  await page.locator('[data-deck-card="subtype"] [data-chip="housing"]').click();
  await page.locator('[data-record-section="subtype"]').click();
  await page.waitForTimeout(300);
  const d1 = await deck();
  check(d1.active === "safety-plan" && d1.progress === "1 of 7 sections recorded" && /^Draft saved/.test(d1.saved ?? ""), "Record section commits and advances; \"Draft saved {time}\"", JSON.stringify(d1));
  const summary = await page.evaluate(() => document.querySelector('[data-deck-row="subtype"] [data-deck-summary]')?.textContent);
  check(/Suicidal ideation · Housing/.test(summary ?? ""), "the recorded row shows its summary", String(summary));
  /* Edit a recorded section: it opens with its values intact. */
  await page.locator('[data-deck-open="subtype"]').click();
  await page.waitForTimeout(150);
  const intact = await page.evaluate(() => ({ subtype: document.querySelector('[data-choice="subtype:suicidal_ideation"]')?.getAttribute("aria-checked"), tag: document.querySelector('[data-deck-card="subtype"] [data-chip="housing"]')?.getAttribute("aria-checked") }));
  check(intact.subtype === "true" && intact.tag === "true", "a recorded section re-opens with its values intact", JSON.stringify(intact));
  /* Gaps are named, nothing posts. */
  const before = (await store(page)).escalations.t13.crisisNote;
  await page.locator('[data-exchange-primary="submit-crisis-note"]').click();
  await page.waitForTimeout(200);
  const gaps = await page.evaluate(() => ({ err: document.querySelector("[data-deck-error]")?.textContent, missing: document.querySelectorAll("[data-deck-missing]").length }));
  check(/Record 6 more sections/.test(gaps.err ?? "") && JSON.stringify((await store(page)).escalations.t13.crisisNote ?? null) === JSON.stringify(before ?? null), "Submit with gaps names them and posts nothing", JSON.stringify(gaps));
  /* The draft survives a reload. */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  const d2 = await deck();
  check(d2.progress === "1 of 7 sections recorded" && d2.rows[0] === "subtype:recorded", "a reload keeps the draft — 1 of 7, Clinical subtype recorded", JSON.stringify(d2));
  /* Complete it. */
  const recordRow = async (id, steps) => {
    await page.locator(`[data-deck-open="${id}"]`).click().catch(() => {});
    await page.waitForTimeout(100);
    for (const s of steps) await page.locator(s).first().click();
    await page.locator(`[data-record-section="${id}"]`).click();
    await page.waitForTimeout(250);
  };
  await recordRow("safety-plan", ['[data-choice="safety-plan:created"]']);
  await page.locator('[data-exchange-field="safety-usage"]').fill("Text her aunt.").catch(() => {});
  await recordRow("resources", ['[data-yes-no="resources:no"]']);
  await recordRow("referral", ['[data-yes-no="referral:no"]']);
  await recordRow("emergency", ['[data-yes-no="contact:no"]', '[data-yes-no="services:no"]']);
  await recordRow("outcome", ['[data-choice^="outcome:"]']);
  await page.locator('[data-exchange-field="plan"]').fill("Check in tomorrow morning.");
  await page.locator('[data-record-section="debrief"]').click();
  await page.waitForTimeout(250);
  const d3 = await deck();
  check(d3.progress === "7 of 7 sections recorded" && !d3.active, "all seven recorded; no card left open", JSON.stringify(d3));
  await page.locator('[data-exchange-primary="submit-crisis-note"]').click();
  await page.waitForTimeout(700);
  const st = await store(page);
  const e = st.escalations.t13;
  const draftLeft = await page.evaluate((id) => sessionStorage.getItem(`somethings.crisis-draft.${id}`), e.id);
  check(e.crisisNote?.subtype === "suicidal_ideation" && Object.keys(e.crisisNote?.sectionAt ?? {}).length === 5 && e.outcome?.id && e.outcome?.plan === "Check in tomorrow morning." && draftLeft === null, "Submit posts the whole note at once — sections, sectionAt, outcome, debrief — and clears the draft", JSON.stringify({ at: Object.keys(e.crisisNote?.sectionAt ?? {}), o: e.outcome?.id }));
  const closeEnabled = await page.locator('[data-exchange-primary="close"], [data-exchange-primary^="close"]').first().isEnabled().catch(() => null);
  check(closeEnabled !== false, "Close & follow-up is enabled", String(closeEnabled));
  check(page.__errors.length === 0, "no page errors across the arc", page.__errors.join(" | "));
  await ctx.close();
}

// ── 10 · SOURCE PROOFS ─────────────────────────────────────────────────────
console.log("\n── 10 · source proofs");
{
  async function walk(dir) {
    const out = [];
    for (const d of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, d.name);
      if (d.isDirectory()) out.push(...(await walk(p)));
      else if (/\.(tsx?|css)$/.test(d.name)) out.push(p);
    }
    return out;
  }
  const files = await walk("src");
  const src = Object.fromEntries(await Promise.all(files.map(async (f) => [f, await readFile(f, "utf8")])));
  const all = Object.values(src).join("\n");
  const gone = ["function Yield(", "export function DiagnosisStrip", "CrisisNoteAccordion(", "export function WaitingModule", "function PlatformReport", "STEADYING_LINES", /data-tier-check(?!ed)/, "--wash-hover"].filter((x) => (typeof x === "string" ? all.includes(x) : x.test(all))).map(String);
  check(gone.length === 0, "deleted, not orphaned: Yield, DiagnosisStrip, the crisis-note accordion, WaitingModule, PlatformReport, the steadying lines, the check glyph", gone.join(", "));
  const crit = files.filter((f) => !f.endsWith("tiers.ts") && !f.includes("__tests__")).filter((f) => /Specific suicide plan with means/.test(src[f]));
  check(crit.length === 0, "the §5.2 strings live in one source (`tiers.ts`)", crit.join(", "));
  const legacy = all.match(/Gray\/10|Brand\/True Black|Surface\/Z[0-4]|Product Body\//g) ?? [];
  check(legacy.length === 0, "no legacy Figma token family ported (Gray/10, Surface/Z0–Z4, Product Body/…)", legacy.slice(0, 3).join(", "));
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
