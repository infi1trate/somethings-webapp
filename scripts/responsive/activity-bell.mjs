// ═══════════════════════════════════════════════════════════════════════════
// THE BELL IS ACTIVITY (2026-10-16) — measured
//
//   · supervisors and admins: the ledger in a 420px dropdown under the bell,
//     with Mine/Team and the filters, and no evidence pane
//   · rows are links; following one navigates and closes the dropdown
//   · Esc and an outside click close it; the filter dialog opens from inside
//     it without closing it
//   · mentors: their notices; the badge counts unread and opening clears it
//   · the Activity tab is gone from the rail; /app/activity redirects to /app
//   · the links into /app/activity are gone (Today, the roster code)
//   · mobile: the bell opens a bottom sheet; the bar fits at 390 with 44px
//     buttons and the support CTA

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
const open = async (persona, width, path, extra = {}, dpr = 1) => {
  const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 844 : 982 }, deviceScaleFactor: dpr });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, ...extra }, version: VERSION }]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return { ctx, page };
};

// ── 1 · supervisor: the ledger in the dropdown ─────────────────────────────
{
  console.log("\n── supervisor at 1512");
  const { ctx, page } = await open("supervisor", 1512, "/app/care-reviews", {}, 2);
  const railHasActivity = await page.evaluate(() =>
    [...document.querySelectorAll("nav a")].some((a) => /^\s*Activity\b/.test(a.textContent ?? ""))
  );
  check(!railHasActivity, "the rail has no Activity item");
  const bell = page.locator('[data-anno-ref="console-topbar"] [data-activity-bell]');
  check((await bell.count()) === 1 && (await bell.getAttribute("tabindex")) !== "-1", "the bar's bell is a live control now");
  await bell.click();
  await page.waitForTimeout(500);
  const pop = page.locator("[data-activity-popover]");
  const m = await pop.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const bellR = document.querySelector('[data-anno-ref="console-topbar"] [data-activity-bell]').getBoundingClientRect();
    return {
      w: Math.round(r.width),
      top: Math.round(r.top),
      right: Math.round(r.right),
      bellBottom: Math.round(bellR.bottom),
      bellRight: Math.round(bellR.right),
      ledger: el.querySelector('[data-anno-ref="activity-ledger"]')?.getAttribute("data-variant") ?? null,
      rail: !!el.querySelector('[data-anno-ref="activity-view-rail"]'),
      filter: !!el.querySelector('[aria-label^="Filter activity"]'),
      pane: !!el.querySelector('[data-anno-ref="event-evidence-pane"], aside'),
      linkRows: el.querySelectorAll("[data-activity-row-link]").length,
      selectRows: el.querySelectorAll('li button[aria-current], li > div > button[type="button"][aria-label$="Unread"]').length,
      open: [...el.querySelectorAll("a")].filter((a) => /^Open\./.test(a.getAttribute("aria-label") ?? "")).length,
      scroll: (() => {
        const body = el.querySelector(".overflow-y-auto");
        return body ? { h: Math.round(body.getBoundingClientRect().height), sh: body.scrollHeight } : null;
      })(),
      viewport: innerHeight,
    };
  });
  check(m.w === 420, "the dropdown is 420 wide", `${m.w}`);
  check(m.top >= m.bellBottom && m.top - m.bellBottom <= 12 && Math.abs(m.right - m.bellRight) <= 1, "anchored under the bell, right-aligned to it", JSON.stringify({ top: m.top, bellBottom: m.bellBottom, right: m.right, bellRight: m.bellRight }));
  check(m.ledger === "popover" && m.rail && m.filter, "it holds the ledger, with Mine/Team and the filter control");
  check(!m.pane, "and no evidence pane");
  check(m.linkRows > 0 && m.open === 0, "rows are links, and the separate Open action is gone", `${m.linkRows} link rows · ${m.open} Open links`);
  check(m.scroll && m.scroll.h <= Math.round(m.viewport * 0.7) + 1, "the feed scrolls inside a cap of 70% of the viewport", JSON.stringify(m.scroll));
  await page.screenshot({ path: `${OUT}/07-bell-supervisor-1512.png` });

  /* THE FILTER DIALOG FROM INSIDE THE DROPDOWN */
  await pop.locator('[aria-label^="Filter activity"]').click();
  await page.waitForTimeout(500);
  const dialogOpen = await page.locator('[role="dialog"]').count();
  check(dialogOpen >= 1 && (await pop.isVisible()), "the filter dialog opens from inside it, and the dropdown stays open", `dialogs ${dialogOpen}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(await pop.isVisible(), "Esc closes the dialog first, not the dropdown");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(!(await pop.isVisible().catch(() => false)), "a second Esc closes the dropdown");
  check(await page.evaluate(() => document.activeElement?.hasAttribute("data-activity-bell")), "and focus returns to the bell");

  /* OUTSIDE CLICK */
  await bell.click();
  await page.waitForTimeout(400);
  await page.mouse.click(700, 600);
  await page.waitForTimeout(400);
  check(!(await page.locator("[data-activity-popover]").isVisible().catch(() => false)), "an outside click closes it");

  /* A ROW NAVIGATES AND CLOSES */
  await bell.click();
  await page.waitForTimeout(400);
  const href = await page.locator("[data-activity-popover] [data-activity-row-link]").first().getAttribute("href");
  await page.locator("[data-activity-popover] [data-activity-row-link]").first().click();
  await page.waitForTimeout(1200);
  check(new URL(page.url()).pathname === href?.split("?")[0] && !(await page.locator("[data-activity-popover]").isVisible().catch(() => false)),
    "following a row navigates to its object and closes the dropdown", `${href} → ${new URL(page.url()).pathname}`);
  await ctx.close();
}

// ── 2 · mentor: notices, badge, read on open ───────────────────────────────
{
  console.log("\n── mentor at 1512");
  const now = Date.now();
  const activity = [
    { id: "a1", type: "profile_changes_requested", fieldIds: ["bio"], createdAt: now - 3600_000, read: false },
    { id: "a2", type: "profile_update_live", fieldIds: ["bio"], createdAt: now - 86400_000, read: false },
  ];
  /* (pack v5.0) Escalation notices join this badge; this check is about the
     PROFILE notices, so the escalation ones are marked seen. */
  const { ctx, page } = await open("mentor", 1512, "/app", { activity, noticesSeenAt: { mentor: now + 60_000 } }, 2);
  const bell = page.locator('[data-anno-ref="console-topbar"] [data-activity-bell]');
  const label0 = await bell.getAttribute("aria-label");
  check(label0 === "Activity, 2 unread", "the badge counts the mentor's unread notices", label0);
  await bell.click();
  await page.waitForTimeout(500);
  const items = await page.locator("[data-activity-popover] li a:not([data-notice-link])").count();
  check(items === 2, "the dropdown lists the notices", `${items}`);
  await page.screenshot({ path: `${OUT}/08-bell-mentor-1512.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const label1 = await bell.getAttribute("aria-label");
  check(label1 === "Activity", "opening it marks them read — the badge clears", label1);
  await ctx.close();
}

