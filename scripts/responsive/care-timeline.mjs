// ═══════════════════════════════════════════════════════════════════════════
// CARE PANEL & ESCALATION TIMELINE (pack v3.0) — the report's measurements
//
//   1  red concentration, per lens, per tier state (Workstream F3)
//   2  exactly one current node, in every scenario state, both lenses
//   3  contrast: node states, the resolved chip, the neutral tier selection
//   4  keyboard and screen reader: Care tabs, timeline traversal, the
//      current node's announcement
//   5  the squint test: mentor and supervisor, raise → assess → confirm →
//      note → close, screenshotted side by side
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-timeline";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "active-mentorship", extra = {}, theme, width = 1512 } = {}) {
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
  if (theme) await ctx.addInitScript((t) => localStorage.setItem("somethings.theme", t), theme);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);

/* ── RED, BY REGION ── Every rendered element whose text, fill or border
   computes to an alert-family colour, attributed to the region it sits in. */
const redCensus = (page) =>
  page.evaluate(() => {
    const probe = (v) => { const e = document.createElement("span"); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c.slice(4, -1).replace(/\s/g, ""); };
    const reds = ["--t1", "--t1-ink", "--t1-soft", "--t2", "--t2-ink", "--t2-soft", "--alert-critical-accent", "--alert-critical-fg", "--alert-critical-bg"].map(probe);
    const isRed = (c) => { const m = c.replace(/\s/g, "").match(/\d+,\d+,\d+/); return !!m && reds.includes(m[0]); };
    const region = (el) =>
      el.closest('[data-slot="status-banner"]') ? "banner"
      : el.closest("[data-care-dot]") ? "rail dot"
      /* RETARGETED (pack v8.0): the dot is the Escalation review tab's. */
      : el.closest("[data-review-dot]") ? "review dot"
      : el.closest("[data-tier-lozenge]") ? "T1–2 lozenge"
      : el.closest("[data-risk-chip]") ? "risk chip"
      /* (pack v5.0, C1) The chat list's shield: alert ink on Tiers 1–2 only. */
      : el.closest("[data-row-escalation]") ? "list shield"
      : el.closest('[data-slot="event-chip"]') ? "thread chip"
      : el.closest("[data-slot=\"chat-rail\"]") ? "rail · other"
      : el.closest('[data-anno-ref="app-rail"]') ? "nav"
      : el.closest('[role="list"][aria-label^="Conversation with"]') ? "thread · other"
      : "other";
    const counts = {};
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest("[data-record-avatar]")) continue; // identity tints, not status
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none") continue;
      if (![s.color, s.backgroundColor, s.borderTopColor, s.borderLeftColor].some(isRed)) continue;
      /* One per OBJECT: a lozenge's span and its text count once. */
      const owner = el.closest("[data-tier-lozenge],[data-risk-chip],[data-care-dot],[data-review-dot],[data-slot=\"event-chip\"],button,a,li") ?? el;
      if (seen.has(owner)) continue;
      seen.add(owner);
      const k = region(el);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  });

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
const contrast = (page, rows) =>
  page.evaluate(([ENGINE, rows]) => {
    eval(ENGINE);
    const { rgba, ratio, bgOf } = window.__c;
    return rows.map(([name, sel, kind]) => {
      const el = document.querySelector(sel);
      if (!el) return { name, r: null };
      const s = getComputedStyle(el);
      if (kind === "border") return { name, r: Math.round(ratio(rgba(s.borderTopColor), bgOf(el.parentElement)) * 100) / 100, need: 3 };
      return { name, r: Math.round(ratio(rgba(s.color), bgOf(el)) * 100) / 100, need: parseFloat(s.fontSize) >= 24 ? 3 : 4.5 };
    });
  }, [ENGINE, rows]);

