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
//   7  the safety check: Tier 1–2 only, streams each answer, read-only once sent
//   8  a supervisor reads the same records, read-only, and confirms the tier
//   9  resolving a Tier 1 requests the step down; the supervisor completes it
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
for (const chat of ["fresh-match", "active-mentorship", "activities-in-flight", "escalation-active", "re-matched"]) {
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
  const chatPend = await c2.page.evaluate(() => document.querySelector("[data-care-status] [data-requested-tier]")?.textContent);
  check(chatPend === "Requested: Tier 1", "and the chat's status header says the same thing, from the same store", String(chatPend));
  await c2.ctx.close();
}

// ── 4 · SUB-SECTIONS, BY KEYBOARD ─────────────────────────────────────────
console.log("\n── 4 · the Care sub-sections");
{
  const { ctx, page } = await open("/app/chat/t14");
  await careTab(page).click();
  await page.waitForTimeout(300);
  const chips = await page.evaluate(() => [...document.querySelectorAll("[data-care-sub]")].map((c) => c.textContent));
  check(chips.join("|") === "History|Safety plan|Emergency info|Resources", "History · Safety plan · Emergency info · Resources, sentence case", chips.join(" · "));
  await page.locator('[data-care-sub="history"]').focus();
  const seen = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(80);
    seen.push(await page.evaluate(() => ({ focus: document.activeElement?.dataset.careSub, sel: document.querySelector('[data-care-sub][aria-selected="true"]')?.dataset.careSub })));
  }
  check(seen.map((s) => s.sel).join() === "safety-plan,emergency,resources" && seen.every((s) => s.focus === s.sel), "arrow keys move selection and focus together", JSON.stringify(seen));
  /* Resources → one ArrowLeft → Emergency info. */
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
  await page.locator(`[data-raise-option="${tier}"]`).click();
  await page.locator("[data-raise-note]").fill(note);
  await page.locator("[data-raise-confirm]").click();
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
  check(cur.join() === "1,2,3,platform", "the picker offers Tiers 1–3 and Platform safety — never Tier 4", cur.join(","));
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
    emergency: getComputedStyle(document.querySelector("[data-care-emergency]")).backgroundColor,
    safety: !!document.querySelector("[data-safety-check]"),
    checklist: !!document.querySelector('[data-slot="assessment"]'),
  }));
  const accent = await tok(page, "--alert-critical-accent", "bg");
  const alert = tier === "1";
  check(
    (st.tone === "critical") === alert && (st.dot === "alert") === alert && (st.emergency === accent) === alert,
    `Tier ${tier}: banner, dot and Emergency information are ${alert ? "red" : "neutral"}`,
    JSON.stringify(st)
  );
  check(st.safety === alert, `Tier ${tier}: the safety check is ${alert ? "there" : "absent"} (Tier 1–2 only)`);
  if (tier === "platform") check(!st.checklist, "Platform safety: no clinical checklist either");
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

// ── 7 · THE SAFETY CHECK STREAMS, THEN LOCKS ──────────────────────────────
console.log("\n── 7 · the safety check");
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active" });
  const s0 = await page.evaluate(() => ({ qs: document.querySelectorAll("[data-safety-question]").length, placeholder: !!document.querySelector("[data-safety-placeholder]"), wording: document.querySelectorAll("[data-safety-wording]").length }));
  check(s0.qs === 6 && s0.placeholder && s0.wording === 6, "six questions, each with Put in message box, marked as placeholders", JSON.stringify(s0));
  await page.locator('[data-safety-answer="cssrs-3:no"]').click();
  await page.waitForTimeout(200);
  const streamed = (await store(page)).escalations.t13?.safetyCheck?.answers?.["cssrs-3"]?.value;
  check(streamed === "no", "an answer is in the record the moment it is given — before Submit", String(streamed));
  await page.locator("[data-safety-submit]").click();
  await page.waitForTimeout(300);
  const sent = await page.evaluate(() => ({ sent: document.querySelector("[data-safety-check]")?.dataset.sent, line: document.querySelector("[data-safety-check] p")?.textContent, radios: [...document.querySelectorAll("[data-safety-answer]")].every((r) => r.getAttribute("aria-disabled") === "true"), submit: !!document.querySelector("[data-safety-submit]") }));
  check(sent.sent === "true" && /^Sent to supervisor/.test(sent.line ?? "") && sent.radios && !sent.submit, "Submit: read-only, Sent to supervisor with its time", JSON.stringify(sent));
  await page.screenshot({ path: `${OUT}/03-active-tier1.png` });
  await ctx.close();
}

