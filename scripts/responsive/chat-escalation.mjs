// PHASE 6 — escalation, measured.
//
// This is the phase where being wrong has a cost outside the product, so the checks
// are about the properties that matter rather than about the layout: the supervisor
// is notified BEFORE the assessment, the notification is a durable timestamped fact
// rather than a toast, the state survives navigation until somebody resolves it,
// 911 is the primary and is a real dialer link, and closing cannot happen without
// an account of how it ended.
//
// ═══ RETARGETED (Escalation Exchange v2.0, 2026-10-21) ═══ The checklist, the
// mentor's Resolve and its dialog are deleted: the mentor answers a sequential
// assessment in Care, and the SUPERVISOR closes. Sections 1–3 and 6 assert the
// exchange; the claims that did not change (notified at creation, durable fact,
// 911 first, survives navigation) are kept word for word.
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

async function chat(scenario, width = 1440, height = 1000, { persona = "mentor", extra = {}, path = "/app/chat" } = {}) {
  const ctx = await b.newContext({ viewport: { width, height } });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
    },
    [KEY, { state: { persona, chatScenarioId: scenario, ...extra }, version: STORE_VERSION }]
  );
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(1900);
  p.__errors = errors;
  return p;
}

/* ═══ RETARGETED (Tiering & Escalation pack, 2026-10-20) ═══ Care replaced
   Now, and raising opens a flow (tier · what's happening · confirm) rather
   than writing the escalation in one press. Every claim below that changed is
   rewritten in place with the supersession named; the claims about the
   ORDER — notified at creation, not at the end of a checklist — are kept,
   because Confirm is still the write that notifies. */
