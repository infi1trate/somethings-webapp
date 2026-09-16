// ═══ STALE, MEASURED AT HEAD — NOT LIVE COVERAGE (noted arch-G, G7) ═══
//
// 14 failing check(s) on `main`'s own code, before arch-G touched this surface.
// It was written against the four-tab, deadline-forward Tasks page that arch-A,
// arch-E and arch-F replaced; its "2 tier bands" and sticky-header assertions predate
// deadline buckets and the pinned escalation band, and its virtualization
// checks scroll a list whose first section is deliberately never windowed.
// NOTHING IS RELAXED OR DELETED — a superseded assertion is evidence about what
// the surface used to promise. Retargeting these is a gap row, because the
// checks that still have a subject have to move to the probe that owns that
// subject and deciding which those are is a reading of three phases.
//
// TASKS AT REAL VOLUME — Part 3's acceptance criteria, measured.
//
// Every claim in Part 3 is a claim about what happens at FIFTY rows, and none of
// them can be checked by looking at a list of eight. So the probes drive the two
// dense scenarios and assert the things that only break under volume:
//
//   · the row grid is exact — a virtualizer built on a nominal height that the
//     content quietly exceeds selects the wrong row forty rows down
//   · the band header is pinned to the card, not scrolled away with the rows
//   · the mounted node count stays a window, not the whole list
//   · keyboard selection crosses the window boundary and lands focused
//   · y / n resolve, and are inert while someone is typing
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

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
  await p.goto(`${BASE}/app/tasks`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  return p;
}

/** The list card is the scroller now — find it by role. */
const PROBE = `(() => {
  const tree = document.querySelector('[role="tree"]');
  if (!tree) return { ok: false };
  const rows = [...tree.querySelectorAll('[role="treeitem"]')];
  const groups = [...tree.querySelectorAll('[role="group"]')];
  const headers = groups
    .map((g) => g.firstElementChild)
    .filter((el) => el && getComputedStyle(el).position === "sticky");
  const treeRect = tree.getBoundingClientRect();
  return {
    ok: true,
    scrollTop: tree.scrollTop,
    scrollHeight: tree.scrollHeight,
    clientHeight: tree.clientHeight,
    overflowY: getComputedStyle(tree).overflowY,
    overscroll: getComputedStyle(tree).overscrollBehaviorY,
    mounted: rows.length,
    heights: [...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height)))],
    bandCount: groups.length,
    stickyCount: headers.length,
    bandLabels: groups.map((g) => g.getAttribute("aria-label")),
    /* ═══ EVERY HEADER'S DELTA, NOT THE FIRST ONE'S ═══
       A sticky header sticks WITHIN ITS OWN PARENT. Once a band's rows are all
       scrolled past, its header leaves with them and the NEXT band's header
       takes the top edge — which is the behaviour we want and the behaviour the
       first draft of this probe called a failure: it measured headers[0] and
       reported "-171px from the top" for a band that had correctly finished.
       So: report all of them, and the check asks whether ONE is at the edge. */
    headerDeltas: headers.map((h) =>
      Math.round(h.getBoundingClientRect().top - treeRect.top)
    ),
    firstRowText: rows[0]?.getAttribute("aria-label") ?? null,
  };
})()`;