/* ── A FULL ARC, DRIVEN THROUGH THE REAL UI, returning the store at each step ── */
async function answerAll(page) {
  for (const id of ["q3:yes", "q4:no", "q5:no", "q6:no"]) {
    await page.locator(`[data-yes-no="${id}"]`).click();
    /* The record-and-advance breath (pack v6.1) before the next row opens. */
    await page.waitForTimeout(400);
  }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Jordan has a plan but no means tonight; aunt is on her way.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(400);
}
async function noteThrough(page, ids) {
  const steps = {
    subtype: async () => { await page.locator('[data-choice="subtype:suicidal_ideation"]').click(); },
    "safety-plan": async () => { await page.locator('[data-choice="safety-plan:created"]').click(); await page.locator('[data-exchange-field="safety-usage"]').fill("Text her aunt."); },
    resources: async () => { await page.locator('[data-yes-no="resources:no"]').click(); },
    referral: async () => { await page.locator('[data-yes-no="referral:no"]').click(); },
    emergency: async () => { await page.locator('[data-yes-no="contact:no"]').click(); await page.locator('[data-yes-no="services:no"]').click(); },
  };
  for (const id of ids) {
    /* RETARGETED (pack v11.0, Supersession 5): the deck — open the row's
       card if it is not the active one, fill it, Record section. The
       record goes to the SESSION DRAFT; the store holds the note only once
       it is submitted (atomic, §6.6). */
    if (!(await page.locator(`[data-deck-card="${id}"]`).count())) await page.locator(`[data-deck-open="${id}"]`).click();
    await steps[id]();
    await page.locator(`[data-record-section="${id}"]`).click();
    await page.waitForTimeout(300);
  }
}