async function completeRaise(p, tier = "1", note = "They said they might not be safe tonight.") {
  await p.locator(`[data-raise-option="${tier}"]`).click();
  await p.locator("[data-raise-note]").fill(note);
  await p.locator("[data-raise-confirm]").click();
  await p.waitForTimeout(600);
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
    /* THE ACTIONS, not every button: since SUP-5 "Supervisor notified" in the
       sentence is a link-style button into Support, and it is part of the
       fact, not one of the three actions. */
    const buttons = [...el.querySelectorAll("button")].filter((x) => x.dataset.slot !== "banner-supervisor").map((x) => ({
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
  /* SUPERSEDED: "crisis first, then the checklist, then resolve". The
     checklist is the assessment in Care, and the mentor no longer resolves —
     the supervisor closes, so a Resolve here would be a door that is not
     theirs. */
  /* SUPERSEDED AGAIN (pack v3.0, Supersession 6): "Open Care" is gone too —
     the Care tab is a tap away and carries the dot. One action remains. */
  check(
    banner.buttons.map((x) => x.slot).join() === "banner-crisis",
    "one action: Emergency info — no Open Care, no Resolve",
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
    const panel = document.querySelector("[data-assessment]");
    const ex = document.querySelector("[data-exchange]");
    /* The exchange's text with the advisory chip taken out. */
    const rest = ex ? [...ex.querySelectorAll("*")].filter((el) => !el.closest("[data-risk-chip]") && el.children.length === 0).map((el) => el.textContent).join(" ") : "";
    return {
      labels: tabs.map((t) => t.textContent.trim()),
      selected: tabs.find((t) => t.getAttribute("aria-selected") === "true")?.textContent.trim(),
      assessmentOpen: !!panel,
      /* RETARGETED (pack v5.0, Supersession 3): the count is the collapsed
         answered group's summary row; "Question 3 of 6" is the card's header. */
      /* RETARGETED (pack v6.1): the accordion's progress line. */
      progress: document.querySelector("[data-assessment-progress]")?.textContent.trim(),
      /* NO SCORE, NO PERCENTAGE. SUPERSEDED IN PART (pack v2.0): the pack
         adds ONE advisory line, "Assessment suggests: …", computed from the
         answers and never a tier. A risk word anywhere else would be the
         surface deciding for the mentor. */
      hasPercent: /%|\\bscore\\b/i.test(ex?.innerText ?? ""),
      riskOutsideChip: /\\b(low|moderate|high) risk\\b/i.test(rest),
      chip: ex?.querySelector("[data-risk-chip]")?.textContent ?? null,
    };
  })()`);
  /* ═══ THE ESCALATION TAB IS FIRST AND SELECTED ═══
     A screenshot caught the rail opening on Assist while the banner two inches away
     read "Escalation open" — the rail's job is "what to do next", and it was
     answering with a suggestion panel. */
  /* SUPERSEDED: "the escalation tab is first". Care is PERSISTENT and FIXED
     after Context — tabs never reorder — and it is what opens. */
  /* RETARGETED (pack v4.0, Supersession 3): Care is first, the labelled control. */
  check(rail.labels[0]?.startsWith("Care"), "Care is the first tab", rail.labels.join(" | "));
  check(rail.selected?.startsWith("Care"), "and selected on open", String(rail.selected));
  check(rail.assessmentOpen, "the assessment is what it shows");
  check(rail.progress === "2 of 6 answered", "with a count of what is answered", String(rail.progress));
  /* SUPERSEDED (pack v6.1): v3 kept the chip off the mentor's card until the
     assessment was sent; v6.1's walkthrough verifies the risk chip at every
     step, so it is LIVE from the first answer. What survives: no score, no
     percentage, and no risk word anywhere but the one advisory chip. */
  check(!rail.hasPercent && !rail.riskOutsideChip && rail.chip === "Assessment suggests: Low risk", "no score or percentage; the one live advisory chip, and no risk word outside it", String(rail.chip));
  await p.context().close();
}

// ═══ 3 · An answer records a time, and the wording goes in unsent ═════════
/* SUPERSEDED: "checking a step records a time, one way". The checklist is
   the sequential assessment; the property kept is that what a mentor does is
   on the record the moment they do it, and that wording help never sends. */
console.log("\n── the assessment @ escalation-active");
{
  const p = await chat("escalation-active");
  const before = await p.evaluate(`(() => ({
    active: document.querySelector("[data-assessment-active]")?.dataset.assessmentActive,
    answered: document.querySelectorAll('[data-acc-row][data-acc-state="answered"]').length,
    /* THE WORDING HELP is the field that matters most at 2am, and one press puts
       it in the composer rather than making a frightened mentor retype it. */
    wording: document.querySelectorAll("[data-assessment-wording]").length,
  }))()`);
  check(before.answered === 2 && before.active === "q3", "two answered, Q3 the one open question", JSON.stringify(before));
  check(before.wording === 1, "and only the open question offers its wording", `${before.wording}`);

  await p.locator('[data-yes-no="q3:no"]').click();
  await p.waitForTimeout(400);
  const after = await p.evaluate(`(() => {
    const s = JSON.parse(localStorage.getItem("${KEY}")).state.escalations.t13;
    return {
      at: s?.safetyCheck?.answers?.q3?.at ?? null,
      progress: document.querySelector("[data-assessment-progress]")?.textContent.trim(),
      active: document.querySelector("[data-assessment-active]")?.dataset.assessmentActive,
    };
  })()`);
  check(typeof after.at === "number", "answering records it, with a time", String(after.at));
  check(after.progress === "3 of 6 answered" && after.active === "q4", "and the count follows, with the next question open", JSON.stringify(after));

  // The wording goes into the composer, unsent.
  await p.locator("[data-assessment-wording]").click();
  await p.waitForTimeout(400);
  const composer = await p.evaluate(`(() => {
    const ta = document.querySelector('[data-slot="composer"] textarea');
    const send = [...document.querySelectorAll('[data-slot="composer"] button')]
      .find((x) => x.innerText.trim() === "Send");
    return { value: ta?.value ?? "", focused: document.activeElement === ta, sendEnabled: !send?.disabled };
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
      /* A TAB, NOT A DIALOG (pack v3.0, Supersession 5). */
      inTab: !!d.closest('[data-care-tabpanel="emergency"]'),
      dialog: !!d.closest('[role="dialog"]'),
      tab: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab,
    };
  })()`);
  check(!!crisis, "the crisis view opened");
  check(crisis.inTab && !crisis.dialog && crisis.tab === "emergency", "the banner chip opens Care on its Emergency info tab — not a dialog", JSON.stringify({ inTab: crisis.inTab, dialog: crisis.dialog, tab: crisis.tab }));
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
  await completeRaise(q);
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
  /* KEPT RED (answered 2026-10-21) — a named exception to the tiering
     pack's colour rule. */
  check(menuItem.color !== menuItem.neutralColor, "and it is the only tinted item");

  await p.locator('button[aria-label="Raise an escalation about this message"]').click();
  await p.waitForTimeout(700);
  /* THE FLOW OPENS IN CARE; NOTHING IS WRITTEN UNTIL CONFIRM. */
  const flow = await p.evaluate(`({ flow: !!document.querySelector("[data-raise-flow]"), banner: !!document.querySelector('[data-slot="status-banner"]') })`);
  check(flow.flow && !flow.banner, "the raise flow opens, and nothing is written before Confirm", JSON.stringify(flow));
  await completeRaise(p);

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
  check(raised.tab?.startsWith("Care"), "and puts the Care tab's assessment in front of the mentor", String(raised.tab));
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
    /* "Raise an escalation" specifically: "Add this message to the escalation"
       is offered while one is open, by design (pack v3.0). */
    `!!document.querySelector('[role="menu"] [role="menuitem"][aria-label^="Raise an escalation"]')`
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

// ═══ 6 · The supervisor closes, and the account survives ══════════════════
/* SUPERSEDED: "resolving writes an account of how it ended", through a mentor's
   Resolve dialog. The supervisor closes now (pack v2.0); the account is the
   escalation record itself — tier, reason, outcome — and the mentor reads it
   in the M4 wrap and in History. The S1 exit (Tier 3, a standard tier update)
   is the shortest close; tiering.mjs walks the full Tier 1 path. */
console.log("\n── closing @ escalation-active");
{
  /* The assessment arrives first: Confirm waits for it (pack v3.0, S0). */
  const men = await chat("escalation-active", 1440, 1000, { path: "/app/chat/t13" });
  for (const id of ["q3:no", "q4:no", "q5:no", "q6:no"]) {
    await men.locator(`[data-yes-no="${id}"]`).click();
    await men.waitForTimeout(120);
  }
  await men.locator('[data-exchange-field="mentor-summary"]').fill("Aunt is home now; Jordan is calmer.");
  await men.locator('[data-exchange-primary="submit-assessment"]').click();
  await men.waitForTimeout(400);
  const sent = await men.evaluate(`JSON.parse(localStorage.getItem("${KEY}")).state`);
  await men.context().close();
  const sup = await chat("escalation-active", 1440, 1000, { persona: "supervisor", path: "/app/chat/t13", extra: { escalations: sent.escalations, tierEvents: sent.tierEvents } });
  const noResolve = await sup.evaluate(`!document.querySelector('[data-slot="banner-resolve"]')`);
  check(noResolve, "the supervisor's banner carries no Resolve either — closing is a stage, not a button");
  await sup.locator('[data-s1-tier="3"]').click();
  await sup.locator('[data-exchange-field="confirm-reason"]').fill("Aunt is home; Jordan agreed to the plan. A standard update to Tier 3.");
  await sup.locator('[data-exchange-primary="confirm-tier"]').click();
  await sup.waitForTimeout(700);
  const st = await sup.evaluate(`JSON.parse(localStorage.getItem("${KEY}")).state`);
  await sup.context().close();

  const p = await chat("escalation-active", 1440, 1000, { extra: { escalations: st.escalations, tierEvents: st.tierEvents, chatEvents: st.chatEvents } });
  const resolved = await p.evaluate(`(() => {
    const chips = [...document.querySelectorAll('${LIST} > li[data-slot="event-chip"]')]
      .map((li) => li.innerText.replace(/\\s+/g, " ").trim());
    return {
      bannerGone: !document.querySelector('[data-slot="status-banner"]'),
      /* THE HISTORY SURVIVES: both events, opened and resolved. Closing
         writes resolvedAt rather than deleting the row. */
      opened: chips.some((c) => /raised an escalation/.test(c)),
      /* pack v3.0 (E1): "closed", and the actor is the supervisor — never
         the teen ("Jordan resolved the escalation" was the defect). */
      resolvedChip: chips.some((c) => /^Brandy closed the escalation/.test(c)),
      teenActor: chips.some((c) => /^Jordan (closed|resolved)/.test(c)),
      stage: document.querySelector("[data-exchange]")?.dataset.stage,
      outcome: document.querySelector("[data-wrap-outcome]")?.textContent,
      tab: [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((t) => t.textContent.trim()),
    };
  })()`);
  check(resolved.bannerGone, "the banner is gone");
  check(resolved.opened && resolved.resolvedChip && !resolved.teenActor, "both events survive in the transcript — the close names the supervisor, never the teen");
  /* AN ACCOUNT, NOT TWO TIMESTAMPS. An escalation whose only trace is when it
     opened and closed tells nobody whether a teenager is all right. */
  check(resolved.stage === "M4" && /Standard tier update/.test(resolved.outcome ?? "") && resolved.tab.some((t) => t.startsWith("Care")), "the mentor is shown how it ended, in Care (M4)", JSON.stringify(resolved));
  await p.locator('[data-exchange-primary="back-to-care"]').click();
  await p.waitForTimeout(400);
  /* History is a Care tab of its own now (pack v3.0). */
  await p.locator('[data-care-tab="history"]').click();
  await p.waitForTimeout(200);
  const story = await p.evaluate(`document.querySelector("[data-escalation-story]")?.innerText.replace(/\\s+/g, " ") ?? ""`);
  check(/Tier update/i.test(story), "and History keeps the account as one story", story.slice(0, 100));

  // And it stays closed.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1900);
  const after = await p.evaluate(`(() => ({
    banner: !!document.querySelector('[data-slot="status-banner"]'),
    exchange: !!document.querySelector("[data-exchange]"),
    resolvedChip: [...document.querySelectorAll('${LIST} > li[data-slot="event-chip"]')]
      .some((li) => /closed the escalation/.test(li.innerText)),
  }))()`);
  check(!after.banner && !after.exchange && after.resolvedChip, "and it stays closed through a reload");
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
