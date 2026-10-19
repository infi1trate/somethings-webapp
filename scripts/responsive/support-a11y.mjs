// ═══════════════════════════════════════════════════════════════════════════
// SUP-6 — ACCESSIBILITY AND STATE VERIFICATION, measured not asserted
//
//   1 · contrast: every rendered text node in the bar and the panel (list,
//       thread, composer) against its real background, light and dark —
//       4.5:1, or 3:1 for large text; icons and the focus ring against 3:1
//   2 · keyboard: bar → panel → section headers → rows → thread → composer;
//       disabled controls never take focus; Esc closes, focus to the CTA
//   3 · focus indicators: every focusable in the panel shows a ≥2px ring at
//       ≥3:1 against what is behind it
//   4 · targets: ≥24×24 everywhere; 40×40 in the bar and the panel toolbars
//   5 · announcements, structurally (an accessibility-tree read, NOT a screen
//       reader session): the panel is a named region whose heading takes focus
//       on open; headers expose expanded state; messages are a polite log
//   6 · reduced motion: nothing in the panel transitions or animates
//   7 · every SUP-3 and SUP-4 state at 1512 / 1280 / 1024 / 768 / 390
//
// Colours are measured by painting the COMPUTED value into a canvas and
// reading the pixel back, so any CSS colour syntax resolves the same way, and
// ancestor opacity is multiplied in. A text node's background is the first
// opaque ancestor background, with translucent ones composited over it.

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = "docs/support-panel/sup-6";
await mkdir(`${OUT}/states`, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const report = {};

const b = await chromium.launch();
async function open(persona, width, path, extra = {}, opts = {}) {
  const ctx = await b.newContext({
    viewport: { width, height: opts.height ?? (width < 600 ? 844 : 982) },
    deviceScaleFactor: opts.dpr ?? 1,
    reducedMotion: opts.reducedMotion ?? "no-preference",
  });
  await ctx.addInitScript(
    ([k, v, theme]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        localStorage.removeItem("somethings.support.disclosure");
        if (theme) localStorage.setItem("somethings.theme", theme);
        else localStorage.removeItem("somethings.theme");
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, ...extra }, version: VERSION }, opts.theme ?? null]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return { ctx, page };
}
const cta = (page) => page.locator("[data-support-cta]").filter({ visible: true }).first();
const openPanel = async (page) => {
  await cta(page).click();
  await page.waitForTimeout(450);
};
const expandAll = (page) =>
  page.evaluate(async () => {
    for (const t of document.querySelectorAll("[data-support-section-toggle]"))
      if (t.getAttribute("aria-expanded") !== "true") t.click();
    await new Promise((r) => setTimeout(r, 250));
  });
const openRow = async (page, id) => {
  await page.locator(`[data-support-row="${id}"] [data-support-row-open]`).click();
  await page.waitForTimeout(400);
};

/* ── the colour engine, injected once per page ───────────────────────────── */
const ENGINE = `(() => {
  if (window.__c) return;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => {
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, under) => {
    const a = top[3];
    return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1];
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const opacity = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    if (stack.length && stack[stack.length - 1][3] >= 1) base = stack.pop();
    while (stack.length) base = over(stack.pop(), base);
    return base;
  };
  const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== "hidden"; };
  const inert = (el) => !!el.closest('[aria-disabled="true"],:disabled,[inert]');
  window.__c = { rgba, over, ratio, bgOf, opacity, hex, visible, inert };
})()`;

