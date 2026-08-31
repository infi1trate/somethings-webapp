// B2's CLAIMS, EACH ONE CHECKED.
import { launch, buildStoreSeed, readStoreVersion, STORE_KEY, SEEDED_FLAG, BASE } from "./harness.mjs";

const version = await readStoreVersion();
const browser = await launch();
const report = {};

async function open(path, w = 1440) {
  const context = await browser.newContext({ viewport: { width: w, height: 1800 } });
  const payload = JSON.stringify(buildStoreSeed({ persona: "supervisor" }, version));
  await context.addInitScript(({ key, payload, once }) => {
    try {
      if (localStorage.getItem(once)) return;
      localStorage.setItem(key, payload);
      localStorage.setItem(once, "1");
    } catch { /* blocked storage */ }
  }, { key: STORE_KEY, payload, once: SEEDED_FLAG });
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(1300);
  return { context, page };
}

const state = (page) =>
  page.evaluate(() => {
    const rail = document.querySelector('nav[aria-label*="view" i], [role="tablist"]');
    const tabs = [...document.querySelectorAll('[role="tab"], nav button')]
      .map((b) => (b.textContent ?? "").trim())
      .filter((t) => t && t.length < 24);
    const chipRow = [...document.querySelectorAll("button")]
      .filter((b) => (b.getAttribute("aria-label") ?? "").startsWith("Remove the "))
      .map((b) => (b.textContent ?? "").trim());
    const grid = document.querySelector("#tasks-panel") ?? null;
    const feedCols = (() => {
      const el = [...document.querySelectorAll("main div")].find((d) =>
        getComputedStyle(d).display === "grid" &&
        getComputedStyle(d).gridTemplateColumns.split(" ").length >= 1 &&
        d.querySelector("ul, [aria-label*='feed' i]")
      );
      return el ? getComputedStyle(el).gridTemplateColumns : null;
    })();
    const pane = [...document.querySelectorAll("aside")].find((a) =>
      /select an event|full context/i.test(a.textContent ?? "")
    );
    return {
      tabs,
      activeTab: document.querySelector('[aria-current="page"], [aria-selected="true"]')?.textContent?.trim() ?? null,
      chips: chipRow,
      rowCount: document.querySelectorAll("main li").length,
      paneInDom: !!pane,
      feedCols,
      caption: /That’s everything from the last 30 days\.|That's everything from the last 30 days\./.test(
        document.querySelector("main")?.innerText ?? ""
      ),
      hasBillingTab: [...document.querySelectorAll("nav button, [role=tab]")].some(
        (b) => (b.textContent ?? "").trim() === "Billing"
      ),
    };
  });

// 1 · TWO TABS, NO BILLING
{
  const { context, page } = await open("/app/activity");
  report.default = await state(page);
  await context.close();
}

// 2 · DEEP LINK: scope + domain
{
  const { context, page } = await open("/app/activity?scope=team&domain=billing");
  report.deepLinkTeamBilling = await state(page);
  await context.close();
}

// 3 · A8's LINK: objectId + domain, no scope
{
  const { context, page } = await open("/app/activity?objectId=teen-caleb&domain=billing");
  report.deepLinkA8 = await state(page);
  await context.close();
}

// 4 · DOMAIN FILTER PERSISTS ACROSS A SCOPE SWITCH
{
  const { context, page } = await open("/app/activity?scope=team&domain=billing");
  const before = await state(page);
  const other = page.locator("nav button", { hasText: "My caseload" }).first();
  if (await other.count()) {
    await other.click();
    await page.waitForTimeout(900);
  }
  report.persistence = { before: before.chips, afterSwitch: (await state(page)).chips };
  await context.close();
}

// 5 · EMPTY STATE COLLAPSES TO ONE COLUMN
{
  const { context, page } = await open("/app/activity");
  // Filter to a domain that the quiet scenario cannot satisfy: pick a teen filter
  // via deep link instead, which is deterministic.
  await page.goto(`${BASE}/app/activity?objectId=teen-nobody&domain=lifecycle`);
  await page.waitForTimeout(1300);
  report.empty = await state(page);
  await context.close();
}

// 6 · CAPTION, on the 30-day scenario
{
  const { context, page } = await open("/app/activity");
  const scen = page.locator("select").filter({ has: page.locator("optgroup") }).first();
  if (await scen.count()) {
    await scen.selectOption("activity:long-history");
    await page.waitForTimeout(1100);
    // Page to the end so the caption can appear.
    for (let i = 0; i < 6; i++) {
      const more = page.locator("button", { hasText: /load older/i }).first();
      if (!(await more.count())) break;
      await more.click();
      await page.waitForTimeout(600);
    }
  }
  const s = await state(page);
  report.caption = {
    present: s.caption,
    rowCount: s.rowCount,
    insideList: await page.evaluate(() => {
      const cap = [...document.querySelectorAll("p,div,span")].find((n) =>
        /everything from the last 30 days/.test(n.textContent ?? "") && n.children.length === 0
      );
      if (!cap) return null;
      const list = cap.closest("ul, ol, [data-slot='feed'], section");
      return list ? list.tagName.toLowerCase() : "not-in-a-list";
    }),
  };
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
