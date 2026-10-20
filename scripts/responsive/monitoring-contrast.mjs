// CONTRAST ON EVERY COLOUR MONITORING ACTUALLY USES, both themes.
//
// ═══ THE BRIEF ASKED FOR "ALL THREE TIER TINTS" AND THERE ARE NONE ═══
//
// The tier is deliberately NOT on the row. §3.3's alarm budget: "a chip that is
// identical on every row in its neighbourhood is not information", and `bands.ts`
// carries the same argument at the display layer — the band header names the
// urgency once, for a run of rows. Minting three tier tints would have been three
// new tokens against a zero-new-tokens rule, to encode in colour something the
// surface already says in words.
//
// So this measures what IS on screen: the band header ink, the identity discs,
// the escalation states, the breach chip and the row ink. Read from the LIVE
// PAGE via `getComputedStyle` rather than from the token file, because what
// matters is the pair that actually renders — a token measured against the wrong
// surface is a number that looks like evidence and is not.
//
// WCAG 2.2 AA: 4.5:1 for text under 18.66px, 3:1 for large text and non-text
// boundaries.

import { mkdir, writeFile } from "node:fs/promises";
import { VIEWPORTS, launch, openView, readStoreVersion, BASE, subjectMovedFrom, exitSubjectRetired } from "./harness.mjs";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

const OUT = "docs/responsive/monitoring";
const version = await readStoreVersion();
const browser = await launch();
/* ═══ THE FOLDED DASHBOARD, ASKED FIRST (proto/monitoring-merge) ═══ This
   file's subject is /app/risk-flags's dashboard. See `subjectMovedFrom` in the harness. */
{
  const landed = await subjectMovedFrom(browser, "/app/risk-flags", version);
  if (landed) await exitSubjectRetired(browser, "monitoring-contrast", "/app/risk-flags", landed, "monitoring-tiers.mjs");
}
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;

/** ═══ THREE COMPUTED COLOUR FORMS, ONE LUMINANCE ═══
 *
 *  Chrome resolves `rgb()` as `rgb()`, but a `color-mix(in oklab, …)` comes back
 *  as `oklab(L a b)` and a wide-gamut value as `color(srgb …)`. The first version
 *  of this parser matched only `rgb`, returned null, and `continue`d — so the
 *  identity-disc rows did not fail, they DISAPPEARED from the report. That is the
 *  same silent-pass shape as the `-1` sentinel the state probe carried, and it is
 *  the failure mode a contrast report can least afford: a clean run that checked
 *  fewer things than it listed.
 *
 *  Everything is converted to LINEAR sRGB and luminance is taken from there, so
 *  the oklab path does not have to round-trip through a gamma encode it would
 *  only have to undo. */
const srgbToLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function oklabToLinear(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Returns LINEAR sRGB in 0..1, or null if the form is unknown — and an unknown
 *  form is reported, never skipped. */
const parse = (css) => {
  const rgb = css.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    return rgb[1]
      .split(/[,\s/]+/)
      .slice(0, 3)
      .map((v) => srgbToLinear(parseFloat(v) / 255));
  }
  const c = css.match(/color\(srgb\s+([^)]+)\)/);
  if (c) {
    return c[1]
      .trim()
      .split(/[\s/]+/)
      .slice(0, 3)
      .map((v) => srgbToLinear(parseFloat(v)));
  }
  const ok = css.match(/oklab\(([^)]+)\)/);
  if (ok) {
    const [L, A, B] = ok[1].trim().split(/[\s/]+/).slice(0, 3).map(parseFloat);
    return oklabToLinear(L, A, B);
  }
  return null;
};

const lum = (rgbLinear) =>
  0.2126 * rgbLinear[0] + 0.7152 * rgbLinear[1] + 0.0722 * rgbLinear[2];
const ratio = (a, b) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

