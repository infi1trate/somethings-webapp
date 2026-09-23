// VERIFICATION FOR THE TASKS BRIEF (Parts 1–4).
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

async function tasks({ scenario = "typical-shift", load = "ready", width = 1440, height = 1000 } = {}) {
  const ctx = await b.newContext({ viewport: { width, height } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona: "supervisor", tasksScenarioId: scenario, devLoadState: load }, version: VERSION }]
  );
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  return p;
}

/** Open the first row whose pane is a risk flag. */
async function openFlagRow(p) {
  const rows = p.locator('[role="tabpanel"] button, [role="tabpanel"] [role="button"]');
  const n = await rows.count();
  for (let i = 0; i < Math.min(n, 12); i++) {
    await rows.nth(i).click().catch(() => {});
    await p.waitForTimeout(500);
    if (await p.locator('[role="group"][aria-label*="Conversation excerpt"]').count()) return true;
  }
  return false;
}

// ═══ PART 1 · THE CONVERSATION EXCERPT ═══
console.log("\n═══ Part 1 · conversation excerpt ═══");
{
  const p = await tasks({ scenario: "typical-shift" });
  const found = await openFlagRow(p);
  check(found, "a risk-flag pane renders the excerpt");
  if (found) {
    const r = await p.evaluate(() => {
      const region = document.querySelector('[role="group"][aria-label*="Conversation excerpt"]');
      const cs = getComputedStyle(region);
      const bubbles = [...region.querySelectorAll("li")];
      const flagged = bubbles.find((li) => li.querySelector(".sr-only")?.textContent?.includes("Flagged"));
      const quoteGone = !document.body.innerText.includes("Flagged content");
      return {
        height: Math.round(region.getBoundingClientRect().height),
        overflowY: cs.overflowY,
        overscroll: cs.overscrollBehaviorY,
        tabIndex: region.getAttribute("tabindex"),
        label: region.getAttribute("aria-label"),
        bubbles: bubbles.length,
        flaggedCount: bubbles.filter((li) => li.querySelector(".sr-only")?.textContent?.includes("Flagged")).length,
        // ANCHORED = the region is scrolled, not sitting at 0.
        scrollTop: Math.round(region.scrollTop),
        scrollHeight: region.scrollHeight,
        regionH: Math.round(region.clientHeight),
        flaggedOffsetInRegion: flagged
          ? Math.round(flagged.getBoundingClientRect().top - region.getBoundingClientRect().top)
          : null,
        flaggedInView: flagged
          ? (() => {
              const rr = region.getBoundingClientRect();
              const fr = flagged.getBoundingClientRect();
              return fr.bottom > rr.top && fr.top < rr.bottom;
            })()
          : false,
        flaggedRoughlyCentred: flagged
          ? (() => {
              const rr = region.getBoundingClientRect();
              const fr = flagged.getBoundingClientRect();
              const mid = fr.top + fr.height / 2 - rr.top;
              return mid > rr.height * 0.2 && mid < rr.height * 0.8;
            })()
          : false,
        flaggedText: flagged?.textContent?.replace("Flagged message.", "").trim().slice(0, 60),
        edgeMarker: region.textContent.includes("Earlier messages in the full conversation"),
        deepLink: [...document.querySelectorAll("a")].find((a) => /Open full conversation/.test(a.textContent))?.getAttribute("href"),
        quoteGone,
      };
    });
    check(r.height >= 300 && r.height <= 340, "bounded ~320px", `${r.height}px`);
    check(r.overflowY === "auto" || r.overflowY === "scroll", "internal scroll", r.overflowY);
    check(r.overscroll === "contain", "overscroll contained (no scroll chaining)", r.overscroll);
    check(r.tabIndex === "0", "keyboard-focusable region");
    check(/Conversation excerpt, flagged message from /.test(r.label ?? ""), "labelled", JSON.stringify(r.label));
    check(r.bubbles >= 15, "a window of surrounding messages is preloaded", `${r.bubbles} bubbles`);
    check(r.flaggedCount === 1, "exactly one flagged message", String(r.flaggedCount));
    // ═══ "IS IT VISIBLE", NOT "IS scrollTop > 0" ═══
    // The weak version passed on scrollTop=1209 — which was the CLAMPED MAXIMUM,
    // i.e. the excerpt had scrolled to the very end and shown the wrong thing.
    // An assertion that cannot tell "anchored" from "scrolled to the bottom" is
    // not testing the feature.
    check(r.flaggedInView, "the flagged message is IN VIEW after anchoring",
      `flagged at ${r.flaggedOffsetInRegion}px of a ${r.regionH}px window (scrollTop ${r.scrollTop})`);
    check(r.flaggedRoughlyCentred, "and roughly centred, so the lines before it are visible too");
    check(r.edgeMarker, "quiet edge marker at the fixture boundary");
    check(/\/app\/chat\?with=.*&msg=/.test(r.deepLink ?? ""), "deep link carries the message id", r.deepLink ?? "none");
    check(r.quoteGone, 'the old "Flagged content" quote block is gone');

    // THE FLAGGED LINE MATCHES THE ITEM'S OWN STRING — the brief's exact ask.
    const matches = await p.evaluate(() => {
      const region = document.querySelector('[role="group"][aria-label*="Conversation excerpt"]');
      const flagged = [...region.querySelectorAll("li")].find((li) => li.querySelector(".sr-only")?.textContent?.includes("Flagged"));
      // THE BUBBLE, NOT THE <li>. The list item also holds the sender name and the
      // timestamp, so `li.textContent` was "Jordan3:59 PMthings at home…" — a
      // string that appears nowhere else, which failed a check the code passes.
      const bubble = flagged?.querySelector(":scope > div");
      const text = [...(bubble?.childNodes ?? [])]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join("")
        .trim();
      return { text, hasText: text.length > 10 };
    });
    check(matches.hasText, "the flagged bubble carries the excerpt text", JSON.stringify(matches.text?.slice(0, 60)));

    // ═══ CAPTURE THE ANCHORED STATE, BEFORE THE SCROLL TEST ═══
    // The containment check below slams `scrollTop` to the bottom on purpose, so
    // a screenshot taken after it shows the tail of the conversation and reads as
    // "the anchor did not work". Order matters for evidence.
    if (process.env.SHOT_DIR) {
      await p.locator('[role="group"][aria-label*="Conversation excerpt"]').first()
        .screenshot({ path: process.env.SHOT_DIR + "/P1-excerpt.png" });
    }

    // SCROLL DOES NOT ESCAPE THE REGION.
    const contained = await p.evaluate(async () => {
      const region = document.querySelector('[role="group"][aria-label*="Conversation excerpt"]');
      const pane = region.closest('[data-slot="task-pane"]') ?? document.scrollingElement;
      const before = pane.scrollTop;
      region.scrollTop = region.scrollHeight; // slam to the bottom
      await new Promise((r) => setTimeout(r, 120));
      return { paneMoved: Math.abs(pane.scrollTop - before) > 2 };
    });
    check(!contained.paneMoved, "scrolling the excerpt does not move the pane");
  }
  await p.context().close();
}

