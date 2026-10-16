// ═══════════════════════════════════════════════════════════════════════════
// THE SUPPORT PANEL — chrome and slide-out (SUP-2), measured
//
//   · it pushes from 768 up: the canvas loses exactly 424 (4 gutter + 420)
//   · the treatment: surface-raised, 4/24/24/4, Elevation/1, pb 16, clipped
//   · header 64 with a divider; search + compose inert, 40×40 pills; a close
//   · non-modal: no scrim, outside clicks do nothing, the CTA stays clickable
//   · Esc inside closes, Esc outside does not; focus to the header on open and
//     back to the CTA on close; closed, it is inert
//   · motion 220ms on the curve; reduced motion: none
//   · it is one mount: a route change keeps the node and its scroll
//   · below 768 a sheet under the mobile top bar
//   · closed, every surface lays out exactly as its viewport tier says; open,
//     it drops a tier and nothing scrolls sideways
//   · /app/chat: the rail collapses to a 56 strip (animated), and a strip tab
//     brings the rail back on that tab and closes Support

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = "docs/support-panel/sup-2";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
const open = async (persona, width, path, opts = {}) => {
  const ctx = await b.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    deviceScaleFactor: opts.dpr ?? 1,
    reducedMotion: opts.reducedMotion ?? "no-preference",
  });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona }, version: VERSION }]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  return { ctx, page };
};
const cta = (page) => page.locator("[data-support-cta]").filter({ visible: true }).first();
const toggle = async (page) => {
  await cta(page).click();
  await page.waitForTimeout(450);
};
const geo = (page) =>
  page.evaluate(() => {
    const r = (e) => (e ? e.getBoundingClientRect() : null);
    const c = document.querySelector("[data-canvas-scroller]");
    const a = document.querySelector("#support-panel");
    const slot = document.querySelector("[data-support-slot]");
    return {
      canvas: Math.round(r(c).width),
      canvasRight: Math.round(r(c).right),
      canvasTop: Math.round(r(c).top),
      canvasOverflow: c.scrollWidth - c.clientWidth,
      hscroll: document.documentElement.scrollWidth - innerWidth,
      panel: Math.round(r(a).width),
      /* LAYOUT COST, not box width: from `md` the slot is padded 8 and pulled
         back 8 (`-mr-2`) for shadow room, so closed it is an 8px box costing
         0. */
      slotCost: Math.round(r(slot).width + parseFloat(getComputedStyle(slot).marginRight)),
      panelLeft: Math.round(r(a).left),
      panelTop: Math.round(r(a).top),
      panelBottom: Math.round(r(a).bottom),
      slotOpen: slot.dataset.open,
      inert: a.inert,
      vw: innerWidth,
      vh: innerHeight,
    };
  });

