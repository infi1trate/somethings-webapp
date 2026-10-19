// PHASE 4 — the sent-activity lifecycle, measured.
//
// Send → open the sheet → rescind → the retracted state → the event survives. The
// last of those is the one worth checking hardest: the whole design rests on the
// history being append-only, and "we never delete" is exactly the kind of claim
// that is true until somebody adds a convenience.
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

async function chat(scenario, width = 1440, height = 980) {
  const ctx = await b.newContext({ viewport: { width, height } });
  // GUARDED — addInitScript re-runs on reload; an unguarded write wipes the store.
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

const chips = `[...document.querySelectorAll('${LIST} > li[data-slot="event-chip"]')]
  .map((li) => ({
    text: li.innerText.replace(/\\s+/g, " ").trim(),
    pressable: li.firstElementChild.tagName === "BUTTON",
    struck: getComputedStyle(li.firstElementChild).textDecorationLine.includes("line-through"),
  }))`;

// ═══ 1 · Every send-chip opens its contents ═══════════════════════════════
console.log("\n── the sheet @ activities-in-flight");
{
  const p = await chat("activities-in-flight");
  check(p.__errors.length === 0, "no console or page errors", p.__errors.slice(0, 2).join(" | "));

  const before = await p.evaluate(chips);
  check(before.length === 3, "three event chips", `${before.length}`);
  /* PHASE 3 LEFT THESE INERT because there was nothing to open. Phase 4's job is
     that every one of them now does. */
  check(before.every((c) => c.pressable), "and every one is now pressable", before.map((c) => c.pressable).join(","));

  await p.locator(`${LIST} > li[data-slot="event-chip"] button`).first().click();
  await p.waitForTimeout(400);

  const sheet = await p.evaluate(`(() => {
    const d = document.querySelector('[data-slot="dialog-content"]');
    if (!d) return null;
    const items = [...d.querySelectorAll("ol li")];
    return {
      title: d.querySelector("h2,[data-slot=dialog-title]")?.textContent?.trim() ?? null,
      desc: d.querySelector("[data-slot=dialog-description]")?.textContent?.trim() ?? null,
      items: items.length,
      /* ANSWERED IS A WORD, not only a tint. On three prompts where one is
         answered, a tick and no tick differ by one glyph — and that difference is
         the reason a mentor opened this. */
      answeredWords: items.filter((li) => li.innerText.includes("Answered")).length,
      rescindLabel:
        [...d.querySelectorAll("button")].map((x) => x.innerText.trim()).find((t) => /take it back/i.test(t)) ?? null,
      body: d.innerText.replace(/\\s+/g, " "),
    };
  })()`);
  check(!!sheet, "the sheet opened");
  check(sheet.items === 3, "showing what was sent", `${sheet.items} items`);
  check(
    /Sent .+·/.test(sheet.desc ?? ""),
    "with when it went and where it got to",
    String(sheet.desc)
  );
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.context().close();
}

// ═══ 2 · Rescind is gated on opened, and says why ═════════════════════════
console.log("\n── eligibility @ activities-in-flight");
{
  const p = await chat("activities-in-flight");
  const results = [];
  for (const i of [0, 1]) {
    await p.locator(`${LIST} > li[data-slot="event-chip"] button`).nth(i).click();
    await p.waitForTimeout(400);
    results.push(
      await p.evaluate(`(() => {
        const d = document.querySelector('[data-slot="dialog-content"]');
        const text = d.innerText.replace(/\\s+/g, " ");
        return {
          title: d.querySelector("[data-slot=dialog-title]")?.textContent?.trim(),
          state: /Not opened yet|Opened|All answered|Taken back/.exec(text)?.[0] ?? null,
          canRescind: [...d.querySelectorAll("button")].some((x) => /take it back/i.test(x.innerText)),
          reason: /can.t be taken back/.test(text),
        };
      })()`)
    );
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
  }

  const unopened = results.find((r) => r.state === "Not opened yet");
  const opened = results.find((r) => r.state && r.state !== "Not opened yet");
  check(!!unopened, "one set is unopened", JSON.stringify(results.map((r) => r.state)));
  check(!!opened, "and one has been opened");
  check(unopened?.canRescind === true, "the unopened one can be taken back");
  check(opened?.canRescind === false, "the opened one cannot");
  /* THE REASON, NOT A DISABLED BUTTON. A greyed control teaches a mentor that the
     action exists and not why they cannot use it — and the why here is about the
     teen, not about a rule. */
  check(opened?.reason === true, "and it says why, rather than greying a control out");
  await p.context().close();
}

// ═══ 3 · Rescinding: retract, mark, and keep the history ══════════════════
console.log("\n── rescind @ activities-in-flight");
{
  const p = await chat("activities-in-flight");
  const before = await p.evaluate(chips);

  // Find the unopened set and take it back.
  let done = false;
  for (let i = 0; i < before.length && !done; i++) {
    await p.locator(`${LIST} > li[data-slot="event-chip"] button`).nth(i).click();
    await p.waitForTimeout(400);
    const btn = p.locator('[data-slot="dialog-content"] button', { hasText: "Take it back" });
    if (await btn.count()) {
      await btn.click();
      done = true;
    } else {
      await p.keyboard.press("Escape");
    }
    await p.waitForTimeout(400);
  }
  check(done, "found an eligible set and took it back");

  const after = await p.evaluate(chips);
  check(after.length === before.length + 1, "a second event joins the first", `${before.length} → ${after.length}`);
  /* ═══ THE ORIGINAL SURVIVES ═══
     The history is that this WAS sent and then taken back. A retraction that
     removed the send would be rewriting the record, and the store has no remove for
     exactly that reason. */
  const sends = after.filter((c) => /You sent/.test(c.text));
  const takes = after.filter((c) => /You took back/.test(c.text));
  check(sends.length === before.filter((c) => /You sent/.test(c.text)).length,
    "the original send is still there", `${sends.length}`);
  check(takes.length === 1, "with a taking-back beside it", `${takes.length}`);
  /* AND IT STEPS BACK, so two chips do not both claim to be current. Struck
     through rather than merely dimmed — every untinted chip is already muted ink,
     so reduced contrast alone would say nothing. */
  const struck = after.filter((c) => c.struck);
  check(struck.length === 1, "and the retracted send is struck through", `${struck.length}`);
  check(
    struck[0] && /You sent/.test(struck[0].text),
    "— the send, not the taking-back",
    struck[0]?.text ?? ""
  );

  // The sheet now reports it, and offers nothing.
  const target = after.findIndex((c) => c.struck);
  const chipButtons = await p.locator(`${LIST} > li[data-slot="event-chip"] button`).count();
  void chipButtons;
  await p.locator(`${LIST} > li[data-slot="event-chip"]`).filter({ hasText: "You sent" }).first().locator("button").click();
  await p.waitForTimeout(400);
  const reopened = await p.evaluate(`(() => {
    const d = document.querySelector('[data-slot="dialog-content"]');
    const text = d.innerText.replace(/\\s+/g, " ");
    return {
      says: /Taken back/.test(text),
      past: /You took this back on/.test(text),
      offers: [...d.querySelectorAll("button")].some((x) => /take it back/i.test(x.innerText)),
    };
  })()`);
  check(reopened.says, "the sheet reports the taken-back state");
  check(reopened.past, "in the past tense, with when");
  check(!reopened.offers, "and offers nothing further");
  void target;
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);

  /* PERSISTED. `rescindedAt` is on the artifact and the second event is in the log
     — both of the four things this surface keeps. */
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1900);
  const reloaded = await p.evaluate(chips);
  check(
    reloaded.filter((c) => c.struck).length === 1 &&
      reloaded.filter((c) => /You took back/.test(c.text)).length === 1,
    "and both survive a reload",
    `${reloaded.filter((c) => c.struck).length} struck, ${reloaded.filter((c) => /took back/.test(c.text)).length} retractions`
  );
  await p.context().close();
}

