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
  // Scroll far enough to mount a coalesced teen row, so its disc and its
  // composition line are measured rather than assumed.
  for (let i = 0; i < 14; i += 1) {
    if (await page.locator('[role="treeitem"][aria-expanded]').count()) break;
    const more = await page.evaluate(() => {
      const el = document.querySelector('[data-anno-ref="tasks-worklist-scroller"]');
      if (!el) return false;
      const before = el.scrollTop;
      el.scrollTop = before + el.clientHeight * 0.9;
      el.dispatchEvent(new Event("scroll"));
      return el.scrollTop > before;
    });
    await page.waitForTimeout(160);
    if (!more) break;
  }

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

    // Band header ink — the one place a tier is named.
    const header = [...document.querySelectorAll('[role="group"] > div[aria-hidden]')][0];
    push("band header", header?.querySelector("span") ?? header, 4.5);

    // Row ink, both lines.
    const row = q('[role="treeitem"]');
    push("row · teen name", row?.querySelector("span.min-w-0 > span"), 4.5);
    push(
      "row · mentor + composition",
      row?.querySelectorAll("span.min-w-0 > span")[1],
      4.5
    );
    push("row · age (mono)", [...(row?.querySelectorAll("span") ?? [])].at(-1), 4.5);

    /* IDENTITY DISC. The initial has to be legible (4.5), and the disc has to
       stay QUIET against the row it sits on — the failure that sent this back to
       the drawing board was a ground measuring 11.5:1 on the dark card, which
       made eight identity dots the brightest thing on a safeguarding surface.
       There is no floor for "quiet", so the ratio is recorded and the ceiling is
       asserted separately below. */
    const disc = row?.querySelector('span[aria-hidden][style*="background"]');
    push("identity disc initial", disc, 4.5);
    if (disc) {
      const cs = getComputedStyle(disc);
      out.push({
        label: "identity disc ground (must stay quiet)",
        fg: cs.backgroundColor,
        bg: groundOf(disc.parentElement),
        px: 99, // not text; the 3:1 non-text floor does not apply to a tint
        weight: "400",
        min: 1,
        ceiling: 2.5,
      });
    }

    // Breach chip.
    const breach = [...document.querySelectorAll('[role="treeitem"] span')].find((e) =>
      /Overdue/.test(e.textContent ?? "")
    );
    push("breach chip", breach, 4.5);

    // Escalation states.
    for (const state of ["active", "documentationDue", "documentationOverdue"]) {
      const li = q(`li[data-escalation-state="${state}"]`);
      push(`escalation · ${state} · name`, li?.querySelector("button span.min-w-0 > span"), 4.5);
      const fact = [...(li?.querySelectorAll("button > span") ?? [])].find((e) =>
        /Closed|Active|911/.test(e.textContent ?? "")
      );
      push(`escalation · ${state} · fact`, fact, 4.5);
      push(`escalation · ${state} · action`, li?.querySelector("a"), 4.5);
    }
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
