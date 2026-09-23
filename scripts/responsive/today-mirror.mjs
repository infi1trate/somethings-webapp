// ═══════════════════════════════════════════════════════════════════════════
// §4's ACCEPTANCE TEST — "Today mirrors. It never contains."
//
// The rule as written: **it must be impossible to change the state of any record
// from the Today route, except by navigating away from it.** This file is what
// makes "impossible" a measured claim rather than a design intention.
//
// ═══ FOUR CLAIMS, AND WHY EACH NEEDS ITS OWN INSTRUMENT ═══
//
// 1 · NO RECORD CHANGES. The persisted store is diffed across a Today mount AND
//     across activating every non-link control on the page. The allowed diff is
//     exactly one key. Reading the DOM cannot make this claim — a mutation with
//     no visible result is still a mutation — so it is read from the store.
//
// 2 · EVERY AFFORDANCE IS A LINK, or is named page chrome. A `<button
//     onClick={router.push}>` is visually identical to an anchor and satisfies
//     none of what an anchor gives a reader, so the check is structural: every
//     focusable element in `main` is an `<a href>` to another route, or it
//     carries `data-today-local` and appears in the allowlist below.
//
// 3 · EVERY LINK LANDS ON A LIVE DESTINATION. Not a retired hop. Phase 2 found
//     an infinite redirect loop behind a link whose URL assertion passed, so the
//     hrefs are checked against the destination set rather than pattern-matched.
//
// 4 · THE MIRROR AGREES WITH WHAT IT MIRRORS. This is the one worth the most and
//     the one a structural check cannot reach: each card's figure is read off
//     Today, then the destination is opened and its OWN figure read, and the two
//     are compared. A mirror that disagrees is worse than no mirror — a
//     supervisor who reads one number here and a different one there now
//     distrusts both surfaces and cannot tell which lied.
//
// ═══ WHAT THIS DELIBERATELY DOES NOT DO ═══
//
// It does not assert that the numbers are RIGHT. Both surfaces could be wrong
// together and this would pass — correctness of each count belongs to the
// destination's own probe. What this owns is that there is one answer.
//
// Exit codes: 0 every check passed · 1 a check failed.

import { launch, openView, readStoreVersion, VIEWPORTS } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/today-mirror";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1100 };
const STORE_KEY = "somethings.mentor-onboarding";

/** ═══ THE ONE KEY TODAY MAY WRITE, AND THE REASON ═══
 *  `shiftLastSeenAt` is a visit stamp about this READER — it is what makes the
 *  shift digest appear once per shift instead of on every visit. It is UI memory,
 *  not state on any record, and that distinction is the whole of what this
 *  allowlist encodes. Anything else appearing in the diff is a §4 violation, and
 *  the check names the key so the failure is actionable rather than a red light.
 *
 *  ADDING TO THIS LIST IS THE DECISION. It is deliberately one line long. */
const WRITABLE = new Set(["shiftLastSeenAt"]);

/** Non-link controls Today is allowed to have, each with what it does. All three
 *  are `useState` on the page component and die with the mount. */
const LOCAL_CONTROLS = {
  dismiss: "hides the shift digest for this mount",
  retry: "flips a page-local region state back to ready",
};

const DESTINATIONS = new Set([
  "/app/escalations",
  "/app/risk-flags",
  "/app/mentor-practice",
  "/app/coverage",
  "/app/care-reviews",
  "/app/activity",
]);
const RETIRED = ["/app/home", "/app/tasks", "/app/monitoring"];

const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;
function check(id, label, ok, detail) {
  rows.push({ id, label, ok: !!ok, detail });
  if (!ok) failed += 1;
  console.log(`  ${ok ? "✓" : "×"} ${id.padEnd(30)} ${label}${detail ? ` — ${detail}` : ""}`);
}

/** The scenario pair is pinned so both halves of check 4 read the same fixtures.
 *  A mirror comparison across two different scenarios would be meaningless. */
const SEED = {
  persona: "supervisor",
  extra: {
    tasksScenarioId: "heavy-caseload",
    monitoringScenarioId: null,
    devLoadState: "ready",
  },
};