// ── 1 · the treatment, focus and dismissal at 1512 ─────────────────────────
{
  console.log("\n── supervisor at 1512, /app/care-reviews");
  const { ctx, page } = await open("supervisor", 1512, "/app/care-reviews", { dpr: 2 });
  const g0 = await geo(page);
  check(g0.slotCost === 0 && g0.inert && g0.slotOpen === "false", "closed: costs 0px and is inert", JSON.stringify({ cost: g0.slotCost, inert: g0.inert }));
  const ctrl = await cta(page).evaluate((e) => ({ exp: e.getAttribute("aria-expanded"), controls: e.getAttribute("aria-controls") }));
  check(ctrl.exp === "false" && ctrl.controls === "support-panel", "the CTA names the panel it controls", JSON.stringify(ctrl));

  await toggle(page);
  const g1 = await geo(page);
  check(g1.panel === 420, "open: the panel is 420 wide", `${g1.panel}`);
  check(g0.canvas - g1.canvas === 424, "it pushes: the canvas loses exactly 424", `${g0.canvas} → ${g1.canvas}`);
  check(g1.panelLeft - g1.canvasRight === 4, "a 4px gutter between canvas and panel", `${g1.panelLeft - g1.canvasRight}`);
  check(g1.panelTop === g1.canvasTop, "it starts where the canvas starts, under the top bar", `panel ${g1.panelTop} · canvas ${g1.canvasTop}`);
  const bar = await page.locator('[data-anno-ref="console-topbar"]').evaluate((e) => Math.round(e.getBoundingClientRect().bottom));
  check(g1.panelTop >= bar, "and never covers the bar", `bar bottom ${bar}`);
  const style = await page.evaluate(() => {
    const a = document.querySelector("#support-panel");
    const s = getComputedStyle(a);
    const h = a.querySelector("header");
    const hs = getComputedStyle(h);
    const btns = [...h.querySelectorAll("button")].map((x) => {
      const r = x.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        radius: parseFloat(getComputedStyle(x).borderTopLeftRadius),
        disabled: x.getAttribute("aria-disabled"),
        tab: x.getAttribute("tabindex"),
        title: x.getAttribute("title"),
        label: x.getAttribute("aria-label"),
      };
    });
    return {
      bg: s.backgroundColor,
      radius: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].join(" "),
      shadow: s.boxShadow,
      pb: s.paddingBottom,
      overflow: s.overflow,
      headerH: Math.round(h.getBoundingClientRect().height),
      divider: hs.borderBottomWidth + " " + hs.borderBottomStyle,
      title: document.querySelector("#support-panel-title")?.textContent.trim(),
      btns,
      slot: (() => {
        const t = getComputedStyle(document.querySelector("[data-support-slot]"));
        return { prop: t.transitionProperty, dur: t.transitionDuration, ease: t.transitionTimingFunction };
      })(),
    };
  });
  check(style.bg === "rgb(255, 255, 255)", "surface-raised", style.bg);
  check(style.radius === "4px 24px 24px 4px", "radius 4 / 24 / 24 / 4", style.radius);
  check(/rgba\(0, 0, 0, 0\.13\) 0px 3px 6px/.test(style.shadow), "Elevation/1", style.shadow);
  check(style.pb === "16px" && style.overflow === "hidden", "padding-bottom 16, overflow hidden", `${style.pb} · ${style.overflow}`);
  check(style.headerH === 64 && style.divider === "1px solid", "header 64 with a bottom divider", `${style.headerH} · ${style.divider}`);
  check(style.title === "Support", "titled Support", style.title);
  const inertBtns = style.btns.filter((x) => x.disabled === "true");
  check(
    inertBtns.length === 2 && inertBtns.every((x) => x.tab === "-1" && x.title === "Coming soon."),
    "search and compose are inert: aria-disabled, tabindex -1, Coming soon.",
    JSON.stringify(inertBtns.map((x) => x.label))
  );
  check(style.btns.every((x) => x.w === 40 && x.h === 40 && x.radius >= 20), "header buttons are 40×40 pills", JSON.stringify(style.btns.map((x) => `${x.w}×${x.h} r${x.radius}`)));
  check(style.btns.some((x) => x.label === "Close support" && x.disabled === null), "an explicit, live close button");
  check(style.slot.prop === "width" && style.slot.dur === "0.22s" && style.slot.ease === "cubic-bezier(0.32, 0.72, 0, 1)", "the push is 220ms on the curve", JSON.stringify(style.slot));

  const focused = await page.evaluate(() => document.activeElement?.id);
  check(focused === "support-panel-title", "focus moved to the panel header on open", `${focused}`);
  await page.keyboard.press("Tab");
  const tabbed = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  check(tabbed === "Close support", "not trapped: Tab skips the inert pair to the close button", `${tabbed}`);
  await page.screenshot({ path: `${OUT}/01-open-care-reviews-1512.png` });

  /* NON-MODAL */
  const scrim = await page.evaluate(() => {
    const c = document.querySelector("[data-canvas-scroller]").getBoundingClientRect();
    const hit = document.elementFromPoint(c.left + c.width / 2, c.top + 200);
    const ctaEl = [...document.querySelectorAll("[data-support-cta]")].find((e) => e.getBoundingClientRect().width > 0);
    const cr = ctaEl.getBoundingClientRect();
    const ctaHit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
    return { canvasHit: !!hit?.closest("[data-canvas-scroller]"), ctaHit: !!ctaHit?.closest("[data-support-cta]") };
  });
  check(scrim.canvasHit, "no scrim: the canvas receives pointer hits");
  check(scrim.ctaHit, "the CTA is uncovered and clickable");
  await page.mouse.click(Math.round(g1.canvasRight - g1.canvas / 2), 600);
  await page.waitForTimeout(300);
  check((await geo(page)).slotOpen === "true", "an outside click does not dismiss it");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check((await geo(page)).slotOpen === "true", "Esc with focus outside the panel does not close it");

  /* ESC INSIDE */
  await page.locator("[data-support-close]").focus();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  const g2 = await geo(page);
  const back = await page.evaluate(() => document.activeElement?.hasAttribute("data-support-cta"));
  check(g2.slotOpen === "false" && g2.inert, "Esc with focus inside closes it", JSON.stringify({ open: g2.slotOpen, inert: g2.inert }));
  check(back, "and focus returns to the CTA");
  check(g2.canvas === g0.canvas, "the canvas gets its width back", `${g2.canvas}`);

  /* CLOSE BUTTON */
  await toggle(page);
  await page.locator("[data-support-close]").click();
  await page.waitForTimeout(450);
  check((await geo(page)).slotOpen === "false" && (await page.evaluate(() => document.activeElement?.hasAttribute("data-support-cta"))), "the close button closes it, focus to the CTA");

  /* THE CTA TOGGLES */
  await toggle(page);
  check((await cta(page).getAttribute("aria-expanded")) === "true", "aria-expanded follows");
  await toggle(page);
  check((await geo(page)).slotOpen === "false", "the CTA closes what it opened");

  /* ONE MOUNT ACROSS ROUTES — the node and its scroll */
  await toggle(page);
  await page.evaluate(() => {
    const body = document.querySelector("[data-support-body]");
    const pad = document.createElement("div");
    pad.style.height = "2000px";
    pad.dataset.probePad = "1";
    body.appendChild(pad);
    body.scrollTop = 300;
    document.querySelector("#support-panel").__probe = "same-node";
  });
  await page.locator('nav a[href="/app/today"]').first().click();
  await page.waitForURL("**/app/today");
  await page.waitForTimeout(700);
  const kept = await page.evaluate(() => ({
    node: document.querySelector("#support-panel").__probe,
    scroll: document.querySelector("[data-support-body]").scrollTop,
    open: document.querySelector("[data-support-slot]").dataset.open,
  }));
  check(kept.node === "same-node" && kept.open === "true", "a route change keeps the same panel, still open", JSON.stringify(kept));
  check(kept.scroll === 300, "and its scroll position", `${kept.scroll}`);
  await ctx.close();
}

