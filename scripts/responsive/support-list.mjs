// ═══════════════════════════════════════════════════════════════════════════
// THE SUPPORT LIST (SUP-3), measured
//
//   · four sections in order; each header a real button with aria-expanded and
//     aria-controls; Supervisors open, the rest closed; the chevron rotates
//   · disclosure persists per persona, across a reload and a route change
//   · the row: 32 avatar, 9px status-online dot on a 1px surface-canvas ring,
//     16/24 primary name, 12/16 tertiary preview and time, a divider between
//   · presence is in the name ("…, online"), never the dot alone
//   · timestamps follow the ladder, never a large day count, and carry the
//     absolute instant (title + <time datetime>)
//   · unread on the row, rolled up onto a closed header
//   · states: empty section, first run, loading skeletons (no spinner), error
//     with a retry that works, partial, offline banner

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = "docs/support-panel/sup-3";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
const open = async (persona, width, path, extra = {}, opts = {}) => {
  const ctx = await b.newContext({
    viewport: { width, height: width < 600 ? 844 : 982 },
    deviceScaleFactor: opts.dpr ?? 1,
    reducedMotion: opts.reducedMotion ?? "no-preference",
  });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        localStorage.removeItem("somethings.support.disclosure");
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, ...extra }, version: VERSION }]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.locator("[data-support-cta]").filter({ visible: true }).first().click();
  await page.waitForTimeout(450);
  return { ctx, page };
};
const sections = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-support-section]")].map((s) => {
      const btn = s.querySelector("[data-support-section-toggle]");
      const body = document.getElementById(btn.getAttribute("aria-controls"));
      const chev = btn.querySelector("svg");
      return {
        id: s.dataset.supportSection,
        tag: btn.tagName,
        expanded: btn.getAttribute("aria-expanded"),
        controls: !!body && body.closest("[data-support-section]") === s,
        hidden: body?.hidden,
        rotate: getComputedStyle(chev).rotate,
        label: btn.textContent.replace(/\s+/g, " ").trim(),
        rows: s.querySelectorAll("[data-support-row]").length,
        h: Math.round(btn.getBoundingClientRect().height),
      };
    })
  );
const toggle = async (page, id) => {
  await page.locator(`[data-support-section="${id}"] [data-support-section-toggle]`).click();
  await page.waitForTimeout(250);
};

