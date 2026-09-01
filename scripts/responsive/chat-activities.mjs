// PHASE 3 — the activity system, measured.
//
// The claim this phase makes is that five activities are COMPARABLE, which is a
// claim about format rather than about content — so the checks compare the five
// covers to each other rather than checking each against a description.
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

async function toolkit(scenario, width = 1440, height = 980) {
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
  await p.locator('[role="tab"]', { hasText: "Toolkit" }).first().click();
  await p.waitForTimeout(500);
  p.__errors = errors;
  return p;
}

const RAIL = '[data-slot="chat-rail"]';

// ═══ 1 · Five covers, one format ══════════════════════════════════════════
console.log("\n── the shelf @ active-mentorship");
{
  const p = await toolkit("active-mentorship");
  check(p.__errors.length === 0, "no console or page errors", p.__errors.slice(0, 2).join(" | "));

  const covers = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    const cards = [...rail.querySelectorAll('button[class*="rounded-"], div[role="group"][aria-disabled]')]
      .filter((el) => el.querySelector("svg") && el.textContent.includes("·"));
    return cards.map((el) => {
      const lines = el.innerText.split(String.fromCharCode(10)).map((s) => s.trim()).filter(Boolean);
      return {
        name: lines[0],
        purpose: lines[1] ?? "",
        meta: lines[lines.length - 1] ?? "",
        locked: el.getAttribute("aria-disabled") === "true",
        /* THE GLYPH IS A TINTED DISC, not a full-bleed wash — five full-bleed
           colour blocks on one shelf is five things competing. */
        discSize: (() => {
          const d = el.querySelector("span[aria-hidden]");
          const r = d?.getBoundingClientRect();
          return r ? Math.round(r.width) : 0;
        })(),
      };
    });
  })()`);

  check(covers.length === 5, "five covers on the shelf", `${covers.length}`);
  check(
    covers.every((c) => c.name && c.purpose.length > 20),
    "every one names itself and states a purpose",
    covers.map((c) => c.name).join(" | ")
  );
  /* ═══ THE FORMAT CLAIM ═══
     Not "each has a metadata line" — that a line exists proves nothing. Every one
     has to match the SAME SHAPE, which is what "comparable" means and what five
     hand-written prose lines could never do. */
  const shape = /^\d+ [a-z]+s? · ~\d+ min$/;
  check(
    covers.every((c) => shape.test(c.meta)),
    "and every metadata line comes out in one format",
    covers.map((c) => c.meta).join(" | ")
  );
  check(
    new Set(covers.map((c) => c.discSize)).size === 1,
    "the glyph disc is the same size on all five",
    [...new Set(covers.map((c) => c.discSize))].join(",")
  );
  /* NOT REPEATED. A 320px panel showing the same fact twice was a real defect
     here — the builder carried a second copy of the metadata line. */
  const repeats = await p.evaluate(`(() => {
    const t = document.querySelector('[data-slot="chat-rail"]').innerText;
    const m = t.match(/\\d+ [a-z]+s? · ~\\d+ min/g) ?? [];
    const counts = {};
    for (const x of m) counts[x] = (counts[x] ?? 0) + 1;
    return Object.entries(counts).filter(([, n]) => n > 1);
  })()`);
  check(repeats.length === 0, "no metadata line appears twice", JSON.stringify(repeats));
  await p.context().close();
}

// ═══ 2 · Locked is visible, and it says what opens it ═════════════════════
console.log("\n── the lock @ fresh-match");
{
  const p = await toolkit("fresh-match");
  const locked = await p.evaluate(`(() => {
    const el = document.querySelector('[data-slot="chat-rail"] div[role="group"][aria-disabled="true"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      label: el.getAttribute("aria-label"),
      text: el.innerText.replace(/\\s+/g, " "),
      /* VISIBLE, not hidden. Hiding means a mentor never learns it exists. */
      onScreen: r.width > 0 && r.height > 0,
      /* AND NOT A BUTTON. Pressing something that says why it cannot be pressed is
         worse than not being able to press it. */
      isButton: el.tagName === "BUTTON",
      hasPadlock: !!el.querySelector("svg"),
    };
  })()`);
  check(!!locked, "the locked activity is on the shelf");
  check(locked.onScreen, "and it is visible, not hidden");
  check(!locked.isButton, "and it is not pressable");
  check(locked.hasPadlock, "with a padlock");
  check(
    /not available yet/i.test(locked.label ?? ""),
    "announced as unavailable for a reader who cannot see the padlock",
    String(locked.label)
  );
  check(
    locked.text.includes("Opens once"),
    "and it names the condition rather than only saying locked",
    locked.text.slice(0, 90)
  );
  /* THE OTHER DIRECTION. A gate closed in every scenario is a gate nobody has seen
     open; the unit tests assert both are reachable, and this proves the UI honours
     it. */
  const open = await toolkit("active-mentorship");
  const stillLocked = await open.evaluate(
    `!!document.querySelector('[data-slot="chat-rail"] div[role="group"][aria-disabled="true"]')`
  );
  check(!stillLocked, "and a relationship with a finished set has it unlocked");
  await open.context().close();
  await p.context().close();
}

// ═══ 3 · The deck, one card at a time ═════════════════════════════════════
console.log("\n── the deck @ active-mentorship");
{
  const p = await toolkit("active-mentorship");
  await p.locator(`${RAIL} button`, { hasText: "Hot Takes" }).first().click();
  await p.waitForTimeout(400);

  const deck = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    const live = rail.querySelector('[aria-live="polite"]');
    const buttons = [...rail.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean);
    return {
      /* ONE CARD. Not a list of eight with checkboxes — eight simultaneous
         decisions with no default, judged against each other rather than against
         the teen. */
      cardCount: rail.querySelectorAll('[aria-live="polite"]').length,
      card: live?.innerText.trim() ?? null,
      progress: rail.innerText.includes("Card 1 of"),
      kept: rail.innerText.includes("0/3 kept"),
      /* LABELLED, NOT A THUMB PAIR. A cross on a prompt has no agreed meaning —
         it could plausibly mean "remove this from the library". */
      hasSkip: buttons.some((b) => b === "Skip"),
      hasInclude: buttons.some((b) => b === "Include"),
      /* AND NOTHING IS A BARE GLYPH. */
      unlabelled: [...rail.querySelectorAll("button")].filter(
        (b) => !b.innerText.trim() && !b.getAttribute("aria-label")
      ).length,
      mechanic: rail.innerText.includes("You pick the questions"),
    };
  })()`);
  check(deck.cardCount === 1, "exactly one card is shown", String(deck.cardCount));
  check(!!deck.card && deck.card.length > 10, "with a real prompt", String(deck.card).slice(0, 40));
  check(deck.progress && deck.kept, "and progress against both the deck and the set");
  check(deck.hasSkip && deck.hasInclude, "the actions are words");
  check(deck.unlabelled === 0, "and nothing in the panel is an unnamed control");
  check(deck.mechanic, "the detail cover adds the mechanic the shelf omitted");

  /* THE HEIGHT IS FIXED, so the action row does not move under the cursor between
     a one-line prompt and a two-line one. */
  const h1 = await p.evaluate(
    `Math.round(document.querySelector('[data-slot="chat-rail"] [aria-live="polite"]').getBoundingClientRect().height)`
  );
  await p.locator(`${RAIL} button`, { hasText: "Skip" }).first().click();
  await p.waitForTimeout(300);
  const h2 = await p.evaluate(
    `Math.round(document.querySelector('[data-slot="chat-rail"] [aria-live="polite"]').getBoundingClientRect().height)`
  );
  check(h1 === h2, "the card's box does not resize between prompts", `${h1} → ${h2}`);

  // Keep three, and the deck should end rather than asking for more Skips.
  for (let i = 0; i < 3; i++) {
    await p.locator(`${RAIL} button`, { hasText: "Include" }).first().click();
    await p.waitForTimeout(250);
  }
  const review = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    const items = [...rail.querySelectorAll("ol li")];
    const send = [...rail.querySelectorAll("button")].find((b) => b.innerText.trim().startsWith("Send"));
    return {
      reached: rail.innerText.includes("review"),
      count: items.length,
      /* THE BUTTON NAMES WHAT IT WILL SEND, so the last check before something
         reaches a teen is not a button that cannot be wrong. */
      sendLabel: send?.innerText.trim() ?? null,
      /* AND EVERY ITEM IS REMOVABLE HERE, which is what makes this a review rather
         than a confirm dialog. */
      removable: items.every((li) => !!li.querySelector('button[aria-label^="Remove"]')),
      order: items.map((li) => li.innerText.trim().split(String.fromCharCode(10))[0]),
    };
  })()`);
  check(review.reached, "filling the set ends the deck rather than asking for more skips");
  check(review.count === 3, "the review lists exactly what was kept", `${review.count}`);
  check(review.removable, "each one can still be removed");
  check(
    /^Send 3 questions$/.test(review.sendLabel ?? ""),
    "and the primary names what it will send",
    String(review.sendLabel)
  );
  check(
    review.order.join() === "1,2,3",
    "in the order they will arrive",
    review.order.join(",")
  );
  await p.context().close();
}

// ═══ 4 · Sending writes an event and survives a reload ════════════════════
console.log("\n── sending @ active-mentorship");
{
  const p = await toolkit("active-mentorship");
  const before = await p.evaluate(
    `document.querySelectorAll('[role="list"][aria-label^="Conversation with"] > li').length`
  );

  await p.locator(`${RAIL} button`, { hasText: "Hot Takes" }).first().click();
  await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) {
    await p.locator(`${RAIL} button`, { hasText: "Include" }).first().click();
    await p.waitForTimeout(200);
  }
  await p.locator(`${RAIL} button`, { hasText: "Send 3 questions" }).click();
  await p.waitForTimeout(600);

  const after = await p.evaluate(`(() => {
    const lis = [...document.querySelectorAll('[role="list"][aria-label^="Conversation with"] > li')];
    const last = lis[lis.length - 1];
    return {
      count: lis.length,
      lastText: last.innerText.replace(/\\s+/g, " ").trim(),
      backOnShelf: document.querySelector('[data-slot="chat-rail"]').innerText.includes("Each one says"),
    };
  })()`);
  check(after.count > before, "an event lands in the transcript", `${before} → ${after.count}`);
  check(
    /You sent Hot Takes/.test(after.lastText),
    "naming the actor and the activity",
    after.lastText.slice(0, 40)
  );
  check(after.backOnShelf, "and the panel returns to the shelf");

  /* PERSISTED. The event log and the artifact are two of the four things this
     surface keeps, so a reload has to find them. */
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  const reloaded = await p.evaluate(`(() => {
    const lis = [...document.querySelectorAll('[role="list"][aria-label^="Conversation with"] > li')];
    return lis.filter((li) => li.innerText.includes("You sent Hot Takes")).length;
  })()`);
  check(reloaded === 1, "and it survives a reload, exactly once", String(reloaded));
  await p.context().close();
}

// ═══ 5 · A support thread has nothing to send ═════════════════════════════
console.log("\n── support thread @ active-mentorship");
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 980 } });
  /* ═══ GUARDED, BECAUSE `addInitScript` RUNS ON EVERY LOAD ═══
     Including a reload. An unguarded `setItem` therefore WIPES the store on the
     way back in, which made a persistence check report zero and look like the app
     had failed to save — the write was fine, the probe overwrote it. Same guarded
     form `care-brief.mjs` already uses, and this is the reason it does. */
  await ctx.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
    },
    [KEY, { state: { persona: "mentor", chatScenarioId: "active-mentorship" }, version: STORE_VERSION }]
  );
  const p = await ctx.newPage();
  await p.goto(BASE + "/app/chat", { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await p.locator('[role="tab"]', { hasText: "Support" }).first().click();
  await p.waitForTimeout(300);
  await p.locator('[role="tabpanel"] button[aria-label]').first().click();
  await p.waitForTimeout(500);
  const tabs = await p.evaluate(`
    [...document.querySelectorAll('[role="tablist"][aria-label="Conversation tools"] [role="tab"]')].map((t) => t.textContent.trim())`);
  /* THE TOOLKIT TAB IS ABSENT ALTOGETHER for a colleague — the panel set comes
     from `kind`, so there is no tab to open onto an explanation. */
  check(!tabs.includes("Toolkit"), "a colleague's rail has no Toolkit tab", tabs.join(" | "));
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
