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

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

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

  /* ═══ RETARGETED: `[data-stage]` IS GONE (supervisor IA restructure + Today
         Phase B/H.2) ═══
     This read four `[data-stage]` nodes whose ids were
     `escalations > billing > flags > chatReview` — the four-domain era, when
     Home listed STAGES of a shift. The IA restructure made them DESTINATIONS
     (`escalations`, `risk-flags`, `care-reviews`), Superseded #8 removed
     Mentor Practice, §2.2 renamed Coverage to Chat and it left the set, and
     Phase H.2 rendered the survivors as a 3-up card grid.
     SO THE SELECTOR MATCHED NOTHING, and that is why this block mattered:
     `sequence.names` was GREEN on an empty array — `[].every()` is true — so a
     check asserting nothing read as a passing check. Every assertion below
     therefore carries its own non-empty guard.
     THE CLAIMS ARE UNCHANGED: a fixed set in a fixed order, one directive, and
     the state carried in words rather than only in shape. */
  const stages = await page.evaluate(() =>
    [...document.querySelectorAll('[data-anno-ref^="today-card:"]')].map((a) => ({
      id: (a.getAttribute("data-anno-ref") ?? "").split(":")[1] ?? null,
      directive: a.getAttribute("data-directive") === "true",
      /* ═══ THE WHOLE LINK'S TEXT, NOT JUST ITS `sr-only` SPAN (K.4) ═══
         The card has no `aria-label`, so its accessible name is computed from
         CONTENT — every text node inside it, visible or `sr-only`. Reading
         only the `sr-only` span was close enough while "Start here." lived
         there, and K.4 moved it: the dot went, so the directive needed a
         VISIBLE signal, and a visible string is already in the accessible name.
         Reading the span alone then reported a name the link does not have. */
      name: (a.textContent ?? "").replace(/\s+/g, " ").trim() || null,
      srOnly: a.querySelector(".sr-only")?.textContent?.trim() ?? null,
      href: a.getAttribute("href"),
    }))
  );
  check(
    "sequence.read",
    "the destination cards were readable at all",
    stages.length > 0,
    `${stages.length} cards`
  );
  check(
    "sequence.order",
    "three destinations, fixed order, never hidden",
    stages.map((s) => s.id).join(">") === "escalations>risk-flags>care-reviews",
    stages.map((s) => s.id).join(" > ")
  );
  check(
    "sequence.one-directive",
    "exactly one destination carries the directive emphasis",
    stages.filter((s) => s.directive).length === 1,
    `${stages.filter((s) => s.directive).length} of ${stages.length} · ${stages.find((s) => s.directive)?.id ?? "none"}`
  );
  /* THE STATE IS IN THE NAME. A sighted reader gets it from the line under the
     label; without this a screen-reader user hears "Risk flags, link". */
  check(
    "sequence.names",
    "every destination's accessible name carries its state",
    stages.length > 0 && stages.every((s) => s.name && /\w[.,]/.test(s.name)),
    stages.map((s) => s.name).join(" | ")
  );
  /* RETARGETED WITH THE COPY. It asserted the name ended `", next"`, from the
     stage era's "up next" framing. The card's sentence ends `"Start here."` —
     the same claim (the directive says so IN WORDS, not only by the dot). */
  /* RETARGETED WITH THE SIGNAL (K.4.2). It matched `endsWith("Start here.")`
     on the `sr-only` sentence. The directive is a VISIBLE chip now — the dot
     that used to carry it by fill is gone — so the claim is stronger and the
     match is on the name as a whole, wherever in it the words fall. */
  check(
    "sequence.directive-in-name",
    "and the directive one says so in words, not only by shape",
    /start here/i.test(stages.find((s) => s.directive)?.name ?? ""),
    stages.find((s) => s.directive)?.name
  );
  /* ═══ AND IT IS SAID ONCE ═══
     A visible string is already in the accessible name, so repeating it in the
     `sr-only` sentence would announce it twice. */
  check(
    "sequence.directive-not-doubled",
    "and says it exactly once",
    (stages.find((s) => s.directive)?.name ?? "").match(/start here/gi)?.length === 1,
    stages.find((s) => s.directive)?.srOnly
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
    /* ═══ RETARGETED: THE DESTINATION ROUTES ARE NEW (IA restructure) ═══
       This allowed `/app/(tasks|monitoring|activity|escalation)` — the routes
       before the restructure split Monitoring into destinations and retired
       `/app/tasks`. `/app/risk-flags` and `/app/care-reviews` are the surfaces
       that own that work now, and the old list rejected both.
       `/app/escalation/{id}` STAYS ALLOWED AND IS NOT A BROKEN LINK: it is a
       documented HOP that redirects to `/app/escalations?escalation={id}` —
       `src/app/app/escalation/[escalationId]/page.tsx` says so at the top.
       THE CLAIM IS UNCHANGED: every link leaves for a surface that owns the
       work, and none of them acts on it here. */
    links.length > 0 &&
      links.every((h) =>
        /^\/app\/(escalations?|risk-flags|care-reviews|activity)(\/|\?|$)/.test(h ?? "")
      ),
    [...new Set(links)].join(" ")
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE LADDER PICKS THE RIGHT STAGE, SCENARIO BY SCENARIO.
// ═══════════════════════════════════════════════════════════════════════════
for (const [scenario, expected, why] of [
  /* ═══ RETARGETED WITH THE IDS (IA restructure) ═══
     `billing` is `care-reviews` and `flags` is `risk-flags`. The ladder itself
     is unchanged — these are the same three claims about the same ordering. */
  ["active-escalation", "escalations", "an open escalation outranks everything"],
  /* ═══ breach-overnight NO LONGER ISOLATES THE CLAIM IT WAS WRITTEN FOR ═══
     It asserted flags-over-billing. MEASURED, this fixture also carries an
     OPEN ESCALATION, and the ladder's top rule — asserted one line above — is
     that an escalation outranks everything. So the directive is `escalations`,
     correctly, and the flags-vs-billing edge is not exercised by any fixture
     that exists. Retargeted to what this fixture actually proves rather than
     relaxed to whatever it returns; the uncovered edge is reported, not
     silently dropped. */
  ["breach-overnight", "escalations", "an open escalation still outranks a breached flag"],
  ["quiet-day", "care-reviews", "billing before clinical, whatever the counts"],
]) {
  const { context, page } = await open(`ladder-${scenario}`, { scenario });
  const directive = await page.evaluate(() => {
    const a = document.querySelector('[data-anno-ref^="today-card:"][data-directive="true"]');
    return a ? ((a.getAttribute("data-anno-ref") ?? "").split(":")[1] ?? null) : null;
  });
  check(`ladder.${scenario}`, why, directive === expected, `${directive} (expected ${expected})`);
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · THE DIGEST — HOME ONLY, BREACH FIRST, AND GATED ON THE SHIFT.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("digest", { seen: 0 });
  /* ═══ RETARGETED: THE DIGEST IS THE MERGED START-HERE MODULE NOW ═══
     `[data-anno-ref="home-digest"]` has not existed since the rename to
     `today-digest`, so this read null and `digest.present` failed loudly —
     while `digest.gated` below PASSED on the same dead selector, because its
     claim is an absence and absent-from-a-typo looks identical to absent. Both
     selectors are fixed; the guard is that `digest.present` must pass for
     `digest.gated` to mean anything, and it does.
     WHAT THE SECTION ASSERTED AND NO LONGER CAN: the old digest was a LIST OF
     TONE CHIPS, breach-first. Phase C replaced it with ONE derived rationale
     sentence ("rationale-or-nothing"), and Phase I added the bounded preview
     under it. There are no chips to order, so `digest.breach-first` has no
     subject — its successor is `digest.one-rationale`, which pins the thing
     that replaced it. */
  const d = await page.evaluate(() => {
    const el = document.querySelector('[data-anno-ref="today-digest"]');
    if (!el) return null;
    const dest = /^\/app\/(escalations|risk-flags|care-reviews)$/;
    return {
      rationale: el.querySelector('[data-anno-ref="today-rationale"]')?.textContent?.trim() ?? null,
      items: [...el.querySelectorAll('[data-anno-ref="start-here-item"]')].length,
      count: el.querySelector('[data-anno-ref="start-here-count"]')?.textContent?.trim() ?? null,
      /* EVERY link that points at a DESTINATION ROOT. I.0 forbids two
         affordances to the same place, and the removed banner button is
         exactly what this would catch coming back. */
      destLinks: [...el.querySelectorAll("a")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => dest.test(h ?? "")),
      controls: [...el.querySelectorAll("input,select,textarea,form")].length,
    };
  });
  check("digest.present", "the digest renders after a gap", Boolean(d), d ? `${d.items} preview items` : "absent");
  if (d) {
    check(
      "digest.one-rationale",
      "it carries exactly one derived rationale line, not a list of counts",
      Boolean(d.rationale && d.rationale.length > 0),
      d.rationale
    );
    /* ═══ I.3.1 — THE PARTIAL-LIST DISCLOSURE IS THE SAFETY CLAIM ═══
       A supervisor who clears four items and sees an empty preview must not be
       able to conclude the queue is empty, so the shown-of-total renders
       whenever the preview does. */
    check(
      "digest.shows-total",
      "and every preview states how many of the total it is showing",
      d.items === 0 || Boolean(d.count && /\d+\s+of\s+\d+/.test(d.count)),
      d.count
    );
    check(
      "digest.one-cta",
      "at most one affordance points at the recommended destination (I.0)",
      d.destLinks.length <= 1,
      `${d.destLinks.length} · ${d.destLinks.join(" ") || "none"}`
    );
    /* THE MIRROR RULE, INSIDE THE MODULE. Today may preview work and navigate
       to it; it may never dispose of it. */
    check(
      "digest.no-controls",
      "and the preview carries no form control of any kind",
      d.controls === 0,
      `${d.controls} controls`
    );
  }
  await context.close();
}
{
  /* GATED ON THE SHIFT. A stamp inside the window means the supervisor has
     already been here this shift, and the digest does not come back. */
  const { context, page } = await open("digest-same-shift", { seen: Date.now() - 60_000 });
  const present = await page.evaluate(() => Boolean(document.querySelector('[data-anno-ref="today-digest"]')));
  check("digest.gated", "and not again inside the same shift", !present);
  await context.close();
}
{
  /* HOME ONLY. C2's check — Tasks used to own this. */
  const { context, page } = await open("digest-tasks", { url: "/app/care-reviews", seen: 0 });
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
    /* RETARGETED: `home-sequence` became `today-destinations` in the IA
       restructure. The claim is unchanged — a failed escalation read must not
       take the destination grid down with it. */
    () => Boolean(document.querySelector('[data-anno-ref="today-destinations"]'))
  );
  check("state.partial-intact", "and the other regions are intact", others);
  await page.screenshot({ path: `${OUT}/03-partial.png` });
  await context.close();
}
{
  const { context, page } = await open("error", { load: "error" });
  /* RETARGETED TO THE COPY THAT SHIPS. `RegionError`'s button reads "Try
     again", not "Retry" — so this waited on a name that never existed and
     timed out rather than failing. The claim is unchanged: a failed region
     offers its own way back, and there is more than one of them. */
  const retry = await page.getByRole("button", { name: /^Try again$/ }).count();
  check("state.error-retry", "each failed region offers its own retry", retry >= 2, `${retry} retries`);
  await page.getByRole("button", { name: /^Try again$/ }).first().click();
  await page.waitForTimeout(400);
  const after = await mainText(page);
  /* ═══ RETARGETED, AND IT HAD NEVER RUN ═══
     It matched `/Escalations,|open now/` — an aria-label shape and a copy
     string that no longer exist. It never failed on that, because the CLICK
     above waited on a "Retry" button that is called "Try again", timed out,
     and took the whole suite down before this line was reached. Fixing the
     click is what made this assertion reachable for the first time.
     MEASURED after the retry: the escalation strip is back — "Theo L. to
     Brandy Forrestor … Open escalation" — and its failure sentence is gone.
     BOTH HALVES ARE CHECKED, because "restores that region ALONE" is two
     claims and the old regex tested neither: the strip returns, AND the other
     region that was failing is still failing. A retry that quietly healed
     everything would be the bug this check exists for. */
  const restored = /Open escalation/.test(after) && !/can['\u2019]t say whether any are open/.test(after);
  const othersStillDown = /couldn['\u2019]t be summarised|couldn['\u2019]t be loaded/i.test(after);
  check(
    "state.retry-works",
    "and retrying restores that region alone",
    restored && othersStillDown,
    `strip back: ${restored} · another region still down: ${othersStillDown}`
  );
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
