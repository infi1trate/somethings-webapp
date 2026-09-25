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
  "clean-day", "classifier-degraded", "shift-start-backlog", "normal-day", "surge",
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
  /* ADDED BY §2.8 — the one fixture with a flag no classifier produced. */
  "flag-user-reported",
  /* THE SEVEN `mentor-*` FIXTURES AND `coverage-debt` ARE GONE (addendum §2.1,
     §2.2) — with the destinations they exercised. The list shrinks rather than
     the count being loosened, which is the same rule the arch-G addition
     followed in the other direction. */
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
/* ═══ UNUSED AS OF PHASE 6, AND KEPT ON PURPOSE ═══
   Its only caller was `escalate.creates-record`, which Phase 6 unblocked by
   retiring the second escalation pane. An unused helper normally goes — this one
   stays because the alternative to having it is what this file did before it
   existed: a check whose subject moved out of reach gets commented out, and a
   commented-out check is a claim nobody asserts and nobody can see is missing.
   The summary prints "0 BLOCKED" either way, which is the actual guard. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  /* ═══ THE GROUP-HEADER CHECK IS GONE, AND NOT BECAUSE IT PASSED ═══
     `input.headers` asserted that group headers existed, and
     `tier.no-band-headers` asserted that none of them named a tier. The list
     has no group layer since §2.1: with one review subject the header read
     "Teen safety — 9" over every row on a page titled Risk Flags.
     THIS IS THE CASE THE INPUT GUARD WAS WRITTEN FOR. With no headers the
     tier-name assertion would pass over an empty array — a green check on a
     claim nothing was tested. So rather than let it go vacuous, the claim is
     carried by `tier.no-tier-anywhere` below, which reads the whole surface's
     text and therefore covers whatever a group header would have said, and by
     `input.rows`, which is the input guard that still has a subject. */
  check(
    "tier.no-tier-anywhere",
    "no tier name appears anywhere on the surface",
    !/\bImminent\b|\bClinical review\b|\bRoutine review\b/.test(t),
    /* THE DETAIL REPORTS THE OBSERVATION. A pass prints the surface's opening
       words, so a reader can see WHICH surface was read — the previous version
       printed nothing at all and a misrouted probe would have looked clean. */
    t.replace(/\s+/g, " ").slice(0, 80)
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
  /* ═══ INVERTED BY §2.8, AND THE ASSERTION IS NOW THE ABSENCE ═══
     It asserted that one disposition VALUE opened an escalation instead of
     resolving — the path the original control did not have at all. That path
     still exists and is checked at `footer.two-ctas`; what changed is that it
     is a button rather than a radio, because a disposition is a statement
     about the teen and escalating is a thing a supervisor DOES.
     CHECKED ON THE LABELS TOO: re-adding it as a `watch`-effect value called
     "Escalate now" would satisfy an effects-only check while putting the verb
     straight back in the required question. */
  check(
    "axis1.holds-no-verb",
    "the required clinical question cannot be answered with an action",
    !dispositions.some((d) => d.effect === "escalate") &&
      !dispositions.some((d) => /escalat/i.test(d.text)),
    dispositions.map((d) => `${d.text} [${d.effect}]`).join(" · ")
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
  // ── THE ESCALATE PATH (unblocked in Phase 6) ────────────────────────────
  //
  // ═══ WHY IT WAS BLOCKED, AND WHAT CHANGED ═══
  //
  // Phase 4 marked this `⊘`: the old check escalated a flag and then counted
  // rows in the escalation REGION, and Phase 2 had moved the region to
  // `/app/escalations` while the flag stayed on `/app/risk-flags`. The record is
  // created in page-local `raised` state, which does not survive the navigation
  // between them, so the claim was unverifiable from either page alone.
  //
  // PHASE 6 RETIRED THE SECOND ESCALATION PANE, and with one representation the
  // observable behaviour on the flag queue is clear: escalating opens the record
  // IN THE PANE — `selectedEscalation` is derived from the full record set,
  // `raised` included — announces that it happened, and leaves the flag in the
  // queue. All three are checkable on one route.
  //
  // WHAT IS STILL NOT CHECKED, and is a decision rather than a gap in this file:
  // the raised record does not survive a navigation to `/app/escalations`,
  // because nothing in this prototype persists a supervisor's decision — flag
  // resolutions, close-out completions and coverage credit are all page-local by
  // the same design. Gap row 430 states it with the store analysis.
  const { context, page } = await open("escalate-path", {
    scenario: "normal-day",
    url: "/app/risk-flags",
  });
  await page.waitForTimeout(900);
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(400);
  const beforeRows = (await rowText(page)).length;
  check(
    "escalate.input",
    "a flag was selected and the queue has rows to leave it in",
    beforeRows > 0,
    `${beforeRows} rows`
  );
  /* ═══ ONE CONTROL, NOT TWO (addendum §2.8) ═══
     It was `[data-effect="escalate"]` — a disposition radio — followed by the
     primary. Escalating is a button now and is never gated on the radiogroup,
     which is the whole point: under-escalation is the expensive error on this
     surface and it should not cost two interactions. */
  await page.locator('[data-action="escalate"]').click();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const pane = document.querySelector('[data-slot="event-pane"]');
    return {
      paneText: (pane?.innerText ?? "").replace(/\s+/g, " "),
      /* THE RECORD'S OWN PANE HAS A LIFECYCLE ATTRIBUTE; a flag's does not. */
      lifecycle: pane
        ?.querySelector("[data-record-lifecycle]")
        ?.getAttribute("data-record-lifecycle"),
      /* ═══ THE PAGE'S OWN STATUS LINE, NOT EVERY LIVE REGION ═══
         A broad `[aria-live]` query also catches the PANE, whose wrapper is
         `aria-live="polite"` so an auto-advance announces the event that
         arrived. Joining both made the check's detail print the pane's whole
         text while the assertion was matching the status line buried in it —
         the reporting flaw gap row 424 records, reintroduced within one phase.
         The sr-only status element is the one the page writes announcements to. */
      announcement:
        document.querySelector('p[role="status"][aria-live="polite"]')
          ?.textContent ?? "",
    };
  });
  check(
    "escalate.opens-the-record",
    "escalating opens the escalation record in the pane",
    after.lifecycle != null,
    `lifecycle ${after.lifecycle ?? "none — the pane is still showing a flag"}`
  );
  check(
    "escalate.says-so",
    "and says so, rather than leaving the reader to notice",
    /Escalation opened/i.test(after.announcement),
    after.announcement.replace(/\s+/g, " ").slice(0, 80) || "nothing announced"
  );
  /* ═══ THIS CHECK IS INVERTED, AND THE INVERSION IS THE PHASE (§2.8) ═══
     It asserted the flag STAYED in the queue: "escalating is when it stopped
     being handled", so resolving it would have filed it as handled. §2.8
     links the flag to the record instead, where it renders in full — so it
     has not stopped being handled, it has moved to where the handling is, and
     leaving it in the queue would ask for a second disposition on an incident
     already being worked. */
  check(
    "escalate.leaves-the-queue",
    "and the flag leaves the queue, because it is attached to the record now",
    (await rowText(page)).length === beforeRows - 1,
    `${beforeRows} rows before, ${(await rowText(page)).length} after`
  );
  await context.close();
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
// 6 · COVERAGE — THE WHOLE SECTION IS GONE (addendum §2.2)
// ═══════════════════════════════════════════════════════════════════════════
//
// It held six checks over three fixtures: that the header stated coverage as
// progress against a period rather than as a remainder, that the view listed
// supervised conversations with the unreviewed first, that reviewing a flag
// credited its teen, and that the destination took the full width with no
// empty pane beside it. Coverage IS Chat now and none of it has a subject.
//
// NOT RETARGETED, DELETED — and the distinction matters, because this file's
// own rule is that a check whose subject moved gets retargeted with the move
// named rather than relaxed. Nothing moved: the chat view these conversations
// now live in is existing work with its own probes (`chat-thread`,
// `chat-shell`), and pointing coverage's assertions at it would be inventing a
// claim about a surface this phase did not build.
//
// THE ONE IDEA WORTH CARRYING FORWARD is that progress is never expressed as a
// count of what is LEFT. §2.11 puts a progress track back on Risk Flags and
// Care Reviews, measuring flags reviewed, and that rule is asserted there.

