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
//  12  (Phase 3) While you're with them: one Support door, the supervisor's
//      echo, Ava's nudges (never clinical, never sent, never stored), the
//      steadying line
//  13  (Phase 4) the close arc: the only toast, Overview, the tier cell's
//      arrival — and the mentor's same toast, once
//  14  (Phase 4) a sent assessment question's corner glyph opens the
//      assessment; a nudge carries no origin
//  15  (Phase 4) History: date groups, one row anatomy, the compressed card
//      (no arrows), two-line clamps — on both hosts
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
  if (path.startsWith("/app/chat") && !(await page.locator("[data-care-panel]").count())) {
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
      /* RETARGETED (Care Hero v7.0): the hero sits inside the CareHero root,
         under the identity strip — the root is the panel's first child. */
      heroFirst: panel?.firstElementChild?.matches("[data-care-hero-root]") && panel.firstElementChild.contains(hero) && hero.previousElementSibling?.matches("[data-care-identity]"),
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
      /* Top-level history rows only — an escalation card's own audit rows are inside it. */
      recent: [...document.querySelectorAll("[data-care-recent] [data-history-row]")].filter((r) => !r.parentElement.closest("[data-history-row]")).length,
    };
  });

// ── 1–2 · STEADY, AT TIER 4 AND AT TIER 2 ──────────────────────────────────
console.log("\n── 1 · steady: the Teen Status card");
for (const [label, extra] of [["Tier 4", {}], ["Tier 2", T2]]) {
  const { ctx, page } = await open("/app/chat/t14", { extra });
  const m = await measure(page);
  check(m.heroKind === "steady" && m.heroFirst && m.tabsAfterHero, `${label}: the Teen Status card is the hero, above the tabs`, JSON.stringify({ k: m.heroKind, f: m.heroFirst, t: m.tabsAfterHero }));
  /* RETARGETED (Care Hero v7.0, superseding v5.0 Supersession 5): the
     mentor's card anchors on the Mentorship, then the Risk tier — and the
     diagnosis is still not in the DOM at all. */
  check(m.cells.join("|") === "The mentorship|Risk tier" && !(await page.evaluate(() => !!document.querySelector("[data-care-brief]"))), `${label}: the mentor sees the Mentorship, then Risk tier — no diagnosis in the DOM`, m.cells.join(" · "));
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
  /* (pack v5.0, D1) "A, then B": arrow chains are retired. */
  check(/^Up next: .+, then Close & follow-up$/.test(t.path ?? "") && !/→/.test(t.path ?? "") && t.lock, "it reads “Up next: …, then Close & follow-up”, with the lock — no arrows", String(t.path));
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
      question: card?.querySelector('[data-zone="ask"] [data-question-text]')?.textContent.trim(),
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
  /* RETARGETED (pack v6.1): the answered rows are the accordion's own rows. */
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-acc-row][data-acc-state="answered"]')].map((r) => ({ id: r.dataset.accRow, label: r.querySelector("[data-acc-label]")?.textContent.trim() })));
  check(rows.length >= 1 && rows.every((r) => r.label && !/^Have you/.test(r.label) && !/…/.test(r.label)), "answered rows carry the short label, not a cut question", rows.map((r) => r.label).join(" · "));
  /* (pack v6.1) Tap an answered row: it re-opens with the question verbatim. */
  await page.locator(`[data-acc-row="${rows[0]?.id}"] > button`).click();
  await page.waitForTimeout(200);
  const verb = await page.evaluate((id) => document.querySelector(`[data-acc-panel="${id}"] [data-question-text]`)?.textContent.trim(), rows[0]?.id);
  check(verb === "“Have you wished you were dead or wished you could go to sleep and not wake up?”", "expanded, the question VERBATIM", String(verb));
  check(t.cut.length === 0, "nothing in the timeline is ellipsised", t.cut.join(" | "));
  await page.screenshot({ path: `${OUT}/03-question-card.png` });

  /* ── WAITING: answer everything no, submit — the mentor waits ── */
  for (let i = 0; i < 8; i++) {
    const no = page.locator('[data-yes-no$=":no"]').first();
    if (!(await no.count())) break;
    await no.click();
    /* The record-and-advance breath (pack v6.1). */
    await page.waitForTimeout(400);
  }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Probe: Jordan is talking, no plan.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(500);
  const w = await timeline(page);
  check(w.variant === "waiting" && !w.pulse && w.breath === "6s", "submitted: the mentor's current node is WAITING — it breathes on a 6s cycle, no pulse", JSON.stringify({ v: w.variant, p: w.pulse, b: w.breath }));
  check(w.cut.length === 0, "and still nothing ellipsised", w.cut.join(" | "));

  /* ── 12 · WHILE YOU'RE WITH THEM (Phase 3) ── */
  const CLINICAL = /\b(suicid\w*|kill\w*|die|dying|dead|death|harm\w*|safe(ty)?|plan\w*|risk\w*|assess\w*|crisis|emergency|911|988|hospital|diagnos\w*|therap\w*|medic\w*|pills?)\b/i;
  const mod = () =>
    page.evaluate(() => {
      const m = document.querySelector("[data-waiting-module]");
      const ink = (() => { const e = document.createElement("span"); e.style.color = "var(--text-primary)"; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; })();
      return {
        title: document.querySelector('[data-node-state="current"] [data-node-title]')?.textContent.trim(),
        door: !!m?.querySelector("[data-waiting-open-support]"),
        heroDoor: !!document.querySelector("[data-timeline-support]"),
        holderInHero: /has this/.test(document.querySelector("[data-care-hero]")?.textContent ?? ""),
        echo: m?.querySelector('[data-quote="supervisor-echo"] figcaption')?.textContent.trim(),
        label: m?.querySelector("#nudges-label")?.textContent.trim(),
        nudges: [...(m?.querySelectorAll("[data-nudge]") ?? [])].map((n) => ({ id: n.dataset.nudge, text: n.querySelector("span")?.textContent.trim(), used: n.dataset.nudgeUsed === "true" })),
        steady: m?.querySelector("[data-steadying]")?.textContent.trim(),
        presence: document.querySelector("[data-hero-presence]")?.textContent.trim() ?? null,
        filled: [...(document.querySelector("[data-care-panel]")?.querySelectorAll("button, a") ?? [])].filter((b) => getComputedStyle(b).backgroundColor === ink).length,
      };
    });
  const m0 = await mod();
  /* RETARGETED (pack v5.0, Supersessions 1–2). */
  check(m0.title === "Brandy has this. Stay with Jordan." && !m0.holderInHero, "the holder's one home is the waiting node's title, not the hero", JSON.stringify({ t: m0.title, hero: m0.holderInHero }));
  check(!m0.door && m0.heroDoor, "one Support door: the hero's ghost button, in this state too", JSON.stringify({ door: m0.door, hero: m0.heroDoor }));
  check(/^Brandy, /.test(m0.echo ?? ""), "the supervisor’s latest Support message, quote-framed and attributed", String(m0.echo));
  check(m0.label === "Suggested by Ava" && m0.nudges.length >= 2 && m0.nudges.length <= 3, "2–3 nudges, labelled Suggested by Ava", `${m0.label} · ${m0.nudges.length}`);
  check(m0.nudges.every((n) => !CLINICAL.test(n.text ?? "")), "no nudge is clinical", m0.nudges.map((n) => n.text).join(" | "));
  check(m0.nudges.some((n) => n.id === "home") && m0.nudges.some((n) => n.id === "tired"), "grounded in what Jordan said: home, and tired", m0.nudges.map((n) => n.id).join());
  check(m0.filled === 0, "waiting holds no filled button", String(m0.filled));
  const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
  await page.locator('[data-nudge="home"]').click();
  await page.waitForTimeout(300);
  const after = await page.evaluate((k) => ({ box: document.querySelector('[data-slot="composer"] textarea')?.value ?? null, store: localStorage.getItem(k) }), KEY);
  const m1 = await mod();
  const home = m0.nudges.find((n) => n.id === "home")?.text;
  check(after.box === home && m1.nudges.find((n) => n.id === "home")?.used, "a nudge fills the message box and marks itself used", JSON.stringify({ box: after.box?.slice(0, 30), used: m1.nudges.find((n) => n.id === "home")?.used }));
  check(JSON.parse(after.store).state.chatMessages?.length === JSON.parse(before).state.chatMessages?.length && !after.store.includes(home ?? "§"), "nothing is sent, and the nudge is in no record", "");
  await page.waitForTimeout(12_500);
  const m2 = await mod();
  check(!!m0.steady && !!m2.steady && m2.steady !== m0.steady && !CLINICAL.test(m2.steady), "the steadying line rotates", `${m0.steady} → ${m2.steady}`);
  await page.screenshot({ path: `${OUT}/04-waiting-module.png` });
  await page.locator("[data-timeline-support]").click();
  await page.waitForTimeout(500);
  const m3 = await mod();
  check(m3.presence === "Brandy is here", "Support open: the hero says Brandy is here", JSON.stringify({ p: m3.presence }));
  await ctx.close();
}
{
  /* Supervisor S0: the mentor is assessing — the supervisor's node waits. */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active" });
  const t = await timeline(page);
  check(t.variant === "waiting" && t.breath === "6s", "supervisor S0: assessment in progress is a WAITING node", JSON.stringify({ v: t.variant, b: t.breath }));
  check(t.rows === 1 && /^Up next: Confirm tier, then .*Close & follow-up$/.test(t.path ?? ""), "and the path starts at Confirm tier", String(t.path));
  await ctx.close();
}
{
  /* Supervisor, T2 confirmed, mid-note: completed note rows wrap, never cut. */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  const t = await timeline(page);
  /* RETARGETED (pack v6.1): a completed section is a row in the note's
     accordion, its summary on the row's second line. */
  const sub = await page.evaluate(() => [...document.querySelectorAll('[data-note-row][data-note-state="complete"] [data-note-summary]')].map((s) => s.textContent.trim()));
  check(t.cut.length === 0 && t.variant === "action" && t.pulse, "a supervisor's note step is an ACTION node, and nothing is ellipsised", JSON.stringify({ cut: t.cut, v: t.variant }));
  check(sub.length >= 1, "a completed note section states its summary on a second line, whole", sub.join(" | "));
  await ctx.close();
}

