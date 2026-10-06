// ═══════════════════════════════════════════════════════════════════════════
// `Assigned to` — ADMIN ONLY (2026-10-06)
//
//   · an admin sees the column on both tabs; a supervisor never does
//   · every value is the teen's mentor's supervisor, by the caseload table
//   · on Closed it is the record's, frozen at submission
//   · it sorts A→Z, and nothing on the row is clipped at 1600 / 1440 / 1280
//
// THE CASELOADS ARE RESTATED HERE, NOT IMPORTED — the probe checks the page
// against the definition, and importing the table it is checking would make
// the comparison circular. If `assignment.ts` changes, this must change with it
// on purpose.

import { chromium } from "playwright";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const SUPERVISOR_OF = {
  "Brandon Forant": "Stephen Rowe",
  "Maria Lopez": "Stephen Rowe",
  "Brandy Forrestor": "Stephen Rowe",
  "Omar Haddad": "Stephen Rowe",
  "Tasha Reyes": "Sasha Rivera",
  "Daniel Okafor": "Sasha Rivera",
  "Priscilla Vance": "Sasha Rivera",
  "Jae Sung Park": "Dana Okafor",
  "Nour Barakat": "Dana Okafor",
  "Victoria Ellery": "Dana Okafor",
};

const b = await chromium.launch();
const open = async (persona, width, scenario = "heavy-caseload") => {
  const ctx = await b.newContext({ viewport: { width, height: 1000 } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona, tasksScenarioId: scenario }, version: VERSION }]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-pane-teen]");
  await page.waitForTimeout(600);
  return { ctx, page };
};

/** Every row's assignee, mentor (read from the pane's mentor chip after
 *  selecting it) and clipping — by scrolling the whole list. */
const readRows = (page, withMentors) =>
  page.evaluate(async (withMentors) => {
    const sc = document.querySelector('[aria-label="Care reviews list"]');
    const out = new Map();
    const clip = (el) => !!el && el.scrollWidth > el.clientWidth + 0.5;
    for (let y = 0; y <= sc.scrollHeight; y += Math.floor(sc.clientHeight * 0.8)) {
      sc.scrollTop = y;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const row of sc.querySelectorAll('[data-anno-ref^="task-row:"]')) {
        const id = row.getAttribute("data-anno-ref");
        if (out.has(id)) continue;
        const cell = row.querySelector("[data-assigned-to]");
        let mentor = null;
        if (withMentors) {
          row.click();
          await new Promise((r) => setTimeout(r, 60));
          mentor = document.querySelector('[data-anno-ref="mentor-chip"]')?.textContent?.replace(/^\S\s*/, "").trim() ?? null;
        }
        out.set(id, {
          assignee: cell ? cell.getAttribute("data-assigned-to") : undefined,
          mentor,
          label: row.getAttribute("aria-label"),
          clipped: {
            name: clip(row.querySelector('span[style*="font-size: 16px"]')),
            outcome: clip(row.querySelector("[data-closed-outcome]")?.parentElement),
            assignee: clip(cell?.firstElementChild),
            date: clip([...row.querySelectorAll("span")].filter((s) => s.style.fontFamily.includes("mono")).pop()),
          },
        });
      }
    }
    sc.scrollTop = 0;
    const header = document.querySelector('[data-anno-ref="worklist-table-header"]')?.textContent ?? "";
    return { rows: [...out.values()], header: header.replace(/\s+/g, " ").trim() };
  }, withMentors);

// ── 1 · a supervisor never sees it ──────────────────────────────────────────
{
  console.log("\n── supervisor");
  const { ctx, page } = await open("supervisor", 1600);
  for (const tab of ["open", "closed"]) {
    await page.locator(`[data-anno-ref="care-tab:${tab}"]`).click();
    await page.waitForTimeout(400);
    const r = await readRows(page, false);
    check(r.rows.length > 0, `${tab}: rows exist, so the next check measures something`, `${r.rows.length}`);
    check(!/Assigned to/.test(r.header) && r.rows.every((x) => x.assignee === undefined),
      `${tab}: no \`Assigned to\` header or cell for a supervisor`, r.header);
  }
  await ctx.close();
}

// ── 2 · an admin sees it, with the right values ────────────────────────────
{
  console.log("\n── admin");
  const { ctx, page } = await open("admin", 1600);
  const openRows = await readRows(page, true);
  /* textContent runs the header cells together, so the match is unspaced —
     measured: "MenteeCycleAssigned toReview age". */
  check(/MenteeCycleAssigned toReview age/.test(openRows.header), "Open: the header carries `Assigned to`", openRows.header);
  const wrong = openRows.rows.filter((x) => x.assignee !== (SUPERVISOR_OF[x.mentor] ?? ""));
  check(openRows.rows.length > 0 && wrong.length === 0,
    "Open: every row's supervisor is its teen's mentor's, by the caseload table",
    wrong.length ? `${wrong.length} wrong, e.g. ${wrong[0].mentor} → "${wrong[0].assignee}"` : `${openRows.rows.length} rows`);
  check(new Set(openRows.rows.map((x) => x.assignee)).size >= 2, "and the column varies — it is not one name on every row",
    [...new Set(openRows.rows.map((x) => x.assignee))].join(" · "));
  check(openRows.rows.every((x) => /assigned to |unassigned/.test(x.label ?? "")), "the accessible name carries it too");

  await page.locator('[data-anno-ref="care-tab:closed"]').click();
  await page.waitForTimeout(400);
  const closedRows = await readRows(page, true);
  check(/Assigned toReview date/.test(closedRows.header), "Closed: the header carries `Assigned to`", closedRows.header);
  const wrongC = closedRows.rows.filter((x) => x.assignee !== (SUPERVISOR_OF[x.mentor] ?? ""));
  check(closedRows.rows.length > 0 && wrongC.length === 0,
    "Closed: every record's supervisor matches the mentor it was reviewed under",
    wrongC.length ? `${wrongC.length} wrong` : `${closedRows.rows.length} rows`);

  /* SORT: first press A→Z, unassigned last. */
  await page.getByRole("button", { name: /Assigned to/ }).first().click();
  await page.waitForTimeout(300);
  const sorted = (await readRows(page, false)).rows.map((x) => x.assignee);
  const named = sorted.filter(Boolean);
  check(named.every((n, i) => i === 0 || named[i - 1].localeCompare(n) <= 0) && sorted.indexOf("") === (sorted.includes("") ? named.length : -1),
    "sorting by `Assigned to` runs A→Z, unassigned last", [...new Set(sorted)].join(" → "));
  await ctx.close();
}