async function scenario(name, width, height, expect) {
  console.log(`\\n── ${name} @ ${width}x${height}`);
  const p = await tasks(name, width, height);
  const before = await p.evaluate(PROBE);
  if (!before.ok) {
    check(false, "the worklist rendered");
    await p.context().close();
    return;
  }

  // ── Geometry ───────────────────────────────────────────────────────────
  check(
    before.heights.length === 1 && before.heights[0] === 56,
    "every row is exactly 56px",
    `heights ${JSON.stringify(before.heights)}`
  );
  check(before.overflowY === "auto", "the list card is its own scroller", before.overflowY);
  check(before.overscroll === "contain", "and does not chain its scroll", before.overscroll);
  check(
    before.scrollHeight > before.clientHeight + 200,
    "there is real overflow to scroll",
    `${before.scrollHeight} vs ${before.clientHeight}`
  );

  // ── Bands ──────────────────────────────────────────────────────────────
  check(
    before.bandCount === expect.bands,
    `${expect.bands} tier bands`,
    before.bandLabels.join(" | ")
  );
  check(
    before.stickyCount === expect.bands,
    "each band's header is position:sticky"
  );
  check(
    before.bandLabels.every((l) => /\u2014 \d+$/.test(l ?? "")),
    "every band header carries its own count",
    before.bandLabels.join(" | ")
  );

  // ── Virtualization ─────────────────────────────────────────────────────
  check(
    before.mounted < expect.total,
    `only a window is mounted (${before.mounted} of ${expect.total})`
  );
  const budget = Math.ceil(before.clientHeight / 56) + 2 * 6 + 4;
  check(
    before.mounted <= budget,
    `and the window is viewport-sized (<= ${budget})`,
    `${before.mounted}`
  );

  // ── Scroll: the header stays, the rows move ────────────────────────────
  await p.evaluate(`document.querySelector('[role="tree"]').scrollTop = 900`);
  await p.waitForTimeout(400);
  const mid = await p.evaluate(PROBE);
  check(mid.scrollTop > 800, "the list scrolled", `${mid.scrollTop}`);
  check(
    mid.headerDeltas.some((d) => Math.abs(d) <= 1),
    "a band header is pinned to the card's top edge mid-scroll",
    `deltas ${JSON.stringify(mid.headerDeltas)}`
  );
  check(
    mid.firstRowText !== before.firstRowText,
    "and the mounted rows are different ones"
  );
  check(
    mid.mounted <= budget,
    "the window stayed a window after scrolling",
    `${mid.mounted}`
  );

  await p.context().close();
}

// ═══ 1 · Geometry, bands and the window, at both dense volumes ════════════
await scenario("typical-shift", 1440, 900, { bands: 2, total: 31 });
await scenario("heavy-caseload", 1440, 900, { bands: 2, total: 39 });

// ═══ 2 · Keyboard selection across the virtualization boundary ════════════
console.log("\\n── keyboard across the boundary @ heavy-caseload 1440x900");
{
  const p = await tasks("heavy-caseload", 1440, 900);
  const rows = p.locator('[role="treeitem"]');
  await rows.first().click();
  await p.waitForTimeout(300);

  const start = await p.evaluate(PROBE);
  // Far enough to leave the first window entirely — 30 rows is ~1680px.
  for (let i = 0; i < 30; i++) {
    await p.keyboard.press("j");
  }
  await p.waitForTimeout(500);

  const after = await p.evaluate(`(() => {
    const tree = document.querySelector('[role="tree"]');
    const active = document.activeElement;
    const rect = active?.getBoundingClientRect();
    const t = tree.getBoundingClientRect();
    return {
      role: active?.getAttribute("role"),
      selected: active?.getAttribute("aria-selected"),
      label: active?.getAttribute("aria-label"),
      scrollTop: tree.scrollTop,
      /* IN VIEW, not merely focused: a focused row scrolled past the bottom edge
         is the exact failure this check exists for. */
      inView: rect ? rect.top >= t.top - 1 && rect.bottom <= t.bottom + 1 : false,
      mounted: tree.querySelectorAll('[role="treeitem"]').length,
    };
  })()`);

  check(after.scrollTop > start.clientHeight, "30 × j scrolled past the first window", `${after.scrollTop}px`);
  check(after.role === "treeitem", "focus is on a row, not lost to the body", String(after.role));
  check(after.selected === "true", "and that row is the selected one");
  check(after.inView, "and it is inside the card's viewport");
  check(after.mounted > 0 && after.mounted < 39, "still windowed", `${after.mounted}`);

  // ↑ back across the boundary.
  for (let i = 0; i < 30; i++) await p.keyboard.press("k");
  await p.waitForTimeout(400);
  const back = await p.evaluate(`(() => {
    const tree = document.querySelector('[role="tree"]');
    const a = document.activeElement;
    const r = a?.getBoundingClientRect(); const t = tree.getBoundingClientRect();
    return { top: tree.scrollTop, role: a?.getAttribute("role"),
             inView: r ? r.top >= t.top - 1 && r.bottom <= t.bottom + 1 : false };
  })()`);
  check(back.top < 40, "30 × k came back to the top", `${back.top}px`);
  check(back.role === "treeitem" && back.inView, "with focus on a visible row");

  await p.context().close();
}

