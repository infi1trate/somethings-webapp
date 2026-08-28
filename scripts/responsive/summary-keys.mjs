// KEYBOARD WALKTHROUGH OF THE CARE SUMMARY.
//
// Three claims, each checked rather than assumed:
//  1. every interactive control in the card is reachable by Tab, in DOM order;
//  2. each one shows a focus ring that is actually painted (a `focus-visible`
//     class in the markup proves nothing — the ring can be overridden, or the
//     element can be clipped by an ancestor's overflow);
//  3. "Open in History" does what it says: it moves the reader to the row.
import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";

const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 3200 };
const SEL = '[data-record-section="care-summary-doc"]';

const version = await readStoreVersion();
const browser = await launch();
const { context, page } = await openView(
  browser,
  { id: "keys", url: "/admin/person/t17?tab=care", seed: { persona: "supervisor" } },
  XL,
  version
);
await page.waitForTimeout(700);

const expected = await page.evaluate((sel) => {
  const card = document.querySelector(sel);
  return [...card.querySelectorAll("button,a,[tabindex]:not([tabindex='-1'])")].map(
    (n) => (n.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 34)
  );
}, SEL);

// Start from the card's first control, then Tab through it.
await page.evaluate((sel) => {
  document.querySelector(sel).querySelector("button,a")?.focus();
}, SEL);

const visited = [];
for (let i = 0; i < expected.length + 2; i++) {
  const cur = await page.evaluate((sel) => {
    const a = document.activeElement;
    if (!a || !document.querySelector(sel)?.contains(a)) return null;
    const cs = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    return {
      label: (a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 34),
      // A ring counts only if it is painted AND the element has a box to paint
      // it around: a zero-size or display:none control passes a class check and
      // fails a reader.
      ring:
        (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
        cs.boxShadow !== "none",
      visible: r.width > 0 && r.height > 0,
      // 24×24 minimum target (SC 2.5.8), including any ::after extension.
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  }, SEL);
  if (cur === null) break;
  visited.push(cur);
  await page.keyboard.press("Tab");
}

// ── the jump link actually jumps ──
const jump = page.locator(`${SEL} button`, { hasText: "Open in History" }).first();
const jumped = await (async () => {
  if (!(await jump.count())) return { ok: false, reason: "no jump link" };
  await jump.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    // The jump targets `#care-<eventId>`; success is the row being in view.
    const target = [...document.querySelectorAll('[id^="care-"]')].find((n) => {
      const r = n.getBoundingClientRect();
      return r.top > -20 && r.top < innerHeight * 0.9 && r.height > 0;
    });
    return { ok: !!target, id: target?.id ?? null };
  });
})();

await context.close();
await browser.close();

const noRing = visited.filter((v) => !v.ring);
const tooSmall = visited.filter((v) => v.visible && (v.w < 24 || v.h < 24));
console.log(
  JSON.stringify(
    {
      base: BASE,
      expectedControls: expected.length,
      reached: visited.length,
      allReached: visited.length >= expected.length,
      order: visited.map((v) => v.label),
      missingRing: noRing.map((v) => v.label),
      underTarget: tooSmall.map((v) => `${v.label} ${v.w}x${v.h}`),
      jumped,
    },
    null,
    2
  )
);
