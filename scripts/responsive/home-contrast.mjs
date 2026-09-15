// CONTRAST ON EVERY COLOUR HOME ACTUALLY USES, both themes.
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

const OUT = "docs/responsive/home";
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
      id: `home-contrast-${theme}`,
      url: "/app/home",
      seed: {
        persona: "supervisor",
        extra: { tasksScenarioId: "typical-shift", shiftLastSeenAt: 0 },
      },
    },
    { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 },
    version
  );
  await page.emulateMedia({ colorScheme: theme });
  await page.waitForTimeout(400);
  /** Walk up for the first non-transparent background — what the ink actually
   *  sits on, which is rarely the element's own. */
  const samples = await page.evaluate(() => {
    const groundOf = (el) => {
      let n = el;
      while (n) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
        n = n.parentElement;
      }
      return "rgb(255, 255, 255)";
    };
    const out = [];
    const push = (label, el, min) => {
      if (!el) return;
      const cs = getComputedStyle(el);
      out.push({
        label,
        fg: cs.color,
        bg: groundOf(el),
        px: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        min,
      });
    };
    const q = (sel) => document.querySelector(sel);

    push("page title", q("main h1"), 4.5);
    push("page subtitle", q("main h1 + p"), 4.5);

    /* THE ESCALATION STRIP — the one saturated ground on Home, and the place a
       tinted pill failed at 3.84:1 on the sibling surface. */
    const strip = q('[data-anno-ref="home-escalation-strip"]');
    push("strip · teen", strip?.querySelector("span.min-w-0 > span"), 4.5);
    push("strip · mentor", strip?.querySelectorAll("span.min-w-0 > span")[1], 4.5);
    push("strip · 911", [...(strip?.querySelectorAll("li > span") ?? [])].find((e) => /911/.test(e.textContent ?? "")), 4.5);
    push("strip · elapsed", [...(strip?.querySelectorAll("li > span") ?? [])].find((e) => /elapsed/.test(e.textContent ?? "")), 4.5);
    push("strip · action", strip?.querySelector("a"), 4.5);

    /* THE SEQUENCE — the state line is toned per stage, so BOTH a breach line and
       a clear one are sampled rather than whichever happened to be first. */
    const rows = [...document.querySelectorAll("[data-stage]")];
    const lineOf = (row) => row?.querySelectorAll("span.min-w-0 > span")[1];
    push("stage · label", rows[0]?.querySelector("span.min-w-0 > span"), 4.5);
    const breachRow = rows.find((r) => /past|overdue|open now/.test(r.innerText));
    const clearRow = rows.find((r) => /All clear|within SLA|Not tracked/.test(r.innerText));
    push("stage · breach line", lineOf(breachRow), 4.5);
    push("stage · calm line", lineOf(clearRow), 4.5);

    /* THE DIGEST — breach chips and neutral chips are different grounds. */
    const digest = q('[data-anno-ref="home-digest"]');
    push("digest · heading", digest?.querySelector("p"), 4.5);
    push("digest · breach chip", digest?.querySelector('a[data-tone="breach"]'), 4.5);
    push("digest · neutral chip", digest?.querySelector('a[data-tone="attention"]'), 4.5);
    push("digest · CTA", [...(digest?.querySelectorAll("a") ?? [])].find((a) => /^Start with/.test(a.innerText.trim())), 4.5);

    /* CLOSED TODAY — the quietest ink on the page, which is where a muted token
       on the wrong surface fails (gap row 294). */
    const closed = q('[data-anno-ref="home-closed-today"]');
    push("closed today · label", closed?.querySelector("p"), 4.5);
    push("closed today · link", closed?.querySelector("a"), 4.5);

    return out;
  });

  for (const s of samples) {
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
      `  ${ok ? "✓" : "×"} ${theme.padEnd(5)} ${s.label.padEnd(40)} ${r.toFixed(2).padStart(5)}:1  (${s.ceiling ? `max ${s.ceiling}` : `needs ${min}`}, ${s.px === 99 ? "tint" : `${s.px}px/${s.weight}`})`
    );
  }
  await context.close();
}

await browser.close();
await writeFile(`${OUT}/contrast.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} PAIR(S) BELOW THE FLOOR` : "\nALL PAIRS PASS");
process.exit(failed ? 1 : 0);