// ── 3 · the route and the links ────────────────────────────────────────────
{
  console.log("\n── /app/activity and the links into it");
  const { ctx, page } = await open("supervisor", 1512, "/app/activity");
  check(new URL(page.url()).pathname === "/app", "/app/activity redirects to /app", page.url().replace(BASE, ""));
  for (const path of ["/app/today", "/app/mentees", "/app/care-reviews"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const n = await page.evaluate(() => document.querySelectorAll('a[href*="/app/activity"]').length);
    check(n === 0, `${path}: no links into /app/activity`, `${n}`);
  }
  await ctx.close();
}

// ── 4 · mobile ─────────────────────────────────────────────────────────────
for (const width of [390, 360]) {
  console.log(`\n── supervisor at ${width} (mobile tier)`);
  const { ctx, page } = await open("supervisor", width, "/app/today", {}, 3);
  const m = await page.evaluate(() => {
    const bar = document.querySelector('[data-anno-ref="app-topbar"]');
    const r = (e) => (e ? e.getBoundingClientRect() : null);
    const bell = bar.querySelector("[data-activity-bell]");
    const cta = bar.querySelector("[data-support-cta]");
    const kids = [...bar.querySelectorAll("button, a")].map((e) => Math.round(r(e).width));
    return {
      overflow: bar.scrollWidth - bar.clientWidth,
      rightmost: Math.round(Math.max(...[...bar.querySelectorAll("*")].map((e) => r(e).right))),
      vw: innerWidth,
      bell: bell && Math.round(r(bell).width),
      cta: cta && Math.round(r(cta).width),
      sizes: kids,
    };
  });
  check(m.bell === 44 && m.cta === 44, "bell and support are 44×44", JSON.stringify(m.sizes));
  check(m.overflow <= 0 && m.rightmost <= m.vw, `nothing overflows at ${width}`, `overflow ${m.overflow}, rightmost ${m.rightmost} of ${m.vw}`);
  if (width === 390) {
    await page.locator('[data-anno-ref="app-topbar"] [data-activity-bell]').click();
    await page.waitForTimeout(600);
    const sheet = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return null;
      const r = d.getBoundingClientRect();
      return { bottom: Math.round(r.bottom), w: Math.round(r.width), ledger: !!d.querySelector('[data-variant="popover"]') };
    });
    check(!!sheet && sheet.w === width && sheet.ledger, "the bell opens a bottom sheet with the ledger", JSON.stringify(sheet));
    await page.screenshot({ path: `${OUT}/09-bell-mobile-390.png` });
  }
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
