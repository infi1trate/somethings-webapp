// ═══ STALE, MEASURED AT HEAD — NOT LIVE COVERAGE (noted arch-G, G7) ═══
//
// 13 failing check(s) on `main`'s own code, before arch-G touched this surface.
// It was written against the four-tab, deadline-forward Tasks page that arch-A,
// arch-E and arch-F replaced; its pane-footer geometry predates arch-F's sticky action bar.
// NOTHING IS RELAXED OR DELETED — a superseded assertion is evidence about what
// the surface used to promise. Retargeting these is a gap row, because the
// checks that still have a subject have to move to the probe that owns that
// subject and deciding which those are is a reading of three phases.
//
// THE TASKS APP FRAME — Part 1.2's acceptance criteria, measured.
//
// "Resolve actions clickable without scrolling, at any fixture length" is the
// requirement, so the checks drive the widths and scenarios where it could fail
// rather than the one where it happens to hold.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so a check kept passing while asserting about
   a surface it could not name, and a hop with the WRONG target would have passed
   too. Care Reviews is the billing surface; Risk Flags is the flag queue. */

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();

async function tasks(scenario, width, height) {
  const ctx = await b.newContext({ viewport: { width, height } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona: "supervisor", tasksScenarioId: scenario }, version: VERSION }]
  );
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  return p;
}

/** Select rows until the pane footer exists. */
async function openAny(p) {
  /* ═══ ROWS ARE `role="treeitem"`, NOT ANY BUTTON IN THE PANEL ═══
     `[role="tabpanel"] button` also matches the PANE's own Yes/No resolve
     buttons. Below `xl` the pane column is `display:none`, so those have zero
     width — and clicking one timed out for thirty seconds while the list sat
     there perfectly clickable. The selector was measuring the wrong control. */
  const rows = p.locator('[role="treeitem"]');
  const n = await rows.count();
  for (let i = 0; i < Math.min(n, 15); i++) {
    await rows.nth(i).click().catch(() => {});
    await p.waitForTimeout(320);
    /* ═══ VISIBLE, NOT MERELY PRESENT ═══
       Below `xl` the pane is `hidden` until a row is picked, and a hidden
       element is still in the DOM — so `count()` returned 1 and every
       measurement that followed read a zero rect: "excerpt 0px", "footer 800px
       above the fold". `isVisible` is the question that was meant. */
    if (await p.locator('[data-slot="task-pane-footer"]').first().isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

const PROBE = `(() => {
  const doc = document.scrollingElement;
  /* ═══ THE SHELL'S SCROLLER IS A DIV, NOT <main> ═══
     This probe queried main (the element) and reported no-scroll while the
     panel beneath it was scrolled 277px with 334px of overflow, which is what
     had carried the pinned header off the top. A check that names the wrong
     element passes for the wrong reason. */
  const main = [...document.querySelectorAll("div")].find(
    (d) => d.className.includes("overflow-y-auto") && d.className.includes("bg-[var(--surface-s1)]")
  ) ?? document.querySelector("main") ?? doc;
  const pane = document.querySelector('[data-slot="task-pane"]');
  const foot = document.querySelector('[data-slot="task-pane-footer"]');
  const list = document.querySelector('[role="tree"]')?.closest("div[class*=overflow-y-auto]");
  const region = document.querySelector('[role="group"][aria-label*="Conversation excerpt"]');
  const tabs = document.querySelector('[role="tablist"]');
  const h1 = document.querySelector("h1");
  const r = (el) => el ? el.getBoundingClientRect() : null;
  const fb = r(foot), pb = r(pane);
  const scrollable = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return (cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1;
  };
  return {
    // NO GLOBAL PAGE SCROLLBAR.
    docOverflow: doc.scrollHeight - doc.clientHeight,
    mainOverflow: main.scrollHeight - main.clientHeight,
    // THE FOOTER IS ON SCREEN, AND ON THE PANE'S OWN BOTTOM EDGE.
    footerInViewport: fb ? fb.bottom <= innerHeight + 1 && fb.top >= 0 : null,
    footerFlushToPane: fb && pb ? Math.abs(fb.bottom - pb.bottom) <= 1 : null,
    footerBottomGap: fb ? Math.round(innerHeight - fb.bottom) : null,
    // HEADER AND TABS PINNED: still at their original y after scrolling the list.
    h1Top: h1 ? Math.round(r(h1).top) : null,
    tabsTop: tabs ? Math.round(r(tabs).top) : null,
    listScrolls: scrollable(list),
    excerptH: region ? Math.round(r(region).height) : null,
    excerptContained: region ? getComputedStyle(region).overscrollBehaviorY : null,
    rows: document.querySelectorAll('[role="treeitem"]').length,
  };
})()`;

for (const [scenario, width, height] of [
  ["typical-shift", 1440, 900],
  ["heavy-caseload", 1440, 900],
  ["heavy-caseload", 1440, 700],
  ["breach-overnight", 1280, 800],
  ["typical-shift", 1024, 800],   // below xl → pane takeover
]) {
  const p = await tasks(scenario, width, height);
  const found = await openAny(p);
  console.log(`\n── ${scenario} @ ${width}×${height} ──`);
  if (!found) { check(false, "a pane opens"); await p.context().close(); continue; }

  const before = await p.evaluate(PROBE);
  check(before.docOverflow <= 0, "no global page scrollbar", `document overflow ${before.docOverflow}px`);
  check(before.mainOverflow <= 0, "the shell's main does not scroll either", `${before.mainOverflow}px`);
  check(before.footerInViewport, "the resolve footer is in the viewport", `${before.footerBottomGap}px above the fold`);
  check(before.footerFlushToPane, "and flush with the pane's bottom edge");
  if (before.excerptH !== null) {
    check(before.excerptH >= 330 && before.excerptH <= 350, "the excerpt is bounded at ~340px", `${before.excerptH}px`);
    check(before.excerptContained === "contain", "excerpt overscroll contained", String(before.excerptContained));
  }

  // ═══ SCROLL THE LIST: the header and tabs must not move, and the footer
  //     must still be clickable. This is the acceptance criterion.
  await p.evaluate(() => {
    const list = document.querySelector('[role="tree"]')?.closest("div[class*=overflow-y-auto]");
    if (list) list.scrollTop = list.scrollHeight;
  });
  await p.waitForTimeout(250);
  const after = await p.evaluate(PROBE);
  // ON SCREEN, not merely unmoved: the first version asserted only that the
  // values were equal, and −237 → −237 passed while the header sat above the
  // viewport. "Pinned" means visible.
  check(after.h1Top === before.h1Top && after.h1Top >= 0,
    "the title stays put AND on screen", `${before.h1Top} → ${after.h1Top}`);
  check(after.tabsTop === before.tabsTop && after.tabsTop >= 0,
    "the tab group stays put AND on screen", `${before.tabsTop} → ${after.tabsTop}`);
  check(after.footerInViewport, "the resolve footer is STILL in the viewport after scrolling the list");
  check(after.docOverflow <= 0, "and the page still does not scroll");

  // The footer's primary control is actually clickable (not covered).
  const hit = await p.evaluate(() => {
    const foot = document.querySelector('[data-slot="task-pane-footer"]');
    const btn = foot?.querySelector("button");
    if (!btn) return "no button";
    const r = btn.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return btn === top || btn.contains(top) ? null : (top?.tagName.toLowerCase() ?? "nothing");
  });
  check(hit === null, "a click at the resolve button reaches it", hit ? `intercepted by ${hit}` : "");
  if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/frame-${scenario}-${width}x${height}.png` });
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
