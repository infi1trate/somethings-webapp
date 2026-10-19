// ═══════════════════════════════════════════════════════════════════════════
// THE CONSOLE TOP BAR (SUP-1) — measured
//
//   · spans the content column only; the rail keeps the app's top edge
//   · geometry against Figma topBar 3928:10081
//   · back / forward navigate, and disable at the in-app history boundaries
//   · the four inert controls are skipped by Tab and say "Coming soon."
//   · support toggles aria-expanded and takes the raised fill when open
//   · below 900px of CONTENT width: no history control, search is an icon
//   · below 960 (the mobile tier) the desktop bar is not rendered
//   · personas: mentor, lead mentor, supervisor, admin get it; new-mentor not

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = "docs/support-panel/sup-1";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
const open = async (persona, width, path = "/app/chat", dpr = 1) => {
  const ctx = await b.newContext({ viewport: { width, height: 982 }, deviceScaleFactor: dpr });
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
  await page.waitForTimeout(900);
  return { ctx, page };
};
const bar = (page) =>
  page.evaluate(() => {
    const R = (e) => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), shown: getComputedStyle(e).display !== "none" && r.width > 0 };
    };
    const h = document.querySelector('[data-anno-ref="console-topbar"]');
    if (!h) return null;
    const hist = h.querySelector('nav[aria-label="History"]');
    const back = h.querySelector('[data-history="back"]');
    const fwd = h.querySelector('[data-history="forward"]');
    const field = h.querySelector('input[type="search"]')?.parentElement;
    const searchIcon = h.querySelector('[aria-label="Search (coming soon)"]');
    const ava = h.querySelector('[aria-label="Ask Ava (coming soon)"]');
    /* THE BELL IS LIVE since 2026-10-16 (it is Activity); SUPERSEDES the inert
       "Notifications (coming soon)" lookup. */
    const bell = h.querySelector("[data-activity-bell]");
    const sparkle = h.querySelector('[aria-label="Ask Ava (coming soon)"] svg');
    const cta = h.querySelector("[data-support-cta]");
    const rail = document.querySelector("nav")?.closest("aside, div");
    const after = (e) => {
      const s = getComputedStyle(e, "::after");
      return { w: Math.round(e.getBoundingClientRect().width + 2 * -parseFloat(s.left)), h: Math.round(e.getBoundingClientRect().height + 2 * -parseFloat(s.top)) };
    };
    return {
      bar: R(h),
      main: R(document.querySelector('[data-anno-ref="app-main"]')),
      hist: R(hist),
      back: back && { ...R(back), disabled: back.getAttribute("aria-disabled") === "true", tab: back.tabIndex, color: getComputedStyle(back).color, hit: after(back) },
      fwd: fwd && { ...R(fwd), disabled: fwd.getAttribute("aria-disabled") === "true", tab: fwd.tabIndex, color: getComputedStyle(fwd).color, hit: after(fwd) },
      field: R(field),
      sparkleColor: sparkle ? getComputedStyle(sparkle).color : null,
      searchIcon: R(searchIcon),
      ava: R(ava),
      bell: R(bell),
      cta: cta && { ...R(cta), expanded: cta.getAttribute("aria-expanded"), bg: getComputedStyle(cta).backgroundColor, label: cta.getAttribute("aria-label") },
      /* THE INERT CONTROLS: search (field or icon, whichever is shown), Ask Ava
         and the bell. ⌘K is a decorative hint inside the field, not a control.
         The history buttons are disabled for a different reason and are
         checked on their own — counting them here was the first run's error. */
      inert: [...h.querySelectorAll("[aria-disabled='true']:not([data-history])")]
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => ({ name: e.getAttribute("aria-label"), tab: e.tabIndex, title: e.getAttribute("title") ?? e.parentElement?.getAttribute("title") })),
      railTop: Math.round(document.querySelector('[data-anno-ref="app-main"]').parentElement.previousElementSibling?.getBoundingClientRect().y ?? -1),
      railH: Math.round(document.querySelector('[data-anno-ref="app-main"]').parentElement.previousElementSibling?.getBoundingClientRect().height ?? -1),
    };
  });

