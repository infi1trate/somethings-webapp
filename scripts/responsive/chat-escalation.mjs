// PHASE 6 — escalation, measured.
//
// This is the phase where being wrong has a cost outside the product, so the checks
// are about the properties that matter rather than about the layout: the supervisor
// is notified BEFORE the assessment, the notification is a durable timestamped fact
// rather than a toast, the state survives navigation until somebody resolves it,
// 911 is the primary and is a real dialer link, and resolving cannot happen without
// an account of how it ended.
import { chromium } from "playwright";
import { STORE_VERSION } from "./store-version.mjs";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

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
  await p.waitForTimeout(1900);
  p.__errors = errors;
  return p;
}

// ═══ 1 · The banner, and what it states ═══════════════════════════════════
console.log("\n── the banner @ escalation-active");
{
  const p = await chat("escalation-active");
  check(p.__errors.length === 0, "no console or page errors", p.__errors.slice(0, 2).join(" | "));

  const banner = await p.evaluate(`(() => {
    const el = document.querySelector('[data-slot="status-banner"]');
    if (!el) return null;
    const thread = document.querySelector('[data-slot="chat-thread"]');
    const scroller = thread.querySelector('[class*="overflow-y-auto"]');
    const buttons = [...el.querySelectorAll("button")].map((x) => ({
      text: x.innerText.trim(),
      slot: x.dataset.slot,
      bg: getComputedStyle(x).backgroundColor,
      color: getComputedStyle(x).color,
    }));
    return {
      tone: el.dataset.tone,
      role: el.getAttribute("role"),
      title: el.querySelector("p")?.textContent?.trim(),
      meta: el.querySelectorAll("p")[1]?.textContent?.trim(),
      buttons,
      /* PINNED BY THE GRID, NOT STICKY. The banner must be OUTSIDE the scrolling
         region — an escalation a mentor can scroll away from is one they forget. */
      insideScroller: scroller.contains(el),
      position: getComputedStyle(el).position,
    };
  })()`);
  check(!!banner, "the banner rendered");
  check(banner.tone === "critical", "in the critical tone", String(banner.tone));
  /* `status`, NOT `alert`. An alert re-interrupts a screen reader on every render,
     and this banner is present on all of them. */
  check(banner.role === "status", "as a status, not an alert", String(banner.role));
  check(!banner.insideScroller, "outside the transcript's scroller, so it cannot be scrolled away");
  check(banner.position === "static", "pinned by the grid rather than by sticky", banner.position);

  /* ═══ THE TIMESTAMPED FACT ═══
     Not a toast. A mentor mid-phone-call has to be able to check that somebody
     knows, and the time is the part that makes it checkable. */
  check(
    /Supervisor notified [0-9]/.test(banner.meta ?? ""),
    "stating that the supervisor was notified, with a time",
    String(banner.meta)
  );
  check(/opened [0-9]/.test(banner.meta ?? ""), "and when it opened");

  const primary = banner.buttons.find((x) => x.slot === "banner-crisis");
  check(!!primary, "the crisis button is present", primary?.text);
  /* ═══ IT IS ACTUALLY FILLED ═══
     The first version used `bg-current` beside a `text-*` on the same element, so
     `currentColor` resolved to the button's OWN colour and it rendered as a white
     box with white text — the primary action on an escalation banner, invisible.
     Measured here rather than trusted. */
  check(
    primary && primary.bg !== "rgba(0, 0, 0, 0)" && primary.bg !== primary.color,
    "and is filled, with a foreground that differs from its fill",
    `${primary?.bg} on ${primary?.color}`
  );
  check(
    banner.buttons.map((x) => x.slot).join() ===
      "banner-crisis,banner-assessment,banner-resolve",
    "crisis first, then the checklist, then resolve",
    banner.buttons.map((x) => x.text).join(" | ")
  );
  await p.context().close();
}

