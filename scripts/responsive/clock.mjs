// THE DEVICE MOCK'S CLOCK — does it tick, and does it read correctly anywhere?
//
// Kept as a script rather than a vitest case because both claims need a real
// browser: the tick needs virtual time (Playwright's clock API) to prove it
// fires on the MINUTE BOUNDARY rather than 60s after mount, and the formatting
// needs five locale/timezone pairs, which a Node test process cannot provide.
//
// Contexts are built here rather than through `openView` because that helper
// pins the clock for screenshot determinism — exactly what must be off.
import {
  launch,
  buildStoreSeed,
  readStoreVersion,
  STORE_KEY,
  SEEDED_FLAG,
  BASE,
} from "./harness.mjs";

const version = await readStoreVersion();
const browser = await launch();

/** A seeded context with the clock LEFT ALONE. */
async function open(opts = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...opts,
  });
  const payload = JSON.stringify(buildStoreSeed({ persona: "supervisor" }, version));
  await context.addInitScript(
    ({ key, payload, once }) => {
      try {
        if (localStorage.getItem(once)) return;
        localStorage.setItem(key, payload);
        localStorage.setItem(once, "1");
      } catch {
        /* blocked storage — the view still renders defaults */
      }
    },
    { key: STORE_KEY, payload, once: SEEDED_FLAG }
  );
  return { context, page: await context.newPage() };
}

/** The status bar's clock, read off the rendered page. */
const readClock = (page) =>
  page.evaluate(() => {
    const n = [...document.querySelectorAll("span")].find(
      (e) => /^\s*\d{1,2}:\d{2}\s*$/.test(e.textContent ?? "")
    );
    return n ? n.textContent.trim() : null;
  });

const report = { base: BASE, tick: [], locales: [] };

// ─── 1 · THE TICK ──────────────────────────────────────────────────────────
// Mount at 09:41:40 — twenty seconds before a boundary. A `setInterval(60_000)`
// would next fire at 09:42:40 and show 09:41 for that whole time.
{
  const { context, page } = await open();
  await page.clock.install({ time: new Date("2026-08-31T09:41:40") });
  await page.goto(`${BASE}/admin/mentor?tab=profile`);
  await page.waitForTimeout(600);
  const step = async (label) => {
    await page.waitForTimeout(250);
    report.tick.push({ at: label, shown: await readClock(page) });
  };
  await step("mount 09:41:40");
  await page.clock.fastForward("00:15");
  await step("+15s → 09:41:55 (same minute, must not change)");
  await page.clock.fastForward("00:10");
  await step("+10s → 09:42:05 (boundary crossed)");
  await page.clock.fastForward("01:00");
  await step("+60s → 09:43:05 (still rescheduling)");
  await page.clock.fastForward("05:00");
  await step("+5m → 09:48:05");
  await context.close();
}

// ─── 2 · LOCALE AND TIMEZONE ───────────────────────────────────────────────
// 21:41 in the runner's own zone, so a 12-hour locale must show an unpadded
// hour, a 24-hour locale a padded one, and no locale may show a period marker.
for (const [locale, timezoneId, expect] of [
  ["en-US", "America/New_York", "12-hour, unpadded, no AM/PM"],
  ["de-DE", "Europe/Berlin", "24-hour, padded"],
  ["en-GB", "Europe/London", "24-hour, padded — not derivable from the language tag"],
  ["zh-CN", "Asia/Shanghai", "period marker LEADS; must be dropped"],
  ["ja-JP", "Asia/Tokyo", "24-hour, padded"],
]) {
  const { context, page } = await open({ locale, timezoneId });
  await page.clock.install({ time: new Date("2026-08-31T21:41:20") });
  await page.goto(`${BASE}/admin/mentor?tab=profile`);
  await page.waitForTimeout(700);
  const shown = await readClock(page);
  report.locales.push({
    locale,
    timezoneId,
    expect,
    shown,
    periodMarker: /[AaPp]\.?[Mm]|\u4e0a\u5348|\u4e0b\u5348|\u5348\u524d|\u5348\u5f8c/.test(shown ?? ""),
  });
  await context.close();
}

// ─── 3 · THE HARNESS FREEZE ────────────────────────────────────────────────
// `openView` pins the clock so the screenshot matrix stays diffable. If that
// ever stops working, every re-run of the matrix starts differing by the minute.
{
  const { openView, VIEWPORTS } = await import("./harness.mjs");
  const XL = VIEWPORTS.find((v) => v.label === "xl");
  const { context, page } = await openView(
    browser,
    { id: "frozen", url: "/admin/mentor?tab=profile", seed: { persona: "supervisor" } },
    XL,
    version
  );
  await page.waitForTimeout(900);
  report.frozen = { shown: await readClock(page), expected: "9:41" };
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
