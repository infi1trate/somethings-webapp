// ABOUT THIS RECORD — the restored header band, and the AI-usage feedback flow.
//
// ═══ WHY A PROBE FOR A CARD THIS SMALL ═══
//
// Two of its claims are invisible to the type system and to a unit test, and
// both have already been wrong once:
//
//   · THE BAND. It is a filled `--surface-s2` row with a bottom border, it was
//     removed by a later typographic sweep, and nothing failed — the card kept
//     rendering, the heading kept reading, and the regression was found by a
//     human comparing the page to a frame. A computed background is the only
//     thing that can notice.
//   · THE BOLD. Three strings in this card are drawn bold in the frame, and this
//     app can only set bold by switching FACE: Lausanne ships 400 alone and
//     Chrome synthesises nothing for it, so `font-semibold` renders as regular
//     and looks like a decision. Asserted as a computed family + weight.
//
// AND THE FEEDBACK MODULE IS A STATE MACHINE with a persistence side effect, on
// a component MOUNTED TWICE in one document. The claim that both mounts agree
// cannot be checked by looking at one of them.

import { launch, openView, BASE, readStoreVersion, STORE_KEY } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/record-authority";
await mkdir(OUT, { recursive: true });
const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, failures: [], card: null, flow: [], contrast: null };
const fail = (m) => report.failures.push(m);

const { context, page } = await openView(
  browser,
  { id: "authority", url: "/admin/person/t17?tab=care", seed: { persona: "supervisor" } },
  { label: "w1280", width: 1280, height: 2200 },
  version
);
await page.waitForTimeout(900);

/** The visible mount. Both are in the DOM; the narrow one is `display:none`. */
const CARD = '[data-record-section="record-authority"]';

// ── THE CARD'S CHROME ──────────────────────────────────────────────────────
report.card = await page.evaluate((CARD) => {
  const all = [...document.querySelectorAll(CARD)];
  const card = all.find((c) => c.getBoundingClientRect().height > 0);
  const cs = (el) => getComputedStyle(el);
  const h2 = card.querySelector("h2");
  const sections = [...card.children].filter((c) => c.tagName === "DIV");
  const email = card.querySelector('a[href^="mailto"]');
  return {
    mounts: all.length,
    headingIds: all.map((c) => c.querySelector("h2").id),
    card: {
      bg: cs(card).backgroundColor,
      overflow: cs(card).overflow,
      radius: cs(card).borderTopLeftRadius,
    },
    band: {
      bg: cs(h2).backgroundColor,
      family: cs(h2).fontFamily.split(",")[0].trim(),
      weight: cs(h2).fontWeight,
      size: cs(h2).fontSize,
      color: cs(h2).color,
      padding: cs(h2).padding,
      borderBottom: `${cs(h2).borderBottomWidth} ${cs(h2).borderBottomColor}`,
      text: h2.textContent.trim(),
    },
    sections: sections.map((d) => ({
      label: d.querySelector("p")?.textContent.trim(),
      padding: cs(d).padding,
      borderTop: cs(d).borderTopWidth,
    })),
    email: {
      family: cs(email).fontFamily.split(",")[0].trim(),
      weight: cs(email).fontWeight,
      underline: cs(email).textDecorationLine,
    },
    aiSentence: [...card.querySelectorAll("p")]
      .map((p) => p.textContent.trim())
      .find((t) => t.startsWith("AI is used")),
  };
}, CARD);

const c = report.card;
// THE BAND. `--surface-s2` is #e5e0d2 in light; anything transparent means the
// fill is gone again, which is the exact regression this probe exists for.
if (c.band.bg !== "rgb(229, 224, 210)")
  fail(`the header band is not --surface-s2 (${c.band.bg})`);
if (!c.band.borderBottom.startsWith("1px"))
  fail(`the band has no bottom border (${c.band.borderBottom})`);
if (c.band.family !== "avantt" || c.band.weight !== "700")
  fail(`the band heading is not Avantt Bold (${c.band.family} ${c.band.weight}) — Lausanne cannot render bold`);
if (c.card.overflow !== "hidden")
  fail(`the card is not clipping (${c.card.overflow}) — a filled band squares off its top corners`);
if (c.email.family !== "avantt" || c.email.weight !== "700")
  fail(`the Email link is not Avantt Bold (${c.email.family} ${c.email.weight})`);
if (c.sections.length !== 2 || c.sections[1].borderTop !== "1px")
  fail(`expected two sections with a divider between them (${JSON.stringify(c.sections)})`);