// ═══ 2 · The rail opens on it ═════════════════════════════════════════════
console.log("\n── the rail @ escalation-active");
{
  const p = await chat("escalation-active");
  const rail = await p.evaluate(`(() => {
    const tabs = [...document.querySelectorAll('[role="tablist"][aria-label="Conversation tools"] [role="tab"]')];
    const panel = document.querySelector('[data-slot="assessment"]');
    return {
      labels: tabs.map((t) => t.textContent.trim()),
      selected: tabs.find((t) => t.getAttribute("aria-selected") === "true")?.textContent.trim(),
      assessmentOpen: !!panel,
      progress: /[0-9] of [0-9] covered/.exec(panel?.innerText ?? "")?.[0],
      /* NO SCORE, NO TOTAL BAR, NO COLOUR THAT CHANGES WITH A COUNT. A number would
         invite a mentor to decide whether this is bad enough — which is exactly the
         judgement the surface exists to take off them. */
      hasPercent: /%/.test(panel?.innerText ?? ""),
      hasRiskWord: /\brisk (score|level)\b/i.test(panel?.innerText ?? ""),
    };
  })()`);
  /* ═══ THE ESCALATION TAB IS FIRST AND SELECTED ═══
     A screenshot caught the rail opening on Assist while the banner two inches away
     read "Escalation open" — the rail's job is "what to do next", and it was
     answering with a suggestion panel. */
  check(rail.labels[0] === "Now", "the escalation tab is first", rail.labels.join(" | "));
  check(rail.selected === "Now", "and selected on open", String(rail.selected));
  check(rail.assessmentOpen, "the checklist is what it shows");
  check(!!rail.progress, "with a count of what is covered", String(rail.progress));
  check(!rail.hasPercent && !rail.hasRiskWord, "and no score, percentage or risk level");
  await p.context().close();
}

// ═══ 3 · Checking a step records a time, one way ══════════════════════════
console.log("\n── the checklist @ escalation-active");
{
  const p = await chat("escalation-active");
  const before = await p.evaluate(`(() => {
    const panel = document.querySelector('[data-slot="assessment"]');
    const items = [...panel.querySelectorAll("ol li")];
    return {
      total: items.length,
      done: items.filter((li) => /Covered /.test(li.innerText)).length,
      /* THE WORDING HELP is the field that matters most at 2am, and one press puts
         it in the composer rather than making a frightened mentor retype it. */
      wording: items.filter((li) => /Put this in the message box/.test(li.innerText)).length,
    };
  })()`);
  check(before.total === 5, "five steps", `${before.total}`);
  check(before.done === 2, "two already covered, with times", `${before.done}`);
  check(before.wording === 3, "and the open ones offer wording", `${before.wording}`);

  const open = p.locator(`${RAIL} ol li button[aria-label^="Mark as covered"]`).first();
  await open.click();
  await p.waitForTimeout(400);
  const after = await p.evaluate(`(() => {
    const panel = document.querySelector('[data-slot="assessment"]');
    const items = [...panel.querySelectorAll("ol li")];
    const covered = items.filter((li) => /Covered /.test(li.innerText));
    return {
      done: covered.length,
      progress: /[0-9] of [0-9] covered/.exec(panel.innerText)?.[0],
      /* ═══ IT DOES NOT UN-CHECK ═══
         Once something has been asked it has been asked, and a toggle would let the
         record be quietly walked back — the same reasoning that makes a note
         read-only and the event log append-only. */
      stillActionable: !!panel.querySelector('button[aria-label^="Mark as covered"][aria-disabled="false"]:nth-of-type(0)'),
      firstIsDisabled:
        covered[0]?.querySelector("button")?.getAttribute("aria-disabled") === "true",
    };
  })()`);
  check(after.done === 3, "checking one records it", `${after.done}`);
  check(after.progress === "3 of 5 covered", "and the count follows", String(after.progress));
  check(after.firstIsDisabled, "a covered step is no longer actionable");

  // The wording goes into the composer, unsent.
  const useWording = p.locator(`${RAIL} ol li button`, { hasText: "Put this in the message box" }).first();
  await useWording.click();
  await p.waitForTimeout(400);
  const composer = await p.evaluate(`(() => {
    const ta = document.querySelector('[data-slot="composer"] textarea');
    const send = [...document.querySelectorAll('[data-slot="composer"] button')]
      .find((x) => x.innerText.trim() === "Send");
    const chips = [...document.querySelectorAll('${LIST} > li')].length;
    return { value: ta?.value ?? "", focused: document.activeElement === ta, sendEnabled: !send?.disabled, entries: chips };
  })()`);
  check(composer.value.length > 10, "the wording lands in the composer", composer.value.slice(0, 40));
  check(composer.focused, "with the field focused");
  /* UNSENT. Nothing reaches a teen that a mentor did not press Send on. */
  check(composer.sendEnabled, "and Send enabled but not pressed — nothing was sent");
  await p.context().close();
}