/** Every rendered text node under `root`: its ink, its background, its ratio. */
const textPairs = (page, root) =>
  page.evaluate(
    ([ENGINE, root]) => {
      eval(ENGINE);
      const { rgba, over, ratio, bgOf, opacity, hex, visible, inert } = window.__c;
      const out = [];
      const scope = document.querySelector(root);
      if (!scope) return out;
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        if (seen.has(el) || !visible(el)) continue;
        seen.add(el);
        const s = getComputedStyle(el);
        const bg = bgOf(el);
        const fg0 = rgba(s.color);
        const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity(el)], bg);
        const size = parseFloat(s.fontSize);
        const large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight) >= 700);
        const r = ratio(fg, bg);
        /* AN AVATAR INITIAL IS DECORATION: `RecordAvatar` is aria-hidden and the
           name is always beside it, so 1.4.3 does not apply. It is measured and
           reported apart rather than silently dropped. */
        const avatar = el.getAttribute("aria-hidden") === "true" && el.classList.contains("rounded-full") && /^.$/.test(n.textContent.trim());
        out.push({ text: n.textContent.trim().slice(0, 40), fg: hex(fg), bg: hex(bg), ratio: Math.round(r * 100) / 100, need: large ? 3 : 4.5, inert: inert(el), avatar });
      }
      /* Placeholders are text too (the Figma's #999388 failed here). */
      for (const t of scope.querySelectorAll("textarea, input")) {
        if (!visible(t) || !t.placeholder) continue;
        const bg = bgOf(t);
        const fg = over(rgba(getComputedStyle(t, "::placeholder").color), bg);
        out.push({ text: `placeholder: ${t.placeholder}`, fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio(fg, bg) * 100) / 100, need: 4.5, inert: t.disabled });
      }
      return out;
    },
    [ENGINE, root]
  );

/** Icons (non-text, 3:1) under `root`, live controls only. */
const iconPairs = (page, root) =>
  page.evaluate(
    ([ENGINE, root]) => {
      eval(ENGINE);
      const { rgba, over, ratio, bgOf, opacity, hex, visible, inert } = window.__c;
      return [...document.querySelectorAll(`${root} svg`)]
        .filter((s) => visible(s) && !inert(s))
        .map((s) => {
          const host = s.closest("button,a,[role=button]") ?? s.parentElement;
          const bg = bgOf(s.parentElement);
          const c0 = rgba(getComputedStyle(s).stroke !== "none" ? getComputedStyle(s).stroke : getComputedStyle(s).color);
          const fg = over([c0[0], c0[1], c0[2], c0[3] * opacity(s)], bg);
          return { host: (host.getAttribute("aria-label") || host.textContent || host.tagName).trim().slice(0, 32), fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio(fg, bg) * 100) / 100 };
        });
    },
    [ENGINE, root]
  );

const summarise = (label, pairs) => {
  const avatars = pairs.filter((p) => p.avatar);
  const live = pairs.filter((p) => !p.inert && !p.avatar);
  const failing = live.filter((p) => p.ratio < p.need);
  const min = live.reduce((m, p) => (p.ratio < m.ratio ? p : m), { ratio: Infinity });
  check(failing.length === 0, `${label}: ${live.length} text pairs, none under its minimum`, failing.length ? JSON.stringify(failing.slice(0, 4)) : `lowest ${min.ratio}:1 (${min.text} · ${min.fg} on ${min.bg})`);
  if (avatars.length) {
    const lo = avatars.reduce((m, p) => (p.ratio < m.ratio ? p : m));
    console.log(`  · ${avatars.length} avatar initials (decorative, aria-hidden), lowest ${lo.ratio}:1 — ${lo.fg} on ${lo.bg}`);
  }
  return { count: live.length, lowest: min, failing, avatars, inertSkipped: pairs.length - live.length - avatars.length };
};

// ── 1 · contrast, light and dark ───────────────────────────────────────────
for (const theme of ["light", "dark"]) {
  console.log(`\n── 1 · contrast, ${theme}`);
  const r = (report[`contrast-${theme}`] = {});
  const { ctx, page } = await open("mentor", 1512, "/app", { chatScenarioId: "escalation-active" }, { theme: theme === "dark" ? "dark" : null, dpr: 1 });
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  check(isDark === (theme === "dark"), `the page is in ${theme} mode`, `html.dark ${isDark}`);
  r.bar = summarise("the top bar", await textPairs(page, '[data-anno-ref="console-topbar"]'));
  await openPanel(page);
  await expandAll(page);
  r.list = summarise("the panel, list", await textPairs(page, "#support-panel"));
  /* The presence dot: decoration (the name says "online"), measured anyway. */
  r.presence = await page.evaluate((ENGINE) => {
    eval(ENGINE);
    const d = document.querySelector("#support-panel [data-presence-dot]");
    if (!d) return null;
    const { rgba, ratio, bgOf } = window.__c;
    return Math.round(ratio(rgba(getComputedStyle(d).backgroundColor), bgOf(d.parentElement.parentElement)) * 100) / 100;
  }, ENGINE);
  console.log(`  · presence dot vs panel: ${r.presence}:1 (decorative; presence is in the name)`);
  r.listIcons = await iconPairs(page, "#support-panel");
  const li = r.listIcons.filter((i) => i.ratio < 3);
  check(li.length === 0, "list icons on live controls ≥ 3:1", li.length ? JSON.stringify(li) : `lowest ${Math.min(...r.listIcons.map((i) => i.ratio))}:1`);
  await openRow(page, "c-fall-26");
  await page.locator("[data-support-more]").first().click();
  r.thread = summarise("the panel, a thread + composer", await textPairs(page, "#support-panel"));
  /* The failed-send line, which only exists after a failure. */
  await page.locator("[data-support-composer] textarea").fill("contrast probe");
  await page.locator("[data-support-send]").click();
  await ctx.setOffline(true);
  await page.waitForTimeout(1200);
  r.failed = summarise("the panel, a failed send + offline", await textPairs(page, "#support-panel"));
  await ctx.setOffline(false);
  r.threadIcons = await iconPairs(page, "#support-panel");
  const ti = r.threadIcons.filter((i) => i.ratio < 3);
  check(ti.length === 0, "thread icons on live controls ≥ 3:1", ti.length ? JSON.stringify(ti) : `lowest ${Math.min(...r.threadIcons.map((i) => i.ratio))}:1`);
  await page.screenshot({ path: `${OUT}/contrast-${theme}-thread.png` });
  await ctx.close();
}