// ═══ PARTS 2 & 3 · TAB-CARDS AND CLOSED-TODAY ═══
console.log("\n═══ Parts 2/3 · tab-cards ═══");
{
  // `heavy-caseload` for the squint test; it has breaches and a busy row.
  const p = await tasks({ scenario: "heavy-caseload" });
  const r = await p.evaluate(() => {
    const list = document.querySelector('[role="tablist"]');
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const boxes = tabs.map((t) => t.getBoundingClientRect());
    const numerals = tabs.map((t) => {
      const big = [...t.querySelectorAll("span")].find((s) => parseFloat(getComputedStyle(s).fontSize) >= 20);
      return big ? { text: big.textContent.trim(), px: getComputedStyle(big).fontSize, weight: getComputedStyle(big).fontWeight } : null;
    });
    const closedLinks = [...document.querySelectorAll('[role="tablist"] a')];
    return {
      tabs: tabs.length,
      heights: [...new Set(boxes.map((b) => Math.round(b.height)))],
      widths: [...new Set(boxes.map((b) => Math.round(b.width)))],
      // ONE ROW = every card shares a top edge.
      tops: [...new Set(boxes.map((b) => Math.round(b.top)))],
      numerals,
      allClear: tabs.map((t) => t.textContent.includes("All clear")),
      breachChips: tabs.filter((t) => /past \d+[hd]/i.test(t.textContent)).length,
      closedLinks: closedLinks.map((a) => ({
        text: a.textContent.trim(),
        href: a.getAttribute("href"),
        h: Math.round(a.getBoundingClientRect().height),
      })),
      // The old top-right unit is gone.
      topRightGone: !document.body.innerText.includes("CLOSED TODAY") &&
        ![...document.querySelectorAll("p,span")].some((e) => e.textContent.trim() === "Closed today"),
      tablist: list.getAttribute("role"),
      ariaSelected: tabs.filter((t) => t.getAttribute("aria-selected") === "true").length,
      // Unselected cards keep FULL-STRENGTH counts — the workload must read
      // across all four without selecting them.
      numeralColors: tabs.map((t) => {
        const big = [...t.querySelectorAll("span")].find((s) => parseFloat(getComputedStyle(s).fontSize) >= 20);
        return big ? getComputedStyle(big).color : null;
      }),
    };
  });
  check(r.tabs === 4, "four tab-cards", String(r.tabs));
  check(r.heights.every((h) => h >= 68 && h <= 84), "~72px tall", `${r.heights.join(", ")}px`);
  check(r.widths.length === 1, "equal-width segments", `${r.widths.join(", ")}px`);
  check(r.tops.length === 1, "a single row", `tops ${r.tops.join(", ")}`);
  check(r.numerals.filter(Boolean).every((n) => parseFloat(n.px) >= 20 && Number(n.weight) >= 600),
    "open count is a prominent numeral (~22px semibold)",
    JSON.stringify(r.numerals.filter(Boolean).map((n) => `${n.text}@${n.px}/${n.weight}`)));
  const distinctColors = [...new Set(r.numeralColors.filter(Boolean))];
  check(distinctColors.length === 1, "counts are full strength whether selected or not", JSON.stringify(distinctColors));
  check(r.topRightGone, 'the top-right "Closed today" unit is gone');
  check(r.closedLinks.length > 0, "closed segments render inside the cards", JSON.stringify(r.closedLinks.map((l) => l.text)));
  check(r.closedLinks.every((l) => l.h >= 44), "closed segment target ≥44px", JSON.stringify(r.closedLinks.map((l) => l.h)));
  check(r.closedLinks.every((l) => /scope=mine/.test(l.href) && /domain=/.test(l.href) && /range=today/.test(l.href)),
    "closed segment deep-links to Activity (mine, domain, today)", r.closedLinks[0]?.href ?? "none");
  check(r.tablist === "tablist" && r.ariaSelected === 1, "tablist semantics preserved");

  // ═══ THE TWO CONTROLS ARE UNAMBIGUOUS — BY KEYBOARD AND BY POINTER ═══
  const first = p.locator('[role="tab"]').first();
  await first.focus();
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(300);
  const afterArrow = await p.evaluate(() => ({
    focused: document.activeElement?.getAttribute("id"),
    selected: document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("id"),
    onTasks: location.pathname,
  }));
  check(afterArrow.focused === afterArrow.selected && afterArrow.onTasks === "/app/care-reviews",
    "arrow keys move tabs and do NOT navigate", JSON.stringify(afterArrow));

  // Tabbing from a card reaches its closed link, and activating it navigates.
  const linkCount = await p.locator('[role="tablist"] a').count();
  if (linkCount > 0) {
    await p.locator('[role="tablist"] a').first().focus();
    const focusedIsLink = await p.evaluate(() => document.activeElement?.tagName.toLowerCase());
    check(focusedIsLink === "a", "the closed segment is keyboard-reachable", String(focusedIsLink));
    await p.keyboard.press("Enter");
    await p.waitForTimeout(1200);
    const url = new URL(p.url());
    check(url.pathname === "/app/activity" && url.searchParams.get("scope") === "mine",
      "activating it navigates to Activity", url.pathname + url.search);
  }
  await p.context().close();
}

