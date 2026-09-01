import { chromium } from "playwright";
import { STORE_VERSION } from "./store-version.mjs";
const KEY = "somethings.mentor-onboarding";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
  [KEY, { state: { persona: "mentor", chatScenarioId: process.env.SC }, version: STORE_VERSION }]);
const p = await ctx.newPage();
await p.goto("http://localhost:3000/app/chat", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
if (process.env.HOVER) { await p.locator('[role="list"][aria-label^="Conversation with"] > li').nth(Number(process.env.HOVER)).hover(); await p.waitForTimeout(400); }
await p.screenshot({ path: process.env.OUT });
await b.close();
