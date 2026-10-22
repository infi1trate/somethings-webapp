// ═══════════════════════════════════════════════════════════════════════════
// TIERING & ESCALATION (pack v1.0) — measured, against the pack's acceptance
//
//   1  Care is present for every teen, in every chat scenario
//   2  TierCard renders all five states (four tiers + the pending chip), on
//      the chat and on the record, from one store
//   3  no alert colour on a Tier 3 or 4 card, anywhere in it
//   4  the sub-sections are keyboard navigable
//   5  three entry points, one flow; the escalation opens on Confirm, with
//      exactly one banner, and survives navigation
//   6  red only in Tier 1–2 contexts: a Tier 3 raise is neutral throughout
//   7  M2: the sequential assessment — one question, verbatim, streamed, the
//      risk chip, the summary and Submit (Escalation Exchange v2.0)
//   8  S1–S4 on the same record: confirm (keyboard, reason, metadata never
//      shown) → guidance + crisis note → auto-tagged outcome + AI draft → close
//   9  M4 wrap and the one-card history · Tier 2 skips section 5 · Tier 3
//      exits at S1 · Platform safety is Mark reviewed
//  10  the record: TierCard above Worth a look, role-gated; tier history on Care
//  11  naming: no superseded tier name and no "Clinical resources", on screen
//      or in source
//  12  contrast of every tier treatment, both themes
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/tiering";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "active-mentorship", monitoring = null, extra = {}, theme, width = 1512 } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 } });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, chatScenarioId: chat, monitoringScenarioId: monitoring, ...extra }, version: VERSION }]
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
const careTab = (page) => page.locator('[data-rail-tab="care"]');
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
const tok = (page, v, prop = "color") =>
  page.evaluate(([v, prop]) => {
    const e = document.createElement("span");
    e.style[prop === "bg" ? "backgroundColor" : "color"] = `var(${v})`;
    document.body.appendChild(e);
    const c = getComputedStyle(e)[prop === "bg" ? "backgroundColor" : "color"];
    e.remove();
    return c;
  }, [v, prop]);
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
/** Every text node under `sel` against its own background. */
const contrastOf = (page, sel) =>
  page.evaluate(([ENGINE, sel]) => {
    eval(ENGINE);
    const { rgba, ratio, bgOf } = window.__c;
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!n.textContent.trim() || el.closest(".sr-only") || el.closest('[aria-hidden="true"]')) continue;
        const s = getComputedStyle(el);
        const px = parseFloat(s.fontSize);
        out.push({ t: n.textContent.trim().slice(0, 22), r: Math.round(ratio(rgba(s.color), bgOf(el)) * 100) / 100, need: px >= 24 ? 3 : 4.5 });
      }
    }
    return out;
  }, [ENGINE, sel]);
/** Does anything under `sel` compute to an alert colour? */
const alertHits = (page, sel) =>
  page.evaluate((sel) => {
    const probe = (v) => { const e = document.createElement("span"); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c.slice(4, -1); };
    const red = ["--t1", "--t2", "--t1-ink", "--t2-ink", "--alert-critical-accent", "--alert-critical-fg", "--alert-critical-bg", "--t1-soft", "--t2-soft"].map(probe);
    const hits = [];
    for (const root of document.querySelectorAll(sel))
      for (const el of [root, ...root.querySelectorAll("*")]) {
        const s = getComputedStyle(el);
        for (const c of [s.color, s.backgroundColor, s.borderTopColor]) if (red.some((x) => c.includes(x))) hits.push(`${el.tagName}.${(el.className?.baseVal ?? el.className).toString().slice(0, 40)}`);
      }
    return hits;
  }, sel);

// ── 1 · CARE FOR EVERY TEEN, EVERY SCENARIO ────────────────────────────────
console.log("\n── 1 · Care is present for every teen");
for (const chat of ["fresh-match", "active-mentorship", "activities-in-flight", "escalation-active", "escalation-tier2", "re-matched"]) {
  const { ctx, page } = await open("/app/chat", { chat });
  const list = await page.evaluate(() => [...document.querySelectorAll('[data-slot="conversation-list"] a, [data-slot="conversation-list"] [role="link"], [data-slot="conversation-list"] li')].length);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tablist"][aria-label="Conversation tools"] [role="tab"]')].map((t) => t.dataset.railTab));
  /* A second teen, by route, so "every teen" is not "the focus thread". */
  await page.goto(`${BASE}/app/chat/t18`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const tabs2 = await page.evaluate(() => [...document.querySelectorAll('[role="tablist"][aria-label="Conversation tools"] [role="tab"]')].map((t) => t.dataset.railTab));
  check(tabs[1] === "care" && tabs2[1] === "care" && list > 0, `${chat}: Care after Context, on the focus thread and on another teen`, `${tabs.join(",")} | ${tabs2.join(",")}`);
  await ctx.close();
}

// ── 2 + 3 · THE FIVE STATES, AND NO ALERT COLOUR BELOW TIER 2 ─────────────
console.log("\n── 2 · TierCard, five states, two hosts");
{
  /* The record (supervisor) for Tiers 4/3/2 and the pending chip; Tier 1 by a
     confirmation written into the store through the real dialog below (9). */
  const cases = [
    ["t14", "4", false, "T4 · General"],
    ["t19", "3", false, "T3 · Medium risk"],
    ["t21", "2", false, "T2 · High risk"],
  ];
  for (const [id, tier, pending, loz] of cases) {
    const { ctx, page } = await open(`/admin/person/${id}`, { persona: "supervisor" });
    const card = await page.evaluate(() => {
      const c = document.querySelector("[data-tier-card]");
      return c && { tier: c.dataset.tier, text: c.innerText.replace(/\s+/g, " "), pending: !!c.querySelector("[data-requested-tier]"), time: c.querySelector("[data-tier-time]")?.textContent ?? null };
    });
    check(card?.tier === tier && card.text.includes(loz) && card.pending === pending, `record ${id}: ${loz}${tier !== "4" ? ", with time in tier" : ""}`, card?.text.slice(0, 90));
    if (tier !== "4") check(!!card?.time, `  and time in tier is stated`, card?.time);
    else check(card?.time === null, "  and Tier 4 states no time in tier", String(card?.time));
    if (tier === "3" || tier === "4") {
      const hits = await alertHits(page, "[data-tier-card]");
      check(hits.length === 0, `  no alert colour anywhere on the Tier ${tier} card`, hits.slice(0, 3).join(", "));
    }
    await ctx.close();
  }
  const { ctx, page } = await open("/admin/person/t13", { persona: "supervisor", chat: "escalation-active" });
  const pend = await page.evaluate(() => {
    const c = document.querySelector("[data-tier-card]");
    return { tier: c?.dataset.tier, chip: c?.querySelector("[data-requested-tier]")?.textContent, waiting: !!c?.querySelector("[data-tier-pending]") };
  });
  check(pend.tier === "3" && pend.chip === "Requested: Tier 1" && pend.waiting, "the pending state: Tier 3 with a Requested: Tier 1 chip beside it", JSON.stringify(pend));
  await page.screenshot({ path: `${OUT}/01-record-pending.png` });
  await ctx.close();
  /* The same teen, the same store, on the chat host. */
  const c2 = await open("/app/chat/t13", { persona: "mentor", chat: "escalation-active" });
  const chatPend = await c2.page.evaluate(() => document.querySelector("[data-tier-line] [data-requested-tier]")?.textContent);
  check(chatPend === "Requested: Tier 1", "and the exchange's tier line says the same thing, from the same store", String(chatPend));
  await c2.ctx.close();
}

// ── 4 · SUB-SECTIONS, BY KEYBOARD ─────────────────────────────────────────
/* ═══ RETARGETED (pack v3.0, Workstream B) ═══ The four mid-panel sub-chips
   are five first-class tabs at the top of the panel, Overview first. */
console.log("\n── 4 · the Care tabs");
{
  const { ctx, page } = await open("/app/chat/t14");
  await careTab(page).click();
  await page.waitForTimeout(300);
  const tabs = await page.evaluate(() => ({ labels: [...document.querySelectorAll("[data-care-tab]")].map((c) => c.textContent), first: document.querySelector("[data-care-panel]")?.firstElementChild?.matches("[data-care-tabs]"), sel: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab }));
  check(tabs.labels.join("|") === "Overview|Safety plan|Emergency info|Resources|History" && tabs.first && tabs.sel === "overview", "Overview · Safety plan · Emergency info · Resources · History, at the top, on Overview", JSON.stringify(tabs));
  const sub = await page.evaluate(() => document.querySelectorAll("[data-care-sub]").length);
  check(sub === 0, "and the mid-panel sub-chips are gone", `${sub}`);
  await page.locator('[data-care-tab="overview"]').focus();
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(80);
    seen.push(await page.evaluate(() => ({ focus: document.activeElement?.dataset.careTab, sel: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab, panel: document.querySelector("[data-care-tabpanel]")?.dataset.careTabpanel })));
  }
  check(seen.map((s) => s.sel).join() === "safety-plan,emergency,resources,history" && seen.every((s) => s.focus === s.sel && s.panel === s.sel), "arrow keys move selection, focus and the panel together", JSON.stringify(seen));
  /* History → two ArrowLeft → Emergency info. */
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(100);
  const emerg = await page.evaluate(() => document.querySelector("[data-emergency-info]")?.innerText ?? "");
  check(/Not on file|Nothing shared/.test(emerg) && !/^—$/m.test(emerg), "Emergency info uses designed unavailable states, never a bare dash", emerg.slice(0, 60));
  await ctx.close();
}