// ── 2 · keyboard traversal; 3 · focus indicators ───────────────────────────
{
  console.log("\n── 2 · keyboard, 3 · focus rings (mentor at 1512)");
  const { ctx, page } = await open("mentor", 1512, "/app", { chatScenarioId: "escalation-active" });
  const describe = () =>
    page.evaluate((ENGINE) => {
      eval(ENGINE);
      const { rgba, ratio, bgOf } = window.__c;
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      /* The composer's field rings its CARD (it is borderless inside it). */
      const ringed = e.tagName === "TEXTAREA" ? (e.closest("[data-support-composer]") ?? e) : e;
      const s = getComputedStyle(ringed);
      const ring = rgba(s.outlineColor);
      const where = e.closest("#support-panel") ? "panel" : e.closest('[data-anno-ref="console-topbar"]') ? "bar" : "page";
      return {
        /* The name a reader hears: aria-label, else the text outside
           aria-hidden subtrees (the avatar initial is one). */
        name: (e.getAttribute("aria-label") || (() => { const c = e.cloneNode(true); c.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove()); return c.textContent; })() || e.tagName).replace(/\s+/g, " ").trim().slice(0, 40),
        where,
        disabled: e.getAttribute("aria-disabled") === "true" || e.disabled === true,
        ring: { style: s.outlineStyle, width: parseFloat(s.outlineWidth), ratio: Math.round(ratio(ring, bgOf(ringed.parentElement)) * 100) / 100 },
      };
    }, ENGINE);

  /* The bar, from the top of the document. */
  await page.locator('[data-anno-ref="console-topbar"]').evaluate((el) => {
    const f = document.createElement("button");
    f.id = "__start";
    el.prepend(f);
    f.focus();
  });
  const barStops = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const d = await describe();
    if (!d || d.where !== "bar") break;
    barStops.push(d);
    if (/^Support/.test(d.name)) break;
  }
  await page.evaluate(() => document.getElementById("__start")?.remove());
  check(barStops.length > 0 && /^Support/.test(barStops.at(-1).name), "Tab walks the bar to the Support CTA", barStops.map((s) => s.name).join(" → "));
  check(barStops.every((s) => !s.disabled), "no disabled bar control takes focus");

  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  const opened = await page.evaluate(() => document.activeElement?.id);
  check(opened === "support-panel-title", "Enter on the CTA opens the panel, focus on its heading", opened);

  const panelStops = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const d = await describe();
    if (!d || d.where !== "panel") break;
    panelStops.push(d);
  }
  const kinds = panelStops.map((s) => s.name);
  check(panelStops.every((s) => !s.disabled), "no disabled panel control takes focus (search, compose skipped)", kinds.slice(0, 6).join(" → "));
  check(kinds[0] === "Close support" && kinds.some((k) => /^Supervisors/.test(k)) && kinds.some((k) => /^Brandy Forrestor/.test(k)), "panel order: close → section headers → rows", `${panelStops.length} stops`);
  const weakRings = panelStops.filter((s) => s.ring.style === "none" || s.ring.width < 2 || s.ring.ratio < 3);
  check(weakRings.length === 0, "every panel stop shows a ≥2px ring at ≥3:1", weakRings.length ? JSON.stringify(weakRings.slice(0, 3)) : `lowest ${Math.min(...panelStops.map((s) => s.ring.ratio))}:1`);
  report.keyboard = { bar: barStops.map((s) => s.name), listPanel: kinds };

  /* Into a thread, by keyboard. */
  await page.locator('[data-support-row="s-brandy"] [data-support-row-open]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  check((await page.evaluate(() => document.activeElement?.id)) === "support-thread-title", "Enter on a row opens its thread, focus on the name");
  const threadStops = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const d = await describe();
    if (!d || d.where !== "panel") break;
    threadStops.push(d);
  }
  const tk = threadStops.map((s) => s.name);
  /* Focus lands on the NAME, which follows Back in the DOM: Tab runs on to
     close and the composer, Shift+Tab reaches Back. */
  check(tk[0] === "Close support" && /^Message Brandy/.test(tk[1] ?? ""), "from the name, Tab: close → composer (overflow and the inert tools skipped)", tk.join(" → "));
  await page.locator("#support-thread-title").focus();
  await page.keyboard.press("Shift+Tab");
  const prev = await describe();
  check(prev?.name === "Back to Support", "Shift+Tab from the name reaches Back", prev?.name);
  check(threadStops.every((s) => !s.disabled), "the empty composer's send is skipped while disabled");
  const weakT = threadStops.filter((s) => s.ring.style === "none" || s.ring.width < 2 || s.ring.ratio < 3);
  check(weakT.length === 0, "and every thread stop shows a ≥2px ring at ≥3:1", weakT.length ? JSON.stringify(weakT) : `lowest ${Math.min(...threadStops.map((s) => s.ring.ratio))}:1`);
  report.keyboard.thread = tk;

  await page.locator("[data-support-composer] textarea").focus();
  await page.keyboard.type("hello");
  await page.keyboard.press("Tab");
  const send = await describe();
  check(send?.name === "Send" && !send.disabled, "with text, Send joins the order", send?.name);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ open: document.querySelector("[data-support-slot]").dataset.open, cta: document.activeElement?.hasAttribute("data-support-cta") }));
  check(back.open === "false" && back.cta, "Esc closes the panel, focus returns to the CTA", JSON.stringify(back));
  await ctx.close();
}