// ── 1 + 2 · RED CONCENTRATION, AND ONE CURRENT NODE, IN EVERY STATE ──────
console.log("\n── 1 · red concentration per lens per tier state · 2 · one current node");
const STATES = [];
{
  /* Build the record's arc once, as the real UI writes it. */
  const m = await open("/app/chat/t13", { chat: "escalation-active" });
  STATES.push(["Tier 1 · mid-assessment", await store(m.page)]);
  await answerAll(m.page);
  STATES.push(["Tier 1 · assessment sent", await store(m.page)]);
  await m.ctx.close();
  const s = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active", extra: { escalations: STATES[1][1].escalations, tierEvents: STATES[1][1].tierEvents } });
  await s.page.locator('[data-tier-cta=confirm]').click();
  await s.page.waitForTimeout(400);
  STATES.push(["Tier 1 · confirmed", await store(s.page)]);
  await noteThrough(s.page, ["subtype", "safety-plan", "resources", "referral"]);
  STATES.push(["Tier 1 · note in progress", await store(s.page)]);
  await noteThrough(s.page, ["emergency"]);
  /* Nothing in this note auto-tags, so the supervisor chooses. */
  /* RETARGETED (pack v6.1): Outcome and Debrief are the note's last rows;
     saving Emergency opened Outcome. */
  await s.page.locator('[data-choice="outcome:stabilized"]').click();
  await s.page.locator('[data-record-section="outcome"]').click();
  await s.page.waitForTimeout(300);
  STATES.push(["Tier 1 · outcome chosen", await store(s.page)]);
  await s.page.locator('[data-exchange-field="plan"]').fill("Check in daily this week.");
  await s.page.locator('[data-record-section="debrief"]').click();
  await s.page.waitForTimeout(300);
  /* RETARGETED (pack v11.0 §6.6): the one atomic write. Before it, the
     "in progress" / "outcome chosen" states above read the same stored
     record as "confirmed" — the draft is the author's until Submit. */
  await s.page.locator('[data-exchange-primary="submit-crisis-note"]').click();
  await s.page.waitForTimeout(600);
  STATES.push(["Tier 1 · debrief saved", await store(s.page)]);
  await s.page.locator('[data-exchange-primary="close-escalation"]').click();
  await s.page.waitForTimeout(400);
  STATES.push(["Tier 1 · closed", await store(s.page)]);
  await s.ctx.close();
}
for (const [label, st] of STATES) {
  for (const persona of ["mentor", "supervisor"]) {
    const { ctx, page } = await open("/app/chat/t13", { persona, chat: "escalation-active", extra: { escalations: st.escalations, tierEvents: st.tierEvents, escalationHistory: st.escalationHistory, chatEvents: st.chatEvents } });
    const x = await page.evaluate(() => ({ cur: [...document.querySelectorAll('[data-node-state="current"]')].map((n) => n.dataset.node), exchange: !!document.querySelector("[data-exchange]") }));
    const lens = persona === "mentor" ? "mentor" : "supervisor";
    /* RETARGETED (pack v8.0): a closed record is the closed summary in BOTH
       lenses now — one current node, the summary, until dismissed. */
    check(x.cur.length === 1 && (!label.endsWith("closed") || x.cur[0] === "closed"), `${lens} · ${label}: exactly one current node${label.endsWith("closed") ? " — the closed summary" : ""}`, x.cur.join(",") || "—");
    if (lens === "mentor" && !label.endsWith("closed")) {
      const red = await redCensus(page);
      const allowed = new Set(["banner", "rail dot", "review dot", "T1–2 lozenge", "thread chip", "list shield"]);
      const stray = Object.keys(red).filter((k) => !allowed.has(k));
      check(stray.length === 0, `mentor · ${label}: red only in the banner, the dots, T1–2 lozenges (and the live raise chip)`, JSON.stringify(red));
    }
    await ctx.close();
  }
}
{
  /* Tier 2 and Tier 3, the other tier states. */
  for (const [label, chat, path, raise] of [["Tier 2 · confirmed (fixture)", "escalation-tier2", "/app/chat/t13", null], ["Tier 3 · raised", "active-mentorship", "/app/chat/t14", "3"]]) {
    for (const persona of ["mentor", "supervisor"]) {
      let extra = {};
      if (raise) {
        const r = await open(path, { chat });
        await r.page.locator('[data-rail-tab="care"]').click();
        await r.page.locator('[data-tier-action="escalate"]').click();
        await r.page.locator(`[data-tier-row="${raise}"]`).click();
        await r.page.locator("[data-tier-field=note]").fill("Worried about school this week.");
        await r.page.locator("[data-tier-cta=raise]").click();
        await r.page.waitForTimeout(500);
        const st = await store(r.page);
        extra = { escalations: st.escalations, tierEvents: st.tierEvents };
        await r.ctx.close();
      }
      const { ctx, page } = await open(path, { persona, chat, extra });
      const cur = await page.evaluate(() => [...document.querySelectorAll('[data-node-state="current"]')].map((n) => n.dataset.node));
      check(cur.length === 1, `${persona} · ${label}: exactly one current node`, cur.join(","));
      if (persona === "mentor") {
        const red = await redCensus(page);
        const allowed = new Set(["banner", "rail dot", "review dot", "T1–2 lozenge", "thread chip", "list shield"]);
        const stray = Object.keys(red).filter((k) => !allowed.has(k));
        const tier3 = label.startsWith("Tier 3");
        check(stray.length === 0 && (!tier3 || Object.keys(red).length === 0), `mentor · ${label}: ${tier3 ? "no red at all" : "red only where the canon allows"}`, JSON.stringify(red));
      }
      await ctx.close();
    }
  }
}