// ═══ 4 · The crisis view ══════════════════════════════════════════════════
console.log("\n── the crisis view @ escalation-active");
{
  const p = await chat("escalation-active");
  await p.locator('[data-slot="banner-crisis"]').click();
  await p.waitForTimeout(500);

  const crisis = await p.evaluate(`(() => {
    const d = document.querySelector('[data-slot="crisis-view"]');
    if (!d) return null;
    const call = d.querySelector('[data-slot="call-emergency"]');
    const callBox = call?.getBoundingClientRect();
    const dBox = d.getBoundingClientRect();
    const links = [...d.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute("href"));
    return {
      /* ═══ 911 IS A REAL DIALER LINK, NOT A BUTTON WITH A CONFIRMATION ═══
         A confirmation on the one action that saves a life is a step in the wrong
         place. On a phone this opens the dialer with the number already in it. */
      callIsLink: call?.tagName === "A",
      callHref: call?.getAttribute("href"),
      callLabel: call?.innerText.trim(),
      /* ABOVE ANY FOLD. It is the first thing in the dialog, before anything a
         mentor has to read. */
      callAtTop: callBox && callBox.top - dBox.top < 140,
      /* EVERY NUMBER TAPPABLE. A mentor reading digits off a screen and typing them
         into a phone gets one wrong. */
      telLinks: links.length,
      /* NO CONFIRMATION ANYWHERE. There is nothing here to undo. */
      confirms: [...d.querySelectorAll("button")].filter((x) => /confirm|are you sure/i.test(x.innerText)).length,
      /* THE PERMISSION NOT TO BE CERTAIN. The most common failure in a moment like
         this is a young mentor waiting to be sure enough. */
      permission: /do not need to be certain/i.test(d.innerText),
      rows: [...d.querySelectorAll("p")].map((x) => x.textContent.trim()),
    };
  })()`);
  check(!!crisis, "the crisis view opened");
  check(crisis.callIsLink, "911 is a link, not a button");
  check(crisis.callHref === "tel:911", "pointing at the dialer", String(crisis.callHref));
  check(/^Call 911$/.test(crisis.callLabel ?? ""), "and the number IS the label", String(crisis.callLabel));
  check(crisis.callAtTop, "it is the first thing in the dialog");
  check(crisis.telLinks >= 3, "every number on the surface is tappable", `${crisis.telLinks}`);
  check(crisis.confirms === 0, "nothing asks for a confirmation");
  check(crisis.permission, "and it removes the decision to wait until certain");
  await p.context().close();

  /* ═══ THE UNAVAILABLE STATES ARE DESIGNED, AND REACHABLE ═══
     Thin data is exactly what a crisis view meets. The fresh-match scenario has a
     phone number and nothing else, which is why it exists. */
  const q = await chat("fresh-match");
  await q.locator(`${LIST} > li[id^="msg-"]`).first().hover();
  await q.waitForTimeout(200);
  await q.locator(`${LIST} > li[id^="msg-"]`).first().locator('button[aria-label="React to this message"]').click();
  await q.waitForTimeout(250);
  await q.locator('button[aria-label="Raise an escalation about this message"]').click();
  await q.waitForTimeout(600);
  await q.locator('[data-slot="banner-crisis"]').click();
  await q.waitForTimeout(500);
  const thin = await q.evaluate(`(() => {
    const d = document.querySelector('[data-slot="crisis-view"]');
    const text = d.innerText;
    return {
      /* NOT A DASH. A row rendering "—" costs a mentor ten seconds working out
         whether the data is missing or the app is broken — ten they do not have. */
      dashes: (text.match(/^—$/gm) ?? []).length,
      addressAbsent: /Not on file\\. Emergency services can trace/.test(text),
      contactAbsent: /intake may not have finished/.test(text),
      locationAbsent: /Nothing shared\\. Ask where they are/.test(text),
      stillHasCall: !!d.querySelector('[data-slot="call-emergency"]'),
    };
  })()`);
  check(thin.dashes === 0, "with no data, no row renders a bare dash");
  check(thin.addressAbsent, "the missing address says what to do instead");
  check(thin.contactAbsent, "and so does the missing contact");
  check(thin.locationAbsent, "and the missing location");
  check(thin.stillHasCall, "and 911 is still the primary");
  await q.context().close();
}

