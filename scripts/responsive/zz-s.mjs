import { chromium } from "playwright";
import { STORE_VERSION } from "./store-version.mjs";
const KEY = "somethings.mentor-onboarding";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
  [KEY, { state: { persona: "mentor", chatScenarioId: process.env.SC }, version: STORE_VERSION }]);
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0,200)));
await p.goto("http://localhost:3000/app/chat", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
if (process.env.TAB) { await p.locator('[role="tab"]', { hasText: process.env.TAB }).first().click(); await p.waitForTimeout(500); }
if (process.env.PICK) { await p.locator('button', { hasText: process.env.PICK }).first().click(); await p.waitForTimeout(500); }
await p.screenshot({ path: process.env.OUT });
console.log(errs.length ? "ERR " + errs.join(" | ") : "clean");
await b.close();
