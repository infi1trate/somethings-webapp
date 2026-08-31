// B3 · THE THREE PANES, THE DISCLOSURE, AND THE DEEP LINK.
import { launch, buildStoreSeed, readStoreVersion, STORE_KEY, SEEDED_FLAG, BASE } from "./harness.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/activity-b3";
const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, panes: [], disclosure: null, deepLink: null, noPane: [] };

async function open(path) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1700 } });
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

/** Click the first row whose type chip matches, then read the pane. */
async function paneFor(page, chipText) {
  // ═══ SELECT BY THE ROW'S SENTENCE, NOT BY A TYPE CHIP ═══
  // Activity rows have no visible type chip — that is the care record's History.
  // Matching "Review" hit the words "Billing review" and captured a billing row
  // for the survey slot; matching an exact chip string then found nothing at all.
  // The sentence is what a reader identifies the row by, so it is the right
  // handle.
  const row = page.locator("main li").filter({ hasText: chipText }).first();
  if (!(await row.count())) return null;
  await row.click();
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const pane = document.querySelector('[data-slot="event-evidence-pane"]');
    if (!pane) return { present: false };
    const fields = [...pane.querySelectorAll("p")]
      .map((p) => (p.textContent ?? "").trim())
      .filter(Boolean);
    return {
      present: true,
      title: pane.querySelector("h2")?.textContent?.trim() ?? null,
      text: (pane.innerText ?? "").replace(/\s+/g, " ").slice(0, 300),
      fieldCount: fields.length,
      hasRecordLink: [...pane.querySelectorAll("a")].some((a) => /open the/i.test(a.textContent ?? "")),
      hasRevealButton: [...pane.querySelectorAll("button")].some((b) => /view flagged content/i.test(b.textContent ?? "")),
      showsQuoteOnOpen: !!pane.querySelector("blockquote"),
      url: location.search,
    };
  });
}

await mkdir(OUT, { recursive: true });

// ── THE THREE PANES B3 ASKS TO SEE, plus escalation for completeness.
for (const [label, chip] of [
  ["billing", /billing review/i],
  ["survey", /completed a survey/i],
  ["risk-flag", /risk flag in/i],
  ["escalation", /'s escalation|s escalation/i],
]) {
  const { context, page } = await open("/app/activity");
  const p = await paneFor(page, chip);
  if (p?.present) {
    await writeFile(
      `${OUT}/${label}.png`,
      await page.locator('[data-slot="event-evidence-pane"]').screenshot()
    );
  }
  report.panes.push({ label, ...(p ?? { present: false }) });
  await context.close();
}

// ── THE DISCLOSURE: not on open, revealed on demand, reset on reselect.
{
  const { context, page } = await open("/app/activity");
  const before = await paneFor(page, /risk flag in/i);
  let after = null, afterReselect = null;
  if (before?.hasRevealButton) {
    await page.locator("button", { hasText: /view flagged content/i }).first().click();
    await page.waitForTimeout(500);
    after = await page.evaluate(() => {
      const pane = document.querySelector('[data-slot="event-evidence-pane"]');
      return { quote: !!pane?.querySelector("blockquote"), chatLink: [...(pane?.querySelectorAll("a") ?? [])].some((a) => /view chat context/i.test(a.textContent ?? "")) };
    });
    await writeFile(
      `${OUT}/risk-flag-revealed.png`,
      await page.locator('[data-slot="event-evidence-pane"]').screenshot()
    );
    // Select a DIFFERENT flag row; the reveal must not carry over.
    const rows = page.locator("main li").filter({ hasText: /risk flag in/i });
    if ((await rows.count()) > 1) {
      await rows.nth(1).click();
      await page.waitForTimeout(600);
      afterReselect = await page.evaluate(() => ({
        quote: !!document.querySelector('[data-slot="event-evidence-pane"] blockquote'),
      }));
    }
  }
  report.disclosure = { onOpen: before?.showsQuoteOnOpen, hasButton: before?.hasRevealButton, afterReveal: after, afterReselect };
  await context.close();
}

// ── THE DEEP LINK: URL updates on select, and restores on open.
{
  const { context, page } = await open("/app/activity");
  await paneFor(page, /billing review/i);
  const url = await page.evaluate(() => location.search);
  const eventId = new URLSearchParams(url).get("event");
  let restored = null;
  if (eventId) {
    await page.goto(`${BASE}/app/activity?event=${encodeURIComponent(eventId)}`);
    await page.waitForTimeout(1400);
    restored = await page.evaluate(() => {
      const pane = document.querySelector('[data-slot="event-evidence-pane"]');
      return { title: pane?.querySelector("h2")?.textContent?.trim() ?? null, // The row marks selection with a tint, not an ARIA attribute — read the
      // pane's presence as the restoration signal and count rows that carry the
      // selected background.
      selectedRows: [...document.querySelectorAll("main li")].filter((li) =>
        (li.className || "").toString().includes("tint-press") ||
        li.getAttribute("aria-current") === "true"
      ).length };
    });
  }
  // A deep link to an event outside the caseload must land on no-pane, not error.
  await page.goto(`${BASE}/app/activity?event=does-not-exist-anywhere`);
  await page.waitForTimeout(1200);
  const stranger = await page.evaluate(() => {
    const pane = document.querySelector('[data-slot="event-evidence-pane"]');
    return { paneText: (pane?.innerText ?? "").replace(/\s+/g, " ").slice(0, 80), // SCOPED TO `main`. The dev bar's load-state select now contains an
      // "Error" option, so a body-wide regex reported every page as errored.
      errored: /error|went wrong|something broke/i.test(
        document.querySelector("main")?.innerText ?? ""
      ) };
  });
  report.deepLink = { urlAfterSelect: url, eventId, restored, stranger };
  await context.close();
}

// ── TYPES THAT OPEN NO PANE.
{
  const { context, page } = await open("/app/activity");
  for (const chip of [/paused/i, /presentation review/i]) {
    const row = page.locator("main li").filter({ hasText: chip }).first();
    if (!(await row.count())) { report.noPane.push({ chip: String(chip), found: false }); continue; }
    await row.click();
    await page.waitForTimeout(600);
    report.noPane.push(await page.evaluate((c) => {
      const pane = document.querySelector('[data-slot="event-evidence-pane"]');
      return { chip: c, found: true, paneText: (pane?.innerText ?? "").replace(/\s+/g, " ").slice(0, 70) };
    }, String(chip)));
  }
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
