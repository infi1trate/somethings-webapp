// ═══════════════════════════════════════════════════════════════════════════
// CARE PANEL & ESCALATION — ELEVATION (pack v4.0) — Phase 1 measurements
//
//   1  surfaces: chat on the base, the Care body one step deeper (s1), cards
//      lightest (raised) — and the tint confined to the tier lozenge
//   2  exactly one emphasis: the current node is the only element that is
//      raised AND ringed; its ring is alert-family on Tiers 1–2 only
//   3  one filled button per panel state, per lens
//   4  the Care control: first, labelled, behind a divider
//   5  the tab bar: one row, underlined, sideways scroll, arrow keys
//   6  the hero above the tabs, on every tab; "notified" is the banner's
//      alone; presence is the hero's alone
//   7  steady Overview: the two newest History rows and View history →
//   8  (Phase 2) the future is one collapsed "Up next" path row
//   9  (Phase 2) Action vs Waiting current nodes: pulse vs a 6s breath
//  10  (Phase 2) the truncation audit: nothing in the timeline ellipsised;
//      answered rows carry a short label, the question verbatim on expand
//  11  (Phase 2) the two-zone question card
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-elevation";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "active-mentorship", extra = {}, width = 1512 } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 } });
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
  if (!(await page.locator("[data-care-panel]").count())) {
    await page.locator('[data-rail-tab="care"]').click();
    await page.waitForTimeout(300);
  }
  return { ctx, page };
}

/* A Tier 2 placement on Sam (t14), with no escalation: the steady hero at an
   alert tier — the case where TierCard used to wash the whole card. */
const BRANDY = { id: "s-brandy", name: "Brandy", role: "supervisor" };
/* Two placements on top of the fixture's intake: three History rows, so
   "the two newest" is a real cut. */
const T2 = {
  tierEvents: [
    { id: "probe-t3", teenId: "t14", at: Date.now() - 20 * 864e5, kind: "placed", tier: 3, fromTier: 4, actor: BRANDY, reason: "Probe: a Tier 3 placement." },
    { id: "probe-t2", teenId: "t14", at: Date.now() - 3 * 864e5, kind: "placed", tier: 2, fromTier: 3, actor: BRANDY, reason: "Probe: a Tier 2 placement." },
  ],
};