// ── 3 · CONTRAST, BOTH THEMES ────────────────────────────────────────────
console.log("\n── 3 · contrast: node states, the resolved chip, the neutral selection");
for (const theme of ["light", "dark"]) {
  const s = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2", theme });
  const r1 = await contrast(s.page, [
    ["current node title", '[data-node-state="current"] [data-node-title]'],
    ["completed node title", '[data-node-state="completed"] button span'],
    ["completed node time", '[data-node-state="completed"] [data-node-time]'],
    ["upcoming condition", '[data-node-state="upcoming"] [data-node-condition]'],
    ["current glyph ring (UI)", "[data-node-pulse]", "border"],
    ["header meta", "[data-timeline-meta]"],
  ]);
  await s.ctx.close();
  /* The neutral pre-selection: S1, the requested tier chosen. */
  const seed = STATES[1][1];
  const c = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active", theme, extra: { escalations: seed.escalations, tierEvents: seed.tierEvents } });
  const r2 = await contrast(c.page, [
    /* RETARGETED (amendment v10.1): the selected card — its filled lozenge
       and its name on the tier's legend wash, and the ink ring. */
    ["selected tier card · filled lozenge", '[data-tier-row][data-tier-checked="true"] [data-tier-lozenge]'],
    ["selected tier card · name on its wash", '[data-tier-row][data-tier-checked="true"] [data-tier-lozenge] + span'],
    ["selected tier card · ring (UI)", '[data-tier-row][data-tier-checked="true"]', "border"],
  ]);
  await c.ctx.close();
  const last = STATES.at(-1)[1];
  const m = await open("/app/chat/t13", { chat: "escalation-active", theme, extra: { escalations: last.escalations, tierEvents: last.tierEvents, escalationHistory: last.escalationHistory, chatEvents: last.chatEvents } });
  const r3 = await m.page.evaluate(([ENGINE]) => {
    eval(ENGINE);
    const { rgba, ratio, bgOf } = window.__c;
    const chip = [...document.querySelectorAll('[data-slot="event-chip"]')].find((c) => /closed the escalation/.test(c.innerText));
    const t = chip?.querySelector("span") ?? chip;
    const sage = (() => { const e = document.createElement("span"); e.style.backgroundColor = "var(--band-sage-bg)"; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; })();
    return [{ name: "resolved chip (sage)", r: t ? Math.round(ratio(rgba(getComputedStyle(t).color), bgOf(t)) * 100) / 100 : null, need: 4.5, green: !!chip && [chip, ...chip.querySelectorAll("*")].some((el) => getComputedStyle(el).backgroundColor === sage) }];
  }, [ENGINE]);
  check(r3[0].green, `${theme} · the close chip is green-family (sage), the arc's calm end`, String(r3[0].green));
  await m.ctx.close();
  for (const x of [...r1, ...r2, ...r3]) check(x.r !== null && x.r >= x.need, `${theme} · ${x.name}`, x.r === null ? "not found" : `${x.r}:1 (needs ${x.need})`);
}