// ── 1 · geometry and the inert controls, supervisor at 1512 ────────────────
{
  console.log("\n── supervisor at 1512: geometry");
  const { ctx, page } = await open("supervisor", 1512, "/app/chat", 2);
  const m = await bar(page);
  check(!!m, "the bar renders");
  check(m.bar.x === 248 && m.bar.y === 0 && m.bar.h === 64, "spans the content column only, 64 tall, from the top", JSON.stringify(m.bar));
  check(m.railTop === 0 && m.railH > 900, "the rail keeps the app's top edge and full height", `rail y ${m.railTop}, h ${m.railH}`);
  check(m.main.y === 64, "the content container starts directly under the bar", `main y ${m.main.y}`);
  check(m.hist.w === 80 && m.hist.h === 36 && m.hist.x === 248, "history pill 80×36, flush with the content's left edge", JSON.stringify(m.hist));
  check(m.back.hit.w >= 40 && m.back.hit.h >= 40 && m.fwd.hit.w >= 40, "each chevron has a 40×40 hit area", `${m.back.hit.w}×${m.back.hit.h}, ${m.fwd.hit.w}×${m.fwd.hit.h}`);
  check(m.field.h === 48 && m.field.w <= 514 && m.field.w >= 240, "search 48 tall, between 240 and 514 wide", JSON.stringify(m.field));
  check(m.ava.h === 40 && m.ava.w >= 120, "Ask Ava 40 tall, at least 120 wide", JSON.stringify(m.ava));
  check(m.bell.w === 40 && m.cta.w === 40 && m.cta.x - (m.bell.x + m.bell.w) === 12, "bell and support 40×40, 12 apart", `bell ${m.bell.x}, cta ${m.cta.x}`);
  check(m.bar.x + m.bar.w - (m.cta.x + m.cta.w) === 32, "the right group ends 32px from the bar's edge (24 + 8)", `${m.bar.x + m.bar.w - (m.cta.x + m.cta.w)}`);
  const centreMid = (m.field.x + m.ava.x + m.ava.w) / 2;
  const gapMid = (m.hist.x + m.hist.w + m.bell.x) / 2;
  check(Math.abs(centreMid - gapMid) <= 2, "the centre group is centred between the outer two (Figma)", `centre ${centreMid}, gap ${gapMid}`);
  /* SUPERSEDES "search, Ask Ava and the bell": the bell became Activity. */
  check(m.inert.length === 2 && m.inert.every((i) => i.tab === -1 && i.title === "Coming soon."),
    "search and Ask Ava are out of the tab order and say Coming soon. (⌘K is part of search)", m.inert.map((i) => i.name).join(" · "));
  check(m.sparkleColor === "rgb(148, 122, 61)", "the sparkle is Figma's fill/ivory/border #947a3d", m.sparkleColor);

  /* TAB ORDER: from the top of the document, the bar's tab stops. */
  const stops = await page.evaluate(() => {
    const h = document.querySelector('[data-anno-ref="console-topbar"]');
    return [...h.querySelectorAll("button, input, a, [tabindex]")]
      .filter((e) => e.tabIndex >= 0 && !e.disabled && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0)
      .map((e) => e.getAttribute("aria-label"));
  });
  check(stops.length === 2 && /^Activity/.test(stops[0]) && /^Support/.test(stops[1]),
    "on a fresh load the bar's tab stops are Activity then Support (history disabled, search and Ask Ava inert)", JSON.stringify(stops));
  check(m.back.disabled && m.fwd.disabled && m.back.tab === -1, "back and forward start disabled — no in-app history yet", `back ${m.back.color}`);
  await page.screenshot({ path: `${OUT}/01-1512-supervisor.png` });

  /* SUPPORT TOGGLE */
  await page.locator('[data-anno-ref="console-topbar"] [data-support-cta]').click();
  await page.waitForTimeout(200);
  const opened = (await bar(page)).cta;
  check(opened.expanded === "true" && opened.bg === "rgb(255, 255, 255)", "support toggles aria-expanded and takes the raised fill", `${opened.expanded} · ${opened.bg}`);
  await page.locator('[data-anno-ref="console-topbar"] [data-support-cta]').click();
  /* Move the pointer off it, or the reading is the hover tint (first run). */
  await page.mouse.move(400, 500);
  await page.waitForTimeout(250);
  const closed = (await bar(page)).cta;
  check(closed.expanded === "false" && closed.bg === "rgba(0, 0, 0, 0)", "and back: transparent by default", `${closed.expanded} · ${closed.bg}`);
  await ctx.close();
}

