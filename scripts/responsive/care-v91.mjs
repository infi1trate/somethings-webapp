// ═══════════════════════════════════════════════════════════════════════════
// ESCALATION FOCUS VIEW (amendment pack v9.1) — the report's measures
//
//   1  migrated: v9.0's in-place list tracks are gone; in the view the list
//      track is 0 and the list inert
//   2  the Active escalation group: present only when non-empty, a
//      partition, announced; no new filter tab
//   3  entry: from the list · a notification deep link (lands, no motion) ·
//      a mid-chat open (ONE composed motion; reduced motion, a swap)
//   4  exit: ← Chats round trip · close → summary → dismiss → restore + unpin
//   5  widths in the view, with and without Support, vs the 480 floor
//   6  lens parity: the same room, only the back label differs
//   7  keyboard / screen reader: back first, entry announced, group header
//   8  squint screenshots
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-v91";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const report = { widths: [] };
const b = await chromium.launch();
/* The sampler starts at document start, so a deep link's first frames are
   on the record. */
async function open(path, { persona = "mentor", chat = "escalation-active", extra = {}, reduce = false, w = 1512, h = 1000, sample = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.addInitScript(
    ([k, v, s]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
      if (s) {
        window.__s = [];
        const t0 = performance.now();
        const tick = () => {
          const g = document.querySelector("[data-chat-layout]");
          if (g) window.__s.push([Math.round(performance.now() - t0), getComputedStyle(g).gridTemplateColumns]);
          if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    },
    [KEY, { state: { persona, chatScenarioId: chat, ...extra }, version: VERSION }, sample]
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  return { ctx, page, errors };
}
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
const setPersona = async (page, persona, path) => {
  await page.evaluate(([k, p]) => { const r = JSON.parse(localStorage.getItem(k)); r.state.persona = p; localStorage.setItem(k, JSON.stringify(r)); }, [KEY, persona]);
  if (path) await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  else await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
};
const room = (page) =>
  page.evaluate(() => {
    const g = document.querySelector("[data-chat-layout]");
    const list = document.querySelector('[data-slot="conversation-list"]');
    const thread = g?.querySelector(":scope > div.flex.min-h-0.flex-col");
    const hub = document.querySelector("[data-chat-hub]");
    const lr = list?.getBoundingClientRect();
    return {
      url: location.pathname,
      focus: !!g?.hasAttribute("data-chat-focus"),
      cols: g ? getComputedStyle(g).gridTemplateColumns : null,
      layout: g?.dataset.chatLayout,
      list: list ? { w: Math.round(lr.width), away: list.hasAttribute("data-list-away"), inert: list.inert, opacity: getComputedStyle(list).opacity } : null,
      chat: thread ? Math.round(thread.getBoundingClientRect().width) : 0,
      care: hub && getComputedStyle(hub).position === "static" ? Math.round(hub.getBoundingClientRect().width) : 0,
      back: document.querySelector('[data-slot="chat-back-chats"]')?.textContent.trim() ?? document.querySelector('[data-slot="chat-back-monitoring"]')?.textContent.trim() ?? null,
      backSlot: document.querySelector('[data-slot="chat-back-chats"], [data-slot="chat-back-monitoring"]')?.dataset.slot ?? null,
      said: document.querySelector("[data-focus-live]")?.textContent ?? "",
      banner: !!document.querySelector("[data-chat-banner]"),
      cells: document.querySelector('[data-care-yield="cells"]')?.dataset.open ?? null,
      strip: document.querySelector('[data-care-yield="strip"]')?.dataset.open ?? null,
      group: [...document.querySelectorAll('[data-list-group="active-escalation"] [data-anno-ref^="conversation-row:"]')].map((r) => r.dataset.annoRef.split(":")[1]),
      header: document.querySelector("[data-list-group-header]")?.textContent.trim() ?? null,
      selected: document.querySelector('[data-anno-ref^="conversation-row:"][aria-current="true"]')?.dataset.annoRef.split(":")[1] ?? null,
    };
  });
const samples = (page) => page.evaluate(() => window.__s ?? []);
const startSampler = (page, ms = 1200) =>
  page.evaluate((ms) => {
    window.__s = [];
    const g = document.querySelector("[data-chat-layout]");
    const l = () => document.querySelector('[data-slot="conversation-list"]');
    const t0 = performance.now();
    const tick = () => {
      window.__s.push([Math.round(performance.now() - t0), getComputedStyle(g).gridTemplateColumns, l() ? getComputedStyle(l()).opacity : null]);
      if (performance.now() - t0 < ms) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);
/** One motion: the list track moves monotonically from its start to its
 *  end; in-between frames are the ones at neither end. */
function motionOf(s) {
  const first = s.map(([t, c]) => [t, parseFloat(c.split(" ")[0])]).filter(([, v]) => !Number.isNaN(v));
  if (!first.length) return { from: null, to: null, mono: true, between: 0, settledAt: null, opacity: 0 };
  const a = first[0][1], z = first.at(-1)[1];
  const dir = Math.sign(z - a);
  let mono = true;
  for (let i = 1; i < first.length; i++) if (Math.sign(first[i][1] - first[i - 1][1]) === -dir) mono = false;
  const between = first.filter(([, v]) => v !== a && v !== z).length;
  const settledAt = first.find(([, v]) => v === z)?.[0] ?? null;
  const op = s.filter((x) => x[2] !== null && x[2] !== undefined && x[2] !== "0" && x[2] !== "1").length;
  return { from: a, to: z, mono, between, settledAt, opacity: op };
}

// ── 1 · MIGRATED ───────────────────────────────────────────────────────────
console.log("\n── 1 · v9.0's in-place equalization, migrated");
{
  const src = await readFile("src/components/chat/chat-page.tsx", "utf8");
  check(!/--focus-list/.test(src) && !/@min-\[1096px\]/.test(src), "v9.0's narrowed-list tracks (--focus-list, the 1096 guard) are gone from the source");
  const { ctx, page } = await open("/app/chat/t13");
  const r = await room(page);
  check(r.focus && r.list?.w <= 1 && r.list.away && r.list.inert && r.list.opacity === "0", "in the view the list's track is 0, and the list is inert and faded out", JSON.stringify(r.list));
  await ctx.close();
}

// ── 2 · THE ACTIVE ESCALATION GROUP ────────────────────────────────────────
console.log("\n── 2 · the Active escalation group");
{
  const { ctx, page } = await open("/app/chat");
  let r = await room(page);
  const sem = await page.evaluate(() => {
    const s = document.querySelector('[data-list-group="active-escalation"]');
    const h = s?.querySelector("h3");
    return { labelled: s?.getAttribute("aria-labelledby") === h?.id && !!h, firstSection: s === document.querySelector('[data-slot="conversation-list"] [role="region"]')?.firstElementChild, tabs: [...document.querySelectorAll('[aria-label="Filter conversations"] button')].map((x) => x.textContent.replace(/\d+/g, "").trim()) };
  });
  check(r.header === "Active escalation" && r.group.join() === "t13" && sem.firstSection, "the open escalation pins to the top under “Active escalation”", `${r.group.join()} · first ${sem.firstSection}`);
  check(sem.labelled, "the group is a section labelled by its header — announced in the list");
  check(sem.tabs.join() === "All,Unread,Check-in", "no new filter tab", sem.tabs.join());
  check(!r.focus && r.selected !== "t13" && r.selected !== null, "/app/chat never defaults into the room: the selected conversation is not the escalated one", String(r.selected));
  await page.locator('[aria-label="Filter conversations"] button').filter({ hasText: "Unread" }).click();
  await page.waitForTimeout(300);
  r = await room(page);
  const unreadT13 = (await store(page)).chatScenarioId && (await page.evaluate(() => !!document.querySelector('[data-anno-ref="conversation-row:t13"]')));
  check(unreadT13 ? r.group.join() === "t13" : r.header === null, "each filter partitions the same way (the header only with rows)", `${r.header} · ${r.group.join()}`);
  await page.screenshot({ path: `${OUT}/01-list-with-group.png` });
  await ctx.close();
  const s = await open("/app/chat", { chat: "active-mentorship" });
  const q = await room(s.page);
  check(q.header === null && q.group.length === 0, "no open escalation: no group header at all (never empty)", String(q.header));
  await s.page.screenshot({ path: `${OUT}/02-list-without-group.png` });
  await s.ctx.close();
}

// ── 3 · ENTRY ──────────────────────────────────────────────────────────────
console.log("\n── 3 · entering the focus view");
{
  /* From the list: a row is a navigation, so the page lands — no travel. */
  const { ctx, page, errors } = await open("/app/chat");
  await startSampler(page, 2000);
  await page.locator('[data-list-group="active-escalation"] [data-anno-ref="conversation-row:t13"]').click();
  await page.waitForTimeout(2000);
  const r = await room(page);
  check(r.url === "/app/chat/t13" && r.focus && r.list.away && r.back === "Chats · 4", "from the list: the row opens the focus view — list away, “← Chats · 4”", JSON.stringify({ url: r.url, back: r.back }));
  /* RETARGETED (pack v11.0, Supersession 1): the hero holds its ground —
     no yield wrapper exists; the hero is on screen with the banner. */
  const hero = await page.evaluate(() => !!document.querySelector("[data-care-hero]"));
  check(r.cells === null && hero && r.banner, "the hero holds inside the view (no yield); the banner is on", `${r.cells} · ${hero} · ${r.banner}`);
  check(/^Escalation focus view\./.test(r.said), "entry is announced", r.said);
  check(errors.length === 0, "no page errors", errors.slice(0, 2).join(" | "));
  await ctx.close();
}
{
  /* A notification deep link lands directly — measured on v9.0: 43 frames. */
  const { ctx, page } = await open("/app/chat/t13?care=escalation", { sample: true });
  const s = await samples(page);
  const distinct = [...new Set(s.map((x) => x[1]))];
  const r = await room(page);
  report.deepLink = { frames: s.length, distinct };
  check(r.focus && distinct.length <= 2 && distinct.at(-1) === r.cols, "a notification deep link LANDS in the view — no in-between frames", `${distinct.length} distinct: ${distinct.join(" | ")}`);
  check((await page.evaluate(() => document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab)) === "escalation", "and on the Escalation review tab");
  await ctx.close();
}
for (const reduce of [false, true]) {
  /* Mid-chat open: the one in-place transition. */
  const { ctx, page } = await open("/app/chat/t14", { chat: "active-mentorship", reduce });
  if (!(await page.locator("[data-care-panel]").count())) { await page.locator('[data-rail-tab="care"]').first().click(); await page.waitForTimeout(300); }
  await page.locator('[data-tier-action="escalate"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-tier-row="2"]').click();
  await page.locator("[data-tier-field=note]").fill("They said they are not okay tonight.");
  const before = await room(page);
  await startSampler(page, 1200);
  await page.locator("[data-tier-cta=raise]").click();
  await page.waitForTimeout(1300);
  const m = motionOf(await samples(page));
  const after = await room(page);
  if (!reduce) {
    report.midChat = { before: before.cols, after: after.cols, ...m };
    check(!before.focus && after.focus && after.list.away && after.banner, "mid-chat open: the view composes — banner, list away, focus", `${before.cols} → ${after.cols}`);
    check(m.mono && m.between >= 3 && m.settledAt <= 520 && m.opacity >= 3, `ONE composed motion: the list track slides ${m.from} → ${m.to} over ${m.between} frames (settled ${m.settledAt}ms) while the list fades in the same beat (${m.opacity} frames)`);
    check(after.back === "Chats · 4" || /^Chats/.test(after.back ?? ""), "and the way out arrives with it", String(after.back));
  } else {
    check(after.focus && m.between === 0, "reduced motion: an instant swap", `${m.between} frames`);
  }
  await ctx.close();
}

{
  /* A raise on /app/chat's DEFAULT conversation: the default is held, so the
     view composes around it rather than handing the pane to the next row. */
  const { ctx, page } = await open("/app/chat", { chat: "active-mentorship" });
  const before = await room(page);
  if (!(await page.locator("[data-care-panel]").count())) { await page.locator('[data-rail-tab="care"]').first().click(); await page.waitForTimeout(300); }
  await page.locator('[data-tier-action="escalate"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-tier-row="2"]').click();
  await page.locator("[data-tier-field=note]").fill("They said they are not okay tonight.");
  await page.locator("[data-tier-cta=raise]").click();
  await page.waitForTimeout(1200);
  const after = await room(page);
  const name = await page.evaluate(() => document.querySelector('[data-slot="chat-thread-name"]')?.textContent);
  check(after.focus && after.banner && after.url === "/app/chat" && before.selected && name, `a raise on the list’s default conversation composes the view around it (it stays: ${name})`, JSON.stringify({ before: before.selected, focus: after.focus }));
  await ctx.close();
}
{
  /* Hardened (mutation run): "a default is never the room" has two guards —
     the scenario's focus thread, then the most recent row. Only with BOTH in
     a room is the second one exercised: escalation-active (t13, its focus
     thread, in the room) plus a raise on the most recent row (t14). */
  const { ctx, page } = await open("/app/chat/t14");
  if (!(await page.locator("[data-care-panel]").count())) { await page.locator('[data-rail-tab="care"]').first().click(); await page.waitForTimeout(300); }
  await page.locator('[data-tier-action="escalate"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-tier-row="3"]').click();
  await page.locator("[data-tier-field=note]").fill("Probe: a second open escalation.");
  await page.locator("[data-tier-cta=raise]").click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/app/chat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  const again = await room(page);
  check(!again.focus && again.selected && !["t13", "t14"].includes(again.selected) && again.group.length === 2, "two rooms open: /app/chat defaults to a THIRD conversation; both are pinned", JSON.stringify({ sel: again.selected, group: again.group }));
  await ctx.close();
}

// ── 4 · EXIT ───────────────────────────────────────────────────────────────
console.log("\n── 4 · leaving the focus view");
{
  const { ctx, page } = await open("/app/chat/t13");
  await page.locator('[data-slot="chat-back-chats"]').click();
  await page.waitForTimeout(1500);
  let r = await room(page);
  check(r.url === "/app/chat" && !r.focus && !r.list.away && r.group.join() === "t13" && r.selected !== "t13", "← Chats: the list returns, nothing closed, the escalation still pinned", JSON.stringify({ url: r.url, group: r.group, sel: r.selected }));
  const open1 = (await store(page)).escalations?.t13?.resolvedAt ?? null;
  check(open1 === null, "the escalation is still open", String(open1));
  await page.locator('[data-anno-ref="conversation-row:t13"]').click();
  await page.waitForTimeout(1500);
  r = await room(page);
  check(r.url === "/app/chat/t13" && r.focus, "and the row re-enters the view", r.url);
  await ctx.close();
}
let closedState;
{
  /* Close → summary → dismiss → restore + unpin. */
  const { ctx, page } = await open("/app/chat/t13");
  for (let i = 0; i < 8; i++) { const no = page.locator('[data-ga-focused] [data-yes-no$=":no"]').first(); if (!(await no.count())) break; await no.click(); await page.waitForTimeout(250); }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Probe: no plan, talking it through.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(400);
  await setPersona(page, "supervisor");
  await page.locator('[data-tier-row="3"]').click();
  await page.locator('[data-tier-cta=confirm]').click();
  await page.waitForTimeout(800);
  let r = await room(page);
  check(r.focus && !r.banner && (await page.evaluate(() => document.querySelector("[data-care-panel]")?.dataset.careState)) === "closed", "supervisor: closed — still in the room on its summary (the banner is gone)", JSON.stringify({ focus: r.focus, banner: r.banner }));
  await startSampler(page, 1200);
  await page.locator('[data-exchange-primary="dismiss-summary"]').click();
  await page.waitForTimeout(1300);
  r = await room(page);
  const ms = motionOf(await samples(page));
  /* RETARGETED (pack v11.0 §3.1): steady Care is 420. */
  check(!r.focus && r.cols === "828px 420px", "supervisor: dismiss leaves the room — steady columns, in one motion", `${r.cols} · ${ms.between} frames`);
  closedState = await store(page);
  await setPersona(page, "mentor", "/app/chat/t13");
  r = await room(page);
  check(r.focus && r.list.away, "mentor: the undismissed summary keeps the view", JSON.stringify({ focus: r.focus }));
  const tabs = await page.evaluate(() => document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab);
  if (tabs !== "escalation") await page.locator('[data-care-tab="escalation"]').click();
  await startSampler(page, 1200);
  await page.locator('[data-exchange-primary="dismiss-summary"]').click();
  await page.waitForTimeout(1400);
  const m = motionOf(await samples(page));
  r = await room(page);
  report.exit = { cols: r.cols, ...m };
  check(!r.focus && !r.list.away && r.list.w === 300 && r.group.length === 0 && r.header === null, "mentor: dismiss → the view exits, the list returns, the conversation is unpinned (no group left)", JSON.stringify({ cols: r.cols, group: r.group, header: r.header }));
  check(m.mono && m.between >= 3 && m.opacity >= 3, `the exit reverses the entry exactly — the track ${m.from} → ${m.to} over ${m.between} frames, the list fading back in`);
  check((await page.evaluate(() => document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab)) === "history", "and lands on History, as before (toast and History unchanged)");
  await ctx.close();
}

// ── 5 · WIDTHS ─────────────────────────────────────────────────────────────
console.log("\n── 5 · widths in the view");
for (const w of [1512, 1280]) {
  for (const persona of ["mentor", "supervisor"]) {
    for (const support of [false, true]) {
      const { ctx, page } = await open("/app/chat/t13", { persona, w });
      if (support) { await page.locator("[data-support-cta]").filter({ visible: true }).first().click(); await page.waitForTimeout(900); }
      const r = await room(page);
      report.widths.push({ who: `${persona} ${w}${support ? " + Support" : ""}`, cols: r.cols, chat: r.chat, care: r.care });
      const drawer = r.care === 0;
      check(r.focus && r.chat >= 480 && (drawer || r.care <= r.chat) && (r.list === null || r.list.w <= 1 || r.layout === "beside"), `${persona} ${w}${support ? " + Support" : ""}: chat ${r.chat} ≥ 480 · Care ${drawer ? "the drawer" : r.care} ≤ chat · no list`, r.cols);
      if (support) {
        await page.locator("[data-support-cta]").filter({ visible: true }).first().click();
        await page.waitForTimeout(900);
        const c = await room(page);
        check(c.focus && (c.list === null || c.list.away) && c.care > 0, `${persona} ${w}: closing Support restores chat · Care, not the list`, c.cols);
      }
      await ctx.close();
    }
  }
}

// ── 6 · LENS PARITY ────────────────────────────────────────────────────────
console.log("\n── 6 · one room, two lenses");
{
  const shape = async (persona) => {
    const { ctx, page } = await open("/app/chat/t13", { persona });
    const r = await room(page);
    const first = await page.evaluate(() => document.querySelector("[data-chat-layout] > div.flex.min-h-0.flex-col")?.firstElementChild?.dataset.slot);
    await page.screenshot({ path: `${OUT}/0${persona === "mentor" ? 3 : 4}-room-${persona}.png` });
    await ctx.close();
    const tracks = r.cols.split(" ").map(parseFloat).filter((x) => x > 1);
    return { r, first, tracks };
  };
  const m = await shape("mentor");
  const s = await shape("supervisor");
  /* RETARGETED (pack v11.0 §3.2): an even split with Care clamped
     480–680 and chat ≥ 520 — the mentor's Care meets its 680 cap. */
  check(m.tracks.join() === "724,680" && s.tracks.join() === "624,624", "both lenses: chat · Care, an even split clamped (mentor 724 · 680 at Care's cap, supervisor 624 · 624)", `${m.r.cols} | ${s.r.cols}`);
  check(m.first === "chat-back-chats" && s.first === "chat-back-monitoring" && m.r.back.startsWith("Chats") && s.r.back === "Monitoring", "the same back bar first in the conversation — only its label differs", `${m.r.back} | ${s.r.back}`);
  /* RETARGETED (pack v11.0, Supersession 1): no yield in either lens. */
  check(m.r.cells === null && m.r.strip === null && s.r.cells === null && s.r.strip === null, "the hero holds in both lenses (no yield, no strip)", `${m.r.strip} | ${s.r.strip}`);
}

// ── 7 · KEYBOARD AND SCREEN READER ─────────────────────────────────────────
console.log("\n── 7 · keyboard");
const transcript = ["## Entering the view from a notification (mentor, 1512)"];
{
  const { ctx, page } = await open("/app/chat/t13?care=escalation");
  const said = (await room(page)).said;
  transcript.push(`- announced (polite): “${said}”`);
  /* Tab order inside the conversation column: the back bar comes first. */
  const order = await page.evaluate(() => {
    const col = document.querySelector("[data-chat-layout] > div.flex.min-h-0.flex-col");
    const f = [...col.querySelectorAll("a[href], button, textarea, [tabindex]:not([tabindex='-1'])")].filter((e) => !e.closest("[inert]") && e.getBoundingClientRect().width > 0);
    return f.slice(0, 3).map((e) => `${e.tagName.toLowerCase()} “${(e.getAttribute("aria-label") || e.textContent).replace(/\s+/g, " ").trim().slice(0, 48)}”`);
  });
  transcript.push(...order.map((o, i) => `- conversation tab stop ${i + 1}: ${o}`));
  check(/^a “Back to chats, 4 with unread messages”/.test(order[0] ?? ""), "the back affordance is first in the conversation’s tab order, and names its count", order[0]);
  const listTabbable = await page.evaluate(() => [...document.querySelectorAll('[data-slot="conversation-list"] button')].some((x) => { x.focus(); return document.activeElement === x; }));
  check(!listTabbable, "nothing in the away list can take focus");
  transcript.push(`- the list: inert — no control in it takes focus`);
  await ctx.close();
  const l = await open("/app/chat");
  const h = await l.page.evaluate(() => { const s = document.querySelector('[data-list-group="active-escalation"]'); return { role: s?.tagName, name: document.getElementById(s?.getAttribute("aria-labelledby") ?? "")?.textContent, row: s?.querySelector("button")?.getAttribute("aria-label") }; });
  transcript.push(`\n## The list\n- group: <${h.role?.toLowerCase()}> named “${h.name}” (h3) — its first row: “${h.row}”`);
  check(h.name === "Active escalation" && /escalation open/.test(h.row ?? ""), "the group header names the section; the row says “escalation open” in words", h.row);
  await l.ctx.close();
}
await writeFile(`${OUT}/KEYBOARD-TRANSCRIPT.md`, `# Keyboard / screen-reader transcript (probe-generated)\n\n${transcript.join("\n")}\n`);

// ── 8 · SQUINT ─────────────────────────────────────────────────────────────
console.log("\n── 8 · squint screenshots");
{
  const { ctx, page } = await open("/app/chat/t13");
  await page.screenshot({ path: `${OUT}/05-room-without-support.png` });
  await page.locator("[data-support-cta]").filter({ visible: true }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/06-room-with-support.png` });
  await ctx.close();
  check(true, "written", OUT);
}

await writeFile(`${OUT}/measures.json`, JSON.stringify(report, null, 2));
await b.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
