// THE TASKS TOP REGION AFTER THE STRIP AND THE CARDS.
//
// Two acceptance criteria from the revision, both measurable: the space above
// the list shrinks by roughly the old cards' height, and the Heavy-caseload
// scenario shows breach chips WITHOUT the row growing taller. Plus the keyboard
// contract, which is the part a restyle is most likely to break silently.
import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/tasks-top";
const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, rows: [] };

/** Scenario ids come from the dev bar's own list. */
const SCENARIOS = [
  { id: "typical-shift", label: "Typical shift" },
  { id: "heavy-caseload", label: "Heavy caseload" },
  { id: "breach-overnight", label: "Breach overnight" },
  { id: "quiet-day", label: "Quiet day" },
];

// ═══ SCENARIOS AT DESKTOP WIDTH ONLY, AND THAT IS A FINDING, NOT A SHORTCUT ═══
//
// The scenario switcher is pinned bottom-right, and below `md` the fixed bottom
// nav sits on top of it — Playwright reports the nav's subtree intercepting every
// click at the switcher's coordinates. So the switcher is not merely awkward at
// 320px, it is UNREACHABLE. Dev-only UI, so it is reported rather than fixed
// here (design-system-gaps row 311).
//
// The split costs nothing real: a scenario changes the DATA, which is
// width-independent, and the narrow run is what tests the LAYOUT. Narrow keeps
// the default scenario, which carries a breach, so the "chips do not grow the
// row" claim is still exercised at 320px.
for (const vp of [VIEWPORTS.find((v) => v.label === "xl"), VIEWPORTS.find((v) => v.label === "xs")]) {
  const scenarios = vp.label === "xs" ? [SCENARIOS[0]] : SCENARIOS;
  for (const scenario of scenarios) {
    const { context, page } = await openView(
      browser,
      { id: `tasks-${scenario.id}`, url: "/app/tasks", seed: { persona: "supervisor" } },
      { ...vp, height: 2400 },
      version
    );
    await page.waitForTimeout(500);
    // ═══ THE SCENARIO IS REACT STATE, NOT STORE STATE ═══
    // `tasks-page.tsx` holds it in `useState` — deliberately, per its own note,
    // so it resets with the page. Seeding localStorage did nothing and every
    // scenario reported identical counts, which is how that was caught. It has
    // to be driven through the switcher UI, which is also the path a person
    // takes.
    if (vp.label !== "xs") {
      const switcher = page.getByRole("button", { name: /prototype scenarios/i });
      if (await switcher.count()) await switcher.first().click();
      await page.waitForTimeout(300);
      const pick = page.getByRole("button", { name: new RegExp(`^${scenario.label}`, "i") });
      if (!(await pick.count())) throw new Error(`scenario control not found: ${scenario.label}`);
      await pick.first().click();
      await page.waitForTimeout(900);
    }

    const m = await page.evaluate(() => {
      const list = document.querySelector("#tasks-panel");
      const tablist = document.querySelector('[role="tablist"]');
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      const r = (n) => (n ? n.getBoundingClientRect() : null);
      const tl = r(tablist);
      const lr = r(list);
      // Breach chips are the only status indicator; "on track" must render none.
      const chips = tabs.map((t) => {
        const chip = [...t.querySelectorAll("span")].find((s) => /past \d+[hd]/.test(s.textContent ?? ""));
        return { label: t.textContent?.replace(/\s+/g, " ").trim().slice(0, 40), chip: chip?.textContent?.trim() ?? null, selected: t.getAttribute("aria-selected") };
      });
      return {
        nextUpStripGone: !document.querySelector('[aria-label="Next up"]'),
        tabCount: tabs.length,
        tablistH: tl ? Math.round(tl.height) : null,
        // How far down the page the list starts — the "space above the list".
        listTop: lr ? Math.round(lr.top + scrollY) : null,
        tabHeights: tabs.map((t) => Math.round(t.getBoundingClientRect().height)),
        tabs: chips,
        rolesOk: tabs.every((t) => t.getAttribute("aria-selected") !== null && t.getAttribute("aria-controls") === "tasks-panel"),
        docOverflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    report.rows.push({ vp: vp.label, scenario: scenario.id, ...m });
    await mkdir(`${OUT}/${vp.label}`, { recursive: true });
    await writeFile(`${OUT}/${vp.label}/${scenario.id}.png`, await page.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: Math.min(900, 2400) } }));
    await context.close();
  }
}

// ── KEYBOARD: arrows move and select; 1–4 still jump. ──
{
  const { context, page } = await openView(
    browser,
    { id: "tasks-keys", url: "/app/tasks", seed: { persona: "supervisor" } },
    { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1200 },
    version
  );
  await page.waitForTimeout(900);
  const selected = () =>
    page.evaluate(() =>
      document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? null
    );
  const steps = [{ at: "load", tab: await selected() }];
  await page.locator('[role="tab"][aria-selected="true"]').focus();
  for (const key of ["ArrowRight", "ArrowRight", "ArrowLeft", "End", "Home"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(200);
    steps.push({ at: key, tab: await selected() });
  }
  for (const key of ["3", "1"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
    steps.push({ at: `digit ${key}`, tab: await selected() });
  }
  report.keyboard = steps;
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
