// ═══ ESCALATIONS AS TASKS — THE PANE, THE TIMELINE, THE ADVANCE RULE ═══
//
// arch-G, G4 + G5. What this probe exists to catch, in the order it caused
// trouble while being built:
//
//   1 A DUPLICATED WAY OUT. The pane header rendered "View care profile"
//     unconditionally and `EscalationCtas` rendered it again — two identical
//     links side by side, which no type checker can see and no unit test can
//     reach. Found by reading the rendered page, which is why this probe counts
//     the cluster rather than trusting the component.
//   2 THE ADVANCE EXCEPTION. Every other task type loads the next one on
//     resolve; an escalation RESPONSE must not. That is a behaviour of the page,
//     not of a function, so nothing below the browser can assert it.
//   3 AN ABSENCE READING AS A FACT. The timeline's entries all carry a source
//     and a time; an entry that lost its attribution would still look like a
//     timeline. So the assertion is per-entry, and it fails when the INPUT is
//     missing rather than passing on an empty list.
//
// THE CONTEXT IS THE HARNESS'S OWN localStorage, so this cannot touch the demo
// store in anybody's browser — and it is allowed to DRIVE resolves for the same
// reason `tasks-a2-states` is.
//
// Exit codes: 0 every check passed · 1 a check failed.

import { launch, openView, VIEWPORTS, readStoreVersion } from "./harness.mjs";

const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 900 };
const version = await readStoreVersion();
const browser = await launch();

