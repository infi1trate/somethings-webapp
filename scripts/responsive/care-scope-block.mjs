// THE SCOPE CONTAINER, AGAINST THE AXIS IT IS DRAWN ON — and the scope stack.
//
// ═══ WHY THIS PROBE EXISTS ═══
//
// The container's geometry was expressed in GRIDLINE positions plus a pixel
// cushion, on an axis whose unit is a MONTH BIN. Those two agree by accident and
// disagree by however wide the edge month's badge happens to be, and neither the
// type system nor a unit test can see it: the box is a `calc()` string on an
// absolutely positioned div, and whether it lands on the bin is a question about
// laid-out pixels.
//
// SO THIS MEASURES THE RENDERED BOX AGAINST THE RENDERED GRIDLINES. Per block:
// which month bins the block touches, where the bin bounds fall, where the box
// falls, and whether the box covers each touched bin without cropping the badge
// sitting on an edge column.
//
// IT ALSO MEASURES THE SCOPE STACK, because both live in the same header and the
// wrap question is a laid-out-pixel question too. A `<p>`'s own
// getClientRects() is ONE rect whether its text wrapped or not — so wrapping is
// measured with a Range over the text, which yields one rect per line box.

import { launch, openView, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-scope-block";
const BLOCKS = ["7d", "30d", "90d", "All"];
const RECORDS = [
  { id: "t17", note: "rich longitudinal — 8 months, dual-type badges on Aug and Sep" },
  { id: "t23", note: "day-30 cadence, shorter span" },
  // THE ZERO STATE. A day-one record has no conversation extraction, so both
  // stats read 0 — and no pattern, so no chart and no scope container. It is
  // here for the header, and the box rows correctly report `skip`.
  { id: "t1", note: "day one — zero stats, no chart" },
];
/** The cushion the box holds off edge content by — mirrors `PAD` in the strip. */
const PAD = 8;

await mkdir(OUT, { recursive: true });
const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, rows: [], stack: [], failures: [] };

