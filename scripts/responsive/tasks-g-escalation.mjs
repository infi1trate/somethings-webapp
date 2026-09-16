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

import AxeBuilder from "@axe-core/playwright";
import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";

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

  /* ═══ THE REFUSAL HAS TO LEAVE A ROUTE TO YES ═══
     The primary is in the sticky bar and the question can be scrolled out of
     sight, so a sentence alone tells a keyboard reader "no" and nothing else.
     Billing's gate moves focus to the first missing field; this asserts the
     same. */
  const focusedAfterRefusal = await page.evaluate(
    () => document.activeElement?.getAttribute("data-response-disposition") ?? null
  );
  check(
    "response.blocked-focuses",
    "and it moves focus to the question it wants answered",
    focusedAfterRefusal !== null,
    focusedAfterRefusal ?? document.title
  );

  /* ═══ A radiogroup PROMISES ARROW KEYS ═══
     One tab stop, arrows move and choose. Asserted because the role is what
     tells a screen-reader user to expect it. */
  /* TWICE. The first press from an unchecked group selects the member focus is
     already on, which would let a no-op pass this check: with nothing chosen
     `indexOf` is -1 and "next" is the first. The second press has to MOVE. */
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  const firstPress = await page.evaluate(
    () => document.activeElement?.getAttribute("data-response-disposition") ?? null
  );
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  const arrowed = await page.evaluate(() => ({
    focused: document.activeElement?.getAttribute("data-response-disposition") ?? null,
    checked: [...document.querySelectorAll("[data-response-disposition]")]
      .filter((b) => b.getAttribute("aria-checked") === "true")
      .map((b) => b.getAttribute("data-response-disposition")),
    stops: [...document.querySelectorAll("[data-response-disposition]")].filter(
      (b) => b.getAttribute("tabindex") === "0"
    ).length,
  }));
  check(
    "response.radiogroup-arrows",
    "the arrows MOVE the selection, and the group is one tab stop",
    arrowed.focused === arrowed.checked[0] &&
      arrowed.checked.length === 1 &&
      arrowed.stops === 1 &&
      arrowed.focused !== firstPress,
    `${firstPress} → ${arrowed.focused}, checked ${arrowed.checked.join("/")}, ${arrowed.stops} tab stop(s)`
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
  /* ═══ THE CHECK THAT WAS MISSING, AND IT MATTERED ═══
     `advance.response-holds` passed for six commits while "Record response"
     THREW on every click: `resolveWithUndo` refused the whole escalation domain,
     so nothing resolved and therefore nothing advanced. A hold-still assertion
     cannot tell "held correctly" from "did nothing". So the resolve is asserted
     FIRST — the row goes into its undo window and says so — and only then is the
     selection's stillness meaningful. */
  const recorded = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      toast: /Response recorded/.test(t),
      closing: /Closing/.test(t),
    };
  });
  check(
    "advance.response-recorded",
    "pressing it actually records — the row enters its undo window",
    recorded.toast || recorded.closing,
    `toast ${recorded.toast}, closing row ${recorded.closing}`
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
    "docs.gaps-stated",
    "the 911 decision AND the acknowledgement time are named as absent",
    /On the escalation record/.test(pane.paneText) &&
      /carries neither/.test(pane.paneText) &&
      /acknowledgement entry appears either way/.test(pane.paneText)
  );
  check(
    "docs.window",
    "the timeline covers the escalation's own window, not just its close",
    pane.entries.filter((e) => e.source === "supportThread").length >= 2,
    `${pane.entries.length} entries, ${pane.entries.filter((e) => e.source === "supportThread").length} messages`
  );
  check(
    "docs.no-invented-ack",
    "and it does not stamp an acknowledgement nobody recorded",
    !pane.entries.some((e) => /Acknowledged by the supervisor/.test(e.body))
  );
  check(
    "docs.manual-seeded",
    "a hand-logged action is present on arrival, marked as hand-logged",
    pane.entries.some((e) => e.manual === true && /emergency contact/.test(e.body)),
    pane.entries.filter((e) => e.manual).length + " manual entries"
  );
  check(
    "docs.completeness",
    "the action row counts recorded fields rather than validating",
    /of \d+ fields recorded/.test(pane.paneText),
    (pane.paneText.match(/\d+ of \d+ fields recorded/) ?? ["not found"])[0]
  );
  /* ═══ A LOGGED ACTION MUST NOT FOLLOW THE READER ═══
     The pane does not unmount between selections, so page-local state keyed to
     nothing leaks from one escalation to the next — MEASURED as the opposite
     failure first: a `useState` initialiser meant the seeded entry never
     appeared at all, because it ran once against a live escalation. */
  await page.getByRole("button", { name: /Log an action/i }).click();
  await page.waitForTimeout(200);
  await page
    .getByRole("textbox", { name: /What happened/i })
    .fill("Leak canary — belongs to this task only");
  await page.getByRole("button", { name: /^Log it$/i }).click();
  await page.waitForTimeout(300);
  const mine = await readPane(page);
  check(
    "docs.manual-lands",
    "a logged action lands on the task it was logged on",
    mine.entries.some((e) => /Leak canary/.test(e.body))
  );
  check(
    "docs.manual-says-late",
    "and on a CLOSED escalation it says the time is when it was logged",
    mine.entries.some(
      (e) => /Leak canary/.test(e.body) && /logged after the escalation closed/.test(e.label)
    ),
    mine.entries.find((e) => /Leak canary/.test(e.body))?.label
  );
  await selectRow(page, /Active escalation/);
  const other = await readPane(page);
  check(
    "docs.manual-no-leak",
    "and does NOT appear on another escalation",
    other.entries.length > 0 && !other.entries.some((e) => /Leak canary/.test(e.body)),
    `${other.entries.length} entries on the other record`
  );

  await context.close();
}

