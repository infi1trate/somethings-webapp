// ═══════════════════════════════════════════════════════════════════════════
// CHAT SEND (pack v3.0, Phase 0's confirmed bug) — measured, per role
//
// The thread's composer was never given `onSend`, and nothing stored a sent
// message: Send cleared the box and went nowhere (since the Phase 1 shell).
// This probe sends from every role that has a composer and checks the line
// lands in the thread, is in view, survives a reload, and that every role
// without a composer still has none.
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
const LIST = '[role="list"][aria-label^="Conversation with"]';

for (const persona of ["mentor", "lead-mentor", "supervisor", "admin"]) {
  console.log(`\n── ${persona}`);
  const ctx = await b.newContext({ viewport: { width: 1512, height: 1000 } });
  await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem("seeded", "1"); } }, [KEY, { state: { persona, chatScenarioId: "active-mentorship" }, version: VERSION }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
  await page.goto(`${BASE}/app/chat/t14`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const composer = page.locator('[data-slot="composer"] textarea');
  const has = (await composer.count()) > 0;
  if (persona === "supervisor" || persona === "admin") {
    const footer = await page.locator('[data-slot="chat-observer"]').count();
    check(!has && footer === 1, "no composer — the observer's footer instead", `composer ${has} · footer ${footer}`);
  } else {
    check(has, "has a composer");
    const line = `Probe line from ${persona} ${Date.now()}`;
    const before = await page.locator(`${LIST} > li[id^="msg-"]`).count();
    await composer.fill(line);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const after = await page.evaluate(([LIST, line]) => {
      const items = [...document.querySelectorAll(`${LIST} > li[id^="msg-"]`)];
      const hit = items.find((li) => li.innerText.includes(line));
      const sc = document.querySelector('[data-anno-ref="chat-thread-scroller"]');
      const r = hit?.getBoundingClientRect(), s = sc?.getBoundingClientRect();
      return { count: items.length, last: items.at(-1)?.innerText.includes(line), inView: !!(r && s && r.top >= s.top && r.bottom <= s.bottom + 1), box: document.querySelector('[data-slot="composer"] textarea')?.value };
    }, [LIST, line]);
    check(after.count === before + 1 && after.last, "Send puts the line at the end of the thread", JSON.stringify({ before, after: after.count }));
    check(after.inView, "and scrolls it into view");
    check(after.box === "", "and clears the composer");
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state.chatMessages?.t14?.at(-1), KEY);
    check(stored?.text === line && stored.sender === "mentor", "the store holds it, as the mentor's message", JSON.stringify(stored && { sender: stored.sender }));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const kept = await page.evaluate(([LIST, line]) => [...document.querySelectorAll(`${LIST} > li[id^="msg-"]`)].some((li) => li.innerText.includes(line)), [LIST, line]);
    check(kept, "and it survives a reload");
  }
  check(errors.length === 0, "no page errors", errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
