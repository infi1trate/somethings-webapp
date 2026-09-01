// PHASE 2 — the thread core, measured.
//
// Clustering, day dividers, event chips and the actions slot. Three of the four are
// rules that only show themselves at specific inputs, which is why the fixtures had
// to be built to contain those inputs (see lib/chat/__tests__/seed.test.ts) and why
// these checks name the exact case rather than counting elements.
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

async function chat(scenario, width = 1440, height = 900) {
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
  await p.goto(BASE + "/app/chat", { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  p.__errors = errors;
  return p;
}

/** The transcript as data: one entry per `<li>`, in render order.
 *
 *  QUERIED AS `li`, NOT AS `list.children`. The first draft read `children` and got
 *  zero bubbles — the component was wrapping each entry in a `display: contents`
 *  div, so every child was the wrapper and none of them carried the classes being
 *  matched. That was a real defect in the component (a `<ul>` may only contain
 *  `<li>`), and it is now a keyed Fragment — but the probe asks for `li` regardless,
 *  because that is the thing it means. */
const TRANSCRIPT = `(() => {
  const list = document.querySelector('[role="list"][aria-label^="Conversation with"]');
  if (!list) return null;
  return [...list.querySelectorAll(":scope > li")].map((li) => ({
    isDivider: !li.querySelector("[aria-label]") && li.className.includes("items-center"),
    isEvent: li.className.includes("justify-center"),
    hasMeta: !!li.querySelector("p time"),
    text: li.textContent.trim().slice(0, 60),
    side: li.className.includes("items-end") ? "mentor" : li.className.includes("items-start") ? "them" : null,
  }));
})()`;

// ═══ 1 · Clustering, and the case that proves the rule fires ══════════════
console.log("\n── clustering @ active-mentorship");
{
  const p = await chat("active-mentorship");
  check(p.__errors.length === 0, "no console or page errors", p.__errors.slice(0, 2).join(" | "));

  const t = await p.evaluate(TRANSCRIPT);
  check(!!t, "the transcript rendered", `${t?.length ?? 0} entries`);

  const bubbles = t.filter((e) => e.side);
  const clustered = bubbles.filter((e) => !e.hasMeta);
  check(clustered.length > 0, "some bubbles drop their name-and-time header", `${clustered.length} of ${bubbles.length}`);
  check(clustered.length < bubbles.length, "and some keep it");

  /* THE SPECIFIC CASE. Caleb sends "did the practice problems…" and then "which is
     what you said to do so" two minutes later. The second must have NO header, and
     it must be tighter to the first than the first is to what precedes it — the
     spacing is what makes the pair read as one utterance rather than two. */
  const pair = await p.evaluate(`(() => {
    const list = document.querySelector('[role="list"][aria-label^="Conversation with"]');
    const kids = [...list.querySelectorAll(":scope > li")];
    const i = kids.findIndex((k) => k.textContent.includes("which is what you said to do"));
    if (i < 1) return null;
    const prev = kids[i - 1].getBoundingClientRect();
    const self = kids[i].getBoundingClientRect();
    return {
      found: true,
      hasMeta: !!kids[i].querySelector("p time"),
      prevHasMeta: !!kids[i - 1].querySelector("p time"),
      gap: Math.round(self.top - prev.bottom),
    };
  })()`);
  check(!!pair, "found the two-message burst");
  check(pair.prevHasMeta && !pair.hasMeta, "the continuation drops its header while the first keeps one");
  check(pair.gap <= 6, "and sits tight to what it continues", `${pair.gap}px`);
  await p.context().close();
}

// ═══ 2 · Day dividers ═════════════════════════════════════════════════════
console.log("\n── day dividers @ re-matched");
{
  const p = await chat("re-matched");
  const days = await p.evaluate(`(() => {
    const list = document.querySelector('[role="list"][aria-label^="Conversation with"]');
    const labels = [...list.querySelectorAll(":scope > li")]
      .filter((k) => k.className.includes("items-center") && !k.querySelector("[aria-label]"))
      .map((k) => k.textContent.trim());
    return labels;
  })()`);
  check(days.length >= 3, "a thread spanning weeks gets dividers", days.join(" | "));
  check(
    days.includes("Today") || days.includes("Yesterday") || days.some((d) => /[A-Z]/.test(d)),
    "and they read as words or dates, not as raw timestamps",
    days.join(" | ")
  );
  /* THE FIRST ENTRY IS ALWAYS A DIVIDER. Otherwise the oldest message in view has
     no date at all, and a reader scrolling back has nothing to place it against. */
  const firstIsDivider = await p.evaluate(`(() => {
    const list = document.querySelector('[role="list"][aria-label^="Conversation with"]');
    return list.querySelector(":scope > li").className.includes("items-center");
  })()`);
  check(firstIsDivider, "the transcript opens on a divider");
  await p.context().close();
}

// ═══ 3 · Event chips ══════════════════════════════════════════════════════
console.log("\n── event chips @ activities-in-flight");
{
  const p = await chat("activities-in-flight");
  const events = await p.evaluate(`(() => {
    const list = document.querySelector('[role="list"][aria-label^="Conversation with"]');
    const rows = [...list.querySelectorAll(":scope > li")].filter((k) => k.className.includes("justify-center"));
    return rows.map((r) => {
      const el = r.firstElementChild;
      const cs = getComputedStyle(el);
      return {
        text: r.textContent.trim(),
        centred: true,
        /* NOT A BUBBLE: no side, and it must not carry the mentor's fill or the
           teen's border, or a reader has to work out whether the teen can see it. */
        tag: el.tagName,
        bg: cs.backgroundColor,
        pressable: el.tagName === "BUTTON",
        hasGlyph: !!el.querySelector("svg"),
      };
    });
  })()`);
  check(events.length === 3, "three events in the transcript", `${events.length}`);
  check(events.every((e) => e.hasGlyph), "each carries a glyph");
  check(
    events.every((e) => /^(You|Elena) (sent|took back|started|added|raised|resolved)/.test(e.text)),
    "each reads as a past-tense sentence naming the actor",
    events.map((e) => e.text.replace(/\s+/g, " ").slice(0, 34)).join(" | ")
  );
  /* THE ACTOR MATTERS. Two of these are the mentor's and one is Elena's — a chip
     that said "Swap started" would make the reader guess. */
  check(
    events.some((e) => e.text.startsWith("You ")) && events.some((e) => e.text.startsWith("Elena ")),
    "and both actors appear",
    events.map((e) => e.text.split(" ")[0]).join(",")
  );
  /* ═══ THIS CHECK INVERTED IN PHASE 4, ON PURPOSE ═══
     While there was no DetailSheet it asserted that NO chip was pressable —
     inert-and-honest rather than pressable-and-empty. Phase 4 built the sheet, so
     the same rule ("a chip is a button only when there is somewhere to go") now
     demands the opposite outcome. Rewritten rather than deleted, so the record of
     what was true when is not lost. `chat-lifecycle.mjs` checks what the press
     actually opens. */
  check(
    events.every((e) => e.pressable),
    "every chip that has contents is pressable",
    events.map((e) => e.pressable).join(",")
  );

  const escalation = await chat("escalation-active");
  const tinted = await escalation.evaluate(`(() => {
    const list = document.querySelector('[role="list"][aria-label^="Conversation with"]');
    const row = [...list.querySelectorAll(":scope > li")].find((k) => k.textContent.includes("raised an escalation"));
    if (!row) return null;
    const cs = getComputedStyle(row.firstElementChild);
    return { bg: cs.backgroundColor, fg: cs.color, text: row.textContent.trim() };
  })()`);
  check(!!tinted, "the escalation event rendered", tinted?.text);
  check(
    tinted.bg !== "rgba(0, 0, 0, 0)" && tinted.bg !== "rgb(246, 244, 239)",
    "and it is the one kind that is tinted",
    tinted.bg
  );
  await escalation.context().close();
  await p.context().close();
}

// ═══ 4 · An event breaks the cluster ══════════════════════════════════════
console.log("\n── an event resets clustering @ escalation-active");
{
  const p = await chat("escalation-active");
  /* Jordan sends two messages four minutes apart, then the mentor replies, then the
     escalation event lands. The message AFTER the event must carry a header even
     though the clustering window alone would have dropped it. */
  const after = await p.evaluate(`(() => {
    const list = document.querySelector('[role="list"][aria-label^="Conversation with"]');
    const kids = [...list.querySelectorAll(":scope > li")];
    const i = kids.findIndex((k) => k.textContent.includes("raised an escalation"));
    if (i < 0 || i + 1 >= kids.length) return null;
    const next = kids[i + 1];
    return {
      text: next.textContent.trim().slice(0, 40),
      hasMeta: !!next.querySelector("p time"),
      isBubble: !!next.className.match(/items-(end|start)/),
    };
  })()`);
  check(!!after, "found an entry after the event");
  if (after) {
    check(
      !after.isBubble || after.hasMeta,
      "the first message after an event is re-attributed",
      `${after.text} · meta=${after.hasMeta}`
    );
  }
  await p.context().close();
}

// ═══ 5 · The actions slot ═════════════════════════════════════════════════
console.log("\n── message actions @ active-mentorship");
{
  const p = await chat("active-mentorship");
  const trigger = p.locator('button[aria-label="React to this message"]').first();
  const n = await p.locator('button[aria-label="React to this message"]').count();
  check(n > 5, "every message carries an actions trigger", `${n}`);

  /* HIDDEN UNTIL HOVERED, on a device that can hover. Not `display:none` — it has
     to stay in the tab order, which is the case a hover-reveal usually breaks. */
  const before = await trigger.evaluate((el) => ({
    opacity: getComputedStyle(el).opacity,
    inTabOrder: el.tabIndex >= 0,
  }));
  check(before.opacity === "0", "hidden until hovered on a pointer device", before.opacity);
  check(before.inTabOrder, "but still reachable by keyboard");

  await p.locator('[role="list"][aria-label^="Conversation with"] > li').nth(2).hover();
  await p.waitForTimeout(250);
  const hovered = await p.evaluate(`(() => {
    const t = [...document.querySelectorAll('button[aria-label="React to this message"]')]
      .map((b) => Number(getComputedStyle(b).opacity));
    return { revealed: t.filter((o) => o > 0.5).length, total: t.length };
  })()`);
  check(hovered.revealed === 1, "hovering reveals exactly one", `${hovered.revealed} of ${hovered.total}`);

  // And it opens a named menu.
  await trigger.click({ force: true });
  await p.waitForTimeout(250);
  const menu = await p.evaluate(`(() => {
    const m = document.querySelector('[role="menu"][aria-label="Reactions"]');
    if (!m) return null;
    /* ═══ THE REACTIONS, NOT EVERY MENU ITEM ═══
       Phase 5 added a tag entry to the same menu, so counting every menuitem
       started reporting 7 against a check that means "six reactions, not an emoji
       keyboard". The claim is about the reaction set; the tag is a different kind of
       act, and chat-documentation.mjs is what counts it. Split by whether the
       item's own glyph is an emoji rather than an SVG. */
    const all = [...m.querySelectorAll('[role="menuitem"]')];
    const items = all.filter((i) => !i.querySelector("svg"));
    const box = m.getBoundingClientRect();
    return {
      count: items.length,
      /* EVERY ONE NAMED. An emoji has no accessible name that says what pressing it
         means — "grinning face" describes a picture, not an action. */
      allNamed: items.every((i) => (i.getAttribute("aria-label") || "").length > 3),
      labels: items.map((i) => i.getAttribute("aria-label")),
      nonReaction: all.length - items.length,
      /* IT OPENS AWAY FROM THE BUBBLE. On this surface the message underneath may
         be the sentence a mentor is deciding about. */
      aboveTrigger: box.bottom <= document.querySelector('button[aria-label="React to this message"]').getBoundingClientRect().top + 2,
    };
  })()`);
  check(!!menu, "the menu opened");
  check(menu.count === 6, "six reactions, not an emoji keyboard", String(menu.count));
  check(menu.nonReaction === 1, "beside one non-reaction action", String(menu.nonReaction));
  check(menu.allNamed, "each names what it means", menu.labels.slice(0, 3).join(" | "));

  // Pressing one adds it, and pressing again removes it.
  const firstItem = p.locator('[role="menu"][aria-label="Reactions"] [role="menuitem"]').first();
  const beforeCount = await p.evaluate(`document.querySelectorAll('[role="list"] .sr-only').length`);
  await firstItem.click();
  await p.waitForTimeout(300);
  const added = await p.evaluate(`(() => {
    const all = [...document.querySelectorAll('[role="list"] span.sr-only')]
      .map((s) => s.textContent.trim())
      .filter((t) => t.includes("reaction"));
    return all;
  })()`);
  check(added.length > 0, "pressing one adds a reaction", added.join(" | "));
  void beforeCount;

  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