// ── 13–15 · THE CLOSE ARC, THE GLYPH, HISTORY (Phase 4) ────────────────────
console.log("\n── 4 · the close arc, the glyph, History (Phase 4)");
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.textContent.trim()));
let assessed;
{
  /* The mentor asks Q3 in chat and sends it; answers no; submits. */
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active" });
  for (let i = 0; i < 2; i++) { await page.locator('[data-yes-no$=":no"]').first().click(); await page.waitForTimeout(400); }
  const q = await page.evaluate(() => document.querySelector("[data-assessment-active]")?.dataset.assessmentActive);
  await page.locator("[data-assessment-wording]").click();
  await page.waitForTimeout(200);
  await page.locator('[data-slot="composer"] textarea').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const glyph = await page.evaluate((q) => { const g = document.querySelector(`[data-asked-from-assessment="${q}"]`); return g ? { name: g.textContent.trim(), tag: g.tagName, w: g.getBoundingClientRect().width } : null; }, q);
  const rec = await page.evaluate((k) => (JSON.parse(localStorage.getItem(k)).state.chatMessages.t13 ?? []).at(-1), KEY);
  check(!!glyph && glyph.tag === "BUTTON" && /^Assessment question \d — open the assessment$/.test(glyph.name), "a sent assessment question wears the corner glyph — a named button", JSON.stringify(glyph));
  check(rec?.origin?.kind === "assessment" && rec.origin.questionId === q, "the sent line carries its origin on the record, append-only", JSON.stringify(rec?.origin));
  await page.locator('[data-rail-tab="assist"]').click();
  await page.waitForTimeout(200);
  await page.locator(`[data-asked-from-assessment="${q}"]`).click();
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ rail: document.querySelector('[data-rail-tab][aria-selected="true"]')?.dataset.railTab, tab: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab, node: !!document.querySelector('[data-node="assessment"]') }));
  check(back.rail === "care" && back.tab === "overview" && back.node, "the glyph opens the assessment: Care, Overview, its node", JSON.stringify(back));
  for (let i = 0; i < 8; i++) { const no = page.locator('[data-yes-no$=":no"]').first(); if (!(await no.count())) break; await no.click(); await page.waitForTimeout(400); }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Probe: talking, no plan.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(500);
  /* A nudge, sent: no origin, no glyph. */
  await page.locator('[data-nudge="here"]').click();
  await page.locator('[data-slot="composer"] textarea').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const nudged = await page.evaluate((k) => (JSON.parse(localStorage.getItem(k)).state.chatMessages.t13 ?? []).at(-1), KEY);
  check(/still here with you/.test(nudged?.text ?? "") && !nudged.origin, "a sent nudge is the mentor's own line — no origin", JSON.stringify({ t: nudged?.text?.slice(0, 24), o: nudged?.origin }));
  check((await toasts(page)).length === 0, "no toast anywhere before a close", (await toasts(page)).join(" | "));
  assessed = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
  await ctx.close();
}
let closed;
{
  /* The supervisor adjusts to Tier 3 at S1 — a standard tier update closes it. */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active", extra: { escalations: assessed.escalations, tierEvents: assessed.tierEvents, chatMessages: assessed.chatMessages } });
  await page.locator('[data-s1-tier="3"]').click();
  await page.locator('[data-exchange-primary="confirm-tier"]').click();
  await page.waitForTimeout(350);
  const t = await toasts(page);
  const arc = await page.evaluate(() => ({ state: document.querySelector("[data-care-panel]")?.dataset.careState, tab: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab, arriving: !!document.querySelector("[data-tier-cell].tier-cell-arrive"), tier: document.querySelector("[data-tier-cell]")?.dataset.tier }));
  check(t.length === 1 && t[0] === "Escalation closed · Jordan moves to Tier 3 Medium risk", "close: ONE toast, the pack's words", t.join(" | "));
  check(arc.state === "steady" && arc.tab === "overview" && arc.tier === "3", "the panel settles on Overview, steady, at Tier 3", JSON.stringify(arc));
  check(arc.arriving, "and the tier cell arrives — one beat", JSON.stringify(arc));
  await page.screenshot({ path: `${OUT}/05-close-arc.png` });
  await page.waitForTimeout(1800);
  check(!(await page.evaluate(() => !!document.querySelector("[data-tier-cell].tier-cell-arrive"))), "…and settles: the highlight is gone after the beat");
  closed = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
  await ctx.close();
}
{
  /* The mentor reads the closed summary: the same toast, once. */
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active", extra: { escalations: closed.escalations, tierEvents: closed.tierEvents, escalationHistory: closed.escalationHistory, chatMessages: closed.chatMessages } });
  const t = await toasts(page);
  check(t.length === 1 && t[0] === "Escalation closed · Jordan moves to Tier 3 Medium risk", "the mentor gets the same toast, on first seeing the summary", t.join(" | "));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  check((await toasts(page)).length === 0, "and never again for this escalation", (await toasts(page)).join(" | "));
  await ctx.close();
}
{
  /* HISTORY, chat host: Imani (t21) carries a closed escalation with history. */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  await page.locator('[data-care-tab="history"]').click();
  await page.waitForTimeout(250);
  const h = await page.evaluate(() => {
    const root = document.querySelector("[data-care-tabpanel] [data-tier-history]");
    const rows = [...(root?.querySelectorAll("[data-history-row]") ?? [])].filter((r) => !r.parentElement.closest("[data-history-row]"));
    return {
      days: [...(root?.querySelectorAll("[data-history-day]") ?? [])].map((d) => d.dataset.historyDay),
      rows: rows.length,
      gutters: [...new Set(rows.map((r) => Math.round(r.querySelector("[data-history-time]").getBoundingClientRect().right)))].length,
      times: rows.map((r) => r.querySelector("[data-history-time]").textContent.trim()),
      arrows: /→/.test(root?.textContent ?? ""),
      stages: root?.querySelector("[data-story-stages]")?.textContent ?? null,
    };
  });
  check(h.days.length >= 1 && h.days.every((d) => /^(Today|Yesterday|[A-Z][a-z]{2} \d{1,2}(, \d{4})?)$/.test(d)), "History is grouped by day: Today · Yesterday · Oct 7", h.days.join(" · "));
  check(h.rows >= 2 && h.gutters === 1 && h.times.every((t) => /^\d{1,2}:\d{2} [AP]M$/.test(t)), "one row anatomy: one gutter column, the time only (the header holds the day)", JSON.stringify({ g: h.gutters, t: h.times }));
  check(!h.arrows, "the arrow chain is retired", String(h.stages));
  await ctx.close();
}
{
  /* HISTORY, record host — the same component, the same anatomy; and a long
     reason clamps to two lines with Show more. */
  const LONG = "Probe: placed after a long conversation with the family about the move, the new school, and how the weekends have been going since the summer — a reason long enough to clamp.";
  const BR = { id: "s-brandy", name: "Brandy", role: "supervisor" };
  const { ctx, page } = await open("/admin/person/t21?tab=care", { persona: "supervisor", extra: { tierEvents: [{ id: "probe-long", teenId: "t21", at: Date.now() - 2 * 3600e3, kind: "placed", tier: 3, fromTier: 2, actor: BR, reason: LONG }] } });
  const r = await page.evaluate(() => {
    const root = document.querySelector("[data-record-tier-history] [data-tier-history]");
    const row = root?.querySelector('[data-history-entry="placed"]');
    const reason = row?.querySelector("[data-history-reason]");
    const lh = reason ? parseFloat(getComputedStyle(reason).lineHeight) : 0;
    return { days: root?.querySelectorAll("[data-history-day]").length ?? 0, clamp: reason ? getComputedStyle(reason).webkitLineClamp : null, lines: reason ? Math.round(reason.getBoundingClientRect().height / lh) : 0, more: !!row?.querySelector("[data-history-more]"), story: !!root?.querySelector("[data-escalation-story] [data-story-stages]"), arrows: /→/.test(root?.textContent ?? "") };
  });
  check(r.days >= 1 && r.story && !r.arrows, "the record renders the same grouped History and the same compressed card", JSON.stringify(r));
  check(r.clamp === "2" && r.lines <= 2 && r.more, "a long Placed reason clamps to two lines, with Show more", JSON.stringify(r));
  await page.locator('[data-history-entry="placed"] [data-history-more]').first().click();
  const open2 = await page.evaluate(() => { const x = document.querySelector('[data-history-entry="placed"] [data-history-reason]'); return { clamp: getComputedStyle(x).webkitLineClamp, label: document.querySelector('[data-history-entry="placed"] [data-history-more]')?.textContent.trim() }; });
  check(open2.clamp === "none" && open2.label === "Show less", "Show more reveals the whole reason", JSON.stringify(open2));
  await page.screenshot({ path: `${OUT}/06-record-history.png` });
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
