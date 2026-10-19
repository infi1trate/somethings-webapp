// ═══════════════════════════════════════════════════════════════════════════
// RETIRING THE SUPPORT TAB (SUP-5), measured
//
//   · /app/chat has no Teens | Support switch, and lists teens only
//   · a link to a support thread opens it in the panel; the URL returns to
//     /app/chat
//   · ONE unread store: the CTA's count equals the panel's conversations with
//     unread, and both drop together when a thread is read
//   · the escalation banner's "Supervisor notified" opens that supervisor's
//     thread in the panel, focus on its name; plain text for a viewer who
//     cannot reach that contact

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = "docs/support-panel/sup-5";
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
        localStorage.removeItem("somethings.support.disclosure");
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
const cta = (page) => page.locator("[data-support-cta]").filter({ visible: true }).first();
const ctaCount = async (page) => {
  const l = (await cta(page).getAttribute("aria-label")) ?? "";
  return Number(/(\d+) unread/.exec(l)?.[1] ?? 0);
};
/* The panel's own count: conversations whose row says it is unread, across
   every section — opened, so the closed ones' rows are on the page. */
const panelCount = (page) =>
  page.evaluate(async () => {
    for (const t of document.querySelectorAll("[data-support-section-toggle]")) {
      if (t.getAttribute("aria-expanded") !== "true") t.click();
    }
    await new Promise((r) => setTimeout(r, 250));
    return [...document.querySelectorAll("[data-support-row]")].filter((r) => /\d+ unread/.test(r.textContent)).length;
  });

// ── 1 · the chat list has no Support ───────────────────────────────────────
{
  console.log("\n── /app/chat, mentor at 1512");
  const { ctx, page } = await open("mentor", 1512, "/app/chat", { chatScenarioId: "escalation-active" }, 2);
  const l = await page.evaluate(() => ({
    tablist: !!document.querySelector('[data-slot="conversation-list"] [role="tablist"]'),
    support: [...document.querySelectorAll('[data-anno-ref="chat-list-scroller"] button[aria-label]')].filter((b) => /Brandy|Stephen/.test(b.getAttribute("aria-label"))).length,
    rows: document.querySelectorAll('[data-anno-ref="chat-list-scroller"] li').length,
    region: document.querySelector('[data-anno-ref="chat-list-scroller"]')?.getAttribute("role"),
  }));
  check(!l.tablist, "no Teens | Support switch");
  check(l.support === 0 && l.rows > 0, "teen conversations only", `${l.rows} rows, ${l.support} support`);
  check(l.region === "region", "the rows are a region, no longer an orphaned tabpanel", l.region);
  await page.screenshot({ path: `${OUT}/01-chat-no-support-tab-1512.png` });

  /* ── 2 · ONE STORE ── */
  const c0 = await ctaCount(page);
  await cta(page).click();
  await page.waitForTimeout(450);
  const p0 = await panelCount(page);
  check(c0 === p0 && c0 > 0, "the CTA and the panel count the same conversations", `CTA ${c0} · panel ${p0}`);
  await page.locator('[data-support-row="c-fall-26"] [data-support-row-open]').click();
  await page.waitForTimeout(300);
  await page.locator("[data-support-back]").click();
  await page.waitForTimeout(300);
  const c1 = await ctaCount(page);
  const p1 = await panelCount(page);
  check(c1 === c0 - 1 && p1 === p0 - 1, "reading a thread drops both by one", `CTA ${c0}→${c1} · panel ${p0}→${p1}`);
  await ctx.close();
}

// ── 3 · a support link opens the panel ─────────────────────────────────────
{
  console.log("\n── /app/chat/s-stephen");
  const { ctx, page } = await open("mentor", 1512, "/app/chat/s-stephen");
  const h = await page.evaluate(() => ({
    path: location.pathname,
    open: document.querySelector("[data-support-slot]")?.dataset.open,
    thread: document.querySelector("[data-support-thread]")?.dataset.supportThread,
  }));
  check(h.path === "/app/chat" && h.open === "true" && h.thread === "s-stephen", "it opens that thread in the panel, the URL returns to the list", JSON.stringify(h));
  await ctx.close();
}

// ── 4 · "Supervisor notified" opens their thread ───────────────────────────
for (const width of [1512, 390]) {
  console.log(`\n── the escalation banner, mentor at ${width}`);
  /* Below md the list is the screen, so go to the escalation's thread itself
     (`t13`, the scenario's focus). */
  const { ctx, page } = await open("mentor", width, width < 600 ? "/app/chat/t13" : "/app/chat", { chatScenarioId: "escalation-active" }, width < 600 ? 3 : 2);
  const link = page.locator('[data-slot="banner-supervisor"]');
  const meta = await link.evaluate((e) => ({ text: e.textContent.trim(), label: e.getAttribute("aria-label"), tag: e.tagName })).catch(() => null);
  check(meta?.tag === "BUTTON" && /^Supervisor notified /.test(meta.text) && /Message them in Support/.test(meta.label), "the fact is a named control", JSON.stringify(meta));
  await link.click();
  await page.waitForTimeout(600);
  const o = await page.evaluate(() => ({
    open: document.querySelector("[data-support-slot]")?.dataset.open,
    thread: document.querySelector("[data-support-thread]")?.dataset.supportThread,
    focus: document.activeElement?.id,
  }));
  check(o.open === "true" && o.thread === "s-brandy", "it opens the notified supervisor's thread in the panel", JSON.stringify(o));
  check(o.focus === "support-thread-title", "focus on their name", o.focus);
  await page.screenshot({ path: `${OUT}/02-banner-to-thread-${width}.png` });
  await ctx.close();
}
{
  console.log("\n── the same banner, for a supervisor");
  const { ctx, page } = await open("supervisor", 1512, "/app/chat", { chatScenarioId: "escalation-active" });
  const s = await page.evaluate(() => ({
    link: !!document.querySelector('[data-slot="banner-supervisor"]'),
    text: [...document.querySelectorAll('[data-slot="status-banner"] p')].map((p) => p.textContent).join(" | "),
  }));
  check(!s.link && /Supervisor notified/.test(s.text), "plain text where the viewer cannot reach that contact", s.text);
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