for (const rec of RECORDS) {
  const { context, page } = await openView(
    browser,
    { id: `scope-${rec.id}`, url: `/admin/person/${rec.id}?tab=care`, seed: { persona: "supervisor" } },
    { label: "w1280", width: 1280, height: 2200 },
    version
  );
  await page.waitForTimeout(900);

  for (const block of BLOCKS) {
    await page.evaluate((label) => {
      const btn = [...document.querySelectorAll('[aria-label="Care summary time period"] button')]
        .find((b) => b.textContent.trim() === label);
      btn?.click();
    }, block);
    await page.waitForTimeout(350);

    const m = await page.evaluate(() => {
      const sec = document.querySelector('[data-record-section="care-summary-doc"]');
      if (!sec) return { skip: "no summary card" };
      const box = sec.querySelector('div[aria-hidden][class*="inset-y-0"][class*="absolute"]');
      if (!box) return { skip: "no scope container" };
      const plot = box.parentElement;
      const pr = plot.getBoundingClientRect();
      const rel = (x) => +(x - pr.left).toFixed(1);

      // ── THE AXIS. The month labels ARE the gridlines: both are positioned
      //    from the same `monthX[i].x`, and the label row is the only one whose
      //    elements carry the month's name.
      const labelRow = plot.querySelector('div[class*="mb-1"]');
      const months = [...labelRow.querySelectorAll("span")]
        .map((s) => {
          const r = s.getBoundingClientRect();
          return { name: s.textContent.trim(), x: rel(r.left + r.width / 2) };
        })
        .filter((mo) => /^[A-Z][a-z]{2}$/.test(mo.name));
      const colW = months.length > 1 ? +(months[1].x - months[0].x).toFixed(1) : null;
      const half = colW ? colW / 2 : pr.width / 2;

      // ── THE BADGE ROW, which is what the cushion exists to clear.
      const badgeRow = [...plot.querySelectorAll("div")].find(
        (d) => d !== plot && d.querySelector('[class*="min-w-6"], [class*="rounded-full"]') && d.getBoundingClientRect().top > pr.top + pr.height / 2
      );
      const badges = badgeRow
        ? [...badgeRow.children].map((b) => {
            const r = b.getBoundingClientRect();
            return { l: rel(r.left), r: rel(r.right), w: +r.width.toFixed(1) };
          })
        : [];

      const br = box.getBoundingClientRect();
      const cs = getComputedStyle(box);
      const scopeLine = sec.querySelector('[aria-live] p')?.textContent ?? "";

      return {
        plotW: +pr.width.toFixed(1),
        colW,
        months,
        badges,
        box: { l: rel(br.left), r: rel(br.right), w: +br.width.toFixed(1), opacity: +cs.opacity, scale: cs.scale },
        inline: { left: box.style.left, width: box.style.width },
        rangeLine: scopeLine,
        half: +half.toFixed(2),
      };
    });

    // NOT `continue` ON A SKIP. The header exists whether or not the chart
    // does — a day-one record has no pattern and therefore no scope container,
    // and its stat row is exactly the zero state this probe needs to see.
    const noBox = Boolean(m.skip);
    if (noBox) report.rows.push({ record: rec.id, block, skip: m.skip });

    // ── WHICH BINS THE BLOCK TOUCHES, from the range line the card itself prints.
    const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    if (!noBox) {
    const dates = [...m.rangeLine.matchAll(/([A-Z][a-z]{2}) (\d{1,2})/g)].map((x) => x[1]);
    const fromI = MON.indexOf(dates[0]), toI = MON.indexOf(dates[dates.length - 1]);
    const touched = m.months.filter((mo) => {
      const i = MON.indexOf(mo.name);
      return i >= fromI && i <= toI;
    });

    const visible = (x) => Math.min(Math.max(x, 0), m.plotW);
    const binL = touched.length ? visible(touched[0].x - m.half) : null;
    const binR = touched.length ? visible(touched[touched.length - 1].x + m.half) : null;
    const invisible = m.box.opacity === 0;

    // ── THE TWO CLAIMS.
    const covers = binL === null || invisible
      ? null
      : m.box.l <= binL + 0.5 && m.box.r >= binR - 0.5;
    // ── THE CLEARANCE CLAIM IS ABOUT IN-SCOPE BADGES ONLY, by CENTRE.
    //    A badge belongs to the column it is centred on, and that column is
    //    either in the block or it is not. An earlier version of this filter
    //    took every badge OVERLAPPING the bin range and reported t17/7d as a
    //    failure at -36.5px — which was the AUGUST pill, correctly outside a
    //    seven-day box. The box cropping a badge it is meant to be marking is a
    //    defect; the box's border passing a badge it is meant to be excluding is
    //    not, and the two need different names.
    const inScope = m.badges.filter((b) => {
      const c = (b.l + b.r) / 2;
      return binL !== null && c >= binL - 0.5 && c <= binR + 0.5;
    });
    const clearance = invisible || !inScope.length ? null : {
      left: +Math.min(...inScope.map((b) => b.l - m.box.l)).toFixed(1),
      right: +Math.min(...inScope.map((b) => m.box.r - b.r)).toFixed(1),
    };
    const clears = clearance === null ? null : clearance.left >= PAD - 0.5 && clearance.right >= PAD - 0.5;

    // ── AND WHAT THE BORDER CROSSES, REPORTED RATHER THAN ASSERTED.
    //    A badge is centred on its gridline and can be wider than its own bin: a
    //    dual-type split pill is 49px on a 44.4px column, so it overhangs into
    //    both neighbours. When the block starts at such a column, no box that
    //    keeps the in-scope pill 8px inside it can also stay clear of the
    //    neighbour's — the columns are narrower than the badges at this rail
    //    width. Measured and named, because the alternative is cropping the
    //    badge the box exists to mark.
    const crossed = invisible ? null : m.badges
      .filter((b) => {
        const c = (b.l + b.r) / 2;
        const out = binL === null || c < binL - 0.5 || c > binR + 0.5;
        return out && b.r > m.box.l && b.l < m.box.r;
      })
      .map((b) => ({ badge: [b.l, b.r], into: +Math.min(b.r - m.box.l, m.box.r - b.l).toFixed(1) }));

    const row = {
      record: rec.id, block,
      range: m.rangeLine,
      plotW: m.plotW, colW: m.colW,
      touched: touched.map((t) => t.name),
      bin: binL === null ? null : [binL, binR],
      box: [m.box.l, m.box.r], boxW: m.box.w,
      inline: m.inline,
      opacity: m.box.opacity, scale: m.box.scale,
      coversBins: covers, badgeClearance: clearance, clearsBadges: clears,
      crossesOutOfScopeBadge: crossed,
    };
    report.rows.push(row);
    if (covers === false) report.failures.push(`${rec.id}/${block}: box [${m.box.l}, ${m.box.r}] does not cover bins [${binL}, ${binR}]`);
    if (clears === false) report.failures.push(`${rec.id}/${block}: badge clearance ${JSON.stringify(clearance)} < ${PAD}px`);
    }

    // ── THE HEADER STACK: rhythm, baselines, scale, utterance.
    //
    //    THE SCALE CHECK IS THE INTERESTING ONE. The stat pattern this row
    //    adopts sets its value at 20px, and this card's title is 16px — so the
    //    claim "the numerals are the largest text after the title" is a claim
    //    about every size the card renders, not just about the two in the
    //    header. Measured by walking the card.
    const stack = await page.evaluate(() => {
      const sec = document.querySelector('[data-record-section="care-summary-doc"]');
      const live = sec.querySelector("[aria-live]");
      const caption = live.querySelector("p");
      const row = live.querySelector("[aria-hidden]");
      const data = [...row.children].map((d) => {
        const [label, value] = d.children;
        const lc = getComputedStyle(label), vc = getComputedStyle(value);
        return {
          label: label.textContent,
          value: value.textContent,
          labelCss: `${lc.fontSize}/${lc.lineHeight} ${lc.letterSpacing} ${lc.color}`,
          valueCss: `${vc.fontSize}/${vc.lineHeight} ${vc.fontVariantNumeric} ${vc.color}`,
          // The BASELINE, not the box top: a taller value box with the same
          // baseline is correct, and comparing tops would call it a defect.
          baseline: +(value.getBoundingClientRect().top + parseFloat(vc.fontSize) * 0.8).toFixed(1),
          labelTop: +label.getBoundingClientRect().top.toFixed(1),
          left: +value.getBoundingClientRect().left.toFixed(1),
        };
      });
      const ctl = sec.querySelector('[aria-label="Care summary time period"]');
      const hdr = sec.querySelector("header");
      const r = (el) => el.getBoundingClientRect();

      // Wrap: a Range yields one client rect per line box; a <p>'s own
      // getClientRects() is one rect whether its text wrapped or not.
      const rg = document.createRange(); rg.selectNodeContents(caption);
      const rects = [...rg.getClientRects()].filter((x) => x.width > 0);
      const capW = +(Math.max(...rects.map((x) => x.right)) - Math.min(...rects.map((x) => x.left))).toFixed(1);

      // Every text size the card renders, largest first.
      const sizes = new Map();
      for (const el of sec.querySelectorAll("*")) {
        const t = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
        if (!t.length) continue;
        const c = getComputedStyle(el);
        const key = `${parseFloat(c.fontSize)}px w${c.fontWeight} ${c.fontFamily.split(",")[0]}`;
        if (!sizes.has(key)) sizes.set(key, t[0].textContent.trim().slice(0, 24));
      }
      const ramp = [...sizes.entries()]
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .map(([k, eg]) => `${k} — "${eg}"`);

      return {
        caption: caption.textContent,
        captionCss: `${getComputedStyle(caption).fontSize}/${getComputedStyle(caption).lineHeight} ${getComputedStyle(caption).color}`,
        captionW: capW,
        captionAvail: +r(caption).width.toFixed(1),
        captionLineBoxes: new Set(rects.map((x) => Math.round(x.top))).size,
        data,
        rowGap: getComputedStyle(row).columnGap,
        rowJustify: getComputedStyle(row).justifyContent,
        gaps: {
          controlToCaption: +(r(caption).top - r(ctl).bottom).toFixed(1),
          captionToRow: +(r(row).top - r(caption).bottom).toFixed(1),
          rowToDivider: +parseFloat(getComputedStyle(hdr).paddingBottom).toFixed(1),
        },
        titleSize: parseFloat(getComputedStyle(sec.querySelector("h2")).fontSize),
        ramp,
        utterance: [...live.childNodes]
          .map((n) => (n.getAttribute && n.getAttribute("aria-hidden") !== null ? "" : n.textContent))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      };
    });
    for (const l of [{ text: stack.caption, lineBoxes: stack.captionLineBoxes }])
      if (l.lineBoxes > 1) report.failures.push(`${rec.id}/${block}: caption "${l.text}" wrapped onto ${l.lineBoxes} lines`);
    // THE TWO CLAIMS ON THE ROW.
    const bases = new Set(stack.data.map((d) => d.baseline));
    if (bases.size > 1) report.failures.push(`${rec.id}/${block}: values do not share a baseline (${[...bases].join(", ")})`);
    /* ═══ THE SCALE CLAIM, AS THREE MEASURABLE PARTS ═══
       "The largest text in the card after the title" cannot be asserted as
       "exactly one size is larger": the shipped value TIES the title at 16px
       rather than sitting below it, because the ramp offers nothing between the
       title's 16px and the body's 14px. So the claim is:
         · nothing in the card is LARGER than the value — it leads the card,
         · the title is not OUTRANKED by it in size — a tie is the ceiling, and
           the title keeps the lead by weight (700 vs 400) and face (Avantt vs
           Lausanne), which size alone cannot express,
         · the value is above body size — otherwise the pattern has failed and
           this is just body text under a small label.
       All three together are what item 8 asks for, and stating them separately
       is what makes the tie a recorded decision rather than a near-miss. */
    const valueSize = parseFloat(stack.data[0].valueCss);
    const larger = stack.ramp.filter((r) => parseFloat(r) > valueSize);
    if (larger.length)
      report.failures.push(`${rec.id}/${block}: text larger than the ${valueSize}px stat value — ${larger.join(" | ")}`);
    if (valueSize > stack.titleSize)
      report.failures.push(`${rec.id}/${block}: the stat value (${valueSize}px) outranks the title (${stack.titleSize}px)`);
    if (valueSize <= 14)
      report.failures.push(`${rec.id}/${block}: the stat value at ${valueSize}px reads as body text`);
    if (stack.gaps.controlToCaption !== 8 || stack.gaps.captionToRow !== 12 || stack.gaps.rowToDivider !== 16)
      report.failures.push(`${rec.id}/${block}: rhythm ${JSON.stringify(stack.gaps)} is not 8 / 12 / 16`);

    report.stack.push({ record: rec.id, block, ...stack });

    // ── THE PICTURE. Clipped to the card so the box and the axis are both legible.
    const card = await page.$('[data-record-section="care-summary-doc"]');
    await card.screenshot({ path: `${OUT}/${rec.id}-${block}.png` });
    // ── THE CHART, CLIPPED WITH ROOM FOR THE BOX ────────────────────────
    //    NOT an element screenshot of the plot: the container extends past the
    //    plot's own edge by design — a badge on the last column is drawn in the
    //    card's padding, and the box has to reach it — so clipping to the plot
    //    cuts off the very edge the claim is about. Clip the plot's rect plus
    //    28px each side, which is inside the card.
    // NO CHART ON A RECORD WITH NO PATTERN — the card shot above is the whole
    // evidence there, and asking for a clip of an element that does not exist
    // is how a probe dies on the one scenario it was extended to cover.
    const clip = noBox
      ? null
      : await page.evaluate(() => {
          const plot = document
            .querySelector('[data-record-section="care-summary-doc"] div[aria-hidden][class*="inset-y-0"]')
            .parentElement;
          const r = plot.getBoundingClientRect();
          return { x: Math.max(0, r.left - 28), y: r.top - 4, width: r.width + 56, height: r.height + 8 };
        });
    if (clip) await page.screenshot({ path: `${OUT}/${rec.id}-${block}-chart.png`, clip });
  }
  // ══ THE TWEEN, ACROSS THE NEW GEOMETRY ═══════════════════════════════════
  //
  // `min()` / `max()` INSIDE A TRANSITIONED PROPERTY IS THE RISK THIS MEASURES.
  // The polish pass shipped a 300ms tween on `left` and `width`; those values
  // are now math functions rather than a plain `calc()`, and interpolation
  // between two different math functions is not something to assume — if the
  // browser cannot interpolate them it falls back to a discrete swap, which
  // looks like the tween was removed.
  //
  // The harness opens every context with `reducedMotion: "reduce"` so that
  // screenshots are deterministic, which also switches the tween off. CDP lifts
  // it for this pass only, on the same page — cheaper and more honest than a
  // second seeded context that might land in a different state.
  if (rec.id === "t17") {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    });
    const tween = await page.evaluate(async () => {
      const sec = document.querySelector('[data-record-section="care-summary-doc"]');
      const box = sec.querySelector('div[aria-hidden][class*="inset-y-0"]');
      const plot = box.parentElement;
      const rel = () => {
        const p = plot.getBoundingClientRect(), b = box.getBoundingClientRect();
        return { l: +(b.left - p.left).toFixed(1), w: +b.width.toFixed(1) };
      };
      const click = (label) => [...document.querySelectorAll('[aria-label="Care summary time period"] button')]
        .find((b) => b.textContent.trim() === label)?.click();
      const frames = [];
      click("30d");
      await new Promise((r) => setTimeout(r, 400));
      const from = rel();
      const t0 = performance.now();
      click("90d");
      // The running transitions, named. READ AFTER A FRAME: called synchronously
      // after the click it returns [], because the style change has not been
      // committed yet — an empty list there reads as "nothing animates", which
      // is the opposite of true.
      await new Promise((r) => requestAnimationFrame(r));
      const running = box.getAnimations().map((a) => a.transitionProperty ?? a.animationName);
      while (performance.now() - t0 < 420) {
        await new Promise((r) => requestAnimationFrame(r));
        frames.push({ dt: Math.round(performance.now() - t0), ...rel() });
      }
      return { from, running, to: rel(), frames };
    });
    const pick = (ms) => tween.frames.reduce((a, b) => (Math.abs(b.dt - ms) < Math.abs(a.dt - ms) ? b : a));
    report.tween = {
      running: tween.running,
      from: tween.from, to: tween.to,
      at: { 30: pick(30), 60: pick(60), 150: pick(150), 300: pick(300) },
      // The claim: at least one sampled frame strictly between the endpoints.
      interpolates: tween.frames.some((f) => f.w > tween.from.w + 1 && f.w < tween.to.w - 1),
    };
    if (!report.tween.interpolates)
      report.failures.push("t17: the scope container snapped instead of tweening — min()/max() did not interpolate");

    // AND THE OTHER HALF OF THE MOTION CLAIM: reduced motion still snaps.
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    report.tween.reducedMotion = await page.evaluate(async () => {
      const box = document
        .querySelector('[data-record-section="care-summary-doc"]')
        .querySelector('div[aria-hidden][class*="inset-y-0"]');
      const plot = box.parentElement;
      const rel = () => {
        const p = plot.getBoundingClientRect(), b = box.getBoundingClientRect();
        return { l: +(b.left - p.left).toFixed(1), w: +b.width.toFixed(1) };
      };
      const click = (label) => [...document.querySelectorAll('[aria-label="Care summary time period"] button')]
        .find((b) => b.textContent.trim() === label)?.click();
      click("30d");
      await new Promise((r) => setTimeout(r, 300));
      const from = rel();
      click("90d");
      await new Promise((r) => requestAnimationFrame(r));
      const firstFrame = rel();
      const property = getComputedStyle(box).transitionProperty;
      return { property, from, firstFrame, instant: firstFrame.w !== from.w };
    });
    if (report.tween.reducedMotion.property !== "none")
      report.failures.push(`t17: reduced motion still transitions (${report.tween.reducedMotion.property})`);
  }

  await context.close();
}

await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const bad = report.failures.length;
console.log(JSON.stringify(report.rows, null, 1));
console.log(bad ? `\n${bad} FAILED\n` + report.failures.join("\n") : "\nall claims hold");
process.exit(bad ? 1 : 0);