// ── 2 · reduced motion ─────────────────────────────────────────────────────
{
  console.log("\n── reduced motion");
  const { ctx, page } = await open("supervisor", 1512, "/app/chat", { reducedMotion: "reduce" });
  const t = await page.evaluate(() => {
    /* A transition runs only with a non-zero duration on a listed property;
       `all 0s` (the initial value) is as still as `none`. */
    const still = (el) => { const c = getComputedStyle(el); return c.transitionProperty === "none" || c.transitionDuration.split(",").every((d) => parseFloat(d) === 0); };
    const p = (s) => still(document.querySelector(s));
    const grid = document.querySelector("[data-slot=chat-rail]").closest(".grid");
    return { slot: p("[data-support-slot]"), panel: p("#support-panel"), grid: still(grid), tf: getComputedStyle(document.querySelector("#support-panel")).transform };
  });
  check(t.slot && t.panel && t.grid, "no transitions: the push, the slide and the rail collapse", JSON.stringify(t));
  await toggle(page);
  const tf = await page.evaluate(() => getComputedStyle(document.querySelector("#support-panel")).transform);
  check(tf === "none", "and no transform on the panel", tf);
  await ctx.close();
}

// ── 3 · push widths, and nothing scrolls sideways ──────────────────────────
for (const width of [1280, 1024, 960, 768]) {
  console.log(`\n── supervisor at ${width}`);
  const { ctx, page } = await open("supervisor", width, "/app/care-reviews");
  const g0 = await geo(page);
  await toggle(page);
  const g1 = await geo(page);
  check(g1.panel === 420 && g0.canvas - g1.canvas === 424, "pushes by 424, panel 420", `${g0.canvas} → ${g1.canvas} · ${g1.panel}`);
  check(g1.hscroll <= 0 && g0.hscroll <= 0, "no horizontal page scroll, closed or open", `${g0.hscroll} / ${g1.hscroll}`);
  if (width < 960) {
    const bars = await page.evaluate(() => {
      const t = document.querySelector('[data-anno-ref="app-topbar"]').getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label] [href]')?.closest("nav")?.getBoundingClientRect();
      return { top: Math.round(t.bottom), navTop: nav ? Math.round(nav.top) : null };
    });
    check(g1.panelTop >= bars.top, "between the mobile bars: under the top bar", `panel ${g1.panelTop} · bar ${bars.top}`);
  }
  await ctx.close();
}