// ── 4 · targets ────────────────────────────────────────────────────────────
{
  console.log("\n── 4 · targets (mentor at 1512)");
  const { ctx, page } = await open("mentor", 1512, "/app", { chatScenarioId: "escalation-active" });
  const sizes = (root) =>
    page.evaluate((root) =>
      [...document.querySelectorAll(`${root} button, ${root} a, ${root} textarea`)]
        .filter((e) => e.getBoundingClientRect().width > 1)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { name: (e.getAttribute("aria-label") || e.textContent || e.tagName).replace(/\s+/g, " ").trim().slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), inline: e.hasAttribute("data-support-more") || e.hasAttribute("data-support-retry-send") };
        }), root);
  const bar = await sizes('[data-anno-ref="console-topbar"]');
  /* Back and forward are 24px glyph buttons whose `::after` bleeds 8px a
     side: the hit area is the pseudo-element, 40×40. */
  const hit = await page.evaluate(() =>
    [...document.querySelectorAll('[data-anno-ref="console-topbar"] [data-history]')].map((e) => {
      const r = e.getBoundingClientRect();
      const a = getComputedStyle(e, "::after");
      const inset = -parseFloat(a.top);
      return Math.round(r.width + 2 * inset) + "×" + Math.round(r.height + 2 * inset);
    })
  );
  const barIcons = bar.filter((t) => t.w < 100 && !/^Go (back|forward)/.test(t.name));
  check(hit.every((h) => h === "40×40") && barIcons.every((t) => t.w === 40 && t.h === 40), "bar targets are 40×40 (history through its ::after)", `${hit.join(", ")} · ${barIcons.map((t) => `${t.name} ${t.w}×${t.h}`).join(", ")}`);
  await openPanel(page);
  await expandAll(page);
  const list = await sizes("#support-panel");
  const small = list.filter((t) => t.w < 24 || t.h < 24);
  check(small.length === 0, "every panel target ≥ 24×24 (2.5.8)", small.length ? JSON.stringify(small) : `${list.length} targets, smallest ${Math.min(...list.map((t) => t.h))}px tall`);
  const header = list.filter((t) => /^(Search support|New message|Close support)/.test(t.name));
  check(header.length === 3 && header.every((t) => t.w === 40 && t.h === 40), "the list header's three are 40×40", JSON.stringify(header));
  await openRow(page, "c-fall-26");
  const thread = await sizes("#support-panel");
  const tools = thread.filter((t) => /(coming soon\)|^Send$|^Back to Support|^Close support|^More options)/.test(t.name));
  check(tools.length === 10 && tools.every((t) => t.w === 40 && t.h === 40), "thread header and composer toolbar: ten 40×40 targets", tools.map((t) => `${t.name} ${t.w}×${t.h}`).join(" · "));
  const inline = thread.filter((t) => t.inline);
  check(inline.every((t) => t.h >= 24), "the inline Show more / Retry links are ≥ 24 tall", JSON.stringify(inline));
  await ctx.close();
}

