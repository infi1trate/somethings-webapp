// ═══════════════════════════════════════════════════════════════════════════
// MONITORING · WATCH (Monitoring v2, Part B) — the elevation pass, measured
//
//   LIST
//   1  one raised container (24px, soft elevation, 16px in); the column
//      header is its sticky first row, on the cell grid, over a hairline
//   2  tier groups are section rows: dot · name · count · cadence on ONE line;
//      the Tier 1 lane is the first section
//   3  mono only on numerals and timestamps
//   4  hover: the row lifts 2px, the shadow steps up, a chevron fades in; the
//      whole row is the link; reduced motion keeps it still
//   5  the focus ring: 1px border-focus, 2px off, a soft halo
//
//   CARDS
//   6  the default view; 3-up at 1440, 2-up at 1200; the whole card is the
//      link; hover and keyboard focus lift it; reduced motion keeps it still
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open({ layout = "list", scenario = "tiers-alert", width = 1440, height = 900, reducedMotion } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, reducedMotion });
  await ctx.addInitScript(
    ([k, v, layout]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        if (layout) localStorage.setItem("somethings.monitoring.layout", layout);
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona: "supervisor", monitoringScenarioId: scenario }, version: VERSION }, layout]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/monitoring`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const tok = (page, v, prop = "color") =>
  page.evaluate(([v, prop]) => {
    const e = document.createElement("span");
    if (prop === "shadow") e.style.boxShadow = `var(${v})`;
    else e.style[prop === "bg" ? "backgroundColor" : "color"] = `var(${v})`;
    document.body.appendChild(e);
    const s = getComputedStyle(e);
    const c = prop === "shadow" ? s.boxShadow : s[prop === "bg" ? "backgroundColor" : "color"];
    e.remove();
    return c;
  }, [v, prop]);

// ── 1 · ONE CONTAINER, STICKY HEADER ──────────────────────────────────────
console.log("\n── 1 · one container; the header is its sticky first row");
{
  const { ctx, page } = await open();
  const c = await page.evaluate(() => {
    const box = document.querySelector("[data-monitoring-list-scroll]");
    const s = getComputedStyle(box);
    const head = document.querySelector("[data-list-header]");
    const hrow = head.querySelector('[role="row"]');
    const hs = getComputedStyle(hrow);
    const firstCell = head.querySelector('[role="columnheader"]').getBoundingClientRect();
    const hb = hrow.getBoundingClientRect();
    return {
      radius: s.borderRadius, bg: s.backgroundColor, shadow: s.boxShadow, pad: `${s.paddingLeft} ${s.paddingRight} ${s.paddingBottom}`, overflowY: s.overflowY,
      /* The gap ABOVE the hairline: the row's bottom minus the cell's, less the hairline itself. */
      sticky: getComputedStyle(head).position, hair: `${hs.borderBottomWidth} ${hs.borderBottomColor}`, gapAbove: Math.round(hb.bottom - firstCell.bottom - parseFloat(hs.borderBottomWidth)),
      headFs: getComputedStyle(head.querySelector('[role="columnheader"]')).fontSize, headColor: getComputedStyle(head.querySelector('[role="columnheader"]')).color,
      inBox: box.contains(head) && !!box.querySelector('[data-tier-group="1"]'),
    };
  });
  const [raised, elSoft, subtle, tertiary] = [await tok(page, "--surface-raised", "bg"), await tok(page, "--el-soft", "shadow"), await tok(page, "--border-subtle"), await tok(page, "--text-tertiary")];
  /* Tailwind v4's shadow utility prepends four transparent ring layers;
     the token is what it ENDS with. */
  check(c.radius === "24px" && c.bg === raised && c.shadow.endsWith(elSoft) && c.pad === "16px 16px 16px" && c.inBox, "the whole list in one raised container: 24px, soft elevation, 16px in", JSON.stringify({ r: c.radius, pad: c.pad }));
  check(c.sticky === "sticky" && c.hair === `1px ${subtle}` && c.gapAbove === 12 && c.headFs === "12px" && c.headColor === tertiary, "the header row: sticky, 12/16 tertiary, 12px above a border-subtle hairline", JSON.stringify({ sticky: c.sticky, gap: c.gapAbove, hair: c.hair }));
  /* Aligned to the cells, in every tier. */
  const align = await page.evaluate(() => {
    const hx = [...document.querySelectorAll('[data-list-header] [role="columnheader"]')].map((h) => Math.round(h.getBoundingClientRect().left));
    const rows = [...document.querySelectorAll("[data-monitoring-row]")].map((r) => [...r.querySelectorAll(':scope > [role="cell"]')].map((x) => Math.round(x.getBoundingClientRect().left)));
    const first = rows[0];
    /* A cell's first CONTENT is the avatar / text, 16px in from the row's edge. */
    const avatar = Math.round(document.querySelector("[data-monitoring-row] [data-tier-avatar]").getBoundingClientRect().left);
    return { hx, first, all: rows.every((r) => r.every((x, i) => x === first[i])), avatar };
  });
  check(align.all && align.hx.slice(1).every((x, i) => Math.abs(x - align.first[i + 1]) <= 1) && Math.abs(align.hx[0] - align.avatar) <= 1, "headers sit exactly over their cells — Teen over the avatar", `${align.hx.join(",")} / ${align.first.join(",")}`);
  /* Sticky against the PAGE: scroll the canvas, the header pins at the top. */
  const pinned = await page.evaluate(async () => {
    const sc = [...document.querySelectorAll("*")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 200);
    const target = sc ?? document.scrollingElement;
    const top0 = document.querySelector("[data-list-header]").getBoundingClientRect().top;
    target.scrollTop = 700;
    await new Promise((r) => setTimeout(r, 250));
    const h = document.querySelector("[data-list-header]").getBoundingClientRect();
    const scTop = sc ? sc.getBoundingClientRect().top : 0;
    const under = [...document.querySelectorAll("[data-monitoring-row]")].some((r) => { const b = r.getBoundingClientRect(); return b.top < h.bottom - 1 && b.bottom > h.top + 1 && b.top > h.top; });
    return { moved: Math.round(top0 - h.top), top: Math.round(h.top - scTop), bg: getComputedStyle(document.querySelector("[data-list-header]")).backgroundColor, zi: getComputedStyle(document.querySelector("[data-list-header]")).zIndex, under };
  });
  check(pinned.moved > 100 && Math.abs(pinned.top) <= 1 && pinned.bg !== "rgba(0, 0, 0, 0)", "scrolled 700px: the header pins at the top of the canvas, opaque over the rows", JSON.stringify(pinned));
  await ctx.close();
}

// ── 2 · SECTION ROWS ──────────────────────────────────────────────────────
console.log("\n── 2 · tier groups as section rows; the lane first");
{
  const { ctx, page } = await open();
  const g = await page.evaluate(() =>
    [...document.querySelectorAll("[data-tier-header]")].map((h) => {
      const h3 = h.querySelector("h3");
      const dot = h3.querySelector("span[aria-hidden]");
      const name = h3.querySelector(".font-display");
      const cad = h3.querySelector("[data-tier-cadence]");
      return {
        tier: h.dataset.tierHeader,
        oneLine: Math.round(h3.getBoundingClientRect().height) <= 24 || Math.abs(cad.getBoundingClientRect().top - name.getBoundingClientRect().top) <= 3,
        cadFs: getComputedStyle(cad).fontSize, cadW: getComputedStyle(cad).fontWeight, cadText: cad.textContent,
        dot: Math.round(dot.getBoundingClientRect().width), nameFs: getComputedStyle(name).fontSize,
        count: getComputedStyle(h3.querySelector(".font-mono")).fontFamily,
      };
    })
  );
  check(g.length === 4 && g[0].tier === "1", "four section rows, Tier 1 first — the lane is its only row", g.map((x) => x.tier).join(","));
  check(g.every((x) => x.oneLine && x.cadFs === "13px" && x.cadW === "400" && /^· /.test(x.cadText)), "the cadence on the same line, after a middle dot, 13px regular", JSON.stringify(g.map((x) => x.oneLine)));
  check(g.every((x) => x.dot === 8 && x.nameFs === "14px" && /mono/i.test(x.count)), "an 8px dot, the name 14, the count in mono", JSON.stringify(g[0]));
  await ctx.close();
}

// ── 3 · MONO RETREATS ─────────────────────────────────────────────────────
console.log("\n── 3 · mono only on numerals and timestamps");
{
  const { ctx, page } = await open();
  const m = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("[data-monitoring-list] *")) {
      if (el.children.length) continue;
      const t = el.textContent.trim();
      if (!t || el.closest(".sr-only")) continue;
      if (!/mono/i.test(getComputedStyle(el).fontFamily)) continue;
      /* A numeral, a clock, or a numeral with its unit glued on is fine. */
      if (!/^[\d:·\s]+$/.test(t) && !/^(Join · )?\d+:\d\d$/.test(t)) out.push(t.slice(0, 30));
    }
    return out;
  });
  check(m.length === 0, "nothing but numerals and clocks is set in mono", m.slice(0, 6).join(" | "));
  await ctx.close();
}

// ── 4 · HOVER, THE WHOLE ROW, REDUCED MOTION ──────────────────────────────
console.log("\n── 4 · hover lifts; the whole row is the link; reduced motion stays still");
{
  const { ctx, page } = await open();
  const row = page.locator('[data-monitoring-row="t21"]');
  const before = await row.evaluate((r) => ({ t: getComputedStyle(r).transform, chev: getComputedStyle(r.querySelector("[data-row-chevron]")).opacity, cursor: getComputedStyle(r).cursor, transition: getComputedStyle(r).transitionDuration }));
  /* Hover the MENTOR cell — not the name — and wait out the transition. By
     coordinates: the row's stretched link covers every cell (that is the
     point), so an element hover would be intercepted by it. */
  const at = async (loc) => { const bb = await loc.boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
  await page.mouse.move(...(await at(row.locator('[role="cell"]').nth(1))));
  await page.waitForTimeout(400);
  const after = await row.evaluate((r) => ({ t: getComputedStyle(r).transform, shadow: getComputedStyle(r).boxShadow, chev: getComputedStyle(r.querySelector("[data-row-chevron]")).opacity }));
  const hover = await tok(page, "--el-soft-hover", "shadow");
  check(before.chev === "0" && before.cursor === "pointer" && /0\.16s/.test(before.transition), "at rest: chevron hidden, a pointer, a 160ms transition", JSON.stringify(before));
  check(/matrix\(1, 0, 0, 1, 0, -2\)/.test(after.t) && after.shadow === hover && after.chev === "1", "hovered: up 2px, the hover shadow, the chevron in", JSON.stringify(after));
  await page.mouse.click(...(await at(row.locator('[role="cell"]').nth(3))));
  await page.waitForURL(/\/app\/chat\/t21/, { timeout: 8000 }).catch(() => {});
  check(/\/app\/chat\/t21$/.test(page.url()), "a click anywhere on the row — here the Days engaged cell — follows the row's link (Imani's conversation)", new URL(page.url()).pathname);
  await ctx.close();

  const rm = await open({ reducedMotion: "reduce" });
  const r2 = rm.page.locator('[data-monitoring-row="t21"]');
  const bb = await r2.locator('[role="cell"]').nth(1).boundingBox();
  await rm.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await rm.page.waitForTimeout(300);
  const still = await r2.evaluate((r) => ({ t: getComputedStyle(r).transform, shadow: getComputedStyle(r).boxShadow }));
  check(still.t === "none" && still.shadow !== "none", "reduced motion: no lift, but the shadow still answers the hover", JSON.stringify(still));
  await rm.ctx.close();
}

// ── 5 · THE FOCUS RING ────────────────────────────────────────────────────
console.log("\n── 5 · the focus ring");
{
  const { ctx, page } = await open();
  await page.locator('[data-monitoring-row="t21"] [data-entry-link]').focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const f = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { el: document.activeElement?.dataset.entryLink, outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`, offset: s.outlineOffset, halo: s.boxShadow }; });
  const [focus, soft] = [await tok(page, "--border-focus"), await tok(page, "--border-focus-soft")];
  check(f.outline === `1px solid ${focus}` && f.offset === "2px" && f.halo.includes(soft.replace(/\s/g, " ")), "keyboard focus: 1px border-focus, 2px off, inside a soft periwinkle halo", JSON.stringify(f));
  await page.waitForTimeout(300); // the lift's 160ms transition
  const lifted = await page.evaluate(() => getComputedStyle(document.querySelector('[data-monitoring-row="t21"]')).transform);
  check(/-2\)$/.test(lifted), "and the focused row lifts, as hover does", lifted);
  await ctx.close();
}

