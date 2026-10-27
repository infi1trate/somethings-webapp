// ═══════════════════════════════════════════════════════════════════════════
// TIERSELECT UNIFICATION (micro-pack v10.0 + amendment v10.1, the lozenge
// as selector) — measured, against both report-back checklists
//
//   1  raise: empty → select → confirm; Tiers 1–3 with the mentor's lines;
//      the platform escape outside the radiogroup; one neutral filled CTA
//   2  review (confirm-tier): the request arrives checked and tagged, the
//      header row, the criteria, the seeded reason; confirm as-is; override
//      → the CTA relabels (and says so) → confirm
//   3  update (steady state): the current tier checked, "Choose a new tier"
//      names the gap, the movement rules visible and disabled, the CTA names
//      the move; a pending request arrives checked and tagged, Keep declines
//   4  one skeleton: the same card in every mode — lozenge · name ·
//      description, no radio glyph; each card wears its tier's legend wash
//      (v10.1's scoped exception); selection is fill + ring + check, never
//      the wash; the ring moves nothing; five states per tier, one image
//   5  the screen-reader transcript (written to SR-TRANSCRIPT.md)
//   6  contrast, both themes: name and description on every wash at rest and
//      hover, lozenges outline and filled per tier, the ring, the tag, and
//      what makes an unselected card read as tappable
//   7  motion: the request settles in one beat; selecting fills the lozenge
//      and lands the check in one beat; both stilled under reduced motion
//   8  source proofs: canon pairings, no superseded strings, no radio glyph
//      in TierSelect, legend washes nowhere else, both retired controls gone
//   9  squint test: raise beside review, one image
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/tier-select";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

/* The pack's tables, typed out here so the probe is an independent witness
   of `tiers.ts` rather than a copy of it. */
const CANON = { 1: "Active crisis", 2: "High risk", 3: "Medium risk", 4: "General" };
const MENTOR_LINE = {
  1: (n) => `${n} might hurt themselves or someone else, or is in danger right now.`,
  2: (n) => `Something serious is going on and ${n} needs closer support this week.`,
  3: () => "You're worried and want a supervisor to know, but it isn't urgent.",
};
const CRITERIA = {
  1: "Specific plan with means/timeframe, in-progress self-harm, rapid symptom escalation, active command hallucinations.",
  2: "Passive suicidal ideation, current abuse/neglect disclosures, active eating disorder/substance use without imminence.",
  3: "Low-level distress, historical mental-health issues with no active high-risk indicators.",
  4: "No issues that need supervisor intervention.",
};

const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "active-mentorship", extra = {}, theme, width = 1512, reduce = false } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 }, reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, chatScenarioId: chat, monitoringScenarioId: null, ...extra }, version: VERSION }]
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
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
const openRaise = async (page) => {
  await page.locator('[data-rail-tab="care"]').click();
  await page.locator('[data-tier-action="escalate"]').click();
  await page.waitForTimeout(350);
};

const ENGINE = `(() => {
  if (window.__c) return;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, u) => { const a = t[3]; return [t[0]*a+u[0]*(1-a), t[1]*a+u[1]*(1-a), t[2]*a+u[2]*(1-a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let base = [255,255,255,1]; if (st.length && st[st.length-1][3] >= 1) base = st.pop(); while (st.length) base = over(st.pop(), base); return base; };
  window.__c = { rgba, ratio, bgOf, over };
})()`;