// ═══════════════════════════════════════════════════════════════════════════
// 6b · THE TWO AXES (Phase 5, narrowed by addendum §2.1)
// ═══════════════════════════════════════════════════════════════════════════
//
// The unit tests own the axes' MODEL — only a disposition closes an event, the
// escalate value does not resolve, the two arrays share no id. What only the DOM
// can answer is WHERE each axis renders, and that is where Phase 5 found two
// defects: the accuracy axis on events no classifier produced, and a shortcut
// sheet teaching those keys on the destination where they do nothing.
{
  /* ═══ IT RAN OVER TWO DESTINATIONS AND NOW RUNS OVER ONE ═══
     Phase 5 asserted the accuracy axis was ABSENT on a practice event, because
     the five rules are deterministic and there was no classifier to judge.
     Phase 8 gave that destination an axis 2 with a different producer — the
     rule's provisional THRESHOLD — so the claim became "the second axis asks
     about this subject's own producer", checked in both directions.
     MENTOR PRACTICE IS GONE, so the second case goes. The both-directions check
     STAYS, and it is not vestigial: it is what would catch a threshold question
     reappearing on a classifier's pane, and the words it forbids are exactly
     the ones this codebase has already written once. */
  /* ONE ROW, AND IT STAYS A TABLE. The loop shape survives the second case so
     that adding a review subject back is a row rather than a rewrite — and so
     the "not the other's" half of every assertion keeps its second vocabulary
     to name. */
  const cases = [
    ["risk-flags", "/app/risk-flags", "normal-day", "Classifier accuracy", "Rule threshold", "Clinical disposition", "What you did"],
  ];
  for (const [name, url, scenario, ownsAxis2, otherAxis2, ownsAxis1, otherAxis1] of cases) {
    const { context, page } = await open(`axes-${name}`, { scenario, url });
    await page.waitForTimeout(900);
    await page.locator('[role="treeitem"]').first().click();
    await page.waitForTimeout(500);
    const seen = await page.evaluate(() => {
      const pane = document.querySelector('[data-slot="event-pane"]');
      const groups = [
        ...(pane?.querySelectorAll('[role="radiogroup"]') ?? []),
      ].map((g) => g.getAttribute("aria-label") ?? "");
      return {
        rows: document.querySelectorAll('[role="treeitem"]').length,
        groups,
        disposition: groups.length >= 2,
        /* ═══ THE VALUES, NOT ONLY THE HEADINGS ═══
           A mutation run changed `RULE_FEEDBACK_VALUES`' first label from
           "Threshold looks right" to "Classifier was right" and every check
           passed: `own-axis2` reads the radiogroup's `aria-label` (built from a
           separate `name`) and `sheet-matches` reads the shortcut sheet (built
           from a separate row list). Neither looked at what the buttons SAY. So
           the axis could have offered classifier wording under a threshold
           heading and nothing would have noticed. */
        axisLabels: [
          ...(pane?.querySelectorAll('[role="radiogroup"] [role="radio"]') ?? []),
        ].map((b) => (b.textContent ?? "").trim()),
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
    const labels = seen.groups.join(" | ");
    check(
      `axes.${name}.own-axis1`,
      "axis 1 names this subject's own question",
      labels.includes(ownsAxis1) && !labels.includes(otherAxis1),
      labels || "no radiogroups"
    );
    check(
      `axes.${name}.own-axis2`,
      "and axis 2 names this subject's own producer, not the other's",
      labels.includes(ownsAxis2) && !labels.includes(otherAxis2),
      labels || "no radiogroups"
    );
    /* AND THE PRIMARY'S NOUN FOLLOWS THE AXIS. "Disposition" is the clinical
       word and the practice hint deliberately avoids it, so a primary keeping it
       would put the rejected vocabulary on the loudest element in the pane. */
    const primary = await page.evaluate(
      () =>
        document
          .querySelector('[data-slot="event-pane"] [data-action="record"]')
          ?.textContent?.trim() ?? ""
    );
    /* ═══ THE PRIMARY IS THE COMMIT NOW, AND ITS NOUN IS THE ACT (§2.8) ═══
       It read "Record disposition" — the noun of the axis above it — and the
       check asserted that the noun followed the axis. Splitting the control
       changed what the button IS: the disposition is the what, this is the
       commit, and "Mark reviewed" names the commit rather than restating the
       question. */
    check(
      `axes.${name}.primary-is-the-commit`,
      "and the primary names the commit rather than restating the axis",
      primary === "Mark reviewed",
      primary || "no primary"
    );
    /* THE HEADING AND THE BUTTONS MUST AGREE. Asserted on the word each subject
       owns — "threshold" for a rule, "classifier" for a model — because the
       heading is built from one string and the buttons from another array, and
       the mutation run proved they can diverge silently. */
    const ownWord = ownsAxis2 === "Rule threshold" ? "threshold" : "classifier";
    const otherWord = ownWord === "threshold" ? "classifier" : "threshold";
    const axis2Buttons = seen.axisLabels.filter((t) =>
      /right|wrong/i.test(t)
    );
    check(
      `axes.${name}.axis2-values-agree`,
      "and its buttons say the same thing its heading does",
      axis2Buttons.length === 2 &&
        axis2Buttons.every((t) => t.toLowerCase().includes(ownWord)) &&
        !axis2Buttons.some((t) => t.toLowerCase().includes(otherWord)),
      axis2Buttons.join(" · ") || "no axis-2 buttons"
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
      "and the sheet teaches this destination's own axis-2 keys",
      sheet.includes(ownsAxis2 === "Rule threshold" ? "Threshold looks right" : "Classifier was right") &&
        !sheet.includes(ownsAxis2 === "Rule threshold" ? "Classifier was right" : "Threshold looks right"),
      /* THE DETAIL REPORTS THE MEASUREMENT, NOT THE EXPECTATION. First version
         printed `wantAccuracy ? "taught" : "not taught"` — so a mutation run
         that made the sheet teach the keys on Mentor Practice failed with the
         message "not taught", sending the reader to look for the opposite of the
         defect. A failure detail that restates the assertion is worse than
         none. */
      sheet
        .split("\n")
        .filter((l) => /right|wrong/i.test(l))
        .join(" · ") || "teaches no axis-2 key"
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

// ═══════════════════════════════════════════════════════════════════════════
// 6d · EVERY DESTINATION'S HEADER STATES ITS OWN CLOCKS (Phase 7, gap 406)
// ═══════════════════════════════════════════════════════════════════════════
//
// One subtitle rendered on all four destinations, so the flag queue led with
// another destination's acknowledgement clocks. Checked per destination, and
// checked in BOTH directions — that each owns its clause and that it does not
// carry a neighbour's — because a check for absence alone passes on a header
// that says nothing at all.
//
// ═══ RETARGETED ONTO THE SHARED HEADER (addendum §2.10) ═══
//
// There is no subtitle. §2.10 split what that line was doing into two things
// it was conflating: a PURPOSE that does not change with the data, and METRICS
// that do. The bleed this section exists to catch is still possible and still
// worth catching — it just has two places to happen now, so both are read and
// both directions are kept.
{
  const CASES = [
    ["escalations", "/app/escalations", /incident|close-out|active/i, /pipeline|flag was raised/i],
    ["risk-flags", "/app/risk-flags", /pipeline|flag was raised|oldest/i, /close-out|acknowledgement|active/i],
  ];
  for (const [name, url, owns, borrows] of CASES) {
    const { context, page } = await open(`hdr-own-${name}`, {
      scenario: "classifier-degraded",
      url,
    });
    await page.waitForTimeout(800);
    /* THE PURPOSE AND THE METRICS TOGETHER — the bleed can happen in either,
       and reading only one would let a neighbour's clause move into the other
       and pass. */
    const header = await page.evaluate(
      () =>
        (
          document.querySelector('[data-anno-ref="page-header"]')?.innerText ?? ""
        ).replace(/\s+/g, " ")
    );
    check(
      `hdr.own.${name}.input`,
      "the header rendered a title, a purpose and its metrics",
      header.length > 40,
      header.slice(0, 110)
    );
    check(
      `hdr.own.${name}.states-its-own`,
      "it states what this destination owns",
      owns.test(header),
      header.slice(0, 130)
    );
    check(
      `hdr.own.${name}.borrows-none`,
      "and does not carry a neighbour's",
      !borrows.test(header),
      borrows.test(header)
        ? `found a neighbour's clause: ${header.slice(0, 110)}`
        : "clean"
    );
    await context.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6c AND 7 — COVERAGE AS A ROUTE, AND MENTOR PRACTICE (both gone)
// ═══════════════════════════════════════════════════════════════════════════
//
// 6c checked Coverage as a ROUTE rather than as contents: that it took the
// full width with no empty detail pane beside it, that its rows were one
// height so the list read as a roster, that it offered no row control — a
// credit that fires without leaving being a fabricated measurement — and that
// its shortcut sheet taught one key rather than five that did nothing.
//
// 7 checked Mentor Practice: that the destination held only practice events,
// that it offered no dead chip row, that a row named the rule and its measure,
// that the pane said what the measure was taken against, and that a STUBBED
// event stated on its face that nothing had computed it.
//
// Both destinations are removed (§2.2, §2.1), so both blocks go.
//
// ═══ ONE CHECK FROM SECTION 7 IS WORTH ITS OWN LINE, BECAUSE IT WAS A RULE ═══
//
// `practice.stub-says-so`. The standing rule it enforced — a producer that
// cannot measure must say so rather than imply a measurement — outlives the
// surface it was written for. There is nothing on Monitoring making a claim of
// that shape today; the flag pane's classifier rationale is the nearest, and
// it is already covered by `disposition.*`. Recorded here so the rule is not
// lost with the block that happened to hold it.

// ═══════════════════════════════════════════════════════════════════════════
// 7 · ONE ROW PER CONVERSATION (addendum §3.1)
// ═══════════════════════════════════════════════════════════════════════════
//
// The unit tests own the grouping's MODEL — which member answers each of the
// comparator's five keys, all four mutation-tested. What only the DOM can
// answer is whether the row a supervisor reads describes the set it stands
// for, which is where the defect was: three separate Marcus L. rows, each
// reading "3 in this conversation".
{
  const { context, page } = await open("coalesce", { scenario: "flag-repeat-pattern" });
  await page.waitForTimeout(900);
  const rows = await page.locator('[role="treeitem"]').evaluateAll((els) =>
    els.map((e) => ({
      n: Number(e.getAttribute("data-flag-count") ?? 0),
      text: (e.innerText || "").replace(/\s+/g, " ").trim(),
      name: (e.getAttribute("aria-label") || "").replace(/\s+/g, " "),
    }))
  );
  check(
    "coalesce.input",
    "the fixture renders a queue, and one of its rows stands for several flags",
    rows.length > 0 && rows.some((r) => r.n > 1),
    `${rows.length} row(s), largest set ${Math.max(0, ...rows.map((r) => r.n))}`
  );
  /* ═══ THE DEFECT, AS AN ASSERTION ═══
     Two rows for one conversation is the un-coalesced state. Identity is the
     teen-and-mentor pair as the row prints it, because that is what a reader
     compares — the conversation id is not on screen. */
  const leads = rows.map((r) => r.text.split(" · ")[0]);
  const dupes = leads.filter((l, i) => leads.indexOf(l) !== i);
  check(
    "coalesce.one-row-each",
    "no conversation appears twice in the queue",
    dupes.length === 0,
    dupes.length ? `repeated: ${[...new Set(dupes)].join(" · ")}` : `${leads.length} distinct`
  );
  /* ═══ AND THE COUNT DESCRIBES THE ROW IT IS ON ═══
     The marker said "3 in this conversation" on a row standing for one flag.
     Checked against `data-flag-count`, which is the row's own set size. */
  const wrong = rows.filter((r) => {
    const m = r.text.match(/(\d+) in this conversation/);
    return m ? Number(m[1]) !== r.n : r.n > 1 && r.n >= 2;
  });
  check(
    "coalesce.count-matches-row",
    "and where a row states a count, it is that row's own",
    wrong.length === 0,
    wrong.length
      ? wrong.map((r) => `says ${r.text.match(/(\d+) in this/)?.[1]}, holds ${r.n}`).join(" · ")
      : rows.filter((r) => r.n > 1).map((r) => `${r.n} flags`).join(" · ") || "no multi-flag rows"
  );
  check(
    "coalesce.name-says-set",
    "a multi-flag row says so in its accessible name, not only in a marker",
    rows.filter((r) => r.n > 1).every((r) => /\d+ flags in this conversation/.test(r.name)),
    rows.find((r) => r.n > 1)?.name.slice(0, 110) ?? "no multi-flag row"
  );

  /* ═══ THE PANE MOVES WITHIN THE CONVERSATION ═══
     A row standing for three flags is only honest if all three are reachable. */
  await page.locator('[role="treeitem"][data-flag-count="3"]').first().click();
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => ({
    pos: document.querySelector("[data-within-conversation]")?.getAttribute("data-within-conversation") ?? null,
    steps: document.querySelectorAll("[data-within-step]").length,
  }));
  check(
    "coalesce.stepper",
    "the pane states which flag of the set it is showing",
    before.pos === "1/3" && before.steps === 2,
    `position ${before.pos} · ${before.steps} step control(s)`
  );
  await page.locator('[data-within-step="1"]').click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    pos: document.querySelector("[data-within-conversation]")?.getAttribute("data-within-conversation") ?? null,
  }));
  check(
    "coalesce.stepper-moves",
    "and stepping shows the next one",
    after.pos === "2/3",
    `${before.pos} → ${after.pos}`
  );
  await context.close();
}

/* ═══ A DISPOSITION DOES NOT SURVIVE A CHANGE OF SUBJECT ═══
   FOUND WHILE WIRING §3.1, and it predates it: the pane's axis state is
   `useState` and nothing reset it between events, so picking "No clinical
   concern" on one teen's flag left the radio CHECKED on the next teen's. The
   unit tests assert nothing is pre-selected; they cannot see this, because
   the model was never wrong — the component's lifetime was.
   THE FIX IS A KEY on the pane, and this is the check that would catch its
   removal. */
{
  const { context, page } = await open("pane-reset", { scenario: "normal-day" });
  await page.waitForTimeout(900);
  const rows = page.locator('[role="treeitem"]');
  const n = await rows.count();
  await rows.first().click();
  await page.waitForTimeout(300);
  await page.locator("[data-disposition]").first().click();
  await page.waitForTimeout(200);
  const picked = await page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="event-pane"] [role="radio"][aria-checked="true"]')]
      .map((e) => e.getAttribute("data-disposition"))
  );
  check(
    "pane.reset-input",
    "a disposition was selectable, so the check below has something to clear",
    n > 1 && picked.length === 1,
    `${n} row(s), picked ${picked.join(",") || "nothing"}`
  );
  await rows.nth(1).click();
  await page.waitForTimeout(400);
  const carried = await page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="event-pane"] [role="radio"][aria-checked="true"]')]
      .map((e) => e.getAttribute("data-disposition") ?? e.getAttribute("data-accuracy"))
  );
  check(
    "pane.no-carried-disposition",
    "and it does not follow the reader to the next teen's flag",
    carried.length === 0,
    carried.length ? `still checked: ${carried.join(",")}` : "cleared"
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 7b · THE FOOTER SPLIT, AND THE FLAG→ESCALATION LINK (addendum §2.8)
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("footer", { scenario: "normal-day" });
  await page.waitForTimeout(900);
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(400);
  const seen = await page.evaluate(() => {
    const pane = document.querySelector('[data-slot="event-pane"]');
    const b = (sel) => {
      const el = pane?.querySelector(sel);
      return el ? { text: (el.textContent ?? "").trim(), disabled: !!el.disabled } : null;
    };
    return {
      dispositions: [...(pane?.querySelectorAll("[data-disposition]") ?? [])].map((e) =>
        (e.textContent ?? "").trim()
      ),
      record: b('[data-action="record"]'),
      escalate: b('[data-action="escalate"]'),
    };
  });
  check(
    "footer.three-dispositions",
    "the required axis offers three clinical values and no verb",
    seen.dispositions.length === 3 &&
      !seen.dispositions.some((t) => /escalat/i.test(t)),
    seen.dispositions.join(" · ") || "none"
  );
  check(
    "footer.two-ctas",
    "the commit and the action are separate controls, and NEITHER is disabled",
    seen.record?.text === "Mark reviewed" &&
      seen.escalate?.text === "Escalate now" &&
      !seen.record.disabled &&
      !seen.escalate.disabled,
    `${seen.record?.text ?? "no commit"} / ${seen.escalate?.text ?? "no action"}`
  );
  /* ═══ NOT DISABLED, SO PRESSING IT HAS TO SAY WHY ═══
     §2.8 is explicit that the primary is not disabled: a disabled button
     announces nothing and gives no reason. The obligation that creates is
     this one — the refusal has to be legible AND nothing may resolve. */
  const rowsBefore = await page.locator('[role="treeitem"]').count();
  await page.locator('[data-action="record"]').click();
  await page.waitForTimeout(350);
  const refused = await page.evaluate(() => ({
    hint: document.querySelector("#disposition-hint")?.textContent ?? null,
    rows: document.querySelectorAll('[role="treeitem"]').length,
  }));
  check(
    "footer.ungated-press-explains",
    "pressing the commit with no disposition explains itself and closes nothing",
    !!refused.hint && refused.rows === rowsBefore,
    `${refused.hint ?? "no hint"} · rows ${rowsBefore} → ${refused.rows}`
  );
  await context.close();
}

/* ═══ AXIS 2 ASKS ABOUT A CLASSIFIER, SO IT GOES WHERE ONE DID NOT RUN ═══
   `flag-user-reported` exists for this check: every other fixture is
   classifier-only, so the rule would otherwise be asserted over an empty set.
   THE FIRST VERSION OF THE GATE NEVER FIRED — it compared `reportedBy`
   against `"user-report"`, a value the field cannot hold — and this is the
   check that found it. */
{
  const { context, page } = await open("user-reported", { scenario: "flag-user-reported" });
  await page.waitForTimeout(900);
  const rows = await page.locator('[role="treeitem"]').count();
  const reads = [];
  for (let i = 0; i < rows; i += 1) {
    await page.locator('[role="treeitem"]').nth(i).click();
    await page.waitForTimeout(260);
    reads.push(
      await page.evaluate(() => {
        const pane = document.querySelector('[data-slot="event-pane"]');
        const text = (pane?.innerText ?? "").toLowerCase();
        return {
          axis2: (pane?.querySelectorAll("[data-accuracy]") ?? []).length,
          person: text.includes("reported by a person"),
          classifier: text.includes("classifier rationale"),
        };
      })
    );
  }
  const person = reads.filter((r) => r.person);
  const model = reads.filter((r) => r.classifier);
  check(
    "axis2.input",
    "the queue holds both a classifier flag and a person's report",
    person.length > 0 && model.length > 0,
    `${person.length} reported by a person · ${model.length} by the classifier`
  );
  check(
    "axis2.suppressed-for-people",
    "a flag a person raised does not ask whether the classifier was right",
    person.every((r) => r.axis2 === 0),
    person.map((r) => `${r.axis2} control(s)`).join(" · ") || "no person-reported flag"
  );
  check(
    "axis2.present-for-the-classifier",
    "and a flag the classifier raised still does",
    model.every((r) => r.axis2 === 2),
    model.map((r) => `${r.axis2} control(s)`).join(" · ") || "no classifier flag"
  );
  await context.close();
}

/* ═══ ESCALATING LINKS THE FLAG AND TAKES IT OUT OF THE QUEUE ═══ */
{
  const { context, page } = await open("escalate-links", { scenario: "normal-day" });
  await page.waitForTimeout(900);
  const before = await page.locator('[role="treeitem"]').count();
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-action="escalate"]').click();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const sec = document.querySelector('[data-anno-ref="escalation-linked-flags"]');
    return {
      rows: document.querySelectorAll('[role="treeitem"]').length,
      linked: document.querySelectorAll("[data-linked-flag]").length,
      text: (sec?.innerText ?? "").replace(/\s+/g, " ").slice(0, 160),
    };
  });
  check(
    "link.leaves-the-queue",
    "escalating a flag takes it out of the queue rather than leaving it to be dispositioned twice",
    after.rows === before - 1,
    `${before} → ${after.rows} row(s)`
  );
  check(
    "link.renders-inside-the-record",
    "and it renders inside the record with its evidence intact",
    after.linked === 1 &&
      /Playbook match/.test(after.text) &&
      /Classifier rationale/.test(after.text),
    after.text || "no linked-flag section"
  );
  /* ═══ THE PICKER'S ONLY REACHABLE STATE IN THESE FIXTURES ═══
     Every flag on a teen is on that teen's ONE conversation — `objectId` is
     the teen id throughout the seed — so the interim auto-link rule has
     already claimed anything the picker could offer. The case it exists for
     (a flag on the teen's OTHER thread) needs a fixture with two
     conversations per teen, which the data model does not currently express.
     Reported rather than faked: what is checkable is that the empty state
     names its scope instead of reading as a broken list. */
  await page.locator('[data-action="attach-flag"]').click();
  await page.waitForTimeout(300);
  const picker = await page.evaluate(() => {
    const sec = document.querySelector('[data-anno-ref="escalation-linked-flags"]');
    return {
      options: sec?.querySelectorAll("[data-attach]").length ?? 0,
      text: (sec?.innerText ?? "").replace(/\s+/g, " "),
    };
  });
  check(
    "link.picker-states-its-scope",
    "the attach picker names what it searched when it finds nothing",
    picker.options > 0 || /No other open flags on \w/.test(picker.text),
    picker.options > 0
      ? `${picker.options} attachable flag(s)`
      : picker.text.slice(0, 120)
  );
  await context.close();
}