for (const s of c.sections)
  if (s.padding !== "12px 16px") fail(`section "${s.label}" padding is ${s.padding}, not 12px 16px`);
// THE FRAME DRAWS NO TERMINAL PERIOD, twice. It had one; this is the veto.
if (/accuracy\.$/.test(c.aiSentence ?? ""))
  fail(`the AI sentence closes with a period the frame does not draw`);
// TWO MOUNTS, TWO IDS. Both are in the DOM at every width, so a hard-coded id
// appears twice and every `aria-labelledby` resolves to the first.
if (new Set(c.headingIds).size !== c.headingIds.length)
  fail(`duplicate heading id across ${c.mounts} mounts: ${c.headingIds.join(", ")}`);

await page.screenshot({ path: `${OUT}/card-idle.png`, clip: await page.evaluate((CARD) => {
  const card = [...document.querySelectorAll(CARD)].find((x) => x.getBoundingClientRect().height > 0);
  const r = card.getBoundingClientRect();
  return { x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16 };
}, CARD) });

// ── THE FEEDBACK FLOW ──────────────────────────────────────────────────────
/** One step: act, then read both mounts and the persisted store.
 *
 *  `arg` EXISTS BECAUSE A CLOSURE DOES NOT CROSS INTO THE PAGE. `page.evaluate`
 *  serialises the function SOURCE, so a `click(i)` that closed over `i` arrived
 *  as `ReferenceError: i is not defined`. Everything the browser side needs is
 *  passed as data. */
const step = async (name, act, arg) => {
  if (act) await page.evaluate(act, { CARD, ...arg });
  await page.waitForTimeout(250);
  const shot = await page.evaluate(({ CARD, STORE_KEY }) => {
    const all = [...document.querySelectorAll(CARD)];
    const vis = all.find((x) => x.getBoundingClientRect().height > 0);
    const hidden = all.find((x) => x !== vis);
    const read = (card) => ({
      pressed: [...card.querySelectorAll("button[aria-pressed]")].map((b) => b.getAttribute("aria-pressed")),
      live: card.querySelector("[aria-live]")?.textContent ?? "",
      form: Boolean(card.querySelector("form")),
      fills: [...card.querySelectorAll("button[aria-pressed] svg")].map((s) => getComputedStyle(s).fill),
    });
    const raw = localStorage.getItem(STORE_KEY);
    return {
      visible: read(vis),
      hidden: read(hidden),
      focusInTextarea: document.activeElement === vis.querySelector("textarea"),
      submitDisabled: vis.querySelector('button[type="submit"]')?.disabled ?? null,
      /* ═══ ABSENT IS NOT `{}` — THE PROBE HAS TO TELL THEM APART ═══
         `partialize` is a whitelist, so a field left off it is missing from the
         payload entirely rather than stored empty. Reading it straight gave
         `undefined` and the next `Object.keys` threw a stack trace instead of
         naming the defect. Both are reported now: the value, defaulted, and
         whether the key was there at all. */
      stored: JSON.parse(raw).state.aiUsageFeedback ?? {},
      persisted: "aiUsageFeedback" in JSON.parse(raw).state,
      storedVersion: JSON.parse(raw).version,
    };
  }, { CARD, STORE_KEY });
  report.flow.push({ step: name, ...shot });
  return shot;
};

const clickThumb = ({ CARD, i }) => {
  const card = [...document.querySelectorAll(CARD)].find((x) => x.getBoundingClientRect().height > 0);
  card.querySelectorAll("button[aria-pressed]")[i].click();
};
const UP = 0, DOWN = 1;

const idle = await step("idle");
if (idle.visible.pressed.some((p) => p === "true")) fail("a thumb is pressed before any click");
if (Object.keys(idle.stored).length) fail("feedback is stored before any click");

const up = await step("thumbs up", clickThumb, { i: UP });
if (up.visible.pressed.join() !== "true,false") fail(`up did not press (${up.visible.pressed})`);
if (up.visible.form) fail("thumbs up opened the comment form — the down path asks, the up path does not");
if (up.visible.fills[0] === "none") fail("the pressed thumb is not filled — the 4% tint is 1.09:1 and cannot carry the state");
if (up.stored.t17?.rating !== "up") fail(`up did not persist (${JSON.stringify(up.stored)})`);

const down = await step("thumbs down", clickThumb, { i: DOWN });
if (!down.visible.form) fail("thumbs down did not reveal the comment form");
if (!down.focusInTextarea) fail("focus did not follow the revealed input");
if (down.submitDisabled !== true) fail("submit is enabled on an empty note");
if (down.stored.t17?.note !== null) fail(`down should clear any note (${JSON.stringify(down.stored)})`);