// ── 5 · announcements, structurally ────────────────────────────────────────
{
  console.log("\n── 5 · announcements (accessibility tree, not a screen reader session)");
  const { ctx, page } = await open("mentor", 1512, "/app");
  await openPanel(page);
  const s = await page.evaluate(() => {
    const a = document.querySelector("#support-panel");
    const t = document.querySelectorAll("[data-support-section-toggle]");
    return {
      region: a.tagName === "ASIDE" && a.getAttribute("aria-label") === "Support",
      focusHeading: document.activeElement?.tagName === "H2" && document.activeElement.textContent.trim() === "Support",
      ctaExpanded: document.querySelector('[data-anno-ref="console-topbar"] [data-support-cta]').getAttribute("aria-expanded"),
      toggles: [...t].every((b) => b.tagName === "BUTTON" && b.hasAttribute("aria-expanded") && document.getElementById(b.getAttribute("aria-controls"))),
    };
  });
  check(s.region, "the panel is a complementary landmark named Support");
  check(s.focusHeading, "on open, focus lands on its heading — what a reader hears first");
  check(s.ctaExpanded === "true", "the CTA reports itself expanded");
  check(s.toggles, "each section header is a button exposing expanded state over a real region");
  const snap = await page.locator("#support-panel").ariaSnapshot();
  check(/button "Supervisors" \[expanded\]/.test(snap) && /button "Cohorts.*unread"/.test(snap), "the tree reads expanded headers, and a closed one's unread", snap.split("\n").filter((l) => /Supervisors|Cohorts/.test(l)).join(" | "));
  /* THE NAMES A READER HEARS, from the tree itself: no stray space before a
     comma, and a time a person can say rather than "1d". */
  const names = snap.split("\n").filter((l) => /button "/.test(l)).map((l) => /button "([^"]+)"/.exec(l)[1]);
  const rowNames = names.filter((n) => /^(Brandy|Stephen)/.test(n));
  check(names.every((n) => !/ ,/.test(n)), "no accessible name has a stray space before a comma", names.filter((n) => / ,/.test(n)).join(" | ") || `${names.length} names`);
  check(rowNames.length === 2 && rowNames.every((n) => /\b20\d\d\b/.test(n) && !/\b\d+d\b/.test(n) && !/\.\./.test(n)), "rows say an absolute time, not a day count, with no doubled stops", rowNames.join(" | "));
  await page.locator('[data-support-row="s-brandy"] [data-support-row-open]').click();
  await page.waitForTimeout(400);
  const log = await page.evaluate(() => {
    const l = document.querySelector("[data-support-log]");
    return { role: l?.getAttribute("role"), live: l?.getAttribute("aria-live"), name: l?.getAttribute("aria-label"), speaker: !!l?.querySelector(".sr-only") };
  });
  check(log.role === "log" && log.live === "polite" && /^Messages with/.test(log.name), "messages are a named polite log, so an arrival is announced", JSON.stringify(log));
  check(log.speaker, "and each message names its speaker for a reader");
  report.ariaSnapshot = snap;
  await ctx.close();
}

// ── 6 · reduced motion ─────────────────────────────────────────────────────
{
  console.log("\n── 6 · reduced motion");
  const { ctx, page } = await open("mentor", 1512, "/app", { devLoadState: "loading" }, { reducedMotion: "reduce" });
  await openPanel(page);
  const m = await page.evaluate(() => {
    const moving = [];
    for (const e of document.querySelectorAll("[data-support-slot], [data-support-slot] *")) {
      const s = getComputedStyle(e);
      const t = s.transitionDuration.split(",").some((d) => parseFloat(d) > 0) && s.transitionProperty !== "none";
      const a = s.animationName !== "none" && s.animationDuration.split(",").some((d) => parseFloat(d) > 0);
      if (t || a) moving.push(`${e.tagName.toLowerCase()}.${(e.className?.baseVal ?? e.className ?? "").split(" ").slice(0, 2).join(".")} ${t ? "transition " + s.transitionProperty : ""}${a ? "animation " + s.animationName : ""}`);
    }
    return moving;
  });
  /* Colour-only hover transitions are not motion (2.3.3 is about movement). */
  const motion = m.filter((x) => !/transition (color|background-color|color, background-color|colors)/.test(x) && !/transition color,/.test(x));
  check(motion.length === 0, "nothing in the panel moves: no slide, no rotate, no pulse", motion.length ? JSON.stringify(motion.slice(0, 6)) : `${m.length} colour-only hover transitions remain`);
  report.reducedMotion = { all: m, motion };
  await ctx.close();
}

// ── 7 · every SUP-3 and SUP-4 state at five widths ─────────────────────────
const STATES = [
  ["list", "mentor", {}, async () => {}],
  ["list-all-open", "mentor", {}, async (p) => expandAll(p)],
  ["empty-section", "supervisor", {}, async () => {}],
  ["first-run", "admin", {}, async () => {}],
  ["loading", "mentor", { devLoadState: "loading" }, async () => {}],
  ["error", "mentor", { devLoadState: "error" }, async () => {}],
  ["partial", "mentor", { devLoadState: "partial" }, async (p) => expandAll(p)],
  ["offline-list", "mentor", {}, async (p, ctx) => { await ctx.setOffline(true); await p.waitForTimeout(300); }],
  ["thread", "mentor", { chatScenarioId: "escalation-active" }, async (p) => openRow(p, "s-brandy")],
  ["thread-long-expanded", "mentor", {}, async (p) => { await p.locator('[data-support-section="cohorts"] [data-support-section-toggle]').click(); await openRow(p, "c-fall-26"); await p.locator("[data-support-more]").first().click(); }],
  ["thread-sending", "mentor", {}, async (p) => { await openRow(p, "s-brandy"); await p.locator("[data-support-composer] textarea").fill("On my way"); await p.keyboard.press("Enter"); await p.waitForTimeout(150); }],
  ["thread-failed-offline", "mentor", {}, async (p, ctx) => { await openRow(p, "s-brandy"); await p.locator("[data-support-composer] textarea").fill("This one fails"); await p.keyboard.press("Enter"); await ctx.setOffline(true); await p.waitForTimeout(1200); }],
  ["thread-empty", "lead-mentor", {}, async (p) => openRow(p, "s-stephen")],
];
console.log(`\n── 7 · ${STATES.length} states × 5 widths`);
let shots = 0;
for (const [name, persona, extra, setup] of STATES) {
  for (const width of [1512, 1280, 1024, 768, 390]) {
    const { ctx, page } = await open(persona, width, persona === "mentor" ? "/app" : "/app/today", extra, { dpr: width < 600 ? 2 : 1 });
    await openPanel(page);
    await setup(page, ctx);
    const g = await page.evaluate(() => ({
      panel: Math.round(document.querySelector("#support-panel").getBoundingClientRect().width),
      over: document.documentElement.scrollWidth - innerWidth,
      bodyOver: (() => { const e = document.querySelector("[data-support-body], [data-support-log]"); return e ? e.scrollWidth - e.clientWidth : 0; })(),
    }));
    if (g.over > 0 || g.bodyOver > 0) check(false, `${name} at ${width}: nothing scrolls sideways`, JSON.stringify(g));
    await page.screenshot({ path: `${OUT}/states/${name}-${width}.png` });
    shots++;
    await ctx.close();
  }
}
check(shots === STATES.length * 5, `${shots} state screenshots, none scrolling sideways`, `${OUT}/states/`);

await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