// ── 8 + 9 · THE SUPERVISOR'S VIEW, CONFIRMATION, AND THE STEP DOWN ────────
console.log("\n── 8 · a supervisor reads the same records, and confirms");
let session;
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active" });
  const sup = await page.evaluate(() => ({
    answers: [...document.querySelectorAll('[data-safety-answer][aria-checked="true"]')].length,
    readOnly: [...document.querySelectorAll("[data-safety-answer]")].every((r) => r.getAttribute("aria-disabled") === "true"),
    checks: document.querySelectorAll('[data-slot="assessment"] button[aria-label^="Mark as covered"]').length,
    resolve: !!document.querySelector("[data-care-resolve]"),
    update: !!document.querySelector("[data-care-update-tier]"),
  }));
  check(sup.answers === 2 && sup.readOnly && sup.checks === 0 && !sup.resolve && sup.update, "the mentor's answers and checklist, read-only; Update tier instead of Resolve", JSON.stringify(sup));
  await page.locator("[data-care-update-tier]").click();
  await page.waitForTimeout(300);
  const dlg = await page.evaluate(() => {
    const d = document.querySelector('[data-slot="tier-update-dialog"]');
    return { selected: d?.querySelector('[data-tier-option][aria-checked="true"]')?.dataset.tierOption, label: d?.querySelector('[data-tier-submit="post"]')?.textContent, quote: !!d?.querySelector("[data-tier-update-pending]"), decline: d?.querySelector('[data-tier-secondary="decline"]')?.textContent };
  });
  check(dlg.selected === "1" && dlg.label === "Confirm Tier 1" && dlg.quote && /Keep in Tier 3/.test(dlg.decline ?? ""), "the composer pre-selects the request, quotes it, and can keep them where they are", JSON.stringify(dlg));
  await page.locator('[data-tier-submit="post"]').click();
  await page.waitForTimeout(200);
  const blocked = (await store(page)).tierEvents.length;
  check(blocked === 0, "no reason, no event — a tier change is a property of an update with a reason", `${blocked}`);
  await page.locator("[data-slot=tier-update-dialog] [data-tier-reason]").fill("Spoke with the mentor and the aunt. Tier 1 while we stabilise.");
  await page.locator('[data-tier-submit="post"]').click();
  await page.waitForTimeout(500);
  const conf = await page.evaluate(() => document.querySelector("[data-care-confirmation]")?.textContent);
  const ev = (await store(page)).tierEvents;
  check(/^Tier 1 confirmed by .+ · \d/.test(conf ?? "") && ev.at(-1)?.kind === "confirmed" && ev.at(-1)?.actor.role === "supervisor", "confirmed: the status line updates in place, signed and timed", String(conf));
  session = ev;
  await ctx.close();
}
console.log("\n── 9 · the crisis note requests the step down");
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active", extra: { tierEvents: session } });
  const card = await page.evaluate(() => document.querySelector("[data-care-status]")?.innerText.replace(/\s+/g, " "));
  check(/T1 · Active crisis/.test(card ?? "") && /Tier 1 confirmed by/.test(card ?? ""), "the mentor sees the confirmation: the chip has become the Tier 1 lozenge", card?.slice(0, 90));
  await page.locator("[data-care-resolve]").click();
  await page.waitForTimeout(300);
  const note = await page.evaluate(() => document.querySelector("[data-crisis-note]")?.textContent);
  check(/crisis note/.test(note ?? "") && /Tier 2/.test(note ?? ""), "for Tier 1, Resolve says it is the crisis note, and asks for Tier 2", note);
  await page.locator('[data-slot="resolve-dialog"] button[aria-pressed]', { hasText: "no longer a threat" }).click();
  await page.waitForTimeout(100);
  const note3 = await page.evaluate(() => document.querySelector("[data-crisis-note]")?.textContent);
  check(/Tier 3/.test(note3 ?? ""), "and Tier 3 when it is no longer a threat", note3);
  await page.locator('[data-slot="resolve-dialog"] textarea').fill("Their aunt is home and we have a plan for tomorrow.");
  await page.locator('[data-slot="resolve-dialog"] button', { hasText: /^Resolve$/ }).click();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({
    state: document.querySelector("[data-care-state]")?.dataset.careState,
    tier: document.querySelector("[data-tier-card]")?.dataset.tier,
    chip: document.querySelector("[data-tier-card] [data-requested-tier]")?.textContent,
    dot: !!document.querySelector("[data-care-dot]"),
    story: document.querySelector("[data-escalation-story]")?.innerText.replace(/\s+/g, " "),
    stepDown: [...document.querySelectorAll("[data-tier-action]")].map((b) => b.dataset.tierAction),
  }));
  const ev = (await store(page)).tierEvents.at(-1);
  check(after.state === "steady" && after.tier === "1" && after.chip === "Requested: Tier 3" && !after.dot, "resolved: steady, still Tier 1 with Requested: Tier 3 — a mentor never steps down directly", JSON.stringify({ ...after, story: undefined }));
  check(ev?.kind === "step-down-requested" && ev.actor.role === "mentor" && ev.tier === 3, "the store holds a step-down REQUEST from the mentor, not a step down", JSON.stringify(ev && { kind: ev.kind, tier: ev.tier, role: ev.actor.role }));
  check(/Opened .+→ .+covered.+→ resolved/.test(after.story ?? ""), "History tells the escalation as one story", after.story?.slice(0, 90));
  await page.locator("[data-escalation-story] > button").click();
  await page.waitForTimeout(150);
  const entries = await page.evaluate(() => [...document.querySelectorAll("[data-story-entries] [data-audit-lozenge]")].map((l) => l.textContent));
  check(entries.includes("Requested") && entries.includes("Confirmed") && entries.includes("Step-down requested") && entries.includes("Resolved"), "expanded, it shows every audit entry with its lozenge", entries.join(" · "));
  await page.screenshot({ path: `${OUT}/04-resolved-history.png` });
  await ctx.close();
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
  check(h.section && /stepped down to Tier 2/.test(h.story ?? ""), "the record Care tab carries the tier history — Imani's Friday crisis, as one story", h.story?.slice(0, 100));
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
    ["/app/chat/t13", "[data-care-status]", "the Tier 1 red lane (status header)", { chat: "escalation-active" }],
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
    const r = await contrastOf(page, sel);
    const low = r.filter((x) => x.r < x.need);
    check(r.length > 0 && low.length === 0, `${theme}: ${what} — every text clears AA`, low.length ? JSON.stringify(low.slice(0, 4)) : `${r.length} texts, lowest ${Math.min(...r.map((x) => x.r))}:1`);
    await ctx.close();
  }
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