/** Alert-family colours anywhere under `sel` — the elements, by their role. */
const alertCensus = (page, sel) =>
  page.evaluate((sel) => {
    const probe = (v) => { const e = document.createElement("span"); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const red = ["--t1", "--t2", "--t1-ink", "--t2-ink", "--t1-soft", "--t2-soft", "--alert-critical-accent", "--alert-critical-fg", "--alert-critical-bg", "--alert-critical-border"].map(probe);
    const out = [];
    for (const root of document.querySelectorAll(sel))
      for (const el of [root, ...root.querySelectorAll("*")]) {
        const s = getComputedStyle(el);
        if ([s.color, s.backgroundColor, s.borderTopColor].some((c) => red.includes(c)))
          out.push(el.dataset.tierLozenge ? `lozenge T${el.dataset.tierLozenge}` : el.closest("[data-tier-lozenge]") ? "inside lozenge" : `${el.tagName}${el.dataset.tierRow ? ` row ${el.dataset.tierRow}` : ""}`);
      }
    return out;
  }, sel);

/** Every card's shape and state, read off the card (the label) and its
 *  hidden radio. */
const rows = (page, scope = "[data-tier-select]") =>
  page.evaluate((scope) => [...document.querySelectorAll(`${scope} [data-tier-row]`)].map((r) => {
    const s = getComputedStyle(r);
    const i = r.querySelector("input[type=radio]");
    const resolve = (v) => { const e = document.createElement("span"); e.style.backgroundColor = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; };
    const ids = (i?.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    return {
      tier: r.dataset.tierRow,
      checked: i?.checked ? "true" : "false",
      disabled: i?.disabled ? "true" : null,
      tab: i?.tabIndex,
      inputs: r.querySelectorAll("input[type=radio]").length,
      hidden: i ? getComputedStyle(i).position === "absolute" && i.getBoundingClientRect().width <= 1 : false,
      glyph: !!r.querySelector(".size-4.rounded-full, .size-2.rounded-full"),
      bg: s.backgroundColor,
      wash: resolve(`--tier-legend-${r.dataset.tierRow}-wash`),
      washHover: resolve(`--tier-legend-${r.dataset.tierRow}-wash-hover`),
      bw: s.borderTopWidth,
      bc: s.borderTopColor,
      h: Math.round(r.getBoundingClientRect().height),
      anatomy: [...r.querySelectorAll(":scope > span:not([aria-hidden]) > span:first-child > *:not(.sr-only), :scope > span:not([aria-hidden]) > [data-tier-row-description]")].map((x) => x.dataset.tierLozenge ? "lozenge" : x.dataset.tierRowDescription !== undefined ? "description" : x.dataset.tierRowTag ? "tag" : "name"),
      lozenge: r.querySelector("[data-tier-lozenge]")?.textContent,
      lozState: r.querySelector("[data-tier-lozenge]")?.dataset.lozengeState,
      check: !!r.querySelector("[data-tier-check]"),
      name: r.querySelector("[data-tier-lozenge] + span")?.textContent,
      tag: r.querySelector("[data-tier-row-tag]")?.textContent,
      tagKind: r.querySelector("[data-tier-row-tag]")?.dataset.tierRowTag,
      desc: r.querySelector("[data-tier-row-description]")?.textContent,
      why: r.querySelector("[data-tier-why]")?.textContent,
      label: i?.getAttribute("aria-label"),
      described: ids.map((id) => document.getElementById(id)?.textContent).join(" "),
      anim: s.animationName,
    };
  }), scope);
const cta = (page) => page.evaluate(() => {
  const c = document.querySelector("[data-tier-cta]");
  return { kind: c?.dataset.tierCta, text: c?.textContent, bg: c ? getComputedStyle(c).backgroundColor : null };
});
const ink = (page) => page.evaluate(() => { const e = document.createElement("span"); e.style.backgroundColor = "var(--text-primary)"; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; });
/** Filled buttons — background is the ink — under a scope. */
const filled = (page, scope) => page.evaluate((scope) => {
  const e = document.createElement("span"); e.style.backgroundColor = "var(--text-primary)"; document.body.appendChild(e); const inkBg = getComputedStyle(e).backgroundColor; e.remove();
  return [...document.querySelectorAll(`${scope} button`)].filter((x) => getComputedStyle(x).backgroundColor === inkBg).map((x) => x.textContent.trim());
}, scope);

// ── 1 · RAISE ──────────────────────────────────────────────────────────────
console.log("\n── 1 · raise mode: empty → select → confirm");
{
  const { ctx, page } = await open("/app/chat/t14");
  await openRaise(page);
  const teen = await page.evaluate(() => document.querySelector("[data-tier-field=note]")?.getAttribute("placeholder")?.match(/What did (\w+) say/)?.[1]);
  const r0 = await rows(page);
  check(r0.map((r) => r.tier).join() === "1,2,3", "Tiers 1–3 only — never Tier 4", r0.map((r) => r.tier).join());
  check(r0.every((r) => r.checked === "false") && r0.filter((r) => r.tab === 0).length === 1 && r0[0].tab === 0, "empty on load: nothing pre-checked, one tab stop (the first row)", JSON.stringify(r0.map((r) => [r.checked, r.tab])));
  check(r0.every((r) => r.name === CANON[r.tier] && r.lozenge === `T${r.tier}`), "each row: its lozenge and the canon name", r0.map((r) => `${r.lozenge} ${r.name}`).join(" · "));
  check(r0.every((r) => r.desc === MENTOR_LINE[r.tier](teen).replace("'", "'")), "the mentor's lines, verbatim from the pack's table", JSON.stringify(r0.map((r) => r.desc)));
  const plat = await page.evaluate(() => {
    const l = document.querySelector("[data-raise-platform]");
    const g = document.querySelector('[data-tier-select] [role="radiogroup"]');
    return { text: l?.textContent, bg: l ? getComputedStyle(l).backgroundColor : null, inside: !!g?.contains(l), after: !!(g && l && g.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING), role: l?.getAttribute("role"), tab: l?.tabIndex };
  });
  check(plat.bg === "rgba(0, 0, 0, 0)", "the platform escape wears no wash — it is not a tier", plat.bg);
  check(plat.text === "Something else? Report a platform concern." && !plat.inside && plat.after && plat.role === null && plat.tab === 0, "the platform escape: below the radiogroup, outside it, its own tab stop, never a tier option", JSON.stringify(plat));
  const field = await page.evaluate(() => { const t = document.querySelector("[data-tier-field=note]"); return { label: document.querySelector(`label[for="${t.id}"]`)?.textContent, max: t.maxLength }; });
  check(field.label === "What’s happening? Your supervisor will read this." && field.max === 280, "the required note: its label, a 280 cap", JSON.stringify(field));
  const c0 = await cta(page);
  const cancel = await page.evaluate(() => document.querySelector("[data-tier-cancel]")?.textContent);
  check(c0.text === "Confirm escalation" && c0.bg === (await ink(page)) && cancel === "Cancel", "Confirm escalation (filled, ink) + Cancel (ghost)", JSON.stringify({ ...c0, cancel }));

  /* Empty confirm names both gaps and writes nothing. */
  const before = Object.keys((await store(page)).escalations ?? {}).length;
  await page.locator("[data-tier-cta]").click();
  await page.waitForTimeout(150);
  const gaps = await page.evaluate(() => ({ errs: [...document.querySelectorAll("[data-tier-error]")].map((e) => e.dataset.tierError), focus: document.activeElement?.closest("[data-tier-row]")?.dataset.tierRow }));
  check(gaps.errs.join() === "tier,field" && gaps.focus === "1" && Object.keys((await store(page)).escalations ?? {}).length === before, "empty Confirm names both gaps, focuses the group, writes nothing", JSON.stringify(gaps));

  /* Select: the 2px ink border, and nothing moves. */
  const h0 = await page.evaluate(() => Math.round(document.querySelector("[data-tier-select]").getBoundingClientRect().height));
  await page.locator('[data-tier-row="2"]').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(220);
  const r1 = await rows(page);
  const h1 = await page.evaluate(() => Math.round(document.querySelector("[data-tier-select]").getBoundingClientRect().height));
  const two = r1.find((r) => r.tier === "2");
  check(two.checked === "true" && two.bw === "2px" && two.bc === (await ink(page)) && r1.filter((r) => r.tier !== "2").every((r) => r.bw === "1px"), "selected: the 2px ink ring on that card alone", JSON.stringify(r1.map((r) => [r.tier, r.bw])));
  check(two.lozState === "filled" && two.check && r1.filter((r) => r.tier !== "2").every((r) => r.lozState === "outline" && !r.check), "selected: the lozenge fills and the check lands; every other card stays outline, no check", JSON.stringify(r1.map((r) => [r.tier, r.lozState, r.check])));
  check(r1.every((r) => r.inputs === 1 && r.hidden && !r.glyph), "no radio glyph: one visually hidden native radio per card, the card its label", JSON.stringify(r1.map((r) => [r.inputs, r.hidden, r.glyph])));
  check(r1.every((r, i) => r.h === r0[i].h) && Math.abs(h1 - h0) <= 22, "checking a row moves nothing — every row keeps its height", JSON.stringify({ rows: r1.map((r) => r.h), before: r0.map((r) => r.h) }));
  /* ═══ THE SCOPED WASH (v10.1) ═══ Each card wears its own tier's legend
     wash — checked or not, the wash is identity, never selection. */
  check(r1.every((r) => r.bg === r.wash) && new Set(r1.map((r) => r.bg)).size === 3 && two.bg === r0.find((r) => r.tier === "2").bg, "each card wears its tier's legend wash, the same checked or not", r1.map((r) => `T${r.tier} ${r.bg}`).join(" · "));
  await page.locator('[data-tier-row="1"]').hover();
  await page.waitForTimeout(220);
  const hov = (await rows(page)).find((r) => r.tier === "1");
  check(hov.bg === hov.washHover, "hover deepens the wash one step", `${hov.bg} (${hov.washHover})`);
  await page.mouse.move(0, 0);
  const census = await alertCensus(page, "[data-tier-select]");
  check(census.length > 0 && census.every((c) => /^lozenge T[12]$|inside lozenge/.test(c)), "alert inks on the Tier 1–2 lozenges only — never Confirm (it was red on T1–2 before v10); the washes are the scoped legend", census.join(", "));
  check((await cta(page)).bg === (await ink(page)), "Confirm escalation stays ink with Tier 2 checked", "");
  await page.locator('[data-tier-select] [role="radiogroup"]').screenshot({ path: `${OUT}/01-raise-group.png` });

  {
    /* The squint shot, from a clean flow: Tier 2 chosen, nothing in error. */
    const q = await open("/app/chat/t14");
    await openRaise(q.page);
    await q.page.locator('[data-tier-row="2"]').click();
    await q.page.mouse.move(0, 0);
    await q.page.waitForTimeout(250);
    await q.page.locator("[data-tier-select]").screenshot({ path: `${OUT}/squint-raise.png` });
    await q.ctx.close();
  }
  await page.locator("[data-tier-field=note]").fill("They said they are not okay tonight.");
  await page.locator("[data-tier-cta]").click();
  await page.waitForTimeout(600);
  const st = await store(page);
  const e = st.escalations?.t14;
  check(e?.requested === 2 && e.contextNote === "They said they are not okay tonight." && st.tierEvents.at(-1)?.kind === "requested" && st.tierEvents.at(-1)?.tier === 2, "Confirm: the escalation opens with Tier 2 requested and the note on the record", JSON.stringify({ requested: e?.requested, ev: st.tierEvents.at(-1)?.kind }));
  check(page.__errors.length === 0, "no page errors", page.__errors.join(" | "));
  await ctx.close();

  /* Jordan is Tier 3: the current row is tagged, and is not a choice. */
  const j = await open("/app/chat/t13");
  await openRaise(j.page);
  const rj = await rows(j.page);
  const three = rj.find((r) => r.tier === "3");
  check(three?.tag === "Current" && three.disabled === "true" && three.tab === -1, "the teen's current tier carries a quiet Current tag (raise: information, not a choice)", JSON.stringify(three && { tag: three.tag, d: three.disabled }));
  await j.ctx.close();
}

// ── THE ASSESSED RECORD (the supervisor's S1) ──────────────────────────────
let assessed;
{
  const { ctx, page } = await open("/app/chat/t13", { chat: "escalation-active" });
  for (const id of ["q3:yes", "q4:no", "q5:no", "q6:yes", "q6b:no"]) {
    await page.locator(`[data-yes-no="${id}"]`).click();
    await page.waitForTimeout(420);
  }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Jordan has a plan involving pills and gave away her headphones yesterday.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(500);
  assessed = await store(page);
  await ctx.close();
}
const s1 = (o = {}) => open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active", extra: { escalations: assessed.escalations, tierEvents: assessed.tierEvents }, ...o });

// ── 2 · REVIEW — CONFIRM-TIER ──────────────────────────────────────────────
console.log("\n── 2 · review mode, the confirm-tier step");
const transcript = [];
{
  const { ctx, page } = await s1();
  const head = await page.evaluate(() => { const h = document.querySelector("[data-tier-submitted]"); return { text: h?.querySelector("p")?.textContent, time: h?.querySelector("span.tabular-nums")?.textContent, avatar: !!h?.querySelector("[data-record-avatar]") }; });
  check(head.text === "Submitted by the mentor" && /\d:\d\d (AM|PM)/.test(head.time ?? "") && head.avatar, "the header row: avatar · Submitted by {mentor} · timestamp (unnamed, the role is said once)", JSON.stringify(head));
  const r = await rows(page, "[data-s1]");
  check(r.map((x) => x.tier).join() === "1,2,3,4", "Tiers 1–4", r.map((x) => x.tier).join());
  check(r.every((x) => x.desc === CRITERIA[x.tier] && x.name === CANON[x.tier]), "each row: the canon name and the clinical criteria, verbatim", JSON.stringify(r.map((x) => x.desc?.slice(0, 30))));
  const one = r[0];
  check(one.checked === "true" && one.tagKind === "requested" && /^Requested by (the mentor|\S+) · \d{1,2}:\d\d (AM|PM)$/.test(one.tag ?? "") && !/Requested by The /.test(one.tag) && one.tab === 0, "the request arrives checked, tagged Requested by {mentor} · {time}, the one tab stop", JSON.stringify({ c: one.checked, tag: one.tag }));
  check(r.find((x) => x.tier === "3")?.tag === "Current" && r.find((x) => x.tier === "3")?.disabled === null, "Jordan's current tier (3) is tagged Current — checkable in review", JSON.stringify(r.find((x) => x.tier === "3")?.tag));
  const reason = await page.evaluate(() => document.querySelector("[data-tier-field=reason]")?.value);
  const rLabel = await page.evaluate(() => { const t = document.querySelector("[data-tier-field=reason]"); return document.querySelector(`label[for="${t.id}"]`)?.textContent; });
  check(/^Reviewed (the mentor|\S+)’s note: “Jordan said/.test(reason ?? "") && rLabel === "Reason — posted to the record", "the reason: seeded with neutral framing of the mentor's note, editable", String(reason).slice(0, 60));
  const c1 = await cta(page);
  check(c1.text === "Confirm Tier 1 · Active crisis" && c1.kind === "confirm", "the CTA: Confirm Tier 1 · Active crisis", c1.text);
  check((await filled(page, "[data-s1]")).length === 1, "one filled button in the panel state", (await filled(page, "[data-s1]")).join(" | "));
  const census = await alertCensus(page, "[data-s1]");
  check(census.every((c) => /^lozenge T[12]$|inside lozenge/.test(c)), "neutral until confirmed: alert colour on the Tier 1–2 lozenges only", census.join(", "));

  /* ═══ THE SCREEN-READER TRANSCRIPT ═══ Tab into the group, then arrows.
     Read off CHROME'S OWN ACCESSIBILITY TREE (CDP), not the attributes —
     the computed role, name, description and checked state an AT is given,
     so the glyph's removal is proven not to have taken the semantics. */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  const said = async () => {
    const { result } = await cdp.send("Runtime.evaluate", { expression: "document.activeElement" });
    const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { objectId: result.objectId, fetchRelatives: false });
    const n = nodes.find((x) => !x.ignored) ?? nodes[0];
    const prop = (k) => n.properties?.find((p) => p.name === k)?.value?.value;
    const dom = await page.evaluate(() => {
      const a = document.activeElement;
      const group = a.closest('[role="radiogroup"]');
      return { group: group ? document.getElementById(group.getAttribute("aria-labelledby"))?.textContent : null, live: document.querySelector("[data-tier-live]")?.textContent };
    });
    const checked = prop("checked");
    return { role: n.role?.value, name: n.name?.value, desc: n.description?.value ?? null, checked: checked === undefined ? null : String(checked) === "true" ? "true" : "false", ...dom };
  };
  /* Into the group the way a reader arrives from the field below it. */
  await page.locator("[data-tier-field=reason]").focus();
  await page.keyboard.press("Shift+Tab");
  const t0 = await said();
  transcript.push(["Shift+Tab", t0]);
  check(t0.role === "radio" && t0.name === "Tier 1, Active crisis" && t0.checked === "true" && /^Requested by (the mentor|\S+) at \d{1,2}:\d\d (AM|PM)\. /.test(t0.desc ?? "") && t0.desc.endsWith(CRITERIA[1]), "Shift+Tab into the group lands on the request: radio \"Tier 1, Active crisis\", checked — then \"Requested by {mentor} at {time}\" and the criteria", JSON.stringify(t0));
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  const t1 = await said();
  transcript.push(["ArrowDown", t1]);
  const c2 = await cta(page);
  check(t1.role === "radio" && t1.name === "Tier 2, High risk" && t1.checked === "true" && t1.desc === CRITERIA[2] && c2.text === "Confirm Tier 2 · High risk" && t1.live === "Button now reads Confirm Tier 2 · High risk", "override by arrow: Tier 2 checked, the CTA relabels, and the live region says so", JSON.stringify({ name: t1.name, cta: c2.text, live: t1.live }));
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  const t2 = await said();
  transcript.push(["ArrowDown", t2]);
  const cons = await page.evaluate(() => document.querySelector("[data-tier-consequence]")?.textContent);
  check(t2.name === "Tier 3, Medium risk" && /^Current tier\. /.test(t2.desc ?? "") && /standard tier update/.test(cons ?? ""), "Tier 3: described as the current tier, and the consequence line says it closes the escalation", JSON.stringify({ name: t2.name, cons }));
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  transcript.push(["ArrowUp", await said()]);
  await page.keyboard.press("Tab");
  const tf = await said();
  transcript.push(["Tab", tf]);
  check(tf.role === "textbox" && tf.name === "Reason — posted to the record", "Tab leaves the group in one stop, to the reason", JSON.stringify(tf));
  await page.keyboard.press("Tab");
  const tc = await said();
  transcript.push(["Tab", tc]);
  check(tc.role === "button" && tc.name === "Confirm Tier 2 · High risk", "then the CTA, reading the override", JSON.stringify(tc));
  await page.locator("[data-s1]").screenshot({ path: `${OUT}/02-review-override.png` });

  await page.locator("[data-tier-cta]").click();
  await page.waitForTimeout(600);
  const st = await store(page);
  const ev = st.tierEvents.at(-1);
  /* The store's own rule: confirming the REQUEST is `confirmed`; any other
     tier is a placement (`useTiering().confirm`). */
  check(ev?.kind === "placed" && ev.tier === 2 && /^Reviewed /.test(ev.reason) && st.escalations.t13.confirmedTier === 2, "override → confirm: a Tier 2 placement, appended, with the reason, and the escalation confirmed at Tier 2", JSON.stringify({ kind: ev?.kind, tier: ev?.tier, n: st.tierEvents.length - assessed.tierEvents.length }));
  check(st.tierEvents.slice(0, assessed.tierEvents.length).every((e, i) => JSON.stringify(e) === JSON.stringify(assessed.tierEvents[i])), "append-only: every earlier event is untouched", "");
  check(page.__errors.length === 0, "no page errors", page.__errors.join(" | "));
  await ctx.close();
}
{
  /* Confirm as-is. */
  const { ctx, page } = await s1();
  await page.locator("[data-s1]").screenshot({ path: `${OUT}/squint-review.png` });
  await page.locator("[data-tier-cta]").click();
  await page.waitForTimeout(600);
  const st = await store(page);
  check(st.tierEvents.at(-1)?.kind === "confirmed" && st.tierEvents.at(-1)?.tier === 1 && st.escalations.t13.confirmedTier === 1, "pre-checked → confirm as-is: Tier 1 confirmed", JSON.stringify(st.tierEvents.at(-1)?.tier));
  await ctx.close();
}

{
  /* A named mentor: "Requested by Alex", the full name in the header, the
     first name in the seed. */
  const { ctx, page } = await s1({ extra: { escalations: assessed.escalations, tierEvents: assessed.tierEvents, draft: { firstName: "Alex", lastName: "Rivera" } } });
  const r = (await rows(page, "[data-s1]"))[0];
  const head = await page.evaluate(() => document.querySelector("[data-tier-submitted] p")?.textContent);
  const reason = await page.evaluate(() => document.querySelector("[data-tier-field=reason]")?.value);
  check(/^Requested by Alex · /.test(r.tag ?? "") && head === "Submitted by Alex Rivera · Mentor" && /^Reviewed Alex’s note/.test(reason ?? "") && /^Requested by Alex at /.test(r.described), "named: Requested by Alex · {time}; Submitted by Alex Rivera · Mentor; Reviewed Alex’s note", JSON.stringify({ tag: r.tag, head }));
  await ctx.close();
}

// ── 3 · REVIEW — UPDATE TIER ───────────────────────────────────────────────
console.log("\n── 3 · review mode, the Update tier flow");
{
  /* Imani is Tier 2: T4 is two steps down, so the movement rule refuses it. */
  const { ctx, page } = await open("/admin/person/t21", { persona: "supervisor" });
  await page.locator('[data-tier-action="update-tier"]').click();
  await page.waitForTimeout(350);
  const kind = await page.evaluate(() => document.querySelector("[data-tier-select]")?.dataset.tierKind);
  const r = await rows(page);
  const two = r.find((x) => x.tier === "2");
  check(kind === "update" && r.map((x) => x.tier).join() === "1,2,3,4" && two.checked === "true" && two.tag === "Current" && r.every((x) => x.tagKind !== "requested"), "steady state: Tiers 1–4, the current tier checked and tagged, no Requested tag", JSON.stringify({ kind, c: two?.checked }));
  check(r.every((x) => x.desc === CRITERIA[x.tier]), "the same criteria as the confirm step", "");
  const four = r.find((x) => x.tier === "4");
  check(four.disabled === "true" && four.why === "Steps down one tier at a time" && /Steps down one tier at a time$/.test(four.described), "the movement rule shows, disabled, with its reason — in words and in the accessible description", JSON.stringify({ d: four.disabled, why: four.why }));
  check((await cta(page)).text === "Choose a new tier", "with the current tier checked the CTA does not promise a no-op: Choose a new tier", (await cta(page)).text);
  await page.locator("[data-tier-cta]").click();
  await page.waitForTimeout(150);
  const gap = await page.evaluate(() => ({ err: document.querySelector('[data-tier-error="tier"]')?.textContent, focus: document.activeElement?.closest("[data-tier-row]")?.dataset.tierRow }));
  check(gap.err === "Tier 2 is current — choose another tier." && gap.focus === "2", "pressed, it names the gap and returns focus to the group", JSON.stringify(gap));
  await page.locator('[data-tier-row="4"]').click({ force: true });
  check((await rows(page)).find((x) => x.tier === "4").checked === "false", "a disabled card cannot be selected", "");
  await page.locator('[data-tier-row="1"]').click();
  await page.waitForTimeout(150);
  check((await cta(page)).text === "Update to Tier 1" && !(await page.evaluate(() => document.querySelector('[data-tier-error="tier"]'))), "checking Tier 1: Update to Tier 1, and the gap clears", (await cta(page)).text);
  await page.locator('[data-tier-row="3"]').click();
  await page.waitForTimeout(150);
  const lab = await page.evaluate(() => { const t = document.querySelector("[data-tier-field=reason]"); return document.querySelector(`label[for="${t.id}"]`)?.textContent; });
  check((await cta(page)).text === "Update to Tier 3" && lab === "Exit document — why Imani is ready to step down", "a step down: Update to Tier 3, and the reason becomes the exit document", JSON.stringify({ cta: (await cta(page)).text, lab }));
  await page.locator('[data-slot="tier-update-dialog"]').screenshot({ path: `${OUT}/03-update.png` });
  await page.locator("[data-tier-field=reason]").fill("Calmer week; her aunt is home every evening.");
  const n0 = (await store(page)).tierEvents?.length ?? 0;
  await page.locator("[data-tier-cta]").click();
  await page.waitForTimeout(500);
  const st = await store(page);
  check(st.tierEvents.length === n0 + 1 && st.tierEvents.at(-1).tier === 3 && st.tierEvents.at(-1).reason === "Calmer week; her aunt is home every evening." && !(await page.evaluate(() => !!document.querySelector('[data-slot="tier-update-dialog"]'))), "update: one Tier 3 event, appended, and the dialog closes", JSON.stringify(st.tierEvents.at(-1)?.kind));
  await ctx.close();
}
{
  /* A pending step-down request, from the mentor's side first. */
  const m = await open("/admin/person/t19", { persona: "mentor" });
  await m.page.locator('[data-tier-action="request-step-down"]').click();
  await m.page.waitForTimeout(300);
  await m.page.locator('[data-slot="step-down-dialog"] [data-tier-reason]').fill("Two good weeks; she's sleeping again.");
  await m.page.locator('[data-tier-submit="request"]').click();
  await m.page.waitForTimeout(400);
  const asked = await store(m.page);
  await m.ctx.close();
  const { ctx, page } = await open("/admin/person/t19", { persona: "supervisor", extra: { tierEvents: asked.tierEvents } });
  await page.locator('[data-tier-action="update-tier"]').click();
  await page.waitForTimeout(350);
  const r = await rows(page);
  const four = r.find((x) => x.tier === "4");
  const reason = await page.evaluate(() => document.querySelector("[data-tier-field=reason]")?.value);
  const keep = await page.evaluate(() => document.querySelector('[data-tier-secondary="decline"]')?.textContent);
  check(four.checked === "true" && four.tagKind === "requested" && /^Requested by (the mentor|\S+) · /.test(four.tag ?? "") && !/Requested by The /.test(four.tag) && r.find((x) => x.tier === "3").tag === "Current", "a pending request arrives checked and tagged; the current tier keeps its tag", JSON.stringify({ tag: four.tag }));
  check((await cta(page)).text === "Confirm Tier 4 · General" && /^Reviewed (the mentor|\S+)’s request: “Two good weeks/.test(reason ?? "") && keep === "Keep in Tier 3", "the CTA confirms it in full; the reason quotes the request; Keep in Tier 3 declines", JSON.stringify({ cta: (await cta(page)).text, keep }));
  check((await filled(page, '[data-slot="tier-update-dialog"]')).length === 1, "one filled button — Keep is the ghost", (await filled(page, '[data-slot="tier-update-dialog"]')).join(" | "));
  await page.locator('[data-tier-row="2"]').click();
  await page.waitForTimeout(120);
  const live = await page.evaluate(() => document.querySelector("[data-tier-live]")?.textContent);
  check((await cta(page)).text === "Update to Tier 2" && live === "Button now reads Update to Tier 2", "override the request: Update to Tier 2, announced", JSON.stringify({ live }));
  await page.locator('[data-tier-row="4"]').click();
  await page.locator("[data-tier-cta]").click();
  await page.waitForTimeout(500);
  const st = await store(page);
  check(st.tierEvents.at(-1)?.tier === 4 && st.tierEvents.length === asked.tierEvents.length + 1, "confirm the request: one Tier 4 event, appended", JSON.stringify(st.tierEvents.at(-1)?.kind));
  await ctx.close();
}

// ── 4 · ONE SKELETON, AND FIVE STATES PER TIER ────────────────────────────
console.log("\n── 4 · one skeleton across the modes; five states per tier");
{
  const { ctx, page } = await open("/app/chat/t14");
  await openRaise(page);
  const raise = (await rows(page))[0].anatomy;
  await ctx.close();
  const s = await s1();
  const review = (await rows(s.page, "[data-s1]"))[0].anatomy;
  await s.ctx.close();
  check(raise.join() === "lozenge,name,description" && review.join() === "lozenge,name,tag,description", "lozenge · name · description — the same card in raise and review (review adds the request's tag)", JSON.stringify({ raise, review }));
}
/** S1 with the request moved to tier `n`, so every tier can be shown
 *  pre-checked. A fixture edit for the screenshot only. */
const s1At = (n, o = {}) => {
  const esc = structuredClone(assessed.escalations);
  esc.t13.requested = n;
  const evs = structuredClone(assessed.tierEvents).map((e) => (e.kind === "requested" && e.escalationId === esc.t13.id ? { ...e, tier: n } : e));
  return open("/app/chat/t13", { persona: "supervisor", chat: "escalation-active", extra: { escalations: esc, tierEvents: evs }, ...o });
};
/** A card's shot with 6px of air, so a ring drawn outside it (the
 *  focus-visible outline) is in the picture. */
const shotOf = async (page, loc) => {
  const bb = await loc.boundingBox();
  return page.screenshot({ clip: { x: bb.x - 6, y: bb.y - 6, width: bb.width + 12, height: bb.height + 12 } });
};
const STATES = ["rest", "hover", "focus-visible", "selected", "requested"];
const grid = {};
const legendContrast = {};
for (const theme of ["light", "dark"]) {
  legendContrast[theme] = {};
  for (const t of [1, 2, 3, 4]) {
    const other = t === 1 ? 2 : 1;
    const { ctx, page } = await s1At(other, { theme });
    const card = page.locator(`[data-s1] [data-tier-row="${t}"]`);
    const measure = () => page.evaluate(([ENGINE, t]) => {
      eval(ENGINE);
      const { rgba, ratio, bgOf } = window.__c;
      const r2 = (x) => Math.round(x * 100) / 100;
      const c = document.querySelector(`[data-s1] [data-tier-row="${t}"]`);
      const nm = c.querySelector("[data-tier-lozenge] + span"), d = c.querySelector("[data-tier-row-description]"), l = c.querySelector("[data-tier-lozenge]");
      const ls = getComputedStyle(l);
      const lozBg = rgba(ls.backgroundColor)[3] > 0 ? rgba(ls.backgroundColor) : bgOf(c);
      const panel = bgOf(c.parentElement);
      return {
        name: r2(ratio(rgba(getComputedStyle(nm).color), bgOf(nm))),
        description: r2(ratio(rgba(getComputedStyle(d).color), bgOf(d))),
        lozenge: r2(ratio(rgba(ls.color), lozBg)),
        lozengeState: l.dataset.lozengeState,
        washVsPanel: r2(ratio(bgOf(c), panel)),
        borderVsWash: r2(ratio(rgba(getComputedStyle(c).borderTopColor), bgOf(c))),
        outline: getComputedStyle(c).outlineStyle !== "none" ? r2(ratio(rgba(getComputedStyle(c).outlineColor), panel)) : null,
      };
    }, [ENGINE, t]);
    const shots = [];
    const m = {};
    m.rest = await measure();
    shots.push(await shotOf(page, card));
    await card.hover();
    await page.waitForTimeout(220);
    m.hover = await measure();
    shots.push(await shotOf(page, card));
    await page.mouse.move(0, 0);
    await page.waitForTimeout(220);
    /* Keyboard modality, then focus — :focus-visible, without selecting. */
    await page.keyboard.press("Shift");
    await page.locator(`[data-s1] [data-tier-input="${t}"]`).focus();
    await page.waitForTimeout(80);
    m["focus-visible"] = await measure();
    shots.push(await shotOf(page, card));
    await page.locator("[data-tier-submitted]").click();
    await card.click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(320);
    m.selected = await measure();
    shots.push(await shotOf(page, card));
    await ctx.close();
    const q = await s1At(t, { theme });
    await q.page.waitForTimeout(320);
    shots.push(await shotOf(q.page, q.page.locator(`[data-s1] [data-tier-row="${t}"]`)));
    await q.ctx.close();
    grid[`${theme}-${t}`] = shots.map((x) => x.toString("base64"));
    legendContrast[theme][`T${t}`] = m;
    const texts = ["rest", "hover", "selected"].flatMap((k) => [m[k].name, m[k].description, m[k].lozenge]);
    check(texts.every((v) => v >= 4.5), `${theme} T${t}: name, description and lozenge clear 4.5:1 on the wash at rest, on hover and selected`, ["rest", "hover", "selected"].map((k) => `${k} ${m[k].name}/${m[k].description}/${m[k].lozenge}`).join(" · "));
    check(m.rest.lozengeState === "outline" && m.selected.lozengeState === "filled" && m["focus-visible"].outline !== null && m["focus-visible"].outline >= 3, `${theme} T${t}: outline at rest, filled selected; the focus ring clears 3:1 against the panel`, `focus ${m["focus-visible"].outline}`);
  }
}
{
  /* The grid: tiers down, states across, both themes. */
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const cell = (x) => `<td style="padding:6px;vertical-align:top"><img src="data:image/png;base64,${x}" style="width:280px;display:block"></td>`;
  const table = (theme) => `<h2 style="font:600 14px system-ui;margin:16px 0 4px">${theme}</h2><table style="border-collapse:collapse"><tr><th></th>${STATES.map((s) => `<th style="font:12px system-ui;text-align:left;padding:0 6px">${s}</th>`).join("")}</tr>${[1, 2, 3, 4].map((t) => `<tr><th style="font:12px system-ui;padding-right:8px">T${t}</th>${grid[`${theme}-${t}`].map(cell).join("")}</tr>`).join("")}</table>`;
  await p.setContent(`<body style="margin:0;padding:16px;background:#fff">${table("light")}${table("dark")}</body>`);
  await p.screenshot({ path: `${OUT}/06-five-states.png`, fullPage: true });
}

// ── 6 · CONTRAST ───────────────────────────────────────────────────────────
console.log("\n── 6 · contrast, both themes: the ring, the tag");
const contrast = {};
for (const theme of ["light", "dark"]) {
  const { ctx, page } = await s1({ theme });
  const m = await page.evaluate((ENGINE) => {
    eval(ENGINE);
    const { rgba, ratio, bgOf } = window.__c;
    const r2 = (x) => Math.round(x * 100) / 100;
    const out = {};
    const row = document.querySelector('[data-s1] [data-tier-row][data-tier-checked="true"]');
    out["emphasis ring vs its wash"] = r2(ratio(rgba(getComputedStyle(row).borderTopColor), bgOf(row)));
    out["emphasis ring vs panel"] = r2(ratio(rgba(getComputedStyle(row).borderTopColor), bgOf(row.parentElement)));
    const ck = row.querySelector("[data-tier-check]");
    out["check glyph vs its wash"] = r2(ratio(rgba(getComputedStyle(ck).color), bgOf(row)));
    const tag = document.querySelector('[data-s1] [data-tier-row-tag="requested"]');
    out["Requested by tag"] = r2(ratio(rgba(getComputedStyle(tag).color), bgOf(tag)));
    return out;
  }, ENGINE);
  contrast[theme] = m;
  check(m["Requested by tag"] >= 4.5, `${theme}: the Requested by tag clears 4.5:1`, String(m["Requested by tag"]));
  check(m["emphasis ring vs its wash"] >= 3 && m["emphasis ring vs panel"] >= 3 && m["check glyph vs its wash"] >= 3, `${theme}: the ring and the check clear 3:1 (non-text) on the wash and the panel`, JSON.stringify(m));
  await page.locator("[data-s1]").screenshot({ path: `${OUT}/04-review-${theme}.png` });
  await ctx.close();
}

// ── 7 · MOTION ─────────────────────────────────────────────────────────────
console.log("\n── 7 · motion, and reduced motion");
for (const reduce of [false, true]) {
  const { ctx, page } = await s1({ reduce });
  const m0 = await page.evaluate(() => ({ row: getComputedStyle(document.querySelector("[data-tier-requested]")).animationName, tag: getComputedStyle(document.querySelector('[data-tier-row-tag="requested"]')).animationName }));
  await page.locator('[data-s1] [data-tier-row="2"]').click();
  await page.waitForTimeout(30);
  const m1 = await page.evaluate(() => {
    const c = document.querySelector('[data-s1] [data-tier-row="2"]');
    const l = getComputedStyle(c.querySelector("[data-tier-lozenge]"));
    return { check: getComputedStyle(c.querySelector("[data-tier-check]")).animationName, fill: l.transitionDuration, prop: l.transitionProperty };
  });
  if (!reduce) check(m0.row === "tier-hold" && m0.tag === "tier-settle" && m1.check === "tier-check" && m1.fill === "0.15s", "the request settles in one beat (ring + tag); selecting fills the lozenge and lands the check in one beat", JSON.stringify({ ...m0, ...m1 }));
  else check(m0.row === "none" && m0.tag === "none" && m1.check === "none" && (m1.fill === "0s" || m1.prop === "none"), "reduced motion: an instant state swap — nothing animates", JSON.stringify({ ...m0, ...m1 }));
  await ctx.close();
}

// ── 8 · SOURCE PROOFS ──────────────────────────────────────────────────────
console.log("\n── 8 · source proofs");
{
  async function walk(dir) {
    const out = [];
    for (const d of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, d.name);
      if (d.isDirectory()) out.push(...(await walk(p)));
      else if (/\.(tsx?|mjs|css)$/.test(d.name)) out.push(p);
    }
    return out;
  }
  const files = [...(await walk("src")), ...(await walk("scripts/responsive"))].filter((f) => !f.endsWith("tier-select.mjs"));
  const swapped = [];
  const casing = [];
  const OFF = Object.entries(CANON).flatMap(([n]) => Object.entries(CANON).filter(([m]) => m !== n).map(([m]) => [n, CANON[m]]));
  for (const f of files) {
    const src = await readFile(f, "utf8");
    for (const [n, wrong] of OFF) {
      const re = new RegExp(`(?:\\bT${n}|Tier ${n}|\\b${n}:)\\s*(?:·|-|—|:)?\\s*"?${wrong}\\b`, "g");
      for (const hit of src.match(re) ?? []) swapped.push(`${f}: ${hit}`);
    }
    for (const hit of src.match(/Active risk|Medium Risk|High Risk|Active Crisis|iminence/g) ?? []) casing.push(`${f}: ${hit}`);
  }
  check(swapped.length === 0, "zero swapped tier pairings in src and the probes", swapped.slice(0, 4).join(" | "));
  check(casing.length === 0, 'zero "Active risk" / "Medium Risk" (and siblings), zero "iminence"', casing.slice(0, 4).join(" | "));
  const ts = await readFile("src/components/tiering/tier-select.tsx", "utf8");
  const glyph = ts.match(/role="radio"|size-2 rounded-full|A real radio mark/g) ?? [];
  check(glyph.length === 0 && /type="radio"/.test(ts) && /className="sr-only"/.test(ts), "zero radio glyphs in TierSelect — the radio is a native input, visually hidden", glyph.join(", "));
  const src = files.filter((f) => f.startsWith("src"));
  const legend = [];
  for (const f of src) {
    const x = await readFile(f, "utf8");
    if (/--tier-legend-/.test(x)) legend.push(f.replace(/^src\//, ""));
  }
  const washes = [];
  for (const f of src) {
    const x = await readFile(f, "utf8");
    if (/tier-legend-\$\{[^}]+\}-wash|tier-legend-\d-wash/.test(x) && !f.endsWith("settings-tokens.css")) washes.push(f.replace(/^src\//, ""));
  }
  check(washes.join() === "components/tiering/tier-select.tsx" && legend.every((f) => ["components/tiering/tier-select.tsx", "components/ui/tier-lozenge.tsx", "app/settings-tokens.css"].includes(f)), "the legend washes are read by TierSelect alone (the lozenge reads only the inks)", JSON.stringify({ washes, legend }));
  /* Not a v10.1 regression, reported: the T1–2 tints that predate this pack. */
  const prior = [];
  for (const f of src) {
    const x = await readFile(f, "utf8");
    if (/--t[12]-soft/.test(x) && !f.endsWith(".css")) prior.push(f.replace(/^src\//, ""));
  }
  console.log(`  · pre-existing Tier 1–2 tints outside TierSelect (out of scope, listed): ${prior.join(", ")}`);
  const all = (await Promise.all(src.map((f) => readFile(f, "utf8")))).join("\n");
  const retired = ["data-raise-option", "data-s1-tier", "data-tier-option", "Adjust to Tier", "Post update"].filter((x) => all.includes(x));
  check(retired.length === 0, "both retired controls are gone: no raise radio list, no confirm grid, no update grid", retired.join(", "));
  const tierRadios = [];
  for (const f of src.filter((f) => !f.endsWith("tier-select.tsx"))) {
    const x = await readFile(f, "utf8");
    if (/role="radio"[\s\S]{0,400}TierLozenge|TIER_NAME\[t\][\s\S]{0,200}role="radio"|type="radio"[\s\S]{0,400}TierLozenge/.test(x)) tierRadios.push(f);
  }
  check(tierRadios.length === 0, "TierSelect is the only tier radiogroup in the app", tierRadios.join(", "));
  await writeFile(`${OUT}/legend-contrast.json`, JSON.stringify(legendContrast, null, 2));
}

// ── 5 · SR TRANSCRIPT, and 9 · SQUINT ──────────────────────────────────────
{
  const lines = transcript.map(([key, t]) => `| ${key} | ${t.role} | ${t.name}${t.checked ? `, ${t.checked === "true" ? "checked" : "not checked"}` : ""} | ${t.desc ?? ""} | ${t.live ?? ""} |`);
  await writeFile(
    `${OUT}/SR-TRANSCRIPT.md`,
    `# Screen-reader transcript — review mode, the confirm-tier step\n\nGenerated by \`scripts/responsive/tier-select.mjs\` §2: the role, accessible name, state and description of the focused element, and the polite live region, after each key. Group label: "${transcript[0]?.[1].group}".\n\n| Key | Role | Name, state | Description | Live region |\n|---|---|---|---|---|\n${lines.join("\n")}\n`
  );
  const p = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
  const img = async (f) => `data:image/png;base64,${(await readFile(`${OUT}/${f}`)).toString("base64")}`;
  await p.setContent(`<body style="margin:0;padding:24px;background:#fff;display:flex;gap:24px;align-items:flex-start;font:12px system-ui"><figure style="margin:0"><img src="${await img("squint-raise.png")}" style="width:440px;filter:blur(3px)"><figcaption>Raise (mentor)</figcaption></figure><figure style="margin:0"><img src="${await img("squint-review.png")}" style="width:440px;filter:blur(3px)"><figcaption>Review — confirm-tier (supervisor)</figcaption></figure></body>`);
  await p.screenshot({ path: `${OUT}/05-squint.png`, fullPage: true });
  await writeFile(`${OUT}/contrast.json`, JSON.stringify(contrast, null, 2));
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
