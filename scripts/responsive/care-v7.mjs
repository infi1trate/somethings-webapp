// ═══════════════════════════════════════════════════════════════════════════
// CARE HERO — MICRO-PACK v7.0 — the report's measurements
//
//   1  the three zones in order, per role: identity strip · anchor cell
//      (Mentorship for a mentor, Clinical diagnosis for a supervisor or lead)
//      · risk tier
//   2  the role gate: no clinical datum anywhere in a mentor's DOM
//   3  facts only: the Mentorship meta is exactly its template
//   4  single homes: tenure once on the page; the Profile tab's Matched row
//      gone; the identity strip the one sanctioned repetition
//   5  the links: View their profile → the Profile tab; ?rail=profile lands
//      there and does not pin it; Supervised by → the supervisor's Support
//      thread
//   6  escalation coexistence: the strip persists above the escalation hero,
//      in both lenses, across tabs
//   7  keyboard order inside the hero
//   8  contrast, light and dark
//   9  no overflow at 1280 and 1512, and a long name truncates
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-v7";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "active-mentorship", extra = {}, width = 1512, height = 1000, theme = "light" } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.addInitScript(
    ([k, v, t]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        localStorage.setItem("somethings.theme", t);
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, chatScenarioId: chat, ...extra }, version: VERSION }, theme]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const careOpen = async (page) => {
  if (!(await page.locator("[data-care-panel]").count())) {
    await page.locator('[data-rail-tab="care"]').first().click();
    await page.waitForTimeout(300);
  }
};
const hero = (page) =>
  page.evaluate(() => {
    const root = document.querySelector("[data-care-hero-root]");
    const card = root?.querySelector('[data-care-hero="steady"]');
    return {
      rootFirst: document.querySelector("[data-care-panel]")?.firstElementChild === root,
      zones: [...(root?.children ?? [])].map((c) => (c.matches("[data-care-identity]") ? "identity" : c.dataset.careHero ?? c.tagName)),
      cells: [...(card?.querySelectorAll("[data-overline]") ?? [])].map((o) => o.textContent.trim()),
      name: root?.querySelector("[data-identity-name]")?.textContent,
      facts: root?.querySelector("[data-identity-facts]")?.textContent,
      headline: root?.querySelector("[data-anchor] [data-anchor-headline]")?.textContent.trim(),
      meta: root?.querySelector("[data-care-mentorship] [data-anchor-meta]")?.textContent.replace(/\s+/g, " ").trim(),
      sup: root?.querySelector('[data-vital="supervisor"]')?.textContent.replace(/\s+/g, " ").trim(),
    };
  });

// ── 1–3 · THE MENTOR'S HERO ────────────────────────────────────────────────
console.log("\n── 1–3 · the mentor's hero");
{
  const { ctx, page } = await open("/app/chat/t14?care=overview");
  await careOpen(page);
  const h = await hero(page);
  check(h.rootFirst && h.zones.join() === "identity,steady", "Zone 1 the identity strip, then the card — the hero root leads the panel", h.zones.join());
  check(h.cells.join() === "The mentorship,Risk tier", "Zone 2 the Mentorship, Zone 3 Risk tier", h.cells.join());
  check(h.name === "Sam Karim" && h.facts === "16 · he/him", "the strip: name · age · pronouns", `${h.name} | ${h.facts}`);
  check(/^\d+ (day|days|weeks|months) together$/.test(h.headline ?? ""), "the headline is the tenure", h.headline);
  check(/^Last spoke (today|yesterday|\d+d ago) · \d+ check-ins? this window$/.test(h.meta ?? ""), "the meta is exactly its template — facts, no characterisation", h.meta);
  check(h.sup === "Supervised by Brandy Forrestor", "the supervision line", h.sup);
  const gate = await page.evaluate(() => ({
    brief: !!document.querySelector("[data-care-brief], [data-icd], [data-anchor='diagnosis']"),
    words: /clinical diagnosis|F\d{2}\.\d|full care record/i.test(document.body.innerText),
  }));
  check(!gate.brief && !gate.words, "the role gate: no diagnosis, ICD code or care-record link anywhere in the mentor's DOM", JSON.stringify(gate));
  const tenureCount = await page.evaluate(() => (document.body.innerText.match(/\btogether\b/g) ?? []).length);
  check(tenureCount === 1, "single home: the tenure appears once on the page", String(tenureCount));
  await page.locator("[data-care-hero-root]").screenshot({ path: `${OUT}/01-mentor-steady.png` });

  // ── 5 · the links ──
  await page.locator("[data-identity-profile]").click();
  await page.waitForTimeout(300);
  const prof = await page.evaluate(() => ({
    sel: document.querySelector('[data-rail-tab="profile"][aria-selected="true"]') !== null,
    panel: !!document.querySelector('[data-slot="profile"], [data-profile-empty]') || /hasn.t filled this in/.test(document.body.innerText),
    matched: [...document.querySelectorAll('[data-slot="profile"] *')].some((e) => e.childElementCount === 0 && e.textContent.trim() === "Matched"),
  }));
  check(prof.sel && prof.panel, "View their profile → the Profile tab", JSON.stringify(prof));
  check(!prof.matched, "single home: the Profile tab's Matched row is gone");
  await page.locator('[data-rail-tab="care"]').first().click();
  await page.waitForTimeout(300);
  await page.locator("[data-mentorship-support]").click();
  await page.waitForTimeout(500);
  const sup = await page.evaluate(() => document.querySelector("[data-support-thread]")?.getAttribute("data-support-thread"));
  check(sup === "s-brandy", "Supervised by → the supervisor's Support thread", String(sup));
  await ctx.close();
}

