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
    hasDarkModeControl: /dark mode/i.test(rail.textContent ?? ""),
    hasChat: /\\bchat\\b/i.test((rail.textContent ?? "").replace(/Chats/g, "")) };
})()`;

console.log("\nPhase 1 · the grouped rail\n");
{
  const { context, page } = await open("rail-riskflags", "/app/risk-flags");
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
      current.length === 1 && /Risk Flags/.test(current[0].label),
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
    /* SHAPE, NOT COLOUR ALONE. */
    const shapes = new Set(r.badges.map((b) => (b.glyph ? "clock+count" : "count")));
    check(
      "rail.badge-shapes",
      "badges differ by SHAPE, so colour is never the sole carrier",
      r.badges.length >= 2 && shapes.size >= 2,
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
    check(
      "rail.no-dark-control",
      "no dark-mode control anywhere in the rail",
      !r.hasDarkModeControl
    );
    check(
      "rail.no-chat",
      "and no prohibited messaging word — the coverage destination is not Chat",
      !r.hasChat,
      r.hasChat ? "found one" : "clean"
    );
  }
  await context.close();
}

// ── THE RETIRED ROUTES, OPENED ───────────────────────────────────────────────
console.log("\nPhase 1 · the retired routes, opened\n");
{
  const CASES = [
    ["/app/home", "/app/today", "Today"],
    ["/app/tasks", "/app/care-reviews", "Care Reviews"],
    ["/app/monitoring", "/app/risk-flags", "Risk Flags"],
    ["/app/monitoring?band=intakeBillingReview", "/app/care-reviews", "Care Reviews"],
    ["/app/monitoring?region=escalations", "/app/escalations", "Escalations"],
    ["/app/home?queue=imminent", "/app/risk-flags", "Risk Flags"],
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
      url: "/app/escalations",
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
  const realId = await page.evaluate(() => {
    const row = document.querySelector('[data-anno-ref^="escalation-row:"]');
    return row?.getAttribute("data-anno-ref")?.replace("escalation-row:", "") ?? null;
  });
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
    window.location.href = `/app/monitoring?escalation=${encodeURIComponent(id)}`;
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
    "and it lands on the Escalations destination with the record named",
    landed.url.startsWith("/app/escalations") && landed.h.includes("Escalations"),
    `${landed.url} · "${landed.h}"`
  );
  /* AND THE RECORD IS ACTUALLY OPEN. The reachability lesson this probe's own
     header records: a URL the page accepts and ignores is indistinguishable from
     a live destination if you only read the address bar. */
  const paneText = await page.evaluate(
    () => document.querySelector("main")?.innerText ?? ""
  );
  check(
    "hop.escalation.record-open",
    "and the record pane is showing it, not merely the queue that could",
    paneText.includes("Open the escalation record") &&
      !/isn.t in this data set/.test(paneText),
    paneText.includes("Open the escalation record")
      ? "pane open"
      : /isn.t in this data set/.test(paneText)
        ? "the page states the id is unresolvable — the link did not carry"
        : "no record pane"
  );
  await context.close();
}

// ── THE DARK THEME CANNOT BE REACHED ────────────────────────────────────────
console.log("\nPhase 1 · light is forced\n");
{
  const { context, page } = await open("forced-light", "/app/risk-flags");
  /* THE OS PREFERENCE IS THE PATH THAT USED TO WORK. Emulating dark is the
     whole test: before this phase a supervisor on a dark OS got the dark theme
     with no action, because the pre-hydration script defaulted to "system". */
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
    "a dark OS no longer inverts the console",
    !r.dark,
    `html class "${r.htmlClass.slice(0, 40)}" · rail ${r.railBg}`
  );
  await context.close();
}

await browser.close();
console.log(`\n${failed === 0 ? "all checks passed" : `${failed} check(s) failed`}\n`);
process.exit(failed === 0 ? 0 : 1);