/* Everything measured in one pass, in the page. */
const measure = (page) =>
  page.evaluate(() => {
    const tok = (v) => { const e = document.createElement("span"); e.style.background = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; };
    const col = (v) => { const e = document.createElement("span"); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const panel = document.querySelector("[data-care-panel]");
    const body = document.querySelector("[data-care-surface]");
    const hero = panel?.querySelector("[data-care-hero]");
    const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
    /* Raised AND ringed: a raised fill and a box-shadow carrying a 1px spread ring. */
    const raised = tok("--surface-raised");
    const ringed = [...(panel?.querySelectorAll("*") ?? [])].filter((el) => {
      const s = getComputedStyle(el);
      return s.backgroundColor === raised && /0px 0px 0px 1px/.test(s.boxShadow);
    });
    const ink = col("--text-primary");
    const filled = [...(panel?.querySelectorAll("button, a") ?? [])].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && getComputedStyle(el).backgroundColor === ink;
    });
    /* Whole-card wash: any element in the steady hero, other than the lozenge
       and its own children, painted a tier tint. */
    const tints = ["--t1-soft", "--t2-soft", "--t1", "--t2"].map(tok);
    const washed = hero?.matches('[data-care-hero="steady"]')
      ? [hero, ...hero.querySelectorAll("*")].filter((el) => !el.closest("[data-tier-lozenge]") && tints.includes(getComputedStyle(el).backgroundColor)).length
      : null;
    const rail = document.querySelector('[role="tablist"][aria-label="Conversation tools"]');
    const tabs = [...document.querySelectorAll("[data-care-tab]")];
    const sel = document.querySelector('[data-care-tab][aria-selected="true"]');
    const tabRow = document.querySelector("[data-care-tabs]");
    const banner = document.querySelector('[data-slot="status-banner"]');
    return {
      /* The chat's own surface is the thread card — the base the panel steps
         down from. (The app canvas behind it is a different layer.) */
      canvasBg: bg(document.querySelector('[data-slot="chat-thread"]')),
      base: tok("--surface-card"),
      bodyBg: bg(body), s1: tok("--surface-s1"),
      heroKind: hero?.dataset.careHero ?? null,
      heroBg: bg(hero), raised,
      heroFirst: panel?.firstElementChild === hero,
      tabsAfterHero: !!panel?.children[1]?.querySelector("[data-care-tabs]"),
      ringed: ringed.map((el) => el.dataset.nodeCard !== undefined ? `node:${el.dataset.nodeAccent}` : el.tagName),
      ringColor: ringed[0] ? getComputedStyle(ringed[0]).boxShadow : null,
      alertRing: tok("--alert-critical-border"), neutralRing: tok("--border-default"),
      filled: filled.map((el) => el.textContent.trim()),
      washed,
      cells: [...(hero?.querySelectorAll("[data-overline]") ?? [])].map((o) => o.textContent.trim()),
      careFirst: rail?.firstElementChild?.dataset.railTab === "care",
      careLabel: rail?.firstElementChild?.textContent.trim(),
      divider: !!rail?.querySelector('[data-rail-tab="care"] + [data-rail-divider]'),
      tabTops: [...new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top)))].length,
      underline: sel ? getComputedStyle(sel).borderBottomColor === ink && getComputedStyle(sel).borderBottomWidth === "2px" : false,
      unselUnderline: tabs.filter((t) => t !== sel).every((t) => getComputedStyle(t).borderBottomColor === "rgba(0, 0, 0, 0)"),
      overflowX: tabRow ? getComputedStyle(tabRow).overflowX : null,
      fade: !!document.querySelector("[data-care-tabs-fade]"),
      pill: tabs.some((t) => parseFloat(getComputedStyle(t).borderTopLeftRadius) > 4),
      notifiedInPanel: /notified/i.test(panel?.textContent ?? ""),
      notifiedInBanner: banner ? /notified/i.test(banner.textContent) : null,
      presence: document.querySelectorAll("[data-hero-presence]").length,
      strip: document.querySelectorAll("[data-rail-presence]").length,
      recent: document.querySelectorAll("[data-care-recent] [data-tier-history] > *").length,
    };
  });