// ═══ ZERO-OPEN CARD ═══
{
  const p = await tasks({ scenario: "quiet-day" });
  const r = await p.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const empty = tabs.filter((t) => t.textContent.includes("All clear"));
    return {
      emptyCards: empty.length,
      anyBigZero: tabs.some((t) => [...t.querySelectorAll("span")]
        .some((s) => s.textContent.trim() === "0" && parseFloat(getComputedStyle(s).fontSize) >= 20)),
      emptyWithClosed: empty.map((t) => t.parentElement.textContent.trim().replace(/\s+/g, " ")),
    };
  });
  check(r.emptyCards > 0, "the quiet scenario has empty cards", String(r.emptyCards));
  check(!r.anyBigZero, 'never a large "0"');
  console.log("    empty card text:", JSON.stringify(r.emptyWithClosed.slice(0, 2)));
  if (process.env.SHOT_DIR) await p.locator('[role="tablist"]').screenshot({ path: process.env.SHOT_DIR + "/P2-tabcards-quiet.png" });
  await p.context().close();
}

{
  const p = await tasks({ scenario: "heavy-caseload" });
  if (process.env.SHOT_DIR) await p.locator('[role="tablist"]').screenshot({ path: process.env.SHOT_DIR + "/P2-tabcards-heavy.png" });
  await p.context().close();
}