async function open(id, url) {
  const view = await openView(browser, { id, url, seed: SEED }, XL, version);
  await view.page.waitForTimeout(1200);
  return view;
}

/** The persisted store, parsed. Returns null when it is absent — which must fail
 *  loudly rather than compare equal to another null, so every caller checks. */
async function readStore(page) {
  return page.evaluate((k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw).state ?? null : null;
    } catch {
      return null;
    }
  }, STORE_KEY);
}

function diffKeys(a, b) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  const out = [];
  for (const k of keys) {
    if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) out.push(k);
  }
  return out.sort();
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · NO RECORD CHANGES — ACROSS A MOUNT, AND ACROSS EVERY LOCAL CONTROL
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n§4 · nothing on Today changes a record\n");
{
  /* ═══ THE BASELINE COMES FROM A PAGE THAT IS NOT TODAY ═══
     First version opened Today, read the store, reloaded, and diffed. A mutation
     run proved it vacuous: a record write inside Today's mount effect had ALREADY
     HAPPENED before the baseline read, so it was present on both sides and the
     diff was empty. The check reported a clean pass on the strongest claim in the
     file while the page was writing to `careReviews` on every mount.
     So the baseline is taken on a neighbouring route — Today has never mounted in
     this context when it is read — and Today is then navigated to. */
  const { context, page } = await open("mirror-store", "/app/coverage");
  const before = await readStore(page);
  /* THE INPUT IS ASSERTED FIRST. Without this, a run where the store never
     persisted would compare null to null and report a clean pass. */
  check(
    "store.present",
    "the persisted store exists, so a diff of it means something",
    before != null && Object.keys(before).length > 5,
    before ? `${Object.keys(before).length} keys` : "absent — every check below would be vacuous"
  );
  check(
    "store.baseline-off-today",
    "and the baseline was taken before Today ever mounted",
    (await page.evaluate(() => location.pathname)) !== "/app/today",
    await page.evaluate(() => location.pathname)
  );

  await page.evaluate(() => {
    window.location.href = "/app/today";
  });
  await page.waitForTimeout(1800);
  const afterMount = await readStore(page);
  const mountDiff = diffKeys(before, afterMount).filter((k) => !WRITABLE.has(k));
  check(
    "mount.writes-nothing",
    "mounting Today writes no key but the visit stamp",
    mountDiff.length === 0,
    mountDiff.length ? `also wrote: ${mountDiff.join(", ")}` : "only shiftLastSeenAt"
  );

  /* ═══ NOW ACTIVATE EVERY NON-LINK CONTROL ON THE PAGE ═══
     Not a list of the ones this file knows about — everything the DOM offers, so
     a control added later is exercised without anybody remembering to add it
     here. Links are excluded because following one is the SANCTIONED way to
     change something: it leaves. */
  const locals = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main [role='button'], main input, main select, main textarea")]
      .map((e, i) => {
        e.setAttribute("data-mirror-idx", String(i));
        return {
          idx: i,
          tag: e.tagName,
          local: e.getAttribute("data-today-local"),
          label: (e.getAttribute("aria-label") || e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
        };
      })
  );
  check(
    "controls.all-named",
    "every non-link control on Today is declared page chrome",
    locals.every((c) => c.local && c.local in LOCAL_CONTROLS),
    locals.length
      ? locals.map((c) => `${c.tag}:${c.local ?? "UNDECLARED"}(${c.label})`).join(" · ")
      : "none"
  );

  const beforeClicks = await readStore(page);
  for (const c of locals) {
    /* `force`, because a control may be behind a region state this run did not
       produce — a click that cannot land must not silently skip the assertion. */
    await page.locator(`[data-mirror-idx="${c.idx}"]`).click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(600);
  const afterClicks = await readStore(page);
  const clickDiff = diffKeys(beforeClicks, afterClicks).filter((k) => !WRITABLE.has(k));
  check(
    "controls.write-nothing",
    "and activating all of them changes no record",
    clickDiff.length === 0,
    clickDiff.length ? `wrote: ${clickDiff.join(", ")}` : `${locals.length} control(s), 0 record writes`
  );
  /* AND THE PAGE DID NOT NAVIGATE while we were clicking. Without this, a
     control that navigated away would take the store diff with it and pass. */
  check(
    "controls.stayed",
    "and none of them navigated away, so the diff above was measured on Today",
    (await page.evaluate(() => location.pathname)) === "/app/today",
    await page.evaluate(() => location.pathname)
  );
  await page.screenshot({ path: `${OUT}/today.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · EVERY AFFORDANCE IS A LINK TO A LIVE DESTINATION
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n§4 · leaving is the only way out\n");
let cards = [];
{
  const { context, page } = await open("mirror-links", "/app/today");
  const links = await page.evaluate(() =>
    [...document.querySelectorAll("main a[href]")].map((a) => ({
      href: a.getAttribute("href"),
      anno: a.getAttribute("data-anno-ref"),
      text: (a.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60),
    }))
  );
  check(
    "links.present",
    "Today offers links at all",
    links.length > 0,
    `${links.length} link(s)`
  );
  const offRoute = links.filter((l) => (l.href ?? "").startsWith("/app/today"));
  check(
    "links.leave",
    "every link leaves the Today route",
    offRoute.length === 0,
    offRoute.length ? offRoute.map((l) => l.href).join(", ") : "all off-route"
  );
  const retired = links.filter((l) =>
    RETIRED.some((r) => (l.href ?? "").startsWith(r))
  );
  check(
    "links.no-retired",
    "and none of them points at a route being emptied",
    retired.length === 0,
    retired.length ? retired.map((l) => l.href).join(", ") : "clean"
  );
  const unknown = links.filter((l) => {
    const p = (l.href ?? "").split("?")[0];
    return !DESTINATIONS.has(p) && !p.startsWith("/app/escalation/");
  });
  check(
    "links.known-targets",
    "and every target is a destination, the record route, or the ledger",
    unknown.length === 0,
    unknown.length ? unknown.map((l) => l.href).join(", ") : "all known"
  );

  // ── THE CARDS, AS READ OFF TODAY ─────────────────────────────────────────
  cards = await page.evaluate(() =>
    [...document.querySelectorAll('[data-anno-ref^="today-card:"]')].map((a) => ({
      id: a.getAttribute("data-anno-ref").replace("today-card:", ""),
      tone: a.getAttribute("data-tone"),
      directive: a.getAttribute("data-directive") === "true",
      href: a.getAttribute("href"),
      text: (a.innerText || "").replace(/\s+/g, " ").trim(),
    }))
  );
  check(
    "cards.five",
    "one card per destination, in the rail's order",
    cards.length === 5 &&
      cards.map((c) => c.id).join(",") ===
        "escalations,risk-flags,mentor-practice,coverage,care-reviews",
    cards.map((c) => c.id).join(" > ") || "none"
  );
  check(
    "cards.one-directive",
    "and exactly one carries the ladder's answer",
    cards.filter((c) => c.directive).length === 1,
    `${cards.filter((c) => c.directive).length} directive · ${cards.find((c) => c.directive)?.id ?? "none"}`
  );
  /* ═══ NO TIER VOCABULARY, ANYWHERE ON THE SURFACE ═══
     The digest used to carry "10 imminent past 24h" and "14 clinical past 48h" —
     fabricated deadlines against a tier taxonomy this system never published.
     Phase 4 greps the codebase; this holds the surface. */
  const body = await page.evaluate(() => document.querySelector("main")?.innerText ?? "");
  const tierWords = ["imminent", "clinical review", "routine", "past 24h", "past 48h"].filter(
    (w) => new RegExp(w, "i").test(body)
  );
  /* ═══ THE STRIP AND THE CARD ARE ONE CLAIM (Phase 3) ═══
     Measured on mobile under `classifier-degraded`: the strip announced two live
     escalations in assertive red and the card forty pixels below read "Nothing
     open". The strip counted task items, the card counted the destination's
     records. Both are on the same screen at the same time, so this is the one
     mirror comparison that needs no navigation — and the one nothing was
     checking. Run on the fixture pair that produced the contradiction, not only
     on the agreeable one. */
  {
    /* BOTH FIXTURE PAIRS, because agreement at zero is not agreement. The
       degraded pair is the one that produced the contradiction; the null pair is
       the one with escalations in it. A run where every pair reported an empty
       strip would be this check passing on nothing, so that is asserted too. */
    const PAIRS = [
      ["degraded", "heavy-caseload", "classifier-degraded"],
      ["live", "heavy-caseload", null],
    ];
    let sawNonEmpty = 0;
    for (const [name, sid, mid] of PAIRS) {
      const { context: c2, page: p2 } = await openView(
        browser,
        {
          id: `mirror-strip-${name}`,
          url: "/app/today",
          seed: {
            persona: "supervisor",
            extra: {
              tasksScenarioId: sid,
              monitoringScenarioId: mid,
              devLoadState: "ready",
            },
          },
        },
        XL,
        version
      );
      await p2.waitForTimeout(1400);
      const seen = await p2.evaluate(() => ({
        stripRows: document.querySelectorAll(
          '[data-anno-ref="today-escalation-strip"] li'
        ).length,
        card:
          document
            .querySelector('[data-anno-ref="today-card:escalations"]')
            ?.innerText?.replace(/\s+/g, " ") ?? "",
      }));
      const claimed = Number(seen.card.match(/(\d+) active/)?.[1] ?? 0);
      if (seen.stripRows > 0) sawNonEmpty += 1;
      check(
        `strip.agrees.${name}`,
        "the escalation strip and the Escalations card state the same number",
        seen.stripRows === claimed,
        `strip ${seen.stripRows} row(s) · card claims ${claimed} active`
      );
      await c2.close();
    }
    check(
      "strip.exercised",
      "and at least one fixture actually rendered a strip, so the above is not zero-vs-zero",
      sawNonEmpty > 0,
      `${sawNonEmpty} of ${PAIRS.length} pair(s) had a non-empty strip`
    );
  }

  check(
    "cards.no-tiers",
    "and no tier name or fabricated flag deadline appears on the page",
    tierWords.length === 0,
    tierWords.length ? `found: ${tierWords.join(", ")}` : "clean"
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE MIRROR AGREES WITH WHAT IT MIRRORS
// ═══════════════════════════════════════════════════════════════════════════
//
// Each destination is opened and asked its own figure, in its own words, from the
// element a reader would look at. The comparison is per destination because the
// honest figure differs: a fraction for Coverage, a group count for the queues, a
// header clause for Care Reviews.
console.log("\n§4 · the mirror agrees with the destination\n");
{
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  check(
    "agree.cards-read",
    "the cards were read off Today, so the comparisons below mean something",
    Object.keys(byId).length === 5,
    `${Object.keys(byId).length} card(s)`
  );

  /* ── COVERAGE · the strongest form, because both sides use `coverageLine` ── */
  {
    const { context, page } = await open("mirror-coverage", "/app/coverage");
    const meter = await page.evaluate(() => {
      const m = document.querySelector("main")?.innerText ?? "";
      return m.match(/\d+ of \d+ conversations reviewed this \w+/)?.[0] ?? null;
    });
    const onToday =
      byId.coverage?.text.match(/\d+ of \d+ conversations reviewed this \w+/)?.[0] ?? null;
    check(
      "agree.coverage",
      "Coverage's own sentence appears verbatim on the card",
      meter != null && onToday != null && meter === onToday,
      `destination "${meter}" · today "${onToday}"`
    );
    await context.close();
  }

  /* ── RISK FLAGS · the group header's count against the card's figure ────── */
  {
    const { context, page } = await open("mirror-flags", "/app/risk-flags");
    const dest = await page.evaluate(() => {
      const h = [...document.querySelectorAll('[role="group"] > div[aria-hidden]')]
        .map((e) => e.innerText || "")
        .find((t) => / — \d/.test(t));
      return h ? Number(h.match(/ — (\d+)/)?.[1]) : null;
    });
    const onToday = Number(byId["risk-flags"]?.text.match(/(\d+) open/)?.[1] ?? NaN);
    check(
      "agree.risk-flags",
      "Risk Flags' queue count equals the card's",
      dest != null && dest === onToday,
      `destination ${dest} · today ${onToday}`
    );
    await context.close();
  }

  /* ── CARE REVIEWS · the header's open count ─────────────────────────────── */
  {
    const { context, page } = await open("mirror-care", "/app/care-reviews");
    const dest = await page.evaluate(() => {
      const t = document.querySelector('[data-anno-ref="tasks-header"]')?.innerText ?? "";
      return Number(t.match(/(\d+) open/)?.[1] ?? NaN);
    });
    const onToday = Number(byId["care-reviews"]?.text.match(/(\d+) open/)?.[1] ?? NaN);
    check(
      "agree.care-reviews",
      "Care Reviews' open count equals the card's",
      Number.isFinite(dest) && dest === onToday,
      `destination ${dest} · today ${onToday}`
    );
    await context.close();
  }

  /* ── ESCALATIONS · THE CHECK THAT FOUND THE DISAGREEMENT ────────────────
     Written to compare two functions, because the card read `homeObligations`
     (from task items) while the destination's header read Monitoring's own
     inlined memo (from escalation records). It failed on its first run:
     destination 2, card 1. Both sentences were true — "awaiting" is
     pending-plus-breached, "past" is breached alone — which is exactly why it
     was worth fixing rather than explaining to a reader.
     Both now call `escalationObligations`, so this asserts equality between two
     CALLERS of one function rather than between two functions. Kept, and kept
     strict: it is what fails if either surface ever recomputes it locally. */
  {
    const { context, page } = await open("mirror-esc", "/app/escalations");
    const dest = await page.evaluate(() => {
      const t = document.querySelector('[data-anno-ref="monitoring-header"]')?.innerText ?? "";
      return {
        ack: Number(t.match(/(\d+) escalations? awaiting acknowledgement/)?.[1] ?? 0),
        closeOut: Number(t.match(/(\d+) close-out items? overdue/)?.[1] ?? 0),
        rows: document.querySelectorAll('[data-anno-ref^="escalation-row:"]').length,
      };
    });
    const onToday = {
      active: Number(byId.escalations?.text.match(/(\d+) active/)?.[1] ?? 0),
      /* THE DESTINATION'S OWN PHRASE. A regex for the card's old wording is how
         this check would silently start reading 0 off a card that says 2. */
      ack: Number(
        byId.escalations?.text.match(/(\d+) awaiting acknowledgement/)?.[1] ?? 0
      ),
    };
    check(
      "agree.escalations.ack",
      "the acknowledgement count is the same on both, and in the same words",
      dest.ack === onToday.ack && dest.ack > 0,
      `destination ${dest.ack} · today ${onToday.ack}` +
        (dest.ack === 0 ? " — ZERO ON BOTH: this scenario cannot exercise the check" : "")
    );
    check(
      "agree.escalations.reachable",
      "and the destination has at least as many records as the card claims are active",
      dest.rows >= onToday.active,
      `${dest.rows} record(s) · card claims ${onToday.active} active`
    );
    await context.close();
  }

  /* ── MENTOR PRACTICE · the queue's count against the card's ─────────────── */
  {
    const { context, page } = await open("mirror-practice", "/app/mentor-practice");
    const dest = await page.evaluate(() => {
      const h = [...document.querySelectorAll('[role="group"] > div[aria-hidden]')]
        .map((e) => e.innerText || "")
        .find((t) => / — \d/.test(t));
      return h ? Number(h.match(/ — (\d+)/)?.[1]) : 0;
    });
    const onToday = Number(byId["mentor-practice"]?.text.match(/(\d+) open/)?.[1] ?? 0);
    check(
      "agree.mentor-practice",
      "Mentor Practice's queue count equals the card's",
      dest === onToday,
      `destination ${dest} · today ${onToday}`
    );
    await context.close();
  }
}

await writeFile(
  `${OUT}/report.json`,
  JSON.stringify({ generated: new Date().toISOString(), rows, cards }, null, 2)
);
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
