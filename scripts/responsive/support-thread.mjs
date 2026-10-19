// ═══════════════════════════════════════════════════════════════════════════
// A SUPPORT THREAD (SUP-4), measured
//
//   · a row opens its thread in the same 420 panel; the header swaps to back,
//     avatar + presence, name 16/24, role 12/16 tertiary, an inert overflow
//     40×40 pill, and close; focus to the thread's name
//   · opening reads it: the row's and the CTA's unread clear
//   · messages: 16 padding and gap; outgoing periwinkle 16/16/4/16 white,
//     incoming surface-sunken 16/16/16/4 primary; 14 at 1.4; ≤ 370 wide; the
//     time under a run's last bubble, tertiary; the list is a polite log
//   · composer: radius 20, 1px border-subtle, the 8px Shadow/Small, 16 padding
//     and gap, 16 from the panel's edges; tertiary placeholder; six inert
//     40×40 tools and a send
//   · Enter sends, Shift+Enter breaks; Sending… then the time; the row
//     previews it
//   · a send that fails stays, with Not sent + Retry; offline disables the
//     composer and says why; Retry delivers once back online
//   · a long message clamps, with Show more / Show less
//   · Back restores the list's scroll and focus; a route change keeps the
//     thread and the draft; Esc closes and reopening returns to the thread
//   · an empty thread says so

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = "docs/support-panel/sup-4";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();
const open = async (persona, width, path, extra = {}, opts = {}) => {
  const ctx = await b.newContext({
    viewport: { width, height: opts.height ?? (width < 600 ? 844 : 982) },
    deviceScaleFactor: opts.dpr ?? 1,
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
  await cta(page).click();
  await page.waitForTimeout(450);
  return { ctx, page };
};
const cta = (page) => page.locator("[data-support-cta]").filter({ visible: true }).first();
const row = (page, id) => page.locator(`[data-support-row="${id}"] [data-support-row-open]`);
const section = async (page, id) => {
  const t = page.locator(`[data-support-section="${id}"] [data-support-section-toggle]`);
  if ((await t.getAttribute("aria-expanded")) !== "true") await t.click();
  await page.waitForTimeout(200);
};
const tokenColor = (page, v) =>
  page.evaluate((v) => {
    const s = document.createElement("span");
    s.style.color = `var(${v})`;
    document.body.appendChild(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return c;
  }, v);

// ── 1 · the header, the read, the messages, the composer ──────────────────
{
  console.log("\n── mentor at 1512, Brandy's thread");
  const { ctx, page } = await open("mentor", 1512, "/app", { chatScenarioId: "escalation-active" }, { dpr: 2 });
  const cta0 = await cta(page).getAttribute("aria-label");
  /* RETARGETED BY SUP-5: this read "the CTA says 1 unread" when the badge
     counted supervisor threads only. One store now: it counts every
     conversation the panel does, so what is checked is the read — opening
     Brandy's thread takes exactly one off it. */
  const n0 = Number(/(\d+) unread/.exec(cta0 ?? "")?.[1] ?? 0);
  check(n0 >= 1, "before: the CTA counts Brandy's conversation among its unread", cta0);
  await row(page, "s-brandy").click();
  await page.waitForTimeout(400);

  const h = await page.evaluate(() => {
    const a = document.querySelector("#support-panel");
    const hd = a.querySelector("[data-support-thread] header");
    const r = (e) => e.getBoundingClientRect();
    const btn = (sel) => {
      const e = hd.querySelector(sel);
      return e ? { w: Math.round(r(e).width), h: Math.round(r(e).height), radius: parseFloat(getComputedStyle(e).borderTopLeftRadius), border: getComputedStyle(e).borderTopColor, disabled: e.getAttribute("aria-disabled"), tab: e.getAttribute("tabindex"), label: e.getAttribute("aria-label") } : null;
    };
    const name = hd.querySelector("h2");
    const role = hd.querySelector("[data-support-role]");
    return {
      list: !!a.querySelector("[data-support-list]"),
      panelW: Math.round(r(a).width),
      headerH: Math.round(r(hd).height),
      divider: getComputedStyle(hd).borderBottomWidth,
      back: btn("[data-support-back]"),
      overflow: btn('[aria-label^="More options"]'),
      close: btn("[data-support-close]"),
      avatar: Math.round(r(hd.querySelector("span.relative > span")).width),
      dot: !!hd.querySelector("[data-presence-dot]"),
      name: { t: name.textContent, fs: getComputedStyle(name).fontSize, lh: getComputedStyle(name).lineHeight, ff: getComputedStyle(name).fontFamily, rowFf: getComputedStyle(document.body).fontFamily },
      role: { t: role.textContent, fs: getComputedStyle(role).fontSize, lh: getComputedStyle(role).lineHeight, c: getComputedStyle(role).color },
      focus: document.activeElement?.id,
    };
  });
  const tertiary = await tokenColor(page, "--text-tertiary");
  const subtle = await tokenColor(page, "--border-subtle");
  check(!h.list && h.panelW === 420, "the thread replaces the list in the same 420 panel", `${h.panelW}`);
  check(h.headerH === 64 && h.divider === "1px", "header 64 with its divider", `${h.headerH} · ${h.divider}`);
  check(h.back?.w === 40 && h.back.label === "Back to Support" && h.back.disabled === null, "a live back button, 40×40", JSON.stringify(h.back));
  check(h.avatar === 32 && h.dot, "the contact's 32 avatar, with presence");
  check(h.name.t === "Brandy Forrestor, online" && h.name.fs === "16px" && h.name.lh === "24px" && h.name.ff === h.name.rowFf, "name 16/24 in the body face, presence in its text", JSON.stringify(h.name));
  check(h.role.t === "Lead mentor" && h.role.fs === "12px" && h.role.lh === "16px" && h.role.c === tertiary, "role 12/16 text-tertiary", JSON.stringify(h.role));
  check(h.overflow?.w === 40 && h.overflow.h === 40 && h.overflow.radius >= 20 && h.overflow.border === subtle && h.overflow.disabled === "true" && h.overflow.tab === "-1", "overflow: 40×40 border-subtle pill, inert", JSON.stringify(h.overflow));
  check(!!h.close && h.close.disabled === null, "and the panel's close (standing rule 5)");
  check(h.focus === "support-thread-title", "focus moved to the thread's name", h.focus);
  const cta1 = await cta(page).getAttribute("aria-label");
  const n1 = Number(/(\d+) unread/.exec(cta1 ?? "")?.[1] ?? 0);
  check(n1 === n0 - 1, "opening it read it: the CTA drops by one", `${cta0} → ${cta1}`);

  const m = await page.evaluate(() => {
    const log = document.querySelector("[data-support-log]");
    const css = getComputedStyle(log);
    const items = [...log.children];
    const gaps = items.slice(1).map((li, i) => Math.round(li.getBoundingClientRect().top - items[i].getBoundingClientRect().bottom));
    const bub = (dir) => {
      const e = log.querySelector(`[data-support-message="${dir}"] [data-support-bubble]`);
      const s = getComputedStyle(e);
      return { bg: s.backgroundColor, c: s.color, radius: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].join(" "), fs: s.fontSize, lh: s.lineHeight, max: s.maxWidth };
    };
    /* A time sits ONLY under a run's last bubble: the next message is from
       someone else, or ten or more minutes later. And every run ends in one. */
    const at = (li) => new Date(li.querySelector("time")?.getAttribute("datetime") ?? 0).getTime();
    const runOk = items.every((li, i) => {
      const next = items[i + 1];
      const hasTime = !!li.querySelector("[data-support-time]");
      if (!next) return hasTime;
      if (next.dataset.supportMessage !== li.dataset.supportMessage) return hasTime;
      return true;
    });
    const times = [...log.querySelectorAll("[data-support-time]")];
    return {
      role: log.getAttribute("role"),
      live: log.getAttribute("aria-live"),
      pad: css.padding,
      gaps,
      out: bub("out"),
      inc: bub("in"),
      time: times[0] ? { c: getComputedStyle(times[0]).color, fs: getComputedStyle(times[0]).fontSize, dt: times[0].getAttribute("datetime"), title: times[0].getAttribute("title") } : null,
      timeCount: times.length,
      count: items.length,
      runOk,
      atBottom: Math.abs(log.scrollHeight - log.clientHeight - log.scrollTop) <= 2,
    };
  });
  const primary = await tokenColor(page, "--text-primary");
  const sunken = await page.evaluate(() => { const s = document.createElement("span"); s.style.background = "var(--surface-sunken)"; document.body.appendChild(s); const c = getComputedStyle(s).backgroundColor; s.remove(); return c; });
  check(m.role === "log" && m.live === "polite", "the messages are a polite log");
  check(m.pad === "16px" && m.gaps.every((g) => g >= 16), "16 padding, at least 16 between messages", `${m.pad} · ${m.gaps.join(",")}`);
  check(m.out.bg === "rgb(72, 90, 248)" && m.out.c === "rgb(255, 255, 255)" && m.out.radius === "16px 16px 4px 16px", "outgoing: periwinkle, white, 16/16/4/16", JSON.stringify(m.out));
  check(m.inc.bg === sunken && m.inc.c === primary && m.inc.radius === "16px 16px 16px 4px", "incoming: surface-sunken, text-primary, 16/16/16/4", JSON.stringify(m.inc));
  check(m.out.fs === "14px" && m.out.lh === "19.6px" && m.out.max === "370px", "14px at 1.4, at most 370 wide", `${m.out.fs}/${m.out.lh} · ${m.out.max}`);
  check(m.time?.c === tertiary && m.time.fs === "12px" && m.time.dt && m.time.title, "the time is 12px text-tertiary, with datetime and title", JSON.stringify(m.time));
  check(m.runOk && m.timeCount >= 1 && m.timeCount <= m.count, "every run ends in a time, under its last bubble", `${m.timeCount} times · ${m.count} messages`);
  check(m.atBottom, "the log opens at its newest message");

  const c = await page.evaluate(() => {
    const card = document.querySelector("[data-support-composer]");
    const a = document.querySelector("#support-panel");
    const s = getComputedStyle(card);
    const ta = card.querySelector("textarea");
    const bar = ta.parentElement.lastElementChild;
    const r = (e) => e.getBoundingClientRect();
    const tools = [...bar.querySelectorAll("button")].map((x) => ({ w: Math.round(r(x).width), h: Math.round(r(x).height), label: x.getAttribute("aria-label"), inert: x.getAttribute("aria-disabled") === "true" && x.getAttribute("tabindex") === "-1" }));
    return {
      radius: s.borderTopLeftRadius,
      border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
      shadow: s.boxShadow,
      pad: s.padding,
      bg: s.backgroundColor,
      gap: Math.round(r(bar).top + 8 - r(ta).bottom),
      left: Math.round(r(card).left - r(a).left),
      right: Math.round(r(a).right - r(card).right),
      bottom: Math.round(r(a).bottom - r(card).bottom),
      placeholder: getComputedStyle(ta, "::placeholder").color,
      tools,
    };
  });
  check(c.radius === "20px" && c.border === `1px solid ${subtle}`, "composer: radius 20, 1px border-subtle", `${c.radius} · ${c.border}`);
  check(/rgba\(0, 0, 0, 0\.08\) 0px 0px 8px/.test(c.shadow) && c.bg === "rgb(255, 255, 255)", "white, with the 8px Shadow/Small", c.shadow);
  check(c.pad === "16px" && c.gap === 16, "16 padding, 16 between input and toolbar", `${c.pad} · gap ${c.gap}`);
  check(c.left === 16 && c.right === 16 && c.bottom === 16, "16 from the panel's sides and bottom", `${c.left}/${c.right}/${c.bottom}`);
  check(c.placeholder === tertiary, "placeholder text-tertiary, not #999388", c.placeholder);
  check(c.tools.length === 7 && c.tools.every((t) => t.w === 40 && t.h === 40 && t.label), "seven 40×40 named tools", JSON.stringify(c.tools.map((t) => t.label)));
  check(c.tools.filter((t) => t.inert).length === 6 && c.tools.at(-1).label === "Send", "six inert, send on the right");
  await page.screenshot({ path: `${OUT}/01-thread-1512.png` });

  /* SEND */
  const ta = page.locator("[data-support-composer] textarea");
  await ta.fill("Line one");
  await ta.press("Shift+Enter");
  await ta.type("line two");
  const multi = await ta.inputValue();
  check(multi === "Line one\nline two", "Shift+Enter breaks the line", JSON.stringify(multi));
  await ta.press("Enter");
  await page.waitForTimeout(100);
  const s1 = await page.evaluate(() => {
    const last = [...document.querySelectorAll("[data-support-message]")].at(-1);
    return { dir: last.dataset.supportMessage, status: last.dataset.status, sending: !!last.querySelector("[data-support-sending]"), text: last.querySelector("[data-support-body-text]").textContent, value: document.querySelector("[data-support-composer] textarea").value };
  });
  check(s1.dir === "out" && s1.status === "pending" && s1.sending && s1.value === "", "Enter sends at once: Sending…, the box cleared", JSON.stringify(s1));
  await page.waitForTimeout(1100);
  const s2 = await page.evaluate(() => {
    const last = [...document.querySelectorAll("[data-support-message]")].at(-1);
    return { status: last.dataset.status, time: !!last.querySelector("[data-support-time]") };
  });
  check(s2.status === "sent" && s2.time, "then it is sent, with its time", JSON.stringify(s2));

  /* FAILURE */
  await ta.fill("This one will fail");
  await page.locator("[data-support-send]").click();
  await ctx.setOffline(true);
  await page.waitForTimeout(1200);
  const f = await page.evaluate(() => {
    const last = [...document.querySelectorAll("[data-support-message]")].at(-1);
    const ta = document.querySelector("[data-support-composer] textarea");
    return {
      status: last.dataset.status,
      failed: last.querySelector("[data-support-failed]")?.textContent.replace(/\s+/g, " ").trim(),
      retry: !!last.querySelector("[data-support-retry-send]"),
      disabled: ta.disabled,
      explained: document.querySelector("[data-support-composer-offline]")?.textContent.trim(),
      describedBy: ta.getAttribute("aria-describedby"),
      banner: !!document.querySelector("[data-support-thread] [data-support-offline]"),
      send: document.querySelector("[data-support-send]").disabled,
    };
  });
  check(f.status === "failed" && /Not sent/.test(f.failed) && f.retry, "a failed send stays in the thread, with Retry", JSON.stringify(f.failed));
  check(f.disabled && f.send && !!f.explained && f.describedBy === "support-composer-offline", "offline: the composer is disabled and says why", f.explained);
  check(f.banner, "and the offline banner is at the top of the thread");
  await page.screenshot({ path: `${OUT}/02-failed-offline-1512.png` });
  await ctx.setOffline(false);
  await page.waitForTimeout(300);
  await page.locator("[data-support-retry-send]").last().click();
  await page.waitForTimeout(100);
  const r1 = await page.evaluate(() => [...document.querySelectorAll("[data-support-message]")].at(-1).dataset.status);
  await page.waitForTimeout(1100);
  const r2 = await page.evaluate(() => [...document.querySelectorAll("[data-support-message]")].at(-1).dataset.status);
  check(r1 === "pending" && r2 === "sent", "Retry, back online, delivers it", `${r1} → ${r2}`);

  /* THE ROW PREVIEWS IT */
  await page.locator("[data-support-back]").click();
  await page.waitForTimeout(300);
  const prev = await page.evaluate(() => document.querySelector('[data-support-row="s-brandy"]').textContent);
  check(/You: This one will fail/.test(prev) && !/unread/.test(prev), "back on the list, the row previews what was sent, and is read", prev.slice(0, 70));
  await ctx.close();
}

// ── 2 · a long message ─────────────────────────────────────────────────────
{
  console.log("\n── a long message");
  const { ctx, page } = await open("mentor", 1512, "/app");
  await section(page, "cohorts");
  await row(page, "c-fall-26").click();
  await page.waitForTimeout(400);
  const more = page.locator("[data-support-more]").first();
  const m0 = await page.evaluate(() => {
    const t = document.querySelector("[data-support-more]").closest("li").querySelector("[data-support-body-text]");
    return { h: Math.round(t.getBoundingClientRect().height), sh: t.scrollHeight, label: document.querySelector("[data-support-more]").textContent, exp: document.querySelector("[data-support-more]").getAttribute("aria-expanded"), author: document.querySelector("[data-support-message]")?.textContent.slice(0, 20) };
  });
  check(m0.h < m0.sh && m0.label === "Show more" && m0.exp === "false", "clamped, with Show more", JSON.stringify(m0));
  check(/^Brandy(?!Brandy)/.test(m0.author ?? ""), "a group thread names the author over a run, once", m0.author);
  await page.evaluate(() => document.querySelector("[data-support-log]").scrollTo(0, 0));
  await more.click();
  await page.waitForTimeout(200);
  const m1 = await page.evaluate(() => {
    const t = document.querySelector("[data-support-more]").closest("li").querySelector("[data-support-body-text]");
    return { h: Math.round(t.getBoundingClientRect().height), sh: t.scrollHeight, label: document.querySelector("[data-support-more]").textContent, exp: document.querySelector("[data-support-more]").getAttribute("aria-expanded") };
  });
  check(m1.h >= m1.sh - 1 && m1.label === "Show less" && m1.exp === "true", "Show more opens it in full, and says Show less", JSON.stringify(m1));
  await page.screenshot({ path: `${OUT}/03-long-message-1512.png` });
  await ctx.close();
}

// ── 3 · back keeps the list; routes keep the thread and the draft ─────────
{
  console.log("\n── back, routes, Esc (a short window, so the list scrolls)");
  const { ctx, page } = await open("mentor", 1512, "/app", {}, { height: 560 });
  for (const s of ["cohorts", "groups", "other"]) await section(page, s);
  const scrollable = await page.evaluate(() => { const b = document.querySelector("[data-support-body]"); b.scrollTop = 150; return { top: b.scrollTop, max: b.scrollHeight - b.clientHeight }; });
  check(scrollable.top === 150, "the list is scrolled to 150 first", JSON.stringify(scrollable));
  await row(page, "g-nj").click();
  await page.waitForTimeout(300);
  await page.locator("[data-support-back]").click();
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => ({
    top: document.querySelector("[data-support-body]").scrollTop,
    focus: document.activeElement?.closest("[data-support-row]")?.dataset.supportRow,
    open: [...document.querySelectorAll("[data-support-section-toggle]")].map((t) => t.getAttribute("aria-expanded")).join(),
  }));
  check(back.top === 150, "Back restores the list's scroll", `${back.top}`);
  check(back.focus === "g-nj", "and focus returns to the row", back.focus);
  check(back.open === "true,true,true,true", "and its open sections", back.open);

  await row(page, "s-brandy").click();
  await page.waitForTimeout(300);
  await page.locator("[data-support-composer] textarea").fill("An unsent draft");
  await page.locator('nav a[href="/app/chat"]').first().click();
  await page.waitForURL("**/app/chat");
  await page.waitForTimeout(700);
  const kept = await page.evaluate(() => ({
    thread: document.querySelector("[data-support-thread]")?.dataset.supportThread,
    draft: document.querySelector("[data-support-composer] textarea")?.value,
  }));
  check(kept.thread === "s-brandy" && kept.draft === "An unsent draft", "a route change keeps the thread and the draft", JSON.stringify(kept));

  await page.locator("[data-support-composer] textarea").focus();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => document.querySelector("[data-support-slot]").dataset.open);
  check(closed === "false" && (await page.evaluate(() => document.activeElement?.hasAttribute("data-support-cta"))), "Esc in the thread closes the panel, focus to the CTA");
  await cta(page).click();
  await page.waitForTimeout(500);
  const re = await page.evaluate(() => ({ thread: document.querySelector("[data-support-thread]")?.dataset.supportThread, focus: document.activeElement?.id }));
  check(re.thread === "s-brandy" && re.focus === "support-thread-title", "reopening returns to the thread, focus on its name", JSON.stringify(re));
  await ctx.close();
}

