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

await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
