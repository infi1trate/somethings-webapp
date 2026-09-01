// PHASE 7 — chrome and polish, measured.
//
// The kebab, the Assist ladder, the Profile canvas, and the gallery that makes the
// squint test possible. The two claims worth checking hardest are that Assist offers
// ONE suggestion with a checkable reason, and that a teen's own words render
// verbatim — the second is the place where a casing rule could quietly edit a
// person's self-description.
import { chromium } from "playwright";
import { STORE_VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const RAIL = '[data-slot="chat-rail"]';

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();

async function open(url, { scenario = "active-mentorship", w = 1440, h = 1000 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
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
  await p.goto(BASE + url, { waitUntil: "networkidle" });
  await p.waitForTimeout(1900);
  p.__errors = errors;
  return p;
}

const tab = async (p, name) => {
  await p.locator('[role="tab"]', { hasText: name }).first().click();
  await p.waitForTimeout(400);
};

// ═══ 1 · Assist: one suggestion, one reason ═══════════════════════════════
console.log("\n── assist @ active-mentorship");
{
  const p = await open("/app/chat");
  check(p.__errors.length === 0, "no console or page errors", p.__errors.slice(0, 2).join(" | "));
  await tab(p, "Assist");

  const assist = await p.evaluate(`(() => {
    const el = document.querySelector('[data-slot="assist"]');
    if (!el) return null;
    return {
      /* ═══ ONE ═══
         A list of five is a second to-do list, and it destroys the thing that makes
         a suggestion useful: if the panel offers five, none of them is a
         recommendation. */
      headings: el.querySelectorAll("h3").length,
      title: el.querySelector("h3")?.textContent?.trim(),
      because: el.querySelectorAll("p")[0]?.textContent?.trim(),
      hasDo: !!el.querySelector('[data-slot="assist-do"]'),
      hasDismiss: !!el.querySelector('[data-slot="assist-dismiss"]'),
      dismissLabel: el.querySelector('[data-slot="assist-dismiss"]')?.textContent?.trim(),
      /* THE COUNT IS SHOWN, THE LIST IS NOT. */
      more: /[0-9]+ more after this/.test(el.innerText),
      /* NOTHING IS ATTRIBUTED TO A MODEL. The panel this replaces led with an
         AI-generated summary; every suggestion here is derived from an observable
         fact and says which. */
      claimsAi: /\\bAI\\b|generated|our system|we think/i.test(el.innerText),
      text: el.innerText.replace(/\\s+/g, " "),
    };
  })()`);
  check(!!assist, "the assist panel rendered");
  check(assist.headings === 1, "exactly one suggestion", `${assist.headings}`);
  check(!!assist.title, "with an instruction", String(assist.title));
  /* ═══ THE REASON IS A CHECKABLE FACT ═══
     "They last wrote 9 days ago", not "engagement is declining". A mentor has to be
     able to look at the reason and disagree with the conclusion. */
  check(
    !!assist.because && assist.because.length > 20,
    "and a reason",
    String(assist.because)
  );
  check(!assist.claimsAi, "nothing here is attributed to a model");
  check(assist.hasDo && assist.hasDismiss, "two ways out");
  check(/not now/i.test(assist.dismissLabel ?? ""), "and declining is a real answer", String(assist.dismissLabel));

  // Dismissing advances rather than emptying.
  const firstTitle = assist.title;
  await p.locator(`${RAIL} [data-slot="assist-dismiss"]`).click();
  await p.waitForTimeout(400);
  const next = await p.evaluate(`(() => {
    const el = document.querySelector('[data-slot="assist"]');
    return {
      title: el?.querySelector("h3")?.textContent?.trim() ?? null,
      empty: !el,
      emptyText: document.querySelector('[data-slot="chat-rail"]').innerText,
    };
  })()`);
  check(
    next.title !== firstTitle,
    "dismissing moves to the next one",
    `${firstTitle} → ${next.title ?? "(none left)"}`
  );

  // A support thread has no ladder to run.
  await p.locator('[role="tab"]', { hasText: "Support" }).first().click();
  await p.waitForTimeout(300);
  await p.locator('[data-slot="conversation-list"] [role="tabpanel"] button[aria-label]').first().click();
  await p.waitForTimeout(600);
  const support = await p.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    return { hasLadder: !!rail.querySelector('[data-slot="assist"]'), says: /colleague/i.test(rail.innerText) };
  })()`);
  check(!support.hasLadder, "a colleague's thread runs no ladder");
  check(support.says, "and says why rather than looking broken");
  await p.context().close();
}

// ═══ 2 · Profile: their words, verbatim ═══════════════════════════════════
console.log("\n── profile @ active-mentorship");
{
  const p = await open("/app/chat");
  await tab(p, "Profile");
  const profile = await p.evaluate(`(() => {
    const el = document.querySelector('[data-slot="profile"]');
    if (!el) return null;
    const headings = [...el.querySelectorAll("h3")].map((h) => h.textContent.trim());
    const quotes = [...el.querySelectorAll("blockquote p")].map((q) => q.textContent.trim());
    return {
      headings,
      quotes,
      basics: [...el.querySelectorAll("p")].some((x) => /^Age$/.test(x.textContent.trim())),
      /* NOT A DASHBOARD. A mentor opening Profile is trying to remember who this
         person is, not audit them. */
      hasMetrics: /engagement|last active|response rate|[0-9]+%/i.test(el.innerText),
    };
  })()`);
  check(!!profile, "the profile panel rendered");
  check(profile.basics, "with the basics");
  /* ═══ OUR HEADINGS ARE SENTENCE CASE ═══ */
  check(
    profile.headings.every((h) => h === h.charAt(0).toUpperCase() + h.slice(1) && h !== h.toUpperCase()),
    "our section headings are sentence case",
    profile.headings.join(" | ")
  );
  /* ═══ AND THEIR WORDS ARE NOT ═══
     This is the check that matters. The casing rule governs product chrome; a
     fifteen-year-old writing "im not actually quiet" wrote that, and a product that
     capitalises it has edited a person's self-description to match a style guide.
     So at least one quote must survive with a lowercase opening. */
  check(profile.quotes.length > 0, "and their own words are quoted", `${profile.quotes.length}`);
  check(
    profile.quotes.some((q) => q[0] === q[0].toLowerCase() && /[a-z]/.test(q[0])),
    "rendered verbatim, lowercase intact — not tidied to match our style",
    profile.quotes[0]?.slice(0, 44)
  );
  check(!profile.hasMetrics, "and it is not a dashboard");

  // A teen seven days in has almost nothing, and the panel says so calmly.
  const q = await open("/app/chat?with=t14");
  await tab(q, "Profile");
  const thin = await q.evaluate(`(() => {
    const rail = document.querySelector('[data-slot="chat-rail"]');
    return { text: rail.innerText.replace(/\\s+/g, " "), nothing: /Nothing shared yet/.test(rail.innerText) };
  })()`);
  check(thin.nothing, "a new match's empty sections say so", thin.text.slice(0, 60));
  await q.context().close();
  await p.context().close();
}

// ═══ 3 · The kebab ════════════════════════════════════════════════════════
console.log("\n── the kebab @ active-mentorship");
{
  const p = await open("/app/chat");
  await p.locator('button[aria-label^="More options for"]').click();
  await p.waitForTimeout(400);
  const menu = await p.evaluate(`(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    return {
      count: items.length,
      labels: items.map((i) => i.textContent.trim()),
      /* EVERY ITEM NAMED IN WORDS — this is a kebab, the least discoverable control
         on the screen, and a glyph-only entry inside one is unreachable. */
      allWords: items.every((i) => i.textContent.trim().length > 3),
      record: items.find((i) => /record/i.test(i.textContent))?.getAttribute("href")
        ?? items.find((i) => /record/i.test(i.textContent))?.querySelector("a")?.getAttribute("href"),
      tel: [...document.querySelectorAll('[role="menu"] a[href^="tel:"]')].length,
      escalate: items.some((i) => /raise an escalation/i.test(i.textContent)),
      /* REPORTING IS NOT ESCALATION. Conflating them would mean safeguarding alerts
         raised about spam. */
      report: items.some((i) => /report a problem/i.test(i.textContent)),
    };
  })()`);
  check(menu.count === 5, "five items", `${menu.count}`);
  check(menu.allWords, "every one named in words", menu.labels.join(" | "));
  check(!!menu.record, "the record is linked", String(menu.record));
  check(menu.tel === 1, "the call is a real dialer link", `${menu.tel}`);
  check(menu.escalate, "escalation has its second entry point here");
  check(menu.report, "and reporting a chat problem is a separate item");
  await p.keyboard.press("Escape");

  /* GONE WHILE ONE IS OPEN, like the message menu's. */
  const q = await open("/app/chat", { scenario: "escalation-active" });
  await q.locator('button[aria-label^="More options for"]').click();
  await q.waitForTimeout(400);
  const during = await q.evaluate(
    `[...document.querySelectorAll('[role="menuitem"]')].some((i) => /raise an escalation/i.test(i.textContent))`
  );
  check(!during, "and it is gone while an escalation is open");
  await q.context().close();
  await p.context().close();
}

// ═══ 4 · The gallery renders every primitive ══════════════════════════════
console.log("\n── /dev/components");
{
  const p = await open("/dev/components", { w: 1600, h: 1200 });
  check(p.__errors.length === 0, "no console or page errors", p.__errors.slice(0, 2).join(" | "));

  const gallery = await p.evaluate(`(() => {
    const text = document.body.innerText;
    const covers = [...document.querySelectorAll("h2")].find((h) => /activity covers/i.test(h.textContent))
      ?.closest("section");
    const coverCards = covers ? covers.querySelectorAll("svg").length : 0;
    const metas = covers ? (covers.innerText.match(/[0-9]+ [a-z]+s? · ~[0-9]+ min/g) ?? []) : [];
    const banners = document.querySelectorAll('[data-slot="status-banner"]').length;
    const frames = [...document.querySelectorAll('[data-slot="media-frame"]')].map((f) => {
      const r = f.getBoundingClientRect();
      return { ratio: +(r.width / r.height).toFixed(2), declared: +(Number(f.dataset.w) / Number(f.dataset.h)).toFixed(2) };
    });
    const chips = document.querySelectorAll('[data-slot="event-chip"]').length;
    return {
      sections: [...document.querySelectorAll("h2")].map((h) => h.textContent.trim()).filter((t) => /^Chat · /.test(t)),
      coverCards,
      metaCount: metas.length,
      /* THE SQUINT TEST, AS AN ASSERTION: every metadata line in the covers panel
         matches one shape, seen side by side. */
      metaOneFormat: new Set(metas.map((m) => m.replace(/[0-9]+/g, "N").replace(/[a-z]+s?(?= ·)/, "U"))).size,
      banners,
      frames,
      chips,
      /* SEVEN KINDS RENDERED INLINE and seven as rows, from one component. */
      panels: document.querySelectorAll('[data-slot="assist"], [data-slot="profile"]').length,
      hasToolkit: /Each one says what it is for/.test(text),
      hasTimelineEmpty: /Activities sent, notes written/.test(text),
    };
  })()`);
  check(gallery.sections.length === 5, "five chat sections in the gallery", gallery.sections.join(" | "));
  check(gallery.coverCards >= 7, "the covers render", `${gallery.coverCards} glyphs`);
  check(gallery.metaCount >= 5, "with their metadata lines", `${gallery.metaCount}`);
  check(gallery.metaOneFormat === 1, "all in one format, side by side", `${gallery.metaOneFormat} distinct shapes`);
  check(gallery.banners === 3, "three banner tones", `${gallery.banners}`);
  check(gallery.chips === 7, "all seven event kinds inline", `${gallery.chips}`);
  check(
    gallery.frames.length === 3 &&
      gallery.frames.every((f) => Math.abs(f.ratio - f.declared) < 0.03),
    "and every media frame matches its record's ratio",
    JSON.stringify(gallery.frames)
  );
  check(gallery.panels === 2 && gallery.hasToolkit && gallery.hasTimelineEmpty, "all four rail panels render");
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