// ── 6 · CARDS ─────────────────────────────────────────────────────────────
console.log("\n── 6 · cards: the default; the whole card is the link; it lifts");
{
  /* No saved layout: a new session. */
  const { ctx, page } = await open({ layout: "" });
  const d = await page.evaluate(() => ({ cards: !!document.querySelector("[data-monitoring-cards]"), cols: getComputedStyle(document.querySelector('[data-tier-group="3"] [data-card-grid]')).gridTemplateColumns.split(" ").length }));
  check(d.cards && d.cols === 3, "a new session opens on the cards, 3-up at 1440", JSON.stringify(d));
  const card = page.locator('[data-monitoring-card="t19"]');
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const bb = await card.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 40);
  await page.waitForTimeout(400);
  const h = await card.evaluate((c) => ({ t: getComputedStyle(c).transform, shadow: getComputedStyle(c).boxShadow, cursor: getComputedStyle(c).cursor }));
  const hover = await tok(page, "--el-soft-hover", "shadow");
  check(/-2\)$/.test(h.t) && h.shadow === hover && h.cursor === "pointer", "hovered: up 2px, the hover shadow, a pointer", JSON.stringify(h));
  /* Click the empty middle of the card — the signals — and follow it. */
  const sig = await card.locator("[data-card-stats]").boundingBox();
  await page.mouse.click(sig.x + sig.width / 2, sig.y + sig.height / 2);
  await page.waitForURL(/\/app\/chat\/t19|\/admin\/person\/t19/, { timeout: 8000 }).catch(() => {});
  check(/t19/.test(page.url()), "a click anywhere on the card follows its link", new URL(page.url()).pathname);
  await ctx.close();

  const k = await open({ layout: "" });
  await k.page.locator('[data-monitoring-card="t19"] [data-card-open]').focus();
  await k.page.keyboard.press("Shift+Tab");
  await k.page.keyboard.press("Tab");
  await k.page.waitForTimeout(300);
  const f = await k.page.evaluate(() => ({ outline: getComputedStyle(document.activeElement).outlineColor, lifted: getComputedStyle(document.querySelector('[data-monitoring-card="t19"]')).transform }));
  const focus = await tok(k.page, "--border-focus");
  check(f.outline === focus && /-2\)$/.test(f.lifted), "keyboard focus: the periwinkle ring, and the card lifts", JSON.stringify(f));
  await k.ctx.close();

  const n = await open({ layout: "", width: 1200 });
  const cols = await n.page.evaluate(() => getComputedStyle(document.querySelector('[data-tier-group="3"] [data-card-grid]')).gridTemplateColumns.split(" ").length);
  check(cols === 2, "2-up at 1200", `${cols}`);
  await n.ctx.close();

  const rm = await open({ layout: "", reducedMotion: "reduce" });
  const c2 = rm.page.locator('[data-monitoring-card="t19"]');
  await c2.scrollIntoViewIfNeeded();
  const b2 = await c2.boundingBox();
  await rm.page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height - 40);
  await rm.page.waitForTimeout(300);
  const still = await c2.evaluate((c) => getComputedStyle(c).transform);
  check(still === "none", "reduced motion: the card does not move", still);
  await rm.ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
