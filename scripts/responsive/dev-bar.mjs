// THE DEV BAR IS REACHABLE, AT EVERY WIDTH — gap row 311.
//
// The row's defect was not "the control is awkward on a phone". It was "the
// control cannot be operated at all": the Tasks scenario panel was pinned
// bottom-right at z-40 under a `md:hidden` bottom nav also at z-40, so below
// `md` every tap at its coordinates went to the nav. This asserts the fix, and
// asserts it the way the bug was found — by asking who actually receives a tap
// at the control's own coordinates, not by checking the element exists.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3003";
const KEY = "somethings.mentor-onboarding";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();

for (const [label, width, height] of [
  ["xs", 320, 844],
  ["s", 390, 844],
  ["md", 768, 1024],
  ["xl", 1440, 900],
]) {
  const ctx = await b.newContext({ viewport: { width, height } });
  // SEED ONLY IF ABSENT. `addInitScript` runs on EVERY navigation, so an
  // unconditional write re-seeded the store on each `goto` and wiped the field
  // whose persistence this file is trying to prove — the check failed at all four
  // widths and the product was correct. A harness that resets the thing it is
  // measuring reports a fault it caused.
  await ctx.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
    },
    [KEY, { state: { persona: "supervisor" }, version: VERSION }]
  );
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1400);
  console.log(`\n═══ ${label} · ${width}px ═══`);

  // 1 · the pinned panel is gone, everywhere.
  check(
    (await p.getByText("Prototype scenarios", { exact: false }).count()) === 0,
    "the pinned scenario panel is gone"
  );

  // 2 · the axis is in the bar.
  const sel = p.locator("select").filter({ has: p.locator('optgroup[label="Tasks"]') }).first();
  if ((await sel.count()) === 0) {
    check(false, "the dev bar carries a Tasks scenario group");
    await ctx.close();
    continue;
  }
  check(true, "the dev bar carries a Tasks scenario group");

  // 3 · THE EDGE FADE marks the hidden content, and only when there is some.
  const fadeState = await p.evaluate(() => {
    const scroller = Array.from(document.querySelectorAll("div")).find(
      (d) => d.getAttribute("role") === "region" && d.getAttribute("aria-label") === "Prototype harness"
    );
    if (!scroller) return { error: "no bar" };
    const overflows = scroller.scrollWidth > scroller.clientWidth + 1;
    // The fades are siblings of the scroller, inside its relative parent.
    const sibs = Array.from(scroller.parentElement.children).filter((c) => c !== scroller);
    const painted = sibs.filter((c) => {
      const cs = getComputedStyle(c);
      return parseFloat(cs.opacity) > 0.01 && cs.backgroundImage !== "none";
    }).length;
    return { overflows, siblings: sibs.length, painted, client: scroller.clientWidth, scroll: scroller.scrollWidth };
  });
  if (fadeState.overflows) {
    check(fadeState.painted > 0, "an edge fade marks the hidden content", `${fadeState.painted} painted, scroll ${fadeState.scroll} > client ${fadeState.client}`);
  } else {
    check(fadeState.painted === 0, "no fade when nothing is hidden", `client ${fadeState.client} = scroll ${fadeState.scroll}`);
  }

  // 4 · THE ROW-311 ASSERTION. Scroll it into view, then ask who owns the point.
  await sel.scrollIntoViewIfNeeded();
  await p.waitForTimeout(350);
  const owner = await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll("select")).find((s) =>
      s.querySelector('optgroup[label="Tasks"]')
    );
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return "OFF-VIEWPORT";
    const top = document.elementFromPoint(cx, cy);
    if (!top) return "nothing";
    return el === top || el.contains(top) ? null : `${top.tagName.toLowerCase()}.${String(top.className).split(" ").slice(0, 2).join(".")}`;
  });
  check(owner === null, "a tap at its centre reaches the control", owner ? `taken by ${owner}` : "");

  // 5 · and operating it actually switches the scenario.
  await sel.selectOption({ label: "Breach overnight" });
  await p.waitForTimeout(900);
  const stored = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).state.tasksScenarioId, KEY);
  check(stored === "breach-overnight", "selecting one writes the store", String(stored));

  // 6 · and it SURVIVES navigation, which the page-local version did not.
  await p.goto(`${BASE}/app/activity`, { waitUntil: "networkidle" });
  await p.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1100);
  const after = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).state.tasksScenarioId, KEY);
  check(after === "breach-overnight", "and survives a round trip through another screen", String(after));

  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