for (const theme of ["light", "dark"]) {
  const { context, page } = await openView(
    browser,
    {
      id: `contrast-${theme}`,
      url: "/app/risk-flags",
      seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift" } },
      /* ═══ THE THEME COMES FROM THE SEED, NOT FROM `emulateMedia` ═══
         It was `page.emulateMedia({ colorScheme: theme })` below, and this app
         reads `localStorage["somethings.theme"]` and applies a `.dark` class —
         it never consults `prefers-color-scheme`. So BOTH RUNS MEASURED THE
         LIGHT THEME and one of them said "dark": `dark row · subject` reported
         16.64:1, the light value, on every run since this file was written.
         Caught while measuring §5.1's own toggle, when a dark run came back
         byte-identical to its light one. `openView` takes `theme` now. */
      theme,
    },
    { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 },
    version
  );
  await page.waitForTimeout(400);
  /* ═══ RETARGETED BY arch-mon ═══
     The old sample list read the tier band header, the coalesced teen row's
     identity disc and the three escalation lifecycle rows. Two of those are
     gone with the tiers; the third changed shape. It also SILENTLY SKIPPED its
     own breach-chip row — `push` returned early on a missing element and the
     scroll loop had moved every "Overdue" row out of the DOM, so the report read
     ALL PAIRS PASS having checked one fewer pair than it listed (gap row 366's
     rule, broken by the file that recorded it). Every `push` below therefore
     records a MISSING row rather than returning, and a missing row fails. */
  const samples = await page.evaluate(`(() => {
    const groundOf = (el) => {
      let n = el;
      while (n) {
        const bg = getComputedStyle(n).backgroundColor;
        /* STRING COMPARISON, NOT A REGEX. A regex here is authored inside a
           template literal that is then evaluated in the page, and the backslash
           does not survive the round trip: \\( arrives as ( and the pattern
           silently becomes a capture group that matches nothing. Every ground
           then resolved to "rgba(0, 0, 0, 0)" and ten pairs reported 1.26:1
           against a transparent black. Gap row 368's failure, third occurrence,
           in the file that recorded the rule. */
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
        n = n.parentElement;
      }
      return "rgb(255, 255, 255)";
    };
    const out = [];
    const push = (label, el, min, extra) => {
      if (!el) { out.push({ label, min, missing: true }); return; }
      const cs = getComputedStyle(el);
      out.push({ label, fg: cs.color, bg: groundOf(el), px: parseFloat(cs.fontSize), weight: cs.fontWeight, min, ...(extra || {}) });
    };
    const q = (sel) => document.querySelector(sel);
    const rowSpans = [...document.querySelectorAll('[role="treeitem"] span')];
    const text = (re) => rowSpans.find((e) => re.test((e.innerText || "").trim()) && !e.querySelector("span"));

    /* ═══ NO BACKTICKS IN THESE COMMENTS ═══
       This whole block is a template literal evaluated in the page, so a
       backtick in a comment CLOSES THE LITERAL and the file stops parsing —
       "missing ) after argument list", pointing at a comment. Third occurrence
       of this class in this file's neighbourhood; the header already records
       the backslash version of the same round-trip problem. */
    /* ═══ THE GROUP HEADER IS GONE (arch-mon) ═══
       "Monitoring groups by nothing, and never by a tier or a deadline." The
       tier bands went with the tier taxonomy, so there is no group header to
       measure — MEASURED: zero [role="group"] on this surface.
       RETIRED RATHER THAN LEFT RED. Its absence is already asserted, by
       e.monitoring-no-invented-bands in row-semantics, which is the right
       place for a structural claim; a contrast suite reporting MISSING on a
       deliberately absent element is noise that hides real failures. */

    // ROW: the emphasised subject, the secondary category line, the mono age.
    push("row · subject", q('[role="treeitem"] span.font-display'), 4.5);
    /* ═══ THE CATEGORY, DERIVED RATHER THAN LISTED ═══
       This matched /^(Self-harm language|Family conflict|Low mood)$/ — three
       label strings hardcoded into the probe. The classifier's categories
       changed and the list did not, so the pair read MISSING while the
       category sat on every row: MEASURED, row one carries "Unsafe home
       environment".
       A LIST OF LABELS IS THE WRONG SELECTOR for a set the app owns. This
       describes the SHAPE instead: a multi-word clinical phrase on the row
       that is not a name, not an age, and not one of the two markers below. */
    push(
      "row · category (secondary)",
      rowSpans.find((e) => {
        if (e.querySelector("span")) return false;
        const t = (e.innerText || "").trim();
        if (!/ /.test(t) || t.length < 10) return false;
        if (/ ago$/.test(t)) return false;
        if (/^Escalation open$/.test(t)) return false;
        if (/in this conversation$/.test(t)) return false;
        if (/^[A-Z][a-z]+ [A-Z]\.$/.test(t)) return false;
        if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(t)) return false;
        return true;
      }),
      4.5
    );
    push("row · age (mono)", text(/ ago$/), 4.5);

    // THE ROW'S MARKERS — the comparator's reasons, none of them breach
    // treatment and none of them colour alone.
    push("row marker · escalation open", text(/^Escalation open$/), 4.5);
    push("row marker · pattern", text(/in this conversation$/), 4.5);

    // IDENTITY DISC — legible initial, and a ground that must stay quiet.
    const disc = q('[role="treeitem"] span[style*="background"]');
    push("identity disc initial", disc, 4.5);
    if (disc) {
      const cs = getComputedStyle(disc);
      out.push({ label: "identity disc ground (must stay quiet)", fg: cs.backgroundColor, bg: groundOf(disc.parentElement), px: 99, weight: "400", min: 1, ceiling: 2.5 });
    }

    /* ═══ THE ESCALATION PAIRS MOVED TO THEIR OWN ROUTE (IA restructure) ═══
       Seven pairs stood here — the active fill's role label, teen name, state,
       ack clock and action, plus a settled record's state and age — and one
       more below for the breach chip. All eight read MISSING on every run.
       THEY ARE NOT GONE; THEY ARE NOT HERE. The escalation region moved to
       /app/escalations when Monitoring became a group label, and this page
       samples /app/risk-flags. MEASURED: zero li[data-escalation-state] on
       risk-flags and four on escalations, where the ack clocks also read "ack
       7h overdue".
       SO THEY ARE SAMPLED ON THAT ROUTE, in a second pass below, with the same
       thresholds and the same ground resolution. A pair measured on a surface
       that does not have it is not a passing check or a failing one — it is a
       check that never ran. */

    // THE PANE: the category chip, the disposition control, the optional axis.
    push("pane · category chip", q('[data-slot="event-pane"] span.inline-flex'), 4.5);
    push("pane · disposition (chosen)", q("[data-disposition]"), 4.5);
    push("pane · accuracy (optional)", q("[data-accuracy]"), 4.5);
    push("pane · record button", q('[data-action="record"]'), 4.5);

    /* ═══ THE COVERAGE METER IS GONE (addendum §2.2, then §5.4) ═══
       Coverage became Chat and lib/monitoring/coverage.ts is dormant; the
       shift track that replaced it on this surface was then removed by the
       Care Reviews rework §5.4. MEASURED: zero matching paragraphs.
       Retired for the same reason as the group header. */
    return out;
  })()`);

  for (const s of samples) {
    if (s.missing) {
      failed += 1;
      rows.push({ theme, ...s, ratio: null, ok: false });
      console.log(`  × ${theme.padEnd(5)} ${s.label.padEnd(40)} MISSING — not in the DOM, so not checked`);
      continue;
    }
    const fg = parse(s.fg);
    const bg = parse(s.bg);
    if (!fg || !bg) {
      // LOUDLY, not `continue`. A colour this script cannot read is a colour it
      // has not checked, and a report that quietly omits a row reads as a clean
      // report.
      failed += 1;
      rows.push({ theme, ...s, ratio: null, ok: false, unreadable: [s.fg, s.bg] });
      console.log(`  × ${theme.padEnd(5)} ${s.label.padEnd(40)} UNREADABLE (${s.fg} on ${s.bg})`);
      continue;
    }
    const r = ratio(fg, bg);
    // Large text is 18.66px+ at normal weight, or 14px+ at 700.
    const large = s.px >= 18.66 || (s.px >= 14 && Number(s.weight) >= 700);
    const min = large ? 3 : s.min;
    /* A CEILING, not a floor, for the one thing that must not shout. */
    const ok = s.ceiling ? r <= s.ceiling : r >= min;
    if (!ok) failed += 1;
    rows.push({ theme, ...s, ratio: Number(r.toFixed(2)), min, ok });
    console.log(
      `  ${ok ? "✓" : "×"} ${theme.padEnd(5)} ${s.label.padEnd(40)} ${r.toFixed(2).padStart(5)}:1  (${s.ceiling ? `max ${s.ceiling}` : `needs ${min}`}, ${s.px === 99 ? "tint" : `${s.px}px/${s.weight}`})${ok ? "" : `  fg=${s.fg} bg=${s.bg}`}`
    );
  }
  await context.close();

  // ═══════════════════════════════════════════════════════════════════════
  // THE ESCALATION REGION, ON THE ROUTE THAT HAS IT
  //
  // Eight pairs used to be sampled on /app/risk-flags and read MISSING on
  // every run, because the escalation region moved to /app/escalations when
  // Monitoring became a group label. Same thresholds, same ground resolution,
  // same theme — only the URL differs.
  //
  // A SECOND PASS RATHER THAN A SECOND FILE, so the two routes cannot drift
  // apart on how a ratio is computed or what counts as large text.
  // ═══════════════════════════════════════════════════════════════════════
  {
    const { context: c2, page: p2 } = await openView(
      browser,
      {
        id: `contrast-esc-${theme}`,
        url: "/app/escalations",
        seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift" } },
        theme,
      },
      { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 },
      version
    );
    await p2.waitForTimeout(600);
    const esc = await p2.evaluate(`(() => {
      const groundOf = (el) => {
        let n = el;
        while (n) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
          n = n.parentElement;
        }
        return "rgb(255, 255, 255)";
      };
      const out = [];
      const push = (label, el, min) => {
        if (!el) { out.push({ label, min, missing: true }); return; }
        const cs = getComputedStyle(el);
        out.push({ label, fg: cs.color, bg: groundOf(el), px: parseFloat(cs.fontSize), weight: cs.fontWeight, min });
      };
      const spans = (root) => [...(root?.querySelectorAll("span") ?? [])].filter((e) => !e.querySelector("span"));
      const leaf = (root, re) => spans(root).find((e) => re.test((e.innerText || "").trim()));

      /* THE ACTIVE FILL — the loudest treatment in the product, and every
         string on it has to survive the fill it sits on. */
      const fill = document.querySelector('li[data-escalation-state="active"]');
      push("escalation fill · role label", leaf(fill, /^(teen|mentor)$/i), 4.5);
      push("escalation fill · teen name", leaf(fill, /^[A-Z][a-z]+ [A-Z][.]$/), 4.5);
      push("escalation fill · state", leaf(fill, /911|No 911|Active/), 4.5);
      push("escalation fill · ack clock", leaf(fill, /^ack /), 4.5);
      push("escalation fill · action", fill?.querySelector("a"), 4.5);

      /* A SETTLED RECORD, which must stay calm and still be readable. */
      const calm = document.querySelector('li[data-escalation-state="closeout-open"]');
      push("escalation calm · state", leaf(calm, /Closed|close-out|Resolved/i), 4.5);
      push("escalation calm · age", leaf(calm, / ago$| elapsed$/), 4.5);

      /* THE BREACH TREATMENT — and it lives here, not on the flag queue.
         The old selector ended in /Alert|/.test("") , which matches the empty
         string and so tested nothing; what it actually asked for was any leaf
         containing "overdue". MEASURED here: "ack 7h overdue". */
      push("breach chip (overdue)", leaf(document, /overdue/i), 4.5);
      return out;
    })()`);

    for (const s of esc) {
      if (s.missing) {
        failed += 1;
        rows.push({ theme, ...s, ratio: null, ok: false });
        console.log(`  × ${theme.padEnd(5)} ${s.label.padEnd(40)} MISSING — not in the DOM, so not checked`);
        continue;
      }
      const fg = parse(s.fg);
      const bg = parse(s.bg);
      if (!fg || !bg) {
        failed += 1;
        rows.push({ theme, ...s, ratio: null, ok: false, unreadable: [s.fg, s.bg] });
        console.log(`  × ${theme.padEnd(5)} ${s.label.padEnd(40)} UNREADABLE (${s.fg} on ${s.bg})`);
        continue;
      }
      const r = ratio(fg, bg);
      const large = s.px >= 18.66 || (s.px >= 14 && Number(s.weight) >= 700);
      const min = large ? 3 : s.min;
      const ok = r >= min;
      if (!ok) failed += 1;
      rows.push({ theme, ...s, ratio: Number(r.toFixed(2)), min, ok });
      console.log(
        `  ${ok ? "✓" : "×"} ${theme.padEnd(5)} ${s.label.padEnd(40)} ${r.toFixed(2).padStart(5)}:1  (needs ${min}, ${s.px}px/${s.weight})${ok ? "" : `  fg=${s.fg} bg=${s.bg}`}`
      );
    }
    await c2.close();
  }
}