// ── 1 · structure, default disclosure, the row ─────────────────────────────
{
  console.log("\n── mentor at 1512");
  const { ctx, page } = await open("mentor", 1512, "/app", { chatScenarioId: "escalation-active" }, { dpr: 2 });
  const s0 = await sections(page);
  check(s0.map((s) => s.id).join() === "supervisors,cohorts,groups,other", "four sections, in order", s0.map((s) => s.id).join());
  check(s0.every((s) => s.tag === "BUTTON" && s.controls), "each header is a button controlling its own body");
  check(s0.map((s) => s.expanded).join() === "true,false,false,false", "Supervisors open, the rest closed", s0.map((s) => s.expanded).join());
  check(s0.every((s) => (s.expanded === "true") === !s.hidden), "aria-expanded matches what is shown");
  check(s0[0].rotate === "none" && s0[1].rotate !== "none", "the chevron rotates with the state", `${s0[0].rotate} / ${s0[1].rotate}`);
  check(s0.every((s) => s.h >= 40), "headers are at least 40 tall", s0.map((s) => s.h).join());

  const row = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-support-section="supervisors"] [data-support-row]')];
    const css = (e) => getComputedStyle(e);
    /* The repo's token, resolved, rather than Appendix B's #0e0d0c: the two
       disagree (flagged), and the token is the authority. */
    const probe = document.createElement("span");
    probe.style.color = "var(--text-primary)";
    document.body.appendChild(probe);
    const primary = css(probe).color;
    probe.remove();
    return rows.map((r) => {
      const av = r.querySelector("span.relative > span");
      const dot = r.querySelector("[data-presence-dot]");
      const name = r.querySelector(".text-\\[16px\\]");
      const prev = r.querySelector(".text-\\[12px\\].truncate");
      const time = r.querySelector("time");
      const rr = r.getBoundingClientRect();
      return {
        id: r.dataset.supportRow,
        text: r.textContent.replace(/\s+/g, " ").trim(),
        av: [Math.round(av.getBoundingClientRect().width), Math.round(av.getBoundingClientRect().height)],
        dot: dot ? { w: Math.round(dot.getBoundingClientRect().width), bg: css(dot).backgroundColor, ring: css(dot).boxShadow } : null,
        name: { fs: css(name).fontSize, lh: css(name).lineHeight, c: css(name).color },
        prev: { fs: css(prev).fontSize, lh: css(prev).lineHeight, c: css(prev).color },
        time: time ? { fs: css(time).fontSize, c: css(time).color, dt: time.getAttribute("datetime"), title: time.getAttribute("title"), rightGap: Math.round(rr.right - time.getBoundingClientRect().right) } : null,
        border: css(r).borderBottomWidth,
        primary,
        unread: r.querySelector('[aria-hidden="true"].rounded-full.tabular-nums')?.textContent ?? null,
      };
    });
  });
  check(row.length === 2, "two supervisors for a mentor", row.map((r) => r.id).join());
  check(row.every((r) => r.av[0] === 32 && r.av[1] === 32), "32px avatars", JSON.stringify(row.map((r) => r.av)));
  const online = row.find((r) => r.dot);
  check(online?.dot.w === 9 && online.dot.bg === "rgb(27, 218, 122)", "a 9px status-online dot", JSON.stringify(online?.dot));
  check(/rgb\(246, 244, 239\) 0px 0px 0px 1px/.test(online?.dot.ring ?? ""), "on a 1px surface-canvas ring", online?.dot.ring);
  check(/, online/.test(online?.text ?? "") && !row.filter((r) => !r.dot).some((r) => /online/.test(r.text)), "presence is in the name, for the online row only", row.map((r) => r.text.slice(0, 32)).join(" | "));
  check(row.every((r) => r.name.fs === "16px" && r.name.lh === "24px" && r.name.c === r.primary), "name 16/24 text-primary", `${JSON.stringify(row[0].name)} · token ${row[0].primary}`);
  check(row.every((r) => r.prev.fs === "12px" && r.prev.lh === "16px" && r.prev.c === "rgb(113, 106, 96)"), "preview 12/16 text-tertiary", JSON.stringify(row[0].prev));
  check(row.every((r) => r.time && r.time.fs === "12px" && r.time.c === "rgb(113, 106, 96)" && r.time.dt && r.time.title && r.time.rightGap === 16), "time 12px tertiary, right-aligned, with datetime and title", JSON.stringify(row[0].time));
  check(row[0].border === "1px" && row[row.length - 1].border === "0px", "a divider between rows, none after the last");
  check(row.some((r) => r.unread === "1" && /1 unread/.test(r.text)), "unread on the row, in its name too", row.map((r) => r.unread).join());

  /* ROLL-UP */
  const cohorts = s0.find((s) => s.id === "cohorts");
  check(/2 unread/.test(cohorts.label), "a closed section rolls its unread up onto the header", cohorts.label);
  await toggle(page, "cohorts");
  const c1 = (await sections(page)).find((s) => s.id === "cohorts");
  check(c1.expanded === "true" && !/unread/.test(c1.label) && c1.rows === 2, "open, the header drops it and the rows carry it", c1.label);

  /* TIMESTAMPS */
  await toggle(page, "groups");
  await toggle(page, "other");
  const stamps = await page.evaluate(() => [...document.querySelectorAll("[data-support-list] time")].map((t) => t.textContent));
  const ladder = /^(now|\d+m|\d+h|[1-6]d|[A-Z][a-z]{2} \d{1,2}|[A-Z][a-z]{2} \d{4})$/;
  check(stamps.every((t) => ladder.test(t)), "every time is on the ladder", stamps.join(" · "));
  check(!stamps.some((t) => /^\d{2,}d$/.test(t)), "no large day counts");
  check(stamps.some((t) => /^[A-Z][a-z]{2} \d{1,2}$/.test(t)) && stamps.some((t) => /^[A-Z][a-z]{2} \d{4}$/.test(t)), "dates past a week, the year past a year");
  await page.screenshot({ path: `${OUT}/01-mentor-all-open-1512.png` });

  /* PERSISTENCE: reload, route change */
  await toggle(page, "supervisors");
  const before = (await sections(page)).map((s) => s.expanded).join();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.locator("[data-support-cta]").filter({ visible: true }).first().click();
  await page.waitForTimeout(450);
  const after = (await sections(page)).map((s) => s.expanded).join();
  check(before === "false,true,true,true" && after === before, "disclosure survives a reload", `${before} → ${after}`);
  await page.locator('nav a[href="/app/chat"]').first().click();
  await page.waitForURL("**/app/chat");
  await page.waitForTimeout(600);
  check((await sections(page)).map((s) => s.expanded).join() === before, "and a route change");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("somethings.support.disclosure") ?? "{}"));
  check(Object.keys(stored).join() === "mentor", "stored per persona", JSON.stringify(stored));
  await ctx.close();
}