// ── 1–2 · STEADY, AT TIER 4 AND AT TIER 2 ──────────────────────────────────
console.log("\n── 1 · steady: the Teen Status card");
for (const [label, extra] of [["Tier 4", {}], ["Tier 2", T2]]) {
  const { ctx, page } = await open("/app/chat/t14", { extra });
  const m = await measure(page);
  check(m.heroKind === "steady" && m.heroFirst && m.tabsAfterHero, `${label}: the Teen Status card is the hero, above the tabs`, JSON.stringify({ k: m.heroKind, f: m.heroFirst, t: m.tabsAfterHero }));
  check(m.cells.join("|") === "Clinical diagnosis|Risk tier", `${label}: two cells — Clinical diagnosis · Risk tier`, m.cells.join(" · "));
  check(m.heroBg === m.raised && m.bodyBg === m.s1 && m.canvasBg === m.base && m.s1 !== m.raised, `${label}: the thread on the base, the Care body one step deeper (s1), the card raised`, `${m.canvasBg} · ${m.bodyBg} · ${m.heroBg}`);
  check(m.washed === 0, `${label}: no whole-card wash — the tint lives in the lozenge alone`, String(m.washed));
  check(m.ringed.length === 0, `${label}: steady has no current step, so nothing is raised AND ringed`, m.ringed.join());
  check(m.filled.length === 0, `${label}: steady holds no filled button (the tier actions are outlined)`, m.filled.join(" · "));
  check(m.recent > 0 && m.recent <= 2, `${label}: Overview shows at most the two newest History rows`, String(m.recent));
  if (label === "Tier 2") check(m.recent === 2, "with three on file, Overview shows exactly two", String(m.recent));
  if (label === "Tier 4") {
    check(m.careFirst && m.careLabel === "Care" && m.divider, "the Care control is first, labelled, behind a divider", JSON.stringify({ f: m.careFirst, l: m.careLabel, d: m.divider }));
    check(m.tabTops === 1 && m.underline && m.unselUnderline && !m.pill, "the Care tabs: one row, the selected tab underlined 2px in the ink, no pills", JSON.stringify({ rows: m.tabTops, u: m.underline, pill: m.pill }));
    check(m.overflowX === "auto" && m.fade, "on overflow the row scrolls sideways under an edge fade", JSON.stringify({ o: m.overflowX, f: m.fade }));
    /* Keyboard: the arrows move selection along the one row. */
    await page.locator('[data-care-tab="overview"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("End");
    const k = await page.evaluate(() => ({ sel: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab, focus: document.activeElement?.dataset.careTab }));
    check(k.sel === "history" && k.focus === "history", "→ then End lands on History, selected and focused", JSON.stringify(k));
    const h = await measure(page);
    check(h.heroKind === "steady", "and the hero holds across tabs", String(h.heroKind));
    await page.locator('[data-care-tab="overview"]').click();
    await page.locator("[data-care-view-history]").click();
    await page.waitForTimeout(200);
    check((await page.evaluate(() => document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab)) === "history", "View history → opens the History tab");
  }
  await page.screenshot({ path: `${OUT}/01-steady-${label.replace(" ", "")}.png` });
  await ctx.close();
}

// ── 2–3 · THE ESCALATION, BOTH LENSES ──────────────────────────────────────
console.log("\n── 2 · an escalation: one emphasis, one filled button");
for (const [label, persona, chat] of [
  ["mentor · T1 requested", "mentor", "escalation-active"],
  ["supervisor · T1 requested", "supervisor", "escalation-active"],
  ["supervisor · T2 confirmed", "supervisor", "escalation-tier2"],
]) {
  const { ctx, page } = await open("/app/chat/t13", { persona, chat });
  const m = await measure(page);
  check(m.heroKind === "escalation" && m.heroFirst && m.tabsAfterHero, `${label}: the escalation hero, above the tabs`, JSON.stringify({ k: m.heroKind, f: m.heroFirst }));
  check(m.ringed.length === 1 && m.ringed[0] === "node:alert" && m.ringColor?.includes(m.alertRing.replace(/\)$/, "")), `${label}: exactly one raised + ringed element — the current node, alert-ringed at Tier 1–2`, `${m.ringed.join()} · ${m.ringColor}`);
  check(m.filled.length <= 1, `${label}: at most one filled button in the panel`, m.filled.join(" · ") || "none");
  check(!m.notifiedInPanel && m.notifiedInBanner !== false, `${label}: "notified" is the banner's alone`, JSON.stringify({ panel: m.notifiedInPanel, banner: m.notifiedInBanner }));
  check(m.strip === 0, `${label}: no presence strip in the rail header`, String(m.strip));
  await page.screenshot({ path: `${OUT}/02-${label.replace(/[^a-z0-9]+/gi, "-")}.png` });
  await ctx.close();
}
{
  /* A Tier 3 raise: the current node's ring is NEUTRAL. */
  const { ctx, page } = await open("/app/chat/t14");
  await page.locator('[data-tier-action="escalate"]').click();
  await page.waitForTimeout(300);
  const raising = await measure(page);
  check(raising.filled.length <= 1, "raising: at most one filled button", raising.filled.join(" · ") || "none");
  await page.locator('[data-raise-option="3"]').click();
  await page.locator("[data-raise-note]").fill("Probe: a Tier 3 raise.");
  await page.locator('[data-raise-confirm]').click();
  await page.waitForTimeout(600);
  const m = await measure(page);
  check(m.ringed.length === 1 && m.ringed[0] === "node:neutral", "Tier 3: the one emphasis keeps a neutral ring — alert is Tiers 1–2 only", m.ringed.join());
  await ctx.close();
}

