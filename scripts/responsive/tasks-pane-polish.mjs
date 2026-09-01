// THE PANE, PARTS 4 AND 5 — measured.
//
// These are presentation changes, which is exactly the category that gets
// "verified" by looking at one screenshot of one item. So the probes drive the
// three states that differ (a re-review with a changed code, an intake with no
// current code, a flag) and assert the things a screenshot of the happy case
// would not have shown.
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

async function tasks(scenario, width = 1440, height = 900) {
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

const tab = async (p, name) => {
  await p.locator('[role="tab"]', { hasText: name }).first().click().catch(() => {});
  await p.waitForTimeout(500);
};

/** Walk rows until the pane's footer text matches a predicate. */
async function openMatching(p, wanted) {
  const rows = p.locator('[role="treeitem"]');
  const n = Math.min(await rows.count(), 12);
  for (let i = 0; i < n; i++) {
    await rows.nth(i).click().catch(() => {});
    await p.waitForTimeout(320);
    const text = await p.evaluate(
      `document.querySelector('[data-slot="task-pane"]')?.innerText ?? ""`
    );
    if (wanted(text)) return true;
  }
  return false;
}

// ═══ 1 · Billing: the change diff ═════════════════════════════════════════
console.log("\n── billing change diff @ typical-shift");
{
  const p = await tasks("typical-shift");
  await tab(p, "Billing");

  const found = await openMatching(p, (t) => t.includes("Current"));
  check(found, "found a re-review with a current code");

  const diff = await p.evaluate(`(() => {
    const pane = document.querySelector('[data-slot="task-pane"]');
    const text = pane.innerText;
    /* ═══ FIND THE GRID, NOT "A DIV CONTAINING BOTH WORDS" ═══
       The first draft matched any div holding both labels with <= 4 children,
       and the outermost wrapper qualifies — so it measured ONE child's left edge
       and reported "1 distinct left edges" while the columns were sitting there
       correctly. Ask the layout what it is instead. */
    const box = [...pane.querySelectorAll("div")].find((d) => {
      const cs = getComputedStyle(d);
      return (
        cs.display === "grid" &&
        cs.gridTemplateColumns.split(" ").length === 3 &&
        (d.innerText || "").includes("Recommended")
      );
    });
    const rect = box?.getBoundingClientRect();
    const kids = box ? [...box.children].map((c) => Math.round(c.getBoundingClientRect().left)) : [];
    // Anything carrying a band tint is a "changed" element.
    const tinted = [...pane.querySelectorAll("*")].filter((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      return bg && bg !== "rgba(0, 0, 0, 0)" && el.className.includes?.("band-");
    }).map((el) => el.textContent.trim());
    /* THE PRIMARY, not the first "Confirm". A re-review's footer carries BOTH
       "Confirm unchanged" and "Confirm F33.1", and the first draft matched the
       tonal one — reporting a failure against a button that was correct. */
    const confirm = [...pane.querySelectorAll("button")]
      .map((x) => x.textContent.trim())
      .find((t) => /^Confirm [A-Z][0-9]/.test(t));
    return {
      hasArrow: !!box?.querySelector("svg"),
      columns: new Set(kids).size,
      sameRow: box ? [...box.children].every((c) =>
        Math.abs(c.getBoundingClientRect().top - box.children[0].getBoundingClientRect().top) < 40
      ) : false,
      tinted,
      confirm,
      summaryIndex: text.indexOf("AI summary"),
      currentIndex: text.indexOf("Current"),
      hasAiHeader: !!pane.innerText.match(/^AI SUMMARY$/m),
      width: rect ? Math.round(rect.width) : 0,
    };
  })()`);

  check(diff.columns >= 3, "the change is one container of columns", `${diff.columns} distinct left edges`);
  check(diff.hasArrow, "with an arrow joining them");
  check(diff.sameRow, "side by side, not stacked, at 1440");
  check(diff.tinted.length > 0, "the changed elements are soft-tinted", diff.tinted.join(" | "));
  check(
    /^Confirm [A-Z]\d/.test(diff.confirm ?? ""),
    "the footer's primary names the code",
    String(diff.confirm)
  );
  check(
    diff.summaryIndex >= 0 && diff.summaryIndex < diff.currentIndex,
    "the AI summary sits above the change",
    `summary@${diff.summaryIndex} change@${diff.currentIndex}`
  );
  check(!diff.hasAiHeader, "and is a badge, not an AI SUMMARY header");

  // The score lozenge — same two-cell shape the record's History uses.
  const loz = await p.evaluate(`(() => {
    const pane = document.querySelector('[data-slot="task-pane"]');
    const el = [...pane.querySelectorAll("span")].find(
      (s) => s.children.length === 2 && getComputedStyle(s).borderRadius.startsWith("4px")
    );
    if (!el) return null;
    return { text: el.innerText.split(String.fromCharCode(10)).join(" "), radius: getComputedStyle(el).borderRadius };
  })()`);
  check(!!loz, "the survey shows the square score lozenge", loz ? loz.text : "absent");

  // An INTAKE has nothing to diff.
  await tab(p, "Billing");
  const intake = await openMatching(p, (t) => t.includes("First assignment"));
  check(intake, "an intake reads 'First assignment' instead");
  const noArrow = await p.evaluate(`(() => {
    const t = document.querySelector('[data-slot="task-pane"]').innerText;
    return { hasCurrent: t.includes("Current"), hasFirst: t.includes("First assignment") };
  })()`);
  check(!noArrow.hasCurrent && noArrow.hasFirst, "and shows no empty 'Current' column");

  await p.context().close();
}

// ═══ 2 · The flag pane's labels ═══════════════════════════════════════════
console.log("\n── flag pane labels @ typical-shift");
{
  const p = await tasks("typical-shift");
  await tab(p, "Risk flags");
  await p.locator('[role="treeitem"]').first().click();
  await p.waitForTimeout(500);

  const pane = await p.evaluate(`(() => {
    const el = document.querySelector('[data-slot="task-pane"]');
    const labels = [...el.querySelectorAll("p")]
      .filter((n) => getComputedStyle(n).textTransform === "uppercase")
      .map((n) => n.textContent.trim());
    const sub = el.querySelector("h2")?.parentElement?.nextElementSibling?.innerText ?? "";
    return {
      text: el.innerText,
      uppercaseLabels: labels,
      subtitle: sub.split(String.fromCharCode(10)).join(" "),
    };
  })()`);

  check(!/\bType\b[\s\S]{0,12}Message/.test(pane.text), "no TYPE / Message row");
  check(
    pane.uppercaseLabels.length === 0,
    "no all-caps section labels remain",
    pane.uppercaseLabels.join(" | ")
  );
  check(
    !pane.subtitle.includes("Risk flags"),
    "the subtitle no longer repeats the tab name",
    pane.subtitle
  );
  check(pane.subtitle.includes("to "), "and still names the mentor", pane.subtitle);

  // ── The excerpt: clustering, edge marker, caption ──────────────────────
  const ex = await p.evaluate(`(() => {
    const region = document.querySelector('[role="group"][aria-label*="onversation"]');
    if (!region) return null;
    const items = [...region.querySelectorAll("li")];
    const withHeader = items.filter((li) => li.querySelector("time")).length;
    const marker = [...region.querySelectorAll("p")].find((n) =>
      (n.textContent || "").includes("Earlier messages")
    );
    const rules = marker ? marker.querySelectorAll("span[aria-hidden]").length : 0;
    const caption = [...document.querySelectorAll("p")].find((n) =>
      (n.textContent || "").includes("on the left"));
    return {
      messages: items.length,
      withHeader,
      hasMarker: !!marker,
      markerRules: rules,
      hasCaption: !!caption,
      captionLines: caption ? Math.round(caption.getBoundingClientRect().height / 16) : 0,
    };
  })()`);

  check(!!ex, "the excerpt rendered");
  check(
    ex.withHeader < ex.messages,
    "timestamps cluster — not every bubble carries a header",
    `${ex.withHeader} of ${ex.messages}`
  );
  check(ex.withHeader > 0, "but some do");
  check(ex.hasMarker && ex.markerRules === 2, "the edge marker is centred on a rule", `${ex.markerRules} rules`);
  check(ex.hasCaption && ex.captionLines === 1, "the role caption is one line", `${ex.captionLines} lines`);

  // It dismisses, and stays dismissed.
  await p.locator("button", { hasText: "Hide" }).first().click();
  await p.waitForTimeout(300);
  const gone = await p.evaluate(
    `![...document.querySelectorAll("p")].some((n) => (n.textContent||"").includes("on the left"))`
  );
  check(gone, "and dismisses");

  await p.context().close();
}

// ═══ 3 · The closed-count pulse and the pane crossfade ════════════════════
console.log("\n── resolve feedback @ typical-shift");
{
  const p = await tasks("typical-shift");
  await tab(p, "Risk flags");
  await p.locator('[role="treeitem"]').first().click();
  await p.waitForTimeout(500);

  const before = await p.evaluate(
    `document.querySelector('[data-slot="task-pane"] h2')?.textContent ?? ""`
  );
  // Watch the body's opacity across the advance.
  const sampled = await p.evaluate(`(async () => {
    const pane = document.querySelector('[data-slot="task-pane"]');
    /* THE PANE'S OWN BODY, which is its SECOND child — the header is first and
       the excerpt inside the body also matches an overflow selector. Named by
       structure so the probe cannot silently sample the wrong box. */
    const body = pane.children[1];
    const seen = [];
    const stop = performance.now() + 400;
    /* ═══ SAMPLE THE PHASE, NOT ONLY THE COMPUTED OPACITY ═══
       A computed opacity of 1 during a transition is ambiguous: it means either
       "nothing is fading" or "the fade has not ticked yet", and the first draft
       of this probe could not tell those apart — it reported 1.00 across 44
       frames against a class list that correctly said opacity-0. The phase
       attribute is unambiguous, so the check asserts the mechanism ran AND
       reports whatever intermediate opacity it caught. */
    const phases = [];
    const tick = () => {
      const live = document.querySelector('[data-slot="task-pane"]').children[1];
      seen.push(Number(getComputedStyle(live).opacity));
      phases.push(live.getAttribute("data-fade-phase"));
      if (performance.now() < stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.querySelectorAll('[data-slot="task-pane-footer"] button').forEach((b) => {
      if (b.textContent.trim() === "Yes") b.click();
    });
    await new Promise((r) => setTimeout(r, 460));
    return {
      min: Math.min(...seen),
      max: Math.max(...seen),
      frames: seen.length,
      phases: [...new Set(phases)].join(" → "),
      sawSnap: phases.includes("snap"),
      endedIn: phases[phases.length - 1],
    };
  })()`);
  const after = await p.evaluate(
    `document.querySelector('[data-slot="task-pane"] h2')?.textContent ?? ""`
  );
  check(after !== before, "resolving advanced the pane", `${before} → ${after}`);
  check(
    sampled.sawSnap,
    "the pane body snapped to zero before the new content painted",
    `phases ${sampled.phases}`
  );
  check(
    sampled.endedIn === "in" && sampled.max > 0.95,
    "and faded back in",
    `opacity reached ${sampled.max.toFixed(2)} over ${sampled.frames} frames`
  );
  check(
    sampled.min < 0.95,
    "with intermediate frames — a transition, not a swap",
    `lowest sampled opacity ${sampled.min.toFixed(2)}`
  );

  const pulse = await p.evaluate(`(() => {
    /* THE OVERLAY, not the reserved-space span. The tab-card also holds an
       aria-hidden transparent copy of "· 2 closed" to reserve the link's
       footprint inside the button, and it comes FIRST in document order — so the
       first draft measured a span with no transition and reported "all 0s"
       against a pulse that was working. The overlay is the absolutely-positioned
       one. */
    const overlay = [...document.querySelectorAll("span[aria-hidden]")].find(
      (s) =>
        (s.textContent || "").includes("closed") &&
        getComputedStyle(s).position === "absolute"
    );
    return overlay
      ? { dur: getComputedStyle(overlay).transitionDuration, prop: getComputedStyle(overlay).transitionProperty }
      : null;
  })()`);
  check(!!pulse, "the closed count has a pulse overlay", pulse ? `${pulse.prop} ${pulse.dur}` : "absent");

  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
