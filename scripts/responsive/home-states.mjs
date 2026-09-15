// ═══ HOME — THE SHIFT SURFACE, STATE BY STATE (arch-C) ═══
//
// Home's claim is structural: it MODELS a shift and HOSTS no work. Both halves
// need asserting, and the second one is the easy thing to lose — every count on
// this page is one link away from a surface where the same number is
// actionable, and the difference between a link and a control is invisible in a
// screenshot.
//
// Exit codes: 0 every check passed · 1 a check failed.

import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/home";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;
function check(id, label, ok, detail) {
  rows.push({ id, label, ok: !!ok, detail });
  if (!ok) failed += 1;
  console.log(`  ${ok ? "✓" : "×"} ${id.padEnd(28)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function open(id, { scenario = "typical-shift", load = "ready", seen = 0, persona = "supervisor", url = "/app/home" } = {}) {
  return openView(
    browser,
    {
      id,
      url,
      seed: {
        persona,
        extra: { tasksScenarioId: scenario, devLoadState: load, shiftLastSeenAt: seen },
      },
    },
    XL,
    version
  );
}

const mainText = (page) => page.locator("main").innerText();

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE SURFACE, AND THE SHELL IT INHERITED WRONG.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("shell");
  const shell = await page.locator("nav[aria-label]").first().getAttribute("aria-label");
  /* BEFORE arch-C: `/app/[section]` hardcoded `MentorShell`, so a supervisor's
     Home sat in a landmark announced as "Mentor navigation" — measured on all
     four personas. The URL had moved and the chrome had not. */
  check("shell.supervisor", "a supervisor's Home is in the supervisor's chrome", shell === "Supervisor sections", shell);

  const stages = await page.evaluate(() =>
    [...document.querySelectorAll("[data-stage]")].map((e) => ({
      id: e.getAttribute("data-stage"),
      directive: e.getAttribute("data-directive") === "true",
      name: e.querySelector("a")?.getAttribute("aria-label") ?? e.getAttribute("aria-label"),
      href: e.querySelector("a")?.getAttribute("href") ?? null,
    }))
  );
  check(
    "sequence.order",
    "four stages, fixed order, never hidden",
    stages.map((s) => s.id).join(">") === "escalations>billing>flags>chatReview",
    stages.map((s) => s.id).join(" > ")
  );
  check(
    "sequence.one-directive",
    "exactly one stage carries the directive emphasis",
    stages.filter((s) => s.directive).length === 1,
    stages.find((s) => s.directive)?.id
  );
  /* THE STATE IS IN THE NAME. A sighted reader gets it from the line under the
     label; without this a screen-reader user hears "Risk flags, link". */
  check(
    "sequence.names",
    "every stage's accessible name carries its state",
    stages.every((s) => s.name && s.name.includes(",")),
    stages[2]?.name
  );
  check(
    "sequence.directive-in-name",
    "and the directive one says so in words, not only by shape",
    stages.find((s) => s.directive)?.name?.endsWith(", next"),
    stages.find((s) => s.directive)?.name
  );
  await page.screenshot({ path: `${OUT}/01-shift.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · HOME HOSTS NO WORK.
// ═══════════════════════════════════════════════════════════════════════════
//
// The boundary this phase exists to hold. Every interactive thing on the page
// must be a link OUT or a dismissal — never a control that could change a task.
{
  const { context, page } = await open("boundary");
  const controls = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main [role='button'], main input, main select, main textarea")].map(
      (e) => (e.getAttribute("aria-label") || e.innerText || e.tagName).replace(/\s+/g, " ").trim().slice(0, 40)
    )
  );
  /* The ONLY button Home may own is the digest's dismissal. Anything else is a
     control that could act on work, which belongs on Tasks or Monitoring. */
  check(
    "boundary.no-controls",
    "the only control is the digest's dismissal",
    controls.every((c) => /dismiss/i.test(c)),
    controls.join(" | ") || "none"
  );
  const lists = await page.evaluate(() =>
    document.querySelectorAll("main [role='tree'], main [role='listbox'], main [role='treeitem']").length
  );
  check("boundary.no-queue", "no list, tree or queue is rendered", lists === 0, `${lists} found`);

  const links = await page.evaluate(() =>
    [...document.querySelectorAll("main a")].map((a) => a.getAttribute("href"))
  );
  check(
    "boundary.links-out",
    "every link leaves for a surface that owns the work",
    links.length > 0 && links.every((h) => /^\/app\/(tasks|monitoring|activity|escalation)/.test(h ?? "")),
    [...new Set(links)].join(" ")
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE LADDER PICKS THE RIGHT STAGE, SCENARIO BY SCENARIO.
// ═══════════════════════════════════════════════════════════════════════════
for (const [scenario, expected, why] of [
  ["active-escalation", "escalations", "an open escalation outranks everything"],
  ["breach-overnight", "flags", "a breached imminent flag outranks billing past SLA"],
  ["quiet-day", "billing", "billing before clinical, whatever the counts"],
]) {
  const { context, page } = await open(`ladder-${scenario}`, { scenario });
  const directive = await page.evaluate(
    () => document.querySelector('[data-directive="true"]')?.getAttribute("data-stage")
  );
  check(`ladder.${scenario}`, why, directive === expected, `${directive} (expected ${expected})`);
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · THE DIGEST — HOME ONLY, BREACH FIRST, AND GATED ON THE SHIFT.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("digest", { seen: 0 });
  const d = await page.evaluate(() => {
    const el = document.querySelector('[data-anno-ref="home-digest"]');
    if (!el) return null;
    const chips = [...el.querySelectorAll("li a")].map((a) => ({
      text: a.innerText.replace(/\s+/g, " ").trim(),
      tone: a.getAttribute("data-tone"),
    }));
    /* THE CTA BY ITS TEXT, not by a class fragment. `a[class*='bg-']` matched
       the first breach CHIP, which also carries a background — so the check
       reported the chip's text as the CTA and would have passed with no CTA at
       all. */
    const cta = [...el.querySelectorAll("a")].map((a) => a.innerText.trim()).find((t) => /^Start with /.test(t));
    return { chips, cta };
  });
  check("digest.present", "the digest renders after a gap", Boolean(d));
  if (d) {
    /* ═══ BREACH LINES FIRST, ALWAYS ═══
       Not sorted by count and not in stage order. A digest that opened with "26
       clinical" and buried "2 imminent past 24h" would hide the only part worth
       reading in the first two seconds.
       READ FROM `data-tone`, NOT FROM A COMPUTED BACKGROUND. The first version
       compared each chip's background against the first and last chip's, which is
       SYMMETRIC — reversing the order produced the same answer and the check
       passed with the digest ordered exactly backwards. A mutation run caught it.
       A tone the component declares cannot be read two ways. */
    const tones = d.chips.map((c) => c.tone);
    const lastBreach = tones.lastIndexOf("breach");
    const firstNeutral = tones.findIndex((t) => t !== "breach");
    check(
      "digest.breach-first",
      "breach lines come before any neutral count",
      tones.includes("breach") &&
        firstNeutral >= 0 &&
        lastBreach < firstNeutral,
      d.chips.map((c) => `${c.tone}:${c.text}`).join(" | ")
    );
    check("digest.one-cta", "one primary CTA, naming where it goes", Boolean(d.cta), d.cta);
  }
  await context.close();
}
{
  /* GATED ON THE SHIFT. A stamp inside the window means the supervisor has
     already been here this shift, and the digest does not come back. */
  const { context, page } = await open("digest-same-shift", { seen: Date.now() - 60_000 });
  const present = await page.evaluate(() => Boolean(document.querySelector('[data-anno-ref="home-digest"]')));
  check("digest.gated", "and not again inside the same shift", !present);
  await context.close();
}
{
  /* HOME ONLY. C2's check — Tasks used to own this. */
  const { context, page } = await open("digest-tasks", { url: "/app/tasks", seen: 0 });
  const t = await mainText(page);
  check("digest.tasks-clean", "Tasks renders no digest", !/Since your last shift/.test(t));
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · STATES.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("allclear", { scenario: "quiet-day", seen: Date.now() });
  const t = await mainText(page);
  check(
    "state.allclear-plain",
    "an all-clear Home says what is true and does not celebrate",
    !/(nice work|great|well done|!|🎉)/i.test(t),
    t.replace(/\s+/g, " ").slice(0, 70)
  );
  await page.screenshot({ path: `${OUT}/02-quiet.png` });
  await context.close();
}
{
  const { context, page } = await open("partial", { load: "partial" });
  const t = await mainText(page);
  /* THE ONE REGION THAT CANNOT QUIETLY GO MISSING. An absent strip means "nobody
     is in danger", which must never be asserted from an outage. */
  /* THE SECOND CLAUSE WAS WRONG, not the app: it looked for "Shift sequence" and
     "Escalations," in `innerText`, and both are ARIA LABELS — invisible to a text
     read. The sequence's survival is asserted structurally in the next check;
     this one asserts only what the failed region says. */
  check(
    "state.partial",
    "a failed escalation read says what is unknown, not what failed",
    /can['\u2019]t say whether any are open/.test(t) && !/Couldn['\u2019]t load escalations/.test(t),
    t.split("\n").find((l) => /couldn['\u2019]t be loaded/.test(l))?.slice(0, 70)
  );
  const others = await page.evaluate(
    () => Boolean(document.querySelector('[data-anno-ref="home-sequence"]'))
  );
  check("state.partial-intact", "and the other regions are intact", others);
  await page.screenshot({ path: `${OUT}/03-partial.png` });
  await context.close();
}
{
  const { context, page } = await open("error", { load: "error" });
  const retry = await page.getByRole("button", { name: /^Retry$/ }).count();
  check("state.error-retry", "each failed region offers its own retry", retry >= 2, `${retry} retries`);
  await page.getByRole("button", { name: /^Retry$/ }).first().click();
  await page.waitForTimeout(400);
  const after = await mainText(page);
  check("state.retry-works", "and retrying restores that region alone", /Escalations,|open now/.test(after));
  await page.screenshot({ path: `${OUT}/04-error.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · NOTHING COMPARATIVE, NO TREND, NO PLATFORM HEALTH.
// ═══════════════════════════════════════════════════════════════════════════
//
// A chart of whether a supervisor kept pace is a performance surface, and the
// punitive dimension of this role is a known sensitivity. Asserted rather than
// promised, because the pressure to add one arrives later and quietly.
{
  const { context, page } = await open("no-metrics");
  const t = await mainText(page);
  const banned = /\b(streak|trend|average|vs\.?\s|compared|percentile|rank(ed|ing)?|this week|last week|7-day|30-day|uptime|health)\b/i;
  check("scope.no-trend", "no trend, streak or comparative language", !banned.test(t), (t.match(banned) ?? [])[0]);
  const charts = await page.evaluate(
    () => document.querySelectorAll("main svg[role='img'], main canvas, main [data-chart]").length
  );
  check("scope.no-charts", "and no chart of any kind", charts === 0, `${charts} found`);
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · OTHER PERSONAS ARE UNTOUCHED.
// ═══════════════════════════════════════════════════════════════════════════
for (const persona of ["mentor", "lead-mentor"]) {
  const { context, page } = await open(`persona-${persona}`, { persona });
  const t = await mainText(page);
  check(
    `persona.${persona}`,
    "sees the unbuilt-section placeholder, not the shift surface",
    /Nothing here yet/.test(t) && !/Your shift/.test(t)
  );
  await context.close();
}

await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