// ── 2 · empty section, first run ───────────────────────────────────────────
{
  console.log("\n── supervisor: an empty section");
  const { ctx, page } = await open("supervisor", 1512, "/app/care-reviews");
  const e = await page.evaluate(() => document.querySelector('[data-support-section="supervisors"] [data-support-empty]')?.textContent.trim());
  check(e === "No supervisors assigned yet.", "Supervisors says it is empty, not a blank region", e);
  await page.screenshot({ path: `${OUT}/02-supervisor-empty-section-1512.png` });
  await ctx.close();
}
{
  console.log("\n── admin: first run");
  const { ctx, page } = await open("admin", 1512, "/app/care-reviews");
  const f = await page.evaluate(() => ({
    first: document.querySelector("[data-support-first-run]")?.textContent.replace(/\s+/g, " ").trim(),
    sections: document.querySelectorAll("[data-support-section]").length,
  }));
  check(!!f.first && /Somethings team/.test(f.first) && f.sections === 0, "an explanatory line and what Support is for, no empty sections", f.first);
  await page.screenshot({ path: `${OUT}/03-admin-first-run-1512.png` });
  await ctx.close();
}

// ── 3 · loading, error + retry, partial ────────────────────────────────────
{
  console.log("\n── loading");
  const { ctx, page } = await open("mentor", 1512, "/app", { devLoadState: "loading" });
  const l = await page.evaluate(() => ({
    skel: document.querySelectorAll("[data-support-skeleton] li").length,
    spinner: document.querySelectorAll('[data-support-list] .animate-spin, [data-support-list] [role="progressbar"]').length,
    headers: document.querySelectorAll("[data-support-section-toggle]").length,
  }));
  check(l.skel > 0 && l.spinner === 0, "skeleton rows, no spinner", JSON.stringify(l));
  check(l.headers === 4, "the section headers stay, so the shape is known while it loads");
  await page.screenshot({ path: `${OUT}/04-loading-1512.png` });
  await ctx.close();
}
{
  console.log("\n── error");
  const { ctx, page } = await open("mentor", 1512, "/app", { devLoadState: "error" });
  const err = await page.evaluate(() => document.querySelector("[data-support-error]")?.textContent.replace(/\s+/g, " ").trim());
  check(!!err && /didn't load/.test(err) && /try again/i.test(err) && !/something went wrong/i.test(err), "says what happened and what to do", err);
  await page.screenshot({ path: `${OUT}/05-error-1512.png` });
  await page.locator("[data-support-retry]").click();
  await page.waitForTimeout(150);
  const mid = await page.evaluate(() => document.querySelector("[data-support-list]").dataset.state);
  await page.waitForTimeout(700);
  const end = await page.evaluate(() => ({ state: document.querySelector("[data-support-list]").dataset.state, rows: document.querySelectorAll("[data-support-row]").length }));
  check(mid === "loading" && end.state === "ready" && end.rows > 0, "retry loads, then shows the list", `${mid} → ${end.state}, ${end.rows} rows`);
  await ctx.close();
}
{
  console.log("\n── partial");
  const { ctx, page } = await open("mentor", 1512, "/app", { devLoadState: "partial" });
  await toggle(page, "cohorts");
  const p = await page.evaluate(() => ({
    failed: document.querySelector('[data-support-section="cohorts"] [data-support-error]')?.textContent.trim(),
    others: document.querySelectorAll('[data-support-section="supervisors"] [data-support-row]').length,
  }));
  check(!!p.failed && p.others === 2, "one section fails while the others render", JSON.stringify(p));
  await page.screenshot({ path: `${OUT}/06-partial-1512.png` });
  await ctx.close();
}

// ── 4 · offline ────────────────────────────────────────────────────────────
{
  console.log("\n── offline");
  const { ctx, page } = await open("mentor", 1512, "/app");
  check((await page.locator("[data-support-offline]").count()) === 0, "online: no banner");
  await ctx.setOffline(true);
  await page.waitForTimeout(300);
  const o = await page.evaluate(() => {
    const el = document.querySelector("[data-support-offline]");
    const list = document.querySelector("[data-support-list]");
    return el ? { role: el.getAttribute("role"), first: list.firstElementChild === el, text: el.textContent.trim() } : null;
  });
  check(o?.role === "status" && o.first, "offline: a status banner at the top of the panel", o?.text);
  await page.screenshot({ path: `${OUT}/07-offline-1512.png` });
  await ctx.setOffline(false);
  await page.waitForTimeout(300);
  check((await page.locator("[data-support-offline]").count()) === 0, "and it goes when the connection returns");
  await ctx.close();
}

// ── 5 · widths ─────────────────────────────────────────────────────────────
for (const width of [1280, 1024, 768, 390]) {
  console.log(`\n── mentor at ${width}`);
  const { ctx, page } = await open("mentor", width, "/app", {}, { dpr: width < 600 ? 3 : 1 });
  await toggle(page, "groups");
  const m = await page.evaluate(() => {
    const body = document.querySelector("[data-support-body]");
    return { overflow: body.scrollWidth - body.clientWidth, w: Math.round(body.getBoundingClientRect().width) };
  });
  check(m.overflow <= 0, "nothing in the list scrolls sideways", JSON.stringify(m));
  await page.screenshot({ path: `${OUT}/08-mentor-${width}.png` });
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