// ── 5. THE RECORD ON MONITORING (G6) ───────────────────────────────────────
//
// The record is the escalation's durable home. What is asserted: the deep link
// resolves, the state is stated, the timeline is there, and a TERMINAL record —
// which has left the escalation region because it is settled — is still
// reachable by its own link and offers no form.
{
  const { context, page } = await openView(
    browser,
    {
      id: "g-record",
      url: "/app/monitoring?escalation=esc-documented",
      seed: {
        persona: "supervisor",
        extra: {
          tasksScenarioId: "typical-shift",
          monitoringScenarioId: "escalation-documented",
        },
      },
    },
    XL,
    version
  );
  await page.waitForTimeout(700);

  const rec = await page.evaluate(() => {
    const text = (el) => (el?.innerText ?? "").replace(/\s+/g, " ").trim();
    const lifecycle = document.querySelector("[data-record-lifecycle]");
    return {
      lifecycle: lifecycle?.getAttribute("data-record-lifecycle") ?? null,
      lifecycleText: text(lifecycle),
      body: text(document.body),
      entries: document.querySelectorAll("[data-timeline-entry]").length,
      // A settled record has left the worklist; the link is the only way in.
      regionRows: document.querySelectorAll("[data-escalation-state]").length,
      inRegion: [...document.querySelectorAll("[data-anno-ref]")].some((el) =>
        (el.getAttribute("data-anno-ref") ?? "").includes("esc-documented")
      ),
      noteFields: document.querySelectorAll('[data-slot="escalation-note"]').length,
    };
  });

  check(
    "record.deep-link",
    "a link to an escalation opens its record",
    rec.lifecycle !== null,
    rec.lifecycle ?? "no [data-record-lifecycle] — the record did not open"
  );
  check(
    "record.terminal",
    "and a documented record says it is finished",
    rec.lifecycle === "closedDocumented" &&
      /nothing further is owed/.test(rec.lifecycleText),
    rec.lifecycleText
  );
  check(
    "record.left-the-region",
    "a settled record is NOT in the escalation region",
    rec.inRegion === false,
    `${rec.regionRows} region rows`
  );
  check(
    "record.timeline",
    "the record carries the timeline",
    rec.entries >= 3,
    `${rec.entries} entries`
  );
  check(
    "record.no-form",
    "and offers no note form, because the note is recorded",
    rec.noteFields === 0 && /stores no note body/.test(rec.body)
  );

  // ── the miss. An id from another scenario has no record to show.
  await page.goto(`${BASE}/app/monitoring?escalation=esc-not-here`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);
  const missed = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="status"]')].find((n) =>
      /isn.t in this data set/.test(n.innerText)
    );
    return el ? el.innerText.replace(/\s+/g, " ").trim() : null;
  });
  check(
    "record.miss-stated",
    "an unreachable id is named rather than silently replaced",
    !!missed && /esc-not-here/.test(missed),
    missed ?? "no notice"
  );
  check(
    "record.miss-spacing",
    "and the sentence is not glued together",
    !!missed && /esc-not-here isn/.test(missed),
    missed?.slice(0, 60)
  );

  await context.close();
}

