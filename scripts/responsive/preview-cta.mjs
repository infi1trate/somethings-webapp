// THE HEADER-ALIGNED PREVIEW CTA AND ITS RIGHT-EDGE PANEL.
//
// Driven headless because the in-app browser pane PAUSES ANIMATION TIMELINES
// when hidden: a `slide-in-from-right` measured there sits frozen at its 16px
// entry offset and looks like a panel overhanging the viewport. Nothing was
// wrong with the panel; the measurement was taken in a suspended document. So
// every geometry claim here is made where the timeline runs.
//
// It asserts the END STATE, not the clicks.
import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/preview-cta";
const XS = VIEWPORTS.find((v) => v.label === "xs");
const MD = VIEWPORTS.find((v) => v.label === "md");
const XL = VIEWPORTS.find((v) => v.label === "xl");

const SURFACES = [
  {
    id: "mentor-own-editor",
    url: "/app/profile?tab=profile",
    seed: { persona: "mentor", status: "published", published: true },
    heading: "Match card",
  },
  {
    id: "staff-mentor-record",
    url: "/admin/mentor?tab=profile",
    seed: { persona: "supervisor" },
    heading: "Matching profile",
  },
  {
    id: "staff-first-moments",
    url: "/admin/mentor?tab=first-moments",
    seed: { persona: "supervisor" },
    heading: "First moments",
  },
];

const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, checks: [] };
const add = (o) => report.checks.push(o);

for (const s of SURFACES) {
  // ── NARROW: the CTA exists, sits on the heading's row at the right edge,
  //    meets the 44px floor, and the inline rail/column is gone.
  for (const vp of [XS, MD]) {
    const { context, page } = await openView(browser, { id: s.id, url: s.url, seed: s.seed }, vp, version);
    await page.waitForTimeout(800);

    const before = await page.evaluate((headingText) => {
      const heads = [...document.querySelectorAll("h1,h2,h3")];
      const h = heads.find((n) => n.textContent.trim() === headingText);
      const cta = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "Preview"
      );
      const rail = document.querySelector('aside[aria-label="Profile rail"]');
      const inlineOld = [...document.querySelectorAll("button")].some((b) =>
        /preview your match card/i.test(b.textContent || "")
      );
      const r = (n) => (n ? n.getBoundingClientRect() : null);
      const hr = r(h);
      const cr = r(cta);
      return {
        headingFound: !!h,
        ctaFound: !!cta,
        sameRow: hr && cr ? Math.abs(hr.top - cr.top) <= 24 : null,
        ctaRightGap: cr ? Math.round(innerWidth - cr.right) : null,
        ctaH: cr ? Math.round(cr.height) : null,
        ctaW: cr ? Math.round(cr.width) : null,
        headingRight: hr ? Math.round(hr.right) : null,
        ctaLeft: cr ? Math.round(cr.left) : null,
        railVisible: rail ? rail.getBoundingClientRect().height > 0 : false,
        oldInlineTrigger: inlineOld,
        docOverflow: document.documentElement.scrollWidth - innerWidth,
      };
    }, s.heading);
    add({ surface: s.id, vp: vp.label, phase: "closed", ...before });

    if (before.ctaFound) {
      await page.getByRole("button", { name: /^Preview$/ }).first().click();
      // Long enough for a 100ms enter animation to finish and settle.
      await page.waitForTimeout(700);
      const open = await page.evaluate(() => {
        const d = document.querySelector('[data-slot="dialog-content"]');
        if (!d) return { open: false };
        const r = d.getBoundingClientRect();
        const frame = [...d.querySelectorAll("*")].find((n) =>
          (n.getAttribute("aria-label") || "").includes("what teens see")
        );
        const fr = frame ? frame.getBoundingClientRect() : null;
        const devBar = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--dev-bar-h") || "0"
        );
        return {
          open: true,
          variant: d.getAttribute("data-variant"),
          // FLUSH TO THE RIGHT EDGE is the whole geometry claim.
          rightGap: Math.round(innerWidth - r.right),
          top: Math.round(r.top),
          bottomGap: Math.round(innerHeight - r.bottom),
          devBar: Math.round(devBar),
          w: Math.round(r.width),
          h: Math.round(r.height),
          transform: getComputedStyle(d).transform,
          frameVisible: !!fr && fr.height > 100,
          frameW: fr ? Math.round(fr.width) : null,
          title: d.querySelector('[data-slot="dialog-title"]')?.textContent ?? null,
          closeButtons: [...d.querySelectorAll("button")].map((b) => b.textContent.trim()),
          docOverflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      add({ surface: s.id, vp: vp.label, phase: "open", ...open });

      if (open.open) {
        await mkdir(`${OUT}/${vp.label}`, { recursive: true });
        await writeFile(`${OUT}/${vp.label}/${s.id}.png`, await page.screenshot());
      }

      // Esc must close it — the panel is a dialog, not a page.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const closed = await page.evaluate(
        () => !document.querySelector('[data-slot="dialog-content"]')
      );
      add({ surface: s.id, vp: vp.label, phase: "esc", closed });
    }
    await context.close();
  }

  // ── WIDE: the CTA must be ABSENT and the inline preview present.
  const { context, page } = await openView(browser, { id: s.id, url: s.url, seed: s.seed }, XL, version);
  await page.waitForTimeout(800);
  const wide = await page.evaluate(() => {
    const cta = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Preview"
    );
    const ctaVisible = cta ? cta.getBoundingClientRect().height > 0 : false;
    const frame = [...document.querySelectorAll("*")].find((n) =>
      (n.getAttribute("aria-label") || "").includes("what teens see")
    );
    return {
      ctaInDom: !!cta,
      ctaVisible,
      inlinePreviewVisible: !!frame && frame.getBoundingClientRect().height > 100,
    };
  });
  add({ surface: s.id, vp: "xl", phase: "wide", ...wide });
  await mkdir(`${OUT}/xl`, { recursive: true });
  await writeFile(`${OUT}/xl/${s.id}.png`, await page.screenshot());
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