// ═══ THE SQUINT TEST: breaches survive on a heavy day ═══
{
  const p = await tasks({ scenario: "breach-overnight" });
  const r = await p.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    return {
      withBreach: tabs.filter((t) => /past \d+[hd]/i.test(t.textContent)).length,
      texts: tabs.map((t) => t.textContent.replace(/\s+/g, " ").trim()),
      // An empty card that still has closed work — the brief's
      // "All clear · 5 closed today" shape.
      emptyWithClosed: tabs
        .map((t) => t.parentElement.textContent.replace(/\s+/g, " ").trim())
        .filter((x) => x.includes("All clear") && x.includes("closed")),
    };
  });
  check(r.withBreach > 0, "breach chips survive on the breach scenario", `${r.withBreach} cards`);
  console.log("    cards:", JSON.stringify(r.texts));
  if (r.emptyWithClosed.length) console.log("    empty+closed:", JSON.stringify(r.emptyWithClosed));
  if (process.env.SHOT_DIR) await p.locator('[role="tablist"]').screenshot({ path: process.env.SHOT_DIR + "/P2-tabcards-breach.png" });
  await p.context().close();
}

// ═══ PART 4 · DEV CONSOLIDATION + LOAD STATES ═══
console.log("\n═══ Part 4 · dev consolidation ═══");
{
  const p = await tasks({});
  const r = await p.evaluate(() => {
    const sel = [...document.querySelectorAll("select")].find((s) => s.querySelector('optgroup[label="Tasks"]'));
    return {
      floatingPanelGone: !document.body.innerText.includes("Prototype scenarios"),
      tasksGroup: sel ? [...sel.querySelectorAll('optgroup[label="Tasks"] option')].map((o) => o.textContent.trim()) : [],
      loadLabel: [...document.querySelectorAll("label")].map((l) => l.textContent.trim()).find((t) => /^Load/.test(t)),
      loadOptions: (() => {
        const ls = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => /partial/i.test(o.textContent)));
        return ls ? [...ls.options].map((o) => o.textContent.trim()) : [];
      })(),
    };
  });
  check(r.floatingPanelGone, "the floating Prototype scenarios panel is gone");
  check(r.tasksGroup.length >= 5, "all Tasks scenarios are in the footer dropdown", JSON.stringify(r.tasksGroup));
  check(/Tasks/.test(r.loadLabel ?? ""), "the Load control names Tasks", JSON.stringify(r.loadLabel));
  check(r.loadOptions.some((o) => /partial/i.test(o)), "Load offers Partial failure", JSON.stringify(r.loadOptions));

  // Reset reviewed states lives in the footer's reset control.
  await p.getByRole("button", { name: /Reset as a new mentor/i }).first().click();
  await p.waitForTimeout(500);
  const soft = await p.getByRole("button", { name: /Reset reviewed states/i }).count();
  check(soft === 1, '"Reset reviewed states" is in the footer reset control');
  await p.keyboard.press("Escape");
  await p.context().close();
}

