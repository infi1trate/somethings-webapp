// ═══════════════════════════════════════════════════════════════════════════
// THE CLOSED TAB, END TO END (Closed-tab pack §0–§4)
//
// Submits a real review through the real form, then reads it back as a
// supervisor would: on the Closed tab, after the undo window, after a reload.
//
//   §0.1  the text that was typed is the text on the record
//   §0.2  nothing on a closed record can submit it again — no button, no chord
//   §0.3  the rail badge is the open count, on both tabs
//   §1    every closed review, grouped by day, virtualized at 600, searchable
//   §3    the Closed column and the outcome line; no working-state markers
//   §4    `Completed today` renders nowhere
//
// THE INPUTS ARE ASSERTED before anything is measured against them — a probe
// that found no closed rows would otherwise pass every "none of these render"
// check by measuring nothing.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = "docs/responsive/care-closed";
await mkdir(OUT, { recursive: true });

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
const contextFor = async (scenario) => {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(
    ([k, v]) => {
      /* SEED ONCE. A reload must read what the app persisted, not this. */
      if (!sessionStorage.getItem("probe-seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("probe-seeded", "1");
      }
    },
    [KEY, { state: { persona: "supervisor", tasksScenarioId: scenario }, version: VERSION }]
  );
  return ctx;
};

const tabCount = (page, tab) =>
  page.evaluate((t) => {
    const el = document.querySelector(`[data-anno-ref="care-tab:${t}"]`);
    const m = el?.textContent?.match(/\((\d+)\)/);
    return m ? Number(m[1]) : null;
  }, tab);
const badge = (page) =>
  page.evaluate(() => {
    const link = [...document.querySelectorAll("nav a")].find((a) => /Care Reviews/.test(a.textContent ?? ""));
    /* THE SPOKEN COUNT, NOT textContent: the badge draws "16" and says
       "16 open", and the two concatenate to "1616 open" — measured, the first
       run of this probe read 1616. */
    const spoken = [...(link?.querySelectorAll(".sr-only") ?? [])].map((e) => e.textContent ?? "").join(" ");
    const m = spoken.match(/(\d+)\s*open/);
    return m ? Number(m[1]) : link ? 0 : null;
  });

// ═══════════════════════════════════════════════════════════════════════════
// 1 · SUBMIT, THEN READ IT BACK
// ═══════════════════════════════════════════════════════════════════════════
{
  console.log("\n── submit a review, read it back (heavy-caseload)");
  const ctx = await contextFor("heavy-caseload");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-pane-teen]");
  await page.waitForTimeout(800);

  const open0 = await tabCount(page, "open");
  const closed0 = await tabCount(page, "closed");
  const badge0 = await badge(page);
  check(open0 > 0 && closed0 !== null, "the tabs report counts, so the checks below measure something", `open ${open0} · closed ${closed0}`);
  check(badge0 === open0, "§0.3 · the badge is the open count before any submission", `badge ${badge0} · open ${open0}`);

  const teen = await page.locator("[data-pane-teen]").innerText();
  const stamp = Date.now().toString(36);
  const CLIN = `Probe clinical summary ${stamp}: mood steadier, sleep improved.`;
  const DIAG = `Probe diagnostic statement ${stamp}: PHQ-9 supports the code.`;
  await page.getByRole("combobox", { name: /Assessment of symptoms/i }).first().click();
  await page.waitForTimeout(200);
  const assessment = (await page.getByRole("option").first().innerText()).trim();
  await page.getByRole("option").first().click();
  await page.getByRole("textbox", { name: /Clinical summary/i }).first().fill(CLIN);
  await page.getByRole("textbox", { name: /Diagnostic support/i }).first().fill(DIAG);
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /^Submit$/ }).first().click();
  /* THE UNDO WINDOW IS 6s; the record is written when it closes. */
  await page.waitForTimeout(7500);

  const open1 = await tabCount(page, "open");
  const closed1 = await tabCount(page, "closed");
  check(open1 === open0 - 1, "the review left Open", `${open0} → ${open1}`);
  check(closed1 === closed0 + 1, "and arrived on Closed", `${closed0} → ${closed1}`);
  check((await badge(page)) === open1, "§0.3 · the badge follows the open count on Open", `badge ${await badge(page)} · open ${open1}`);

  await page.locator('[data-anno-ref="care-tab:closed"]').click();
  await page.waitForTimeout(600);
  check((await badge(page)) === open1, "§0.3 · and still reads the open count on Closed", `badge ${await badge(page)} · open ${open1}`);

  /* THE NEWEST RECORD IS THE FIRST ROW — select it explicitly. */
  const firstRow = page.locator('[data-anno-ref^="task-row:"]').first();
  const firstLabel = await firstRow.getAttribute("aria-label");
  check(firstLabel?.startsWith(`Today, ${teen}`), "the submitted review is the first row, under Today", firstLabel ?? "no row");
  await firstRow.click();
  await page.waitForTimeout(500);

  const pane = page.locator('[data-slot="task-pane"]');
  const paneText = (await pane.innerText()).replace(/\s+/g, " ");
  check(paneText.includes(CLIN), "§0.1 · the clinical summary typed is the one on the record");
  check(paneText.includes(DIAG), "§0.1 · and the diagnostic statement");
  check(paneText.includes(assessment), "§0.1 · and the assessment selection", assessment);
  const controls = await pane.evaluate((el) => ({
    inputs: el.querySelectorAll("textarea, input, [role=combobox], select").length,
    buttons: [...el.querySelectorAll("button")].map((b) => b.textContent?.trim() ?? ""),
    text: el.textContent ?? "",
  }));
  check(controls.inputs === 0, "§2.2 · content as text — no textarea, input or select", `${controls.inputs} controls`);
  for (const word of ["Submit", "Save draft", "Change presentation"])
    check(!controls.buttons.some((t) => t === word || t.endsWith(word)), `§2.2 · no \`${word}\` on a closed record`);
  check(!/fields? (still )?needed/.test(controls.text), "§2.2 · no `fields needed` status");
  const byline = (await pane.locator('[data-slot="closed-byline"]').innerText()).replace(/\s+/g, " ");
  check(
    /Submitted by .+ · [A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M$/.test(byline) &&
      !/(\b\w[\w ]*) · \1 ·/.test(byline),
    "§2.2 · the footer is who and when, absolute",
    byline
  );
  check(/at time of review/.test(paneText), "§2.3 · header figures are labelled as the snapshot");
  await page.screenshot({ path: `${OUT}/01-closed-record.png` });

  /* §0.2 · THE CHORD. `⌘/Ctrl+Enter` pressed the review's submit on Open. */
  await pane.click({ position: { x: 40, y: 200 } });
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Meta+Enter");
  await page.waitForTimeout(800);
  check((await tabCount(page, "closed")) === closed1, "§0.2 · ⌘/Ctrl+Enter on a closed record submits nothing", `closed ${await tabCount(page, "closed")}`);
  check((await page.getByRole("button", { name: /^Undo$/ }).count()) === 0, "§0.2 · and raises no undo toast");

  /* §3.2 · no working-state markers on Closed. */
  const markers = await page.evaluate(() => ({
    dots: document.querySelectorAll('[aria-label="Care reviews list"] [data-anno-ref="unviewed-dot"]').length,
    drafts: document.querySelectorAll('[aria-label="Care reviews list"] [data-anno-ref="draft-icon"]').length,
    rows: document.querySelectorAll('[aria-label="Care reviews list"] [data-anno-ref^="task-row:"]').length,
  }));
  check(markers.rows > 0 && markers.dots === 0 && markers.drafts === 0, "§3.2 · no unviewed dot or draft icon on Closed", JSON.stringify(markers));

  /* §4 · gone, on both tabs. */
  const completedHere = await page.locator("text=Completed today").count();
  await page.locator('[data-anno-ref="care-tab:open"]').click();
  await page.waitForTimeout(400);
  const completedOpen = await page.locator("text=Completed today").count();
  check(completedHere === 0 && completedOpen === 0, "§4 · `Completed today` renders on neither tab", `closed ${completedHere} · open ${completedOpen}`);

  /* §0.1 · ACROSS A RELOAD — the second defect: the trace was never persisted. */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("[data-pane-teen]");
  await page.waitForTimeout(800);
  check((await tabCount(page, "open")) === open1, "§0.1 · after a reload the review is still off Open", `${await tabCount(page, "open")}`);
  check((await tabCount(page, "closed")) === closed1, "§0.1 · and still on Closed", `${await tabCount(page, "closed")}`);
  await page.locator('[data-anno-ref="care-tab:closed"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-anno-ref^="task-row:"]').first().click();
  await page.waitForTimeout(400);
  check((await pane.innerText()).includes(CLIN), "§0.1 · with its text intact");

  /* §1 · SEARCH BY MENTOR ON THIS TAB. */
  const mentor = await page.evaluate(() => {
    const chip = document.querySelector('[data-anno-ref="mentor-chip"]');
    return chip?.textContent?.replace(/^\S\s*/, "").trim() ?? null;
  });
  await page.getByRole("searchbox").first().fill(mentor ?? "");
  await page.waitForTimeout(500);
  const found = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-label="Care reviews list"] [data-anno-ref^="task-row:"]')].length
  );
  check(!!mentor && found > 0, "§1 · searching a mentor's name on Closed finds their reviews", `"${mentor}" → ${found} rows`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · 600 CLOSED — GROUPS, VIRTUALIZATION, SCROLL TO THE END
// ═══════════════════════════════════════════════════════════════════════════
{
  console.log("\n── 600 closed reviews (care-closed-history)");
  const ctx = await contextFor("care-closed-history");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-pane-teen]");
  await page.locator('[data-anno-ref="care-tab:closed"]').click();
  await page.waitForTimeout(800);
  check((await tabCount(page, "closed")) === 600, "the scenario holds 600 closed reviews", `${await tabCount(page, "closed")}`);

  const m = await page.evaluate(() => {
    const sc = document.querySelector('[aria-label="Care reviews list"]');
    const rows = sc.querySelectorAll('[data-anno-ref^="task-row:"]').length;
    return { rows, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight };
  });
  check(m.rows > 0 && m.rows < 60, "§1 · virtualized: a few dozen rows mounted, not 600", `${m.rows} mounted · scrollHeight ${m.scrollHeight}px`);

  /* EVERY HEADER, BY SCROLLING THE WHOLE LIST — headers outside the window are
     not mounted, so they are collected as the list passes. */
  const groups = await page.evaluate(async () => {
    const sc = document.querySelector('[aria-label="Care reviews list"]');
    const seen = new Map();
    const re = /^(.+?) — (\d+)$/;
    for (let y = 0; y <= sc.scrollHeight; y += Math.floor(sc.clientHeight * 0.8)) {
      sc.scrollTop = y;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const el of sc.querySelectorAll("[aria-hidden]")) {
        const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        const mm = t.match(re);
        if (mm && el.children.length <= 3 && t.length < 30) seen.set(mm[1], Number(mm[2]));
      }
    }
    sc.scrollTop = sc.scrollHeight;
    await new Promise((r) => setTimeout(r, 200));
    const last = [...sc.querySelectorAll('[data-anno-ref^="task-row:"]')].pop()?.getAttribute("aria-label") ?? null;
    return { groups: [...seen.entries()], last };
  });
  const sum = groups.groups.reduce((a, [, n]) => a + n, 0);
  check(groups.groups[0]?.[0] === "Today", "§1 · the first group is Today", groups.groups.slice(0, 4).map(([l, n]) => `${l} ${n}`).join(" · "));
  check(sum === 600, "§1 · the group counts sum to the tab count", `${groups.groups.length} groups, Σ ${sum}`);
  check(!!groups.last && /closed [A-Z][a-z]{2} \d{1,2}, 2026/.test(groups.last), "§1 · the end of the list is reachable", groups.last ?? "");
  await page.evaluate(() => (document.querySelector('[aria-label="Care reviews list"]').scrollTop = 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/02-closed-600.png` });
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE v53 TRACE IS DROPPED ON MIGRATION (answered 2026-10-06)
// ═══════════════════════════════════════════════════════════════════════════
{
  console.log("\n── a v53 store's `{ id, at }` submissions are dropped");
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("probe-seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("probe-seeded", "1");
      }
    },
    [
      KEY,
      {
        state: {
          persona: "supervisor",
          tasksScenarioId: "heavy-caseload",
          submittedCareReviews: [{ id: "task-1", at: Date.now() - 3600_000 }],
        },
        version: 53,
      },
    ]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-pane-teen]");
  await page.waitForTimeout(800);
  const open = await tabCount(page, "open");
  const closed = await tabCount(page, "closed");
  const stored = await page.evaluate((k) => {
    const st = JSON.parse(localStorage.getItem(k) ?? "{}");
    return { version: st.version, legacy: "submittedCareReviews" in (st.state ?? {}), records: st.state?.closedCareReviews?.length ?? null };
  }, KEY);
  /* The input is asserted: a seed that never reached the store would pass the
     two checks below by measuring the default state. */
  check(stored.version === VERSION, "the v53 seed was read and migrated", `stored version ${stored.version}`);
  check(open === 16 && closed === 40, "the legacy entry makes no record — the item stays open, Closed holds only the fixture", `open ${open} · closed ${closed}`);
  check(!stored.legacy && stored.records === 0, "and the old field is gone from storage", JSON.stringify(stored));
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
