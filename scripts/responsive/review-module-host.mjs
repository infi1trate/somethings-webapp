// ═══ ONE REVIEW MODULE, TWO HOSTS (review-module-02-tasks-host) ═══
//
// The Care page and the Tasks billing queue commit the same clinical decision.
// Until this they drew it two ways, and the claim being verified here is that
// they no longer do — which is a claim about TWO surfaces, so a check on either
// one alone proves nothing.
//
// THE CARE HALF IS NOT CHECKED HERE. `review-body-parity.mjs` owns it: seventeen
// DOM snapshots, byte-compared, with a same-day guard so fixture drift cannot be
// mistaken for a change. Duplicating a weaker version of that in this file would
// be a second answer to a question already answered better.
//
// Exit codes: 0 every check passed · 1 a check failed.

import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/review-module";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;
function check(id, label, ok, detail) {
  rows.push({ id, label, ok: !!ok, detail });
  if (!ok) failed += 1;
  console.log(`  ${ok ? "✓" : "×"} ${id.padEnd(26)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function open(id, url) {
  return openView(
    browser,
    { id, url, seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift" } } },
    XL,
    version
  );
}

/** Care's review lives inside a collapsible card; Tasks' pane IS the review. */
async function openCareReview(page) {
  const rev = page.getByRole("button", { name: /^Review$/ }).first();
  if (await rev.count()) {
    await rev.click();
    await page.waitForTimeout(700);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE TASKS PANE RENDERS THE MODULE, NOT THE COMPOSITION IT REPLACED.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("tasks", "/app/tasks");
  const t = await page.locator('[data-slot="task-pane"]').innerText();

  // WHAT THE MODULE BRINGS. Each of these was absent from the hand-built
  // composition, and each is evidence a supervisor uses to judge a code.
  for (const [id, needle, why] of [
    ["rationale", /Rationale/, "the labelled rationale, not a Notes block"],
    ["score-strip", /Assigned assessment/, "the score strip"],
    ["denominator", /\/\s*\d+/, "a score with its denominator"],
    ["grid", /View results/, "the answers behind the score"],
    ["change-code", /Change code/, "the module's own picker control"],
  ]) {
    check(`tasks.${id}`, why, needle.test(t));
  }

  /* ═══ THE PROVENANCE AFFORDANCES ARE ICONS, SO THEY ARE NOT IN `innerText` ═══
     The first version of this check tested the pane's text for "About this
     score" and failed against a control that was present and correct: the
     trigger is an `Info` glyph whose label is its ACCESSIBLE NAME. A check that
     reads rendered text cannot see an icon button, and the fix is to ask for it
     the way a screen reader would.
     TWO OF THEM, and they say different things — one explains the generated
     rationale, one explains the score — which is the distinction the old
     composition had neither half of. */
  const provenance = await page
    .locator('[data-slot="task-pane"] [aria-label]')
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")).filter((l) => /^About this/.test(l ?? ""))
    );
  check(
    "tasks.provenance",
    "both provenance affordances, and they explain different things",
    provenance.length >= 2 && new Set(provenance).size >= 2,
    provenance.join(" | ") || "none"
  );

  // WHAT THE COMPOSITION USED TO SAY, and must not any more — two vocabularies
  // for one thing on one screen is the defect this closes.
  check("tasks.no-notes-label", "the rationale is not called Notes", !/\bNotes\b/.test(t));
  check(
    "tasks.no-assigned-survey",
    "the old metadata cell is gone",
    !/Assigned survey/.test(t),
    /Assigned survey/.test(t) ? "still present" : undefined
  );

  // ═══ WHAT THE HOST STILL OWES ═══
  // The module never displays the code ON RECORD — fine on Care, where the page
  // states it, and a regression here where nothing else would. The host supplies
  // it, with the mentorship stats, in a context strip.
  check("tasks.on-record", "the host states the code on record", /On record/.test(t));
  check("tasks.mentorship", "and the mentorship context", /Mentorship/.test(t) && /days/.test(t));
  await page.locator('[data-slot="task-pane"]').screenshot({ path: `${OUT}/tasks-pane.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE SAME SECTIONS, IN THE SAME ORDER, ON BOTH SURFACES.
// ═══════════════════════════════════════════════════════════════════════════
//
// Section ORDER rather than pixels: the two hosts frame the module differently
// by design (a card on one, a pane on the other) and a pixel comparison would
// fail on the frame while missing a reordering inside it.
{
  const order = async (page, scope) =>
    page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const text = root.innerText;
      const marks = [
        ["recommendation", "Recommended presentation"],
        ["rationale", "Rationale"],
        ["evidence", "Assigned assessment"],
      ];
      return marks
        .map(([id, needle]) => [id, text.indexOf(needle)])
        .filter(([, i]) => i >= 0)
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id);
    }, scope);

  const a = await open("order-tasks", "/app/tasks");
  const tasksOrder = await order(a.page, '[data-slot="task-pane"]');
  await a.context.close();

  const b = await open("order-care", "/admin/person/t19?tab=care");
  await openCareReview(b.page);
  const careOrder = await order(b.page, "main");
  await b.context.close();

  check(
    "order.match",
    "the module's sections read in the same order on both",
    tasksOrder.length === 3 && tasksOrder.join(">") === careOrder.join(">"),
    `tasks ${tasksOrder.join(" > ")} | care ${careOrder.join(" > ")}`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE PICKER BEHAVES THE SAME WAY ON BOTH HOSTS.
// ═══════════════════════════════════════════════════════════════════════════
//
// It moved INTO the module, so the focus return, the revert affordance and the
// "picking the code on record is not a change" rule now have one implementation.
// This is the check that the second host actually gets them.
//
// REAL CLICKS, and that matters: driving this through the in-app browser pane
// with programmatic `.click()` reported focus landing on `<body>` on Tasks and on
// the button on Care, which looked exactly like a host-specific defect and was an
// artifact of a pane that does not hold OS focus. A synthetic click is not an
// input event.
for (const [label, url, prep] of [
  ["tasks", "/app/tasks", null],
  ["care", "/admin/person/t19?tab=care", openCareReview],
]) {
  const { context, page } = await open(`picker-${label}`, url);
  if (prep) await prep(page);
  const btn = page.getByRole("button", { name: /^Change code$/ }).first();
  check(`picker.${label}.control`, "the module's picker control is present", await btn.count());
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(500);
    const onRecord = await page.getByRole("dialog").getByText(/On record/).count();
    check(`picker.${label}.on-record`, "the code on record is marked in the list", onRecord > 0);

    await page.getByRole("dialog").getByText(/F43\.22/).first().click();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => ({
      focused: (document.activeElement?.innerText || "").replace(/\s+/g, " ").trim(),
      open: !!document.querySelector('[role="dialog"][data-state="open"]'),
      revert: /Revert back to/.test(document.body.innerText),
      shows: /F43\.22/.test(document.body.innerText),
    }));
    check(`picker.${label}.closes`, "picking closes the dialog", !after.open);
    check(`picker.${label}.focus`, "and hands the keyboard back to the control", after.focused === "Change code", after.focused);
    check(`picker.${label}.moves`, "the recommendation moves with the decision", after.shows);
    check(`picker.${label}.revert`, "and offers the way back out", after.revert);
  }
  await context.close();
}

await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