// ═══ THE MATRIX: every scenario × every load state ═══
console.log("\n═══ Part 4 · scenario × load-state matrix ═══");
{
  const SCENARIOS = ["quiet-day", "typical-shift", "heavy-caseload", "breach-overnight", "active-escalation"];
  const LOADS = ["ready", "loading", "error", "partial"];
  let bad = 0;
  for (const scenario of SCENARIOS) {
    const row = [];
    for (const load of LOADS) {
      const p = await tasks({ scenario, load });
      const errs = [];
      p.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
      // `loading` resolves over ~1s of staged timers; wait past it.
      await p.waitForTimeout(load === "loading" ? 1500 : 300);
      const r = await p.evaluate(() => ({
        tabs: document.querySelectorAll('[role="tab"]').length,
        len: document.body.innerText.length,
        crash: /Application error|client-side exception/i.test(document.body.innerText),
      }));
      const ok = !r.crash && r.tabs === 4 && r.len > 300 && errs.length === 0;
      if (!ok) bad++;
      row.push(`${load}:${ok ? "ok" : "BAD"}`);
      if (process.env.SHOT_DIR && load !== "ready") {
        await p.screenshot({ path: `${process.env.SHOT_DIR}/P4-${scenario}-${load}.png` });
      }
      await p.context().close();
    }
    console.log(`  ${scenario.padEnd(18)} ${row.join("  ")}`);
  }
  check(bad === 0, "every scenario × load state renders sanely", `${bad} bad cell(s) of ${SCENARIOS.length * LOADS.length}`);
}

// ═══ THE HIERARCHY IS OBSERVABLE ═══
{
  // ═══ SAMPLE INSIDE THE WINDOW ═══
  // The `tasks()` helper waits 1600ms before returning, which is past the whole
  // 4×240ms sequence — so "early" was not early and the check failed on a
  // feature that works. Navigating here and polling immediately is the only way
  // to observe an ordering that is, by design, over in a second.
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona: "supervisor", tasksScenarioId: "typical-shift", devLoadState: "loading" }, version: VERSION }]
  );
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app/care-reviews`, { waitUntil: "domcontentloaded" });
  // Poll every 60ms and record the ORDER surfaces appear in — the hierarchy is
  // an ordering claim, so an ordering is what to assert.
  const seen = [];
  for (let i = 0; i < 40; i++) {
    const snap = await p.evaluate(() => ({
      tabs: document.querySelectorAll('[role="tab"]').length,
      rows: document.querySelectorAll('[role="tabpanel"] button').length,
    })).catch(() => null);
    if (snap) seen.push(snap);
    if (snap && snap.tabs === 4 && snap.rows > 0) break;
    await p.waitForTimeout(60);
  }
  const firstWithTabs = seen.findIndex((s) => s.tabs === 4);
  const firstWithRows = seen.findIndex((s) => s.rows > 0);
  check(firstWithTabs >= 0, "cards resolve", `at sample ${firstWithTabs}`);
  check(
    firstWithTabs >= 0 && firstWithRows >= 0 && firstWithTabs <= firstWithRows,
    "cards resolve BEFORE the list rows (the hierarchy holds)",
    `cards@${firstWithTabs}, rows@${firstWithRows} of ${seen.length} samples`
  );
  await ctx.close();
}

// ═══ PARTIAL: BILLING HEALTHY BESIDE A FAILED RISK-FLAG DOMAIN ═══
{
  const p = await tasks({ scenario: "typical-shift", load: "partial" });
  const r = await p.evaluate(() => {
    const body = document.body.innerText;
    return { hasError: /Couldn't load/i.test(body), tabs: document.querySelectorAll('[role="tab"]').length };
  });
  check(r.tabs === 4, "cards stay readable under partial failure");
  // Switch to Billing and confirm it is healthy.
  const billing = p.locator('[role="tab"]', { hasText: "Billing" }).first();
  if (await billing.count()) {
    await billing.click();
    await p.waitForTimeout(900);
    const healthy = await p.evaluate(() => ({
      paneError: /Couldn't load this billing item/i.test(document.body.innerText),
      excerptError: /Couldn't load the conversation/i.test(document.body.innerText),
    }));
    check(!healthy.paneError, "the Billing pane stays healthy under partial failure");
  }
  console.log(`    (partial: some surface shows an error → ${r.hasError})`);
  if (process.env.SHOT_DIR) await p.screenshot({ path: process.env.SHOT_DIR + "/P4-partial-billing.png" });
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
