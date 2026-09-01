// THE STANDING POST-PHASE CHECK — every surface a Tasks change must not break.
//
// Deliberately shallow: it opens each route, waits for it to settle, and asserts
// that it rendered real content with no page error and no console error. It is
// not a substitute for the per-brief probes; it is the thing that catches an
// import cycle or a crash on a surface nobody thought to look at.
//
// IT SEEDS THE STORE. Without a persona the shell renders and the page content
// does not — the first version of this file reported seven passes at ~720
// characters each, which was the navigation and nothing else. A smoke test that
// passes on an empty page is worse than none.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
import { STORE_VERSION as VERSION } from "./store-version.mjs";
const b = await chromium.launch();
let fails = 0;
const VIEWS = [
  ["/onboarding", "onboarding wizard"],
  ["/app/settings", "settings tabs"],
  ["/app/profile", "profile / pre-publish dock"],
  ["/admin/profile-update", "admin profile-update"],
  ["/app/tasks", "tasks"],
  ["/app/activity", "activity"],
  ["/app/mentees", "mentees"],
  ["/app/chat", "mentor chat"],
  ["/app/chat?with=t13", "mentor chat · deep link"],
  ["/dev/components", "component gallery"],
  ["/admin/person/t17?tab=care", "teen record · Care"],
  ["/admin/person/t17?tab=activity", "teen record · Activity"],
];
for (const [path, name] of VIEWS) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(
    ([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); },
    [KEY, { state: { persona: "supervisor" }, version: VERSION }]
  );
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
  await p.goto(BASE + path, { waitUntil: "networkidle" }).catch((e) => errs.push(String(e)));
  await p.waitForTimeout(1400);
  const info = await p.evaluate(`(() => {
    const t = (document.body.innerText || "").trim();
    return { len: t.length, head: t.split(String.fromCharCode(10)).filter(Boolean).slice(0, 3).join(" / ") };
  })()`);
  const ok = errs.length === 0 && info.len > 400;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name} (${path}) — ${info.len} chars · ${info.head}${errs.length ? " · ERR " + errs.slice(0, 2).join(" | ") : ""}`);
  await ctx.close();
}
await b.close();
console.log(fails === 0 ? "ALL SURFACES RENDER" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
