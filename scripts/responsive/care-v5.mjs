// ═══════════════════════════════════════════════════════════════════════════
// CARE PANEL & ESCALATION — REFINEMENT (pack v5.0) — the report's measurements
//
//   Phase 1
//   1  bug 1: a Monitoring-scenario switch after a close never yields a second
//      "closed the escalation" chip — driven through the REAL dev bar; and a
//      browser that already persisted a duplicate shows one
//   2  bug 2 / A2: the Care tabs — sticky, fades only where there is more, a
//      cut tab always under a fade, the ends whole
//   3  A1: hero v2 — overline, headline, one meta line, the ghost Support
//      button last; no holder
//   4  Supersessions 5–6: the Teen Status card per role; the tier cell's diet
//   5  A3: one label set for the future
//   Phase 2
//   6  Supersession 3: question first, in a fixed place (y-offset measured at
//      0, 3 and 6 answers); the answered group collapsed; amend in place
//   7  Supersession 4: the review ledger — the live risk chip, short-label
//      rows, no full question text by default, amend recomputes the risk
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-v5";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "active-mentorship", extra = {}, width = 1512, height = 1000 } = {}) {
  const ctx = await b.newContext({ viewport: { width, height } });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, chatScenarioId: chat, ...extra }, version: VERSION }]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await careOpen(page);
  return { ctx, page };
}
const careOpen = async (page) => {
  if ((await page.locator('[data-rail-tab="care"]').count()) && !(await page.locator("[data-care-panel]").count())) {
    await page.locator('[data-rail-tab="care"]').click();
    await page.waitForTimeout(300);
  }
};
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
const closeChips = (page) => page.evaluate(() => [...document.querySelectorAll('[data-slot="event-chip"]')].filter((c) => /closed the escalation/.test(c.textContent)).length);
const setPersona = async (page, persona) => {
  await page.evaluate(([k, p]) => { const raw = JSON.parse(localStorage.getItem(k)); raw.state.persona = p; localStorage.setItem(k, JSON.stringify(raw)); }, [KEY, persona]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await careOpen(page);
};
/* Mentor assesses (all no) and submits; supervisor confirms Tier 3, which closes it. */
const assessAndClose = async (page) => {
  await setPersona(page, "mentor");
  for (let i = 0; i < 8; i++) { const no = page.locator('[data-yes-no$=":no"]').first(); if (!(await no.count())) break; await no.click(); await page.waitForTimeout(100); }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Probe: talking, no plan.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(300);
  await setPersona(page, "supervisor");
  await page.locator('[data-s1-tier="3"]').click();
  await page.locator('[data-exchange-primary="confirm-tier"]').click();
  await page.waitForTimeout(400);
};

// ── 1 · BUG 1: THE DUPLICATE CLOSE CHIP ────────────────────────────────────
console.log("\n── 1 · bug 1: one close chip per escalation");
{
  /* A Monitoring scenario is active (the bar shows its axis only then). */
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active", extra: { monitoringScenarioId: "tiers-monitor" } });
  await assessAndClose(page);
  check((await closeChips(page)) === 1, "closed once: one chip", String(await closeChips(page)));
  /* The REAL Monitoring-scenario switch, through the dev bar, from the page
     whose axis it is. */
  await page.goto(`${BASE}/app/monitoring`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.locator('[data-dev-bar-root] button[aria-label^="Scenario:"]').first().click();
  await page.waitForTimeout(200);
  await page.locator("button", { hasText: /^Tiers · Alert$/ }).first().click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const after = await store(page);
  check(Object.keys(after.chatEvents ?? {}).length === 0 && Object.keys(after.escalations ?? {}).length === 0, "the switch clears the chat writes WITH the escalation records", JSON.stringify({ ev: Object.keys(after.chatEvents ?? {}), esc: Object.keys(after.escalations ?? {}) }));
  await page.goto(`${BASE}/app/chat/t13`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check((await closeChips(page)) === 0, "back on the thread: no stale close chip under a re-opened escalation", String(await closeChips(page)));
  await careOpen(page);
  await assessAndClose(page);
  check((await closeChips(page)) === 1, "closing the re-seeded escalation leaves ONE chip, not two", String(await closeChips(page)));
  await ctx.close();
}
{
  /* A browser that already persisted the duplicate: the read-time guard. */
  const ev = (id, at) => ({ id, threadId: "t13", at, kind: "escalation-resolved", actorId: "s-brandy", artifactId: "esc-t13", artifactName: "the escalation" });
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active", extra: { chatEvents: { t13: [ev("d1", Date.now() - 2 * 3600e3), ev("d2", Date.now() - 600e3)] } } });
  check((await closeChips(page)) === 1, "a persisted duplicate renders once — the first close wins", String(await closeChips(page)));
  await ctx.close();
}

// ── 2 · BUG 2 / A2: THE TABS ────────────────────────────────────────────────
console.log("\n── 2 · the Care tabs: sticky, fades only where there is more");
const tabs = (page) =>
  page.evaluate(() => {
    const row = document.querySelector("[data-care-tabs]");
    const rr = row.getBoundingClientRect();
    const L = document.querySelector('[data-care-tabs-fade="left"]'), R = document.querySelector('[data-care-tabs-fade="right"]');
    const t = [...row.querySelectorAll("[data-care-tab]")].map((x) => { const r = x.getBoundingClientRect(); return { id: x.dataset.careTab, cutL: r.left < rr.left - 0.5 && r.right > rr.left, cutR: r.right > rr.right + 0.5 && r.left < rr.right, whole: r.left >= rr.left - 0.5 && r.right <= rr.right + 0.5 }; });
    return { over: row.scrollWidth > row.clientWidth, left: !!L, right: !!R, snap: getComputedStyle(row).scrollSnapType, t };
  });
for (const w of [1512, 1280]) {
  const { ctx, page } = await open("/app/chat/t14", { width: w });
  const a = await tabs(page);
  check(!a.left && (a.over ? a.right : !a.right), `@${w}: at rest — no left fade; a right fade only if there is more`, JSON.stringify({ over: a.over, l: a.left, r: a.right }));
  check(a.t.every((x) => !x.cutR || a.right) && a.t.every((x) => !x.cutL), `@${w}: a tab cut at the edge is always under a fade`, a.t.filter((x) => x.cutL || x.cutR).map((x) => x.id).join());
  check(/x/.test(a.snap) && /mandatory/.test(a.snap), `@${w}: the tabs snap`, a.snap);
  await page.evaluate(() => { const r = document.querySelector("[data-care-tabs]"); r.scrollLeft = r.scrollWidth; });
  await page.waitForTimeout(250);
  const z = await tabs(page);
  check(!z.right && (z.over ? z.left : true) && z.t.at(-1).whole, `@${w}: scrolled to the end — History whole, no right fade (it sat under one in v4)`, JSON.stringify({ l: z.left, r: z.right, last: z.t.at(-1) }));
  /* Keyboard: End then Home round-trips, the ends whole each time. */
  await page.locator('[data-care-tab][aria-selected="true"]').focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(250);
  const h = await tabs(page);
  check(h.t[0].whole && !h.left, `@${w}: Home brings Overview back whole, no left fade`, JSON.stringify({ first: h.t[0], l: h.left }));
  if (w === 1512) await page.screenshot({ path: `${OUT}/01-tabs.png`, clip: await page.locator('[data-slot="chat-rail"]').boundingBox() });
  await ctx.close();
}
{
  /* STICKY: scroll the rail; the bar pins, opaque, and the hero goes under it. */
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active", height: 700 });
  const sticky = await page.evaluate(async () => {
    const bar = document.querySelector("[data-care-tabs-bar]");
    let sc = bar.parentElement;
    while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    const top0 = sc.getBoundingClientRect().top;
    sc.scrollTop = 400;
    await new Promise((r) => setTimeout(r, 200));
    const br = bar.getBoundingClientRect(), hr = document.querySelector("[data-care-hero]").getBoundingClientRect();
    return { scrolled: sc.scrollTop, barTop: Math.round(br.top - top0), heroBottomAboveBar: hr.bottom <= br.bottom + 0.5, bg: getComputedStyle(bar).backgroundColor };
  });
  check(sticky.scrolled > 0 && sticky.barTop <= 1 && sticky.heroBottomAboveBar && sticky.bg !== "rgba(0, 0, 0, 0)", "sticky: the tab bar pins to the rail's top, opaque; the hero scrolls away beneath it", JSON.stringify(sticky));
  await ctx.close();
}

// ── 3 · A1: HERO V2 ─────────────────────────────────────────────────────────
console.log("\n── 3 · hero v2: state only");
const hero = (page) =>
  page.evaluate(() => {
    const h = document.querySelector('[data-care-hero="escalation"]');
    const btn = h?.querySelector("[data-timeline-support]");
    return {
      overline: h?.querySelector("[data-hero-overline]")?.textContent.trim(),
      headline: h?.querySelector("[data-hero-headline]")?.textContent.trim(),
      lozenge: !!h?.querySelector("[data-hero-headline] [data-tier-lozenge]"),
      /* The line's fragments are separate spans laid out with a gap. */
      meta: [...(h?.querySelector("[data-timeline-meta]")?.children ?? [])].map((c) => c.textContent.trim()).join(" "),
      metaLines: h?.querySelectorAll("[data-timeline-meta]").length,
      button: btn ? { text: btn.textContent.trim(), underline: getComputedStyle(btn).textDecorationLine, last: h.lastElementChild === btn, icon: !!btn.querySelector("svg") } : null,
      holder: /has this|— with/.test(h?.textContent ?? ""),
      children: h?.children.length,
    };
  });
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active" });
  const h = await hero(page);
  check(h.overline === "Escalation" && h.headline === "Tier 1 requested" && !h.lozenge, "requested: overline ESCALATION, headline “Tier 1 requested” in words, no lozenge yet", JSON.stringify(h));
  check(h.metaLines === 1 && /^Opened \d{1,2}:\d{2} [AP]M · Awaiting confirmation$/.test(h.meta ?? ""), "one interpuncted meta line", String(h.meta));
  check(h.button?.text === "Message Brandy in Support" && h.button.underline === "none" && h.button.last && h.button.icon, "the Support ghost button: icon + label, no underline, the hero's last line", JSON.stringify(h.button));
  check(!h.holder && h.children === 4, "nothing else — no holder line", JSON.stringify({ holder: h.holder, n: h.children }));
  await page.screenshot({ path: `${OUT}/02-hero-requested.png`, clip: await page.locator('[data-slot="chat-rail"]').boundingBox() });
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  const h = await hero(page);
  check(h.lozenge && /T2/.test(h.headline ?? "") && /^Opened .+ · Confirmed( by .+)? · \d/.test(h.meta ?? "") && !/Tier 2 confirmed/.test(h.meta ?? ""), "confirmed: the lozenge is the headline; the meta line does not repeat the tier", JSON.stringify({ hl: h.headline, meta: h.meta }));
  check(h.button?.text === "Message the mentor in Support" || /^Message .+ in Support$/.test(h.button?.text ?? ""), "the supervisor's ghost button names the mentor", String(h.button?.text));
  await ctx.close();
}

// ── 4 · SUPERSESSIONS 5–6: THE TEEN STATUS CARD ────────────────────────────
console.log("\n── 4 · the Teen Status card, per role");
const BR = { id: "s-brandy", name: "Brandy", role: "supervisor" };
const T3 = { tierEvents: [{ id: "v5-t3", teenId: "t14", at: Date.now() - 6 * 864e5, kind: "placed", tier: 3, fromTier: 4, actor: BR, reason: "Probe: Tier 3." }] };
const card = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('[data-care-hero="steady"]');
    const cell = c?.querySelector("[data-tier-cell]");
    return {
      cells: [...(c?.querySelectorAll("[data-overline]") ?? [])].map((o) => o.textContent.trim()),
      brief: !!c?.querySelector("[data-care-brief]"),
      lozenge: cell?.querySelector("[data-tier-lozenge]")?.textContent.trim(),
      info: !!cell?.querySelector("[data-tier-info]"),
      description: !!cell?.querySelector("[data-tier-description]"),
      dwell: cell?.querySelector("[data-tier-time]")?.textContent.trim(),
      track: !!cell?.querySelector("[data-dwell-track]"),
      sentence: /unless renewed|minimum/.test(cell?.textContent ?? ""),
      actions: [...(cell?.querySelectorAll("[data-tier-action]") ?? [])].map((a) => a.dataset.tierAction),
      pending: [...(cell?.querySelectorAll("[data-tier-pending]") ?? [])].map((p) => p.textContent.trim()),
      chip: !!cell?.querySelector("[data-requested-tier]"),
    };
  });
{
  const { ctx, page } = await open("/app/chat/t14", { extra: T3 });
  const m = await card(page);
  check(m.cells.join() === "Risk tier" && !m.brief, "mentor: the Risk tier cell only — the diagnosis is not in the DOM", JSON.stringify(m.cells));
  check(/^T3/.test(m.lozenge ?? "") && m.info && !m.description && !m.sentence, "the lozenge is the headline; description and dwell rule are behind the ⓘ, not on the card", JSON.stringify(m));
  check(m.track && /^Day \d+ of 14$/.test(m.dwell ?? ""), "the dwell is a slim progress line: “Day N of 14”", String(m.dwell));
  check(m.actions.join() === "escalate", "one outline action on the card: Escalate", m.actions.join());
  await page.locator("[data-tier-info]").click();
  await page.waitForTimeout(250);
  const pop = await page.evaluate(() => ({ d: document.querySelector("[data-tier-description]")?.textContent, r: document.querySelector("[data-tier-rule]")?.textContent, down: !!document.querySelector('[data-slot="popover-content"] [data-tier-action="request-step-down"]') }));
  check(!!pop.d && /unless renewed/.test(pop.r ?? "") && pop.down, "the ⓘ holds the description, the rule, and the mentor's step-down request", JSON.stringify(pop));
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/03-status-mentor.png`, clip: await page.locator('[data-slot="chat-rail"]').boundingBox() });
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t14", { persona: "supervisor", extra: T3 });
  const s = await card(page);
  check(s.cells.join("|") === "Clinical diagnosis|Risk tier" && s.brief, "supervisor: Clinical diagnosis · Risk tier", s.cells.join(" · "));
  check(s.actions.join() === "update-tier", "one outline action: Update tier", s.actions.join());
  await page.screenshot({ path: `${OUT}/04-status-supervisor.png`, clip: await page.locator('[data-slot="chat-rail"]').boundingBox() });
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t14", { persona: "lead-mentor", extra: T3 });
  const l = await card(page);
  check(l.cells.join("|") === "Clinical diagnosis|Risk tier", "lead mentor: the diagnosis too", l.cells.join(" · "));
  await ctx.close();
}
{
  /* A pending request: exactly one status line, and no chip beside it. */
  const req = { tierEvents: [...T3.tierEvents, { id: "v5-req", teenId: "t14", at: Date.now() - 3600e3, kind: "requested", tier: 2, fromTier: 3, actor: { id: "live", name: "You", role: "mentor" }, reason: "Probe: request." }] };
  const { ctx, page } = await open("/app/chat/t14", { extra: req });
  const p = await card(page);
  check(p.pending.length === 1 && p.pending[0] === "Requested: Tier 2 · awaiting confirmation" && !p.chip && !p.dwell, "pending: ONE status line, replacing the chip and the dwell", JSON.stringify(p));
  await ctx.close();
}

// ── 5 · A3: ONE LABEL SET FOR THE FUTURE ───────────────────────────────────
console.log("\n── 5 · the future, named once");
for (const [persona, chat] of [["mentor", "escalation-active"], ["supervisor", "escalation-tier2"]]) {
  const { ctx, page } = await open("/app/chat/t13", { persona, chat });
  await page.locator("[data-up-next-toggle]").click();
  const u = await page.evaluate(() => ({ path: document.querySelector("[data-up-next-path]")?.textContent.replace(/^Up next:\s*/, "").split(" → "), rows: [...document.querySelectorAll("[data-up-next-steps] [data-node-condition]")].map((c) => c.textContent.trim()) }));
  check(u.path?.length === u.rows.length && u.path.every((n, i) => u.rows[i] === n || u.rows[i].startsWith(`${n} · `)), `${persona}: each locked row names its step exactly as the path does`, `${u.path?.join(" → ")} | ${u.rows.join(" | ")}`);
  await ctx.close();
}

// ── 6–7 · PHASE 2: ASSESSMENT ERGONOMICS ───────────────────────────────────
console.log("\n── 6 · question first, in a fixed place");
{
  /* A fresh Tier 1 raise on Sam: the assessment at zero answers. */
  const { ctx, page } = await open("/app/chat/t14");
  await page.locator('[data-tier-action="escalate"]').click();
  await page.locator('[data-raise-option="1"]').click();
  await page.locator("[data-raise-note]").fill("Probe: a Tier 1 raise.");
  await page.locator("[data-raise-confirm]").click();
  await page.waitForTimeout(600);
  const at = () =>
    page.evaluate(() => {
      const node = document.querySelector('[data-node="assessment"] [data-node-card]');
      const card = node?.querySelector("[data-assessment-active]");
      const yes = card?.querySelector("[data-yes-no$=':yes']");
      return {
        header: card?.querySelector("[data-question-header]")?.textContent.trim(),
        cardY: card ? Math.round(card.getBoundingClientRect().top - node.getBoundingClientRect().top) : null,
        yesY: yes ? Math.round(yes.getBoundingClientRect().top - node.getBoundingClientRect().top) : null,
        group: !!node?.querySelector("[data-answered-group]"),
        count: node?.querySelector("[data-answered-toggle]")?.textContent.trim() ?? null,
        expanded: node?.querySelector("[data-answered-toggle]")?.getAttribute("aria-expanded") ?? null,
        listHidden: node?.querySelector("[data-answered-group] [data-assessment-answered]")?.hidden ?? null,
        groupBelow: (() => { const g = node?.querySelector("[data-answered-group]"); return g && card ? g.getBoundingClientRect().top >= card.getBoundingClientRect().bottom : null; })(),
      };
    });
  const no = async (k) => { for (let i = 0; i < k; i++) { await page.locator('[data-assessment-active] [data-yes-no$=":no"]').click(); await page.waitForTimeout(150); } };
  const a0 = await at();
  check(a0.header === "Question 1 of 6" && !a0.group, "0 answered: “Question 1 of 6”, no answered group yet", JSON.stringify(a0));
  await no(3);
  const a3 = await at();
  check(a3.header === "Question 4 of 6" && a3.count === "3 answered" && a3.expanded === "false" && a3.listHidden === true && a3.groupBelow, "3 answered: one collapsed summary row, BELOW the card", JSON.stringify(a3));
  await no(2);
  await page.locator('[data-yes-no="q6:yes"]').click();
  await page.waitForTimeout(200);
  const a6 = await at();
  check(a6.header === "Question 6 · follow-up" && a6.count === "6 answered", "6 answered (Q6 yes opens its follow-up): still the card", JSON.stringify(a6));
  check(a0.cardY === a3.cardY && a3.cardY === a6.cardY, "the question card's position is identical at 0, 3 and 6 answers", `${a0.cardY} · ${a3.cardY} · ${a6.cardY}px from the node's top`);
  check(Math.abs(a0.yesY - a3.yesY) <= 1, "and Yes / No do not move as answers accrue (same question shape)", `${a0.yesY} · ${a3.yesY}`);
  /* AMEND inside the expanded group. */
  await page.locator("[data-answered-toggle]").click();
  await page.locator('[data-answered="q1"] > button').click();
  const verb = await page.evaluate(() => document.querySelector('[data-answered="q1"] [data-answer-verbatim]')?.textContent);
  await page.locator('[data-amend="q1:yes"]').click();
  await page.waitForTimeout(200);
  const am = await page.evaluate((k) => ({ rec: JSON.parse(localStorage.getItem(k)).state.escalations.t14?.safetyCheck?.answers?.q1?.value, shown: document.querySelector('[data-answered="q1"] [data-answer-value]')?.textContent, pressed: document.querySelector('[data-amend="q1:yes"]')?.getAttribute("aria-pressed") }), KEY);
  check(/^“Have you wished/.test(verb ?? "") && am.rec === "yes" && am.shown === "Yes" && am.pressed === "true", "amend in the expanded group: verbatim shown, the answer changed on the record", JSON.stringify({ verb: verb?.slice(0, 20), ...am }));
  await page.screenshot({ path: `${OUT}/05-question-first.png`, clip: await page.locator('[data-slot="chat-rail"]').boundingBox() });

  console.log("\n── 7 · the review ledger");
  await page.locator('[data-yes-no="q6b:no"]').click();
  await page.waitForTimeout(300);
  const led = () =>
    page.evaluate(() => {
      const l = document.querySelector("[data-review-ledger]");
      return {
        risk: l?.querySelector("[data-review-risk]")?.textContent.replace(/\s+/g, " ").trim(),
        rows: [...(l?.querySelectorAll("[data-answered]") ?? [])].map((r) => `${r.dataset.answered}:${r.querySelector("[data-answer-value]")?.textContent}`),
        full: /Have you/.test(l?.innerText ?? ""),
        note: !!l?.querySelector('[data-exchange-field="mentor-summary"]'),
        submit: !!l?.querySelector('[data-exchange-primary="submit-assessment"]'),
        card: !!document.querySelector("[data-assessment-active]"),
      };
    });
  const r0 = await led();
  check(r0.risk === "Assessment suggests: High risk" && !r0.card, "every question answered: the ledger, with the computed risk at the top", JSON.stringify(r0));
  check(r0.rows.length === 7 && r0.rows.includes("q6b:No") && !r0.full && r0.note && r0.submit, "six short-label rows + the follow-up row, the note, Submit — no full question text by default", JSON.stringify(r0.rows));
  await page.locator('[data-answered="q6"] > button').click();
  await page.locator('[data-amend="q6:no"]').click();
  await page.waitForTimeout(250);
  await page.locator('[data-answered="q1"] > button').click();
  await page.locator('[data-amend="q1:no"]').click();
  await page.waitForTimeout(250);
  const r1 = await led();
  check(r1.risk === "Assessment suggests: Low risk" && r1.rows.length === 6 && !r1.rows.some((x) => x.startsWith("q6b")), "amending in review recomputes the risk live, and drops Q6's follow-up", JSON.stringify(r1));
  await page.screenshot({ path: `${OUT}/06-review-ledger.png`, clip: await page.locator('[data-slot="chat-rail"]').boundingBox() });
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