// ── 4 · KEYBOARD AND SCREEN READER ───────────────────────────────────────
console.log("\n── 4 · keyboard: Care tabs, timeline traversal, the live announcement");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  /* Tab order: the Care tablist is one stop, then the panel. */
  await page.locator('[data-care-tab="escalation"]').focus();
  const stops = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    stops.push(await page.evaluate(() => { const a = document.activeElement; const node = a?.closest("[data-node]")?.dataset.node; return a?.dataset.careTab ? `tab:${a.dataset.careTab}` : node ? `node:${node}` : a?.closest("[data-timeline-header]") ? "header" : a?.tagName.toLowerCase(); }));
  }
  check(!stops.some((s) => s?.startsWith("tab:")), "the Care tablist is a single tab stop (arrows move within it)", stops.slice(0, 3).join(" → "));
  const nodeStops = stops.filter((s) => s?.startsWith("node:"));
  const domOrder = await page.evaluate(() => [...document.querySelectorAll("[data-node]")].map((n) => `node:${n.dataset.node}`));
  const order = nodeStops.filter((s, i) => nodeStops.indexOf(s) === i);
  check(order.every((s, i) => i === 0 || domOrder.indexOf(s) > domOrder.indexOf(order[i - 1])), "Tab walks the timeline in visual order — the current card, then completed nodes downward", order.join(" → "));
  const live = await page.evaluate(() => ({ role: document.querySelector("[data-timeline-live]")?.getAttribute("role"), live: document.querySelector("[data-timeline-live]")?.getAttribute("aria-live"), text: document.querySelector("[data-timeline-live]")?.textContent }));
  /* RETARGETED (pack v6.1): the current node is the one Crisis note, its
     title carrying the progress. */
  /* RETARGETED (pack v11.0 §6): the node's title is "Crisis note" — the
     deck states its own progress, from the draft. */
  check(live.role === "status" && live.live === "polite" && live.text === "Now: Crisis note", "the current node is announced politely: “Now: Crisis note”", JSON.stringify(live));
  /* Saving a section moves the count, and the accordion announces the save. */
  /* RETARGETED (pack v11.0 §6): recording a section moves the deck's
     count and the deck announces it; the node holds still. */
  if (!(await page.locator('[data-deck-card="safety-plan"]').count())) await page.locator('[data-deck-open="safety-plan"]').click();
  await page.locator('[data-choice="safety-plan:maintained"]').click();
  await page.locator('[data-record-section="safety-plan"]').click();
  await page.waitForTimeout(300);
  const live2 = await page.evaluate(() => ({ now: document.querySelector("[data-timeline-live]")?.textContent, saved: document.querySelector("[data-deck-live]")?.textContent, progress: document.querySelector("[data-deck-progress]")?.textContent }));
  check(live2.now === "Now: Crisis note" && live2.saved === "Safety plan recorded · 2 of 6 sections recorded" && live2.progress === "2 of 6 sections recorded", "and the deck moves with the record: “Safety plan recorded · 2 of 6 sections recorded”", JSON.stringify(live2));
  const fresh = await page.evaluate(() => [...document.querySelectorAll("[data-node-fresh]")].map((n) => n.closest("[data-node]").dataset.node));
  check(fresh.length === 0, "a section save settles no timeline node — the note completes once, as one node", fresh.join(","));
  const exp = await page.locator('[data-node="assessment"] button[aria-expanded]').first().getAttribute("aria-expanded");
  check(exp === "false", "completed nodes are disclosure buttons, collapsed by default");
  await ctx.close();
  /* Reduced motion: the pulse becomes a static ring. */
  const rm = await b.newContext({ viewport: { width: 1512, height: 1000 }, reducedMotion: "reduce" });
  await rm.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, { state: { persona: "mentor", chatScenarioId: "escalation-active" }, version: VERSION }]);
  const rp = await rm.newPage();
  await rp.goto(`${BASE}/app/chat/t13`, { waitUntil: "networkidle" });
  await rp.waitForTimeout(1000);
  const pulse = await rp.evaluate(() => { const s = getComputedStyle(document.querySelector("[data-node-pulse]")); return { anim: s.animationName, ring: s.boxShadow }; });
  check(pulse.anim === "none" && pulse.ring !== "none", "reduced motion: no pulse animation, a static emphasised ring instead", JSON.stringify(pulse));
  await rm.close();
}

// ── 5 · THE SQUINT TEST ──────────────────────────────────────────────────
console.log("\n── 5 · squint test: both lenses, raise → assess → confirm → note → close");
for (const [i, [label, st]] of [[0, STATES[0]], [1, STATES[1]], [2, STATES[2]], [3, STATES[3]], [4, STATES.at(-1)]].entries()) {
  for (const persona of ["mentor", "supervisor"]) {
    const { ctx, page } = await open("/app/chat/t13", { persona, chat: "escalation-active", extra: { escalations: st[1].escalations, tierEvents: st[1].tierEvents, escalationHistory: st[1].escalationHistory, chatEvents: st[1].chatEvents } });
    await page.locator("[data-chat-hub]").screenshot({ path: `${OUT}/squint-${i + 1}-${persona}.png` });
    await ctx.close();
  }
  console.log(`  · ${label[1] ?? st[0]}: squint-${i + 1}-{mentor,supervisor}.png`);
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
