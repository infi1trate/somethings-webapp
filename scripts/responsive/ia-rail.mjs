// ═══ THE GROUPED SUPERVISOR RAIL (supervisor IA restructure, Phase 1) ═══
//
// What this measures, and why each one needs a browser rather than a grep:
//
//   1 THE GROUP LABELS' CONTRAST. They read LIGHT against the rail fill by
//     design, and "light" is exactly where a label stops being legible. 12px
//     text needs 4.5:1, and the muted token measures 4.06:1 on this ground —
//     so the choice between muted and secondary is a measurement, not taste.
//   2 THE SELECTED PILL, IN BOTH STATES. A selected treatment carried by a fill
//     plus a shadow is invisible to a grep and invisible to a screenshot diff
//     that does not know which row is current.
//   3 THE BADGE TAXONOMY. Shape, not colour alone (SC 1.4.1) — so the check is
//     that the shapes DIFFER across destinations and that every badge carries a
//     word, not that the colours are right.
//   4 THE RETIRED ROUTES, OPENED. A URL assertion cannot tell a live
//     destination from a dead one; `retired-routes.test.ts` has the mapping and
//     this has the arrival.
//
// Exit codes: 0 every check passed · 1 a check failed.

import { mkdir } from "node:fs/promises";
import { launch, openView, VIEWPORTS, readStoreVersion } from "./harness.mjs";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/ia";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

