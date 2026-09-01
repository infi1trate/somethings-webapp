// PHASE 1 — the chat shell, measured.
//
// The phase's acceptance criteria are mostly ANTI-PATTERN criteria: the workspace
// switch is visible rather than a dropdown, the rail's tabs carry words rather
// than bare glyphs, every control has an accessible name, and media reserves its
// space before the bytes arrive. Those are all checkable, and checking them is the
// only way "we fixed the icon-only nav" stops being a claim.
import { chromium } from "playwright";
import { STORE_VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();

async function chat(scenario, width, height, path = "/app/chat") {
  const ctx = await b.newContext({ viewport: { width, height } });
  /* ═══ GUARDED, BECAUSE `addInitScript` RUNS ON EVERY LOAD ═══
     Including a reload. An unguarded `setItem` therefore WIPES the store on the
     way back in, which made a persistence check report zero and look like the app
     had failed to save — the write was fine, the probe overwrote it. Same guarded
     form `care-brief.mjs` already uses, and this is the reason it does. */
  await ctx.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
    },
    [KEY, { state: { persona: "mentor", chatScenarioId: scenario }, version: STORE_VERSION }]
  );
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  p.__errors = errors;
  return p;
}

// ═══ 1 · The route exists and honours the deep link ═══════════════════════
console.log("\n── the route and the deep link @ 1440x900");
{
  const p = await chat("active-mentorship", 1440, 900);
  check(p.__errors.length === 0, "no console or page errors", p.__errors.slice(0, 2).join(" | "));

  const shell = await p.evaluate(`(() => {
    const t = document.body.innerText;
    return {
      placeholder: t.includes("isn") && t.includes("part of this prototype"),
      hasThread: !!document.querySelector('[role="list"][aria-label*="Conversation with"]'),
      navActive: !!document.querySelector('[aria-current="page"]'),
    };
  })()`);
  check(!shell.placeholder, "the /app/[section] placeholder no longer serves this URL");
  check(shell.hasThread, "a real thread rendered");

  await p.context().close();

  /* THE CONTRACT `chatHrefFor` ALREADY PRODUCED. Every record table's Chat action
     points at this shape, so a mismatch here breaks call sites nobody edited. */
  const q = await chat("active-mentorship", 1440, 900, "/app/chat?with=t15");
  const deep = await q.evaluate(`
    document.querySelector('[data-slot="chat-thread-name"]')?.textContent ?? ""`);
  check(deep === "Riley Moss", "?with=t15 opens Riley's thread, not the scenario's focus", deep);
  await q.context().close();
}

// ═══ 2 · The workspace switch is a visible control ════════════════════════
console.log("\n── the workspace switch @ 1440x900");
{
  const p = await chat("escalation-active", 1440, 900);
  const ws = await p.evaluate(`(() => {
    const list = document.querySelector('[role="tablist"][aria-label="Conversations"]');
    if (!list) return null;
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    return {
      count: tabs.length,
      labels: tabs.map((t) => t.textContent.trim()),
      selected: tabs.filter((t) => t.getAttribute("aria-selected") === "true").length,
      /* VISIBLE, not merely present. A dropdown's options are in the DOM too — the
         distinction this phase is making is whether both destinations are on
         screen without a press. */
      allVisible: tabs.every((t) => t.getBoundingClientRect().width > 40),
      noCombobox: !list.querySelector("select,[role=combobox]"),
    };
  })()`);
  check(!!ws, "the switch rendered");
  check(ws.count === 2, "two segments", String(ws.count));
  check(ws.allVisible, "both are visible without opening anything");
  check(ws.noCombobox, "and it is not a dropdown");
  check(ws.selected === 1, "exactly one is selected");
  check(
    ws.labels.some((l) => l.startsWith("Teens")) && ws.labels.some((l) => l.startsWith("Support")),
    "both destinations are named",
    ws.labels.join(" | ")
  );
  /* THE COUNT BELONGS TO THE SIDE YOU ARE NOT ON. Support carries an unread in
     this scenario, Teens is active — so exactly one segment shows a number. */
  const withCount = ws.labels.filter((l) => /· [0-9]+$/.test(l));
  check(withCount.length === 1, "only the inactive workspace shows its count", ws.labels.join(" | "));

  // And it switches.
  await p.locator('[role="tab"]', { hasText: "Support" }).first().click();
  await p.waitForTimeout(400);
  const rows = await p.evaluate(`
    [...document.querySelectorAll('[role="tabpanel"] button[aria-label]')].map((b) => b.getAttribute("aria-label").split(",")[0])`);
  check(
    rows.length === 2 && rows.every((r) => /Brandy|Stephen/.test(r)),
    "switching shows the support threads",
    rows.join(" | ")
  );
  await p.context().close();
}

