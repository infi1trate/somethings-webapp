// ═══════════════════════════════════════════════════════════════════════════
// THE SCROLLBAR GUTTER, MEASURED WITH SCROLLBARS ACTUALLY SHOWN
//
// THIS PROBE EXISTS BECAUSE EVERY OTHER ONE IS BLIND TO THE DEFECT. Playwright
// launches Chromium with `--hide-scrollbars`, so `offsetWidth - clientWidth` is
// 0 in every probe in this directory whatever the CSS does. The Care Reviews
// gutter regressed three passes running and was "verified fixed" each time
// under that flag — a 24px gutter, the header 25px short, rows 25px from the
// left and 49px from the right, all invisible to the tooling.
//
// SO THIS ONE REMOVES THE FLAG. With it removed, an unstyled `overflow: scroll`
// box reserves 15px — the behaviour of Windows Chrome and macOS "always show
// scroll bars" — and the assertions below have to hold there.
//
// THE INPUT IS ASSERTED: if the platform signature reads 0, the flag is back in
// effect and every check below would be measuring nothing, so the probe fails
// on that before it measures anything else.

import { chromium } from "playwright";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
for (const width of [1600, 1280]) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona: "supervisor", tasksScenarioId: "heavy-caseload" }, version: VERSION }]
  );
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  /* NO TEMPLATE LITERALS INSIDE — this string is itself one. */
  const d = await p.evaluate(`(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-999px;width:100px;height:100px;overflow:scroll";
    document.body.appendChild(probe);
    const signature = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    const sc = document.querySelector('[data-anno-ref="tasks-worklist-scroller"]');
    const pane = document.querySelector('[aria-label="Review details"]');
    if (!sc) return { signature, error: "no list scroller" };
    const cs = getComputedStyle(sc), R = (e) => e.getBoundingClientRect(), s = R(sc);
    const border = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const header = [...sc.querySelectorAll("div")].find((x) =>
      /Mentee/.test(x.textContent || "") && /Cycle/.test(x.textContent || "") && x.children.length <= 8);
    const row = [...sc.querySelectorAll('[role="treeitem"]')][3];
    const wrap = row ? row.querySelector(".items-stretch") : null;
    const age = wrap ? [...wrap.querySelectorAll("span")].filter((x) => /^\\d+[dh]$/.test((x.textContent || "").trim())).pop() : null;
    return {
      signature,
      listGutter: sc.offsetWidth - sc.clientWidth - border,
      paneGutter: pane ? pane.offsetWidth - pane.clientWidth : null,
      headerShort: header ? +(s.right - parseFloat(cs.borderRightWidth) - R(header).right).toFixed(1) : null,
      markerLeft: wrap ? +(R(wrap.firstElementChild).left - s.left).toFixed(1) : null,
      ageRight: age ? +(s.right - R(age).right).toFixed(1) : null,
    };
  })()`);
  console.log(`\n── ${width}px · platform signature ${d.signature}px`);
  check(d.signature > 0, "scrollbars are actually shown, so this probe can see a gutter", `${d.signature}px`);
  if (d.signature > 0 && !d.error) {
    check(d.listGutter === 0, "the list reserves no gutter", `${d.listGutter}px`);
    check(d.paneGutter === 0, "the pane reserves no gutter", `${d.paneGutter}px`);
    check(d.headerShort !== null && Math.abs(d.headerShort) < 1, "the header row reaches the right edge", `${d.headerShort}px short`);
    check(d.ageRight !== null && Math.abs(d.markerLeft - d.ageRight) <= 1.5,
      "row padding is symmetric", `marker ${d.markerLeft}px from left · age ${d.ageRight}px from right`);
  }
  await ctx.close();
}
await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