// ── 6. THE TIMELINE'S OWN ACCESSIBILITY AND CONTRAST ───────────────────────
//
// New UI on two surfaces, and neither surface's existing sweep saw it: the Tasks
// axe run never had an escalation selected and Monitoring's ran a scenario with
// no record open. So the sweep is here, in the state that mounts it, in both
// themes — and the contrast pairs are measured rather than assumed, because the
// source chip and the hand-logged chip are the two elements this phase invented.
{
  for (const scheme of ["light", "dark"]) {
    const { context, page } = await openView(
      browser,
      {
        id: `g-axe-${scheme}`,
        url: "/app/tasks",
        seed: {
          persona: "supervisor",
          extra: { tasksScenarioId: "typical-shift", theme: scheme },
        },
      },
      { ...XL, scheme },
      version
    );
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(450);
    await selectRow(page, /Active escalation/);
    // Open the log form too — a collapsed form cannot be swept.
    await page.getByRole("button", { name: /Log an action/i }).click();
    await page.waitForTimeout(250);
    /* ONE HAND-LOGGED ENTRY FIRST. Its chip is a BORDER rather than a fill —
       the one element in the timeline whose treatment this phase invented — so a
       sweep without it would be measuring only the pairs that already existed.
       The form is re-opened after, because an open form is also part of the
       state axe has to see. */
    await page
      .getByRole("textbox", { name: /What happened/i })
      .fill("Called the mentor back");
    await page.getByRole("button", { name: /^Log it$/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Log an action/i }).click();
    await page.waitForTimeout(250);

    const res = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    check(
      `a11y.timeline-${scheme}`,
      `axe is clean with the timeline and its log form open (${scheme})`,
      res.violations.length === 0,
      res.violations.map((v) => `${v.id}×${v.nodes.length}`).join(", ") || "0 violations"
    );

    /* ═══ CONTRAST, MEASURED AGAINST THE REAL GROUND ═══
       String comparison, not a regex: a pattern authored inside this template
       loses its backslashes, which is how ten pairs once read 1.26:1 against a
       transparent ground. */
    const pairs = await page.evaluate(() => {
      const parse = (c) => {
        const n = c.replace("rgba(", "").replace("rgb(", "").replace(")", "").split(",").map(Number);
        return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
      };
      const lum = ({ r, g, b }) => {
        const f = (v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      /* WALK UP FOR AN OPAQUE GROUND. `rgba(0, 0, 0, 0)` is what a chip's own
         background reads as when it has none, and treating that as black is the
         artifact that produced the 1.26:1 readings. */
      const groundOf = (el) => {
        let n = el;
        while (n) {
          const bg = getComputedStyle(n).backgroundColor;
          const p = parse(bg);
          if (p.a > 0.9) return p;
          n = n.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      };
      const ratio = (el) => {
        const cs = getComputedStyle(el);
        const fg = parse(cs.color);
        const bg = groundOf(el);
        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
      };
      const out = [];
      const entry = document.querySelector("[data-timeline-entry]");
      if (entry) {
        out.push({ what: "source chip", r: ratio(entry.querySelector("[data-timeline-label] span")) });
        out.push({ what: "timestamp", r: ratio(entry.querySelector("[data-timeline-time]")) });
        out.push({ what: "entry text", r: ratio(entry.querySelector("[data-timeline-text]")) });
      }
      const manual = document.querySelector('[data-timeline-manual="true"]');
      if (manual) out.push({ what: "hand-logged chip", r: ratio(manual.querySelector("[data-timeline-label] span")) });
      const caveat = [...document.querySelectorAll("p")].find((n) =>
        n.textContent.includes("out-of-band actions appear only when logged")
      );
      if (caveat) out.push({ what: "standing caveat", r: ratio(caveat) });
      return out;
    });
    check(
      `contrast.timeline-${scheme}-inputs`,
      `all five pairs were found and measured (${scheme})`,
      pairs.length === 5 &&
        pairs.some((p) => p.what === "hand-logged chip"),
      `${pairs.length} pairs: ${pairs.map((p) => p.what).join(", ")}`
    );
    check(
      `contrast.timeline-${scheme}`,
      `every timeline pair clears 4.5:1 (${scheme})`,
      pairs.length > 0 && pairs.every((p) => p.r >= 4.5),
      pairs.map((p) => `${p.what} ${p.r}:1`).join(" · ")
    );

    await context.close();
  }
}

// ── 7. THE RESPONSE ROW'S INK ON THE SATURATED FILL ────────────────────────
//
// axe found `--text-primary` at 3.17:1 and `--text-secondary` at 1.45:1 on the
// escalation fill — both because an element restated the ink for the DEFAULT
// ground on a row whose ground is not the default. Measured here so the fix
// cannot be undone by the next element that sets its own colour.
{
  const { context, page } = await open("g-row-ink");
  const ink = await page.evaluate(() => {
    const parse = (c) => {
      const n = c.replace("rgba(", "").replace("rgb(", "").replace(")", "").split(",").map(Number);
      return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const row = document.querySelector('[data-response="true"]');
    if (!row) return null;
    const bg = parse(getComputedStyle(row).backgroundColor);
    // EVERY LEAF THAT DRAWS TEXT, not a wrapper — a wrapper inherits the row's
    // own ink and would pass while its children fail.
    const leaves = [...row.querySelectorAll("span")].filter(
      (el) => !el.querySelector("span") && (el.textContent ?? "").trim().length > 0
    );
    return {
      bg: getComputedStyle(row).backgroundColor,
      pairs: leaves.map((el) => {
        const fg = parse(getComputedStyle(el).color);
        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        return {
          text: (el.textContent ?? "").trim().slice(0, 22),
          size: getComputedStyle(el).fontSize,
          r: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100,
        };
      }),
    };
  });
  check(
    "row.response-input",
    "the response row is on the saturated fill (the input to the next check)",
    !!ink && ink.pairs.length >= 3,
    ink ? `${ink.bg}, ${ink.pairs.length} text leaves` : "no [data-response] row"
  );
  check(
    "row.response-ink",
    "every string on the fill clears 4.5:1",
    !!ink && ink.pairs.every((p) => p.r >= 4.5),
    (ink?.pairs ?? [])
      .filter((p) => p.r < 4.5)
      .map((p) => `"${p.text}" ${p.r}:1 @${p.size}`)
      .join(" · ") || (ink?.pairs ?? []).map((p) => `${p.r}:1`).join(" ")
  );
  await context.close();
}

// ── 8. WHAT A READER WHO CANNOT SEE THE PAGE IS TOLD (G7) ─────────────────
//
// Everything that makes a live escalation unmissable is visual — the fill, the
// sticky pin, the never-windowed bucket — and none of it reaches a screen
// reader. Same for the note module's conditional fields, which are reserved with
// `invisible` + `aria-hidden` precisely so the layout does not jump.
{
  const { context, page } = await open("g-announce");
  const said = await page.evaluate(() =>
    [...document.querySelectorAll('[role="status"], [aria-live]')].map((el) => ({
      live: el.getAttribute("aria-live") ?? "status",
      text: (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim(),
    }))
  );
  check(
    "a11y.pinned-announced",
    "the pinned bucket's count is announced, politely",
    said.some((s) => /needs? a response now/.test(s.text)),
    said.filter((s) => s.text).map((s) => `${s.live}: ${s.text.slice(0, 48)}`).join(" | ")
  );
  check(
    "a11y.no-second-assertive",
    "and nothing on Tasks claims assertive",
    said.every((s) => s.live !== "assertive"),
    said.filter((s) => s.live === "assertive").length + " assertive"
  );
  check(
    "a11y.pinned-names-work",
    "it names the work rather than the treatment",
    !said.some((s) => /red|highlighted|colour|color/i.test(s.text))
  );

  // ── the note module's reveal
  await selectRow(page, /Escalation note/);
  const before = await page.evaluate(
    () => document.querySelector('[data-slot="note-reveals"]')?.textContent?.trim() ?? null
  );
  check(
    "a11y.reveal-silent-when-nothing",
    "the reveal region is empty while nothing is revealed",
    before === "",
    JSON.stringify(before)
  );
  /* CHOOSE THE VALUE THAT REVEALS THE CONDITIONAL. `crisis` is the one type that
     opens the crisis-type field — `CRISIS_TYPE_REVEALS_ON` in the module's
     contract. */
  const type = page.locator("select").first();
  await type.selectOption({ label: "Crisis" }).catch(async () => {
    await type.selectOption("crisis");
  });
  await page.waitForTimeout(250);
  const after = await page.evaluate(
    () => document.querySelector('[data-slot="note-reveals"]')?.textContent?.trim() ?? null
  );
  check(
    "a11y.reveal-announced",
    "and it names the field once that field starts being asked",
    !!after && /Crisis type is now being asked/.test(after),
    after ?? "nothing said"
  );

  /* ═══ FOCUS-VISIBLE ON EVERY CONTROL THIS PHASE ADDED ═══
     Measured by focusing each one and asking for its computed outline AND its
     box-shadow: the shared `RING` helper draws an outline, and Radix-style
     controls draw a ring in `box-shadow`. A test that asked for only one of the
     two reported a correctly-ringed control as unringed (gap 382). */
  /* ═══ THE FOCUS HAS TO ARRIVE BY KEYBOARD ═══
     PROBE ARTIFACT, corrected rather than accepted: the first version called
     `el.focus()` and read the computed outline, which reported all four
     controls as unringed. The ring is a `:focus-visible` rule, and Chromium
     does not match `:focus-visible` for a button focused programmatically with
     no preceding keyboard interaction — so the measurement was of the BASE
     state on a correctly-ringed control. Focusing, then Shift+Tab, then Tab
     puts the same element back under keyboard focus, which is how a reader
     reaches it. */
  const TARGETS = [
    ['[role="tab"]', "source tab"],
    ["[data-action='log']", "log an action"],
    ['[data-slot="escalation-note"] select', "note select"],
    ['[role="group"][aria-label="Escalation timeline"]', "timeline scroller"],
  ];
  const ringed = [];
  for (const [sel, what] of TARGETS) {
    const el = page.locator(sel).first();
    if (!(await el.count())) {
      ringed.push({ what, found: false });
      continue;
    }
    await el.evaluate((n) => n.focus());
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    ringed.push(
      await el.evaluate((n, what) => {
        const cs = getComputedStyle(n);
        const width = parseFloat(cs.outlineWidth) || 0;
        const shadow = cs.boxShadow && cs.boxShadow !== "none" ? cs.boxShadow : "";
        return {
          what,
          found: true,
          focused: n === document.activeElement,
          /* BOTH CHANNELS. The shared helper draws an outline; a Radix-style
             control draws its ring in `box-shadow`, and a test that asked for
             only the outline once reported a 4px-ringed control as unringed
             (gap 382). */
          ring:
            (width > 0 && cs.outlineStyle !== "none") || shadow.length > 0,
          detail: `${cs.outlineStyle} ${cs.outlineWidth}${shadow ? " +shadow" : ""}`,
        };
      }, what)
    );
  }
  check(
    "a11y.focus-inputs",
    "every control this phase added was found (the input to the next check)",
    ringed.every((r) => r.found),
    ringed.filter((r) => !r.found).map((r) => r.what).join(", ") || "all four"
  );
  check(
    "a11y.focus-visible",
    "and each takes a visible focus ring under keyboard focus",
    ringed.every((r) => r.found && r.focused && r.ring),
    ringed.map((r) => `${r.what}: ${r.detail ?? "missing"}`).join(" · ")
  );

  await context.close();
}

// ── 9. THE OLDER DEEP LINKS STILL LAND (G7 regression) ────────────────────
//
// `?escalation=` was added beside two existing params, and it takes precedence
// over one of them. Home links here with `?region=escalations` and `?band=`, so
// both are asserted rather than assumed: a new param that quietly broke an old
// link would only be noticed from Home.
{
  const { context, page } = await openView(
    browser,
    {
      id: "g-links",
      url: "/app/monitoring?region=escalations",
      seed: {
        persona: "supervisor",
        extra: { tasksScenarioId: "typical-shift", monitoringScenarioId: "escalation-closeout" },
      },
    },
    XL,
    version
  );
  await page.waitForTimeout(600);
  const region = await page.evaluate(() => ({
    selected: !!document.querySelector('[aria-current="true"]'),
    lifecycle: document.querySelector("[data-record-lifecycle]")?.getAttribute("data-record-lifecycle") ?? null,
    missed: /isn.t in this data set/.test(document.body.innerText),
  }));
  check(
    "links.region-still-selects",
    "`?region=escalations` still opens the most urgent escalation",
    region.selected && region.lifecycle !== null,
    `selected ${region.selected}, lifecycle ${region.lifecycle}`
  );
  check(
    "links.region-no-false-miss",
    "and it does not trip the unreachable-id notice",
    region.missed === false
  );

  await page.goto(`${BASE}/app/monitoring?band=imminentFlagReview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const band = await page.evaluate(() => ({
    rows: document.querySelectorAll('[role="treeitem"]').length,
    missed: /isn.t in this data set/.test(document.body.innerText),
  }));
  check(
    "links.band-accepted-ignored",
    "`?band=` still lands on a working page — accepted and ignored since arch-mon",
    band.rows > 0 && band.missed === false,
    `${band.rows} rows`
  );
  await context.close();
}

await browser.close();
console.log(`\n${failed === 0 ? "all checks passed" : `${failed} check(s) failed`}\n`);
process.exit(failed === 0 ? 0 : 1);