// ═══ 5 · Raising one: notify first, and only one at a time ════════════════
console.log("\n── raising one @ active-mentorship");
{
  const p = await chat("active-mentorship");
  const noBanner = await p.evaluate(`!document.querySelector('[data-slot="status-banner"]')`);
  check(noBanner, "no banner before there is an escalation");

  const bubbles = p.locator(`${LIST} > li[id^="msg-"]`);
  const target = await bubbles.nth(2).getAttribute("id");
  await bubbles.nth(2).hover();
  await p.waitForTimeout(200);
  await bubbles.nth(2).locator('button[aria-label="React to this message"]').click();
  await p.waitForTimeout(250);
  const menuItem = await p.evaluate(`(() => {
    const items = [...document.querySelectorAll('[role="menu"] [role="menuitem"]')];
    const esc = items.find((i) => /escalation/i.test(i.getAttribute("aria-label") ?? ""));
    return {
      /* LAST IN THE MENU, and the only tinted item — a menu whose most consequential
         entry sits beside six one-tap reactions is a menu somebody mis-presses. */
      isLast: esc === items[items.length - 1],
      label: esc?.getAttribute("aria-label"),
      title: esc?.getAttribute("title"),
      color: esc ? getComputedStyle(esc).color : null,
      neutralColor: items[0] ? getComputedStyle(items[0]).color : null,
    };
  })()`);
  check(menuItem.isLast, "Escalate is last in the menu");
  check(
    /raise an escalation/i.test(menuItem.label ?? ""),
    "named as what it does",
    String(menuItem.label)
  );
  /* THE TITLE SAYS THE CONSEQUENCE. "Escalate" alone may not connect, for a new
     mentor, to "a grown-up is told right now". */
  check(
    /supervisor/i.test(menuItem.title ?? ""),
    "and its tooltip says a supervisor is told",
    String(menuItem.title)
  );
  check(menuItem.color !== menuItem.neutralColor, "and it is the only tinted item");

  await p.locator('button[aria-label="Raise an escalation about this message"]').click();
  await p.waitForTimeout(700);

  const raised = await p.evaluate(`(() => {
    const banner = document.querySelector('[data-slot="status-banner"]');
    const tab = document.querySelector('[role="tablist"][aria-label="Conversation tools"] [role="tab"][aria-selected="true"]');
    const anchored = [...document.querySelectorAll('${LIST} > li[id^="msg-"]')]
      .filter((li) => getComputedStyle(li).borderLeftWidth === "2px");
    return {
      banner: !!banner,
      /* ═══ THE SUPERVISOR IS NOTIFIED AT CREATION, NOT AT THE END OF A CHECKLIST ═══
         A flow that made notification the last step would mean a frightened
         twenty-three-year-old deciding whether the situation qualifies — which is
         the judgement this surface exists to take off them. So the banner can state
         it as a fact from the first render, with no pending state. */
      notified: /Supervisor notified/.test(banner?.innerText ?? ""),
      pending: /sending|notifying/i.test(banner?.innerText ?? ""),
      tab: tab?.textContent.trim(),
      opened: [...document.querySelectorAll('${LIST} > li[data-slot="event-chip"]')]
        .some((li) => /raised an escalation/.test(li.innerText)),
      markedMessages: anchored.length,
    };
  })()`);
  check(raised.banner && raised.notified, "raising it notifies immediately", "no pending state");
  check(!raised.pending, "with no sending spinner over a write that already happened");
  check(raised.tab === "Now", "and puts the checklist in front of the mentor", String(raised.tab));
  check(raised.opened, "an event lands in the transcript");
  check(raised.markedMessages >= 1, "and the anchor message is marked", `${raised.markedMessages}`);
  void target;

  /* ONE AT A TIME. The store keys escalations by thread, so offering a second would
     be offering an action that silently overwrites the first one's assessment. */
  await bubbles.nth(3).hover();
  await p.waitForTimeout(200);
  await bubbles.nth(3).locator('button[aria-label="React to this message"]').click();
  await p.waitForTimeout(250);
  const second = await p.evaluate(
    `!!document.querySelector('[role="menu"] [role="menuitem"][aria-label*="escalation"]')`
  );
  check(!second, "and Escalate is gone while one is open");
  await p.keyboard.press("Escape");

  /* ═══ IT SURVIVES NAVIGATION ═══
     This is the requirement, not a nicety: an escalation stays open until somebody
     explicitly resolves it. */
  await p.goto(BASE + "/app/care-reviews", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.goto(BASE + "/app/chat", { waitUntil: "networkidle" });
  await p.waitForTimeout(1900);
  const returned = await p.evaluate(`(() => {
    const banner = document.querySelector('[data-slot="status-banner"]');
    return { banner: !!banner, notified: /Supervisor notified/.test(banner?.innerText ?? "") };
  })()`);
  check(returned.banner && returned.notified, "the escalation is still open after navigating away and back");
  await p.context().close();
}

// ═══ 6 · Resolving writes an account of how it ended ══════════════════════
console.log("\n── resolving @ escalation-active");
{
  const p = await chat("escalation-active");
  await p.locator('[data-slot="banner-resolve"]').click();
  await p.waitForTimeout(500);

  const dialog = await p.evaluate(`(() => {
    const d = document.querySelector('[data-slot="resolve-dialog"]');
    if (!d) return null;
    const resolve = [...d.querySelectorAll("button")].find((x) => x.innerText.trim() === "Resolve");
    return {
      outcomes: [...d.querySelectorAll('button[aria-pressed]')].length,
      hasProse: !!d.querySelector("textarea"),
      resolveDisabled: resolve?.disabled ?? null,
      /* THE ASSESSMENT'S STATE IS STATED, NOT ENFORCED. A supervisor reading back
         will see the same thing and should not be the first to notice — but a gate
         would push a mentor into ticking boxes to get past it. */
      statesProgress: /2 of 5 covered/.test(d.innerText),
      /* NOTHING CELEBRATES. An escalation ending is not an achievement. */
      celebrates: /nice work|well done|great|!/i.test(d.innerText.replace(/[^a-z !]/gi, "")),
      missing: /Choose how it ended/.test(d.innerText),
    };
  })()`);
  check(!!dialog, "the resolve dialog opened");
  check(dialog.outcomes === 4, "four named endings", `${dialog.outcomes}`);
  check(dialog.hasProse, "and a prose field");
  check(dialog.resolveDisabled === true, "Resolve is disabled to start");
  check(dialog.missing, "and it says what is missing rather than leaving a dead button");
  check(dialog.statesProgress, "the checklist's state is stated but not enforced");
  check(!dialog.celebrates, "and nothing celebrates");

  // An outcome alone is not enough.
  await p.locator('[data-slot="resolve-dialog"] button[aria-pressed]').first().click();
  await p.waitForTimeout(250);
  const half = await p.evaluate(`(() => {
    const d = document.querySelector('[data-slot="resolve-dialog"]');
    const r = [...d.querySelectorAll("button")].find((x) => x.innerText.trim() === "Resolve");
    return { disabled: r?.disabled, says: /Add a line about what happened/.test(d.innerText) };
  })()`);
  check(half.disabled === true, "an outcome alone does not enable it");
  check(half.says, "and it says the prose is what is missing");

  await p.locator('[data-slot="resolve-dialog"] textarea').fill(
    "Her aunt came home at six. She is not alone tonight and I will check in tomorrow."
  );
  await p.waitForTimeout(250);
  await p.locator('[data-slot="resolve-dialog"] button', { hasText: "Resolve" }).click();
  await p.waitForTimeout(800);

  const resolved = await p.evaluate(`(() => {
    const chips = [...document.querySelectorAll('${LIST} > li[data-slot="event-chip"]')]
      .map((li) => li.innerText.replace(/\\s+/g, " ").trim());
    const tabs = [...document.querySelectorAll('[role="tablist"][aria-label="Conversation tools"] [role="tab"]')]
      .map((t) => t.textContent.trim());
    const rail = document.querySelector('[data-slot="chat-rail"]');
    return {
      bannerGone: !document.querySelector('[data-slot="status-banner"]'),
      /* THE HISTORY SURVIVES: both events, opened and resolved. Resolving writes
         resolvedAt rather than deleting the row. */
      opened: chips.some((c) => /raised an escalation/.test(c)),
      resolvedChip: chips.some((c) => /resolved the escalation/.test(c)),
      tabGone: !tabs.includes("Now"),
      tab: [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((t) => t.textContent.trim()),
      /* AND A NOTE, holding the account. An escalation whose only trace is two
         timestamps tells a supervisor nothing about whether a teenager is all
         right. */
      note: [...rail.querySelectorAll('[data-slot="timeline-note"]')].map((x) => x.innerText.split(String.fromCharCode(10))[0].trim()),
    };
  })()`);
  check(resolved.bannerGone, "the banner is gone");
  check(resolved.tabGone, "and so is the escalation tab");
  check(resolved.opened && resolved.resolvedChip, "both events survive in the transcript");
  check(
    resolved.note.some((t) => /^Escalation resolved —/.test(t)),
    "a note holds the account of how it ended",
    resolved.note.join(" | ")
  );
  check(
    resolved.tab.includes("Timeline"),
    "and the rail lands where that note is, not on a tab that just vanished",
    resolved.tab.join(",")
  );

  // And it stays resolved.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1900);
  const after = await p.evaluate(`(() => ({
    banner: !!document.querySelector('[data-slot="status-banner"]'),
    resolvedChip: [...document.querySelectorAll('${LIST} > li[data-slot="event-chip"]')]
      .some((li) => /resolved the escalation/.test(li.innerText)),
  }))()`);
  check(!after.banner && after.resolvedChip, "and it stays resolved through a reload");
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
