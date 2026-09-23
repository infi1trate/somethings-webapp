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
