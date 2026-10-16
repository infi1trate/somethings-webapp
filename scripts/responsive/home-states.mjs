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
  /* ═══ THE DIRECTIVE SIGNAL IS WITHDRAWN (L.5.4) ═══
     Two checks stood here: `sequence.directive-in-name` and
     `sequence.directive-not-doubled`. Both asserted that the card the ladder
     picks SAYS SO IN WORDS — first via an `sr-only` sentence, then via the
     visible "Start here" chip K.4.2 added when the dot was removed.
     L.5.4 REMOVES THE CHIP: "It is not in the reference and was a side effect
     of the withdrawn rationale." Phase C is withdrawn, so there is no
     recommendation for a card to carry, and the claim has no subject.
     WHAT REPLACES IT IS THE ABSENCE, ASSERTED — because a chip drifting back
     in would re-import a recommendation this pack has withdrawn twice. The
     LADDER still computes and is still checked: `sequence.one-directive` above
     reads `data-directive`, and the three `ladder.*` checks below read it too.
     What is gone is the visual claim, not the derivation. */
  check(
    "sequence.no-priority-claim",
    "and no card visibly claims priority, because the recommendation is withdrawn",
    !/start here/i.test(stages.map((s) => s.name ?? "").join(" ")),
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
  /* ═══ WHICH BUTTONS TODAY MAY OWN (updated by L.3) ═══
     It was exactly one: the digest's dismissal. L.3 withdraws the digest and
     its dismiss control, and the Tasks section brings a COLLAPSE chevron.
     THE RULE IS UNCHANGED AND IS THE POINT: a control may act on this page's
     own presentation and may not act on WORK. A disclosure toggle is the same
     class as the dismissal it replaces — it touches no record. Anything not on
     this list still fails, which is what catches a disposition control
     arriving on an orienting surface. */
  check(
    "boundary.no-controls",
    "every control acts on this page's presentation, never on work",
    controls.every((c) => /dismiss|collapse|expand/i.test(c)),
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
       `src/app/(console)/app/escalation/[escalationId]/page.tsx` says so at the top.
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
  /* ═══ THE DIGEST IS WITHDRAWN; THE TASKS SECTION IS WHAT IS THERE (L.3) ═══
     This section asserted a "Since your last shift" container: that it
     rendered after a gap, carried one derived rationale line, stated a
     shown-of-total, held at most one CTA to the recommended destination, and
     was gated so it did not return inside the same shift.
     PHASE C IS WITHDRAWN ENTIRELY and FORK I-2 resolved to "no module", so the
     container, the rationale and the shift gate are all gone. L.3 replaces
     them with a labelled Tasks section that is always present.
     THREE OF THE FIVE CLAIMS SURVIVE, because they were never really about the
     container: the total is still disclosed (as a badge, per L.3.1), there is
     still at most one CTA to the destination, and there is still no form
     control. The two that die with the container are its GATING and its
     RATIONALE LINE. */
  const d = await page.evaluate(() => {
    const el = document.querySelector('[data-anno-ref="today-tasks"]');
    if (!el) return null;
    const dest = /^\/app\/(escalations|risk-flags|care-reviews)$/;
    return {
      title: el.querySelector("h2")?.textContent?.trim() ?? null,
      sub: el.querySelector("h3")?.textContent?.trim() ?? null,
      count: el.querySelector('[data-anno-ref="today-tasks-count"]')?.textContent?.trim() ?? null,
      items: [...el.querySelectorAll('[data-anno-ref="start-here-item"]')].length,
      destLinks: [...el.querySelectorAll("a")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => dest.test(h ?? "")),
      controls: [...el.querySelectorAll("input,select,textarea,form")].length,
      /* The withdrawn container's own markers must not come back. */
      rationale: !!el.querySelector('[data-anno-ref="today-rationale"]'),
      footer: /showing\s+\d+\s+of\s+\d+/i.test(el.textContent ?? ""),
    };
  });
  check("tasks.present", "the Tasks section renders", Boolean(d), d ? `${d.items} rows` : "absent");
  if (d) {
    check("tasks.titled", "titled, with a Care reviews sub-header", d.title === "Tasks" && /care review/i.test(d.sub ?? ""), `${d.title} / ${d.sub}`);
    /* I.3.1's disclosure, relocated to the badge by L.3.1 — the total is still
       on screen beside the thing it counts. */
    check("tasks.total-disclosed", "and the total is disclosed as a badge", Boolean(d.count && /^\d+$/.test(d.count)), d.count);
    check("tasks.no-footer", "with no shown-of-total footer, which L.3 removed", !d.footer, d.footer ? "footer present" : "none");
    check("tasks.no-rationale", "and no generated rationale line, which Phase C withdrew", !d.rationale, d.rationale ? "rationale present" : "none");
    check("tasks.one-cta", "at most one affordance points at the destination", d.destLinks.length <= 1, `${d.destLinks.length} · ${d.destLinks.join(" ") || "none"}`);
    check("tasks.no-controls", "and the table carries no form control of any kind", d.controls === 0, `${d.controls} controls`);
  }
  await context.close();
}
{
  /* ═══ THE SHIFT GATE IS GONE WITH THE CONTAINER (L.3) ═══
     `digest.gated` asserted the container did not return inside the same
     shift. The Tasks section is not gated on a visit — it is the page's
     content, not a greeting — so the claim has no subject. What replaces it is
     the inverse, asserted: the section is present REGARDLESS of the visit
     stamp, which is what catches the gate being reintroduced. */
  const { context, page } = await open("digest-same-shift", { seen: Date.now() - 60_000 });
  const present = await page.evaluate(() => Boolean(document.querySelector('[data-anno-ref="today-tasks"]')));
  check("tasks.not-gated", "and it is not gated on the visit stamp", present);
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
  /* ═══ THE ESCALATIONS REGION LEFT THIS PAGE (L.6) ═══
     Three checks stood here and all three were about it: that a failed
     escalation read says what is UNKNOWN rather than what failed, that each
     failed region offers its own retry (two of them), and that retrying
     restores one region and leaves the other down.
     L.6 REMOVES `EscalationStrip` FROM TODAY — with its loading state, its
     error line and its retry — so there is one degradable region left, the
     destinations. The claims are unchanged in kind and are asserted against
     it: a failure says what is unknown, it offers its own way back, and using
     it restores the region.
     THE COUNT DROPS FROM 2 TO 1 AND THAT IS THE MEASUREMENT, not a relaxation:
     there is one region that can fail. If a second returns, this number is
     what says so. */
  /* ═══ `partial` IS A NO-OP ON THIS SURFACE NOW, AND THAT IS THE FINDING ═══
     MEASURED from `homeLoadPlanFor`: `partial` returns
     `{ escalations: "error", sequence: "ready", closed: "ready" }` — the only
     region it degrades is escalations, and L.6 removed that region from Today.
     So the harness's partial state changes nothing here.
     ASSERTED RATHER THAN DELETED. If escalations returns to this page, or the
     plan is repointed at a region Today still has, this check fails and says
     so — which is the prompt to restore the real claim ("a failed read says
     what is UNKNOWN, not what failed"). That claim is still exercised, on the
     `error` plan, in the block below. */
  check(
    "state.partial-is-noop",
    "the partial plan degrades nothing on Today, because it targeted escalations",
    !/couldn['\u2019]t/.test(t),
    /couldn['\u2019]t/.test(t)
      ? JSON.stringify(t.replace(/\s+/g, " ").slice(0, 120))
      : "no region degraded"
  );
  const others = await page.evaluate(
    () => Boolean(document.querySelector('[data-anno-ref="today-hero"]'))
  );
  /* THE HERO IS THE REGION THAT MUST NOT GO DOWN WITH IT — it was
     `today-destinations`, which is now the region doing the failing. */
  check("state.partial-intact", "and the rest of the page is intact", others);
  await context.close();
}
{
  const { context, page } = await open("error", { load: "error" });
  const retry = await page.getByRole("button", { name: /^Try again$/ }).count();
  check("state.error-retry", "the failed region offers its own retry", retry >= 1, `${retry} retries`);
  await page.getByRole("button", { name: /^Try again$/ }).first().click();
  await page.waitForTimeout(400);
  const after = await mainText(page);
  /* RETARGETED WITH THE REGION. It asserted the escalation strip came back and
     another region stayed down; with one degradable region left, the claim is
     that retrying restores THAT region — the destination cards return and the
     failure sentence goes. */
  const restored =
    /Escalations/.test(after) && !/couldn['\u2019]t be summarised/.test(after);
  check(
    "state.retry-works",
    "and retrying restores it",
    restored,
    `cards back: ${restored}`
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
  /* ═══ `30-day` IS NO LONGER TREND LANGUAGE HERE (rework §6.1) ═══
     `7-day` and `30-day` were banned as WINDOW language — "flags, 30-day" is a
     rolling metric and this surface reports state, not rates. The Care Reviews
     rework makes "30-day" and "90-day" the names of two REVIEW CADENCES, taken
     from the Care page's own `STAGE_LABEL`, and the Tasks table renders them in
     its Cycle column.
     SO THE WINDOW FORMS ARE NARROWED RATHER THAN DROPPED: a rolling window
     still reads "last 30 days" / "30-day average" / "in 30 days", and those
     still fail. A bare cadence label does not. `7-day` stays banned outright —
     there is no 7-day review.
     THE REST OF THE LIST IS UNTOUCHED: streak, trend, average, comparisons,
     percentiles, ranks and uptime are all still out. */
  const banned = /\b(streak|trend|average|vs\.?\s|compared|percentile|rank(ed|ing)?|this week|last week|7-day|uptime|health)\b|\b(last|past|next|in)\s+\d+\s+days?\b|\b\d+-day\s+(average|window|rate|trend)\b/i;
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
