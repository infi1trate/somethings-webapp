// VERIFICATION FOR THE CARE-TAB BRIEF (Workstreams A–E).
// One question per spec item, answered from the DOM rather than from a look.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const VERSION = Number(process.env.STORE_VERSION ?? 42);

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

const b = await chromium.launch();

async function open(teen, { width = 1440, height = 1000, zoom = 1 } = {}) {
  const ctx = await b.newContext({ viewport: { width, height } });
  await ctx.addInitScript(
    ([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); },
    [KEY, { state: { persona: "supervisor" }, version: VERSION }]
  );
  const p = await ctx.newPage();
  if (zoom !== 1) await p.addStyleTag({ content: `html { font-size: ${16 * zoom}px }` });
  await p.goto(`${BASE}/admin/person/${teen}?tab=care`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  return p;
}

// ═══ A · THE AMEND MODAL ═══
console.log("\n═══ A · amend modal ═══");
for (const zoom of [1, 2]) {
  // A SHORT VIEWPORT ON PURPOSE. At 1000px tall the whole form fits inside
  // `max-h-[90dvh]` and nothing scrolls, so "the body is the scroller" would pass
  // or fail on whether there was anything to scroll rather than on the structure.
  const p = await open("t17", { zoom, height: 620 });
  const amend = p.getByRole("button", { name: "Amend care update", exact: true }).first();
  if ((await amend.count()) === 0) { console.log(`  (zoom ${zoom}x: no Amend control)`); await p.context().close(); continue; }
  await amend.click();
  await p.waitForTimeout(900);
  // Force overflow: 30 lines is past the 12-line cap, exercising BOTH the
  // degenerate internal scroll and the body scroll at once.
  await p.locator('[data-slot="dialog-content"] textarea').first()
    .fill(Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of the clinical statement.`).join("\n"));
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const content = document.querySelector('[data-slot="dialog-content"]');
    if (!content) return { absent: true };
    const scrollers = [content, ...content.querySelectorAll("*")].filter((el) => {
      const cs = getComputedStyle(el);
      const oy = cs.overflowY;
      return (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1;
    }).map((el) => el.getAttribute("data-slot") ?? el.tagName.toLowerCase());
    const cta = [...content.querySelectorAll("button")].find((x) => /Append amendment|Save update|Apply change/i.test(x.textContent));
    // COUNT THE LABEL'S LINES, NOT THE BUTTON'S HEIGHT. `PillButton` has a fixed
    // height, so height ÷ line-height reports 3 lines for a label on one.
    let ctaLines = null;
    if (cta) {
      const t = [...cta.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (t) { const rng = document.createRange(); rng.selectNodeContents(t); ctaLines = rng.getClientRects().length; }
    }
    const tas = [...content.querySelectorAll("textarea")].map((t) => {
      const cs = getComputedStyle(t);
      return { lines: Math.round(t.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || 20)), overflowY: cs.overflowY };
    });
    const body = content.querySelector('[data-slot="dialog-body"]');
    const foot = content.querySelector('[data-slot="dialog-footer"]');
    return {
      width: Math.round(content.getBoundingClientRect().width),
      scrollers,
      ctaLabel: cta?.textContent.trim(), ctaLines, ctaWhiteSpace: cta ? getComputedStyle(cta).whiteSpace : null,
      textareas: tas,
      hasSelect: !!content.querySelector('[id="cu-assessment"]'),
      radios: content.querySelectorAll('[role="radio"], input[type="radio"]').length,
      footerPinned: !!(body && foot) && !body.contains(foot) && foot.getBoundingClientRect().top >= body.getBoundingClientRect().bottom - 1,
    };
  });
  console.log(`  ── zoom ${zoom}x ──`);
  if (r.absent) { check(false, "dialog present"); await p.context().close(); continue; }
  check(!r.scrollers.includes("dialog-content"), "DialogContent does not scroll", `scrollers: ${JSON.stringify(r.scrollers)}`);
  check(r.scrollers.includes("dialog-body"), "the body is the scrolling region");
  check(r.footerPinned, "the footer sits below the scrolling body, not inside it");
  check(r.ctaLines === 1, `CTA "${r.ctaLabel}" on ONE line`, `lines=${r.ctaLines} nowrap=${r.ctaWhiteSpace}`);
  check(r.hasSelect && r.radios === 0, "assessment is a select, radios gone");
  check(r.textareas[0].lines >= 12 && r.textareas[0].lines <= 13, "the filled field caps at ~12 lines", JSON.stringify(r.textareas[0]));
  check(r.textareas[0].overflowY === "auto", "and only then scrolls internally");
  check(r.textareas[1].lines >= 4 && r.textareas[1].overflowY === "hidden", "the empty field rests at ≥4 lines, no scrollbar", JSON.stringify(r.textareas[1]));
  if (zoom === 1) {
    check(r.width >= 600 && r.width <= 680, "modal ~640px", `${r.width}px`);
    // MEASURE IN `ch`, NOT AVERAGE GLYPHS — the 45–75 convention is defined in
    // `ch` (the width of "0"); average lowercase advance over-reports.
    const m = await p.evaluate(() => {
      const ta = document.querySelector('[data-slot="dialog-content"] textarea');
      const cs = getComputedStyle(ta);
      const probe = document.createElement("span");
      probe.textContent = "0";
      probe.style.cssText = `position:absolute;visibility:hidden;font:${cs.font}`;
      document.body.appendChild(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      const inner = ta.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return { ch: Math.round(inner / ch), inner: Math.round(inner), chW: +ch.toFixed(2) };
    });
    check(m.ch >= 55 && m.ch <= 75, "body measure in the 55–75ch range", `${m.ch}ch (${m.inner}px ÷ ${m.chW}px)`);
  }
  await p.context().close();
}

// ═══ A · ONE SCROLLER AT A NORMAL FILL ═══
console.log("\n═══ A · one scroll context at a normal fill ═══");
{
  const p = await open("t17", { height: 620 });
  await p.getByRole("button", { name: "Amend care update", exact: true }).first().click();
  await p.waitForTimeout(800);
  await p.locator('[data-slot="dialog-content"] textarea').first()
    .fill(Array.from({ length: 6 }, (_, i) => `Sentence ${i + 1} of the statement.`).join("\n"));
  await p.waitForTimeout(500);
  const scrollers = await p.evaluate(() => {
    const c = document.querySelector('[data-slot="dialog-content"]');
    return [c, ...c.querySelectorAll("*")].filter((el) => {
      const cs = getComputedStyle(el);
      const oy = cs.overflowY;
      return (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1;
    }).map((el) => el.getAttribute("data-slot") ?? el.tagName.toLowerCase());
  });
  check(scrollers.length === 1 && scrollers[0] === "dialog-body",
    "exactly one scroll context, and it is the body", JSON.stringify(scrollers));
  await p.context().close();
}

// ═══ A7 · STATES ═══
console.log("\n═══ A7 · modal states ═══");
{
  // t13, NOT t17 — one button carries both flows (`latestUpdate ? "Amend…" :
  // "Write…"`), so on a record that already has an update the amend modal is the
  // only one reachable and its fields are PREFILLED.
  const p = await open("t13", { height: 1000 });
  const write = p.getByRole("button", { name: "Write care update", exact: true }).first();
  if ((await write.count()) === 0) { console.log("  (no Write control on t13)"); }
  else {
    await write.click();
    await p.waitForTimeout(800);
    const empty = await p.evaluate(() => {
      const c = document.querySelector('[data-slot="dialog-content"]');
      return {
        assessment: c?.querySelector('[id="cu-assessment"]')?.textContent.trim(),
        ctaEnabled: ![...c.querySelectorAll("button")].find((x) => /Save update|Append/i.test(x.textContent))?.disabled,
      };
    });
    check(/select an assessment/i.test(empty.assessment ?? ""), "empty: no default preselection", JSON.stringify(empty.assessment));
    check(empty.ctaEnabled, "empty: CTA ENABLED (inline recovery, never a disabled button)");
    await p.locator('[data-slot="dialog-content"] button').filter({ hasText: /Save update|Append amendment|Apply change/ }).first().click();
    await p.waitForTimeout(500);
    const errs = await p.evaluate(() => {
      const c = document.querySelector('[data-slot="dialog-content"]');
      if (!c) return { messages: [], stillOpen: false, ctaEnabled: null };
      return {
        messages: [...c.querySelectorAll('p[id$="-err"]')].map((e) => e.textContent.trim()).filter(Boolean),
        stillOpen: true,
        ctaEnabled: ![...c.querySelectorAll("button")].find((x) => /Save update|Append/i.test(x.textContent))?.disabled,
      };
    });
    check(errs.messages.length >= 1, "validation: inline error text under the fields", JSON.stringify(errs.messages));
    check(errs.stillOpen, "validation: the modal stays open");
    check(errs.ctaEnabled, "validation: CTA stays enabled");
    if (process.env.SHOT_DIR) await p.locator('[data-slot="dialog-content"]').screenshot({ path: `${process.env.SHOT_DIR}/A-modal-error.png` });
  }
  await p.context().close();
}

if (process.env.SHOT_DIR) {
  for (const zoom of [1, 2]) {
    const p = await open("t17", { zoom, height: zoom === 1 ? 1000 : 1200 });
    const amend = p.getByRole("button", { name: "Amend care update", exact: true }).first();
    if ((await amend.count()) > 0) {
      await amend.click();
      await p.waitForTimeout(800);
      await p.locator('[data-slot="dialog-content"]').screenshot({ path: `${process.env.SHOT_DIR}/A-modal-amend-${zoom}x.png` });
    }
    await p.context().close();
  }
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
