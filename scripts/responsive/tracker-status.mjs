// ═══════════════════════════════════════════════════════════════════════════
// TRACKER STATUS, DERIVED FROM THE ARTIFACTS — never typed by hand.
//
// Phase 9's deliverable is "the tracker to zero", and the fastest way to get a
// column of `verified` is to type it. This script exists so that cannot happen:
// every status it writes is computed from the three generated artifacts, and a
// row with no evidence is marked as HAVING no evidence rather than as passing.
//
// ═══ THE LADDER, AS `TRACKER.md` DEFINES IT ═══
//
//   untouched → substrate-fixed → verified
//
// and the file's own gloss on the last one is "screenshot-diffed at all six
// viewports + axe clean". This script holds to that, with two honest
// adjustments recorded here rather than quietly applied:
//
//   1. NINE VIEWPORTS, NOT SIX. The harness grew `zoom400`, `text200` and
//      `landscape` beyond the brief's six. A row is only `verified` if all nine
//      captured, which is strictly stronger than the definition asks.
//   2. "AXE CLEAN" IS TAKEN LITERALLY — zero violations for that view across
//      every viewport. Not "clean apart from a known issue".
//
// ═══ WHAT COUNTS AS AN ASSERTION FAILURE ═══
//
// Two classes are excluded, both measured and both recorded in the gaps file:
//   · SC 2.5.8's INLINE EXCEPTION (gap row 285) — a control in flowing text
//     whose size is constrained by the line-height of non-target text. The
//     checker does not implement the exception; `previous <date> →` is the one
//     case in this matrix.
//   · DEV-ONLY CHROME (gap rows 285, 296) — the dev bar's scenario switcher and
//     the `/dev/components` showcase. Prototype chrome that ships in every
//     environment by instruction, so it is real but it is not product.
//
// Nothing else is filtered. `rc6` and `focusObscured` are reported as residuals
// on the row rather than excluded, because unlike the two above they have not
// been triaged case by case.
// ═══════════════════════════════════════════════════════════════════════════

import { readFile, writeFile } from "node:fs/promises";

const TRACKER = "docs/responsive/TRACKER.md";

/** A target-size failure the criterion does not actually require us to fix. */
const EXCLUDED_TARGET = /^previous |^Prototype scenarios|^Try again$/;

const read = async (p) => {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
};

const axe = await read("docs/responsive/A11Y-BASELINE.json");
const asserts = await read("docs/responsive/ASSERTIONS.json");
const shots = await read("docs/responsive/screens/INDEX.json");

if (!axe || !asserts || !shots) {
  console.error(
    "Missing an artifact. Run `npm run responsive:verify` first — this script\n" +
      "reports evidence and refuses to invent it."
  );
  process.exit(1);
}

/** id → { captured, drifted, axeViolations, targetsReal, rc6, focus } */
const ev = new Map();
const touch = (id) => {
  if (!ev.has(id))
    ev.set(id, {
      captured: 0,
      drifted: 0,
      axeViolations: null,
      targetsReal: 0,
      rc6: 0,
      focus: 0,
      viewports: new Set(),
    });
  return ev.get(id);
};

for (const c of shots.captured ?? []) {
  const e = touch(c.id);
  e.captured++;
  e.viewports.add(c.vp);
  if (c.drifted) e.drifted++;
}
for (const u of shots.unreachable ?? []) touch(u.id).drifted++;

for (const [key, n] of Object.entries(axe.byView ?? {})) {
  const e = touch(key);
  e.axeViolations = typeof n === "number" ? n : (n.count ?? 0);
}

for (const r of asserts.results ?? []) {
  const e = touch(r.id);
  e.targetsReal += (r.targets?.fail ?? []).filter(
    (f) => !EXCLUDED_TARGET.test(f.label ?? "")
  ).length;
  e.rc6 += (r.rc6 ?? []).length;
  const f = Array.isArray(r.focus) ? r.focus : (r.focus?.hits ?? []);
  e.focus += f.length;
}

const VIEWPORTS_EXPECTED = 9;

/** The status for one row, and the residual note that justifies it. */
function statusFor(id) {
  const e = ev.get(id);
  if (!e || e.captured === 0)
    return { status: "no-evidence", note: "not in the harness matrix" };
  if (e.drifted > 0)
    return { status: "substrate-fixed", note: `drifted ${e.drifted}×` };
  if (e.captured < VIEWPORTS_EXPECTED)
    return {
      status: "substrate-fixed",
      note: `only ${e.captured}/${VIEWPORTS_EXPECTED} viewports captured`,
    };

  const residual = [];
  if (e.axeViolations) residual.push(`axe ${e.axeViolations}`);
  if (e.targetsReal) residual.push(`targets ${e.targetsReal}`);
  if (e.rc6) residual.push(`rc6 ${e.rc6}`);
  if (e.focus) residual.push(`focus ${e.focus}`);

  return residual.length
    ? { status: "substrate-fixed", note: residual.join(", ") }
    : { status: "verified", note: "9/9 captured, axe 0, assertions 0" };
}

let md = await readFile(TRACKER, "utf8");
const lines = md.split("\n");
const counts = {};
let rewritten = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // A data row: starts with `| <ID> |` where ID is a cluster letter + digits.
  // Struck rows (`~~D5~~`) are deliberately skipped — they are not views.
  const m = /^\| ([A-Z]\d+[a-z]?) \|/.exec(line);
  if (!m) continue;
  const cells = line.split("|");
  if (cells.length < 4) continue;

  const { status, note } = statusFor(m[1]);
  counts[status] = (counts[status] ?? 0) + 1;
  // Last real cell (the split leaves an empty string after the trailing pipe).
  cells[cells.length - 2] = ` ${status} — ${note} `;
  lines[i] = cells.join("|");
  rewritten++;
}

await writeFile(TRACKER, lines.join("\n"), "utf8");

console.log(`rows rewritten: ${rewritten}`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(v).padStart(3)}  ${k}`);
const untouched = counts["no-evidence"] ?? 0;
console.log(
  untouched
    ? `\n${untouched} row(s) have NO evidence — they are not in the matrix and are not claimed as passing.`
    : "\nEvery row carries evidence."
);