// ── 4 · an empty thread; 390 ───────────────────────────────────────────────
{
  console.log("\n── lead mentor: an empty thread");
  const { ctx, page } = await open("lead-mentor", 1512, "/app/today");
  await row(page, "s-stephen").click();
  await page.waitForTimeout(300);
  const e = await page.evaluate(() => document.querySelector("[data-support-thread-empty]")?.textContent.trim());
  check(e === "No messages yet. Say hello to Stephen.", "it says there is nothing yet, and who to write to", e);
  await ctx.close();
}
for (const width of [1280, 1024, 768, 390]) {
  console.log(`\n── mentor at ${width}`);
  const { ctx, page } = await open("mentor", width, "/app", {}, { dpr: width < 600 ? 3 : 1 });
  await row(page, "s-brandy").click();
  await page.waitForTimeout(400);
  const g = await page.evaluate(() => {
    const a = document.querySelector("#support-panel").getBoundingClientRect();
    const c = document.querySelector("[data-support-composer]").getBoundingClientRect();
    const log = document.querySelector("[data-support-log]");
    return { inside: c.bottom <= a.bottom && c.left >= a.left && c.right <= a.right, logOverflow: log.scrollWidth - log.clientWidth, page: document.documentElement.scrollWidth - innerWidth };
  });
  check(g.inside && g.logOverflow <= 0 && g.page <= 0, "the composer is inside the panel, nothing scrolls sideways", JSON.stringify(g));
  await page.screenshot({ path: `${OUT}/04-thread-${width}.png` });
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