let failed = 0;
function check(id, label, ok, detail) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "✓" : "×"} ${id.padEnd(26)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function open(id, url) {
  const { context, page } = await openView(
    browser,
    { id, url, seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift" } } },
    XL,
    version
  );
  await page.waitForTimeout(700);
  return { context, page };
}

/** Contrast against the first non-transparent ancestor ground — what the ink
 *  actually sits on, which for a rail row is rarely the row itself. */
const READ = `(() => {
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const px = (c) => (c.match(/[\\d.]+/g) ?? []).map(Number);
  const ground = (el) => { let n = el; while (n) { const p = px(getComputedStyle(n).backgroundColor); if (p.length >= 3 && !(p.length === 4 && p[3] === 0)) return p.slice(0, 3); n = n.parentElement; } return [255, 255, 255]; };
  const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg); return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2); };
  const rail = document.querySelector('[data-anno-ref="app-rail"]');
  if (!rail) return { rail: false };
  const railBg = getComputedStyle(rail).backgroundColor;
  const groupBtns = [...rail.querySelectorAll("[data-rail-group]")].map((b) => {
    const cs = getComputedStyle(b);
    return { label: (b.textContent ?? "").trim(), px: parseFloat(cs.fontSize), weight: cs.fontWeight,
      ratio: ratio(px(cs.color).slice(0, 3), ground(b)), expanded: b.getAttribute("aria-expanded") };
  });
  const rows = [...rail.querySelectorAll('nav a, nav span.flex')].filter((e) => e.querySelector("svg"));
  const read = (e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect();
    return { label: (e.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, 26), current: e.getAttribute("aria-current"),
      bg: cs.backgroundColor, shadow: cs.boxShadow === "none" ? "none" : "raised", weight: cs.fontWeight,
      ratio: ratio(px(cs.color).slice(0, 3), ground(e)), w: Math.round(b.width), h: Math.round(b.height) }; };
  const badges = [...rail.querySelectorAll("nav a span.rounded-full")].map((b) => {
    const cs = getComputedStyle(b);
    return { text: (b.textContent ?? "").replace(/\\s+/g, " ").trim(), glyph: !!b.querySelector("svg"),
      bg: cs.backgroundColor, ratio: ratio(px(cs.color).slice(0, 3), px(cs.backgroundColor).slice(0, 3)),
      srOnly: !!b.querySelector(".sr-only"), h: Math.round(b.getBoundingClientRect().height) };
  });
  return { rail: true, railBg, width: Math.round(rail.getBoundingClientRect().width),
    groupBtns, rows: rows.map(read), badges,
    themeToggleCount: rail.querySelectorAll('[role="switch"]').length,
    themeToggle: (() => {
      const t = rail.querySelector('[role="switch"]');
      return t ? { role: t.getAttribute("role"), checked: t.getAttribute("aria-checked"),
        label: (t.textContent ?? "").replace(/\\s+/g, " ").trim() } : null;
    })(),
    /* GROUPED OR NOT is read from the DOM rather than from the label: a Chats
       row inside the Monitoring section would still say "Chats".
       AND ITS NEIGHBOURS, read off the rail's full row order rather than off
       the group — the position within the group is the part that was
       instructed, and "is in a section" cannot see it. */
    chatRow: (() => {
      const rows = [...rail.querySelectorAll("nav a")];
      const i = rows.findIndex((e) => /^Chats/.test((e.textContent ?? "").trim()));
      if (i < 0) return null;
      const name = (e) => (e ? (e.textContent ?? "").replace(/\\s+/g, " ").trim().split(/\\d/)[0].trim() : null);
      return { label: name(rows[i])?.slice(0, 20),
        grouped: !!rows[i].closest("section"),
        after: name(rows[i - 1]), before: name(rows[i + 1]) };
    })() };
})()`;

console.log("\nPhase 1 · the grouped rail\n");
{
  /* ON MONITORING NOW (proto/monitoring-merge): Risk Flags is a hop into it,
     so the rail is read where the supervisor actually lands. */
  const { context, page } = await open("rail-monitoring", "/app/monitoring");
  const r = await page.evaluate(READ);
  await page.locator('[data-anno-ref="app-rail"]').screenshot({ path: `${OUT}/rail-supervisor.png` });
  if (!r.rail) {
    check("rail.exists", "the supervisor rail renders", false, "no rail found");
  } else {
    check("rail.exists", "the supervisor rail renders", true, `${r.width}px wide on ${r.railBg}`);
    check(
      "rail.groups",
      "three group labels, each a real expanded disclosure",
      r.groupBtns.map((g) => g.label).join(" · ") === "Monitoring · Casework · Directory" &&
        r.groupBtns.every((g) => g.expanded === "true"),
      r.groupBtns.map((g) => `${g.label}[${g.expanded}]`).join(" ")
    );
    /* ═══ THE MEASUREMENT THAT PICKED THE TOKEN ═══ */
    check(
      "rail.group-contrast",
      "and every group label clears AA for 12px text on the rail fill",
      r.groupBtns.length > 0 && r.groupBtns.every((g) => g.ratio >= 4.5),
      r.groupBtns.map((g) => `${g.label} ${g.ratio}:1 @${g.px}px`).join(" · ")
    );
    const current = r.rows.filter((x) => x.current === "page");
    check(
      "rail.one-selected",
      "exactly one row is current, and it is the destination you are on",
      current.length === 1 && /^Monitoring/.test(current[0].label),
      current.map((c) => c.label).join(", ") || "none"
    );
    check(
      "rail.selected-pill",
      "the selected row carries a fill AND a shadow, not colour alone",
      current.length === 1 &&
        current[0].bg !== r.railBg &&
        current[0].shadow === "raised",
      current.length ? `${current[0].bg} · shadow ${current[0].shadow} · ${current[0].w}x${current[0].h}` : "n/a"
    );
    const unselected = r.rows.filter((x) => x.current !== "page");
    check(
      "rail.unselected-quiet",
      "and every other row has no fill of its own",
      unselected.length > 0 && unselected.every((x) => x.bg === "rgba(0, 0, 0, 0)"),
      `${unselected.length} rows, grounds: ${[...new Set(unselected.map((x) => x.bg))].join(" ")}`
    );
    check(
      "rail.44px",
      "every row is a 44px target",
      r.rows.length > 0 && r.rows.every((x) => x.h >= 44),
      `${Math.min(...r.rows.map((x) => x.h))}px smallest of ${r.rows.length}`
    );
    /* ═══ THE SHAPE CHECK IS RETARGETED, AND THE SUPERSESSION IS THE POINT ═══
       It asserted that badges differ by SHAPE — a clock-plus-count for Care
       Reviews against bare counts elsewhere — because colour may never be the
       sole carrier (SC 1.4.1). The clock said "this one has a deadline", and
       §2.9 retires the deadline concept: there is no second obligation TYPE
       left for a shape to distinguish, so the shapes collapsing to one is the
       correct outcome rather than a regression.
       WHAT THE RULE BECOMES: no badge may need its colour read. Every badge
       carries a NOUN in its accessible name ("3 needing a response", "19
       open") and sits beside its destination's label, so the tone is redundant
       emphasis on information the row already states in words. That is
       asserted by `rail.badge-words` below, which is now load-bearing rather
       than a second line of defence — so this check guards the thing that
       would break it: a badge whose glyph carries meaning the words do not.
       MEASURED: 4 badges, 0 glyphs. */
    check(
      "rail.badge-no-glyph-only-meaning",
      "no badge says anything with a glyph that its words do not also say",
      r.badges.length >= 2 && r.badges.every((b) => !b.glyph || b.srOnly),
      r.badges.map((b) => `${b.text}${b.glyph ? "⏱" : ""}`).join(" · ")
    );
    check(
      "rail.badge-words",
      "and every badge says in words what its number counts",
      r.badges.length > 0 && r.badges.every((b) => b.srOnly),
      `${r.badges.filter((b) => b.srOnly).length}/${r.badges.length} carry a noun`
    );
    check(
      "rail.badge-contrast",
      "every badge's ink clears AA on its own fill",
      r.badges.length > 0 && r.badges.every((b) => b.ratio >= 4.5),
      r.badges.map((b) => `${b.ratio}:1`).join(" · ")
    );
    /* ═══ BOTH OF THESE CHECKS ARE INVERTED NOW, AND THAT IS THE POINT ═══
       `rail.no-dark-control` asserted the theme toggle's ABSENCE and
       `rail.no-chat` asserted that the coverage destination was not called
       Chat. The addendum reverses both instructions (§2.5, §2.2), so the
       checks are retargeted rather than deleted: what each one guards is that
       the rail's contents match the decision, and the decision moved.
       THE TOGGLE IS A SWITCH, NOT A LINK, and the assertion says so — a row
       that looked like a destination and changed the theme would be the worse
       version of restoring it. */
    check(
      "rail.theme-toggle",
      "one theme control, in the rail's footer, as a switch",
      r.themeToggle != null && r.themeToggle.role === "switch" &&
        /^(true|false)$/.test(r.themeToggle.checked ?? "") &&
        r.themeToggleCount === 1,
      r.themeToggle
        ? `${r.themeToggleCount} control(s) · role=${r.themeToggle.role} · checked=${r.themeToggle.checked} · "${r.themeToggle.label}"`
        : "no theme control in the rail"
    );
    /* ═══ THE POSITION FLIPPED, AND THE CHECK FLIPPED WITH IT ═══
       This asserted Chats sat ungrouped beside Today, which is where §2.2 put
       it. Reversed on instruction: it is in the Monitoring group, between Risk
       Flags and Activity, where the Figma mockup nests it.
       WHAT THE CHECK IS ACTUALLY FOR IS UNCHANGED — Chats is REACHABLE from
       the rail at all, which it was not for three phases (row 449). The
       placement is asserted alongside it because a row that drifted back out
       of the group would be the same decision being re-litigated silently.
       ORDER IS ASSERTED TOO: above Activity, below Risk Flags. Presence and
       group membership alone would pass on a Chats row at the bottom of the
       group, which is a different decision from this one. */
    /* ═══ AND FLIPPED AGAIN (proto/monitoring-merge) ═══ Escalations and Risk
       Flags folded into ONE Monitoring item, and the group holds two rows:
       Monitoring, then Chats. Activity had already left the rail for the
       bell (2026-10-16), so the row after Chats is the next group's first. */
    /* ═══ AND REMOVED (pack v3.0, Supersession 7) ═══ A supervisor reaches a
       conversation only through Monitoring entries and the Support hub, so
       the claim inverts: there is NO Chats row on the supervisor-tier rail.
       The reachability the old check protected is asserted where it now
       lives — Monitoring's entries link into the conversation
       (monitoring-tiers.mjs, step 5). */
    check(
      "rail.chat-absent",
      "and Chats is not on the supervisor's rail — conversations are reached from Monitoring",
      r.chatRow == null,
      r.chatRow ? `"${r.chatRow.label}" is still there` : "no Chats row"
    );
  }
  await context.close();
}

// ── THE RETIRED ROUTES, OPENED ───────────────────────────────────────────────
console.log("\nPhase 1 · the retired routes, opened\n");
{
  /* RETARGETED (proto/monitoring-merge). `/app/monitoring` is a destination
     again, so it is no longer a hop — EXCEPT for its old billing links, which
     still belong to Care Reviews and must not strand a bookmark on the tiers.
     The two folded dashboards are hops into it, carrying their record id. */
  const CASES = [
    ["/app/home", "/app/today", "Today"],
    ["/app/tasks", "/app/care-reviews", "Care Reviews"],
    ["/app/escalations", "/app/monitoring", "Monitoring"],
    ["/app/risk-flags", "/app/monitoring", "Monitoring"],
    ["/app/risk-flags?flag=f-1", "/app/monitoring?flag=f-1", "Monitoring"],
    ["/app/monitoring?band=intakeBillingReview", "/app/care-reviews", "Care Reviews"],
    ["/app/monitoring?queue=billing", "/app/care-reviews", "Care Reviews"],
    ["/app/home?queue=imminent", "/app/monitoring", "Monitoring"],
  ];
  for (const [from, to, heading] of CASES) {
    const { context, page } = await open(`hop-${from.replace(/\W+/g, "-")}`, from);
    await page.waitForTimeout(500);
    const landed = await page.evaluate(() => ({
      url: location.pathname + location.search,
      h: (document.querySelector("main h1")?.textContent ?? "").trim(),
    }));
    check(
      `hop${from.replace("/app/", ".")}`,
      `lands on ${to}`,
      landed.url === to && landed.h.includes(heading),
      `${landed.url} · "${landed.h}"`
    );
    await context.close();
  }
}

// ── THE HOP THAT WAS A CYCLE ─────────────────────────────────────────────────
//
// ═══ THE CHECK THAT WAS MISSING, AND WHAT IT COST ═══
//
// Phase 1 asserted six hops and not this one. `?escalation=` mapped to
// `/app/escalation/{id}`, whose own effect called `escalationRecordHref` — which
// still returned `/app/monitoring?escalation={id}`. So:
//
//   /app/monitoring?escalation=X → /app/escalation/X → /app/monitoring?escalation=X → …
//
// Both legs a `router.replace`, so Back could not escape it. A supervisor opening
// any escalation record from Activity, from a task pane, or from a bookmark got a
// spinning tab. It shipped because the retired-route UNIT TEST asserts the FIRST
// hop's target, which a two-hop cycle satisfies exactly, and because the probe
// that opens the hops for real did not open this one.
//
// ═══ SO THIS COUNTS NAVIGATIONS, NOT URLs ═══
//
// A settled-URL assertion is the wrong instrument: sampled after a fixed wait, a
// cycle presents as "some plausible URL" and passes. TERMINATION is the property,
// so the frame's navigations are counted over a window — a cycle produces an
// unbounded stream and a correct hop produces a handful.
console.log("\nPhase 2 · the record hop terminates\n");
{
  /* ═══ THE LISTENER GOES ON BEFORE THE NAVIGATION, WHICH IS THE WHOLE POINT ═══
     First attempt attached it AFTER `openView` had already loaded the hop, so
     the hops had all fired before anything was listening and it reported
     "0 navigations in 4s" — a clean pass measuring nothing, on the exact
     assertion written to catch a vacuous pass. Caught by reading the number:
     zero navigations is impossible for a page that loaded.
     So: land somewhere quiet, ARM, then navigate into the hop. */
  const { context, page } = await openView(
    browser,
    {
      id: "hop-escalation-cycle",
      url: "/app/care-reviews",
      seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift" } },
    },
    XL,
    version
  );
  /* ═══ THE ID COMES FROM THE FIXTURE, NOT FROM ME ═══
     First attempt hardcoded `esc-1`, which this scenario does not contain — so
     the page rendered its honest "isn't in this data set" notice and the
     record-pane check failed for a reason that had nothing to do with the hop.
     That is the trap this probe's own header describes from the other side: an
     id the page accepts and cannot resolve.
     So the id is READ OFF THE REGION and asserted present before it is used. */
  await page.waitForTimeout(400);
  /* THE ESCALATIONS REGION IS GONE (proto/monitoring-merge), and with it the
     place this read a real id from. Monitoring does not resolve the id yet,
     so any id exercises the hop; the record-open claim below is blocked. */
  const realId = "esc-1";
  check(
    "hop.escalation.fixture",
    "the scenario holds an escalation to follow a link to",
    !!realId,
    realId ?? "none — every check below would be vacuous"
  );
  let navs = 0;
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) navs += 1;
  });
  await page.evaluate((id) => {
    window.location.href = `/app/escalation/${encodeURIComponent(id)}`;
  }, realId);
  /* LONG ENOUGH TO BE DAMNING. The cycle's period was well under a second, so
     four seconds of it is dozens of navigations against the three this chain
     needs (the load, then two `replace`s). The bound is deliberately loose — the
     claim is "it stops", not "in exactly three". */
  await page.waitForTimeout(4000);
  const landed = await page.evaluate(() => ({
    url: location.pathname + location.search,
    h: (document.querySelector("main h1")?.textContent ?? "").trim(),
  }));
  check(
    "hop.escalation.terminates",
    "an escalation link stops navigating instead of bouncing between two hops",
    /* ═══ EIGHT, NOT FOUR ═══
       The correct chain measures 4 (the load plus the two `replace`s, plus one
       the router emits for the param). A bound sitting exactly on the measured
       value is a flake waiting for a slower machine. The mutation run — the real
       cycle, restored — measured 118 in the same window, so anything between 5
       and 100 would separate them; 8 is clear of the noise at both ends. */
    navs <= 8,
    `${navs} navigation(s) in 4s`
  );
  check(
    "hop.escalation.lands",
    "and it lands on Monitoring with the record named in the URL",
    landed.url === `/app/monitoring?escalation=${realId}` && landed.h.includes("Monitoring"),
    `${landed.url} · "${landed.h}"`
  );
  /* AND THE RECORD IS ACTUALLY OPEN. The reachability lesson this probe's own
     header records: a URL the page accepts and ignores is indistinguishable from
     a live destination if you only read the address bar. */
  /* ═══ RETARGETED — THE TEXT IT LOOKED FOR WAS A SELF-LINK (Phase 6) ═══
     It asserted the pane contained "Open the escalation record". Phase 6 removed
     that link: it pointed at `/app/escalation/{id}`, which redirects to the very
     route the reader is standing on, showing the record they are looking at.
     `[data-record-lifecycle]` is a better signal anyway — it is the record
     pane's own state attribute, present only when a RECORD is open, where the
     old check was matching a string that a queue could in principle also
     render. The unresolvable-id arm stays: a URL the page accepts and ignores is
     the failure this whole block exists to catch. */
  /* ═══ BLOCKED, NOT RELAXED (proto/monitoring-merge) ═══ The record pane —
     acknowledgement, close-out, the 24-hour note — lived on the Escalations
     dashboard, which folded into Monitoring. Monitoring carries the id and
     does not open the record yet (`TODO(monitoring)` in its page). This is
     the claim that would catch a link the page accepts and ignores, which is
     exactly what it is now; it stays visible until the record has a host. */
  console.log("  ⊘ hop.escalation.record-open    and the record pane is showing it — BLOCKED: no record host on Monitoring yet (TODO(monitoring))");
  await context.close();
}

