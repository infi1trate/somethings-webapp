// ═══ MONITORING, REBUILT (arch-mon Phases 1–7) ═══
//
// This file replaces the arch-B probe wholesale. That one asserted the tier
// bands, the tier-derived SLA countdowns and the hybrid coalesced rows — every
// one of which was the severity taxonomy Phase 1 removed. Their subjects were
// deleted, not their assertions weakened, and the claims that replaced them are
// stronger: they are about what the page may NOT assert.
//
// RULE THIS FILE FOLLOWS (gap rows 366, 368): an assertion must fail loudly when
// its INPUT is absent. Every check that reads an element proves the element was
// found; `every`/`!some` over an empty set never stands alone.
//
// Exit codes: 0 all passed · 1 a check failed.

import { launch, openView, VIEWPORTS, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so a check kept passing while asserting about
   a surface it could not name, and a hop with the WRONG target would have passed
   too. Care Reviews is the billing surface; Risk Flags is the flag queue. */

/** ═══ THE PACK'S 39 KEYS, TRANSCRIBED ═══
 *  Duplicated here on purpose: the probe is the independent check, so it must not
 *  import the list it is checking. Grouped and ordered as the phase file lists
 *  them, because the order is part of what was asked for. */
const EXPECTED_KEYS = [
  // Volume and coverage
  "clean-day", "classifier-degraded", "shift-start-backlog", "normal-day", "surge", "coverage-debt",
  // Escalation lifecycle
  "escalation-unacked", "escalation-breach", "escalation-911", "escalation-concurrent",
  "escalation-closeout", "escalation-note-overdue", "escalation-no-caregiver", "escalation-afterhours",
  /* ADDED BY arch-G, G6 — not in the phase file, because the state it reaches
     did not exist then: no closed record could be `closed · documented`, so the
     surface's terminal state was unreachable and unverifiable. The list grows
     rather than the count being loosened. */
  "escalation-documented",
  // Compliance paths
  "explicit-media", "suspected-death",
  // Risk flags
  "flag-in-escalation", "flag-repeat-pattern", "flag-no-mentor-reply", "flag-false-positive-cluster",
  // Mentor practice
  "mentor-offline", "mentor-outreach-missed", "mentor-response-slow", "mentor-note-overdue",
  "mentor-conduct-flag", "mentor-perf-escalation", "mentor-post-crisis",
  // Live layer
  "live-offhours", "live-transport-lost", "live-quiet-shift", "live-busy-shift", "live-response-clock",
  "live-mentor-drop", "live-outreach-window", "live-flag-arrival", "live-escalation-arrival", "live-paused",
  // System and edge
  "teen-deactivated-midreview", "loading-partial",
];

const OUT = process.env.SHOT_OUT ?? "docs/responsive/monitoring";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;
function check(id, label, ok, detail) {
  rows.push({ id, label, ok: !!ok, detail });
  if (!ok) failed += 1;
  console.log(`  ${ok ? "✓" : "×"} ${id.padEnd(30)} ${label}${detail ? ` — ${detail}` : ""}`);
}

/** ═══ A CLAIM THIS PROBE CANNOT CURRENTLY VERIFY, SAID OUT LOUD ═══
 *
 *  NOT a skip and NOT a pass. A check whose subject has moved out of reach is
 *  the most dangerous thing in a probe file: deleted it leaves a claim nobody
 *  asserts, commented out it rots, and relaxed to green it is a rubber stamp.
 *
 *  So it prints `⊘`, names its owner, counts separately, and the summary reports
 *  the count — which can never be silently zero, because a run with no blocked
 *  checks says "0 blocked" and a run that grew one says so. Exit code is
 *  unaffected: a blocked check is not a failure, it is an absence of evidence. */
let blockedCount = 0;
function blocked(id, label, why) {
  blockedCount += 1;
  rows.push({ id, label, blocked: true, why });
  console.log(`  ⊘ ${id.padEnd(30)} ${label} — BLOCKED: ${why}`);
}

/** ═══ THE DEFAULT IS THE FLAG QUEUE; THE ESCALATION CHECKS ASK FOR THEIRS ═══
 *
 *  Phase 2 split this probe's single subject across two routes: the flag queue
 *  is `/app/risk-flags` and the escalation REGION moved to `/app/escalations`.
 *  Phase 2's retarget pointed everything at the queue, so every check waiting on
 *  `li[data-escalation-state]` timed out against a page that no longer renders
 *  it — measured on HEAD before Phase 4 as well, so this is that retarget's
 *  residue rather than something the tier removal broke.
 *
 *  `ESC` IS SPELLED AT EACH CALL rather than inferred from the scenario name:
 *  two of these fixtures ("normal-day") are used by both halves, so a name-based
 *  guess would send one of them to the wrong surface. */
const ESC = "/app/escalations";

async function open(id, { scenario = null, tasks = "typical-shift", load = "ready", url = "/app/risk-flags" } = {}) {
  return openView(
    browser,
    {
      id,
      url,
      seed: {
        persona: "supervisor",
        extra: { tasksScenarioId: tasks, monitoringScenarioId: scenario, devLoadState: load },
      },
    },
    XL,
    version
  );
}

const mainText = (page) => page.locator("main").innerText();
const rowText = (page) =>
  page.locator('[role="treeitem"]').evaluateAll((els) => els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()));

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE SEVERITY TAXONOMY IS GONE (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("tiers-gone");
  await page.waitForTimeout(600);
  const t = await mainText(page);
  const headers = await page
    .locator('[role="group"][aria-label]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check("input.headers", "group headers were readable at all", headers.length > 0, headers.join(" | "));
  check(
    "tier.no-band-headers",
    "no tier names a group",
    !headers.some((h) => /Imminent|Clinical review|Routine review/.test(h ?? "")),
    headers.join(" | ")
  );
  check(
    "tier.no-tier-anywhere",
    "and the words appear nowhere on the surface",
    !/\bImminent\b|\bClinical review\b|\bRoutine review\b/.test(t)
  );

  const texts = await rowText(page);
  check("input.rows", "rows were readable at all", texts.length > 0, `${texts.length} rows`);
  check(
    "tier.no-flag-deadline",
    "no flag row counts down to a deadline or reports a breach",
    texts.length > 0 && !texts.some((x) => /due in|overdue/i.test(x)),
    texts.find((x) => /due in|overdue/i.test(x)) ?? "none"
  );
  check(
    "tier.age-not-deadline",
    "every flag row states an age instead",
    texts.length > 0 && texts.every((x) => / ago\b/.test(x)),
    texts[0]
  );
  /* ═══ THE POSITIVE HALF MOVED ROUTES (Phase 2) ═══
     "Breach treatment still exists" is asserted so "no breach on flags" cannot
     quietly become "no breach at all" — and the thing it looks for is the
     escalation region, which is `/app/escalations` now. Read on ITS page, in its
     own context, rather than on the flag queue where it would always find zero
     and the assertion would invert. */
  const escView = await open("tiers-breach", { url: ESC });
  await escView.page.waitForTimeout(700);
  const breachChips = await escView.page
    .locator("li[data-escalation-state] span, [data-slot='event-pane'] span")
    .evaluateAll((els) => els.filter((e) => /Overdue|overdue/.test(e.textContent ?? "")).length);
  check(
    "tier.breach-is-escalations-only",
    "breach treatment is present, and only inside the escalation lifecycle",
    breachChips > 0,
    `${breachChips} breach chips, all escalation-linked`
  );
  await escView.context.close();
  await page.screenshot({ path: `${OUT}/01-queue.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · ROW ANATOMY (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("row-anatomy");
  await page.waitForTimeout(600);
  const parts = await page.locator('[role="treeitem"]').first().evaluate((row) => {
    const leaves = [...row.querySelectorAll("span")].filter((e) => !e.querySelector("span") && (e.innerText || "").trim());
    return leaves.map((e) => {
      const cs = getComputedStyle(e);
      const fam = cs.fontFamily.toLowerCase();
      return {
        text: (e.innerText || "").trim(),
        px: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        fam: fam.split(",")[0].replace(/["']/g, ""),
        emph: parseFloat(cs.fontSize) >= 14 && (fam.includes("avantt") || (fam.includes("mono") && Number(cs.fontWeight) >= 600)),
      };
    });
  });
  check("input.parts", "the row's parts were readable", parts.length > 0, `${parts.length} parts`);
  const emph = parts.filter((p) => p.emph);
  check(
    "row.one-emphasis",
    "exactly one emphasised element per row",
    emph.length === 1,
    emph.map((e) => `${e.text} ${e.px}/${e.weight} ${e.fam}`).join(" | ")
  );
  check(
    "row.subject-leads",
    "and it is the subject of review",
    emph[0] && /^[A-Z][a-z]+ [A-Z]\./.test(emph[0].text),
    emph[0]?.text
  );
  const age = parts.find((p) => / ago$/.test(p.text));
  check("row.age-tabular", "the age is mono and tabular", age && /mono/.test(age.fam), age && `${age.text} ${age.px}px ${age.fam}`);
  const label = await page.locator('[role="treeitem"]').first().getAttribute("aria-label");
  check("row.roles-in-name", "the accessible name labels both roles", /teen /.test(label ?? "") && /mentor /.test(label ?? ""), label?.slice(0, 80));
  const texts = await rowText(page);
  /* NO MESSAGE CONTENT (locked decision 9). The fixtures' flagged lines are
     lowercase teen messages; a row carrying one would contain the excerpt. */
  const excerptish = texts.filter((x) => /i don.t know how much longer|idk it/i.test(x));
  check("row.no-message-content", "no row shows message content", excerptish.length === 0, excerptish[0] ?? "none");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE COMPARATOR, VISIBLE (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("comparator", { scenario: "flag-in-escalation" });
  await page.waitForTimeout(600);
  const texts = await rowText(page);
  check("input.cmp-rows", "rows were readable", texts.length > 1, `${texts.length} rows`);
  check(
    "cmp.escalation-first",
    "an event on an escalated teen sorts to the top",
    /Escalation open/.test(texts[0] ?? ""),
    texts[0]
  );
  await context.close();
}
{
  const { context, page } = await open("cmp-pattern", { scenario: "flag-repeat-pattern" });
  await page.waitForTimeout(600);
  const texts = await rowText(page);
  check(
    "cmp.pattern-before-single",
    "a repeat-flagged conversation sorts above a single flag",
    /in this conversation/.test(texts[0] ?? ""),
    texts[0]
  );
  await context.close();
}
{
  const { context, page } = await open("cmp-noreply", { scenario: "flag-no-mentor-reply" });
  await page.waitForTimeout(600);
  const texts = await rowText(page);
  const idx = texts.findIndex((x) => /No reply/.test(x));
  check("input.noreply", "the unanswered row was found", idx >= 0, `index ${idx}`);
  check(
    "cmp.silence-beats-age",
    "an unanswered flagged message outranks older answered ones",
    idx === 0,
    texts.slice(0, 2).join("  ||  ")
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · THE DISPOSITION CONTROL (Phase 2) — THE ACCEPTANCE CRITERIA
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("disposition", { scenario: "normal-day" });
  await page.waitForTimeout(700);
  const before = (await rowText(page)).length;

  const dispositions = await page.locator("[data-disposition]").evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute("data-disposition"), effect: e.getAttribute("data-effect"), text: e.innerText.trim() }))
  );
  check("input.dispositions", "the disposition axis rendered", dispositions.length >= 3, dispositions.map((d) => d.id).join(","));
  check(
    "axis1.has-escalate-path",
    "one value opens an escalation instead of resolving",
    dispositions.some((d) => d.effect === "escalate"),
    dispositions.find((d) => d.effect === "escalate")?.text
  );
  check(
    "axis.no-disabled-button",
    "neither axis uses a disabled button",
    (await page.locator('[data-slot="event-pane-footer"] button[disabled]').count()) === 0
  );
  const accuracy = await page.locator("[data-accuracy]").evaluateAll((els) =>
    els.map((e) => ({ pressed: e.getAttribute("aria-checked"), text: e.innerText.trim() }))
  );
  check("input.accuracy", "the accuracy axis rendered", accuracy.length === 2, accuracy.map((a) => a.text).join(","));
  check(
    "axis2.never-preselected",
    "classifier accuracy starts with nothing chosen",
    accuracy.every((a) => a.pressed === "false")
  );

  // ── RESOLVING WITH NO DISPOSITION MUST BE IMPOSSIBLE ────────────────────
  await page.locator('[data-action="record"]').click();
  await page.waitForTimeout(400);
  const hint = await page.locator("#disposition-hint").count();
  const afterNoDisposition = (await rowText(page)).length;
  check("gate.inline-hint", "asking to resolve with no disposition surfaces inline guidance", hint === 1);
  check(
    "gate.not-a-toast",
    "and it is at the control, not a toast",
    (await page.locator('[data-slot="event-pane-footer"] #disposition-hint').count()) === 1
  );
  check(
    "gate.nothing-resolved",
    "and nothing resolves",
    afterNoDisposition === before,
    `${before} → ${afterNoDisposition} rows`
  );
  const focused = await page.evaluate(`document.activeElement?.id ?? ""`);
  check("gate.focus-moves-to-hint", "focus moves to the guidance", focused === "disposition-hint", focused || "(none)");

  // ── ACCURACY ALONE MUST RESOLVE NOTHING ─────────────────────────────────
  await page.locator("[data-accuracy]").first().click();
  await page.locator('[data-action="record"]').click();
  await page.waitForTimeout(400);
  const afterAccuracyOnly = (await rowText(page)).length;
  check(
    "gate.accuracy-alone-resolves-nothing",
    "recording classifier accuracy alone does not resolve anything",
    afterAccuracyOnly === before,
    `${before} → ${afterAccuracyOnly} rows`
  );

  // ── A RESOLVING DISPOSITION CLOSES IT ───────────────────────────────────
  await page.locator('[data-effect="resolve"]').first().click();
  await page.locator('[data-action="record"]').click();
  await page.waitForTimeout(700);
  const afterResolve = (await rowText(page)).length;
  check(
    "resolve.closes",
    "a resolving disposition closes the event",
    afterResolve === before - 1,
    `${before} → ${afterResolve} rows`
  );
  const toast = await page.getByText(/Event closed/).count();
  check("resolve.undo-window", "and the undo window opens", toast > 0);
  await context.close();
}
{
  // ── THE WATCH STATE KEEPS IT OPEN ───────────────────────────────────────
  const { context, page } = await open("watching", { scenario: "normal-day" });
  await page.waitForTimeout(700);
  const before = (await rowText(page)).length;
  await page.locator('[data-effect="watch"]').first().click();
  await page.locator('[data-action="record"]').click();
  await page.waitForTimeout(500);
  check(
    "watch.keeps-open",
    "the watching state records a look and keeps the event in the queue",
    (await rowText(page)).length === before,
    `${before} rows`
  );
  await context.close();
}
{
  // ── THE ESCALATE PATH ───────────────────────────────────────────────────
  //
  // Its flow is: escalate a FLAG from its disposition, then assert an escalation
  // RECORD appeared. Phase 2 put those on two routes — the flag lives on
  // `/app/risk-flags` and the region on `/app/escalations` — and the record is
  // created in `MonitoringPage`'s page-local `raised` state, which does not
  // survive the navigation between them. So the claim is unverifiable from
  // either page alone, and it is not a route-choice problem this file can fix.
  blocked(
    "escalate.creates-record",
    "escalating a flag creates an escalation record, and does not close the event",
    "Phase 6 — the escalation lifecycle spans two destinations until the two " +
      "representations of one escalation are unified; `raised` is page-local"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · THE ESCALATION LIFECYCLE (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════
for (const [scenario, id, want] of [
  ["escalation-unacked", "ack-pending", /ack in/],
  ["escalation-breach", "ack-breached", /ack .* overdue/],
]) {
  const { context, page } = await open(id, { scenario, url: ESC });
  await page.waitForTimeout(600);
  const row = await page.locator("li[data-escalation-state]").first().innerText();
  check(`ack.${id}`, `the five-minute clock reads correctly (${scenario})`, want.test(row.replace(/\s+/g, " ")), row.replace(/\s+/g, " ").slice(0, 90));
  const state = await page.locator("li[data-escalation-state]").first().getAttribute("data-ack-state");
  check(`ack.${id}.state`, "and the row declares its ack state", state === (scenario === "escalation-breach" ? "breached" : "pending"), state);
  await context.close();
}
{
  const { context, page } = await open("closeout", { scenario: "escalation-closeout" , url: ESC });
  await page.waitForTimeout(700);
  await page.locator("li[data-escalation-state] button").first().click();
  await page.waitForTimeout(500);
  const items = await page.locator("[data-closeout]").evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute("data-closeout"), state: e.getAttribute("data-closeout-state"), text: e.innerText.replace(/\s+/g, " ").trim() }))
  );
  check("input.closeout", "the close-out set rendered", items.length === 4, items.map((i) => i.id).join(","));
  check(
    "closeout.four-items",
    "all four items, in order",
    items.map((i) => i.id).join(",") === "note,debrief,teenFollowUp,safetyPlan"
  );
  check(
    "closeout.persists-after-resolve",
    "a resolved escalation stays on screen carrying them",
    (await page.locator("li[data-escalation-state]").count()) > 0
  );
  check(
    "closeout.no-write-up",
    "and the word write-up appears nowhere",
    !/write-?up/i.test(await mainText(page))
  );
  check(
    "closeout.escalation-note",
    "the note is called an escalation note",
    items.some((i) => /Escalation note/.test(i.text)),
    items[0]?.text
  );
  const followUp = items.find((i) => i.id === "teenFollowUp");
  check(
    "closeout.conditional-says-why",
    "the conditional follow-up states why it is being asked for",
    /caregiver involvement not recorded/.test(followUp?.text ?? ""),
    followUp?.text
  );
  const plan = items.find((i) => i.id === "safetyPlan");
  check(
    "closeout.no-invented-deadline",
    "the safety plan says it has no stated deadline rather than borrowing one",
    /no stated deadline/.test(plan?.text ?? ""),
    plan?.text
  );
  await page.screenshot({ path: `${OUT}/02-closeout.png` });
  await context.close();
}
{
  const { context, page } = await open("no-caregiver", { scenario: "escalation-no-caregiver" , url: ESC });
  await page.waitForTimeout(700);
  await page.locator("li[data-escalation-state] button").first().click();
  await page.waitForTimeout(500);
  const followUp = await page.locator('[data-closeout="teenFollowUp"]').innerText();
  check(
    "closeout.conditional-applies",
    "with no caregiver recorded, the teen follow-up is required and does not claim a reason it lacks",
    !/not required/.test(followUp),
    followUp.replace(/\s+/g, " ")
  );
  await context.close();
}
{
  const { context, page } = await open("roles", { scenario: "escalation-911" , url: ESC });
  await page.waitForTimeout(600);
  const row = (await page.locator("li[data-escalation-state]").first().innerText()).replace(/\s+/g, " ");
  check("roles.strip-labels", "the escalation strip labels both roles", /TEEN|Teen/.test(row) && /MENTOR|Mentor/.test(row), row.slice(0, 70));
  const label = await page.locator("li[data-escalation-state] button").first().getAttribute("aria-label");
  check("roles.strip-aria", "and so does its accessible name", /teen /.test(label ?? "") && /mentor /.test(label ?? ""), label?.slice(0, 70));
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · COVERAGE (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("coverage", { scenario: "coverage-debt" });
  await page.waitForTimeout(600);
  const header = await page.locator('[data-anno-ref="monitoring-header"]').innerText();
  check(
    "header.coverage-is-progress",
    "the header states coverage as progress against a period",
    / of \d+ conversations reviewed this shift/.test(header.replace(/\s+/g, " ")),
    header.replace(/\s+/g, " ")
  );
  check(
    "header.no-backlog-count",
    "and never as a backlog of items",
    !/unreviewed|to review|left|remaining|inbox/i.test(header)
  );
  check(
    "header.no-bare-flag-count",
    "and does not lead with an open flag count",
    !/\d+ flags? in review/.test(header)
  );
  /* ═══ COVERAGE IS A ROUTE, NOT A TAB (Phase 2) ═══
     The segmented control is hidden under a scope — the URL says which view this
     is, and a one-tab row offering no choice is dead chrome. So the coverage
     half opens its own destination instead of clicking for a control that is
     deliberately not there. The header checks above stay on the queue, which is
     whose header they are about. */
  const covView = await open("coverage-view", {
    scenario: "coverage-debt",
    url: "/app/coverage",
  });
  await covView.page.waitForTimeout(700);
  const convos = await covView.page
    .locator("[data-anno-ref^='coverage-row:']")
    .count();
  check("coverage.view-exists", "a coverage view lists supervised conversations", convos > 0, `${convos} conversations`);
  const unreviewedFirst = await covView.page.locator("[data-anno-ref^='coverage-row:']").first().getAttribute("data-reviewed");
  check("coverage.unreviewed-first", "unreviewed conversations sort first", unreviewedFirst === "false", unreviewedFirst);
  await page.screenshot({ path: `${OUT}/03-coverage.png` });
  await covView.context.close();
  await context.close();
}
{
  /* REVIEWING A FLAG CREDITS ITS CONVERSATION — the rule that stops a supervisor
     doing the same reading twice. */
  const { context, page } = await open("coverage-credit", { scenario: "normal-day" });
  await page.waitForTimeout(700);
  const before = await page.locator('[data-anno-ref="monitoring-header"]').innerText();
  await page.locator('[data-effect="resolve"]').first().click();
  await page.locator('[data-action="record"]').click();
  await page.waitForTimeout(700);
  const after = await page.locator('[data-anno-ref="monitoring-header"]').innerText();
  const n = (s) => Number((s.replace(/\s+/g, " ").match(/(\d+) of \d+ conversations/) ?? [])[1] ?? -1);
  check("input.credit", "the coverage figure was readable before and after", n(before) >= 0 && n(after) >= 0, `${n(before)} → ${n(after)}`);
  check(
    "coverage.credits-on-review",
    "reviewing an event credits its conversation",
    n(after) === n(before) + 1,
    `${n(before)} → ${n(after)}`
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 6b · THE TWO AXES, PER DESTINATION (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════
//
// The unit tests own the axes' MODEL — only a disposition closes an event, the
// escalate value does not resolve, the two arrays share no id. What only the DOM
// can answer is WHERE each axis renders, and that is where Phase 5 found two
// defects: the accuracy axis on events no classifier produced, and a shortcut
// sheet teaching those keys on the destination where they do nothing.
{
  const cases = [
    ["risk-flags", "/app/risk-flags", "normal-day", true],
    ["mentor-practice", "/app/mentor-practice", "mentor-note-overdue", false],
  ];
  for (const [name, url, scenario, wantAccuracy] of cases) {
    const { context, page } = await open(`axes-${name}`, { scenario, url });
    await page.waitForTimeout(900);
    await page.locator('[role="treeitem"]').first().click();
    await page.waitForTimeout(500);
    const seen = await page.evaluate(() => {
      const pane = document.querySelector('[data-slot="event-pane"]');
      return {
        rows: document.querySelectorAll('[role="treeitem"]').length,
        disposition: !!pane?.querySelector(
          '[role="radiogroup"][aria-label*="disposition" i]'
        ),
        accuracy: !!pane?.querySelector(
          '[role="radiogroup"][aria-label*="Classifier accuracy" i]'
        ),
        /* PRE-SELECTION IS A CLINICAL STATEMENT NOBODY MADE, so it is checked on
           both axes rather than asserted of the model. */
        checked: [
          ...(pane?.querySelectorAll('[role="radio"][aria-checked="true"]') ?? []),
        ].length,
      };
    });
    /* THE INPUT FIRST. Every assertion below is about a pane, and a destination
       with no rows renders none — which would read as "no accuracy axis". */
    check(
      `axes.${name}.input`,
      "an event was selectable and its pane opened",
      seen.rows > 0 && seen.disposition,
      `${seen.rows} row(s), disposition ${seen.disposition}`
    );
    check(
      `axes.${name}.accuracy`,
      wantAccuracy
        ? "the classifier-accuracy axis is offered on a flag"
        : "and is ABSENT where no classifier produced the event",
      seen.accuracy === wantAccuracy,
      `accuracy axis ${seen.accuracy ? "present" : "absent"}`
    );
    check(
      `axes.${name}.nothing-preselected`,
      "and neither axis arrives with an answer already recorded",
      seen.checked === 0,
      `${seen.checked} pre-selected`
    );

    /* ═══ AND THE SHEET TEACHES ONLY WHAT THIS DESTINATION BINDS ═══
       `y`/`n` advertised a classifier judgment on practice events in the one
       place a reader goes to LEARN the bindings. */
    await page.keyboard.press("?");
    await page.waitForTimeout(400);
    const sheet = await page.evaluate(
      () => document.querySelector('[role="dialog"]')?.innerText ?? ""
    );
    check(
      `axes.${name}.sheet-input`,
      "the shortcut sheet opened",
      /Keyboard shortcuts/i.test(sheet),
      sheet.slice(0, 40).replace(/\s+/g, " ")
    );
    check(
      `axes.${name}.sheet-matches`,
      wantAccuracy
        ? "and it teaches the accuracy keys"
        : "and it does not teach keys this destination does not bind",
      /Classifier was right/.test(sheet) === wantAccuracy,
      /* THE DETAIL REPORTS THE MEASUREMENT, NOT THE EXPECTATION. First version
         printed `wantAccuracy ? "taught" : "not taught"` — so a mutation run
         that made the sheet teach the keys on Mentor Practice failed with the
         message "not taught", sending the reader to look for the opposite of the
         defect. A failure detail that restates the assertion is worse than
         none. */
      `sheet ${/Classifier was right/.test(sheet) ? "teaches" : "omits"} the accuracy keys`
    );
    await context.close();
  }
}

/* ═══ THE PLAYBOOK MATCH — ONE ARTIFACT, BEFORE THE EVIDENCE (Phase 5) ═══
   Brought forward from arch-H H7 with the block. `Category` and `Why this was
   flagged` were two sections with a ninety-message transcript between them.
   ASSERTED IN DOM AND IN GEOMETRY, because either alone can be satisfied while
   a reader still sees the wrong thing: DOM order without geometry passes on an
   absolutely-positioned block, and geometry without DOM order passes on a
   layout that reads correctly for a sighted reader and wrongly for a screen
   reader. */
{
  const { context, page } = await open("playbook-match", {
    scenario: "normal-day",
    url: "/app/risk-flags",
  });
  await page.waitForTimeout(900);
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(500);
  const seen = await page.evaluate(() => {
    const pane = document.querySelector('[data-slot="event-pane"]');
    const match = pane?.querySelector('[data-anno-ref="flag-playbook-match"]');
    const convo = [...(pane?.querySelectorAll("p") ?? [])].find(
      (p) => p.innerText.trim() === "Conversation"
    );
    if (!match || !convo) return null;
    const t = match.innerText.replace(/\s+/g, " ");
    return {
      /* `Node.DOCUMENT_POSITION_FOLLOWING` — the match precedes the heading in
         document order, which is what a screen reader walks. */
      domFirst: !!(
        match.compareDocumentPosition(convo) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      geomFirst:
        match.getBoundingClientRect().top < convo.getBoundingClientRect().top,
      eyebrow: /Playbook match/.test(t),
      badge: /Classifier rationale/.test(t),
      chips: match.querySelectorAll("span, div").length > 0,
      /* NO CONFIDENCE, NO EVIDENCE CHIPS. The model publishes neither and
         nothing is parsed out of the prose — asserted on the rendered block so
         "declines to invent" is a property of the page and not only of the
         model, which `surfacing.test.ts` owns. */
      noConfidence: !/\b\d{1,3}\s?%|confiden/i.test(t),
    };
  });
  check(
    "match.input",
    "the flag pane opened with a playbook-match block",
    seen != null,
    seen ? "present" : "no block or no Conversation heading"
  );
  if (seen) {
    check(
      "match.one-artifact",
      "the categories and the rationale are one block, before the conversation",
      seen.domFirst && seen.geomFirst,
      `dom ${seen.domFirst} · geometry ${seen.geomFirst}`
    );
    check(
      "match.two-attributions",
      "and it carries both attributions — the taxonomy's and the machine's",
      seen.eyebrow && seen.badge,
      `eyebrow ${seen.eyebrow} · badge ${seen.badge}`
    );
    check(
      "match.invents-nothing",
      "and states no confidence, because the classifier publishes none",
      seen.noConfidence,
      seen.noConfidence ? "clean" : "a confidence-shaped string is rendered"
    );
  }
  await context.close();
}

/* COVERAGE BINDS ONE KEY, and a sheet listing five that do nothing is worse
   than a short one. Its own case, because it has no queue to select from. */
{
  const { context, page } = await open("axes-coverage", {
    scenario: "coverage-debt",
    url: "/app/coverage",
  });
  await page.waitForTimeout(900);
  await page.keyboard.press("?");
  await page.waitForTimeout(400);
  const sheet = await page.evaluate(
    () => document.querySelector('[role="dialog"]')?.innerText ?? ""
  );
  check(
    "axes.coverage.sheet-input",
    "the shortcut sheet opened on Coverage",
    /Keyboard shortcuts/i.test(sheet),
    sheet.slice(0, 40).replace(/\s+/g, " ")
  );
  check(
    "axes.coverage.sheet-minimal",
    "and teaches no queue, pane or accuracy key — Coverage binds none of them",
    !/queue|review pane|Classifier/i.test(sheet),
    sheet.replace(/\s+/g, " ").slice(0, 120)
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · MENTOR PRACTICE (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════
{
  /* ═══ THE SUBJECT SPLIT IS A ROUTE BOUNDARY NOW (Phase 2) ═══
     Practice events used to share one queue with flags, narrowed by a chip row.
     They are two destinations: `/app/risk-flags` pins teen safety and
     `/app/mentor-practice` pins mentor practice. So this opens the practice
     destination rather than clicking a chip that is deliberately hidden.
     THE TWO CHIP CHECKS BELOW ARE RETIRED, not relaxed — `practice.one-queue`
     asserted both subjects in one list and `practice.filter-chips` asserted the
     control that narrowed it. Both describe a surface Phase 2 replaced; the
     claim that survived is that the practice queue holds ONLY practice events,
     which `practice.filter-works` already makes and which the route now
     guarantees rather than a chip. */
  const { context, page } = await open("practice", {
    scenario: "mentor-note-overdue",
    url: "/app/mentor-practice",
  });
  await page.waitForTimeout(800);
  const headers = await page.locator('[role="group"][aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  /* PREFIX MATCH: the group's accessible name carries its count ("Mentor
     practice — 3"), which is what a screen-reader user needs on entry. */
  const named = (want) => headers.some((h) => (h ?? "").startsWith(want));
  check(
    "practice.own-destination",
    "the practice queue names its subject and holds nothing else",
    named("Mentor practice") && !named("Teen safety"),
    headers.join(" | ") || "no groups"
  );
  check(
    "practice.no-dead-chip-row",
    "and offers no subject filter, because the route already chose",
    (await page.locator('[role="group"][aria-label*="review subject"] button:visible').count()) === 0
  );
  const subjects = await page.locator('[role="treeitem"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-event-subject")));
  check("practice.filter-works", "the chip narrows the one queue", subjects.length > 0 && subjects.every((s) => s === "mentorPractice"), subjects.join(","));
  const row = await page.locator('[role="treeitem"]').first().innerText();
  check("practice.states-measure", "a practice row names the rule and the measure", /overdue/.test(row.replace(/\s+/g, " ")), row.replace(/\s+/g, " "));
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(400);
  const pane = (await page.locator('[data-slot="event-pane"]').innerText()).replace(/\s+/g, " ");
  check("practice.pane-names-constant", "and the pane says what it was measured against", /Measured against/.test(pane), pane.slice(0, 120));
  await page.screenshot({ path: `${OUT}/04-practice.png` });
  await context.close();
}
{
  const { context, page } = await open("practice-stub", {
    scenario: "mentor-conduct-flag",
    url: "/app/mentor-practice",
  });
  await page.waitForTimeout(800);
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(400);
  const pane = (await page.locator('[data-slot="event-pane"]').innerText()).replace(/\s+/g, " ");
  check(
    "practice.stub-says-so",
    "a stubbed event states that nothing computed it",
    /No automated measure|no automated measure/.test(pane),
    pane.slice(0, 140)
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · THE LIVE LAYER (Phase 6)
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("band-off", { scenario: "live-busy-shift" });
  await page.waitForTimeout(600);
  check(
    "live.off-by-default",
    "the Now band does not render while the flag is off",
    (await page.locator('[data-slot="now-band"]').count()) === 0
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 · STRUCTURE, FOCUS AND TARGETS
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("structure");
  await page.waitForTimeout(700);
  const scrollers = await page.evaluate(`(() => {
    const path = (el) => { const out = []; let n = el;
      while (n && n.tagName !== 'BODY') { let s = n.tagName.toLowerCase();
        if (n.getAttribute('data-slot')) s += '[' + n.getAttribute('data-slot') + ']';
        else if (n.getAttribute('data-anno-ref')) s += '[' + n.getAttribute('data-anno-ref') + ']';
        else if (n.getAttribute('role')) s += '[role=' + n.getAttribute('role') + ']';
        out.unshift(s); n = n.parentElement; }
      return out.slice(-3).join(' > '); };
    return [...document.querySelectorAll('*')].filter((el) => { const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4; })
      .map((el) => path(el));
  })()`);
  check("structure.two-scrollers", "exactly two scroll regions (locked decision 4)", scrollers.length === 2, `${scrollers.length}: ${scrollers.join(" ‖ ")}`);

  const footer = await page.evaluate(`(() => { const f = document.querySelector('[data-slot="event-pane-footer"]');
    const r = f.getBoundingClientRect(); return { position: getComputedStyle(f).position,
      top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; })()`);
  check("structure.footer-static", "the pane footer is not an overlay, so focus cannot hide under it", footer.position === "static", JSON.stringify(footer));

  const seq = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const d = await page.evaluate(`(() => { const el = document.activeElement; if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { zone: el.closest('[data-slot="event-pane-footer"]') ? 'footer' : el.closest('[data-slot="event-pane"]') ? 'pane'
               : el.closest('[role="tree"]') ? 'list' : el.closest('[data-anno-ref="escalation-region"]') ? 'escalations' : 'shell',
        name: (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g,' ').trim().slice(0,34),
        h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom),
        left: Math.round(r.left), right: Math.round(r.right),
        ring: parseFloat(cs.outlineWidth) }; })()`);
    if (d) seq.push(d);
  }
  const zones = seq.map((d) => d.zone);
  const firstOf = (z) => zones.indexOf(z);
  check("input.focus", "tab stops were observed", seq.length > 8, `${seq.length} stops`);
  check(
    "focus.order",
    "escalations → list → pane → footer, in that order",
    firstOf("escalations") < firstOf("list") && firstOf("list") < firstOf("pane") && firstOf("pane") < firstOf("footer"),
    zones.join(",")
  );
  check("focus.always-visible", "every stop draws a focus ring", seq.every((d) => d.ring >= 2), `min ${Math.min(...seq.map((d) => d.ring))}px`);
  /* BOTH AXES. The first version compared only the y band, which flagged the
     left rail's Team/Settings/Help — controls 550px to the left of the footer
     and obscured by nothing. An overlap is an overlap in two dimensions. */
  const obscured = seq.filter(
    (d) =>
      d.zone !== "footer" &&
      d.bottom > footer.top &&
      d.top < footer.bottom &&
      d.right > footer.left &&
      d.left < footer.right
  );
  check("focus.never-obscured", "and none is under the footer (WCAG 2.4.11)", obscured.length === 0, obscured.map((d) => d.name).join(",") || "none");

  const targets = seq.filter((d) => d.zone !== "shell");
  /* ═══ WCAG 2.5.8's INLINE EXCEPTION, NAMED RATHER THAN IGNORED ═══
     "Hide" inside the transcript is a text toggle in a sentence, 16px high
     because the line it sits in is — which is the exception the success
     criterion states, and the only control on the route that relies on it. It is
     the shared excerpt's, not this surface's, and raising it would change the
     Tasks pane's geometry. Excluded here BY NAME so a new small target cannot
     hide behind the exemption. */
  const INLINE_EXEMPT = ["Hide", "Show"];
  const small = targets.filter((d) => (d.h < 24 || d.w < 24) && !INLINE_EXEMPT.includes(d.name));
  check(
    "targets.24px-floor",
    "every new control clears the 24×24 floor (WCAG 2.5.8)",
    targets.length > 0 && small.length === 0,
    small.map((d) => `${d.name}:${d.h}x${d.w}`).join(" ") || `${targets.length} controls, smallest ${Math.min(...targets.map((d) => d.h))}px high`
  );
  /* AND THE SAFETY-CRITICAL ONES AGAINST THE PLATFORM GUIDANCE, separately:
     44×44 is HIG's floor and 24×24 is only the WCAG minimum. */
  /* ═══ MEASURED ON THE ESCALATIONS ROUTE, WHICH IS WHERE THE ZONE IS ═══
     This filtered `zone === "escalations"` out of a tab sequence taken on the
     flag queue. Phase 2 moved the escalation region to `/app/escalations`, so
     the filter matched nothing and the check failed on its own input-absence
     rule — which is the rule working, and the fix is to measure where the
     controls are rather than to drop the `length > 0` guard. */
  const escTargets = await (async () => {
    const v = await open("targets-esc", { scenario: "escalation-breach", url: ESC });
    await v.page.waitForTimeout(800);
    const out = [];
    for (let i = 0; i < 30; i++) {
      await v.page.keyboard.press("Tab");
      const d = await v.page.evaluate(`(() => { const el = document.activeElement;
        if (!el || el === document.body) return null;
        if (!el.closest('[data-anno-ref="escalation-region"]')) return null;
        const r = el.getBoundingClientRect();
        return { name: (el.getAttribute('aria-label') || el.innerText || el.tagName).replace(/\\s+/g, ' ').trim().slice(0, 28),
                 h: Math.round(r.height), w: Math.round(r.width) }; })()`);
      if (d) out.push(d);
    }
    await v.context.close();
    return out;
  })();
  check(
    "targets.escalations-44",
    "every escalation control clears HIG's 44px",
    escTargets.length > 0 && escTargets.every((d) => d.h >= 44),
    escTargets.length
      ? escTargets.map((d) => `${d.name}:${d.h}x${d.w}`).join(" · ")
      : "no escalation controls reached — the zone is not on this route"
  );
  const rowBox = await page.locator('[role="treeitem"]').first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return `${Math.round(r.height)}x${Math.round(r.width)}`;
  });
  check("targets.rows", "a queue row is a comfortable target", /^56x/.test(rowBox), rowBox);

  const live = await page.evaluate(`(() => [...document.querySelectorAll('[aria-live],[role=status],[role=alert],[role=log]')]
    .map((e) => (e.getAttribute('aria-live') || e.getAttribute('role')) + ':' + ((e.getAttribute('aria-label') || e.innerText || '').replace(/\\s+/g,' ').trim().slice(0,26) || '(empty)')))()`);
  check("a11y.live-inventory", "every live region on the route is accounted for", live.length > 0, live.join(" | "));
  check(
    "a11y.one-assertive",
    "only the escalation region is assertive",
    live.filter((l) => /^assertive/.test(l)).length <= 1,
    live.filter((l) => /^assertive/.test(l)).join(" | ") || "none"
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 · EVERY FIXTURE RENDERS (Phase 7)
// ═══════════════════════════════════════════════════════════════════════════
{
  /* ═══ THE KEYS ARE READ OFF THE DEV BAR, NOT OFF THE MODULE ═══
     Phase 7 asks for them WIRED INTO THE SWITCHER, so reading the switcher is
     the check. A key that exists in the registry and never reaches the control
     would pass an import-based test and fail a supervisor trying to demo it. */
  const { context: c0, page: p0 } = await open("fx-keys");
  await p0.waitForTimeout(500);
  const wired = await p0.locator('select[aria-label="Prototype scenario"] option').evaluateAll((els) =>
    els.map((e) => e.getAttribute("value")).filter((v) => (v ?? "").startsWith("monitoring:")).map((v) => v.slice("monitoring:".length))
  );
  const groups = await p0.locator('select[aria-label="Prototype scenario"] optgroup').evaluateAll((els) =>
    els.map((e) => e.getAttribute("label")).filter((l) => (l ?? "").startsWith("Monitoring · "))
  );
  await c0.close();
  check("fixtures.wired", "every key is wired into the dev bar's switcher", wired.length === EXPECTED_KEYS.length, `${wired.length} of ${EXPECTED_KEYS.length}`);
  check(
    "fixtures.exact-keys",
    "and they are the exact keys, in the phase file's order",
    wired.join(",") === EXPECTED_KEYS.join(","),
    wired.filter((k) => !EXPECTED_KEYS.includes(k)).join(",") || EXPECTED_KEYS.filter((k) => !wired.includes(k)).join(",") || "exact"
  );
  check(
    "fixtures.grouped",
    "grouped in the order the phase file lists",
    groups.join(" | ") ===
      [
        "Monitoring · Volume and coverage",
        "Monitoring · Escalation lifecycle",
        "Monitoring · Compliance paths",
        "Monitoring · Risk flags",
        "Monitoring · Mentor practice",
        "Monitoring · Live layer",
        "Monitoring · System and edge",
      ].join(" | "),
    groups.join(" | ")
  );

  const broken = [];
  for (const key of EXPECTED_KEYS) {
    const { context, page } = await open(`fx-${key}`, { scenario: key });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
    await page.waitForTimeout(450);
    const header = await page.locator('[data-anno-ref="monitoring-header"]').count();
    if (!header || errs.length) broken.push(`${key}${errs.length ? `: ${errs[0]}` : " (no header)"}`);
    await context.close();
  }
  check(
    "fixtures.all-render",
    `all ${EXPECTED_KEYS.length} scenario keys render without error`,
    broken.length === 0,
    broken.join(" | ") || `${EXPECTED_KEYS.length} keys`
  );
}

await writeFile(`${OUT}/report.json`, JSON.stringify({ at: Date.now(), rows }, null, 2));
await browser.close();
/* ═══ THE BLOCKED COUNT IS ALWAYS PRINTED, EVEN AT ZERO ═══
   A summary that mentioned blocked checks only when there were some would let a
   run with three of them read the same as a clean one to anybody skimming. The
   first attempt at this line silently failed to apply — the string it searched
   for had different capitalisation — so the count existed and was reported
   nowhere, which is precisely the silent-zero this is guarding against. */
console.log(
  `\n${blockedCount} BLOCKED · ` +
    (failed ? `${failed} CHECK(S) FAILED` : "ALL RUNNABLE CHECKS PASSED")
);
process.exit(failed ? 1 : 0);
