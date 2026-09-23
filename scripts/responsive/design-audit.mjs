// PHASE 10 MEASUREMENTS. Typography and spacing claims, measured on the running
// app rather than read off the source — measure (CPL), leading ratios, and how
// much of the spacing in use is off the 4/8px scale.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { launch, openView, VIEWPORTS, readStoreVersion, BASE } from "./harness.mjs";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

const version = await readStoreVersion();
const browser = await launch();
const out = [];

const SURFACES = [
  { id: "care", url: "/admin/person/t17?tab=care&scenario=longitudinal", seed: { persona: "supervisor" } },
  { id: "tasks", url: "/app/care-reviews", seed: { persona: "supervisor" } },
  { id: "activity", url: "/app/activity", seed: { persona: "supervisor" } },
];

for (const s of SURFACES) {
  const { context, page } = await openView(browser, { id: s.id, url: s.url, seed: s.seed }, { label: s.id, width: 1440, height: 2400 }, version);
  await page.waitForTimeout(1300);
  out.push(await page.evaluate((id) => {
    const main = document.querySelector("main");
    if (!main) return { id, missing: true };

    // ── MEASURE: characters per line for real prose blocks (>= 60 chars of text,
    //    a single text node, not a label). Estimated from the rendered width and
    //    the average glyph advance, which is what a reader actually experiences.
    const prose = [];
    for (const el of main.querySelectorAll("p, blockquote p, li")) {
      const t = (el.textContent ?? "").trim();
      if (t.length < 60 || el.children.length > 1) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 80) continue;
      const cs = getComputedStyle(el);
      // Measure one line's worth by rendering a canvas with the same font.
      const c = document.createElement("canvas").getContext("2d");
      c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const avg = c.measureText("abcdefghijklmnopqrstuvwxyz ").width / 27;
      prose.push({
        cpl: Math.round(r.width / avg),
        px: parseFloat(cs.fontSize),
        lh: parseFloat(cs.lineHeight),
        ratio: Math.round((parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)) * 100) / 100,
        sample: t.slice(0, 40),
      });
    }

    // ── SPACING: every margin/padding/gap actually applied inside `main`,
    //    bucketed by whether it lands on the 4px scale.
    const spacing = new Map();
    for (const el of main.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      for (const prop of ["marginTop", "marginBottom", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "rowGap", "columnGap"]) {
        const v = parseFloat(cs[prop]);
        if (!Number.isFinite(v) || v === 0) continue;
        spacing.set(v, (spacing.get(v) ?? 0) + 1);
      }
    }
    const vals = [...spacing.entries()].sort((a, b) => b[1] - a[1]);
    const onScale = vals.filter(([v]) => v % 4 === 0);
    const offScale = vals.filter(([v]) => v % 4 !== 0);
    const total = vals.reduce((n, [, c]) => n + c, 0);
    const offTotal = offScale.reduce((n, [, c]) => n + c, 0);

    return {
      id,
      prose: prose.slice(0, 8),
      proseOutOfRange: prose.filter((p) => p.cpl < 45 || p.cpl > 75).length,
      proseCount: prose.length,
      spacing: {
        distinctValues: vals.length,
        offScaleShare: Math.round((offTotal / total) * 100),
        topOffScale: offScale.slice(0, 8).map(([v, c]) => `${v}px×${c}`),
        topOnScale: onScale.slice(0, 6).map(([v, c]) => `${v}px×${c}`),
      },
    };
  }, s.id));
  await context.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));

/** ═══ THE SPACING RATCHET (gap row 334) ═══
 *
 *  Row 334 measured 31–40% of applied spacing off the 4px scale and recommended
 *  NOT sweeping it: normalising a third of every gap in the app is a large,
 *  high-risk change for a benefit no reader would name, and it would churn
 *  layouts verified by hand. The bounded action it named instead was "stop adding
 *  half-steps in new work and normalise opportunistically".
 *
 *  A recommendation like that decays the moment the person who wrote it stops
 *  looking. This is the mechanism: the current share is committed, and the audit
 *  fails if a surface gets WORSE. It can only be ratcheted down.
 *
 *  THE OFFENDERS ARE TAILWIND'S HALF-STEPS — 2px (`0.5`), 6px (`1.5`), 10px
 *  (`2.5`), 14px (`3.5`). They are on Tailwind's scale and are not on an
 *  8px-base-with-4px-half-step system, which is why they arrive by habit rather
 *  than by decision.
 *
 *  TOLERANCE OF 1 POINT, not 0: the share is a ratio over every applied value on
 *  a rendered page, so content changes move it slightly without anybody adding a
 *  half-step. Zero tolerance would cry wolf and get switched off, which is worse
 *  than a loose ratchet.
 *
 *  `SPACING_RATCHET=update` rewrites the baseline — deliberate, and the same
 *  shape as the a11y baseline's own guard, for the same reason (row 344: an
 *  artifact that can be silently overwritten is not evidence). */
const RATCHET_PATH = "docs/responsive/SPACING-BASELINE.json";
const TOLERANCE = 1;
const current = Object.fromEntries(
  out.map((s) => [s.id, s.spacing.offScaleShare])
);

let base = null;
try {
  base = JSON.parse(await readFile(RATCHET_PATH, "utf8"));
} catch {
  base = null;
}

if (process.env.SPACING_RATCHET === "update" || !base) {
  await mkdir("docs/responsive", { recursive: true });
  await writeFile(
    RATCHET_PATH,
    JSON.stringify({ generated: new Date().toISOString(), offScaleShare: current }, null, 2)
  );
  console.log(
    `\nSPACING RATCHET ${base ? "UPDATED" : "CREATED"} — ${RATCHET_PATH}`
  );
  for (const [id, v] of Object.entries(current)) console.log(`  ${id}: ${v}%`);
} else {
  const regressions = [];
  const improvements = [];
  for (const [id, now] of Object.entries(current)) {
    const was = base.offScaleShare?.[id];
    if (was === undefined) continue;
    if (now > was + TOLERANCE) regressions.push(`${id}: ${was}% → ${now}%`);
    else if (now < was) improvements.push(`${id}: ${was}% → ${now}%`);
  }
  console.log("\nSPACING RATCHET");
  for (const [id, now] of Object.entries(current)) {
    const was = base.offScaleShare?.[id];
    console.log(`  ${id}: ${now}%${was === undefined ? " (new surface)" : ` (baseline ${was}%)`}`);
  }
  if (improvements.length) {
    console.log(
      `  IMPROVED: ${improvements.join(", ")} — run with SPACING_RATCHET=update to lock it in.`
    );
  }
  if (regressions.length) {
    console.log(`\n  OFF-SCALE SPACING INCREASED: ${regressions.join(", ")}`);
    console.log(
      "  A new half-step (2/6/10/14px) was added. Use a 4px multiple, or run\n" +
        "  SPACING_RATCHET=update if the increase is deliberate. See gap row 334."
    );
    process.exitCode = 1;
  }
}
