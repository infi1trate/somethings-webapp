// FOCUS RINGS MUST NOT BE CLIPPED BY AN ANCESTOR.
//
// ═══ THE BUG THIS PROBE EXISTS FOR ═══
//
// Reported as "the left and right side of a selected input are masked". The
// cause is a CSS rule that is easy to forget: **`overflow-y: auto` computes
// `overflow-x` to `auto` too**, because a `visible` value on one axis becomes
// `auto` when the other axis is not `visible`. So a container that only meant
// to scroll vertically clips horizontally as well, at its PADDING BOX.
//
// The record's compose fields are `w-full` and their ring is
// `outline-2 outline-offset-2`, which reaches 4px past the border box. The
// modal's scrolling body had 2px of horizontal padding, so all 4px of the ring
// was cut on both sides.
//
// ═══ THE ARITHMETIC, BECAUSE IT IS THE WHOLE FIX ═══
//
// For a `w-full` child of a clipping container:
//
//     slack = container padding − ring reach
//
// The ring reaches `outline-width + outline-offset` = 4px here. So 4px of
// padding is EXACTLY flush — one antialiased pixel from clipping again — and
// 6px is the first value with real slack. The negative margin (`-mx-1.5`)
// exists only to put the box back where it was, so nothing moves.
//
// ═══ WHY A PROBE AND NOT A UNIT TEST ═══
//
// The claim is about resolved geometry against a resolved `overflow` value.
// Nothing short of a real layout can answer it, and the defect is invisible in
// a diff — it was found by looking at a screenshot and then measured.
//
// KNOWN AND UNFIXED, listed here rather than silently passing: two containers
// still clip, each because the obvious fix moves something visible. See
// `KNOWN` below.

import { launch, BASE, STORE_KEY, buildStoreSeed, readStoreVersion } from "./harness.mjs";

/** Containers that still clip, with the reason they were not simply padded.
 *  A new entry here should be a decision, not a shrug. */
const KNOWN = [
  {
    match: /overflow-x-auto overflow-y-hidden border-b/,
    why: "the record's tab row — padding it would widen the `border-b` underline past the tabs",
  },
  {
    match: /overflow-hidden rounded-\[var\(--radius-elevated\)\]/,
    why: "the Tasks worklist card — padding it would inset every row inside the rounded card",
  },
];

/** ═══ THE COMPOSE SURFACES HAVE TO BE OPENED, NOT JUST VISITED ═══
 *
 *  The first version of this probe scanned page loads only, and the fields it
 *  was written for live behind a disclosure and a dialog — so it reported a
 *  clean run against the exact defect it exists to catch. Caught by mutating
 *  the fix back out and watching the probe pass anyway.
 *
 *  `open` runs in the page before the scan and is allowed to find nothing: a
 *  view without a review or a compose button is still worth scanning for its
 *  other controls. */
const OPEN_REVIEW = async (page) => {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const rev = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Review"
    );
    if (rev) {
      rev.click();
      await wait(700);
    }
  });
};
const OPEN_COMPOSE = async (page) => {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Write care update|Amend care update/.test(x.textContent)
    );
    if (b) {
      b.click();
      await wait(900);
    }
  });
};

const VIEWS = [
  ["/admin/person/t17?tab=care", "record · Care", OPEN_REVIEW],
  ["/admin/person/t17?tab=care", "record · Care · compose modal", OPEN_COMPOSE],
  ["/admin/person/t17?tab=overview", "record · Overview"],
  ["/app/tasks", "Tasks"],
  ["/app/activity", "Activity"],
  ["/app/settings", "Settings"],
  ["/app/mentees", "Mentees"],
];

const SCAN = `(() => {
  const out = [];
  for (const el of document.querySelectorAll("textarea,input,button,a,select,[tabindex]")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cls = (el.className || "").toString();
    // The ring is a :focus-visible rule, so its reach is read off the classes
    // rather than the resolved style — nothing is focused during a scan.
    const reach = /outline-offset-2/.test(cls) ? 4 : 0;
    if (!reach) continue;
    let c = el.parentElement, clip = null;
    for (; c; c = c.parentElement) {
      const s = getComputedStyle(c);
      if (/(auto|scroll|hidden)/.test(s.overflowX)) { clip = c; break; }
    }
    if (!clip) continue;
    const cr = clip.getBoundingClientRect(), cs = getComputedStyle(clip);
    // CLIPPING IS AT THE PADDING BOX — the border box inset by the BORDER only.
    // Subtracting padding as well gives the content box and reports every ring
    // as clipped whatever the padding is; that mistake cost a measurement pass.
    const L = cr.x + parseFloat(cs.borderLeftWidth);
    const R = cr.right - parseFloat(cs.borderRightWidth);
    const left = Math.round(L - (r.x - reach));
    const right = Math.round((r.right + reach) - R);
    if (left <= 0 && right <= 0) continue;
    out.push({
      el: el.tagName + (el.id ? "#" + el.id : ""),
      clipper: clip.className.toString().slice(0, 70) || clip.tagName,
      clippedPx: Math.max(0, left) + Math.max(0, right),
      padX: cs.paddingLeft + "/" + cs.paddingRight,
    });
  }
  return out;
})()`;

const browser = await launch();
const version = await readStoreVersion();
const payload = JSON.stringify(
  buildStoreSeed({ persona: "supervisor", status: "published", published: true }, version)
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.addInitScript(
  ({ key, payload }) => {
    try {
      window.localStorage.setItem(key, payload);
    } catch {}
  },
  { key: STORE_KEY, payload }
);
const page = await ctx.newPage();

let unexpected = 0;
let known = 0;
for (const [path, label, open] of VIEWS) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if (open) await open(page);
  const rows = await page.evaluate(SCAN);
  const news = rows.filter((r) => !KNOWN.some((k) => k.match.test(r.clipper)));
  known += rows.length - news.length;
  unexpected += news.length;
  if (!news.length) {
    console.log(`  ✓ ${label}${rows.length ? ` — ${rows.length} known` : ""}`);
    continue;
  }
  console.log(`  ✗ ${label} — ${news.length} clipped focus ring(s)`);
  for (const r of news)
    console.log(`      ${r.clippedPx}px  ${r.el}  pad ${r.padX}  in .${r.clipper}`);
}

console.log(
  `\n${unexpected} unexpected, ${known} known-and-listed.` +
    (unexpected ? "" : "  NO NEW CLIPPED FOCUS RINGS")
);
for (const k of KNOWN) console.log(`  known: ${k.why}`);
await browser.close();
process.exit(unexpected ? 1 : 0);