/* ═══ THE KEYBOARD PATH IS ONE KEYSTROKE, AND ONLY WHERE IT SHOULD BE ═══ */
{
  const { context, page } = await open("digits", { scenario: "normal-day" });
  await page.waitForTimeout(900);
  const before = await page.locator('[role="treeitem"]').count();
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(300);
  await page.keyboard.press("1");
  await page.waitForTimeout(800);
  const afterResolve = await page.locator('[role="treeitem"]').count();
  check(
    "keys.digit-commits",
    "a digit selects a disposition AND commits it, in one keystroke",
    afterResolve === before - 1,
    `${before} → ${afterResolve} row(s)`
  );
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(300);
  await page.keyboard.press("3");
  await page.waitForTimeout(800);
  const watch = await page.evaluate(() => ({
    rows: document.querySelectorAll('[role="treeitem"]').length,
    checked: [...document.querySelectorAll('[data-slot="event-pane"] [role="radio"][aria-checked="true"]')].map(
      (e) => e.getAttribute("data-disposition")
    ),
  }));
  check(
    "keys.watch-does-not-close",
    "and the watch value records itself without closing anything",
    watch.rows === afterResolve && watch.checked.includes("watching"),
    `${afterResolve} → ${watch.rows} row(s) · checked ${watch.checked.join(",") || "nothing"}`
  );
  /* THE SHEET HAS TO SAY THAT. A row reading "Watching — not resolved — and
     mark reviewed" teaches that the key closes an event the value keeps
     open, which is what the first version printed. */
  await page.keyboard.press("?");
  await page.waitForTimeout(400);
  const sheet = await page.evaluate(
    () => document.querySelector('[role="dialog"]')?.innerText ?? ""
  );
  check(
    "keys.sheet-teaches-the-effect",
    "the sheet distinguishes the keys that close from the one that does not",
    /Watching — not resolved(?! — and mark reviewed)/.test(sheet) &&
      /No clinical concern — and mark reviewed/.test(sheet) &&
      /Open an escalation from this flag/.test(sheet),
    sheet
      .split("\n")
      .filter((l) => /mark reviewed|Watching|escalation/.test(l))
      .join(" · ") || "teaches none of them"
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 7c · THE TRANSCRIPT SCROLLS, AND IT DOES NOT JUMP (addendum §2.7)
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("transcript", { scenario: "normal-day" });
  const BODY = '[data-slot="event-pane"] .overflow-y-auto';
  await page.waitForTimeout(900);
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(700);

  /* ═══ ONE REGION IN THE PANE, AND IT IS THE TRANSCRIPT ═══
     `structure.two-scrollers` already counts the page's regions. This is the
     narrower claim §2.7 makes: nothing nests INSIDE the pane. */
  const nested = await page.evaluate(() => {
    const pane = document.querySelector('[data-slot="event-pane"]');
    return [...(pane?.querySelectorAll("*") ?? [])].filter((e) => {
      const oy = getComputedStyle(e).overflowY;
      return oy === "auto" || oy === "scroll";
    }).length;
  });
  check(
    "transcript.one-region",
    "the pane has exactly one scroll region and the transcript is in it",
    nested === 1,
    `${nested} scrollable element(s) inside the pane`
  );

  /* ═══ SCROLL ANCHORING, MEASURED AGAINST A MARKED LINE ═══
     The arithmetic is the whole check: a line is marked while the transcript
     is parked ABOVE the load threshold, the reader then scrolls 160px up,
     which crosses it — so the line must move exactly 160px and not one pixel
     more. The first implementation moved it 1400. */
  await page.evaluate((B) => {
    document.querySelector(B).scrollTop = 200;
  }, BODY);
  await page.waitForTimeout(400);
  const mark = await page.evaluate((B) => {
    const b = document.querySelector(B);
    const r = b.getBoundingClientRect();
    const li = [...b.querySelectorAll("li")].find(
      (e) => e.getBoundingClientRect().top >= r.top - 2
    );
    if (!li) return null;
    li.setAttribute("data-watch", "1");
    return {
      offset: Math.round(li.getBoundingClientRect().top - r.top),
      n: b.querySelectorAll("li").length,
    };
  }, BODY);
  await page.evaluate((B) => {
    document.querySelector(B).scrollTop = 40;
  }, BODY);
  await page.waitForTimeout(1100);
  const moved = await page.evaluate((B) => {
    const b = document.querySelector(B);
    const li = b.querySelector("[data-watch]");
    if (!li) return null;
    return {
      offset: Math.round(li.getBoundingClientRect().top - b.getBoundingClientRect().top),
      n: b.querySelectorAll("li").length,
    };
  }, BODY);
  check(
    "transcript.loads-older",
    "scrolling to the top loads older messages",
    !!mark && !!moved && moved.n > mark.n,
    mark && moved ? `${mark.n} → ${moved.n} message(s)` : "could not mark a line"
  );
  check(
    "transcript.anchored",
    "and the reader's line moves only by the amount they scrolled",
    !!mark && !!moved && Math.abs(moved.offset - mark.offset - 160) <= 4,
    mark && moved
      ? `the watched line moved ${moved.offset - mark.offset}px; the reader scrolled 160`
      : "could not measure"
  );

  /* ═══ THE RETURN CONTROL APPEARS ONLY WHEN IT HAS SOMEWHERE TO GO ═══ */
  await page.evaluate((B) => {
    document.querySelector(B).scrollTop = 0;
  }, BODY);
  await page.waitForTimeout(700);
  const away = await page.evaluate(
    () => document.querySelector("[data-return-to-flag]")?.getAttribute("data-return-to-flag") ?? null
  );
  check(
    "transcript.return-names-its-direction",
    "with the flagged message off screen, the control says which way it is",
    away === "below" || away === "above",
    away ?? "no control"
  );
  if (away) {
    await page.locator("[data-return-to-flag]").click();
    await page.waitForTimeout(900);
    const back = await page.evaluate(() => ({
      pill: document.querySelector("[data-return-to-flag]") ? "still there" : "gone",
      visible: (() => {
        const b = document.querySelector('[data-slot="event-pane"] .overflow-y-auto');
        const li = b?.querySelector("[data-anno-ref], li");
        const flagged = [...(b?.querySelectorAll("li") ?? [])].find((e) =>
          (e.textContent ?? "").includes("Flagged message")
        );
        if (!b || !flagged) return "no flagged line";
        const r = b.getBoundingClientRect();
        const f = flagged.getBoundingClientRect();
        void li;
        return f.top >= r.top - 2 && f.bottom <= r.bottom + 2 ? "in view" : "out of view";
      })(),
    }));
    check(
      "transcript.return-goes-there",
      "and pressing it puts the flagged message back on screen, which dismisses it",
      back.visible === "in view" && back.pill === "gone",
      `${back.visible} · control ${back.pill}`
    );
  }
  await context.close();
}

/* ═══ THE EDGE MARKER STOPS PROMISING WHAT IS NOT COMING ═══
   It read "Earlier messages not shown" unconditionally, which is true of a
   window and a lie at the beginning of a conversation. */
{
  const { context, page } = await open("transcript-start", { scenario: "normal-day" });
  const BODY = '[data-slot="event-pane"] .overflow-y-auto';
  await page.waitForTimeout(900);
  await page.locator('[role="treeitem"]').first().click();
  await page.waitForTimeout(700);
  const edge = () =>
    page.evaluate((B) => {
      const b = document.querySelector(B);
      return (
        [...(b?.querySelectorAll("p") ?? [])]
          .map((e) => e.innerText)
          .find((t) => /earlier|start of this/i.test(t)) ?? null
      );
    }, BODY);
  const opening = await edge();
  for (let i = 0; i < 6; i += 1) {
    await page.evaluate((B) => {
      document.querySelector(B).scrollTop = 0;
    }, BODY);
    await page.waitForTimeout(420);
  }
  const atStart = await edge();
  check(
    "transcript.edge-is-honest",
    "the edge marker says more is coming, then says this is the beginning",
    /as you scroll/i.test(opening ?? "") && /start of this conversation/i.test(atStart ?? ""),
    `opened with "${opening ?? "nothing"}" · ended with "${atStart ?? "nothing"}"`
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 7d · ONE HEADER, AND A TRACK THAT MEASURES COVERAGE (addendum §2.10, §2.11)
// ═══════════════════════════════════════════════════════════════════════════
{
  /* ═══ EVERY DESTINATION, INCLUDING THE ONES THIS FILE DOES NOT OWN ═══
     §2.10's claim is that ONE component serves them all, and a check that
     only looked at Monitoring's two could not tell a shared header from a
     fourth copy of one. */
  const DESTINATIONS = [
    ["/app/today", 0],
    ["/app/escalations", 2],
    ["/app/risk-flags", 2],
    ["/app/care-reviews", 2],
    ["/app/team", 1],
    ["/app/mentees", 1],
  ];
  const seen = [];
  for (const [url, wantMetrics] of DESTINATIONS) {
    const { context, page } = await open(`hdr${url}`, { url });
    await page.waitForTimeout(900);
    seen.push({
      url,
      wantMetrics,
      ...(await page.evaluate(() => {
        const h = document.querySelector('[data-anno-ref="page-header"]');
        if (!h) return { present: false };
        const title = h.querySelector("h1");
        return {
          present: true,
          titlePx: title ? Number(getComputedStyle(title).fontSize.replace("px", "")) : 0,
          purpose: (h.querySelector('[data-anno-ref="page-purpose"]')?.innerText ?? "").trim(),
          metrics: [...h.querySelectorAll("[data-metric-value]")].map((e) => ({
            value: (e.innerText ?? "").trim(),
            label: e.getAttribute("data-metric-value") ?? "",
            tabular: getComputedStyle(e).fontVariantNumeric.includes("tabular"),
          })),
        };
      })),
    });
    await context.close();
  }
  check(
    "header.shared",
    "every destination renders the one header component",
    seen.every((d) => d.present),
    seen.filter((d) => !d.present).map((d) => d.url).join(", ") || `${seen.length} destinations`
  );
  check(
    "header.one-title-size",
    "and one title size across all of them",
    new Set(seen.map((d) => d.titlePx)).size === 1 && seen[0].titlePx >= 28,
    [...new Set(seen.map((d) => `${d.titlePx}px`))].join(" / ")
  );
  check(
    "header.purpose-everywhere",
    "each one says what the destination is for, in a sentence",
    seen.every((d) => d.purpose.length > 25),
    seen.map((d) => `${d.url}: ${d.purpose.length}`).join(" · ")
  );
  check(
    "header.metric-count",
    "with the metrics §2.10 names — at most two, and none on Today",
    seen.every((d) => d.metrics.length === d.wantMetrics),
    seen.map((d) => `${d.url} ${d.metrics.length}/${d.wantMetrics}`).join(" · ")
  );
  check(
    "header.metrics-tabular",
    "and every figure is tabular, so the column does not jitter as it changes",
    seen.every((d) => d.metrics.every((m) => m.tabular)),
    seen.flatMap((d) => d.metrics.map((m) => `${m.value} ${m.label}`)).join(" · ") || "no metrics"
  );
  /* ═══ NO METRIC MAY FRAME WORK AS AN INBOX TO EMPTY (§2.10) ═══
     A remainder — "left", "remaining", "to go" — is the framing this whole
     restructure exists to escape, and the coverage view's own rule before it
     became Chat. Asserted over the labels rather than trusted to review. */
  const labels = seen.flatMap((d) => d.metrics.map((m) => m.label.toLowerCase()));
  check(
    "header.no-remainder",
    "and no metric counts what is LEFT",
    labels.every((l) => !/\b(left|remaining|to go|outstanding)\b/.test(l)),
    labels.join(" · ") || "no labels"
  );
}

/* ═══ THE TRACK MEASURES COVERAGE, NEVER SPEED (§2.11, §3.4) ═══
   The clinical risk in a completion mechanic is that it rewards throughput,
   and the failure mode here is a supervisor dispositioning faster to finish
   the bar — on a queue of self-harm flags. So the checks are about what the
   track MAY NOT say as much as what it does. */
{
  const { context, page } = await open("track", { scenario: "flag-repeat-pattern" });
  await page.waitForTimeout(900);
  const read = () =>
    page.evaluate(() => {
      const t = document.querySelector('[data-anno-ref="shift-track"]');
      if (!t) return null;
      const fill = t.querySelector('[role="img"] > div');
      const cs = fill ? getComputedStyle(fill) : null;
      return {
        progress: t.getAttribute("data-progress"),
        complete: t.getAttribute("data-complete"),
        text: (t.innerText ?? "").replace(/\s+/g, " ").trim(),
        name: t.querySelector('[role="img"]')?.getAttribute("aria-label") ?? "",
        fill: cs?.backgroundColor ?? "",
        width: fill?.style.width ?? "",
        segments: t.querySelectorAll('[role="img"] > div').length,
      };
    });
  const start = await read();
  check(
    "track.present",
    "the flag queue carries a shift track",
    !!start && /^0\//.test(start.progress ?? ""),
    start ? `${start.progress} · "${start.text}"` : "no track"
  );
  check(
    "track.one-continuous-bar",
    "one continuous track, not segments — segments read as points scored",
    start?.segments === 1,
    `${start?.segments} fill element(s)`
  );
  /* ═══ NEVER GREEN ═══
     Green on a safety surface reads as a clinical all-clear rather than as
     task completion. Measured off the fill, not asserted of the token. */
  const rgb = (start?.fill ?? "").match(/\d+/g)?.map(Number) ?? [];
  check(
    "track.never-green",
    "and it is never green",
    rgb.length >= 3 && !(rgb[1] > rgb[0] + 20 && rgb[1] > rgb[2] + 20),
    start?.fill || "no fill"
  );
  check(
    "track.states-no-remainder",
    "it states progress with its unit, never a count of what is left",
    !!start && !/\b(left|remaining|to go)\b/i.test(start.text) && /of/.test(start.text),
    start?.text ?? "no text"
  );
  /* ═══ AND NOTHING IN IT IS A CLOCK (§3.4) ═══
     No elapsed time, no rate, no streak, no per-item timing, no comparison.
     Every one of those rewards going faster; coverage rewards going through. */
  check(
    "track.no-speed",
    "and says nothing about speed — no rate, no streak, no elapsed time",
    !!start &&
      !/(per hour|\/hr|streak|avg|average|faster|\bmin\b|\bsec\b)/i.test(start.text + " " + start.name),
    `${start?.text} | ${start?.name}`
  );
  check(
    "track.name-carries-the-fraction",
    "and the bar is never the only carrier — the fraction is in its name",
    /\d+ of \d+/.test(start?.name ?? ""),
    start?.name ?? "no accessible name"
  );

  /* ═══ THE ENDING IS THE PAYOFF, AND IT IS REACHABLE ═══
     §3.4 invests in the completion state rather than the filling. A state
     nothing in the product can reach is a state nobody has designed. */
  const rows = await page.locator('[role="treeitem"]').count();
  for (let i = 0; i < rows + 2; i += 1) {
    if ((await page.locator('[role="treeitem"]').count()) === 0) break;
    await page.locator('[role="treeitem"]').first().click();
    await page.waitForTimeout(180);
    await page.keyboard.press("1");
    await page.waitForTimeout(420);
  }
  const end = await read();
  check(
    "track.completion-is-reachable",
    "working the queue reaches the completion state",
    end?.complete === "true" && end.width === "100%",
    end ? `${end.progress} · ${end.width} · complete=${end.complete}` : "no track"
  );
  check(
    "track.completion-does-not-congratulate",
    "and it states the coverage achieved rather than praising anybody",
    !!end &&
      !/(nice|great|well done|good job|congrat|!|🎉)/i.test(end.text) &&
      /shift/.test(end.text),
    end?.text ?? "no completion line"
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
        /* ═══ AN OUTLINE *OR* A RING DRAWN FOR IT (Layout Pass §3) ═══
           NOTE: no backticks anywhere in this comment — it lives inside the
           template literal below and one would close it. Cost me a parse
           error to learn; left as a warning rather than a silent constraint.
           This read outlineWidth on the focused element alone. That covered
           every indicator in the app until the queue row's focus moved to a
           group-focus-visible ring on its inset pill — a box-shadow on a
           CHILD, because the ring has to trace the pill's rounded shape rather
           than the row's full-bleed box. Measured on the new row: the root
           reports the 1px UA outline and the pill carries a 2px ring in
           --focus-ring, so the old instrument saw 1px and called a visible
           2px ring a failure.
           IT IS WIDENED, NOT WEAKENED: still >= 2px, still required at EVERY
           stop, and zero on both channels still fails. What changed is where
           it is allowed to be drawn. */
        ring: (() => {
          /* NO BACKSLASH CLASSES IN THIS REGEX. It lives inside a template
             literal, which eats the escape: a /[\d]/ written here arrives as
             /[d]/ and the function silently returns 0 for every shadow, which
             is how the first version of this check reported 1px for a row
             drawing a visible 2px ring. [0-9.] needs no escape and cannot be
             eaten. */
          const spread = (el) => {
            const sh = getComputedStyle(el).boxShadow;
            if (!sh || sh === 'none') return 0;
            // the LAST length of each shadow is its spread — split on the
            // commas between shadows, which rgb()/rgba() also contain, so
            // strip the colour functions before splitting.
            const parts = sh.replace(/rgba?\([^)]*\)/g, '').split(',');
            let best = 0;
            for (const part of parts) {
              const lens = part.match(/-?[0-9.]+px/g);
              if (lens && lens.length) best = Math.max(best, parseFloat(lens[lens.length - 1]));
            }
            return best;
          };
          const own = parseFloat(cs.outlineWidth) || 0;
          const kids = Math.max(0, ...[...el.children].map(spread));
          return Math.max(own, spread(el), kids);
        })() }; })()`);
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
  check(
    "focus.always-visible",
    "every stop draws a focus ring — as its own outline, or as a ring on the element that carries its shape",
    seq.every((d) => d.ring >= 2),
    /* NAMES THE WORST STOP, not just the number: "min 1px" sent the last
       reader looking through thirty tab stops to find which one. */
    (() => {
      const worst = seq.reduce((a, d) => (d.ring < a.ring ? d : a), seq[0]);
      return `min ${worst.ring}px at "${worst.name || "(unnamed)"}" in ${worst.zone}`;
    })()
  );
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
        /* THE REGION *AND* THE RECORD PANE (Phase 6). This filtered to the
           region alone, so the pane controls were never measured — and they
           were 36px: the timeline two source tabs and its log-an-action button.
           Both halves of this route are the escalation surface, and HIG 44px
           applies to everything a supervisor reaches for during an incident.
           NO BACKTICKS IN HERE: this comment lives inside a template literal
           passed to page.evaluate, and one backtick ends the string. */
        if (
          !el.closest('[data-anno-ref="escalation-region"]') &&
          !el.closest('[data-slot="event-pane"]')
        )
          return null;
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
  /* ═══ RETARGETED, NOT RELAXED (Layout Pass §3, §5) ═══
     This asserted `/^56x/` — the row's height as a literal. §3 raised the row
     and §5 made the height a DENSITY, so the literal is superseded: 56 is now
     one of two correct answers and the wrong one to demand by default.
     WHAT IT ASSERTS INSTEAD IS STRICTER, not looser. The row must be EXACTLY
     the height its own `data-density` declares — which is the virtualizer's
     contract, and the one failure in `worklist.tsx` that nothing else can see:
     a row rendering 81px against a table saying 80 puts the window one pixel
     out per row and forty rows down the list selects the wrong thing. And it
     must clear HIG's 44px at either setting.
     THE TABLE IS DUPLICATED HERE ON PURPOSE. Importing `ROW_GEOMETRY` would
     make the probe agree with the app by construction — it would pass while
     both were wrong together. A second copy is what makes a change to the
     app's number show up as a failure here. */
  /* ═══ RETARGETED AGAIN — THE AXIS RENAMED (Refinement §4) ═══
     Last pass this read `data-density` against a two-value table. §4 collapsed
     density and layout into one three-step PRESET, so the attribute is
     `data-preset` and the table has three rows.
     IT CAUGHT ITS OWN SUPERSESSION, which is the point of the shape: the row
     kept rendering an exact height and the probe reported
     `density=MISSING … (no declared height for this density)` rather than
     passing on an unknown key. An assertion whose input has gone must fail
     loudly, and this one did.
     THE TABLE IS STILL DUPLICATED ON PURPOSE. Importing `ROW_GEOMETRY` would
     make the probe agree with the app by construction and pass while both were
     wrong together. And it is the PITCH, not the card height: `Cards` carries
     its gutter inside the row box, so the box a reader clicks is 92px while the
     panel drawn in it is 80. */
  const PITCH_BY_PRESET = { cards: 92, comfortable: 80, compact: 56 };
  const rowBox = await page.locator('[role="treeitem"]').first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width), preset: e.dataset.preset ?? null };
  });
  const rowExpect = PITCH_BY_PRESET[rowBox.preset];
  check(
    "targets.rows",
    "a queue row is exactly the pitch its preset declares, and clears HIG's 44px",
    rowBox.preset != null && rowBox.h === rowExpect && rowBox.h >= 44,
    /* THE OBSERVATION, INCLUDING THE INPUT. A null preset is a row that never
       got the prop, which would otherwise read as an unknown-key pass. */
    `preset=${rowBox.preset ?? "MISSING"} ${rowBox.h}x${rowBox.w}` +
      (rowExpect ? ` (declared ${rowExpect})` : " (no declared pitch for this preset)")
  );

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
        /* WAS "Volume and coverage" — coverage is Chat (§2.2) and the group
           no longer holds a coverage fixture. "Mentor practice" is gone
           entirely (§2.1), with its seven keys. */
        "Monitoring · Volume",
        "Monitoring · Escalation lifecycle",
        "Monitoring · Compliance paths",
        "Monitoring · Risk flags",
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
    /* `monitoring-header` UNTIL §2.10 — the destination renders the shared
       `PageHeader` now, and the smoke test's claim is unchanged: the fixture
       built and the page drew its top. */
    const header = await page.locator('[data-anno-ref="page-header"]').count();
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