// ═══ 3 · The rail's tabs carry words ══════════════════════════════════════
console.log("\n── the rail @ 1440x900");
{
  const p = await chat("active-mentorship", 1440, 900);
  const rail = await p.evaluate(`(() => {
    const list = document.querySelector('[role="tablist"][aria-label="Conversation tools"]');
    if (!list) return null;
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    return {
      labels: tabs.map((t) => t.textContent.trim()),
      /* THE DEFECT THIS REPLACES: four unlabelled glyphs. So the check is that
         every tab has VISIBLE TEXT, not just an accessible name — an aria-label on
         an icon fixes the screen reader and leaves the sighted reader guessing. */
      allTextual: tabs.every((t) => t.textContent.trim().length >= 4),
      noneTruncated: tabs.every((t) => t.scrollWidth <= t.clientWidth + 1),
      selected: tabs.filter((t) => t.getAttribute("aria-selected") === "true").length,
      controlsResolve: tabs
        .filter((t) => t.getAttribute("aria-selected") === "true")
        .every((t) => !!document.getElementById(t.getAttribute("aria-controls"))),
      roving: tabs.filter((t) => t.getAttribute("tabindex") === "0").length,
    };
  })()`);
  check(!!rail, "the rail rendered");
  check(rail.labels.length === 4, "four panels", rail.labels.join(" | "));
  check(rail.allTextual, "every tab carries a word, not a bare glyph", rail.labels.join(" | "));
  check(rail.noneTruncated, "and none of the four truncates at 320px");
  check(rail.selected === 1 && rail.controlsResolve, "the selected tab points at a real panel");
  check(rail.roving === 1, "roving tabindex — one tab stop for the whole set");

  // Arrow keys move it, which is the tablist contract.
  await p.locator('[role="tablist"][aria-label="Conversation tools"] [role="tab"][tabindex="0"]').focus();
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(250);
  const moved = await p.evaluate(`
    document.querySelector('[role="tablist"][aria-label="Conversation tools"] [role="tab"][aria-selected="true"]')?.textContent.trim()`);
  check(moved === "Profile", "ArrowRight moves to the next panel", String(moved));

  // A SUPPORT thread gets two panels, not four — no profile, no activities.
  await p.locator('[role="tab"]', { hasText: "Support" }).first().click();
  await p.waitForTimeout(300);
  await p.locator('[role="tabpanel"] button[aria-label]').first().click();
  await p.waitForTimeout(400);
  const supportTabs = await p.evaluate(`
    [...document.querySelectorAll('[role="tablist"][aria-label="Conversation tools"] [role="tab"]')].map((t) => t.textContent.trim())`);
  check(
    supportTabs.length === 2 && supportTabs.join() === "Assist,Timeline",
    "a support thread offers only the panels that apply",
    supportTabs.join(" | ")
  );
  await p.context().close();
}

// ═══ 4 · Every control is named ═══════════════════════════════════════════
console.log("\n── named controls @ 1440x900");
{
  const p = await chat("active-mentorship", 1440, 900);
  const unnamed = await p.evaluate(`(() => {
    const out = [];
    for (const el of document.querySelectorAll("main button, main a[href]")) {
      const text = (el.textContent || "").trim();
      const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
      const sr = el.querySelector(".sr-only")?.textContent?.trim() || "";
      if (!text && !label && !sr) {
        out.push(el.className.slice(0, 60) || el.tagName);
      }
    }
    return out;
  })()`);
  check(
    unnamed.length === 0,
    "no control on the surface is unnamed",
    unnamed.slice(0, 3).join(" | ")
  );

  const composer = await p.evaluate(`(() => {
    const send = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Send");
    const ta = document.querySelector("textarea");
    return {
      sendIsWord: !!send,
      sendDisabled: send?.disabled ?? null,
      placeholder: ta?.getAttribute("placeholder") ?? null,
      /* SCOPED TO THE COMPOSER. The first draft queried every button[title] on the
         page and swept in the kebab, the rail toggle and the dev bar's own Hide
         button — it passed, but it was not measuring what it claimed to. */
      attach: [...(ta?.closest('[data-slot="composer"]')?.querySelectorAll("button[title]") ?? [])].map(
        (b) => b.getAttribute("title")
      ),
    };
  })()`);
  check(composer.sendIsWord, "the primary action reads Send, not a paper plane");
  check(composer.sendDisabled === true, "and it is disabled until there is something to send");
  check(
    /Message .+/.test(composer.placeholder ?? ""),
    "the field names the person",
    String(composer.placeholder)
  );
  check(
    composer.attach.length >= 4,
    "every attachment control has a visible tooltip",
    composer.attach.join(" | ")
  );

  // Typing enables Send.
  await p.locator("textarea").fill("hello");
  await p.waitForTimeout(200);
  const enabled = await p.evaluate(`
    ![...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Send")?.disabled`);
  check(enabled, "typing enables it");
  await p.context().close();
}