// ── 5 · THE DEEP LINK ──────────────────────────────────────────────────────
console.log("\n── 5 · ?rail=profile");
{
  const { ctx, page } = await open("/app/chat/t14?rail=profile");
  const sel = await page.evaluate(() => document.querySelector('[data-rail-tab][aria-selected="true"]')?.dataset.railTab);
  check(sel === "profile", "?rail=profile lands on the Profile tab", String(sel));
  await page.locator('[data-rail-tab="care"]').first().click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector('[data-rail-tab][aria-selected="true"]')?.dataset.railTab);
  check(after === "care", "and does not pin it — picking Care holds", String(after));
  await ctx.close();
}

// ── 1–2 · THE SUPERVISOR'S AND THE LEAD'S HERO ─────────────────────────────
console.log("\n── 1–2 · the supervisor's and the lead's hero");
for (const persona of ["supervisor", "lead-mentor"]) {
  const { ctx, page } = await open("/app/chat/t21?care=overview", { persona });
  await careOpen(page);
  const h = await hero(page);
  check(h.zones.join() === "identity,steady" && h.cells.join() === "Clinical diagnosis,Risk tier", `${persona}: identity · Clinical diagnosis · Risk tier`, `${h.zones.join()} | ${h.cells.join()}`);
  const m = await page.evaluate(() => ({ mentorship: !!document.querySelector("[data-care-mentorship]"), together: /\btogether\b/.test(document.querySelector("[data-care-hero-root]").innerText) }));
  check(!m.mentorship && !m.together, `${persona}: no Mentorship cell`, JSON.stringify(m));
  const icd = await page.evaluate(() => {
    const p = document.querySelector("[data-care-brief] [data-anchor-headline]");
    const c = p?.querySelector("[data-icd]");
    if (!p || !c) return null;
    const rects = [...p.getClientRects()];
    const lines = new Set(rects.map((r) => Math.round(r.top)));
    const last = document.createRange();
    last.selectNodeContents(p.firstChild);
    const words = [...last.getClientRects()];
    return { chipLine: Math.abs(c.getBoundingClientRect().top - words.at(-1).top) < 12 };
  });
  check(icd?.chipLine, `${persona}: the ICD code rides the headline's last line, never alone`, JSON.stringify(icd));
  if (persona === "supervisor") await page.locator("[data-care-hero-root]").screenshot({ path: `${OUT}/02-supervisor-steady.png` });
  await ctx.close();
}

// ── 6 · ESCALATION COEXISTENCE ─────────────────────────────────────────────
console.log("\n── 6 · escalation coexistence");
for (const [persona, chat] of [["mentor", "escalation-active"], ["supervisor", "escalation-tier2"]]) {
  const { ctx, page } = await open("/app/chat/t13", { persona, chat });
  await careOpen(page);
  const h = await hero(page);
  check(h.zones.join() === "identity,escalation", `${persona}: the strip, then the escalation hero — the steady card yields`, h.zones.join());
  check(h.name === "Jordan Tate" && h.facts === "15 · they/them", `${persona}: the strip still names the subject`, `${h.name} | ${h.facts}`);
  await page.locator('[data-care-tab="history"], #care-tab-history').first().click();
  await page.waitForTimeout(250);
  const kept = await page.evaluate(() => !!document.querySelector("[data-care-hero-root] [data-care-identity]"));
  check(kept, `${persona}: the strip holds on another Care tab`);
  await page.locator('[data-care-tab="overview"], #care-tab-overview').first().click();
  await page.waitForTimeout(250);
  await page.locator("[data-care-hero-root]").screenshot({ path: `${OUT}/03-${persona}-escalation.png` });
  await ctx.close();
}

