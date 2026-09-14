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

async function open(id, url, { scenario = "typical-shift" } = {}) {
  return openView(
    browser,
    { id, url, seed: { persona: "supervisor", extra: { tasksScenarioId: scenario, devLoadState: "ready" } } },
    XL,
    version
  );
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
  const { context, page } = await open("tasks", "/app/tasks");
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
  check(
    "tasks.deadline-leads",
    "and it is the countdown",
    emph.every((e) => /^(due in|overdue by) /.test(e[0]?.text ?? "")),
    emph[0]?.[0] && `${emph[0][0].text} · ${emph[0][0].px}px/${emph[0][0].weight} ${emph[0][0].fam}`
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
    data.every((r) => r.parts.filter((p) => /(due in|overdue by|\d+[mhd] open)/.test(p.text)).length === 1)
  );
  const name = data[0]?.parts.find((p) => /^[A-Z][a-z]+ [A-Z]\.$/.test(p.text));
  check(
    "tasks.name-demoted",
    "the name is present and not the emphasis",
    name && !name.emphasised,
    name && `${name.text} · ${name.px}px/${name.weight} ${name.fam}`
  );
  check("tasks.height", "row height", true, `${data[0]?.height}px`);
  await page.locator('[data-anno-ref="tasks-worklist-scroller"]').screenshot({ path: `${OUT}/tasks-rows.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · TASKS, OVERDUE — the breach chip AND the countdown.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("tasks-overdue", "/app/tasks", { scenario: "breach-overnight" });
  const t = await page.locator('[role="treeitem"]').first().innerText();
  check(
    "tasks.overdue",
    "an overdue row carries the breach chip and says how late",
    /Overdue/.test(t) && /overdue by \d+[mhd]/.test(t),
    t.replace(/\s+/g, " ")
  );
  await page.locator('[data-anno-ref="tasks-worklist-scroller"]').screenshot({ path: `${OUT}/tasks-overdue.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · MONITORING — BOTH EMPHASES, ON ONE SURFACE.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("monitoring", "/app/monitoring");
  const imminent = await page.evaluate(
    `[...document.querySelectorAll('[role="treeitem"]')].slice(0, 5).map(${rowReport})`
  );
  const iEmph = imminent.map((r) => r.parts.filter((p) => p.emphasised));
  check(
    "mon.imminent-deadline",
    "an imminent flag leads with its countdown, like a Tasks row",
    iEmph.every((e) => e.length === 1 && /^(due in|overdue by) /.test(e[0].text)),
    iEmph[0]?.[0]?.text
  );

  await scrollToTeen(page);
  const teens = await page.evaluate(
    `[...document.querySelectorAll('[role="treeitem"][aria-expanded]')].slice(0, 4).map(${rowReport})`
  );
  const tEmph = teens.map((r) => r.parts.filter((p) => p.emphasised));
  check(
    "mon.teen-one-emphasis",
    "exactly one emphasised element per teen row",
    tEmph.length > 0 && tEmph.every((e) => e.length === 1),
    tEmph.map((e) => e.length).join(",")
  );
  check(
    "mon.teen-person",
    "and it is the name",
    tEmph.every((e) => /^[A-Z][a-z]+ [A-Z]\.$/.test(e[0]?.text ?? "")),
    tEmph[0]?.[0] && `${tEmph[0][0].text} · ${tEmph[0][0].px}px/${tEmph[0][0].weight} ${tEmph[0][0].fam}`
  );
  check(
    "mon.teen-volume",
    "signal volume is on the row, in words",
    teens.every((r) => /\d+ flags/.test(r.label) && /\d+ (clinical|routine)/.test(r.label)),
    teens[0]?.label
  );
  const age = teens[0]?.parts.find((p) => /\d+[mhd] open$/.test(p.text));
  check("mon.teen-age-quiet", "oldest age stays, quiet", age && !age.emphasised, age && `${age.text} · ${age.px}px/${age.weight}`);
  check("mon.height", "row height", true, `${teens[0]?.height}px`);
  await page.locator('[data-anno-ref="tasks-worklist-scroller"]').screenshot({ path: `${OUT}/monitoring-rows.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · THE GROUP HEADER — ONE COMPONENT, ONE TREATMENT, STICKY ON BOTH.
// ═══════════════════════════════════════════════════════════════════════════
for (const [url, name] of [["/app/tasks", "tasks"], ["/app/monitoring", "monitoring"]]) {
  const { context, page } = await open(`hdr-${name}`, url, { scenario: "heavy-caseload" });
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
  check(
    `hdr.${name}.uniform`,
    "every header on the surface has one treatment",
    headers.length > 1 && new Set(headers.map(sig)).size === 1,
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
  await page.getByRole("treeitem").first().click();
  await page.waitForTimeout(250);
  for (let i = 0; i < 90; i += 1) await page.keyboard.press("j");
  await page.waitForTimeout(400);
  const stuck = await page.evaluate(() => {
    const scroller = document.querySelector('[data-anno-ref="tasks-worklist-scroller"]');
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
for (const [url, name] of [["/app/tasks", "tasks"], ["/app/monitoring", "monitoring"]]) {
  const { context, page } = await open(`sr-${name}`, url);
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
  const countdown = tops.filter((d) => /due in|overdue by/.test(d.label));
  const elapsed = tops.filter((d) => /\d+[mhd] open/.test(d.label));
  check(
    `sr.${name}.same-temporal`,
    "and states the same temporal fact the row draws — exactly one kind, never both",
    tops.length > 0 &&
      countdown.length + elapsed.length === tops.length &&
      tops.every((d) => !(/due in|overdue by/.test(d.label) && /\d+[mhd] open/.test(d.label))),
    `${countdown.length} countdown, ${elapsed.length} elapsed, of ${tops.length}`
  );
  await context.close();
}

await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
