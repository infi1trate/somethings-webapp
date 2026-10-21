// THE REPORT-BACK'S MEASUREMENTS, taken from the running app rather than the source.
//
// Three claims that are only worth making with numbers behind them:
//
//  · THE VOCABULARY GATE. Not a source grep — the source is full of the banned words
//    in comments explaining why they are not used, which a grep cannot tell from a
//    string that renders. This walks every rail panel in three scenarios and reads
//    the actual rendered text.
//  · AXE, per scenario, because the escalation surface renders components nothing
//    else does and a single-route run would miss them.
//  · WHAT STILL MOVES UNDER `prefers-reduced-motion`, broken down BY PROPERTY. "All
//    motion suppressed" is the claim everybody makes and almost nobody checks;
//    reporting the properties is what makes the claim falsifiable. Colour
//    transitions are deliberately NOT suppressed — the media query is about
//    movement, and killing every hover tint would be over-applying it.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { STORE_VERSION } from "./store-version.mjs";
const KEY = "somethings.mentor-onboarding";
const b = await chromium.launch();

const BANNED = ["patient", "caseload", "churn", "at-risk", "at risk", "lapsed", "retention", "engagement score"];

for (const [scenario, label] of [
  ["active-mentorship", "active"],
  ["escalation-active", "escalation"],
  ["fresh-match", "fresh"],
]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); },
    [KEY, { state: { persona: "mentor", chatScenarioId: scenario }, version: STORE_VERSION }]);
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/app/chat", { waitUntil: "networkidle" });
  await p.waitForTimeout(1900);

  // Walk every rail panel so all rendered copy is sampled.
  const texts = [];
  for (const t of ["Now", "Context", "Profile", "Tools", "History"]) {
    const tab = p.locator('[role="tab"]', { hasText: new RegExp(`^${t}$`) });
    if (await tab.count()) { await tab.first().click(); await p.waitForTimeout(300); }
    texts.push(await p.evaluate(`document.querySelector("main")?.innerText ?? document.body.innerText`));
  }
  const all = texts.join(" ").toLowerCase();
  const hits = BANNED.filter((w) => all.includes(w));

  const axe = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const contrast = axe.violations.filter((v) => v.id === "color-contrast");

  // Reduced-motion: every transition on the surface must be suppressible.
  const motion = await p.evaluate(`(() => {
    const els = [...document.querySelectorAll("main *")];
    const animated = els.filter((e) => {
      const cs = getComputedStyle(e);
      return cs.transitionDuration !== "0s" || cs.animationName !== "none";
    });
    return { total: els.length, animated: animated.length };
  })()`);

  console.log(`${label.padEnd(11)} banned=${hits.length ? hits.join(",") : "none"}  axe=${axe.violations.length} (contrast ${contrast.length})  animated=${motion.animated}/${motion.total}`);
  if (axe.violations.length) {
    for (const v of axe.violations) console.log(`   · ${v.id} (${v.impact}) ×${v.nodes.length} — ${v.help}`);
  }
  await ctx.close();
}

// Reduced motion honoured?
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); },
    [KEY, { state: { persona: "mentor", chatScenarioId: "active-mentorship" }, version: STORE_VERSION }]);
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/app/chat", { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  const r = await p.evaluate(`(() => {
    const els = [...document.querySelectorAll("main *")];
    const byProp = {};
    for (const e of els) {
      const cs = getComputedStyle(e);
      if (cs.transitionDuration === "0s" && cs.animationName === "none") continue;
      for (const prop of cs.transitionProperty.split(", ")) {
        byProp[prop] = (byProp[prop] ?? 0) + 1;
      }
      if (cs.animationName !== "none") byProp["@" + cs.animationName] = (byProp["@" + cs.animationName] ?? 0) + 1;
    }
    return { byProp };
  })()`);
  console.log("reduced-motion, by property:", JSON.stringify(r.byProp));
  await ctx.close();
}
await b.close();
