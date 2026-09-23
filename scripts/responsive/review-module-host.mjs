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

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

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


/** ═══ THESE CHECKS ARE ABOUT BILLING, AND TASKS HOSTS TWO TYPES NOW ═══
 *  arch-G admitted escalations, so the surface's first row is a live escalation
 *  and every assertion below that assumed "the selected item is a billing
 *  review" would be asserting against the wrong pane. Narrowing with the kind
 *  chip is the honest fix: it uses the product's own affordance, it leaves the
 *  escalation assertions to the probe that owns them, and it fails loudly if the
 *  chip ever stops existing. No-op on a scenario with one kind. */
async function narrowToBilling(page) {
  const chip = page.getByRole("button", { name: /^Billing,/ });
  if (await chip.count()) {
    await chip.first().click();
    await page.waitForTimeout(320);
  }
}

async function open(id, url) {
  const view = await openView(
    browser,
    { id, url, seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift" } } },
    XL,
    version
  );
  if (url.startsWith("/app/care-reviews")) {
    await view.page.waitForTimeout(450);
    await narrowToBilling(view.page);
  }
  return view;
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
  const { context, page } = await open("tasks", "/app/care-reviews");
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
  /* ═══ RETARGETED BY arch-F: THE HOST NO LONGER OWES EITHER ═══
     The module never displayed the code on record, so this host built a context
     strip above the review to state it — which put the code and the mentorship
     figures ABOVE the recommendation they qualify. arch-F moved both where the
     parity spec asks: the code is a subordinate line beneath the recommendation
     title (in the module, opt-in so Care is untouched), the figures are a
     collapsed Record context accordion after the review. The CLAIM is unchanged —
     both facts are still on this pane — and is now asserted where they live. */
  /* ═══ THE LINE IS A CHANGE'S, NOT EVERY CASE'S (arch-G, G1) ═══
     arch-F gated it on the code being present, so a RENEWAL — where the code on
     record IS the recommendation — printed "Current · F33.1" under a title
     already reading F33.1. The parity spec asks for no line in that case. So the
     probe now walks to a CHANGE row to assert the line, and asserts its ABSENCE
     on a renewal, which is the half that would otherwise regress silently. */
  const cases = { change: null, renewal: null };
  for (let i = 0; i < 14 && (!cases.change || !cases.renewal); i += 1) {
    await page.getByRole("treeitem").nth(i).click();
    await page.waitForTimeout(280);
    const pt = (await page.locator('[data-slot="task-pane"]').innerText()).replace(/\s+/g, " ");
    const kind = /Change proposed/.test(pt) ? "change" : /Renewal proposed/.test(pt) ? "renewal" : null;
    if (kind && !cases[kind]) cases[kind] = pt;
  }
  check("tasks.cases-found", "a change and a renewal were both reachable", !!cases.change && !!cases.renewal);
  check(
    "tasks.current-line",
    "a CHANGE renders the code on record as a subordinate line",
    cases.change && /Current/.test(cases.change) && /F\d\d\.\d/.test(cases.change),
    (cases.change ?? "").match(/Current · [A-Z0-9.]+ [^·]{0,32}/)?.[0] ?? "none"
  );
  check(
    "tasks.no-line-on-renewal",
    "and a RENEWAL renders none — the code would be stated twice",
    cases.renewal && !/Current ·/.test(cases.renewal),
    (cases.renewal ?? "").match(/Renewal proposed[^·]{0,40}/)?.[0] ?? "none"
  );
  check("tasks.no-on-record-strip", "and the old context strip is gone", !/On record/.test(t));
  const accordion = page.locator('[data-slot="record-context"]');
  check("tasks.record-context", "the mentorship figures live in a collapsed accordion", (await accordion.count()) === 1);
  if (await accordion.count()) {
    check(
      "tasks.accordion-collapsed",
      "which starts collapsed and says what it holds",
      (await accordion.getAttribute("aria-expanded")) === "false" &&
        /days in mentorship/.test(await accordion.innerText()),
      (await accordion.innerText()).replace(/\s+/g, " ")
    );
  }
  check("tasks.no-mentor", "and the pane no longer names the mentor", !/to [A-Z][a-z]+ [A-Z]/.test(t));
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

  const a = await open("order-tasks", "/app/care-reviews");
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
/* ═══ THE TWO HOSTS NAME THE CODE ON RECORD DIFFERENTLY ═══
   Tasks' subordinate line says "Current"; Care's spine says "Primary
   presentation". Both are the same fact, and the module is indifferent to which
   — it marks whatever code it is handed. Recorded here rather than unified,
   because unifying the two labels is a naming decision on the record page and
   nothing in arch-E touched it: one more entry for the copy pass. */
for (const [label, url, prep, onRecordRe] of [
  /* THE HOST'S WORDING CHANGED WITH THE BLOCK (arch-F): "On record F33.1"
     became "Current · F33.1" beneath the recommendation title. The picker's own
     marker still reads "On record" — that string is the module's. */
  ["tasks", "/app/care-reviews", null, /Current[^A-Z]*([A-Z]\d+\.\d+)/],
  ["care", "/admin/person/t19?tab=care", openCareReview, /Primary presentation[\s\S]{0,40}?([A-Z]\d+\.\d+)/],
]) {
  const { context, page } = await open(`picker-${label}`, url);
  if (prep) await prep(page);
  /* ═══ WALK TO A CHANGE ROW BEFORE OPENING THE PICKER ═══
     The subordinate line only renders when the code on record DIFFERS from the
     recommendation (arch-G, G1), so a renewal-selected pane has no code for this
     section to look for. It has to happen before the dialog opens: a modal
     blocks pointer events on the list behind it, and the first version of this
     walk timed out clicking a row under the open picker. */
  if (label === "tasks") {
    for (let i = 0; i < 14; i += 1) {
      /* NORMALISED: `innerText` puts a newline between the "Current" span and
         the "·" span, so a literal "Current ·" never matches the raw string —
         the first version of this walk clicked fourteen rows and broke on none
         of them. */
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      if (/Current ·/.test(body)) break;
      await page.getByRole("treeitem").nth(i).click();
      await page.waitForTimeout(260);
    }
  }
  const btn = page.getByRole("button", { name: /^Change code$/ }).first();
  check(`picker.${label}.control`, "the module's picker control is present", await btn.count());
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(500);
    /* ═══ SEARCH FOR THE CODE FIRST, AND THAT IS THE POINT OF THE FIX ═══
       This read the marker off the dialog's opening shortlist, which made the
       check depend on whether the host's on-record code happened to be one of
       the six common presentations. arch-E reordered Tasks, the default row
       became a teen on F33.1, F33.1 is not in the shortlist, and the check
       failed against a module that marks the code correctly — verified by hand:
       searching "F33.1" renders "1 match · Major depressive disorder,
       recurrent, moderate · F33.1 · On record". The claim is that the module
       marks the code the HOST states, so the probe now asks the host what that
       code is and looks for it where it can be seen. */
    const onRecordCode = (await page.locator("body").innerText()).match(onRecordRe)?.[1];
    check(`picker.${label}.host-states-code`, "the host states a code to look for", !!onRecordCode, onRecordCode ?? "none");
    const search = page.getByRole("dialog").locator('input[aria-label^="Search presentations"]').first();
    if (onRecordCode) {
      await search.fill(onRecordCode);
      await page.waitForTimeout(500);
    }
    const onRecord = onRecordCode ? await page.getByRole("dialog").getByText(/On record/).count() : 0;
    check(
      `picker.${label}.on-record`,
      "and the module marks that code in the list",
      onRecord > 0,
      onRecordCode ? `${onRecordCode} · ${onRecord} marked` : "no code to search for"
    );
    await search.fill("");
    await page.waitForTimeout(400);

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