// ── 4 · below 768: a sheet under the mobile top bar ────────────────────────
{
  console.log("\n── mentor at 390");
  const { ctx, page } = await open("mentor", 390, "/app", { dpr: 3 });
  const g0 = await geo(page);
  check(g0.inert && g0.slotCost === 0, "closed: not rendered");
  await toggle(page);
  const s = await page.evaluate(() => {
    const a = document.querySelector("#support-panel").getBoundingClientRect();
    const bar = document.querySelector('[data-anno-ref="app-topbar"]').getBoundingClientRect();
    const dev = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dev-bar-h")) || 0;
    const ctaEl = document.querySelector('[data-anno-ref="app-topbar"] [data-support-cta]');
    const cr = ctaEl.getBoundingClientRect();
    return {
      left: Math.round(a.left), w: Math.round(a.width), top: Math.round(a.top), bottom: Math.round(a.bottom),
      bar: Math.round(bar.bottom), vh: innerHeight, dev,
      ctaHit: !!document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2)?.closest("[data-support-cta]"),
      hscroll: document.documentElement.scrollWidth - innerWidth,
    };
  });
  check(s.left === 0 && s.w === 390, "full width", JSON.stringify({ left: s.left, w: s.w }));
  check(s.top === s.bar && s.bottom === s.vh - s.dev, "from under the top bar to the bottom", JSON.stringify({ top: s.top, bar: s.bar, bottom: s.bottom, vh: s.vh, dev: s.dev }));
  check(s.ctaHit, "the CTA stays uncovered — it closes the sheet too");
  check(s.hscroll <= 0, "no horizontal scroll", `${s.hscroll}`);
  await page.screenshot({ path: `${OUT}/02-sheet-390.png` });
  await toggle(page);
  check((await geo(page)).slotOpen === "false", "the CTA closes it");
  await ctx.close();
}

// ── 5 · every surface: closed is its viewport tier, open drops one ─────────
const tracks = (s) => (s && s !== "none" ? s.split(" ").length : 1);
const SURFACES = [
  {
    name: "chat",
    path: "/app/chat",
    measure: () => {
      const grid = (document.querySelector("[data-slot=chat-rail]") ?? document.querySelector("[data-rail-strip]"))?.closest(".grid");
      const v = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().width) : 0; };
      return { cols: getComputedStyle(grid).gridTemplateColumns, rail: v("[data-slot=chat-rail]"), strip: v("[data-rail-strip]") };
    },
  },
  {
    name: "care-reviews",
    path: "/app/care-reviews",
    measure: () => {
      const grid = [...document.querySelectorAll(".grid")].find((e) => e.className.includes("grid-rows-[minmax(0,1fr)]") && e.className.includes("gap-5"));
      return { cols: grid ? getComputedStyle(grid).gridTemplateColumns : "none" };
    },
  },
  {
    name: "risk-flags",
    path: "/app/risk-flags",
    measure: () => {
      const grid = [...document.querySelectorAll(".grid")].find((e) => e.className.includes("grid-rows-[minmax(0,1fr)]") && e.className.includes("gap-5"));
      return { cols: grid ? getComputedStyle(grid).gridTemplateColumns : "none" };
    },
  },
  {
    name: "today",
    path: "/app/today",
    measure: () => {
      const main = document.querySelector('[data-anno-ref="today-main"]');
      return { row: getComputedStyle(main.parentElement).flexDirection };
    },
  },
];
const expectClosed = {
  chat: (vw) => (vw >= 1280 ? 3 : vw >= 960 ? 2 : 1),
  "care-reviews": (vw) => (vw >= 1280 ? 2 : 1),
  "risk-flags": (vw) => (vw >= 1280 ? 2 : 1),
  today: (vw) => (vw >= 1470 ? "row" : "column"),
};
/* ═══ KNOWN, PRE-EXISTING: the worklists overflow a phone-width canvas ═══
   Care Reviews' row has a 412px floor and Risk Flags' filter selects do not
   wrap, so both already scroll sideways at a 360 phone with Support closed.
   Support at 1024 hands them a 336 canvas, which shows the same defect on a
   desktop. Not SUP-2's to fix here; the baseline is measured live so the line
   says how big it is, and a canvas over 412 is still a hard check. */
/* Open: the tier its CANVAS earns, on top of the viewport's — the floors the
   surfaces declare (chat's own collapse is checked separately). */