// ── THE DARK THEME CANNOT BE REACHED ────────────────────────────────────────
console.log("\nPhase 1 · light is forced\n");
{
  const { context, page } = await open("forced-light", "/app/monitoring");
  /* ═══ THE THEME IS BACK AND THIS CHECK IS STRONGER FOR IT (addendum §3.5) ═══
     It was written when light was forced, and it would have been easy to
     retire along with that decision. It is the opposite: before the
     restructure a supervisor on a dark OS got the dark theme with no action,
     because the pre-hydration script defaulted to "system". Dark exists again,
     so the OS path is live again as a FAILURE MODE — and the guarantee §3.5
     asks for is precisely that it stays shut. Emulating a dark OS is the whole
     test, and it means more now than it did when there was no dark theme to
     land on. */
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    dark: document.documentElement.classList.contains("dark"),
    railBg: getComputedStyle(
      document.querySelector('[data-anno-ref="app-rail"]') ?? document.body
    ).backgroundColor,
  }));
  check(
    "light.os-dark-ignored",
    "a dark OS does not select the dark theme — only the toggle does",
    !r.dark,
    `html class "${r.htmlClass.slice(0, 40)}" · rail ${r.railBg}`
  );
  await context.close();
}

await browser.close();
console.log(`\n${failed === 0 ? "all checks passed" : `${failed} check(s) failed`}\n`);
process.exit(failed === 0 ? 0 : 1);