// ── 7 · KEYBOARD ORDER ─────────────────────────────────────────────────────
console.log("\n── 7 · keyboard order");
for (const [persona, teen, want] of [
  ["mentor", "t14", ["profile", "support", "tier-info", "escalate"]],
  ["supervisor", "t21", ["profile", "care-record", "tier-info", "update-tier"]],
]) {
  const { ctx, page } = await open(`/app/chat/${teen}?care=overview`, { persona });
  await careOpen(page);
  await page.locator("[data-identity-profile]").focus();
  const order = [];
  for (let i = 0; i < 4; i++) {
    order.push(
      await page.evaluate(() => {
        const a = document.activeElement;
        if (a.matches("[data-identity-profile]")) return "profile";
        if (a.matches("[data-mentorship-support]")) return "support";
        if (a.matches("[data-care-record]")) return "care-record";
        if (a.closest("[data-tier-info]") || a.matches("[data-tier-info]")) return "tier-info";
        return a.closest("[data-tier-action]")?.dataset.tierAction ?? a.dataset.tierAction ?? a.dataset.slot ?? a.tagName;
      })
    );
    await page.keyboard.press("Tab");
  }
  check(order.join() === want.join(), `${persona}: ${want.join(" → ")}`, order.join(" → "));
  await ctx.close();
}

// ── 8 · CONTRAST ───────────────────────────────────────────────────────────
console.log("\n── 8 · contrast");
for (const theme of ["light", "dark"]) {
  for (const [persona, teen] of [["mentor", "t14"], ["supervisor", "t21"]]) {
    const { ctx, page } = await open(`/app/chat/${teen}?care=overview`, { persona, theme });
    await careOpen(page);
    const rows = await page.evaluate(() => {
      const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const ok2lin = (L, a, b) => {
        const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
        return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
      };
      const parse = (css) => {
        let m = css.match(/rgba?\(([^)]+)\)/);
        if (m) { const v = m[1].split(/[,\s/]+/).map(parseFloat); return { c: v.slice(0, 3).map((x) => lin(x / 255)), a: v[3] ?? 1 }; }
        m = css.match(/oklab\(([^)]+)\)/);
        if (m) { const v = m[1].trim().split(/[\s/]+/).map(parseFloat); return { c: ok2lin(v[0], v[1], v[2]), a: v[3] ?? 1 }; }
        m = css.match(/color\(srgb\s+([^)]+)\)/);
        if (m) { const v = m[1].trim().split(/[\s/]+/).map(parseFloat); return { c: v.slice(0, 3).map(lin), a: v[3] ?? 1 }; }
        return null;
      };
      const bgOf = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const p = parse(getComputedStyle(e).backgroundColor);
          if (p && p.a > 0.5) return p.c;
        }
        return [1, 1, 1];
      };
      const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
      const sample = {
        "strip · name": "[data-identity-name]",
        "strip · age, pronouns": "[data-identity-facts]",
        "strip · View their profile": "[data-identity-profile]",
        "overline": "[data-care-hero='steady'] [data-overline]",
        "anchor headline": "[data-anchor] [data-anchor-headline]",
        "anchor meta": "[data-anchor] [data-anchor-meta]",
        "supervision line": "[data-vital='supervisor']",
        "supervisor link": "[data-mentorship-support]",
        "ICD chip": "[data-icd]",
        "care-record link": "[data-care-record]",
      };
      return Object.entries(sample).flatMap(([k, s]) => {
        const el = document.querySelector(s);
        if (!el) return [];
        const fg = parse(getComputedStyle(el).color);
        return [{ k, r: fg ? Number(ratio(fg.c, bgOf(el)).toFixed(2)) : null }];
      });
    });
    for (const r of rows) check(r.r !== null && r.r >= 4.5, `${theme} · ${persona} · ${r.k}`, `${r.r}:1`);
    if (theme === "dark" && persona === "mentor") await page.locator("[data-care-hero-root]").screenshot({ path: `${OUT}/04-mentor-dark.png` });
    await ctx.close();
  }
}

// ── 9 · NO OVERFLOW ────────────────────────────────────────────────────────
console.log("\n── 9 · overflow");
for (const width of [1280, 1512]) {
  const { ctx, page } = await open("/app/chat/t14?care=overview", { width });
  await careOpen(page);
  const o = await page.evaluate(() => {
    const r = document.querySelector("[data-care-hero-root]");
    const s = r.querySelector("[data-care-identity]");
    const n = s.querySelector("[data-identity-name]");
    n.textContent = "Alexandria-Rosalind Montgomery-Okonkwo";
    const strip = { over: s.scrollWidth > s.clientWidth + 1, link: s.querySelector("[data-identity-profile]").getBoundingClientRect().right <= s.getBoundingClientRect().right + 1, trunc: n.scrollWidth > n.clientWidth };
    return { root: r.scrollWidth <= r.clientWidth + 1, ...strip };
  });
  check(o.root && !o.over && o.link && o.trunc, `${width}: no overflow; a long name truncates and the profile link stays whole`, JSON.stringify(o));
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