// ── 8–11 · TIMELINE CRAFT AND THE QUESTION CARD (Phase 2) ──────────────────
console.log("\n── 3 · the timeline (Phase 2)");
const timeline = (page) =>
  page.evaluate(() => {
    const x = document.querySelector("[data-exchange]");
    const up = x?.querySelector("[data-up-next]");
    const toggle = up?.querySelector("[data-up-next-toggle]");
    const steps = up?.querySelector("[data-up-next-steps]");
    const cur = x?.querySelector('[data-node-state="current"]');
    /* Anything in the timeline drawn with an ellipsis, or clipped. */
    const cut = [...(x?.querySelectorAll("*") ?? [])].filter((el) => {
      const s = getComputedStyle(el);
      return el.getClientRects().length && s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth;
    }).map((el) => el.textContent.trim().slice(0, 40));
    const breath = cur?.querySelector(".node-breath");
    return {
      rows: x?.querySelectorAll("[data-up-next]").length ?? 0,
      first: x?.querySelector("[data-timeline]")?.firstElementChild?.matches("[data-up-next]") ?? false,
      path: x?.querySelector("[data-up-next-path]")?.textContent.trim() ?? null,
      expanded: toggle?.getAttribute("aria-expanded"),
      hidden: steps ? steps.hidden : null,
      lock: !!up?.querySelector("svg"),
      conditions: [...(steps?.querySelectorAll("[data-node-condition]") ?? [])].map((c) => c.textContent.trim()),
      strayUpcoming: [...(x?.querySelectorAll('[data-node-state="upcoming"]') ?? [])].filter((n) => !n.closest("[data-up-next]")).length,
      variant: cur?.querySelector("[data-node-card]")?.dataset.nodeVariant ?? null,
      pulse: !!cur?.querySelector("[data-node-pulse]"),
      breath: breath ? getComputedStyle(breath).animationDuration : null,
      cut,
    };
  });
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active" });
  const t = await timeline(page);
  check(t.rows === 1 && t.first && t.strayUpcoming === 0, "the future is ONE row, at the top of the timeline", JSON.stringify({ rows: t.rows, first: t.first, stray: t.strayUpcoming }));
  check(/^Up next: .+ → Close$/.test(t.path ?? "") && t.lock, "it reads “Up next: … → Close”, with the lock", String(t.path));
  check(t.expanded === "false" && t.hidden === true, "collapsed by default", JSON.stringify({ e: t.expanded, h: t.hidden }));
  await page.locator("[data-up-next-toggle]").click();
  const t2 = await timeline(page);
  check(t2.expanded === "true" && t2.hidden === false && t2.conditions.length >= 2 && t2.conditions.every((c) => / · /.test(c)), "expanded, each step shows with its condition", t2.conditions.join(" | "));
  check(t.variant === "action" && t.pulse && !t.breath, "the mentor's assessment is an ACTION node: it pulses", JSON.stringify({ v: t.variant, p: t.pulse }));

  /* ── THE QUESTION CARD ── */
  const q = await page.evaluate(() => {
    const card = document.querySelector("[data-assessment-active]");
    const zones = [...(card?.querySelectorAll("[data-zone]") ?? [])];
    const tok = (v) => { const e = document.createElement("span"); e.style.background = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; };
    const ans = card?.querySelector('[data-zone="answer"]');
    return {
      zones: zones.map((z) => z.dataset.zone),
      /* The visible label: the screen-reader-only suffix ("· Question 3 of 6") dropped. */
      labels: zones.map((z) => { const l = z.querySelector("[data-zone-label]")?.cloneNode(true); l?.querySelectorAll(".sr-only").forEach((x) => x.remove()); return l?.textContent.trim(); }),
      hint: ans?.querySelector("[data-zone-hint]")?.textContent.trim(),
      ask: card?.querySelector("[data-assessment-wording]")?.textContent.trim(),
      askInAsk: !!card?.querySelector('[data-zone="ask"] [data-assessment-wording]'),
      yesNoInAnswer: card?.querySelectorAll('[data-zone="answer"] [data-yes-no]').length,
      disabled: [...(card?.querySelectorAll("[data-yes-no]") ?? [])].some((b) => b.disabled || b.getAttribute("aria-disabled") === "true"),
      answerBg: ans ? getComputedStyle(ans).backgroundColor : null, s1: tok("--surface-s1"),
      cardBorder: card ? getComputedStyle(card).borderTopWidth : null,
      question: card?.querySelector('[data-zone="ask"] [data-question-live] p:nth-of-type(2)')?.textContent.trim(),
    };
  });
  check(q.zones.join() === "ask,answer" && q.labels[0] === "Ask Jordan" && q.labels[1] === "Jordan’s answer", "two zones: Ask Jordan, then Jordan’s answer", JSON.stringify(q.labels));
  check(q.hint === "Record what Jordan tells you." && q.yesNoInAnswer === 2 && !q.disabled, "zone 2 carries the microcopy and Yes / No — never disabled", JSON.stringify({ h: q.hint, n: q.yesNoInAnswer, d: q.disabled }));
  check(q.answerBg === q.s1 && q.cardBorder === "0px", "zone 2 is a sunken well, subordinate; no card inside the node card", JSON.stringify({ bg: q.answerBg, border: q.cardBorder }));
  check(q.askInAsk && /^Ask in chat/.test(q.ask ?? ""), "“Ask in chat” lives in zone 1", String(q.ask));
  const sentBefore = await page.evaluate((k) => (JSON.parse(localStorage.getItem(k)).state.chatMessages ?? []).length, KEY);
  await page.locator("[data-assessment-wording]").click();
  await page.waitForTimeout(300);
  const ins = await page.evaluate((k) => ({ box: document.querySelector('[data-slot="composer"] textarea')?.value ?? null, sent: (JSON.parse(localStorage.getItem(k)).state.chatMessages ?? []).length }), KEY);
  check(ins.box && q.question?.includes(ins.box) && ins.sent === sentBefore, "Ask in chat puts the question in the message box, editable — nothing is sent", JSON.stringify({ box: ins.box?.slice(0, 40), sent: ins.sent, before: sentBefore }));

  /* ── ANSWERED ROWS: short label, verbatim on expand ── */
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-answered]")].map((r) => ({ id: r.dataset.answered, label: r.querySelector("[data-answer-label]")?.textContent.trim() })));
  check(rows.length >= 1 && rows.every((r) => r.label && !/^Have you/.test(r.label) && !/…/.test(r.label)), "answered rows carry the short label, not a cut question", rows.map((r) => r.label).join(" · "));
  await page.locator(`[data-answered="${rows[0]?.id}"] button`).click();
  const verb = await page.evaluate((id) => document.querySelector(`[data-answered="${id}"] [data-answer-verbatim]`)?.textContent.trim(), rows[0]?.id);
  check(verb === "“Have you wished you were dead or wished you could go to sleep and not wake up?”", "expanded, the question VERBATIM", String(verb));
  check(t.cut.length === 0, "nothing in the timeline is ellipsised", t.cut.join(" | "));
  await page.screenshot({ path: `${OUT}/03-question-card.png` });

  /* ── WAITING: answer everything no, submit — the mentor waits ── */
  for (let i = 0; i < 8; i++) {
    const no = page.locator('[data-yes-no$=":no"]').first();
    if (!(await no.count())) break;
    await no.click();
    await page.waitForTimeout(120);
  }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Probe: Jordan is talking, no plan.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(500);
  const w = await timeline(page);
  check(w.variant === "waiting" && !w.pulse && w.breath === "6s", "submitted: the mentor's current node is WAITING — it breathes on a 6s cycle, no pulse", JSON.stringify({ v: w.variant, p: w.pulse, b: w.breath }));
  check(w.cut.length === 0, "and still nothing ellipsised", w.cut.join(" | "));
  await ctx.close();
}
{
  /* Supervisor S0: the mentor is assessing — the supervisor's node waits. */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active" });
  const t = await timeline(page);
  check(t.variant === "waiting" && t.breath === "6s", "supervisor S0: assessment in progress is a WAITING node", JSON.stringify({ v: t.variant, b: t.breath }));
  check(t.rows === 1 && /^Up next: Confirm tier → .*Close$/.test(t.path ?? ""), "and the path starts at Confirm tier", String(t.path));
  await ctx.close();
}
{
  /* Supervisor, T2 confirmed, mid-note: completed note rows wrap, never cut. */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  const t = await timeline(page);
  const sub = await page.evaluate(() => [...document.querySelectorAll("[data-node-sub]")].map((s) => s.textContent.trim()));
  check(t.cut.length === 0 && t.variant === "action" && t.pulse, "a supervisor's note step is an ACTION node, and nothing is ellipsised", JSON.stringify({ cut: t.cut, v: t.variant }));
  check(sub.length >= 1, "a completed note section states its summary on a second line, whole", sub.join(" | "));
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
