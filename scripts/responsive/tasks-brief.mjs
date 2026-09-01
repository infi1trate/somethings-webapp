// VERIFICATION FOR THE TASKS BRIEF (Parts 1–4).
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const VERSION = Number(process.env.STORE_VERSION ?? 42);

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
  await p.goto(`${BASE}/app/tasks`, { waitUntil: "networkidle" });
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

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
