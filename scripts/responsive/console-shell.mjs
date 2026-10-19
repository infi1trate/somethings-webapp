// ═══════════════════════════════════════════════════════════════════════════
// THE CONSOLE SHELL PERSISTS ACROSS NAVIGATION (SUP-1, prerequisite for SUP-2)
//
//   · the shell's DOM survives a client-side navigation — /app → /app and
//     /app → /admin (the route group exists so the second one holds too)
//   · the rail's active item follows the route the page reports
//   · the canvas scroll starts at the top of each new route
//   · every console route still renders the shell, for each persona that
//     reaches it
//
// THE SURVIVAL CHECK IS A JS EXPANDO on the shell's `<main>`: a remount makes
// a new element without it. Asserted present first, so a probe that failed to
// set it cannot pass by reading `undefined === undefined`.

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
const ctxFor = async (persona) => {
  const ctx = await b.newContext({ viewport: { width: 1512, height: 982 } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona, tasksScenarioId: "heavy-caseload" }, version: VERSION }]
  );
  return ctx;
};
const mark = (page) =>
  page.evaluate(() => {
    const m = document.querySelector('[data-anno-ref="app-main"]');
    if (!m) return false;
    m.__probeMark = "kept";
    return m.__probeMark === "kept";
  });
const marked = (page) =>
  page.evaluate(() => document.querySelector('[data-anno-ref="app-main"]')?.__probeMark ?? null);
const activeLabel = (page) =>
  page.evaluate(() => document.querySelector('nav [aria-current="page"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null);

// ── 1 · supervisor: /app → /app → /admin, all client-side ──────────────────
{
  console.log("\n── supervisor, client-side navigation");
  const ctx = await ctxFor("supervisor");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-pane-teen]");
  check(await mark(page), "the shell was marked, so the next checks measure something");
  check(/Care Reviews/.test((await activeLabel(page)) ?? ""), "the active item is Care Reviews", `${await activeLabel(page)}`);

  await page.locator("nav a", { hasText: "Today" }).first().click();
  await page.waitForURL(/\/app\/today/);
  await page.waitForTimeout(800);
  check((await marked(page)) === "kept", "/app/care-reviews → /app/today keeps the same shell (no remount)");
  check(/Today/.test((await activeLabel(page)) ?? ""), "and the active item follows the route", `${await activeLabel(page)}`);

  await page.locator("nav a", { hasText: "Care Reviews" }).first().click();
  await page.waitForURL(/\/app\/care-reviews/);
  await page.waitForSelector("[data-pane-teen]");
  await page.locator("[data-care-history-link]").first().click();
  await page.waitForURL(/\/admin\/person\//);
  await page.waitForTimeout(1200);
  check((await marked(page)) === "kept", "→ /admin/person/… (View care history) keeps the same shell too", page.url().replace(BASE, ""));

  /* CANVAS SCROLL: on Mentees, which is taller than the viewport (the record
     page reached above does not scroll for a task-fixture teen — measured 0),
     scroll the canvas, navigate, expect the top. */
  await page.locator("nav a", { hasText: "Mentees" }).first().click();
  await page.waitForURL(/\/app\/mentees/);
  await page.waitForTimeout(800);
  const scrolled = await page.evaluate(() => {
    const c = document.querySelector("[data-canvas-scroller]");
    c.scrollTop = 600;
    return c.scrollTop;
  });
  await page.locator("nav a", { hasText: "Team" }).first().click();
  await page.waitForURL(/\/app\/team/);
  await page.waitForTimeout(600);
  const top = await page.evaluate(() => document.querySelector("[data-canvas-scroller]").scrollTop);
  check(scrolled > 0 && top === 0, "a new route opens at the top of the canvas", `scrolled ${scrolled} → ${top} after navigating`);
  check((await marked(page)) === "kept", "and the shell is still the same one");
  await ctx.close();
}

// ── 2 · every console route renders the shell ──────────────────────────────
const ROUTES = {
  /* `/app/escalations` and `/app/risk-flags` are hops into `/app/monitoring`
     now (proto/monitoring-merge); they stay listed so a hop that lands outside
     the shell still fails here. */
  supervisor: ["/app", "/app/today", "/app/monitoring", "/app/escalations", "/app/risk-flags", "/app/care-reviews", "/app/chat", "/app/mentees", "/app/team", "/app/settings", "/app/profile", "/admin/person/t19"],
  mentor: ["/app", "/app/chat", "/app/mentees", "/app/settings", "/app/profile"],
  "lead-mentor": ["/app", "/app/chat", "/app/team", "/app/mentees"],
  admin: ["/app", "/app/today", "/app/care-reviews", "/app/team", "/app/chat"],
};
for (const [persona, routes] of Object.entries(ROUTES)) {
  console.log(`\n── ${persona}: every route renders the shell`);
  const ctx = await ctxFor(persona);
  const page = await ctx.newPage();
  const bad = [];
  for (const r of routes) {
    const res = await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => ({
      main: !!document.querySelector('[data-anno-ref="app-main"]'),
      nav: !!document.querySelector("nav"),
      error: /Application error|Unhandled Runtime Error/.test(document.body.innerText),
      active: !!document.querySelector('nav [aria-current="page"]'),
    }));
    if (!res?.ok() || !ok.main || !ok.nav || ok.error) bad.push(`${r} (${res?.status()} main:${ok.main} nav:${ok.nav} err:${ok.error})`);
  }
  check(bad.length === 0, `${routes.length} routes render with the shell`, bad.join(" · ") || routes.join(" "));
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