// ── 3 · the frozen value: a record keeps the supervisor it closed under ─────
{
  console.log("\n── closed records keep the supervisor they closed under");
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  /* A record frozen under "Old Supervisor" for a mentor the table now gives
     to Stephen Rowe — the column must say the frozen name. */
  const page0 = await ctx.newPage();
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona: "admin", tasksScenarioId: "heavy-caseload" }, version: VERSION }]
  );
  await page0.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await page0.waitForSelector("[data-pane-teen]");
  /* Submit one real review, then rewrite only its frozen `assignedTo`. */
  await page0.getByRole("combobox", { name: /Assessment of symptoms/i }).first().click();
  await page0.getByRole("option").first().click();
  await page0.getByRole("textbox", { name: /Clinical summary/i }).first().fill("Frozen-assignee probe.");
  await page0.getByRole("textbox", { name: /Diagnostic support/i }).first().fill("Frozen-assignee probe.");
  await page0.getByRole("button", { name: /^Submit$/ }).first().click();
  await page0.waitForTimeout(7500);
  const rewrote = await page0.evaluate((k) => {
    const st = JSON.parse(localStorage.getItem(k));
    const r = st.state.closedCareReviews[0];
    if (!r) return null;
    const live = r.assignedTo?.name ?? null;
    r.assignedTo = { id: "tk-s-old", name: "Old Supervisor" };
    localStorage.setItem(k, JSON.stringify(st));
    return { id: r.id, live };
  }, KEY);
  await page0.reload({ waitUntil: "networkidle" });
  await page0.waitForSelector("[data-pane-teen]");
  await page0.locator('[data-anno-ref="care-tab:closed"]').click();
  await page0.waitForTimeout(400);
  const cell = await page0.locator(`[data-anno-ref="task-row:${rewrote?.id}"] [data-assigned-to]`).getAttribute("data-assigned-to");
  check(!!rewrote?.live, "the submitted record froze a supervisor", rewrote?.live ?? "none");
  check(cell === "Old Supervisor", "and the Closed row shows the frozen name, not today's derivation", `"${cell}" (today: ${rewrote?.live})`);
  await ctx.close();
}

// ── 4 · fit at three widths, both tabs, 600 closed ─────────────────────────
for (const width of [1600, 1440, 1280]) {
  console.log(`\n── fit at ${width}`);
  const { ctx, page } = await open("admin", width, "care-closed-history");
  for (const tab of ["open", "closed"]) {
    await page.locator(`[data-anno-ref="care-tab:${tab}"]`).click();
    await page.waitForTimeout(400);
    const r = await readRows(page, false);
    const c = r.rows.reduce(
      (a, x) => ({
        name: a.name + x.clipped.name,
        outcome: a.outcome + x.clipped.outcome,
        assignee: a.assignee + x.clipped.assignee,
        date: a.date + x.clipped.date,
      }),
      { name: 0, outcome: 0, assignee: 0, date: 0 }
    );
    const cycleShown = await page.evaluate(() =>
      [...document.querySelector('[data-anno-ref="worklist-table-header"]').children].some(
        (x) => /Cycle/.test(x.textContent ?? "") && getComputedStyle(x).display !== "none"
      )
    );
    /* BELOW 1440 THE NAME IS `First L.`, the full one in the tooltip. */
    const shown = await page.evaluate(() => {
      const c = document.querySelector('[aria-label="Care reviews list"] [data-assigned-to]:not([data-assigned-to=""])');
      if (!c) return null;
      /* THE INNER PAIR ONLY. "span span" also matched the truncate wrapper, whose
         text is both forms run together — measured: "Sasha RiveraSasha R.". */
      const visible = [...c.querySelectorAll(":scope > span > span")].find((x) => getComputedStyle(x).display !== "none");
      return { full: c.getAttribute("data-assigned-to"), title: c.getAttribute("title"), visible: visible?.textContent ?? null };
    });
    const expectShort = width < 1440;
    check(
      !!shown && shown.title === shown.full &&
        (expectShort ? /^\S+ [A-Z]\.$/.test(shown.visible ?? "") : shown.visible === shown.full),
      `${tab}: the supervisor reads ${expectShort ? "as `First L.`" : "in full"} at ${width}, full name in the tooltip`,
      shown ? `"${shown.visible}" · title "${shown.title}"` : "no cell"
    );
    check(cycleShown === width >= 1600, `${tab}: Cycle ${width >= 1600 ? "shown" : "hidden"} for an admin at ${width}`, `shown: ${cycleShown}`);
    check(r.rows.length > 0 && Object.values(c).every((n) => n === 0),
      `${tab}: nothing clipped (${r.rows.length} rows)`,
      `names ${c.name} · outcomes ${c.outcome} · assigned ${c.assignee} · dates ${c.date}`);
  }
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