await browser.close();
await writeFile(`${OUT}/contrast.json`, JSON.stringify({ base: BASE, rows }, null, 2));

// ═══════════════════════════════════════════════════════════════════════════
// THE COUNT GUARD — BECAUSE "ALL PAIRS PASS" IS ALSO WHAT ZERO PAIRS SAY
//
// While repairing this file I removed eight misplaced pairs and it immediately
// printed ALL PAIRS PASS, having checked eight fewer things than the run
// before. That is the same defect this file's own header records twice — a
// report that omits a row reading as a clean report — and the header's fix
// (every `push` records a MISSING row rather than returning) only catches a
// pair whose ELEMENT is absent. It cannot catch a pair whose `push` was
// deleted.
//
// So the total is asserted. 19 per theme, two themes: 11 on the flag queue and
// its pane, 8 on the escalation route. Changing the sample list means changing
// this number, deliberately, in the same commit.
const EXPECTED_PER_THEME = 19;
const EXPECTED = EXPECTED_PER_THEME * 2;
if (rows.length !== EXPECTED) {
  console.log(
    `\n✗ SAMPLE COUNT CHANGED — ${rows.length} pair(s) checked, ${EXPECTED} expected.` +
      `\n  A pair was added or removed. Update EXPECTED_PER_THEME in this file` +
      `\n  in the same commit, so the change is a decision rather than a drift.`
  );
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE THEME GUARD — BECAUSE A FAKE DARK RUN PASSES
//
// The defect that started this repair was a dark run that measured the light
// theme, and it PASSED: both runs reported identical ratios and both were
// above the floor, so the suite was green while testing one theme twice.
// Neither the missing-element guard nor the count guard catches that — the
// elements were all present and all counted.
//
// So the two runs are compared. They must differ SOMEWHERE: most tokens are
// mode-specific, and if not one pair moved then the class never switched.
//
// NOT "EVERY PAIR MUST DIFFER". Several legitimately do not — the escalation
// fill is an alarm treatment that holds the same clay in both modes, and it
// measures 5.24:1 either way. Requiring universal difference would fail on
// correct behaviour. A handful is the honest threshold.
const byLabel = new Map();
for (const r of rows) {
  if (r.ratio == null) continue;
  const e = byLabel.get(r.label) ?? {};
  e[r.theme] = r.ratio;
  byLabel.set(r.label, e);
}
const comparable = [...byLabel.values()].filter((e) => e.light != null && e.dark != null);
const moved = comparable.filter((e) => e.light !== e.dark).length;
const MIN_MOVED = 4;
if (comparable.length > 0 && moved < MIN_MOVED) {
  console.log(
    `\n✗ THE THEMES DID NOT DIVERGE — only ${moved} of ${comparable.length} pair(s) differ` +
      `\n  between light and dark, which means the theme probably never switched.` +
      `\n  This app reads localStorage["somethings.theme"] and applies a .dark` +
      `\n  class; it ignores prefers-color-scheme, so emulateMedia does nothing.` +
      `\n  Pass \`theme\` through openView instead.`
  );
  process.exit(1);
}

console.log(failed ? `\n${failed} PAIR(S) BELOW THE FLOOR` : `\nALL ${EXPECTED} PAIRS PASS · ${moved}/${comparable.length} differ by theme`);
process.exit(failed ? 1 : 0);
