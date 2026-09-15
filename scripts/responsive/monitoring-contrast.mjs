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
import { VIEWPORTS, launch, openView, readStoreVersion, BASE } from "./harness.mjs";

const OUT = "docs/responsive/monitoring";
const version = await readStoreVersion();
const browser = await launch();
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
      url: "/app/monitoring",
      seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift" } },
    },
    { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 },
    version
  );
  await page.emulateMedia({ colorScheme: theme });
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

    // GROUP HEADER — the one place the noun phrase lives.
    push("group header", q('[role="group"] > div[aria-hidden] span'), 4.5);

    // ROW: the emphasised subject, the secondary category line, the mono age.
    push("row · subject", q('[role="treeitem"] span.font-display'), 4.5);
    push("row · category (secondary)", text(/^(Self-harm language|Family conflict|Low mood)$/), 4.5);
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

    // THE ESCALATION STRIP ON ITS FILL — role labels, state, clock, action.
    const fill = q('li[data-escalation-state="active"]');
    push("escalation fill · role label", [...(fill?.querySelectorAll("span") ?? [])].find((e) => ["teen","mentor"].includes((e.innerText || "").trim().toLowerCase())), 4.5);
    push("escalation fill · teen name", [...(fill?.querySelectorAll("span") ?? [])].find((e) => /^[A-Z][a-z]+ [A-Z]\.$/.test((e.innerText || "").trim())), 4.5);
    push("escalation fill · state", [...(fill?.querySelectorAll("span") ?? [])].find((e) => /Active/.test(e.innerText || "")), 4.5);
    push("escalation fill · ack clock", [...(fill?.querySelectorAll("span") ?? [])].find((e) => /^ack /.test((e.innerText || "").trim())), 4.5);
    push("escalation fill · action", fill?.querySelector("a"), 4.5);

    // A RESOLVED RECORD, which must stay calm and still be readable.
    const calm = q('li[data-escalation-state="closeout-open"]');
    push("escalation calm · state", [...(calm?.querySelectorAll("span") ?? [])].find((e) => /Closed/.test(e.innerText || "")), 4.5);
    push("escalation calm · age", [...(calm?.querySelectorAll("span") ?? [])].find((e) => / ago$/.test((e.innerText || "").trim())), 4.5);

    // THE BREACH TREATMENT — the only one left on the page.
    push("breach chip (overdue)", [...document.querySelectorAll("span")].find((e) => /overdue/i.test(e.innerText || "") && !e.querySelector("span") && /Alert|/.test("")), 4.5);

    // THE PANE: the category chip, the disposition control, the optional axis.
    push("pane · category chip", q('[data-slot="event-pane"] span.inline-flex'), 4.5);
    push("pane · disposition (chosen)", q("[data-disposition]"), 4.5);
    push("pane · accuracy (optional)", q("[data-accuracy]"), 4.5);
    push("pane · record button", q('[data-action="record"]'), 4.5);

    // THE COVERAGE METER'S OWN TEXT.
    push("coverage line", [...document.querySelectorAll("p")].find((e) => /conversations reviewed this/.test(e.innerText || "")), 4.5);
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
}

await browser.close();
await writeFile(`${OUT}/contrast.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} PAIR(S) BELOW THE FLOOR` : "\nALL PAIRS PASS");
process.exit(failed ? 1 : 0);
