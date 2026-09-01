// PHASE 5 — documentation, measured.
//
// The load-bearing claim is architectural: notes are homed in Timeline, NOT under
// the AI summary. That is checkable — the Assist panel must contain no note, and the
// Timeline panel must contain every one — and checking it is the only way "we moved
// documentation out of the AI panel" stops being a claim about intent.
import { chromium } from "playwright";
import { STORE_VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const RAIL = '[data-slot="chat-rail"]';
const LIST = '[role="list"][aria-label^="Conversation with"]';

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();

async function chat(scenario, width = 1440, height = 1000) {
  const ctx = await b.newContext({ viewport: { width, height } });
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

/** Tag the nth teen message and fill the composer. */
async function writeNote(p, { nth = 0, title, body = "", reminder = null } = {}) {
  const bubbles = p.locator(`${LIST} > li[id^="msg-"]`);
  await bubbles.nth(nth).hover();
  await p.waitForTimeout(200);
  await bubbles.nth(nth).locator('button[aria-label="React to this message"]').click();
  await p.waitForTimeout(250);
  await p.locator('button[aria-label="Write a note about this message"]').click();
  await p.waitForTimeout(400);
  await p.locator(`${RAIL} input`).fill(title);
  if (body) await p.locator(`${RAIL} textarea`).fill(body);
  if (reminder) await p.locator(`${RAIL} button`, { hasText: reminder }).click();
  await p.waitForTimeout(150);
  await p.locator(`${RAIL} button`, { hasText: "Save note" }).click();
  await p.waitForTimeout(500);
}

// ═══ 1 · Tagging is the primary entry, and it lands you typing ════════════
console.log("\n── tagging @ active-mentorship");
{
  const p = await chat("active-mentorship");
  check(p.__errors.length === 0, "no console or page errors", p.__errors.slice(0, 2).join(" | "));

  const bubbles = p.locator(`${LIST} > li[id^="msg-"]`);
  await bubbles.nth(1).hover();
  await p.waitForTimeout(200);
  await bubbles.nth(1).locator('button[aria-label="React to this message"]').click();
  await p.waitForTimeout(250);

  const menu = await p.evaluate(`(() => {
    const m = document.querySelector('[role="menu"][aria-label="Reactions"]');
    const items = [...m.querySelectorAll('[role="menuitem"]')];
    return {
      count: items.length,
      tag: items.map((i) => i.getAttribute("aria-label")).find((l) => /note/i.test(l ?? "")),
      /* A RULE BETWEEN THE REACTIONS AND THE TAG. Six reactions are one gesture;
         starting a written record is a different kind of act, and a hurried press
         must not land across that line by accident. */
      separated: !!m.querySelector("span[aria-hidden][class*=w-px]"),
    };
  })()`);
  check(menu.count === 7, "the menu holds six reactions and one tag", `${menu.count}`);
  check(
    /note/i.test(menu.tag ?? ""),
    "and the tag names the OUTCOME, not the mechanic",
    String(menu.tag)
  );
  check(menu.separated, "with a rule between the two kinds of action");

  const msgId = await bubbles.nth(1).getAttribute("id");
  await p.locator('button[aria-label="Write a note about this message"]').click();
  await p.waitForTimeout(450);

  const opened = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    const composer = rail.querySelector('[data-slot="note-composer"]');
    const tab = document.querySelector('[role="tablist"][aria-label="Conversation tools"] [role="tab"][aria-selected="true"]');
    return {
      /* THREE THINGS AT ONCE: the rail switched panel, entered composing, and the
         reference arrived. A mentor who tags a message should be typing one press
         later — anything less turns the primary path into the long one. */
      tab: tab?.textContent.trim(),
      composing: !!composer,
      refs: composer ? composer.querySelectorAll("blockquote, [class*=border-l-2]").length : 0,
      /* THE TAKEOVER IS EXPLICIT, not an emptied panel — a header saying what is
         being written and a Cancel saying what leaving does. */
      header: composer?.querySelector("h3")?.textContent?.trim(),
      cancel: !!(composer && [...composer.querySelectorAll("button")].some((x) => x.innerText.trim() === "Cancel")),
      audience: /Visible to your lead/.test(composer?.innerText ?? ""),
      /* NOT A DIALOG. The evidence is the conversation to the left; a modal covers
         it and traps focus, so checking a detail means losing the draft. */
      isDialog: !!document.querySelector('[data-slot="dialog-content"]'),
      threadVisible: document.querySelector('[data-slot="chat-thread"]').getBoundingClientRect().width > 400,
    };
  })()`);
  check(opened.tab === "Timeline", "tagging switches the rail to the panel that owns notes", String(opened.tab));
  check(opened.composing, "and opens the composer");
  check(opened.refs === 1, "with the message already attached", `${opened.refs}`);
  check(!!opened.header && opened.cancel, "the takeover has its own header and its own way out", String(opened.header));
  check(opened.audience, "and it names who will read it");
  check(!opened.isDialog && opened.threadVisible, "not a dialog — the conversation stays on screen");

  /* THE TITLE IS REQUIRED. A note without one is a note nobody finds again in a
     list of forty; the body is optional because sometimes the observation IS the
     title plus the message. */
  const empty = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    const save = [...rail.querySelectorAll("button")].find((x) => x.innerText.trim() === "Save note");
    return { disabled: save?.disabled ?? null };
  })()`);
  check(empty.disabled === true, "Save is disabled with no title");

  await p.locator(`${RAIL} input`).fill("Sleep has come up three times this month");
  await p.waitForTimeout(200);
  const filled = await p.evaluate(`
    ![...document.querySelector('[data-slot="chat-rail"]').querySelectorAll("button")]
      .find((x) => x.innerText.trim() === "Save note")?.disabled`);
  check(filled, "and enabled by a title alone");

  await p.locator(`${RAIL} button`, { hasText: "Save note" }).click();
  await p.waitForTimeout(600);

  const saved = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    const rows = [...rail.querySelectorAll('[data-slot="timeline-note"]')];
    const chips = [...document.querySelectorAll('${LIST} > li[data-slot="event-chip"]')]
      .map((li) => li.innerText.replace(/\\s+/g, " ").trim());
    return {
      backToList: !rail.querySelector('[data-slot="note-composer"]'),
      rows: rows.length,
      title: rows[0]?.innerText.split(String.fromCharCode(10))[0]?.trim(),
      provenance: /1 message/.test(rows[0]?.innerText ?? ""),
      threadChip: chips.some((c) => /You added a note/.test(c)),
    };
  })()`);
  check(saved.backToList, "saving returns to the timeline");
  check(saved.rows === 1, "the note is in it", `${saved.rows}`);
  check(
    saved.title === "Sleep has come up three times this month",
    "under its own title",
    String(saved.title)
  );
  check(saved.provenance, "reporting how many messages it points at");
  /* THE NOTE IS THE RECORD; THE EVENT IS THE HISTORY. Both, same as sending an
     activity — so the thread shows that documentation happened without showing
     what it said. */
  check(saved.threadChip, "and the thread shows that a note was written");
  void msgId;
  await p.context().close();
}

// ═══ 2 · Notes are NOT under the AI summary ═══════════════════════════════
console.log("\n── where notes live @ active-mentorship");
{
  const p = await chat("active-mentorship");
  await writeNote(p, { nth: 1, title: "Chemistry retake went better" });

  const panels = {};
  for (const name of ["Assist", "Profile", "Toolkit", "Timeline"]) {
    await p.locator('[role="tab"]', { hasText: name }).first().click();
    await p.waitForTimeout(350);
    panels[name] = await p.evaluate(`(() => {
      const rail = document.querySelector('[data-slot="chat-rail"]');
      return {
        notes: rail.querySelectorAll('[data-slot="timeline-note"]').length,
        newNote: !!rail.querySelector('[data-slot="new-note"]'),
        mentionsNote: /Chemistry retake/.test(rail.innerText),
      };
    })()`);
  }

  /* ═══ THE ARCHITECTURAL CHECK ═══
     The surface this replaces put Documentation inside the Assist panel, below an
     AI summary — which made a mentor's own written observations look like
     supporting material for a machine's paragraph, and put the most durable record
     here inside a panel whose other contents are a dismissible suggestion. */
  check(panels.Assist.notes === 0, "the Assist panel contains no note");
  check(!panels.Assist.mentionsNote, "and does not mention one");
  check(!panels.Assist.newNote, "and offers no way to write one");
  check(panels.Timeline.notes === 1, "the Timeline panel holds it", `${panels.Timeline.notes}`);
  check(panels.Timeline.newNote, "and offers the second entry point");
  check(panels.Toolkit.notes === 0 && panels.Profile.notes === 0, "nowhere else does");
  await p.context().close();
}

// ═══ 3 · Reading a note back, and following it home ═══════════════════════
console.log("\n── provenance @ active-mentorship");
{
  const p = await chat("active-mentorship");
  await writeNote(p, {
    nth: 2,
    title: "Told his mum about the schedule",
    body: "Went better than he expected.",
    reminder: "In a week",
  });

  await p.locator(`${RAIL} [data-slot="timeline-note"]`).first().click();
  await p.waitForTimeout(400);

  const detail = await p.evaluate(`(() => {
    const d = document.querySelector('[data-slot="note-detail"]');
    if (!d) return null;
    return {
      title: d.querySelector("h3")?.textContent?.trim(),
      body: /Went better than he expected/.test(d.innerText),
      written: /Written /.test(d.innerText),
      reminder: /Come back to this on/.test(d.innerText),
      refs: d.querySelectorAll('button[aria-label^="Go to"]').length,
      /* READ-ONLY. A note is a record of what somebody observed at a time; editing
         it would let the observation be rewritten after a lead had read it. The
         missing amendment path is logged as gap row 356. */
      editable: d.querySelectorAll("input, textarea").length,
      deletable: [...d.querySelectorAll("button")].some((x) => /delete|remove/i.test(x.innerText + (x.getAttribute("aria-label") ?? ""))),
      back: [...d.querySelectorAll("button")].some((x) => x.innerText.trim() === "Timeline"),
    };
  })()`);
  check(!!detail, "the note opened");
  check(detail.title === "Told his mum about the schedule", "with its title", String(detail.title));
  check(detail.body, "its body");
  check(detail.written, "when it was written");
  check(detail.reminder, "and the reminder that was set");
  check(detail.refs === 1, "the reference is traversable", `${detail.refs}`);
  check(detail.editable === 0, "nothing about it is editable");
  check(!detail.deletable, "and there is no delete");
  check(detail.back, "with a way back to Timeline");

  /* FOLLOWING IT SCROLLS THE TRANSCRIPT AND MARKS THE MESSAGE. A scroll alone does
     not say WHICH message was meant — the reader arrives mid-conversation with no
     marker. */
  await p.locator('button[aria-label^="Go to"]').first().click();
  await p.waitForTimeout(500);
  const jumped = await p.evaluate(`(() => {
    const el = document.querySelector(".chat-ref-flash");
    if (!el) return { flashed: false };
    const r = el.getBoundingClientRect();
    const scroller = document.querySelector('[data-slot="chat-thread"] [class*="overflow-y-auto"]');
    const s = scroller.getBoundingClientRect();
    return {
      flashed: true,
      inView: r.top >= s.top - 4 && r.bottom <= s.bottom + 4,
      id: el.id,
    };
  })()`);
  check(jumped.flashed, "the message is marked");
  check(jumped.inView, "and scrolled into view", String(jumped.id));
  await p.context().close();
}

// ═══ 4 · A support thread has nothing to document ═════════════════════════
console.log("\n── support thread @ active-mentorship");
{
  const p = await chat("active-mentorship");
  await p.locator('[role="tab"]', { hasText: "Support" }).first().click();
  await p.waitForTimeout(300);
  await p.locator('[role="tabpanel"] button[aria-label]').first().click();
  await p.waitForTimeout(600);
  await p.locator('[role="tab"]', { hasText: "Timeline" }).first().click();
  await p.waitForTimeout(400);

  const support = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    return {
      newNote: !!rail.querySelector('[data-slot="new-note"]'),
      tagOnBubble: !!document.querySelector('button[aria-label="Write a note about this message"]'),
    };
  })()`);
  /* ABSENT, NOT DISABLED. A colleague's conversation has no teen to document, and a
     greyed control would teach a mentor that documenting a colleague is a thing
     that exists. */
  check(!support.newNote, "no Write-a-note on a colleague's timeline");

  const bubbles = p.locator(`${LIST} > li[id^="msg-"]`);
  await bubbles.first().hover();
  await p.waitForTimeout(200);
  await bubbles.first().locator('button[aria-label="React to this message"]').click();
  await p.waitForTimeout(300);
  const menu = await p.evaluate(`
    document.querySelectorAll('[role="menu"][aria-label="Reactions"] [role="menuitem"]').length`);
  check(menu === 6, "and the message menu holds reactions alone", `${menu}`);
  void support;
  await p.context().close();
}

// ═══ 5 · Notes persist ════════════════════════════════════════════════════
console.log("\n── persistence @ active-mentorship");
{
  const p = await chat("active-mentorship");
  await writeNote(p, { nth: 1, title: "Worth revisiting the sleep thing" });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1900);
  await p.locator('[role="tab"]', { hasText: "Timeline" }).first().click();
  await p.waitForTimeout(400);
  const after = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    const rows = [...rail.querySelectorAll('[data-slot="timeline-note"]')];
    return {
      rows: rows.length,
      title: rows[0]?.innerText.split(String.fromCharCode(10))[0]?.trim(),
      chip: [...document.querySelectorAll('${LIST} > li[data-slot="event-chip"]')]
        .filter((li) => /added a note/.test(li.innerText)).length,
    };
  })()`);
  check(after.rows === 1, "the note survives a reload", `${after.rows}`);
  check(after.title === "Worth revisiting the sleep thing", "with its title", String(after.title));
  check(after.chip === 1, "and so does the event, exactly once", `${after.chip}`);
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
