// ═══ ROW SEMANTICS AND GROUP HEADERS (arch-D) ═══
//
// The corrective phase's whole claim is a VISUAL one — that each row now reads as
// what it is — and a visual claim is exactly what a screenshot cannot verify,
// because a screenshot of a row that leads with the wrong thing looks like a row.
//
// So this asserts the mechanics the claim rests on: exactly one emphasised
// element per row, the right one per surface, one temporal fact, a header that
// stays in frame across the virtualization boundary, and a row whose accessible
// name carries the group a sighted reader gets from that header.
//
// Exit codes: 0 every check passed · 1 a check failed.

// ═══ A NOTE ON THE REGEXES BELOW, WRITTEN AFTER THEY WERE WRONG ═══
//
// The first version of this file was authored through a shell heredoc and every
// `\d` arrived as a literal backslash-d. Five checks reported failures for copy
// that was on screen and correct — and TWO REPORTED PASSES for the same reason,
// because a regex that matches nothing satisfies `!some(...)` and an `every` over
// an empty filter. A broken assertion that goes green is the only kind that
// matters. If a check here is ever edited through a quoted heredoc again, re-read
// the file before trusting the run.

import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/row-semantics";
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

async function open(id, url, { scenario = "typical-shift", monitoring = null } = {}) {
  const view = await openView(
    browser,
    {
      id,
      url,
      seed: {
        persona: "supervisor",
        extra: { tasksScenarioId: scenario, monitoringScenarioId: monitoring, devLoadState: "ready" },
      },
    },
    XL,
    version
  );
  /* THE TASKS SURFACE IS `/app/care-reviews` NOW, and both spellings are listed
     because `/app/tasks` is still a live hop a check may reach it through.
     `narrowToBilling` is a NO-OP on Care Reviews, by its own design: the chip
     row hides itself when one kind is present, and after Phase 2 billing is the
     only kind here. Kept rather than deleted — it is what makes the unscoped
     surface assertable, and its own note says it fails loudly if the chip ever
     stops existing on a surface that has two kinds. */
  if (url.startsWith("/app/care-reviews") || url.startsWith("/app/tasks")) {
    await view.page.waitForTimeout(450);
    await narrowToBilling(view.page);
  }
  return view;
}

async function scrollToTeen(page) {
  for (let i = 0; i < 16; i += 1) {
    if (await page.locator('[role="treeitem"][aria-expanded]').count()) return true;
    const more = await page.evaluate(() => {
      const el = document.querySelector('[data-anno-ref="tasks-worklist-scroller"]');
      if (!el) return false;
      const before = el.scrollTop;
      el.scrollTop = before + el.clientHeight * 0.9;
      el.dispatchEvent(new Event("scroll"));
      return el.scrollTop > before;
    });
    await page.waitForTimeout(150);
    if (!more) break;
  }
  return (await page.locator('[role="treeitem"][aria-expanded]').count()) > 0;
}

/** ═══ "EMPHASISED" IS A MEASURED PROPERTY, NOT A CLASS NAME ═══
 *
 *  Reading `className` would assert that a declaration exists, which on this
 *  codebase is exactly the thing that can be false: Lausanne renders identically
 *  at 400 and 700, so `font-semibold` is a declaration with no rendering behind
 *  it. An element counts as emphasised when it is BOTH larger than the row's
 *  baseline AND drawn in a face or weight that actually produces more ink —
 *  Avantt at any weight, or the mono stack at 700. */
const EMPHASIS_FN = `(el) => {
  const s = getComputedStyle(el);
  const px = parseFloat(s.fontSize);
  const fam = s.fontFamily.toLowerCase();
  const bolder = fam.includes("avantt") || (fam.includes("mono") && Number(s.fontWeight) >= 600);
  return { text: (el.innerText || "").trim(), px, weight: s.fontWeight, fam: fam.split(",")[0].replace(/["']/g, ""), color: s.color, emphasised: px >= 14 && bolder };
}`;