// ═══ 4 · A rescinded set stops counting toward the unlock ═════════════════
console.log("\n── the lock after a rescind @ re-matched");
{
  /* Riley's Connection Cards is 2-of-3 answered, which is what opens Deep
     Thoughts. It is also OPENED, so it cannot be rescinded — which is the point of
     this check: the unit test proves a rescinded set stops counting, and this
     proves the UI cannot get into a state where a mentor rescinds their way out of
     an unlock they are mid-way through using. */
  const p = await chat("re-matched");
  await p.locator('[role="tab"]', { hasText: "Tools" }).first().click();
  await p.waitForTimeout(500);
  const open = await p.evaluate(
    `!document.querySelector('${RAIL} div[role="group"][aria-disabled="true"]')`
  );
  check(open, "the finished set has Deep Thoughts unlocked");

  await p.locator(`${LIST} > li[data-slot="event-chip"]`).filter({ hasText: "You sent" }).first().locator("button").click();
  await p.waitForTimeout(400);
  const gated = await p.evaluate(`(() => {
    const d = document.querySelector('[data-slot="dialog-content"]');
    return {
      state: /Not opened yet|Opened|All answered/.exec(d.innerText)?.[0] ?? null,
      offers: [...d.querySelectorAll("button")].some((x) => /take it back/i.test(x.innerText)),
    };
  })()`);
  check(gated.state !== "Not opened yet", "the set behind it has been opened", String(gated.state));
  check(!gated.offers, "so it cannot be taken back at all");
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