// ── 2 · back and forward actually navigate, and disable at the ends ───────
{
  console.log("\n── history navigates and disables at the boundaries");
  const { ctx, page } = await open("supervisor", 1512, "/app/today");
  const state = async () => {
    const m = await bar(page);
    return { back: !m.back.disabled, fwd: !m.fwd.disabled, path: new URL(page.url()).pathname };
  };
  const s0 = await state();
  check(!s0.back && !s0.fwd, "fresh load: both disabled", JSON.stringify(s0));
  await page.locator("nav a", { hasText: "Care Reviews" }).first().click();
  await page.waitForURL(/care-reviews/);
  await page.waitForTimeout(500);
  await page.locator("nav a", { hasText: "Team" }).first().click();
  await page.waitForURL(/team/);
  await page.waitForTimeout(500);
  const s1 = await state();
  check(s1.back && !s1.fwd, "after two navigations: back enabled, forward disabled", JSON.stringify(s1));
  await page.locator('[data-history="back"]').click();
  await page.waitForURL(/care-reviews/);
  await page.waitForTimeout(500);
  const s2 = await state();
  check(s2.path === "/app/care-reviews" && s2.back && s2.fwd, "Go back returns to Care Reviews; both now enabled", JSON.stringify(s2));
  await page.locator('[data-history="back"]').click();
  await page.waitForURL(/today/);
  await page.waitForTimeout(500);
  const s3 = await state();
  check(s3.path === "/app/today" && !s3.back && s3.fwd, "back again reaches the start: back disabled, forward enabled", JSON.stringify(s3));
  await page.locator('[data-history="forward"]').click();
  await page.waitForURL(/care-reviews/);
  await page.waitForTimeout(500);
  await page.locator('[data-history="forward"]').click();
  await page.waitForURL(/team/);
  await page.waitForTimeout(500);
  const s4 = await state();
  check(s4.path === "/app/team" && s4.back && !s4.fwd, "Go forward twice reaches the end: forward disabled", JSON.stringify(s4));
  /* A push after going back truncates forward, as the browser does. */
  await page.locator('[data-history="back"]').click();
  await page.waitForURL(/care-reviews/);
  await page.waitForTimeout(400);
  await page.locator("nav a", { hasText: "Mentees" }).first().click();
  await page.waitForURL(/mentees/);
  await page.waitForTimeout(500);
  const s5 = await state();
  check(s5.back && !s5.fwd, "a new navigation after going back clears forward", JSON.stringify(s5));
  /* The browser's own back button agrees with the control. */
  await page.goBack();
  await page.waitForTimeout(600);
  const s6 = await state();
  check(s6.path === "/app/care-reviews" && s6.fwd, "the browser's back is tracked too", JSON.stringify(s6));
  /* RELOAD keeps the position. */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const s7 = await state();
  check(s7.back && s7.fwd, "after a reload the position survives: back and forward both still enabled", JSON.stringify(s7));
  await ctx.close();
}

// ── 3 · widths ─────────────────────────────────────────────────────────────
for (const [persona, width] of [["supervisor", 1280], ["supervisor", 1024], ["mentor", 1024], ["supervisor", 768]]) {
  console.log(`\n── ${persona} at ${width}`);
  const { ctx, page } = await open(persona, width, "/app/chat", 2);
  const m = await bar(page);
  if (width < 960) {
    check(!m || !m.bar.shown, "below 960 (the mobile tier) the desktop bar is not rendered", m ? JSON.stringify(m.bar) : "absent");
  } else {
    const content = m.bar.w;
    const compact = content < 900;
    check(m.hist.shown === !compact, `history ${compact ? "dropped" : "shown"} at ${content}px of content width`, `hist shown ${m.hist.shown}`);
    check(m.field.shown === !compact && m.searchIcon.shown === compact, `search is ${compact ? "the 40×40 icon" : "the field"}`, `field ${m.field.shown} · icon ${m.searchIcon.shown}`);
    check(m.cta.shown && m.cta.x + m.cta.w <= m.bar.x + m.bar.w, "the support CTA is on screen", JSON.stringify(m.cta));
    const overflow = await page.evaluate(() => {
      const h = document.querySelector('[data-anno-ref="console-topbar"] > div');
      return h.scrollWidth - h.clientWidth;
    });
    check(overflow <= 0, "nothing overflows the bar", `${overflow}px`);
  }
  await page.screenshot({ path: `${OUT}/0${width === 1280 ? 2 : width === 1024 ? (persona === "mentor" ? 4 : 3) : 5}-${width}-${persona}.png` });
  await ctx.close();
}

// ── 4 · personas ───────────────────────────────────────────────────────────
console.log("\n── personas");
for (const [persona, want] of [["mentor", true], ["lead-mentor", true], ["supervisor", true], ["admin", true], ["new-mentor", false]]) {
  const { ctx, page } = await open(persona, 1512, "/app");
  const m = await bar(page);
  check(!!m === want, `${persona}: ${want ? "has" : "has no"} top bar`);
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