// ═══ 3 · y / n resolve, and are inert while typing ════════════════════════
console.log("\\n── y / n @ typical-shift 1440x900");
{
  const p = await tasks("typical-shift", 1440, 900);
  // The Risk flags tab, so the selected item has a correctness question.
  await p.locator('[role="tab"]', { hasText: "Risk flags" }).first().click().catch(() => {});
  await p.waitForTimeout(400);
  const rows = p.locator('[role="treeitem"]');
  await rows.first().click();
  await p.waitForTimeout(400);

  const openBefore = await p.evaluate(`document.querySelectorAll('[role="treeitem"]').length`);
  const labelBefore = await p.evaluate(
    `document.querySelector('[data-slot="task-pane"] h2')?.textContent ?? null`
  );

  await p.keyboard.press("y");
  await p.waitForTimeout(700);
  const labelAfter = await p.evaluate(
    `document.querySelector('[data-slot="task-pane"] h2')?.textContent ?? null`
  );
  const toast = await p.evaluate(
    `[...document.querySelectorAll("*")].some((n) => (n.textContent || "").includes("Undo"))`
  );
  check(!!labelBefore, "a flag was selected", String(labelBefore));
  check(toast, "y resolved it — the undo toast is up");
  check(labelAfter !== labelBefore, "and the pane advanced to the next flag", `${labelBefore} → ${labelAfter}`);
  void openBefore;

  // INERT IN A TEXT INPUT. The DSM-5 search is behind billing, so use the
  // simplest editable target the page can be given: focus any input on screen.
  await p.keyboard.press("u"); // undo, back to a clean state
  await p.waitForTimeout(700);
  const inert = await p.evaluate(`(() => {
    const i = document.createElement("input");
    document.body.appendChild(i);
    i.focus();
    const before = document.querySelectorAll('[role="treeitem"]').length;
    i.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    const after = document.querySelectorAll('[role="treeitem"]').length;
    i.remove();
    return { before, after };
  })()`);
  check(
    inert.before === inert.after,
    "n typed into a text field resolves nothing",
    `${inert.before} → ${inert.after}`
  );

  await p.context().close();
}

