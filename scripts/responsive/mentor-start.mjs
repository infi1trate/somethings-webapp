// ═══════════════════════════════════════════════════════════════════════════
// /start/mentor — the dev bar's Mentor button opens a front door (2026-10-29)
//
//   1  the Mentor button lands on the chooser, remembering where it was
//   2  the landing's anatomy: two doors, existing first, the same card
//   3  existing: keeps the session (a seeded tier event survives), populates
//      an untouched mentor, and lands on the mentor's screen — or back on a
//      chat or a record, where the lens holds
//   4  already the mentor, the button is a no-op
//   5  new: the one blank reset, into the invite
//   6  back without switching changes nothing
//   7  an off-site `from` is ignored (no open redirect)
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/mentor-start";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
/* A session marker: one supervisor-set tier event, which only a reset wipes. */
const MARK = { id: "probe-mark", teenId: "t14", at: Date.now() - 3600e3, kind: "placed", tier: 3, fromTier: 4, actor: { id: "s-brandy", name: "Brandy", role: "supervisor" }, reason: "Probe: session marker." };
async function open(path, state) {
  const ctx = await b.newContext({ viewport: { width: 1512, height: 982 } });
  await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem("seeded", "1"); } }, [KEY, { state, version: VERSION }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}
const mentorBtn = (page) => page.locator("[data-dev-bar-root] button", { hasText: /^Mentor$/ }).first();
const store = (page) => page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)).state; return { persona: s.persona, mark: (s.tierEvents ?? []).some((e) => e.id === "probe-mark"), first: s.draft?.firstName ?? "", startedNew: s.mentorStartedNew }; }, KEY);
const leaveStart = (page) => page.waitForURL((u) => !u.pathname.startsWith("/start")).catch(() => {});

console.log("\n── 1–3 · from Monitoring, through the chooser, as the existing mentor");
{
  const { ctx, page, errors } = await open("/app/monitoring", { persona: "supervisor", tierEvents: [MARK] });
  await mentorBtn(page).click();
  await page.waitForURL(/\/start\/mentor/).catch(() => {});
  await page.waitForTimeout(700);
  const u = new URL(page.url());
  check(u.pathname === "/start/mentor" && u.searchParams.get("from") === "/app/monitoring" && (await store(page)).persona === "supervisor", "the Mentor button opens the chooser, remembering where it was, without switching yet", u.pathname + u.search);
  const doors = await page.evaluate(() => ({ doors: [...document.querySelectorAll("[data-start-entry]")].map((e) => e.dataset.startEntry), h1: document.querySelector("h1")?.textContent, filled: [...document.querySelectorAll("[data-start-entry]")].filter((e) => getComputedStyle(e).backgroundColor === getComputedStyle(document.body).color).length }));
  check(doors.doors.join() === "existing-mentor,new-mentor" && !!doors.h1 && doors.filled === 0, "two equal doors, existing first — the landing's anatomy", JSON.stringify(doors));
  await page.screenshot({ path: `${OUT}/01-chooser-1512.png` });
  await page.locator('[data-start-entry="existing-mentor"]').click();
  await leaveStart(page);
  await page.waitForTimeout(700);
  const s = await store(page);
  check(new URL(page.url()).pathname === "/app" && s.persona === "mentor" && s.first !== "" && s.mark && !s.startedNew, "existing: the populated mentor, on the mentor's screen — and the session's data survives", JSON.stringify({ path: new URL(page.url()).pathname, ...s }));
  check(errors.length === 0, "no page errors", errors.join(" | "));
  await ctx.close();
}

console.log("\n── 3–4 · from a chat, back to it; then the button is a no-op");
{
  const { ctx, page } = await open("/app/chat/t13?care=escalation", { persona: "supervisor", chatScenarioId: "escalation-active" });
  await mentorBtn(page).click();
  await page.waitForURL(/\/start\/mentor/).catch(() => {});
  await page.locator('[data-start-entry="existing-mentor"]').click();
  await leaveStart(page);
  await page.waitForTimeout(700);
  const u = new URL(page.url());
  check(u.pathname + u.search === "/app/chat/t13?care=escalation" && (await store(page)).persona === "mentor", "existing, from a chat: back on the same thread, as the mentor", u.pathname + u.search);
  await mentorBtn(page).click();
  await page.waitForTimeout(800);
  check(new URL(page.url()).pathname === "/app/chat/t13", "already the mentor: the button does nothing", new URL(page.url()).pathname);
  await ctx.close();
}

console.log("\n── 5 · start as a new mentor");
{
  const { ctx, page } = await open("/app/monitoring", { persona: "supervisor", tierEvents: [MARK] });
  await mentorBtn(page).click();
  await page.waitForURL(/\/start\/mentor/).catch(() => {});
  await page.locator('[data-start-entry="new-mentor"]').click();
  await page.waitForURL(/\/invite\//).catch(() => {});
  await page.waitForTimeout(700);
  const s = await store(page);
  check(/\/invite\/demo-invite-token$/.test(new URL(page.url()).pathname) && s.persona === "new-mentor" && s.startedNew && s.first === "" && !s.mark, "new: the one blank reset, into the demo invite — the session's data goes", JSON.stringify(s));
  await ctx.close();
}

console.log("\n── 6–7 · back, and an off-site from");
{
  const { ctx, page } = await open("/app/monitoring", { persona: "supervisor" });
  await mentorBtn(page).click();
  await page.waitForURL(/\/start\/mentor/).catch(() => {});
  await page.locator("[data-start-back]").click();
  await leaveStart(page);
  await page.waitForTimeout(600);
  check(new URL(page.url()).pathname === "/app/monitoring" && (await store(page)).persona === "supervisor", "back without switching: where it was, the lens unchanged", new URL(page.url()).pathname);
  await ctx.close();
}
{
  const { ctx, page } = await open("/start/mentor?from=//evil.example/x", { persona: "supervisor" });
  await page.locator('[data-start-entry="existing-mentor"]').click();
  await leaveStart(page);
  await page.waitForTimeout(800);
  const u = new URL(page.url());
  check(u.origin === new URL(BASE).origin && u.pathname === "/app", "an off-site from is ignored — the mentor's own screen instead", page.url());
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
