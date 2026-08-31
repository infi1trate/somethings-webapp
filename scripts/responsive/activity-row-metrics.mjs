// THE TWO NUMBERS PHASE B1 ASKS FOR, MEASURED ON BOTH TREES.
//
//  · sentence start x on avatar rows vs avatar-less rows — the left-edge
//    alignment A11 was about, and the thing item 9 can break;
//  · the count of rows where line 2 wraps — which is what the possessive fix is
//    for.
//
// Runs against whichever origin is passed, so before/after come from the same
// code path rather than from two hand-written probes.
import { launch, buildStoreSeed, readStoreVersion, STORE_KEY, SEEDED_FLAG } from "./harness.mjs";

const BASES = (process.env.BASES ?? "http://localhost:3004,http://localhost:3003").split(",");
const version = await readStoreVersion();
const browser = await launch();
const report = [];

for (const base of BASES) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const payload = JSON.stringify(buildStoreSeed({ persona: "supervisor" }, version));
  await context.addInitScript(
    ({ key, payload, once }) => {
      try {
        if (localStorage.getItem(once)) return;
        localStorage.setItem(key, payload);
        localStorage.setItem(once, "1");
      } catch {
        /* blocked storage */
      }
    },
    { key: STORE_KEY, payload, once: SEEDED_FLAG }
  );
  const page = await context.newPage();
  await page.goto(`${base}/app/activity`);
  await page.waitForTimeout(1200);
  // Detailed mode is where the three lines exist.
  const dens = page.locator('button[aria-label*="detail" i], button[title*="detail" i]');
  if (await dens.count()) {
    await dens.first().click();
    await page.waitForTimeout(800);
  }

  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("main li")];
    const avatarRows = [];
    const bareRows = [];
    let wrapped = 0;
    const orphans = [];
    let sampled = 0;
    const roleSlots = new Set();

    for (const li of rows) {
      const ps = [...li.querySelectorAll("p")];
      if (ps.length < 2) continue;
      const line1 = ps[0];
      const line2 = ps[1];
      sampled++;

      // LINE 2 WRAPS when its box is taller than one line of its own line-height.
      const lh = parseFloat(getComputedStyle(line2).lineHeight);
      const h = line2.getBoundingClientRect().height;
      const wraps = Number.isFinite(lh) && h > lh * 1.4;
      if (wraps) wrapped++;

      // ═══ THE ORPHAN, WHICH IS THE ACTUAL DEFECT ═══
      // The wrap COUNT barely moves — these sentences genuinely need two lines
      // at this column width. What item 6 is about is WHERE the break falls: a
      // last line holding only "'s conversation." is the failure. So measure the
      // last line's width as a fraction of the column, and record what it starts
      // with. A Range over each text node's client rects gives the real line
      // boxes; `getBoundingClientRect` on the paragraph cannot.
      if (wraps) {
        // SKIP THE AVATAR'S INITIAL. It is a text node inside an `aria-hidden`
        // span, 2–4% of the column wide, and the first version of this metric
        // reported it as an orphaned last line on both trees — three "orphans"
        // starting with "M", "N", "J", which are initials, not words.
        const walker = document.createTreeWalker(line2, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) =>
            node.parentElement?.closest('[aria-hidden="true"]')
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT,
        });
        let lastTop = -1;
        let lastLeft = Infinity;
        let lastRight = 0;
        let lastText = "";
        let n;
        while ((n = walker.nextNode())) {
          const r = document.createRange();
          r.selectNodeContents(n);
          for (const box of r.getClientRects()) {
            if (box.height === 0) continue;
            if (box.top > lastTop + 2) {
              // A new, lower line box — restart the accumulation.
              lastTop = box.top;
              lastLeft = box.left;
              lastRight = box.right;
              lastText = (n.textContent ?? "").trim();
            } else if (Math.abs(box.top - lastTop) <= 2) {
              lastLeft = Math.min(lastLeft, box.left);
              lastRight = Math.max(lastRight, box.right);
            }
          }
        }
        const colW = line2.getBoundingClientRect().width;
        const lastW = Math.max(0, lastRight - lastLeft);
        orphans.push({
          pct: Math.round((lastW / colW) * 100),
          startsWith: lastText.slice(0, 18),
        });
      }

      // SENTENCE START X — the left edge of line 2's first text.
      const x = Math.round(line2.getBoundingClientRect().left);
      // An avatar row has an actor avatar as a sibling BEFORE the text column.
      const hasActorAvatar = !!li.querySelector(
        ':scope > span[aria-hidden="true"], :scope > div[aria-hidden="true"]'
      );
      (hasActorAvatar ? avatarRows : bareRows).push(x);

      // The role slot on line 1, for item 9's column consistency.
      const spans = [...line1.querySelectorAll(":scope > span")].map((s) =>
        (s.textContent ?? "").trim()
      );
      roleSlots.add(spans.length);
    }

    const uniq = (a) => [...new Set(a)];
    return {
      sampled,
      wrappedLine2: wrapped,
      // A last line under ~25% of the column is the orphan §8 measured.
      orphanCount: orphans.filter((o) => o.pct <= 25).length,
      orphanSamples: orphans.filter((o) => o.pct <= 25).slice(0, 5),
      // WHAT EACH WRAPPED ROW'S LAST LINE BEGINS WITH — the direct answer to
      // "is the possessive stranded?", which a width threshold alone cannot give.
      lastLineStarts: orphans.map((o) => o.startsWith),
      possessiveStranded: orphans.filter((o) => /^[’']s/.test(o.startsWith)).length,
      lastLinePctRange: orphans.length
        ? [Math.min(...orphans.map((o) => o.pct)), Math.max(...orphans.map((o) => o.pct))]
        : null,
      avatarRowStartX: uniq(avatarRows),
      bareRowStartX: uniq(bareRows),
      line1SlotCounts: [...roleSlots].sort(),
    };
  });
  report.push({ base, ...m });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