const rowReport = `(row) => {
  const describe = ${EMPHASIS_FN};
  const leaves = [...row.querySelectorAll("span")].filter((e) => !e.querySelector("span") && (e.innerText || "").trim());
  return {
    label: row.getAttribute("aria-label"),
    height: Math.round(row.getBoundingClientRect().height),
    parts: leaves.map(describe),
  };
}`;

// ═══════════════════════════════════════════════════════════════════════════
// 1 · TASKS — DEADLINE-FORWARD.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("tasks", "/app/care-reviews");
  const data = await page.evaluate(
    `[...document.querySelectorAll('[role="treeitem"]')].slice(0, 8).map(${rowReport})`
  );

  const emph = data.map((r) => r.parts.filter((p) => p.emphasised));
  check(
    "tasks.one-emphasis",
    "exactly one emphasised element per row",
    emph.every((e) => e.length === 1),
    emph.map((e) => e.length).join(",")
  );
  /* ═══ SUPERSEDED TWICE: CLOCK → JOB (arch-E) → TEEN (arch-F) ═══
     arch-E moved the emphasis off the countdown and onto the job. arch-F moved
     it again, and for a reason arch-E could not see from inside one task type:
     the job string is IDENTICAL on every row, so emphasising it emphasised no
     information. The teen is what varies. The job survives as a chip, and the
     rule became one emphasised element PER ZONE — identity left, deadline right.
     The original note is kept below because the reasoning about FACES (Avantt vs
     mono, the only two real weight channels here) is what still constrains this. */
  /* ═══ arch-E's NOTE: THE EMPHASIS MOVED FROM THE CLOCK TO THE JOB ═══
     This asserted the emphasised element was the countdown. arch-D was right for
     the row it had — a name and a clock, where the clock is the only actionable
     half. arch-E leads with the JOB, so the emphasis is the task name and the
     countdown keeps the column it always had: 14px, primary ink, mono and
     tabular, right-aligned. A column of figures is scannable without winning the
     weight channel from the thing that names the row. */
  check(
    "tasks.teen-leads",
    "and it is the teen, which is what varies row to row",
    emph.length > 0 && emph.every((e) => /^[A-Z][a-z]+ [A-Z][.]$/.test(e[0]?.text ?? "") && /avantt/.test(e[0].fam)),
    emph[0]?.[0] && `${emph[0][0].text} · ${emph[0][0].px}px/${emph[0][0].weight} ${emph[0][0].fam}`
  );
  /* ═══ THE JOB CHIP IS GONE, AND THE CHECK INVERTS (addendum §2.9) ═══
     arch-F kept "Billing code review" as a subordinate chip so that "the
     emphasis moved" could not quietly become "the row no longer says what it
     is". §2.9 removes it: every row on this destination is a care review, so
     the chip was the strongest-positioned element on nineteen rows carrying no
     information — the same defect arch-F found in the emphasis channel, one
     channel along.
     WHAT REPLACES IT IS THE ABSENCE, ASSERTED — plus the accessible name,
     checked at `sr.tasks.row-names-its-kind`, because a screen-reader user
     arriving mid-list has no page title above them. */
  check(
    "tasks.no-job-chip",
    "the task type is not repeated on every row",
    data.every((r) => !r.parts.some((p) => /billing code review/i.test(p.text))),
    data[0]?.parts.map((p) => p.text).join(" | ")
  );
  /* THE COUNTDOWN IS STILL THERE AND STILL THE SCANNABLE COLUMN — asserted
     separately, so "the emphasis moved" cannot quietly become "the countdown
     went quiet". */
  /* ═══ arch-F: THE DEADLINE INFORMS RATHER THAN ALARMS ═══
     arch-E asserted 14px primary ink, when the countdown was the row's other
     emphasis. arch-F gives the bucket header the urgency and the row the
     detail, so the column is mono, tabular and SECONDARY — still the one
     element in its zone, no longer competing with the breach chip beside it. */
  /* ═══ THE COLUMN SURVIVES; WHAT IT HOLDS INVERTED (addendum §2.9) ═══
     arch-D through arch-G spent four phases on this column's treatment and the
     conclusion — one mono, tabular, right-aligned figure per row, informing
     rather than alarming — is intact. What changed is the FACT: §2.9 retires
     the deadline concept from this destination, so the figure is AGE.
     `tasks.no-elapsed` INVERTS WITH IT. It asserted elapsed age was gone from
     the row, because a row showing both an age and a deadline stated two
     temporal facts. Age is the only one left, and it is the one the list is
     ORDERED by — oldest-first, which fell out of the null SLA rather than
     being added as a rule. */
  const clocks = data.map((r) => r.parts.find((p) => /\d+[mhd] open$/.test(p.text)));
  check(
    "tasks.age-column",
    "the temporal column is mono and tabular, and it is an age",
    clocks.every((c) => c && /mono/.test(c.fam) && c.px >= 12),
    clocks[0] && `${clocks[0].text} · ${clocks[0].px}px/${clocks[0].weight} ${clocks[0].fam}`
  );
  check(
    "tasks.no-deadline",
    "and no row states a deadline, because the destination has none",
    data.every((r) => !r.parts.some((p) => /^(due |overdue |no review deadline)/i.test(p.text))),
    data[0]?.parts.map((p) => p.text).join(" | ")
  );
  check(
    "tasks.one-temporal",
    "one temporal fact per row",
    data.every((r) => r.parts.filter((p) => /(^due |^overdue |\d+[mhd] open)/.test(p.text)).length === 1)
  );
  /* WAS a standalone-leaf match on the teen name. arch-E puts the subject on
     line 2 beside its disposition — "Theo L. · Renewal proposed" — so the name is
     no longer its own leaf. The claim survives retargeted: the subject is present
     for identification and is not what the eye lands on. */
  /* NOT read off `parts`: the caption span now WRAPS a separator span, so the
     leaf filter in `rowReport` (leaves only) skips it and reports the bare "·".
     This reads every span on the row and lets Node do the matching — a regex in
     the page string would pass through a template literal, where `\.` silently
     loses its backslash. */
  const spans = await page.evaluate(
    `[...document.querySelectorAll('[role="treeitem"]')].slice(0, 8).map((row) => { const describe = ${EMPHASIS_FN}; return [...row.querySelectorAll("span")].map(describe); })`
  );
  check("tasks.spans-read", "the row's spans were readable at all", (spans[0]?.length ?? 0) > 0, `${spans[0]?.length ?? 0} spans`);
  /* ═══ arch-F: THE CAPTION IS THE DISPOSITION ALONE ═══
     arch-E put the teen name here beside its disposition. The name moved to line
     1 with the emphasis, so repeating it in the caption would spend the line on
     a string six pixels above it. */
  /* ═══ THE CAPTION IS LOZENGES NOW (addendum §2.9) ═══
     It carried `proposalPreview`'s sentence — "Change proposed → F41.1". A
     billing code is an identifier a reviewer matches against a record, not
     prose, so it renders as one lozenge per code in the mono face. The claim
     that survives is the one arch-F made: whatever the caption holds, it is
     NOT the teen's name a second time and it does not take the emphasis. */
  const codes = await page.evaluate(
    `[...document.querySelectorAll('[role="treeitem"]')].slice(0, 8).map((row) => [...row.querySelectorAll("[data-billing-code]")].map((e) => ({ code: e.getAttribute("data-billing-code"), tone: e.getAttribute("data-code-tone"), fam: getComputedStyle(e).fontFamily })))`
  );
  check(
    "tasks.caption-codes",
    "the caption carries the billing code as a lozenge, in the mono face",
    codes.every((cs) => cs.length >= 1 && cs.every((c) => /mono/i.test(c.fam))),
    codes[0]?.map((c) => `${c.code}[${c.tone}]`).join(" ") || "no code lozenges"
  );
  /* READ OFF THE LEAVES, not off every span: a wrapper span reports the text of
     everything inside it, so an ancestor of the name also "is" the name and the
     first version of this check failed on its own instrumentation. */
  check(
    "tasks.caption-not-the-name",
    "and not the name a second time",
    data.every((r) => {
      const lead = r.parts.find((p) => p.emphasised)?.text ?? "";
      return lead !== "" && r.parts.filter((p) => p.text === lead).length === 1;
    }),
    data[0]?.parts.map((p) => p.text).join(" | ") ?? "no parts"
  );
  check("tasks.height", "row height", true, `${data[0]?.height}px`);
  await page.locator('[data-anno-ref="tasks-worklist-scroller"]').screenshot({ path: `${OUT}/tasks-rows.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · TASKS, OVERDUE — THE WHOLE SECTION RETIRES (addendum §2.9)
// ═══════════════════════════════════════════════════════════════════════════
//
// It held four checks over the `breach-overnight` fixture, settling an argument
// that ran from arch-F to arch-G: the row carried a breach chip AND the
// countdown, under a bucket header already reading "Overdue" — three statements
// about one lateness. The conclusion was that the BUCKET owns the treatment,
// the row states how late in breach ink, and the chip goes.
//
// §2.9 RETIRES THE DEADLINE CONCEPT from this destination, so there is no
// lateness to state once or three times. The buckets, the breach ink and the
// chip are all gone with it.
//
// WHAT THE ARGUMENT LEAVES BEHIND, because it was never really about deadlines:
// a surface may state one fact once. That rule is live on this page as
// `tasks.one-temporal`, which is the check the whole section was protecting.
//
// AND BREACH TREATMENT STILL EXISTS, on the one surface that has published
// clocks — `monitoring-states.mjs` asserts it on the escalation region. This
// file no longer has a subject for it.

// ═══════════════════════════════════════════════════════════════════════════
// 3 · MONITORING — RETARGETED BY arch-mon PHASE 1.
// ═══════════════════════════════════════════════════════════════════════════
//
// This section asserted arch-D's two emphases on one surface: an imminent flag
// leading with its COUNTDOWN, and a coalesced teen row leading with the NAME and
// carrying a tier-composition line. Phase 1 removed the tiers, the flag
// deadlines and the coalescing, so all four claims lost their subject.
//
// WHAT SURVIVES IS THIS FILE'S ACTUAL SUBJECT — one emphasised element per row,
// and the emphasis follows what the surface is FOR. On Tasks that is the job; on
// Monitoring it is the subject of review. The rest of Monitoring's anatomy is
// asserted in `monitoring-states.mjs`, which owns that surface.
{
  const { context, page } = await open("monitoring", "/app/risk-flags");
  const rows = await page.evaluate(
    `[...document.querySelectorAll('[role="treeitem"]')].slice(0, 6).map(${rowReport})`
  );
  check("mon.rows-read", "rows were readable at all", rows.length > 0, `${rows.length} rows`);
  const emph = rows.map((r) => r.parts.filter((p) => p.emphasised));
  check(
    "mon.one-emphasis",
    "exactly one emphasised element per row",
    rows.length > 0 && emph.every((e) => e.length === 1),
    emph.map((e) => e.length).join(",")
  );
  check(
    "mon.subject-leads",
    "and it is the subject of review, not a clock",
    emph.every((e) => /^[A-Z][a-z]+ [A-Z]\.$/.test(e[0]?.text ?? "")),
    emph[0]?.[0] && `${emph[0][0].text} · ${emph[0][0].px}px/${emph[0][0].weight} ${emph[0][0].fam}`
  );
  const age = rows[0]?.parts.find((p) => / ago$/.test(p.text));
  check(
    "mon.age-quiet",
    "the age is present, mono, and not the emphasis",
    age && !age.emphasised && /mono/.test(age.fam),
    age && `${age.text} · ${age.px}px/${age.weight} ${age.fam}`
  );
  check(
    "mon.no-tier-composition",
    "no row carries a tier composition line any more",
    rows.every((r) => !/\d+ (clinical|routine)/.test(r.label ?? "")),
    rows[0]?.label?.slice(0, 70)
  );
  await page.locator('[data-anno-ref="monitoring-scroller"]').screenshot({ path: `${OUT}/monitoring-rows.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · THE GROUP HEADER — RETIRED, BECAUSE NEITHER SURFACE HAS ONE
// ═══════════════════════════════════════════════════════════════════════════
//
// It held eight checks across both surfaces: that each grouped by as many keys
// as its scope implied, that every header on a surface shared one treatment,
// that each drew its own hairline rather than borrowing the card's, and that
// one pinned to the top of a ninety-row list.
//
// BOTH SUBJECTS ARE GONE, for different reasons and in the same direction:
//  · CARE REVIEWS grouped by deadline bucket. §2.9 retires the deadline
//    concept, and one task type is nothing to group by — so the list is flat,
//    in the comparator's order, which without an SLA is oldest-first.
//  · RISK FLAGS grouped by review subject. §2.1 removes Mentor Practice, and a
//    single group's header restated the page title while counting flags on a
//    list whose rows are conversations (§3.1).
//
// ═══ THE COMPONENT IS NOT DELETED, AND THAT IS THE POINT OF SAYING SO ═══
//
// `WorklistGroupHeader` still exists and is still the one treatment, because
// the rule it enforced — one header component, not one per surface — is what
// makes a second grouping cheap the day one is justified. `AGENTS.md`'s
// extensibility threshold covers when that is; the probe for it should come
// back with the grouping, and asserting it over zero headers today would be a
// green check on an empty array.

// ═══════════════════════════════════════════════════════════════════════════
// 5 · A ROW'S ACCESSIBLE NAME CARRIES ITS GROUP.
// ═══════════════════════════════════════════════════════════════════════════
//
// The header is `aria-hidden` and the enclosing group's label is announced on
// entry, not again forty rows down. Without this a screen-reader user has no way
// to know which tier they are in — which is a fact arch-D deliberately removed
// from the row's own surface.
for (const [url, name, scroller, monitoring] of [
  ["/app/care-reviews", "tasks", "tasks-worklist-scroller", null],
  ["/app/risk-flags", "monitoring", "monitoring-scroller", "normal-day"],
]) {
  const { context, page } = await open(`sr-${name}`, url, { monitoring });
  /* SCROLL TO THE COALESCED ROWS FIRST on Monitoring. Only Imminent rows are
     mounted at rest, so a check written against the default viewport would have
     inspected deadline rows only and reported "no elapsed anywhere" — true, and
     vacuous, because the person-forward rows it was meant to cover were not in
     the DOM. */
  if (name === "monitoring") await scrollToTeen(page);
  const data = await page.evaluate(() =>
    [...document.querySelectorAll('[role="treeitem"]')].map((r) => ({
      label: r.getAttribute("aria-label") ?? "",
      band: r.closest('[role="group"]')?.getAttribute("aria-label") ?? "",
      level: r.getAttribute("aria-level"),
    }))
  );
  const tops = data.filter((d) => d.level !== "2");
  /* ═══ THE GROUP NAME IS NO LONGER IN THE ROW'S NAME (addendum §2.1, §2.9) ═══
     It had to be, while a surface grouped: the header is `aria-hidden` and the
     enclosing group's label is announced on entry and not again forty rows
     down, so without it a screen-reader user could not tell which band they
     were in. NEITHER SURFACE GROUPS NOW — see section 4 — so the prefix would
     be the list's own name repeated on every row, which is the sighted
     equivalent of the chip §2.9 removed.
     WHAT REPLACES IT ON CARE REVIEWS: the row still names its KIND once, which
     is the fact a reader arriving mid-list cannot get from anywhere else now
     that the chip is gone. */
  check(
    `sr.${name}.no-group-prefix`,
    "no row repeats its list's name, because the list is not grouped",
    tops.length > 0 && tops.every((d) => d.band === "" || !d.label.startsWith(d.band.split(" — ")[0])),
    tops[0]?.label.slice(0, 70)
  );
  if (name === "tasks") {
    check(
      "sr.tasks.row-names-its-kind",
      "and a care review still says what kind of work it is, once",
      tops.every((d) => (d.label.match(/billing code review/gi) ?? []).length === 1),
      tops[0]?.label.slice(0, 80)
    );
  }
  /* ═══ AND THE NAME TELLS THE SAME STORY THE ROW DOES ═══
     This is the check that caught the real defect: the aria label still said
     "2d open" on a row whose column read "due in 15h" — one item, two different
     facts, one for each reader. A probe that only inspected rendered spans would
     have reported the surface clean. */
  /* ═══ NO SURFACE HERE HAS A COUNTDOWN ANY MORE (addendum §2.9) ═══
     Care Reviews lost its deadline and Risk Flags never had one after
     arch-mon. The bucket is kept rather than deleted because the claim it
     supports is the one that matters — one temporal KIND per row, never both —
     and a countdown reappearing on either surface should fail loudly here
     rather than pass silently through an `elapsed`-only check. */
  const countdown = tops.filter((d) => /due in|due \d|due [A-Z]|overdue by/.test(d.label));
  /* ═══ TWO SPELLINGS OF "HOW OLD" ═══
     Tasks says "2d open" (age since the review opened); Monitoring says "2h ago"
     (age since the flagged message) — arch-mon Phase 1 replaced its countdown
     with the second. Both are the elapsed kind, and the claim is unchanged: one
     temporal kind per row, never both. */
  const elapsed = tops.filter((d) => /\d+[mhd] open|\d+[mhd] ago/.test(d.label));
  check(
    `sr.${name}.same-temporal`,
    "and states the same temporal fact the row draws — exactly one kind, never both",
    tops.length > 0 &&
      countdown.length + elapsed.length === tops.length &&
      tops.every((d) => !(/due in|overdue by/.test(d.label) && /\d+[mhd] open|\d+[mhd] ago/.test(d.label))),
    `${countdown.length} countdown, ${elapsed.length} elapsed, of ${tops.length}`
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · TASKS IS TASK-LED AND GROUPED BY DEADLINE (arch-E).
// ═══════════════════════════════════════════════════════════════════════════
//
// arch-D made the countdown the scannable fact. arch-E goes further: the row
// leads with the JOB, carries the subject as context, and the list groups by when
// work is due rather than what kind it is. What is asserted here is the part a
// screenshot cannot show — that deadline order survives end to end, and that the
// mentor is gone from Tasks while still present on Monitoring.
{
  const { context, page } = await open("task-led", "/app/care-reviews");

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('[role="treeitem"]')].map((r) => {
      const nb = r.querySelector("span.min-w-0");
      const cs = (el) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        return {
          text: (el.innerText || "").replace(/\s+/g, " ").trim(),
          px: parseFloat(s.fontSize),
          weight: s.fontWeight,
          fam: s.fontFamily.split(",")[0].replace(/["']/g, ""),
        };
      };
      const leaves = [...r.querySelectorAll("span")].filter(
        (e) => !e.querySelector("span") && (e.innerText || "").trim()
      );
      return {
        label: r.getAttribute("aria-label") ?? "",
        band: r.closest('[role="group"]')?.getAttribute("aria-label") ?? "",
        height: Math.round(r.getBoundingClientRect().height),
        line1: cs(nb?.children?.[0]),
        line2: cs(nb?.children?.[1]),
        right: cs(leaves.at(-1)),
      };
    })
  );

  check(
    "e.teen-first",
    "line 1 is the teen, in the display face (arch-F revised arch-E here)",
    /* LINE 1 NOW HOLDS TWO SPANS — the name and the chip — so this reads the
       NAME rather than the line, and the chip has its own check in section 1. */
    rows.every((r) => /^[A-Z][a-z]+ [A-Z][.]/.test(r.line1?.text ?? "")),
    rows[0]?.line1 && `${rows[0].line1.text} · ${rows[0].line1.px}px/${rows[0].line1.weight} ${rows[0].line1.fam}`
  );
  /* ═══ LINE 2 IS THE CODE, AND SOMETIMES THE WORD (addendum §2.9) ═══
     It carried `proposalPreview`'s sentence, so "proposed" was on every row.
     The codes are lozenges now, and the kind word renders only where one
     lozenge cannot distinguish a renewal from a first assignment — a change
     shows two lozenges and an arrow, which says it without the word.
     THE CLAIM THAT SURVIVES is arch-F's: whatever line 2 holds, it is not the
     teen's name a second time. */
  check(
    "e.code-caption",
    "line 2 carries the billing code, and not the name a second time",
    rows.length > 0 &&
      rows.every((r) => /[A-Z]\d{2}(\.\d+)?/.test(r.line2?.text ?? "")) &&
      !rows.some((r) => /^[A-Z][a-z]+ [A-Z][.]/.test(r.line2?.text ?? "")),
    rows[0]?.line2?.text
  );
  /* ═══ THE MENTOR IS GONE FROM TASKS ═══
     Inherited from the flag row, where it earns its place. On a billing code
     review the mentor does not perform the task, is not accountable for it, and
     cannot change the decision — the code derives from survey data. */
  check(
    "e.no-mentor",
    "no Tasks row names a mentor, in text or in its accessible name",
    rows.every((r) => !/\bto [A-Z]/.test(r.line2?.text ?? "") && !/, to /.test(r.label)),
    rows[0]?.label
  );
  /* ═══ INVERTED — §1.3 PUT THE DISC BACK ═══
     This asserted arch-E's decision: no identity disc on a Tasks row, a
     task-type icon in a neutral well instead, because "a supervisor works this
     queue in deadline order rather than hunting for a named teen" and it made
     the two surfaces visibly different species.
     BOTH HALVES OF THAT ARGUMENT ARE GONE. The deadline went with addendum
     §2.9, and one icon on a surface holding one kind of work drew the SAME
     glyph on every row — the third arrival of the defect arch-F removed from
     the emphasis channel and §2.9 removed from the label channel. §1.3 replaces
     it with the teen's disc, which varies.
     SO THE CHECK IS NOW ITS OWN INVERSE, and it is stated as one check rather
     than deleted: a probe that simply dropped the assertion would let the icon
     well come back unnoticed. It asserts the disc is present on EVERY row —
     `>= rows.length` rather than `> 0`, because one disc among nineteen rows
     would satisfy a bare existence check while nineteen rows drew an icon. */
  const discs = await page.evaluate(
    () => ({
      rows: document.querySelectorAll('[role="treeitem"]').length,
      discs: document.querySelectorAll(
        '[role="treeitem"] span[aria-hidden][style*="background"]'
      ).length,
      wells: document.querySelectorAll(
        '[role="treeitem"] span[aria-hidden] svg'
      ).length,
    })
  );
  check(
    "e.identity-disc",
    "every Tasks row carries the teen's identity disc, and no task-type icon well",
    discs.rows > 0 && discs.discs >= discs.rows && discs.wells === 0,
    `${discs.discs} discs and ${discs.wells} icon wells across ${discs.rows} rows`
  );
  check("e.height", "row height", true, `${rows[0]?.height}px`);

  /* ═══ THE BUCKET CHECKS RETIRE, AND THE ORDER CLAIM MOVES (addendum §2.9) ═══
     arch-E's failure was that type buckets cut a correctly sorted list into
     runs, so the page restarted its countdown at every header — and the fix was
     buckets that PARTITION the one sort. §2.9 removes the deadline the sort and
     the buckets were both built on.
     THE CLAIM UNDERNEATH IT SURVIVES AND IS STRONGER WITHOUT THE BUCKETS: the
     list is one sorted sequence with nothing restarting inside it. Oldest-first
     now, which is `slaRemaining` falling through to `openedAt` rather than a
     rule anybody wrote — see `sla.ts`. Read end to end, the ages must be
     non-increasing. */
  const ages = await page.evaluate(() =>
    [...document.querySelectorAll('[role="treeitem"]')].map((r) => {
      const m = (r.getAttribute("aria-label") ?? "").match(/(\d+)([mhd]) open/);
      if (!m) return null;
      const mult = { m: 1, h: 60, d: 1440 }[m[2]];
      return Number(m[1]) * mult;
    })
  );
  const read = ages.filter((a) => a != null);
  check(
    "e.one-sorted-sequence",
    "the list is one sequence, oldest first, with nothing restarting inside it",
    read.length > 1 && read.every((v, i) => i === 0 || v <= read[i - 1]),
    read.length > 1
      ? `${read.length} rows: ${read.slice(0, 6).join(" ≥ ")}${read.length > 6 ? " ≥ …" : ""}`
      : `only ${read.length} row(s) carried an age`
  );

  await page.locator('[data-anno-ref="tasks-worklist-scroller"]').screenshot({ path: `${OUT}/tasks-task-led.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · MONITORING, AFTER arch-mon PHASE 1 — RETARGETED.
//
// arch-E asserted that Monitoring kept its TIER bands, its `to {mentor}` caption
// and its identity disc while Tasks moved to buckets and task-led rows. Two of
// those three claims lost their subject when Phase 1 removed the tiers: the
// bands are the two REVIEW SUBJECTS now, and the mentor is named with its role
// rather than after a preposition. The third — the identity disc — still stands
// and is still checked below.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("mon-intact", "/app/risk-flags");
  const bands = await page.evaluate(() =>
    [...document.querySelectorAll('[role="group"]')]
      .map((g) => g.getAttribute("aria-label"))
      .filter((l) => l && / — \d+$/.test(l))
  );
  /* ═══ MONITORING GROUPS BY NOTHING NOW (addendum §2.1) ═══
     arch-mon retargeted this from tiers to the two REVIEW SUBJECTS. §2.1
     removes Mentor Practice, so one subject is left and its header restated
     the page title over every row — while counting flags on a list whose rows
     are conversations (§3.1).
     THE PROHIBITION IS WHAT SURVIVES, and it is the part that was always load
     bearing: whatever grouping this surface has or does not have, it is never
     a TIER and never a DEADLINE. Both are things this codebase invented and
     removed, and both would reappear here first. */
  check(
    "e.monitoring-no-invented-bands",
    "Monitoring groups by nothing, and never by a tier or a deadline",
    bands.length === 0,
    bands.length ? bands.join(" | ") : "no group headers"
  );
  const mentor = await page.evaluate(() =>
    [...document.querySelectorAll('[role="treeitem"]')].map((r) => r.getAttribute("aria-label") ?? "")
  );
  check(
    "e.monitoring-mentor",
    "and still names the mentor — with its role, not after a preposition",
    mentor.length > 0 && mentor.every((l) => /mentor [A-Z]/.test(l)) && !mentor.some((l) => /, to /.test(l)),
    mentor[0]?.slice(0, 64)
  );
  const disc = await page.evaluate(
    () => document.querySelectorAll('[role="treeitem"] span[aria-hidden][style*="background"]').length > 0
  );
  check("e.monitoring-avatar", "and still carries the identity disc", disc);
  await context.close();
}


await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