let failed = 0;
function check(id, label, ok, detail) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "✓" : "×"} ${id.padEnd(28)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function open(id, { scenario = "typical-shift" } = {}) {
  const { context, page } = await openView(
    browser,
    {
      id,
      url: "/app/tasks",
      seed: { persona: "supervisor", extra: { tasksScenarioId: scenario } },
    },
    XL,
    version
  );
  await page.waitForTimeout(450);
  return { context, page };
}

/** The pane, as a block of facts. Read in ONE evaluate so every assertion below
 *  describes the same paint. */
async function readPane(page) {
  return page.evaluate(() => {
    const pane = document.querySelector("[data-fade-phase]")?.closest("section, div[class*=flex-col]");
    const scope = pane ?? document;
    const text = (el) => (el?.innerText ?? "").replace(/\s+/g, " ").trim();
    const ctas = [...document.querySelectorAll("a[href]")]
      .filter((a) => /View care profile|View conversation|View escalation record/.test(a.innerText))
      .map((a) => `${a.innerText.trim()} → ${a.getAttribute("href")}`);
    const entries = [...document.querySelectorAll("[data-timeline-entry]")].map((e) => ({
      source: e.getAttribute("data-source"),
      // The visible attribution and time, as a reader sees them.
      label: text(e.querySelector("[data-timeline-label]")),
      time: text(e.querySelector("[data-timeline-time]")),
      body: text(e.querySelector("[data-timeline-text]")),
      manual: e.getAttribute("data-timeline-manual") === "true",
    }));
    const tabs = [...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => ({
      name: t.innerText.trim(),
      selected: t.getAttribute("aria-selected") === "true",
    }));
    const dispositions = [...document.querySelectorAll("[data-response-disposition]")].map((b) => ({
      id: b.getAttribute("data-response-disposition"),
      checked: b.getAttribute("aria-checked") === "true",
    }));
    const status = [...document.querySelectorAll('[role="status"]')].map((s) => text(s));
    return {
      header: text(document.querySelector("h2, h3")),
      paneText: text(scope),
      ctas,
      entries,
      tabs,
      dispositions,
      status,
      hasNoteModule: !!document.querySelector('[data-slot="escalation-note"]'),
      // WHERE THE MODULE'S ACTION ROW ENDED UP. The portal target is the pane's
      // sticky bar; inline is the module's own fallback.
      actionRowInBar: (() => {
        const row = document.querySelector("[data-note-action-row]");
        if (!row) return null;
        return !!row.closest('[data-slot="task-pane-footer"]');
      })(),
    };
  });
}

/** Select a row by the text it shows. Returns false when no such row exists, so
 *  a caller can fail loudly instead of asserting against the wrong pane. */
async function selectRow(page, re) {
  const row = page.getByRole("treeitem").filter({ hasText: re });
  if (!(await row.count())) return false;
  await row.first().click();
  await page.waitForTimeout(400);
  return true;
}

console.log("\nTasks — escalations (arch-G, G4 + G5)\n");

// ── 1. THE RESPONSE PANE ────────────────────────────────────────────────────
{
  const { context, page } = await open("g-response");
  const ok = await selectRow(page, /Active escalation/);
  check("response.row", "a live escalation is in the list", ok);
  const pane = await readPane(page);

  check(
    "response.cta-set",
    "three ways out, each once",
    pane.ctas.length === 3 && new Set(pane.ctas.map((c) => c.split(" → ")[0])).size === 3,
    pane.ctas.join(" | ")
  );
  check(
    "response.no-note-module",
    "the note module is NOT on the response pane",
    pane.hasNoteModule === false
  );
  check(
    "response.three-values",
    "three dispositions, none pre-selected",
    pane.dispositions.length === 3 && pane.dispositions.every((d) => !d.checked),
    pane.dispositions.map((d) => d.id).join(", ")
  );

  // ── the timeline
  check(
    "timeline.entries",
    "the timeline has entries to assert about",
    pane.entries.length >= 4,
    `${pane.entries.length} entries`
  );
  check(
    "timeline.attribution",
    "every entry states a source and a time",
    pane.entries.length > 0 &&
      pane.entries.every((e) => e.label.length > 0 && /\d/.test(e.time)),
    pane.entries.filter((e) => !e.label || !/\d/.test(e.time)).length + " unattributed"
  );
  check(
    "timeline.911-caveat",
    "the dispatch entry says where its time came from",
    pane.entries.some((e) => /no status history exists/.test(e.body)),
    pane.entries.find((e) => e.source === "dispatch")?.body ?? "no dispatch entry"
  );
  check(
    "timeline.verbatim",
    "support messages are quoted, not paraphrased",
    pane.entries.filter((e) => e.source === "supportThread").every((e) => /^[“"]/.test(e.body)),
    pane.entries.filter((e) => e.source === "supportThread").length + " messages"
  );
  check(
    "timeline.out-of-band",
    "the standing caveat about phone calls is present",
    /out-of-band actions appear only when logged/.test(pane.paneText)
  );
  check(
    "timeline.tablist",
    "the source toggle is a real tablist with one selected",
    pane.tabs.length === 2 && pane.tabs.filter((t) => t.selected).length === 1,
    pane.tabs.map((t) => `${t.name}${t.selected ? "*" : ""}`).join(" / ")
  );

  // ── the source toggle actually changes the entries
  const before = pane.entries.map((e) => e.body).join("|");
  await page.getByRole("tab", { name: /Teen conversation/i }).click();
  await page.waitForTimeout(300);
  const afterToggle = await readPane(page);
  check(
    "timeline.toggle",
    "switching source changes what is shown",
    afterToggle.entries.map((e) => e.body).join("|") !== before &&
      afterToggle.entries.length > 0,
    `${pane.entries.length} → ${afterToggle.entries.length} entries`
  );
  check(
    "timeline.toggle-keeps-system",
    "the system entries survive the switch",
    afterToggle.entries.some((e) => /Escalation opened/.test(e.body))
  );

  // ── a hand-logged action
  await page.getByRole("button", { name: /Log an action/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole("textbox", { name: /What happened/i }).fill("Called the mentor back");
  await page.getByRole("button", { name: /^Log it$/i }).click();
  await page.waitForTimeout(300);
  const afterLog = await readPane(page);
  const logged = afterLog.entries.find((e) => /Called the mentor back/.test(e.body));
  check("timeline.manual", "a logged action lands in the timeline", !!logged);
  check(
    "timeline.manual-attributed",
    "and it names its author and type",
    !!logged && /You/.test(logged.label),
    logged?.label
  );
  check(
    "timeline.manual-distinct",
    "and it is marked as hand-logged, not system",
    !!logged && logged.manual === true
  );

  await context.close();
}

// ── 2. THE ADVANCE RULE ─────────────────────────────────────────────────────
{
  const { context, page } = await open("g-advance");
  await selectRow(page, /Active escalation/);

  // 2a. A refused submit says so, and resolves nothing.
  await page.getByRole("button", { name: /^Record response$/ }).click();
  await page.waitForTimeout(250);
  const refused = await readPane(page);
  check(
    "response.blocked-states",
    "pressing with no disposition explains itself",
    refused.status.some((s) => /Record what you did first/.test(s)),
    refused.status.filter(Boolean).join(" | ")
  );
  check(
    "response.blocked-no-resolve",
    "and nothing was recorded",
    /What did you do\?/.test(refused.paneText) &&
      !/Response recorded/.test(refused.paneText)
  );

  // 2b. Choosing one clears the sentence.
  await page.locator('[data-response-disposition="guidingMentor"]').click();
  await page.waitForTimeout(200);
  const chosen = await readPane(page);
  check(
    "response.blocked-clears",
    "choosing a disposition clears the refusal",
    !chosen.status.some((s) => /Record what you did first/.test(s))
  );

  // 2c. THE EXCEPTION. Recording must not load another item.
  const teenBefore = await page.evaluate(
    () => document.querySelector("[data-pane-teen]")?.textContent?.trim() ?? null
  );
  await page.getByRole("button", { name: /^Record response$/ }).click();
  await page.waitForTimeout(600);
  const after = await readPane(page);
  const teenAfter = await page.evaluate(
    () => document.querySelector("[data-pane-teen]")?.textContent?.trim() ?? null
  );
  check(
    "advance.teen-named",
    "the pane names whose record it is (the input to the next check)",
    !!teenBefore,
    teenBefore ?? "no [data-pane-teen]"
  );
  check(
    "advance.response-holds",
    "an escalation response does NOT auto-advance",
    !!teenBefore && teenAfter === teenBefore,
    `${teenBefore} → ${teenAfter}`
  );
  check(
    "advance.says-so",
    "and it says nothing else was loaded",
    after.status.some((s) => /Nothing else was loaded/.test(s)) ||
      /Nothing else was loaded/.test(after.paneText)
  );

  await context.close();
}

// ── 3. BILLING STILL ADVANCES — the exception is one type, not a rule change ─
{
  const { context, page } = await open("g-billing-advance");
  const chip = page.getByRole("button", { name: /^Billing,/ });
  if (await chip.count()) {
    await chip.first().click();
    await page.waitForTimeout(320);
  }
  const rows = page.getByRole("treeitem");
  await rows.first().click();
  await page.waitForTimeout(350);
  const teenBefore = await page.evaluate(
    () => document.querySelector("[data-pane-teen]")?.textContent?.trim() ?? null
  );
  // The gate is three answers; this probe does not need to pass it — it needs to
  // know whether the SELECTION moves, and the keyboard's next-row move is not
  // the same thing. So it drives the review the way `tasks-a2-states` does.
  const combo = page.getByRole("combobox", { name: /Assessment of symptoms/i }).first();
  if (await combo.count()) {
    await combo.click();
    await page.waitForTimeout(200);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(150);
    const boxes = page.getByRole("textbox");
    const n = await boxes.count();
    for (let i = 0; i < n; i += 1) await boxes.nth(i).fill("Documented for the probe.");
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: /^Submit/ }).first().click();
    await page.waitForTimeout(700);
  }
  const teenAfter = await page.evaluate(
    () => document.querySelector("[data-pane-teen]")?.textContent?.trim() ?? null
  );
  check(
    "advance.billing-moves",
    "a billing review still auto-advances",
    !!teenBefore && !!teenAfter && teenAfter !== teenBefore,
    `${teenBefore} → ${teenAfter}`
  );
  await context.close();
}

// ── 4. THE DOCUMENTATION PANE ───────────────────────────────────────────────
{
  const { context, page } = await open("g-documentation");
  const ok = await selectRow(page, /Escalation note/);
  check("docs.row", "a documentation task is in the list", ok);
  const pane = await readPane(page);
  check("docs.module", "the note module is hosted on the pane", pane.hasNoteModule === true);
  check(
    "docs.action-row-in-bar",
    "and its action row is in the pane's sticky bar, not inline",
    pane.actionRowInBar === true,
    pane.actionRowInBar === null ? "no action row found" : String(pane.actionRowInBar)
  );
  check(
    "docs.no-dispositions",
    "the response's three values are NOT on the documentation pane",
    pane.dispositions.length === 0
  );
  check(
    "docs.911-stated",
    "the 911 gap is stated rather than left as an absence",
    /On the escalation record/.test(pane.paneText) &&
      /does not carry it/.test(pane.paneText)
  );
  check(
    "docs.completeness",
    "the action row counts recorded fields rather than validating",
    /of \d+ fields recorded/.test(pane.paneText),
    (pane.paneText.match(/\d+ of \d+ fields recorded/) ?? ["not found"])[0]
  );
  await context.close();
}

await browser.close();
console.log(`\n${failed === 0 ? "all checks passed" : `${failed} check(s) failed`}\n`);
process.exit(failed === 0 ? 0 : 1);