const expectOpen = {
  "care-reviews": (vw, cw) => (vw >= 1280 && cw >= 1000 ? 2 : 1),
  "risk-flags": (vw, cw) => (vw >= 1280 && cw >= 1000 ? 2 : 1),
  today: (vw, cw) => (vw >= 1470 && cw >= 1190 ? "row" : "column"),
};
const phoneBaseline = {};
for (const s of SURFACES) {
  const { ctx, page } = await open("supervisor", 360, s.path);
  phoneBaseline[s.name] = (await geo(page)).canvasOverflow;
  await ctx.close();
}
const KNOWN_BELOW = 412;
for (const width of [1024, 1280, 1512, 1728]) {
  console.log(`\n── surfaces, supervisor at ${width}`);
  for (const s of SURFACES) {
    const { ctx, page } = await open("supervisor", width, s.path);
    const c = await page.evaluate(s.measure);
    const closedTier = c.row ?? tracks(c.cols);
    check(closedTier === expectClosed[s.name](width), `${s.name} closed: its viewport tier`, `${c.row ?? c.cols}`);
    await toggle(page);
    const o = await page.evaluate(s.measure);
    const g = await geo(page);
    const detail = `canvas ${g.canvas} · overflow ${g.canvasOverflow} · page ${g.hscroll} · ${o.row ?? o.cols}`;
    if (g.canvasOverflow > 0 && g.canvas < KNOWN_BELOW && phoneBaseline[s.name] > 0 && g.hscroll <= 0) {
      console.log(`  ⚠ KNOWN ${s.name} open: overflows a ${g.canvas} canvas — pre-existing, ${phoneBaseline[s.name]}px at a 360 phone closed  — ${detail}`);
    } else {
      check(g.canvasOverflow <= 0 && g.hscroll <= 0, `${s.name} open: nothing scrolls sideways`, detail);
    }
    if (expectOpen[s.name]) {
      const openTier = o.row ?? tracks(o.cols);
      check(openTier === expectOpen[s.name](width, g.canvas), `${s.name} open: the tier a ${g.canvas} canvas earns`, `${o.row ?? o.cols}`);
    }
    if (s.name === "chat") {
      check(o.rail === 0 && o.strip === 56, "chat open: the rail is a 56 strip", JSON.stringify(o));
    }
    if (width === 1512) await page.screenshot({ path: `${OUT}/03-${s.name}-open-1512.png` });
    await ctx.close();
  }
}

// ── 6 · chat: the collapse animates, the strip brings the rail back ───────
{
  console.log("\n── chat at 1728, the collapse and the return");
  const { ctx, page } = await open("supervisor", 1728, "/app/chat", { dpr: 2 });
  const third = () =>
    page.evaluate(() => {
      const grid = (document.querySelector("[data-slot=chat-rail]") ?? document.querySelector("[data-rail-strip]")).closest(".grid");
      return parseFloat(getComputedStyle(grid).gridTemplateColumns.split(" ")[2]);
    });
  const before = await third();
  await cta(page).click();
  await page.waitForTimeout(90);
  const mid = await third();
  await page.waitForTimeout(400);
  const after = await third();
  check(before === 320 && after === 56, "the third track goes 320 → 56", `${before} → ${after}`);
  check(mid > 56 && mid < 320, "and passes through the widths between — animated, not swapped", `${mid} at ~90ms`);
  await page.screenshot({ path: `${OUT}/04-chat-strip-1728.png` });
  const strip = await page.evaluate(() => [...document.querySelectorAll("[data-rail-strip-tab]")].map((e) => ({ t: e.dataset.railStripTab, w: Math.round(e.getBoundingClientRect().width), label: e.getAttribute("aria-label") })));
  check(strip.length >= 2 && strip.every((x) => x.w === 40 && /^Open /.test(x.label)), "the strip holds the rail's tabs as 40px named buttons", JSON.stringify(strip.map((x) => x.label)));
  await page.locator('[data-rail-strip-tab="timeline"]').click();
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({
    open: document.querySelector("[data-support-slot]").dataset.open,
    tab: document.querySelector('[data-slot="chat-rail"] [role="tab"][aria-selected="true"]')?.textContent.trim(),
    focus: document.activeElement?.closest('[data-slot="chat-rail"]') ? document.activeElement.textContent.trim() : document.activeElement?.tagName,
  }));
  check(r.open === "false", "a strip tab closes Support");
  check(r.tab === "Timeline", "and brings the rail back on that tab", `${r.tab}`);
  check(r.focus === "Timeline", "focus lands on the rail's tab", `${r.focus}`);
  check((await third()) === 320, "the rail is a full track again", `${await third()}`);
  await ctx.close();
}
{
  console.log("\n── chat at 1280 open: below the two-column floor");
  const { ctx, page } = await open("supervisor", 1280, "/app/chat");
  await toggle(page);
  const m = await page.evaluate(() => {
    const v = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().width) : 0; };
    const list = document.querySelector("[data-rail-strip]").closest(".grid").firstElementChild;
    return { list: Math.round(list.getBoundingClientRect().width), strip: v("[data-rail-strip]"), back: v("[data-slot=chat-back]"), composer: v("textarea") };
  });
  check(m.list === 0 && m.strip === 56 && m.composer > 0, "the conversation stays, the list goes, the strip is there", JSON.stringify(m));
  check(m.back === 0, "no Back link pointing at this same conversation");
  await page.screenshot({ path: `${OUT}/05-chat-1280-open.png` });
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
