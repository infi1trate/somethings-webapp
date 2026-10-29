// ═══════════════════════════════════════════════════════════════════════════
// SUPPORT BESIDE THE HUB, measured (Figma Supervisor-Dashboard-Clean 6011:1450)
//
//   · every chat role, one layout: open Support → the list collapses, Back to
//     chats appears, the hub stays, the banner spans conversation + hub only;
//     close → list 300 · conversation · hub 360, the hub's tab kept
//   · the hub is ONE element across both layouts, never remounted
//   · the split surface: canvas card 24/4/4/24, support card 4/24/24/4, both
//     Elevation 1; support surface-raised, canvas surface-canvas
//   · the hub header: Now filled at the left (default while an escalation is
//     open), the rest 40px outlined round at the right
//   · the presence line, for a mentor and for a supervisor
//   · a supervisor watches: read-only, the observer's footer, Take over
//     inert, the mentor's lines named; the mentor pinned in Support
//   · keyboard: conversation header → hub header → support header; Esc in the
//     support composer closes the support card
//   · widths: canvas 840 while it can, support 348–420; the staff rail
//     collapses below 1280 (≤ 360ms, reduced motion instant); a drawer hub
//     below 1120; nothing scrolls sideways
//   · switching role in the dev bar without a reload keeps the one layout

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = "docs/support-panel/beside-hub";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
async function open(persona, width, opts = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 982 }, deviceScaleFactor: opts.dpr ?? 1, reducedMotion: opts.reducedMotion ?? "no-preference" });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        localStorage.removeItem("somethings.support.disclosure");
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, chatScenarioId: "escalation-active" }, version: VERSION }]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/chat/t13`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return { ctx, page };
}
const cta = (p) => p.locator("[data-support-cta]").filter({ visible: true }).first();
const toggleSupport = async (p) => {
  await cta(p).click();
  await p.waitForTimeout(500);
};
const geo = (p) =>
  p.evaluate(() => {
    const R = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return r.width ? { x: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) } : null;
    };
    return {
      layout: document.querySelector("[data-chat-layout]")?.dataset.chatLayout,
      list: R('[data-slot="conversation-list"]'),
      thread: R('[data-slot="chat-thread"]'),
      hub: R("[data-chat-hub]"),
      banner: R("[data-chat-banner]"),
      back: R('[data-slot="chat-back-to-chats"]'),
      support: R("#support-panel"),
      rail: R('[data-anno-ref="app-rail"]'),
      hscroll: document.documentElement.scrollWidth - innerWidth,
    };
  });

// ── 1 · every role: the rule ───────────────────────────────────────────────
for (const persona of ["mentor", "lead-mentor", "supervisor", "admin"]) {
  console.log(`\n── ${persona} at 1512`);
  const { ctx, page } = await open(persona, 1512, { dpr: persona === "supervisor" ? 2 : 1 });
  const c = await geo(page);
  /* ═══ A SUPERVISOR'S CHAT HAS NO LIST (pack v3.0, Workstream A) ═══ They
     arrive from Monitoring; the route is the conversation and the hub. */
  const listless = persona === "supervisor" || persona === "admin";
  /* RETARGETED (pack v9.0, Escalation Focus Mode): this fixture has an
     OPEN escalation, so the columns are equalized — the static
     300 · flex · 360 is the steady layout only. Mentor 1512: 444 · 480 · 480;
     list-less: 50/50. */
  if (listless) check(c.layout === "list" && c.list === null && Math.abs(c.hub?.w - c.thread?.w) <= 1, "closed, escalation open: no list — conversation and hub 50/50 (Focus Mode)", JSON.stringify({ list: c.list?.w, thread: c.thread?.w, hub: c.hub?.w }));
  /* RETARGETED (pack v9.1): the escalated conversation is the FOCUS VIEW —
     the list is away (its track 0), chat and Care 50/50. */
  /* RETARGETED (pack v11.0 §3.2): an even split with Care clamped 480–680
     and chat ≥ 520 — at 1512 the mentor's Care meets its 680 cap. */
  else check(c.layout === "list" && (c.list?.w ?? 0) <= 1 && c.thread?.w >= 520 && c.hub?.w >= 480 && c.hub?.w <= 680 && (Math.abs(c.hub?.w - c.thread?.w) <= 1 || c.hub?.w === 680), "closed, escalation open: the focus view — no list, chat ≥ 520, Care clamped 480–680", JSON.stringify({ list: c.list?.w, thread: c.thread?.w, hub: c.hub?.w }));
  /* RETARGETED (pack v11.0, Supersession 8): the banner lives in the
     shell's slot, from the rail's edge to the gutter — over a Support
     column too. Closed, that is conversation + hub (the list is away). */
  check(c.banner && c.banner.x === c.thread.x && Math.abs(c.banner.r - c.hub.r) <= 1, "closed: the banner spans conversation + hub, not the list", JSON.stringify({ banner: c.banner, thread: c.thread?.x, hubR: c.hub?.r }));

  /* The hub's identity and tab, before Support opens. */
  await page.locator('[data-rail-tab="timeline"]').click();
  await page.evaluate(() => (document.querySelector("[data-chat-hub]").__probe = "same-hub"));
  await toggleSupport(page);
  const o = await geo(page);
  const same = await page.evaluate(() => ({
    node: document.querySelector("[data-chat-hub]").__probe,
    tab: document.querySelector('[data-slot="chat-rail"] [role="tab"][aria-selected="true"]')?.dataset.railTab,
  }));
  check(o.layout === "beside" && o.list === null, "open: the list collapses — gone, not narrowed");
  /* RETARGETED (pack v9.1, Supersession 2): in the view the way out is the
     "← Chats" bar, so the header's Support-closing Back is not drawn; it is
     measured outside the view in §1b. */
  check(listless ? o.back === null : o.back === null && (await page.locator('[data-slot="chat-back-chats"]').count()) === 1, "in the view: no header Back — the way out is the ← Chats bar (supervisor: ← Monitoring)", JSON.stringify(o.back));
  /* RETARGETED (pack v9.0): beside an escalation the split keeps the chat
     floor — chat max(480, half), the hub the rest, never wider than chat. */
  /* RETARGETED (pack v11.0 §3.2): beside Support the room holds chat 520 ·
     Care 480 (the 800 step, v9's split, only where the shell cannot make
     room); and the banner spans to the gutter OVER the Support card. */
  check(!!o.hub && o.thread.w >= 480 && ((o.thread.w === 520 && o.hub.w === 480) || (o.hub.w <= o.thread.w)), "the hub stays: chat 520 · Care 480 beside Support (v9's split below a 1000 canvas)", `${o.thread?.w} / ${o.hub?.w}`);
  check(o.banner && o.banner.x === o.thread.x && o.banner.r >= o.support.x + 300, "the banner spans conversation, hub AND the Support card, to the gutter", JSON.stringify({ banner: o.banner, support: o.support?.x }));
  check(same.node === "same-hub" && same.tab === "timeline", "the hub never remounted, and kept its tab", JSON.stringify(same));
  check(o.hscroll <= 0, "nothing scrolls sideways", `${o.hscroll}`);

  /* RETARGETED (pack v9.1): closing Support restores chat · Care. */
  await toggleSupport(page);
  await page.waitForTimeout(300);
  const back = await geo(page);
  const kept = await page.evaluate(() => ({
    node: document.querySelector("[data-chat-hub]").__probe,
    tab: document.querySelector('[data-slot="chat-rail"] [role="tab"][aria-selected="true"]')?.dataset.railTab,
    open: document.querySelector("[data-support-slot]").dataset.open,
  }));
  /* RETARGETED (pack v9.0): restored to the Focus Mode tracks above. */
  check(kept.open === "false" && (back.list?.w ?? 0) <= 1 && back.hub?.w === c.hub?.w, "closing Support restores chat · Care — not the list", JSON.stringify({ list: back.list?.w, hub: back.hub?.w }));
  check(kept.node === "same-hub" && kept.tab === "timeline", "the hub's tab survives the round trip", JSON.stringify(kept));
  await ctx.close();
}

// ── 1b · OUTSIDE THE VIEW: the support-beside-hub rule itself ──────────────
/* Added (pack v9.1): the list-collapse and its 40px Back now act only on a
   conversation with no escalation in hand — measured there. */
{
  console.log("\n── mentor at 1512, a conversation outside the focus view");
  const { ctx, page } = await open("mentor", 1512);
  await page.goto(`${BASE}/app/chat/t14`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const c = await geo(page);
  /* RETARGETED (pack v11.0 §3.1): steady Care is 420. */
  check(c.layout === "list" && c.list?.w === 300 && c.hub?.w === 420, "closed: list 300 · conversation · hub 420", JSON.stringify({ list: c.list?.w, hub: c.hub?.w }));
  await toggleSupport(page);
  const o = await geo(page);
  check(o.layout === "beside" && o.list === null && o.back?.w === 40 && Math.abs(o.hub.w - o.thread.w) <= 1, "open: the list collapses, Back to chats 40px, conversation and hub 50/50", JSON.stringify({ list: o.list, back: o.back?.w, t: o.thread?.w, h: o.hub?.w }));
  await page.locator('[data-slot="chat-back-to-chats"]').click();
  await page.waitForTimeout(500);
  const back = await geo(page);
  /* RETARGETED (pack v11.0 §3.1): steady Care is 420. */
  check(back.list?.w === 300 && back.hub?.w === 420, "Back to chats closes Support and restores the list", JSON.stringify({ list: back.list?.w, hub: back.hub?.w }));
  await ctx.close();
}

// ── 2 · the split surface and the hub header ───────────────────────────────
{
  console.log("\n── the split surface, the hub header (mentor at 1512)");
  const { ctx, page } = await open("mentor", 1512, { dpr: 2 });
  const hdr = await page.evaluate(() => {
    /* The HUB's tabs — Care has its own tablist inside the panel now (pack v3.0). */
    const tabs = [...document.querySelectorAll('[data-slot="chat-rail"] [role="tab"][data-rail-tab]')].map((t) => {
      const r = t.getBoundingClientRect();
      const s = getComputedStyle(t);
      return { t: t.dataset.railTab, w: Math.round(r.width), h: Math.round(r.height), radius: parseFloat(s.borderTopLeftRadius), bg: s.backgroundColor, border: s.borderTopColor, selected: t.getAttribute("aria-selected"), x: Math.round(r.left), right: Math.round(r.right), name: t.textContent.trim() };
    });
    const hub = document.querySelector('[data-slot="chat-rail"]').getBoundingClientRect();
    const tok = (v, prop = "backgroundColor") => { const e = document.createElement("span"); e.style[prop === "backgroundColor" ? "background" : "color"] = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; };
    return { tabs, strong: tok("--surface-sunken-strong"), subtle: tok("--border-subtle", "color"), hubL: Math.round(hub.left), hubR: Math.round(hub.right) };
  });
  /* ═══ RETARGETED (Tiering & Escalation pack): CARE REPLACED NOW ═══ Now was
     first, alone at the left, and present only during an escalation. Care is
     persistent and fixed after Context — tabs never reorder — and is the
     default while one is open. The claims about size and fill are unchanged. */
  const care = hdr.tabs.find((t) => t.t === "care");
  /* ═══ RETARGETED (pack v4.0, Supersession 3) ═══ Care is a LABELLED control
     at the left end of the row, behind a divider, styled as a tab; the icon
     tabs keep their 40px round buttons at the right. */
  const icons = hdr.tabs.filter((t) => t.t !== "care");
  check(hdr.tabs[0]?.t === "care" && care.selected === "true" && care.bg === hdr.strong && care.h === 40 && care.w > 40 && /Care/.test(care.name), "Care is first, labelled, filled, and the default while an escalation is open", JSON.stringify(care));
  check(icons.every((t) => t.w === 40 && t.h === 40 && t.radius >= 20), "every icon tab is a 40px round button", icons.map((t) => `${t.t} ${t.w}×${t.h}`).join(" · "));
  check(hdr.tabs.filter((t) => t.t !== "care").every((t) => t.selected === "false" && t.border === hdr.subtle && t.bg === "rgba(0, 0, 0, 0)"), "the rest are outlined border-subtle");
  /* One group, at the header's right inset (16). */
  check(care.x === hdr.hubL + 16 && icons.at(-1).right === hdr.hubR - 16 && icons.slice(1).every((t, i) => t.x - icons[i].right === 8), "Care at the left inset, the icons at the right, 8 apart", `hub ${hdr.hubL}–${hdr.hubR} · care ${care.x} · last ${icons.at(-1).right}`);
  check(hdr.tabs.map((t) => t.name.replace(/, escalation open$/, "")).join() === "Care,Context,Profile,Tools,History", "named Care · Context · Profile · Tools · History", hdr.tabs.map((t) => t.name).join(" · "));
  await toggleSupport(page);
  const s = await page.evaluate(() => {
    const c = getComputedStyle(document.querySelector("[data-canvas-scroller]"));
    const a = getComputedStyle(document.querySelector("#support-panel"));
    const tok = (v) => { const e = document.createElement("span"); e.style.background = `var(${v})`; document.body.appendChild(e); const x = getComputedStyle(e).backgroundColor; e.remove(); return x; };
    return {
      canvasR: c.borderRadius, canvasShadow: c.boxShadow, canvasBg: c.backgroundColor,
      supportR: [a.borderTopLeftRadius, a.borderTopRightRadius, a.borderBottomRightRadius, a.borderBottomLeftRadius].join(" "),
      supportShadow: a.boxShadow, supportBg: a.backgroundColor,
      canvasTok: tok("--surface-canvas"), raisedTok: tok("--surface-raised"),
    };
  });
  /* RETARGETED (pack v11.0, Supersession 8): the escalation banner is the
     split surface's TOP edge now (the shell's slot, over both), so both
     cards close their top corners beneath it; the split below is v9's. */
  check(s.canvasR === "0px 0px 4px 24px", "canvas card 0 / 0 / 4 / 24 — its top under the banner", s.canvasR);
  check(s.supportR === "0px 0px 24px 4px", "support card 0 / 0 / 24 / 4 — its top under the banner", s.supportR);
  check(/rgba\(0, 0, 0, 0\.13\) 0px 3px 6px/.test(s.canvasShadow) && /rgba\(0, 0, 0, 0\.13\) 0px 3px 6px/.test(s.supportShadow), "both carry Elevation 1");
  check(s.supportBg === s.raisedTok && s.canvasBg === s.canvasTok, "support surface-raised, canvas surface-canvas", `${s.supportBg} · ${s.canvasBg}`);

  /* PRESENCE */
  await page.locator('[data-support-row="s-brandy"] [data-support-row-open]').click();
  await page.waitForTimeout(400);
  /* RETIRED (2026-10-28): presence had its single home in the escalation
     header, which is deleted — so no presence line anywhere. */
  const pres = await page.evaluate(() => ({ hero: document.querySelector("[data-hero-presence]")?.textContent.trim() ?? null, strip: !!document.querySelector("[data-rail-presence]") }));
  check(pres.hero === null && !pres.strip, "with the notified supervisor open, no presence line anywhere in the panel", JSON.stringify(pres));

  /* KEYBOARD ORDER, and Esc from the support composer */
  const order = await page.evaluate(() => {
    /* RETARGETED (pack v9.1): in the focus view the way back is the
       "← Chats" bar, first in the conversation. */
    const a = document.querySelector('[data-slot="chat-back-to-chats"], [data-slot="chat-back-chats"]');
    const h = document.querySelector('[data-slot="chat-rail"] [role="tab"][data-rail-tab][tabindex="0"]');
    const s = document.querySelector("#support-panel [data-support-back]");
    const before = (x, y) => !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { ok: before(a, h) && before(h, s) };
  });
  check(order.ok, "focus order: conversation header → hub header → support header");
  await page.locator('[data-slot="chat-rail"] [role="tab"][data-rail-tab][tabindex="0"]').focus();
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => !!document.activeElement?.closest("#support-panel"));
  }
  check(reached, "and Tab travels from the hub into the support card");
  await page.locator("[data-support-composer] textarea").focus();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check((await page.evaluate(() => document.querySelector("[data-support-slot]").dataset.open)) === "false", "Esc in the support composer closes the support card");
  await page.screenshot({ path: `${OUT}/01-mentor-closed-after-esc-1512.png` });
  await ctx.close();
}

// ── 3 · a supervisor watches ───────────────────────────────────────────────
{
  console.log("\n── supervisor at 1512, observing");
  const { ctx, page } = await open("supervisor", 1512, { dpr: 2 });
  const w = await page.evaluate(() => ({
    footer: document.querySelector('[data-slot="chat-observer"]')?.textContent.replace(/\s+/g, " ").trim(),
    takeOver: (() => { const t = document.querySelector('[data-slot="chat-take-over"]'); return t && { disabled: t.getAttribute("aria-disabled"), tab: t.getAttribute("tabindex"), title: t.getAttribute("title") }; })(),
    composer: !!document.querySelector('[data-slot="chat-thread"] textarea'),
    menu: !!document.querySelector('[data-slot="chat-thread"] [aria-label*="More"]'),
    you: [...document.querySelectorAll('[data-slot="chat-thread"] li')].some((li) => /^You\b/.test(li.textContent.trim())),
  }));
  check(/^Viewing as a supervisor\s*You are invisible to this chat\./.test(w.footer ?? ""), "the observer's footer replaces the composer", w.footer);
  check(w.takeOver?.disabled === "true" && w.takeOver.tab === "-1" && w.takeOver.title === "Coming soon.", "Take over is drawn and disabled", JSON.stringify(w.takeOver));
  check(!w.composer, "no composer: the conversation is read-only");
  check(!w.you, "the mentor's lines are the mentor's, never 'You'");
  await toggleSupport(page);
  const pin = await page.evaluate(() => document.querySelector("[data-support-pinned]")?.textContent.replace(/\s+/g, " ").trim());
  check(/^Pinned · escalation open/.test(pin ?? ""), "the observed mentor is pinned in Support while the escalation is open", pin?.slice(0, 60));
  await page.locator('[data-support-pinned] [data-support-row-open]').click();
  await page.waitForTimeout(400);
  const ws = await page.evaluate(() => ({
    pres: document.querySelector("[data-hero-presence]")?.textContent.trim(),
    role: document.querySelector("[data-support-role]")?.textContent.trim(),
    ph: document.querySelector("[data-support-composer] textarea")?.getAttribute("placeholder"),
  }));
  check(ws.pres === undefined, "no presence line (its home, the escalation header, is deleted)", String(ws.pres));
  check(ws.role === "Mentor" && !/Message The$/.test(ws.ph ?? ""), "the support header names them a Mentor, and the composer addresses them", `${ws.role} · ${ws.ph}`);
  await page.screenshot({ path: `${OUT}/02-supervisor-observing-1512.png` });
  await ctx.close();
}

// ── 4 · widths, the rail, the drawer ───────────────────────────────────────
for (const [width, expect] of [
  /* RETARGETED (pack v11.0 §3.2, answered: "collapse or remove other
     elements before Support"): on chat the staff rail yields to 72 up to
     1680 while Support is open, so the room keeps two panes — at 1512
     chat 520 · Care 480, and at 1280 (where v9 fell to the drawer) v9's
     split. The drawer is left to below 1120. */
  [1512, { two: true, rail: 72 }],
  [1440, { two: true, rail: 72, support: 348 }],
  [1280, { two: true, rail: 72 }],
  [1279, { two: true, rail: 72 }],
  [1100, { two: false, rail: 72 }],
]) {
  console.log(`\n── supervisor at ${width}, Support open`);
  const { ctx, page } = await open("supervisor", width);
  await toggleSupport(page);
  await page.waitForTimeout(300);
  const g = await geo(page);
  const drawerToggle = await page.evaluate(() => [...document.querySelectorAll("button")].some((x) => /conversation tools/i.test(x.getAttribute("aria-label") ?? "") && x.getBoundingClientRect().width > 0));
  check(g.rail?.w === expect.rail, `the staff rail is ${expect.rail}`, `${g.rail?.w}`);
  if (expect.two) {
    /* RETARGETED (pack v9.0): chat max(480, half), the hub the rest. */
    check(!!g.hub && g.thread.w >= 480 && g.hub.w <= g.thread.w && g.hub.w >= 320 && !drawerToggle, "two panes — the conversation at least 480, the hub never wider — no drawer toggle", `${g.thread?.w} / ${g.hub?.w}`);
  } else {
    check(!g.hub && drawerToggle, "too narrow for two panes (below 1120, or the chat floor), the hub is a drawer, opened from the conversation", JSON.stringify({ hub: g.hub, toggle: drawerToggle }));
  }
  check(g.support && g.support.w >= 348 && g.support.w <= 420, "support 348–420", `${g.support?.w}`);
  /* RETARGETED (pack v11.0): the room's card is chat 520 + Care 480. */
  if (width === 1512) check(g.thread.w + g.hub.w === 1000, "the room's canvas card holds 1000 (chat 520 + Care 480)", `${g.thread.w + g.hub.w}`);
  if (expect.support) check(g.support.w === expect.support, `support gives way first, to ${expect.support}`, `${g.support.w}`);
  check(g.hscroll <= 0, "nothing scrolls sideways", `${g.hscroll}`);
  await ctx.close();
}
{
  console.log("\n── the rail's motion");
  for (const rm of ["no-preference", "reduce"]) {
    const { ctx, page } = await open("supervisor", 1200, { reducedMotion: rm });
    const t = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('[data-anno-ref="app-rail"]'));
      return { prop: s.transitionProperty, dur: s.transitionDuration };
    });
    if (rm === "reduce") check(t.dur.split(",").every((d) => parseFloat(d) === 0), "reduced motion: the rail does not animate", JSON.stringify(t));
    else check(t.prop.includes("width") && parseFloat(t.dur) > 0 && parseFloat(t.dur) <= 0.36, "the rail animates its width in ≤ 360ms", JSON.stringify(t));
    await ctx.close();
  }
}

// ── 5 · switch role in the dev bar, no reload ──────────────────────────────
{
  console.log("\n── switching role without a reload");
  const { ctx, page } = await open("mentor", 1512);
  await page.evaluate(() => (window.__noReload = "still-here"));
  await toggleSupport(page);
  const seen = [];
  /* RETARGETED (2026-10-29): the Mentor button opens its front door
     (`/start/mentor`) first; the staff roles still flip in place. Mentor is
     measured after the loop: through the chooser, back to this chat. */
  for (const role of ["Lead mentor", "Supervisor", "Admin"]) {
    await page.locator("[data-dev-bar-root] button").filter({ hasText: new RegExp(`^${role}$`) }).first().click();
    await page.waitForTimeout(700);
    const s = await page.evaluate(() => ({
      persona: JSON.parse(localStorage.getItem("somethings.mentor-onboarding") ?? "{}").state?.persona,
      alive: window.__noReload,
      layout: document.querySelector("[data-chat-layout]")?.dataset.chatLayout,
      hub: !!document.querySelector("[data-chat-hub] [data-slot='chat-rail']"),
      observer: !!document.querySelector('[data-slot="chat-observer"]'),
    }));
    seen.push(`${s.persona}:${s.alive === "still-here" ? "" : "RELOADED "}${s.layout}${s.hub ? "+hub" : ""}${s.observer ? "+observer" : ""}`);
  }
  check(seen.every((x) => /beside\+hub/.test(x) && !/RELOADED/.test(x)), "every staff role, one layout, no reload", seen.join(" · "));
  const here = new URL(page.url()).pathname;
  await page.locator("[data-dev-bar-root] button").filter({ hasText: /^Mentor$/ }).first().click();
  await page.waitForURL(/\/start\/mentor/).catch(() => {});
  const chooser = new URL(page.url());
  await page.locator('[data-start-entry="existing-mentor"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/start")).catch(() => {});
  await page.waitForTimeout(800);
  const back = await page.evaluate(() => ({ path: location.pathname, persona: JSON.parse(localStorage.getItem("somethings.mentor-onboarding") ?? "{}").state?.persona, observer: !!document.querySelector('[data-slot="chat-observer"]') }));
  check(chooser.pathname === "/start/mentor" && chooser.searchParams.get("from") === here && back.path === here && back.persona === "mentor" && !back.observer, "Mentor: the chooser first, then “existing” lands back on this chat as the mentor", JSON.stringify({ chooser: chooser.pathname + chooser.search, back }));
  check(seen.filter((x) => /observer/.test(x)).map((x) => x.split(":")[0]).join() === "supervisor,admin", "and only supervisor and admin watch", seen.join(" · "));
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