// ── 5 · THREE ENTRY POINTS, ONE FLOW ──────────────────────────────────────
console.log("\n── 5 · three entry points, one flow");
const DOORS = {
  care: async (page) => {
    await careTab(page).click();
    await page.locator('[data-tier-action="escalate"]').click();
  },
  kebab: async (page) => {
    await page.locator('button[aria-label^="More options for"]').click();
    await page.waitForTimeout(200);
    await page.getByRole("menuitem", { name: "Raise an escalation" }).click();
  },
  message: async (page) => {
    const bubble = page.locator('[role="list"][aria-label^="Conversation with"] > li[id^="msg-"]').nth(1);
    await bubble.hover();
    await page.waitForTimeout(150);
    await bubble.locator('button[aria-label="React to this message"]').click();
    await page.waitForTimeout(150);
    await page.locator('button[aria-label="Raise an escalation about this message"]').click();
  },
};
async function raiseVia(page, door, tier, note = "They said they are not okay tonight.") {
  await DOORS[door](page);
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => ({ flow: !!document.querySelector("[data-raise-flow]"), banner: !!document.querySelector('[data-slot="status-banner"]'), care: document.querySelector('[data-rail-tab="care"]')?.getAttribute("aria-selected") }));
  if (tier === "platform") {
    /* A platform concern is not a tier (pack v3.0, Supersession 3): the quiet
       link below the tiers opens its own report. */
    await page.locator("[data-raise-platform]").click();
    await page.locator("[data-platform-note]").fill(note);
    await page.locator("[data-platform-send]").click();
  } else {
    await page.locator(`[data-raise-option="${tier}"]`).click();
    await page.locator("[data-raise-note]").fill(note);
    await page.locator("[data-raise-confirm]").click();
  }
  await page.waitForTimeout(600);
  return before;
}
for (const door of Object.keys(DOORS)) {
  const { ctx, page } = await open("/app/chat/t14");
  const before = await raiseVia(page, door, "2");
  const after = await page.evaluate(() => ({
    banners: document.querySelectorAll('[data-slot="status-banner"]').length,
    state: document.querySelector("[data-care-state]")?.dataset.careState,
    target: document.querySelector("[data-care-state]")?.dataset.careTarget,
    anchored: [...document.querySelectorAll('[role="list"] > li[id^="msg-"]')].some((li) => getComputedStyle(li).borderLeftWidth === "2px"),
  }));
  check(before.flow && !before.banner && before.care === "true", `${door}: opens the raise flow in Care, nothing written yet`, JSON.stringify(before));
  check(after.banners === 1 && after.state === "active" && after.target === "2", `${door}: Confirm opens it — exactly one banner, Care active`, JSON.stringify(after));
  if (door === "message") check(after.anchored, "  and the message it came from is marked");
  /* THE TIER IS A REQUEST IN THE LOG, NOT A FIELD ON THE ESCALATION. The status
     header reads the escalation's own target, so it cannot see this; the log
     can (a mutant that wrote no request survived without this check). */
  const req = (await store(page)).tierEvents.filter((e) => e.teenId === "t14").at(-1);
  check(req?.kind === "requested" && req.tier === 2 && req.actor.role === "mentor", `${door}: the raise wrote a mentor's Tier 2 request to the tier log`, JSON.stringify(req && { kind: req.kind, tier: req.tier, role: req.actor.role }));
  if (door === "care") {
    await page.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.goto(`${BASE}/app/chat/t14`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const kept = await page.evaluate(() => ({ state: document.querySelector("[data-care-state]")?.dataset.careState, banners: document.querySelectorAll('[data-slot="status-banner"]').length }));
    check(kept.state === "active" && kept.banners === 1, "  and the active state survives navigating away and back", JSON.stringify(kept));
  }
  await ctx.close();
}
{
  /* INLINE VALIDATION, NOT A DEAD BUTTON. */
  const { ctx, page } = await open("/app/chat/t14");
  await DOORS.care(page);
  await page.waitForTimeout(300);
  const enabled = await page.locator("[data-raise-confirm]").isEnabled();
  await page.locator("[data-raise-confirm]").click();
  await page.waitForTimeout(200);
  const errs = await page.evaluate(() => ({ errs: [...document.querySelectorAll("[data-raise-error]")].map((e) => e.dataset.raiseError), focus: document.activeElement?.dataset.raiseOption ?? document.activeElement?.tagName, banner: !!document.querySelector('[data-slot="status-banner"]') }));
  check(enabled && errs.errs.join() === "tier,note" && !errs.banner, "Confirm is always enabled; pressed empty it names both gaps and writes nothing", JSON.stringify(errs));
  /* Keyboard through the tier picker. */
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  const picked = await page.evaluate(() => document.querySelector('[data-raise-option][aria-checked="true"]')?.dataset.raiseOption);
  check(!!picked, "arrow keys select in the tier picker", String(picked));
  const cur = await page.evaluate(() => [...document.querySelectorAll("[data-raise-option]")].map((o) => o.dataset.raiseOption));
  check(cur.join() === "1,2,3", "the picker offers strictly Tiers 1–3 — never Tier 4, and no Platform option", cur.join(","));
  /* ═══ SOMETHING ELSE ═══ The platform concern, as a quiet link below. */
  const link = await page.evaluate(() => { const l = document.querySelector("[data-raise-platform]"); const g = document.querySelector('[data-raise-flow] [role="radiogroup"]'); return { text: l?.textContent, after: !!(l && g && g.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING), radio: l?.getAttribute("role") }; });
  check(link.text === "Something else? Report a platform concern" && link.after && link.radio === null, "below the tiers: a quiet link, not a radio, opens the platform report", JSON.stringify(link));
  await page.locator("[data-raise-platform]").click();
  await page.waitForTimeout(150);
  const rep = await page.evaluate(() => ({ form: !!document.querySelector("[data-platform-report]"), lozenge: document.querySelectorAll("[data-platform-report] [data-tier-lozenge]").length }));
  check(rep.form && rep.lozenge === 0, "its own lighter flow, with no tier in it", JSON.stringify(rep));
  await ctx.close();
  /* Jordan, Tier 3: the current tier is information, not a choice. */
  const j = await open("/app/chat/t13");
  await DOORS.care(j.page);
  await j.page.waitForTimeout(300);
  const current = await j.page.evaluate(() => { const o = document.querySelector('[data-raise-option="3"]'); return { disabled: o?.getAttribute("aria-disabled"), tag: /Current/.test(o?.innerText ?? "") }; });
  check(current.disabled === "true" && current.tag, "the teen's current tier is shown disabled, tagged Current", JSON.stringify(current));
  await j.page.screenshot({ path: `${OUT}/02-raise-flow.png` });
  await j.ctx.close();
}

// ── 6 · RED ONLY IN TIER 1–2 CONTEXTS ─────────────────────────────────────
console.log("\n── 6 · red only in Tier 1–2 contexts");
for (const tier of ["3", "platform", "1"]) {
  const { ctx, page } = await open("/app/chat/t14");
  await raiseVia(page, "care", tier);
  const st = await page.evaluate(() => ({
    tone: document.querySelector('[data-slot="status-banner"]')?.dataset.tone,
    dot: document.querySelector("[data-care-dot]")?.dataset.careDot,
    /* pack v3.0: the Overview tab carries the escalation dot too. */
    overviewDot: document.querySelector('[data-care-tab="overview"] [data-overview-dot]')?.dataset.overviewDot,
    /* The in-panel Emergency information button is gone (pack v3.0); the
       banner's Emergency info chip is the one entry, and carries the tone. */
    emergency: getComputedStyle(document.querySelector('[data-slot="banner-crisis"]')).backgroundColor,
    assessment: !!document.querySelector("[data-assessment]"),
    stage: document.querySelector("[data-exchange]")?.dataset.stage,
  }));
  const accent = await tok(page, "--alert-critical-accent", "bg");
  const alert = tier === "1";
  check(
    (st.tone === "critical") === alert && (st.dot === "alert") === alert && st.overviewDot === st.dot && (st.emergency === accent) === alert,
    `Tier ${tier}: banner, both dots and the Emergency info chip are ${alert ? "red" : "neutral"}`,
    JSON.stringify(st)
  );
  check(st.assessment === alert && st.stage === (alert ? "M2" : "M3"), `Tier ${tier}: the assessment is ${alert ? "there (M2)" : "skipped (M3)"} — Tier 1–2 only`, String(st.stage));
  if (tier !== "1") {
    const hits = await alertHits(page, "[data-care-state]");
    check(hits.length === 0, `Tier ${tier}: no alert colour anywhere in the Care panel`, hits.slice(0, 3).join(", "));
  }
  if (tier === "platform") {
    const ev = (await store(page)).tierEvents;
    check(ev.length === 0, "Platform safety writes no tier event — it never changes the clinical tier", `${ev.length}`);
  }
  await ctx.close();
}

// ── 7 · M2: THE SEQUENTIAL ASSESSMENT, ON THE TIMELINE (pack v3.0) ────────
/* ═══ RETARGETED AGAIN (Care Panel & Escalation Timeline, pack v3.0) ═══ The
   v2 baton strip, spine and tier line are one timeline now: a header that
   states every status once, then upcoming → current → completed nodes. The
   claims are the same claims; what they read moved. */
console.log("\n── 7 · M2: the mentor's assessment, as the current node");
const xs = (page) =>
  page.evaluate(() => {
    const x = document.querySelector("[data-exchange]");
    if (!x) return null;
    const nodes = [...x.querySelectorAll("[data-node]")];
    return {
      lens: x.dataset.lens,
      stage: x.dataset.stage,
      current: nodes.filter((n) => n.dataset.nodeState === "current").map((n) => n.dataset.node),
      title: x.querySelector('[data-node-state="current"] [data-node-title]')?.textContent,
      live: x.querySelector("[data-timeline-live]")?.textContent,
      done: nodes.filter((n) => n.dataset.nodeState === "completed").map((n) => n.dataset.node),
      upcoming: nodes.filter((n) => n.dataset.nodeState === "upcoming").map((n) => n.dataset.node),
      order: nodes.map((n) => n.dataset.nodeState),
      baton: !!x.querySelector("[data-baton]"),
    };
  });
/* Expand a completed node by id, and return its expanded text. */
const expandNode = async (page, id) => {
  await page.locator(`[data-node="${id}"] button[aria-expanded]`).first().click();
  await page.waitForTimeout(120);
  return page.evaluate((id) => document.querySelector(`[data-node="${id}"] [data-node-expanded]`)?.innerText ?? "", id);
};
let assessed;
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active" });
  const s0 = await page.evaluate(() => ({
    active: [...document.querySelectorAll("[data-assessment-active]")].map((q) => q.dataset.assessmentActive),
    text: document.querySelector("[data-assessment-active]")?.innerText,
    answered: [...document.querySelectorAll("[data-answered]")].map((q) => q.dataset.answered),
    progress: document.querySelector("[data-assessment-progress]")?.textContent,
    folded: !!document.querySelector("[data-assessment-active] [data-assessment-progress]"),
    placeholder: /placeholder/i.test(document.querySelector("[data-assessment]")?.innerText ?? ""),
  }));
  const x0 = await xs(page);
  check(x0?.lens === "mentor" && x0.stage === "M2" && x0.current.join() === "assessment" && !x0.baton, "mid-assessment: the assessment is the one current node — no baton banner", JSON.stringify(x0));
  check(x0?.order.join() === "upcoming,upcoming,current,completed", "upcoming on top, then the current node, then completed below", x0?.order.join());
  check(x0?.upcoming.join() === "closed,waiting" && /Supervisor closes or steps down/.test(await page.evaluate(() => document.querySelector('[data-node="closed"] [data-node-condition]')?.textContent ?? "")), "the exit is always visible, ghosted, with its condition", x0?.upcoming.join());
  check(x0?.live === "Now: Go through the assessment with Jordan", "the current node is announced in the header's live region", String(x0?.live));
  check(s0.active.join() === "q3" && s0.answered.join() === "q1,q2", "exactly one active question (Q3); Q1–Q2 collapsed above; Q4–Q6 not rendered", JSON.stringify({ a: s0.active, d: s0.answered }));
  /* Quotes normalised: the panel sets the question in typographic quotes. */
  const q3 = (s0.text ?? "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  check(q3.includes('"Have you thought about how you might do that?"') && q3.includes("I thought about pills, but I'd never actually do it."), "Q3 in the pack's wording, with its example", q3.slice(0, 80));
  check(/^2 of 6 answered · your supervisor sees each answer/.test(s0.progress ?? "") && s0.folded && !s0.placeholder, "the progress line counts six, folded into the question card", s0.progress);
  /* Put in message box: the question's own words, into the composer, unsent. */
  await page.locator('[data-assessment-wording="q3"]').click();
  await page.waitForTimeout(250);
  const comp = await page.evaluate(() => document.querySelector('[data-slot="composer"] textarea')?.value);
  check(comp === "Have you thought about how you might do that?", "Put in message box drops the verbatim question into the composer", String(comp));
  await page.locator('[data-yes-no="q3:yes"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  const streamed = (await store(page)).escalations.t13?.safetyCheck;
  const s1 = await page.evaluate(() => ({ active: document.querySelector("[data-assessment-active]")?.dataset.assessmentActive, focus: document.activeElement?.dataset.yesNo, live: document.querySelector("[data-assessment-active] [data-question-live]")?.getAttribute("aria-live") }));
  check(s1.focus === "q4:yes" && s1.live === "polite", "after Enter, focus is on Q4's Yes and Q4 is announced (polite live region)", JSON.stringify(s1));
  check(streamed?.answers?.q3?.value === "yes" && streamed.submittedAt === null, "an answer is on the record the moment it is given — before Submit", JSON.stringify(streamed?.answers?.q3));
  for (const id of ["q4:no", "q5:no", "q6:yes"]) {
    await page.locator(`[data-yes-no="${id}"]`).click();
    await page.waitForTimeout(150);
  }
  const s2 = await page.evaluate(() => ({ active: document.querySelector("[data-assessment-active]")?.dataset.assessmentActive, text: document.querySelector("[data-assessment-active]")?.innerText, submit: !!document.querySelector('[data-exchange-primary="submit-assessment"]') }));
  check(s2.active === "q6b" && /Was this within the past 3 months\?/.test(s2.text ?? "") && !s2.submit, "a Yes on Q6 asks the 3-month follow-up; no Submit yet", JSON.stringify({ ...s2, text: undefined }));
  await page.locator('[data-yes-no="q6b:no"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(200);
  const empty = await page.evaluate(() => ({ alert: document.querySelector("[data-m2] [role=alert]")?.textContent, invalid: document.querySelector('[data-exchange-field="mentor-summary"]')?.getAttribute("aria-invalid") }));
  check(!!empty.alert && empty.invalid === "true" && (await store(page)).escalations.t13.safetyCheck.submittedAt === null, "Submit with no summary names the gap and sends nothing", JSON.stringify(empty));
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Jordan has a plan involving pills and gave away her headphones yesterday.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(500);
  const x1 = await xs(page);
  const chip = await page.evaluate(() => document.querySelector('[data-node="assessment"] [data-risk-chip]')?.textContent);
  check(x1?.stage === "M3" && x1.current.join() === "waiting" && x1.done.includes("assessment") && chip === "High risk", "Submit: the assessment settles into a completed node with its risk chip; waiting is current", JSON.stringify({ ...x1, chip }));
  check(x1?.title === "Brandy has this. Stay with Jordan." && !(await page.evaluate(() => !!document.querySelector('[data-node="waiting"] [data-node-card] > :not([data-node-title])'))), "waiting says the pack's line and nothing else", String(x1?.title));
  check(await page.evaluate(() => /Reply in Support/.test(document.querySelector('[data-timeline-support="mentor"]')?.textContent ?? "")), "and Reply in Support lives in the header");
  await page.screenshot({ path: `${OUT}/03-m3-stay.png` });
  assessed = await store(page);
  await ctx.close();
}

// ── 8 · THE SUPERVISOR LENS, SAME RECORD, TIER 1 FULL PATH ────────────────
console.log("\n── 8 · the supervisor lens: assessment → confirm → the note → outcome → debrief → close");
let closed;
{
  /* S0 first: while the mentor is still assessing, progress only. */
  const z = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active" });
  const z0 = await xs(z.page);
  const prog = await z.page.evaluate(() => ({ text: document.querySelector("[data-s0-progress]")?.textContent, questions: document.querySelectorAll("[data-node-state='current'] [data-assessment-active], [data-node-state='current'] [data-s1-answer]").length }));
  check(z0?.stage === "S0" && z0.current.join() === "assessment" && prog.text === "2 of 6 answered" && prog.questions === 0, "assessment in progress: the current node is a count — no live question sprawl", JSON.stringify({ z0, prog }));
  check(z0?.upcoming.join() === "close,confirm", "and Confirm waits, ghosted, with the exit above it", z0?.upcoming.join());
  await z.ctx.close();

  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active", extra: { escalations: assessed.escalations, tierEvents: assessed.tierEvents } });
  const x0 = await xs(page);
  check(x0?.lens === "supervisor" && x0.stage === "S1" && x0.current.join() === "confirm" && x0.done.includes("assessment"), "assessment received: completed; Confirm tier is current", JSON.stringify(x0));
  const answers = await expandNode(page, "assessment");
  const risk = await page.evaluate(() => document.querySelector('[data-node="assessment"] [data-risk-chip]')?.dataset.riskChip);
  const answerRows = await page.evaluate(() => document.querySelectorAll('[data-node="assessment"] [data-s1-answer]').length);
  check(answerRows === 7 && risk === "high" && /gave away her headphones/.test(answers), "expanded, the received node holds the seven answers, High, and the summary — the same record", JSON.stringify({ answerRows, risk }));
  const note = await expandNode(page, "raised");
  check(/Jordan said/.test(note) && (await page.evaluate(() => !!document.querySelector('[data-node="raised"] [data-quote="mentor-note"] figcaption'))), "the mentor's note is quote-framed with attribution", note.slice(0, 60));
  const s1 = await page.evaluate(() => ({
    checked: document.querySelector('[data-s1-tier][aria-checked="true"]')?.dataset.s1Tier,
    tabStops: [...document.querySelectorAll("[data-s1-tier]")].filter((b) => b.tabIndex === 0).length,
    label: document.querySelector('[data-exchange-primary="confirm-tier"]')?.textContent,
    reason: document.querySelector('[data-exchange-field="confirm-reason"]')?.value,
    line: document.querySelector("[data-tier-line-text]")?.textContent,
  }));
  check(s1.checked === "1" && s1.tabStops === 1 && s1.label === "Confirm Tier 1" && !!s1.reason && s1.line === "Awaiting confirmation on tiering", "the request is pre-selected, one tab stop, a prefilled reason", JSON.stringify(s1));
  /* ═══ NEUTRAL UNTIL CONFIRMED (blocked constant) ═══ */
  const neutral = await alertHits(page, "[data-s1]");
  check(neutral.length === 0, "the tier picker and Confirm are neutral — no alert colour before the confirmation", neutral.slice(0, 3).join(", "));
  await page.locator('[data-s1-tier="1"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  const moved = await page.evaluate(() => ({ checked: document.querySelector('[data-s1-tier][aria-checked="true"]')?.dataset.s1Tier, focus: document.activeElement?.dataset.s1Tier, label: document.querySelector('[data-exchange-primary="confirm-tier"]')?.textContent }));
  check(moved.checked === "2" && moved.focus === "2" && moved.label === "Adjust to Tier 2", "ArrowRight moves focus and selection together; the button says Adjust", JSON.stringify(moved));
  await page.keyboard.press("ArrowLeft");
  await page.locator('[data-exchange-field="confirm-reason"]').fill("");
  await page.locator('[data-exchange-primary="confirm-tier"]').click();
  await page.waitForTimeout(200);
  check((await store(page)).tierEvents.length === assessed.tierEvents.length, "no reason, no event", "");
  await page.locator('[data-exchange-field="confirm-reason"]').fill("Plan and preparatory behaviour. Tier 1 while we stabilise.");
  await page.locator('[data-exchange-primary="confirm-tier"]').click();
  await page.waitForTimeout(500);
  let st = await store(page);
  const ev = st.tierEvents.at(-1);
  const e1 = st.escalations.t13;
  check(ev?.kind === "confirmed" && ev.tier === 1 && ev.actor.role === "supervisor" && e1.confirmedTier === 1 && typeof e1.confirmedAt === "number", "Confirm writes a supervisor's confirmed event and the record's confirmedTier", JSON.stringify({ kind: ev?.kind, tier: ev?.tier, c: e1.confirmedTier }));
  /* ═══ RESPONSE TIME IS RECORDED, NEVER SHOWN ═══ */
  const ms = e1.meta?.timeToConfirmMs;
  const shown = await page.evaluate((ms) => { const t = document.body.innerText; return { ms: t.includes(String(ms)), words: /time to confirm|response time|took \d|confirmed in \d/i.test(t), attr: [...document.querySelectorAll("*")].some((el) => [...el.attributes].some((a) => a.value === String(ms))) }; }, ms);
  check(typeof ms === "number" && ms > 0 && !shown.ms && !shown.words && !shown.attr, "meta.timeToConfirmMs is on the record and nowhere in the DOM", `${ms}ms · ${JSON.stringify(shown)}`);
  const s2 = await page.evaluate(() => ({ stage: document.querySelector("[data-exchange]")?.dataset.stage, line: document.querySelector("[data-tier-line-text]")?.textContent, lozenge: !!document.querySelector("[data-tier-line] .tier-settle [data-tier-lozenge]") }));
  const x2 = await xs(page);
  check(s2.stage === "S2" && /^Tier 1 confirmed by .+ · \d/.test(s2.line ?? "") && s2.lozenge, "S2: the header's chip has settled into the Tier 1 lozenge, signed and timed", JSON.stringify(s2));
  check(x2?.current.join() === "note:subtype" && x2.upcoming.join() === "close,note:safety-plan", "the note assembles as nodes: Clinical subtype is current, the next section a ghost", JSON.stringify({ cur: x2?.current, up: x2?.upcoming }));
  /* ═══ NO GUIDANCE COMPOSER (Supersession 2) ═══ */
  const g = await page.evaluate(() => ({ composer: !!document.querySelector("[data-send-guidance], [data-guidance-composer]"), link: document.querySelector('[data-timeline-support="supervisor"]')?.textContent ?? null }));
  check(!g.composer && /^Message .+ in Support/.test(g.link ?? ""), "no guidance composer — a quiet Message {mentor} in Support link instead", JSON.stringify(g));
  /* The note, node by node. */
  await page.locator('[data-crisis-continue="subtype"]').click();
  await page.waitForTimeout(100);
  check(!!(await page.evaluate(() => document.querySelector('[data-node="note:subtype"] [role=alert]'))), "Continue on an empty section names the gap");
  await page.locator('[data-choice="subtype:suicidal_ideation"]').click();
  await page.locator('[data-chip="housing"]').click();
  await page.locator('[data-crisis-continue="subtype"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-choice="safety-plan:created"]').click();
  await page.locator('[data-exchange-field="safety-usage"]').fill("Text her aunt and use the grounding steps.");
  await page.locator('[data-crisis-continue="safety-plan"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-yes-no="resources:no"]').click();
  await page.locator('[data-crisis-continue="resources"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-yes-no="referral:yes"]').click();
  await page.locator('[data-chip="therapist"]').click();
  await page.locator('[data-crisis-continue="referral"]').click();
  await page.waitForTimeout(150);
  const x5 = await xs(page);
  check(x5?.current.join() === "note:emergency" && ["note:subtype", "note:safety-plan", "note:resources", "note:referral"].every((n) => x5.done.includes(n)), "Tier 1 reaches section 5 (emergency) as the current node; 1–4 are completed nodes", JSON.stringify({ cur: x5?.current, done: x5?.done }));
  await page.locator('[data-yes-no="contact:yes"]').click();
  await page.locator('[data-exchange-field="contact-details"]').fill("Her aunt, by phone.");
  await page.locator('[data-yes-no="services:yes"]').click();
  await page.locator('[data-chip="mobile_crisis"]').click();
  await page.locator('[data-crisis-continue="emergency"]').click();
  await page.waitForTimeout(400);
  const s3 = await page.evaluate(() => ({
    current: document.querySelector('[data-node-state="current"]')?.dataset.node,
    auto: document.querySelector('[data-choice][aria-checked="true"]')?.dataset.choice,
    tagged: !!document.querySelector("[data-auto-tagged]"),
  }));
  check(s3.current === "outcome" && s3.auto === "outcome:mobile_crisis" && s3.tagged, "the outcome node: auto-tagged Mobile crisis from the note, and says so", JSON.stringify(s3));
  await page.locator('[data-exchange-primary="choose-outcome"]').click();
  await page.waitForTimeout(300);
  const s3b = await page.evaluate(() => ({ current: document.querySelector('[data-node-state="current"]')?.dataset.node, draft: !!document.querySelector("[data-ai-draft]"), debrief: document.querySelector('[data-exchange-field="debrief"]')?.value ?? "" }));
  check(s3b.current === "debrief" && s3b.draft && s3b.debrief.length > 40 && !/Tier \d|Suicidal ideation/.test(s3b.debrief), "then the debrief node: an AI draft, badged, that writes no tier or subtype", s3b.debrief.slice(0, 70));
  await page.locator('[data-exchange-field="debrief"]').fill(s3b.debrief + " Mobile crisis arrived at 7:40.");
  await page.waitForTimeout(100);
  check(!(await page.evaluate(() => !!document.querySelector("[data-ai-draft]"))), "editing the draft takes the AI badge off");
  await page.locator('[data-exchange-primary="save-outcome"]').click();
  await page.waitForTimeout(150);
  check(!(await store(page)).escalations.t13.outcome?.savedAt, "Save with no plan saves nothing");
  await page.locator('[data-exchange-field="plan"]').fill("Daily check-ins this week; therapist intake Thursday.");
  await page.locator('[data-exchange-primary="save-outcome"]').click();
  await page.waitForTimeout(400);
  st = await store(page);
  const o = st.escalations.t13.outcome;
  check(o?.id === "mobile_crisis" && o.autoTagged && o.debriefIsDraft === false && typeof o.chosenAt === "number" && typeof o.savedAt === "number" && o.savedAt >= o.chosenAt, "outcome then debrief: two writes on one record, marked as edited", JSON.stringify(o && { id: o.id, auto: o.autoTagged, draft: o.debriefIsDraft }));
  const s4 = await page.evaluate(() => ({ stage: document.querySelector("[data-exchange]")?.dataset.stage, dest: document.querySelector("[data-close-destination]")?.textContent, follow: document.querySelector('[data-follow-up][aria-checked="true"]')?.dataset.followUp }));
  const x4 = await xs(page);
  check(s4.stage === "S4" && /moves Jordan to Tier 3 Monitoring/.test(s4.dest ?? "") && s4.follow === "1" && x4.current.join() === "close" && x4.upcoming.length === 0, "close is the last current node, nothing left ahead; it names Tier 3 Monitoring", JSON.stringify(s4));
  check(["raised", "assessment", "confirm", "note:subtype", "note:emergency", "outcome", "debrief"].every((n) => x4.done.includes(n)), "every step is a completed node below it", x4.done.join(" "));
  await page.locator('[data-follow-up="1"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/04-s4-close.png` });
  await page.locator('[data-exchange-primary="close-escalation"]').click();
  await page.waitForTimeout(600);
  st = await store(page);
  const done = st.escalations.t13 ?? st.escalationHistory.find((e) => e.id === "esc-t13");
  const last = st.tierEvents.at(-1);
  check(done?.resolvedAt && done.followUp && Math.round((done.followUp.dueAt - done.resolvedAt) / 86400000) === 3, "Close files it, with the follow-up the arrow key chose (3 days)", JSON.stringify(done?.followUp));
  check(last?.kind === "stepped-down" && last.tier === 3 && last.actor.role === "supervisor", "and steps Jordan down to Tier 3, by the supervisor, on the log", JSON.stringify(last && { kind: last.kind, tier: last.tier }));
  const careNow = await page.evaluate(() => document.querySelector("[data-care-state]")?.dataset.careState);
  check(careNow === "steady", "the supervisor's Care returns to steady", String(careNow));
  closed = st;
  await ctx.close();
}

// ── 9 · THE CLOSED NODE, AND THE OTHER PATHS ──────────────────────────────
console.log("\n── 9 · the closed node · Tier 2 skips section 5 · Tier 3 exits at S1 · Platform");
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active", extra: { escalations: closed.escalations, tierEvents: closed.tierEvents, escalationHistory: closed.escalationHistory } });
  const w = await page.evaluate(() => ({ stage: document.querySelector("[data-exchange]")?.dataset.stage, outcome: document.querySelector("[data-wrap-outcome]")?.textContent, tier: [...(document.querySelector("[data-wrap-tier]")?.querySelectorAll("[data-tier-lozenge]") ?? [])].map((l) => l.dataset.tierLozenge).join("→"), next: document.querySelector("[data-wrap-next]")?.textContent, follow: document.querySelector("[data-wrap-follow-up]")?.textContent, labelOverValue: [...document.querySelectorAll("[data-wrap] dl > div")].every((d) => d.firstElementChild?.tagName === "DT" && d.lastElementChild?.tagName === "DD"), line: document.querySelector("[data-tier-line-text]")?.textContent, banner: !!document.querySelector('[data-slot="status-banner"]') }));
  const xw = await xs(page);
  check(w.stage === "M4" && xw.current.join() === "closed" && xw.upcoming.length === 0 && w.outcome === "Mobile crisis responded" && w.tier === "1→3" && /checks in with Jordan again/.test(w.next ?? "") && /^[A-Z][a-z]+day, [A-Z][a-z]{2} \d{1,2}$/.test(w.follow ?? "") && w.labelOverValue && !w.banner, "closed: a designed summary — outcome, Tier 1 → Tier 3 as lozenges, what happens next, the follow-up date; label over value", JSON.stringify(w));
  check(/^Closed .+ · Tier 1 → Tier 3 Medium risk$/.test(w.line ?? ""), "and the header states the movement, not a stale Tier 1 confirmation", String(w.line));
  /* MEASURED: the closed summary once named "Your supervisor" — the name was
     read off the OPEN escalation, and there is none once it closes. */
  const named = await page.evaluate(() => ({ next: document.querySelector("[data-wrap-next]")?.textContent ?? "", meta: document.querySelector("[data-timeline-meta]")?.textContent ?? "" }));
  check(/^Brandy checks in/.test(named.next) && /Brandy notified/.test(named.meta), "and it names the supervisor, Brandy — never \u201cYour supervisor\u201d", JSON.stringify(named));
  await page.screenshot({ path: `${OUT}/05-m4-wrap.png` });
  await page.locator('[data-exchange-primary="back-to-care"]').click();
  await page.waitForTimeout(400);
  const steadyNow = await page.evaluate(() => ({ state: document.querySelector("[data-care-state]")?.dataset.careState, tab: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab }));
  const seen = (await store(page)).escalationHistory.concat(Object.values((await store(page)).escalations)).find((e) => e.id === "esc-t13")?.wrapSeenAt;
  check(steadyNow.state === "steady" && steadyNow.tab === "overview" && typeof seen === "number", "Back to Care: Overview, steady, and the wrap is marked seen on the record", JSON.stringify({ ...steadyNow, seen }));
  /* History is its own tab now (pack v3.0). */
  await page.locator('[data-care-tab="history"]').click();
  await page.waitForTimeout(200);
  const story = await page.evaluate(() => document.querySelector("[data-escalation-story]")?.innerText.replace(/\s+/g, " "));
  check(/Raised .+→ assessed \(high risk\) → Tier 1 confirmed → mobile crisis responded → stepped down to Tier 3/.test(story ?? ""), "History tells the whole escalation in one line", story?.slice(0, 120));
  await page.locator("[data-escalation-story] > button").click();
  await page.waitForTimeout(150);
  const entries = await page.evaluate(() => [...document.querySelectorAll("[data-story-entries] [data-audit-lozenge]")].map((l) => l.textContent));
  check(["Raised", "Assessed", "Confirmed", "Crisis note", "Outcome", "Closed", "Stepped down", "Follow-up"].every((k) => entries.includes(k)) && !entries.includes("Guidance"), "expanded: every entry, each with its lozenge — and no Guidance", entries.join(" · "));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const gone = !(await page.evaluate(() => !!document.querySelector("[data-exchange]")));
  await careTab(page).click();
  await page.waitForTimeout(200);
  check(gone && (await page.evaluate(() => document.querySelector("[data-care-state]")?.dataset.careState)) === "steady", "and the wrap does not come back on reload");
  await page.screenshot({ path: `${OUT}/06-history-card.png` });
  await ctx.close();
}
{
  /* TIER 2: SECTION 5 DOES NOT EXIST. The fixture is at S2 with section 1 done. */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  const x = await xs(page);
  const chip = await page.evaluate(() => document.querySelector('[data-node="assessment"] [data-risk-chip]')?.textContent);
  check(x?.stage === "S2" && x.current.join() === "note:safety-plan" && x.done.includes("note:subtype") && chip === "Moderate risk", "Tier 2 fixture: section 1 completed, Safety plan current; the received node keeps the Moderate chip", JSON.stringify({ x, chip }));
  await page.locator('[data-choice="safety-plan:maintained"]').click();
  await page.locator('[data-crisis-continue="safety-plan"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-yes-no="resources:yes"]').click();
  await page.locator('[data-exchange-field="resources-list"]').fill("988 and the Trevor Project.");
  await page.locator('[data-crisis-continue="resources"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-yes-no="referral:no"]').click();
  await page.locator('[data-crisis-continue="referral"]').click();
  await page.waitForTimeout(350);
  const t1 = await page.evaluate(() => ({ current: document.querySelector('[data-node-state="current"]')?.dataset.node, emergency: !!document.querySelector('[data-node="note:emergency"]'), auto: document.querySelector('[data-choice][aria-checked="true"]')?.dataset.choice ?? null }));
  check(t1.current === "outcome" && !t1.emergency && t1.auto === null, "after section 4 a Tier 2 note is complete — no section 5, and nothing to auto-tag", JSON.stringify(t1));
  await ctx.close();
  const m = await open("/app/chat/t13", { chat: "escalation-tier2" });
  const mx = await xs(m.page);
  const guidance = await m.page.evaluate(() => !!document.querySelector("[data-guidance]"));
  check(mx?.stage === "M3" && mx.current.join() === "waiting" && !guidance, "the mentor's lens on the same record: waiting, and no guidance quote — coaching is in Support", JSON.stringify(mx));
  await m.ctx.close();
}
{
  /* TIER 3 AT S1 IS A STANDARD TIER UPDATE: it closes the escalation. The
     assessment must arrive first (S0) — seed it submitted. */
  const seed = { t13: { ...assessed.escalations.t13 } };
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active", extra: { escalations: seed, tierEvents: assessed.tierEvents } });
  await page.locator('[data-s1-tier="3"]').click();
  await page.waitForTimeout(100);
  const exit = await page.evaluate(() => ({ note: document.querySelector("[data-s1-exit]")?.textContent, label: document.querySelector('[data-exchange-primary="confirm-tier"]')?.textContent }));
  check(/standard tier update/.test(exit.note ?? "") && exit.label === "Adjust to Tier 3", "choosing Tier 3 says it is a standard tier update and closes", JSON.stringify(exit));
  await page.locator('[data-exchange-primary="confirm-tier"]').click();
  await page.waitForTimeout(500);
  const st = await store(page);
  const e = st.escalations.t13 ?? st.escalationHistory.find((x) => x.id === "esc-t13");
  check(e?.resolvedAt && e.outcome?.id === "tier_update" && e.confirmedTier === 3 && !e.crisisNote, "it closes at S1 with outcome tier_update — no crisis note", JSON.stringify(e && { r: !!e.resolvedAt, o: e.outcome?.id, t: e.confirmedTier }));
  await ctx.close();
}
{
  /* PLATFORM SAFETY: raised by the mentor, Mark reviewed by the supervisor, no tier event. */
  const r = await open("/app/chat/t14");
  await raiseVia(r.page, "care", "platform");
  const x = await xs(r.page);
  check(x?.stage === "M3" && x.current.join() === "waiting", "a Platform raise skips the assessment: the mentor waits at once", JSON.stringify(x));
  const raised = await store(r.page);
  await r.ctx.close();
  const { ctx, page } = await open("/app/chat/t14", { persona: "supervisor", extra: { escalations: raised.escalations, tierEvents: raised.tierEvents } });
  const p0 = await page.evaluate(() => ({ stage: document.querySelector("[data-exchange]")?.dataset.stage, current: document.querySelector('[data-node-state="current"]')?.dataset.node, radios: document.querySelectorAll("[data-s1-tier]").length, line: !!document.querySelector("[data-tier-line-text]") }));
  check(p0.stage === "S1" && p0.current === "review" && p0.radios === 0 && !p0.line, "the supervisor's review node for Platform safety: no tier picker, no tier line", JSON.stringify(p0));
  await page.locator('[data-exchange-field="review-reason"]').fill("Spam account, removed.");
  await page.locator('[data-exchange-primary="mark-reviewed"]').click();
  await page.waitForTimeout(400);
  const st = await store(page);
  const e = st.escalations.t14 ?? st.escalationHistory.find((x) => x.teenId === "t14" || x.id?.includes("t14"));
  check(!!e?.resolvedAt && st.tierEvents.length === 0, "Mark reviewed closes it and writes no tier event", JSON.stringify({ r: !!e?.resolvedAt, ev: st.tierEvents.length }));
  await ctx.close();
}
{
  /* ═══ ADD TO ESCALATION (Workstream C) ═══ The mentor attaches a message;
     both lenses see it as a quote-framed completed node; the thread marks it. */
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-tier2" });
  const li = page.locator('[role="list"][aria-label^="Conversation with"] > li[id^="msg-"]').nth(3);
  const msgText = (await li.innerText()).split("\n")[0];
  await li.hover();
  await page.waitForTimeout(150);
  await li.locator('button[aria-label="React to this message"]').click();
  await page.waitForTimeout(150);
  await page.locator('button[aria-label="Add this message to the escalation"]').click();
  await page.waitForTimeout(300);
  await page.locator("[data-moment-note]").fill("This is the line that worried me.");
  await page.locator("[data-moment-add]").click();
  await page.waitForTimeout(500);
  const mo = (await store(page)).escalations.t13?.moments?.at(-1);
  const glyph = await li.locator("[data-added-to-escalation]").count();
  check(mo?.note === "This is the line that worried me." && mo.quote.text.length > 3 && glyph === 1, "the moment is on the record with its note, and the thread marks the message", JSON.stringify(mo && { note: mo.note, quote: mo.quote.text.slice(0, 30) }));
  const node = await page.evaluate(() => [...document.querySelectorAll('[data-node-kind="moment"]')].map((n) => n.dataset.nodeState));
  check(node.join() === "completed", "on the mentor's timeline it is a completed node", node.join());
  /* Offered once per message. */
  await li.hover();
  await li.locator('button[aria-label="React to this message"]').click();
  await page.waitForTimeout(150);
  check(!(await page.locator('button[aria-label="Add this message to the escalation"]').count()), "and not offered again on the same message");
  await page.keyboard.press("Escape");
  const st = await store(page);
  await ctx.close();
  const s = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2", extra: { escalations: st.escalations, tierEvents: st.tierEvents } });
  const text = await expandNode(s.page, (await s.page.evaluate(() => document.querySelector('[data-node-kind="moment"]')?.dataset.node)) ?? "none");
  check(/This is the line that worried me/.test(text) && (await s.page.evaluate(() => !!document.querySelector('[data-node-kind="moment"] [data-quote="moment"] figcaption'))), "the supervisor sees the same moment, quote-framed with sender and time", text.slice(0, 80));
  void msgText;
  await s.ctx.close();
}

// ── 10 · THE RECORD ────────────────────────────────────────────────────────
console.log("\n── 10 · the tier on the record");
for (const [persona, expect] of [["mentor", ["escalate", "request-step-down"]], ["supervisor", ["update-tier"]], ["lead-mentor", []]]) {
  const { ctx, page } = await open("/admin/person/t19", { persona });
  const r = await page.evaluate(() => {
    const tier = document.querySelector("[data-record-tier]");
    const worth = document.querySelector('[data-record-section="worth-a-look"]') ?? document.querySelector('[data-record-section="action-required"]');
    return {
      present: !!tier,
      above: !worth || (tier && tier.compareDocumentPosition(worth) & Node.DOCUMENT_POSITION_FOLLOWING) > 0,
      actions: [...(tier?.querySelectorAll("[data-tier-action]") ?? [])].map((b) => b.dataset.tierAction),
      url: location.pathname,
    };
  });
  if (r.url.startsWith("/admin/person")) {
    check(r.present && r.above && r.actions.join() === expect.join(), `${persona}: TierCard above Worth a look, actions ${expect.join(" + ") || "none (read-only)"}`, JSON.stringify(r));
  } else {
    check(true, `${persona}: the record redirected (${r.url}) — a mentor reaches only their own mentees' records`);
  }
  await ctx.close();
}
{
  const { ctx, page } = await open("/admin/person/t21?tab=care", { persona: "supervisor" });
  const h = await page.evaluate(() => ({ section: !!document.querySelector("[data-record-tier-history]"), story: document.querySelector("[data-record-tier-history] [data-escalation-story]")?.innerText.replace(/\s+/g, " ") }));
  check(h.section && /assessed \(.+\) → Tier 1 confirmed → .+ → stepped down to Tier 2/.test(h.story ?? ""), "closed-with-history: the record carries Imani's Friday crisis as one story", h.story?.slice(0, 120));
  await page.screenshot({ path: `${OUT}/05-record-care-history.png` });
  await ctx.close();
}

// ── 11 · NAMING ────────────────────────────────────────────────────────────
console.log("\n── 11 · naming sweep");
{
  const banned = [/Tier 3 · Monitoring/, /T3 · Monitoring/, /Clinical resources/i, /Tier 2 Escalation/, /Tier 1 Crisis/];
  const pages = [["/app/monitoring", { persona: "supervisor", monitoring: "tiers-alert" }], ["/app/chat/t13", { chat: "escalation-active" }], ["/admin/person/t19", { persona: "supervisor" }]];
  for (const [path, opts] of pages) {
    const { ctx, page } = await open(path, opts);
    const text = await page.evaluate(() => document.body.innerText);
    const hit = banned.filter((re) => re.test(text)).map(String);
    check(hit.length === 0, `${path}: no superseded tier name, no "Clinical resources"`, hit.join(", "));
    await ctx.close();
  }
  /* And in source: the strings a surface could render. */
  const walk = async (dir) => (await readdir(dir, { withFileTypes: true })).flatMap((e) => (e.isDirectory() ? [] : [join(dir, e.name)])).concat(
    ...(await Promise.all((await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory() && e.name !== "__tests__").map((e) => walk(join(dir, e.name)))))
  );
  const files = (await walk("src")).filter((f) => /\.(ts|tsx)$/.test(f));
  const srcHits = [];
  for (const f of files) {
    const src = await readFile(f, "utf8");
    for (const [i, line] of src.split("\n").entries()) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (/["'`]Clinical resources["'`]|3:\s*["']Monitoring["']|["'`]Tier 3 · Monitoring/.test(line)) srcHits.push(`${f}:${i + 1}`);
    }
  }
  check(files.length > 100 && srcHits.length === 0, `source: zero rendered occurrences across ${files.length} files`, srcHits.join(", "));
}

// ── 12 · CONTRAST, BOTH THEMES ────────────────────────────────────────────
console.log("\n── 12 · contrast of every tier treatment");
for (const theme of ["light", "dark"]) {
  for (const [path, sel, what, opts] of [
    ["/app/chat/t13", "[data-exchange]", "M2 — baton strip, High risk chip, the active question", { chat: "escalation-active", high: true }],
    ["/app/chat/t13", "[data-exchange]", "S2 — baton, spine rows, Moderate risk chip, tier line", { chat: "escalation-tier2", persona: "supervisor" }],
    ["/app/chat/t13", "[data-exchange]", "M3 — baton (theirs), guidance", { chat: "escalation-tier2" }],
    ["/admin/person/t21", "[data-tier-card]", "the Tier 2 amber inset (TierCard)", { persona: "supervisor" }],
    ["/admin/person/t19", "[data-tier-card]", "Tier 3 (TierCard)", { persona: "supervisor" }],
    ["/admin/person/t14", "[data-tier-card]", "Tier 4 (TierCard)", { persona: "supervisor" }],
    ["/app/chat/t13", '[data-raise-flow], [data-slot="chat-rail"] [data-tier-lozenge]', "the raise flow's lozenges", { chat: "active-mentorship", raise: true }],
  ]) {
    const { ctx, page } = await open(path, { ...opts, theme });
    if (opts.raise) {
      await DOORS.care(page);
      await page.waitForTimeout(300);
    }
    if (opts.high) {
      await page.locator('[data-yes-no="q3:yes"]').click();
      await page.locator('[data-yes-no="q4:yes"]').click();
      await page.waitForTimeout(500);
    }
    const r = await contrastOf(page, sel);
    const low = r.filter((x) => x.r < x.need);
    check(r.length > 0 && low.length === 0, `${theme}: ${what} — every text clears AA`, low.length ? JSON.stringify(low.slice(0, 4)) : `${r.length} texts, lowest ${Math.min(...r.map((x) => x.r))}:1`);
    await ctx.close();
  }
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