// ═══ 5 · Media reserves its space before the bytes ════════════════════════
console.log("\n── media frames @ 1440x900");
{
  const p = await chat("active-mentorship", 1440, 900);
  const media = await p.evaluate(`(() => {
    const frames = [...document.querySelectorAll('[data-slot="media-frame"]')];
    return frames.map((f) => {
      const r = f.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        ratio: +(r.width / r.height).toFixed(3),
        declared: +(Number(f.dataset.w) / Number(f.dataset.h)).toFixed(3),
        hasAlt: (f.textContent || "").trim().length > 0 || !!f.querySelector("img[alt]"),
        /* A SPINNER IS THE DEFECT. An animated placeholder claims something is on
           its way; nothing is, and the frame already knows its final size. */
        animated: !!f.querySelector('[class*="animate-"]'),
      };
    });
  })()`);
  check(media.length > 0, "a media message rendered", `${media.length} frames`);
  check(
    media.every((m) => m.w > 0 && m.h > 0),
    "every frame has real dimensions before any image loads",
    JSON.stringify(media.map((m) => `${m.w}x${m.h}`))
  );
  check(
    media.every((m) => Math.abs(m.ratio - m.declared) < 0.02),
    "and its box matches the aspect ratio on the record",
    JSON.stringify(media.map((m) => `${m.ratio} vs ${m.declared}`))
  );
  check(media.every((m) => m.hasAlt), "each carries its alt text");
  check(media.every((m) => !m.animated), "none of them animates a fake load");
  await p.context().close();
}

// ═══ 6 · Columns switch rather than shrink ════════════════════════════════
for (const [w, h, expect_] of [
  [1440, 900, { list: true, thread: true, rail: true }],
  [1100, 800, { list: true, thread: true, rail: false }],
  [700, 900, { list: true, thread: false, rail: false }],
]) {
  console.log(`\n── layout @ ${w}x${h}`);
  const p = await chat("active-mentorship", w, h);
  const seen = await p.evaluate(`(() => {
    const vis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const doc = document.scrollingElement;
    return {
      list: vis(document.querySelector('[data-slot="conversation-list"]')),
      thread: vis(document.querySelector('[data-slot="chat-thread"]')),
      rail: vis(document.querySelector('[data-slot="chat-rail"]')),
      listW: Math.round(document.querySelector('[data-slot="conversation-list"]')?.getBoundingClientRect().width ?? 0),
      threadW: Math.round(document.querySelector('[data-slot="chat-thread"]')?.getBoundingClientRect().width ?? 0),
      hScroll: doc.scrollWidth - doc.clientWidth,
    };
  })()`);
  check(seen.list === expect_.list, `list ${expect_.list ? "present" : "absent"}`, `${seen.listW}px`);
  check(seen.thread === expect_.thread, `thread ${expect_.thread ? "present" : "absent"}`, `${seen.threadW}px`);
  check(seen.rail === expect_.rail, `rail ${expect_.rail ? "present" : "absent"}`);
  check(seen.hScroll <= 0, "no horizontal document scroll", `${seen.hScroll}px`);
  /* NEVER SQUEEZED. The whole point of switching rather than shrinking is that no
     column is ever rendered at a width it cannot use. */
  if (seen.thread) {
    check(seen.threadW >= 420, "the thread is never squeezed below a readable width", `${seen.threadW}px`);
  }

  // Below md, selecting a row hands over the screen.
  if (!expect_.thread) {
    await p.locator('[role="tabpanel"] button[aria-label]').first().click();
    await p.waitForTimeout(400);
    const after = await p.evaluate(`(() => {
      const vis = (el) => !!el && el.getBoundingClientRect().width > 0;
      return {
        thread: vis(document.querySelector('[data-slot="chat-thread"]')),
        list: vis(document.querySelector('[data-slot="conversation-list"]')),
        back: !!document.querySelector('[data-slot="chat-back"]'),
      };
    })()`);
    check(after.thread, "selecting a row opens the conversation");
    check(!after.list, "and the list steps aside rather than being squeezed");
    check(after.back, "with a way back");
  }
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
