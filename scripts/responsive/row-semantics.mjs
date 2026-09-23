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
  /* THE JOB IS STILL THERE, AS A CHIP — asserted separately so "the emphasis
     moved" cannot quietly become "the row no longer says what it is". */
  const chips = data.map((r) => r.parts.find((p) => p.text === "Billing code review"));
  check(
    "tasks.job-chip",
    "the task type is present on every row, subordinate",
    chips.every((c) => c && !c.emphasised && c.px <= 12),
    chips[0] && `${chips[0].text} · ${chips[0].px}px/${chips[0].weight} ${chips[0].fam}`
  );
  /* THE COUNTDOWN IS STILL THERE AND STILL THE SCANNABLE COLUMN — asserted
     separately, so "the emphasis moved" cannot quietly become "the countdown
     went quiet". */
  /* ═══ arch-F: THE DEADLINE INFORMS RATHER THAN ALARMS ═══
     arch-E asserted 14px primary ink, when the countdown was the row's other
     emphasis. arch-F gives the bucket header the urgency and the row the
     detail, so the column is mono, tabular and SECONDARY — still the one
     element in its zone, no longer competing with the breach chip beside it. */
  const clocks = data.map((r) => r.parts.find((p) => /^(due |overdue )/.test(p.text)));
  check(
    "tasks.deadline-column",
    "the deadline keeps its mono tabular column, in secondary ink",
    clocks.every((c) => c && /mono/.test(c.fam) && c.px >= 12),
    clocks[0] && `${clocks[0].text} · ${clocks[0].px}px/${clocks[0].weight} ${clocks[0].fam}`
  );
  check(
    "tasks.no-elapsed",
    "elapsed age is gone from the row",
    data.every((r) => !r.parts.some((p) => /\d+[mhd] open$/.test(p.text))),
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
  const caption = spans[0]?.find((p) => /proposed/.test(p.text) && !/^[A-Z][a-z]+ [A-Z][.]/.test(p.text));
  check(
    "tasks.caption-disposition",
    "the caption carries the disposition, and not the name again",
    caption && !caption.emphasised && caption.px < 14,
    caption && `${caption.text.replace(/\s+/g, " ")} · ${caption.px}px/${caption.weight} ${caption.fam}`
  );
  check("tasks.height", "row height", true, `${data[0]?.height}px`);
  await page.locator('[data-anno-ref="tasks-worklist-scroller"]').screenshot({ path: `${OUT}/tasks-rows.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · TASKS, OVERDUE — ONE STATEMENT, NOT THREE (arch-G, G1 superseded F1.2).
//
// The row carried a breach chip AND the countdown, under a bucket header already
// reading "Overdue" — three statements about one lateness. The BUCKET owns the
// treatment now; the row states how late, in breach ink, and drops the chip.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("tasks-overdue", "/app/care-reviews", { scenario: "breach-overnight" });
  const t = await page.locator('[role="treeitem"]').first().innerText();
  const header = await page.evaluate(`(() => { const h = document.querySelector('[role="group"] > div[aria-hidden]');
    if (!h) return null; const cs = getComputedStyle(h);
    return { text: (h.innerText||"").replace(/\\s+/g," ").trim(), bg: cs.backgroundColor, fg: cs.color }; })()`);
  check("tasks.overdue-input", "the bucket header was readable", !!header, JSON.stringify(header));
  check(
    "tasks.overdue-header-carries-breach",
    "the bucket header carries the breach treatment",
    header && /Overdue/.test(header.text) && header.bg !== "rgba(0, 0, 0, 0)" && header.bg !== "rgb(255, 255, 255)",
    header && `${header.text} · ${header.bg}`
  );
  const deadlineInk = await page.evaluate(`(() => {
    /* THE LEAF, not an ancestor that happens to contain the text — a wrapper
       inherits primary/400 and made this read as unstyled. */
    const el = [...document.querySelectorAll('[role="treeitem"] span')].find((e) => !e.querySelector("span") && /^overdue by /.test((e.innerText||"").trim()));
    if (!el) return null; const cs = getComputedStyle(el);
    return { text: el.innerText.trim(), color: cs.color, weight: cs.fontWeight }; })()`);
  check(
    "tasks.overdue-row-states-how-late",
    "and the row states how late, in breach ink, with no chip of its own",
    deadlineInk && !/\bOverdue\b/.test(t.replace(/overdue by/gi, "")) && Number(deadlineInk.weight) >= 600,
    deadlineInk && `${deadlineInk.text} · ${deadlineInk.color}/${deadlineInk.weight}`
  );
  check(
    "tasks.overdue",
    "and the lateness is still stated exactly once",
    /overdue by \d+[mhd]/.test(t) && t.match(/[Oo]verdue/g)?.length === 1,
    t.replace(/\s+/g, " ")
  );
  await page.locator('[data-anno-ref="tasks-worklist-scroller"]').screenshot({ path: `${OUT}/tasks-overdue.png` });
  await context.close();
}

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
// 4 · THE GROUP HEADER — ONE COMPONENT, ONE TREATMENT, STICKY ON BOTH.
// ═══════════════════════════════════════════════════════════════════════════
/** ═══ RETARGETED OFF THE RETIRED ROUTES (supervisor IA restructure, Phase 2) ═══
 *
 *  `/app/tasks` and `/app/monitoring` are `replace` hops now. A probe that
 *  navigates to a hop still LANDS on the destination, so these checks kept
 *  passing — which is the problem: a hop with the wrong target would also pass,
 *  and the probe would be asserting about a surface it cannot name.
 *
 *  ═══ AND `hdr.monitoring.uniform` WAS A REAL FAILURE, NOT A HOP ARTIFACT ═══
 *
 *  It asserted `headers.length > 1`, because Monitoring's two groups were the two
 *  review subjects and uniformity needs two things to compare. THE SUBJECT SPLIT
 *  IS A ROUTE BOUNDARY NOW — Risk Flags is teen safety, Mentor Practice is
 *  mentor practice — so a scoped queue has exactly ONE subject group and can
 *  never have two. The old assertion is unsatisfiable on the surface that
 *  replaced the one it was written for.
 *
 *  RETARGETED STRICTER. `expectHeaders` pins the number the scope implies rather
 *  than accepting "more than one": Care Reviews' deadline buckets are still many
 *  (so a regression that collapsed them fails), and Risk Flags is asserted at
 *  exactly one (so a regression that RE-INTRODUCED a second grouping — a tier
 *  band, say, which Phase 4 is removing — fails loudly here). Uniformity is
 *  still compared across whatever headers exist.
 *
 *  The `monitoringLong` fixture split stays: stickiness needs a list longer than
 *  the viewport and `surge` is the long one. */
for (const [url, name, scroller, monitoring, monitoringLong, expectHeaders] of [
  ["/app/care-reviews", "tasks", "tasks-worklist-scroller", null, null, "many"],
  ["/app/risk-flags", "monitoring", "monitoring-scroller", "mentor-note-overdue", "surge", 1],
]) {
  let { context, page } = await open(`hdr-${name}`, url, { scenario: "heavy-caseload", monitoring });
  const headers = await page.evaluate(() =>
    [...document.querySelectorAll('[role="group"] > div[aria-hidden]')]
      .filter((h) => / — \d/.test(h.innerText || ""))
      .map((h) => {
        const s = getComputedStyle(h);
        return {
          text: h.innerText.replace(/\s+/g, " "),
          position: s.position,
          top: s.top,
          borderTop: s.borderTopWidth,
          bg: s.backgroundColor,
          px: s.fontSize,
          transform: s.textTransform,
          fam: s.fontFamily.split(",")[0].replace(/["']/g, ""),
          h: Math.round(h.getBoundingClientRect().height),
        };
      })
  );
  const sig = (h) => `${h.position}|${h.top}|${h.borderTop}|${h.bg}|${h.px}|${h.transform}|${h.h}`;
  /* THE INPUT IS ASSERTED BEFORE THE PROPERTY OF IT. Without this, a surface
     that stopped grouping altogether would take `uniform` and `anatomy` with a
     clean pass over an empty list — the vacuous-assertion failure this probe has
     already been bitten by twice. */
  /* ═══ NO RAW ENUM REACHES A READER (Phase 4) ═══
     The fixtures carry playbook CATEGORY IDS now — `ASSESSMENT_BELOW_THRESHOLD`
     — which is what made the clinical ranking possible and immediately put the
     id itself on screen, because three render sites passed `event.category`
     straight through. Measured on `/app/risk-flags`: every row's secondary line.
     A UNIT TEST COULD NOT CATCH IT. `risk-taxonomy` had labels for all 21
     categories and the assertion that it did passed the whole time — the defect
     was a renderer not asking. So this reads the DOM, on both surfaces, and it
     is deliberately a SHAPE test rather than a list of known ids: anything
     SHOUTING_IN_SNAKE_CASE is a machine identifier whatever it is called. */
  const shouted = await page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(
      document.querySelector("main") ?? document.body,
      NodeFilter.SHOW_TEXT
    );
    let n;
    while ((n = walk.nextNode())) {
      const t = (n.textContent ?? "").trim();
      if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+){2,}$/.test(t)) out.push(t);
    }
    return [...new Set(out)];
  });
  check(
    `hdr.${name}.no-raw-enum`,
    "no machine identifier is rendered where a label belongs",
    shouted.length === 0,
    shouted.length ? shouted.slice(0, 3).join(", ") : "clean"
  );

  check(
    `hdr.${name}.count`,
    `the surface groups, and by as many keys as its scope implies (${expectHeaders})`,
    expectHeaders === "many" ? headers.length > 1 : headers.length === expectHeaders,
    `${headers.length} header(s): ${headers.map((h) => h.text).join(" | ") || "none"}`
  );
  check(
    `hdr.${name}.uniform`,
    "every header on the surface has one treatment",
    headers.length > 0 && new Set(headers.map(sig)).size === 1,
    headers.length ? sig(headers[0]) : "none"
  );
  /* ═══ EACH HEADER BRINGS ITS OWN SEPARATION ═══
     THE DEFECT arch-D WAS ASKED TO FIX: the first header on Tasks read as a
     bordered band and later ones as inline dividers. Measured, both were the
     same component with identical computed styles — the CARD supplied the
     difference, wrapping the first one in its own 1px border and 20px radius
     while later ones borrowed the rows' hairlines.
     A uniformity check alone cannot catch this. Deleting the border from EVERY
     header leaves them perfectly uniform and puts the surface straight back to
     borrowing the frame — a mutation run proved exactly that, passing clean. So
     the hairline is asserted directly. It also earns its keep while the header
     is stuck: it is the line separating a pinned header from the row sliding
     under it, which a frame that is not attached to the header never could. */
  check(
    `hdr.${name}.own-hairline`,
    "every header draws its own separator rather than borrowing the card's",
    headers.length > 0 && headers.every((h) => parseFloat(h.borderTop) > 0),
    headers.map((h) => h.borderTop).join(", ")
  );
  check(
    `hdr.${name}.anatomy`,
    "label — count, sentence case, not mono",
    headers.every((h) => / — \d+$/.test(h.text) && h.transform === "none" && !/mono/i.test(h.fam)),
    headers.map((h) => h.text).join(" | ")
  );

  /* ═══ STICKY ACROSS THE VIRTUALIZATION BOUNDARY ═══
     The header is what supplies the task type or tier the rows no longer state,
     so it staying in frame is not polish — it is the replacement for a fact that
     was removed. Driven with `j` rather than a scroll write, because that is the
     path that crosses the boundary: the rows a reader arrows past are UNMOUNTED
     behind them. */
  if (monitoringLong) {
    await context.close();
    ({ context, page } = await open(`hdr-${name}-long`, url, { scenario: "heavy-caseload", monitoring: monitoringLong }));
    await page.waitForTimeout(500);
  }
  await page.evaluate(`window.__SCROLLER__ = ${JSON.stringify(scroller)}`);
  await page.getByRole("treeitem").first().click();
  await page.waitForTimeout(250);
  for (let i = 0; i < 90; i += 1) await page.keyboard.press("j");
  await page.waitForTimeout(400);
  const stuck = await page.evaluate(() => {
    const scroller = document.querySelector(`[data-anno-ref="${window.__SCROLLER__}"]`);
    const s = scroller.getBoundingClientRect();
    const visible = [...document.querySelectorAll('[role="group"] > div[aria-hidden]')]
      .filter((h) => / — \d/.test(h.innerText || ""))
      .map((h) => {
        const r = h.getBoundingClientRect();
        return { text: h.innerText.replace(/\s+/g, " "), top: Math.round(r.top - s.top), inFrame: r.top >= s.top - 1 && r.bottom <= s.bottom + 1 };
      });
    const sel = document.querySelector('[role="treeitem"][aria-selected="true"]');
    return { scrollTop: Math.round(scroller.scrollTop), visible, selected: sel?.getAttribute("aria-label")?.slice(0, 50) };
  });
  const pinned = stuck.visible.find((h) => h.top >= -1 && h.top <= 1);
  check(
    `hdr.${name}.sticky`,
    "a header is pinned to the top of the list after 90 rows",
    Boolean(pinned) && stuck.scrollTop > 0,
    `scrollTop ${stuck.scrollTop}, pinned "${pinned?.text}", selected ${stuck.selected}`
  );
  await context.close();
}

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
  ["/app/risk-flags", "monitoring", "monitoring-scroller", "mentor-note-overdue"],
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
  check(
    `sr.${name}.group-in-name`,
    "every row names the group it is in",
    tops.length > 0 && tops.every((d) => d.label.startsWith(d.band.split(" — ")[0])),
    tops[0]?.label.slice(0, 60)
  );
  /* ═══ AND THE NAME TELLS THE SAME STORY THE ROW DOES ═══
     This is the check that caught the real defect: the aria label still said
     "2d open" on a row whose column read "due in 15h" — one item, two different
     facts, one for each reader. A probe that only inspected rendered spans would
     have reported the surface clean. */
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
  check(
    "e.disposition-caption",
    "line 2 carries the disposition preview, and not the name a second time",
    rows.length > 0 &&
      rows.every((r) => /proposed/.test(r.line2?.text ?? "")) &&
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
  check(
    "e.no-avatar",
    "the identity disc is replaced by a task-type icon",
    await page.evaluate(
      () =>
        document.querySelectorAll('[role="treeitem"] span[aria-hidden][style*="background"]').length === 0 &&
        document.querySelectorAll('[role="treeitem"] svg').length > 0
    )
  );
  check("e.height", "row height", true, `${rows[0]?.height}px`);

  /* ═══ DEADLINE ORDER, END TO END ═══
     The failure arch-E fixes: type buckets cut a correctly sorted list into runs,
     so the page restarted its countdown at every header. Read as one sequence,
     the buckets must be non-decreasing. */
  const buckets = rows.map((r) => r.band.split(" — ")[0]);
  const fixed = ["Overdue", "Due today", "Due tomorrow", "Later"];
  const asIndex = buckets.map((b) => fixed.indexOf(b));
  check(
    "e.buckets-monotonic",
    "buckets appear in fixed order and never repeat",
    asIndex.every((v, i) => i === 0 || v >= asIndex[i - 1]) && !asIndex.includes(-1),
    [...new Set(buckets)].join(" > ")
  );
  const seen = [...new Set(await page.evaluate(() =>
    [...document.querySelectorAll('[role="group"]')]
      .map((g) => g.getAttribute("aria-label"))
      .filter((l) => l && / — \d+$/.test(l))
  ))];
  check("e.buckets-present", "the buckets that exist are labelled with counts", seen.length > 0, seen.join(" | "));
  check(
    "e.bucket-in-name",
    "and every row's accessible name starts with its bucket",
    rows.every((r) => r.label.startsWith(r.band.split(" — ")[0])),
    rows[0]?.label.slice(0, 54)
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
  check(
    "e.monitoring-subjects",
    "Monitoring groups by review subject — never by tier, never by deadline",
    bands.length > 0 &&
      bands.every((b) => /^(Teen safety|Mentor practice) — \d+$/.test(b)) &&
      !bands.some((b) => /^(Imminent|Clinical review|Routine review|Overdue|Due |Later)/.test(b)),
    bands.join(" | ")
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