// ═══ 4 · A hundred rows, and the frame budget ════════════════════════════
console.log("\\n── 100 rows @ heavy-caseload 1440x900");
{
  const p = await tasks("heavy-caseload", 1440, 900);
  /* ═══ EXPAND EVERY GROUP — WHICH MEANS SCROLLING TO REACH THEM ═══
     The obvious loop (count the collapsed groups, click each) tops out at 84 of
     97 rows, and the reason is the thing being tested: a group below the window
     IS NOT IN THE DOM, so the locator cannot see it and Playwright quietly
     expands only what happens to be mounted. Measured before it was believed.
     So: expand what is mounted, scroll a screen, repeat. */
  for (let pass = 0; pass < 20; pass++) {
    const collapsed = p.locator('[role="treeitem"][aria-expanded="false"]');
    const n = await collapsed.count();
    for (let i = 0; i < n; i++) {
      await collapsed.nth(i).click().catch(() => {});
      await p.keyboard.press("ArrowRight").catch(() => {});
      await p.waitForTimeout(40);
    }
    const atEnd = await p.evaluate(`(() => {
      const t = document.querySelector('[role="tree"]');
      const was = t.scrollTop;
      t.scrollTop = was + t.clientHeight * 0.8;
      return t.scrollTop <= was + 1;
    })()`);
    await p.waitForTimeout(140);
    if (atEnd) break;
  }
  await p.waitForTimeout(400);

  const deep = await p.evaluate(`(() => {
    const tree = document.querySelector('[role="tree"]');
    return {
      rows: Math.round((tree.scrollHeight - 68) / 56),
      mounted: tree.querySelectorAll('[role="treeitem"]').length,
      height: tree.scrollHeight,
    };
  })()`);
  check(deep.rows >= 90, "the expanded list is ~100 rows", `${deep.rows} rows / ${deep.height}px`);
  check(deep.mounted <= 30, "and still only a window is mounted", `${deep.mounted}`);

  /* ═══ THE FRAME BUDGET, MEASURED RATHER THAN ASSERTED ═══
     Scrolls the whole list in rAF steps and records the longest frame. 60fps is
     16.7ms; the gate is 32ms (two frames) because a headless browser under a
     test runner is not a fair 60fps environment and a tighter bound would fail
     for reasons that have nothing to do with this list. What it DOES catch is
     the real regression — rendering all hundred rows every frame, which lands
     in the hundreds of milliseconds, not the tens. */
  const perf = await p.evaluate(`(async () => {
    const tree = document.querySelector('[role="tree"]');
    tree.scrollTop = 0;
    const frames = [];
    let last = performance.now();
    const max = tree.scrollHeight - tree.clientHeight;
    for (let y = 0; y < max; y += 160) {
      tree.scrollTop = y;
      await new Promise((r) => requestAnimationFrame(r));
      const t = performance.now();
      frames.push(t - last);
      last = t;
    }
    frames.shift();
    return {
      steps: frames.length,
      worst: Math.round(Math.max(...frames)),
      median: Math.round(frames.sort((a, b) => a - b)[Math.floor(frames.length / 2)]),
    };
  })()`);
  check(
    perf.worst <= 32,
    "scrolling the whole list stays inside two frames",
    `worst ${perf.worst}ms, median ${perf.median}ms over ${perf.steps} steps`
  );

  await p.context().close();
}

// ═══ 5 · A cleared band retires rather than vanishing ═════════════════════
console.log("\\n── band retirement @ active-escalation 1440x900");
{
  const p = await tasks("active-escalation", 1440, 900);
  await p.locator('[role="tab"]', { hasText: "Risk flags" }).first().click().catch(() => {});
  await p.waitForTimeout(500);

  const start = await p.evaluate(PROBE);
  check(start.bandCount === 2, "two bands, one row each", start.bandLabels.join(" | "));

  // Resolve the first band's only row.
  await p.locator('[role="treeitem"]').first().click();
  await p.waitForTimeout(400);
  await p.keyboard.press("y");
  await p.waitForTimeout(300);

  const retired = await p.evaluate(`(() => {
    const labels = [...document.querySelectorAll('[role="tree"] [role="group"]')]
      .map((g) => g.getAttribute("aria-label"));
    return { labels };
  })()`);
  check(
    retired.labels.some((l) => (l ?? "").includes("cleared")),
    "the cleared band stays, reporting the clearance",
    retired.labels.join(" | ")
  );
  check(
    !retired.labels.some((l) => /!$/.test(l ?? "")),
    "and it does not celebrate"
  );

  // And it leaves on its own.
  await p.waitForTimeout(3200);
  const gone = await p.evaluate(`
    [...document.querySelectorAll('[role="tree"] [role="group"]')]
      .map((g) => g.getAttribute("aria-label"))`);
  check(
    !gone.some((l) => (l ?? "").includes("cleared")),
    "then retires on its own",
    gone.join(" | ")
  );

  await p.context().close();
}

await b.close();
console.log(`\\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