const typed = await step("typed", ({ CARD }) => {
  const card = [...document.querySelectorAll(CARD)].find((x) => x.getBoundingClientRect().height > 0);
  const ta = card.querySelector("textarea");
  // React tracks its own value — set through the native setter, then fire input.
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(
    ta, "The trajectory sentence contradicted the chart."
  );
  ta.dispatchEvent(new Event("input", { bubbles: true }));
});
if (typed.submitDisabled !== false) fail("submit is still disabled with a note typed");

const sent = await step("submitted", ({ CARD }) => {
  const card = [...document.querySelectorAll(CARD)].find((x) => x.getBoundingClientRect().height > 0);
  card.querySelector('button[type="submit"]').click();
});
if (sent.visible.form) fail("the form stayed open after submitting");
if (!sent.persisted) fail("aiUsageFeedback is absent from the stored payload — it is not on the `partialize` whitelist");
if (!sent.stored.t17?.note) fail(`the note did not persist (${JSON.stringify(sent.stored)})`);
if (sent.visible.live !== "Noted") fail(`acknowledgement is "${sent.visible.live}" — it must not claim the note was sent`);
// THE REASON THIS IS IN THE STORE AT ALL.
if (JSON.stringify(sent.hidden) !== JSON.stringify(sent.visible))
  fail(`the two mounts disagree: ${JSON.stringify(sent.hidden)} vs ${JSON.stringify(sent.visible)}`);
// NO SCHEMA VERSION for an additive whitelisted field — `merge` spreads
// `...current` first, so an older payload keeps the `{}` default.
if (sent.storedVersion !== version)
  fail(`the store version moved to ${sent.storedVersion} (was ${version}) — this field needs no bump`);

const back = await step("switched back to up", clickThumb, { i: UP });
if (back.stored.t17?.note !== null)
  fail(`switching away from down kept the complaint (${JSON.stringify(back.stored)})`);

// ── CONTRAST, COMPOSED ─────────────────────────────────────────────────────
report.contrast = await page.evaluate((CARD) => {
  const card = [...document.querySelectorAll(CARD)].find((x) => x.getBoundingClientRect().height > 0);
  const parse = (c) => c.match(/[\d.]+/g).map(Number);
  // A translucent tint read as if opaque is how a 15:1 glyph measures 1.26:1.
  const over = (fg, bg) => {
    const f = parse(fg), b = parse(bg);
    const a = f.length > 3 ? f[3] : 1;
    return `rgb(${f.slice(0, 3).map((v, i) => Math.round(v * a + b[i] * (1 - a))).join(", ")})`;
  };
  const lum = (c) => {
    const v = parse(c).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  const cs = (el) => getComputedStyle(el);
  const cardBg = cs(card).backgroundColor;
  const h2 = card.querySelector("h2");
  const prompt = card.querySelector("form, [aria-live]").parentElement.querySelector("span");
  const thumb = card.querySelector('button[aria-pressed="false"]');
  const on = card.querySelector('button[aria-pressed="true"]');
  const target = on.getBoundingClientRect();
  return {
    bandHeading: ratio(cs(h2).color, cs(h2).backgroundColor),
    prompt: ratio(cs(prompt).color, cardBg),
    thumbIdle: ratio(cs(thumb).color, cardBg),
    pressedGlyph: ratio(cs(on).color, over(cs(on).backgroundColor, cardBg)),
    pressedTintVsCard: ratio(over(cs(on).backgroundColor, cardBg), cardBg),
    targetPx: `${Math.round(target.width)}x${Math.round(target.height)}`,
  };
}, CARD);
for (const [k, v] of Object.entries(report.contrast))
  if (typeof v === "number" && v < 4.5 && k !== "pressedTintVsCard")
    fail(`${k} is ${v}:1, below AA`);

// ── THE PICTURES ───────────────────────────────────────────────────────────
await page.evaluate(clickThumb, { CARD, i: DOWN });
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/card-comment-open.png`, clip: await page.evaluate((CARD) => {
  const card = [...document.querySelectorAll(CARD)].find((x) => x.getBoundingClientRect().height > 0);
  const r = card.getBoundingClientRect();
  return { x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16 };
}, CARD) });

await context.close();
await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ card: report.card, contrast: report.contrast }, null, 1));
console.log(report.failures.length ? `\n${report.failures.length} FAILED\n` + report.failures.join("\n") : "\nall claims hold");
process.exit(report.failures.length ? 1 : 0);
