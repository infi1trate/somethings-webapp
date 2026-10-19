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

/** ═══ THE KEYS TODAY MAY WRITE, AND THE REASON FOR EACH ═══
 *  `shiftLastSeenAt` is a visit stamp about this READER — it is what makes the
 *  shift digest appear once per shift instead of on every visit. It is UI memory,
 *  not state on any record, and that distinction is the whole of what this
 *  allowlist encodes. Anything else appearing in the diff is a §4 violation, and
 *  the check names the key so the failure is actionable rather than a red light.
 *
 *  ADDING TO THIS LIST IS THE DECISION. It was deliberately one line long and is
 *  now two; the second was taken deliberately and is recorded here.
 *
 *  ═══ `shiftDigestDismissedAt` — TODAY PHASE C.6 ═══
 *
 *  C.6 requires the banner's dismissal to persist "for the current shift only,
 *  per supervisor". It was `useState(false)`, which survived nothing — so this
 *  check passed because the feature was absent, not because the page was
 *  disciplined.
 *
 *  IT IS THE SAME CLASS AS THE KEY ABOVE, which is why it is admitted rather
 *  than the check being loosened: an instant recording that THIS READER closed
 *  a banner. It is not state on any record, nobody else can observe it, and it
 *  changes no task, no disposition and no clinical field. The mirror rule
 *  forbids Today CONTAINING work; remembering that you dismissed a hint is not
 *  work.
 *
 *  WHAT IS STILL FORBIDDEN, UNCHANGED: any key that is state on a record. The
 *  check below still fails on one and still names it. */
const WRITABLE = new Set(["shiftLastSeenAt", "shiftDigestDismissedAt"]);

/** Non-link controls Today is allowed to have, each with what it does.
 *  `retry` is `useState` on the page and dies with the mount; `dismiss` writes
 *  the one allowlisted preference above and outlives it by design. */
const LOCAL_CONTROLS = {
  /* NO LONGER "for this mount" — Phase C.6 persists it for the shift, through
     `shiftDigestDismissedAt` in the allowlist above. */
  /* ═══ `dismiss` IS RETIRED BY L.3, KEPT IN THE LIST ═══
     Phase C is withdrawn and the digest it dismissed is gone, so nothing
     renders this control. The entry stays because the allowlist is a record of
     what Today has been ALLOWED to own, and dropping it would make the
     control's return silent. */
  dismiss: "hides the shift digest for the rest of this shift (retired, L.3)",
  retry: "flips a page-local region state back to ready",
  /* ═══ ADDED BY L.3 — AND ADDING TO THIS LIST IS THE DECISION ═══
     The Tasks section's collapse chevron, allowed for the same reason
     `dismiss` was: it acts on THIS PAGE'S PRESENTATION and touches no record,
     which is the line the mirror rule draws. It persists nothing, not even for
     the mount, so it appears in no store diff either. */
  "collapse-care-reviews": "collapses the Tasks table for this view only",
};

/** ═══ THE LIVE BAND'S TWO CONTROLS, DECLARED BEFORE THEY APPEAR (Phase 9) ═══
 *
 *  `NowBand` is mounted on Today and renders NOTHING while `LIVE_LAYER_ENABLED`
 *  is false — so `controls.all-named` currently never sees them, and would fail
 *  with "UNDECLARED" on the day the gate flips. That failure would be correct
 *  and misleading: it would read as a §4 violation when the mirror rule is
 *  intact.
 *
 *  BOTH ARE PAGE CHROME, and neither touches a record:
 *   · `toggle-pause` — WCAG 2.2.2 requires a way to stop auto-updating content.
 *     Page-local, because storing the preference would be a second store write
 *     on a route allowed exactly one.
 *   · `show-new` — the manual affordance that replaces a continuously-announcing
 *     live region (WCAG 4.1.3: a status message must not move focus, so the
 *     reader presses a button instead).
 *
 *  THEY ARE KEYED ON `data-action`, which the shared component already carries,
 *  rather than on a Today-specific attribute — the band belongs to both surfaces
 *  and tagging it for one would be a lie about where it lives. */
const BAND_CONTROLS = {
  "toggle-pause": "stops the live band updating (WCAG 2.2.2), page-local",
  "show-new": "reveals held live items on demand (WCAG 4.1.3)",
};

/* RETARGETED (proto/monitoring-merge): `/app/monitoring` is a destination
   again and `/app/escalations` / `/app/risk-flags` are hops into it, so the
   two sets traded those three paths. */
const DESTINATIONS = new Set([
  "/app/monitoring",
  "/app/care-reviews",
  "/app/activity",
]);
const RETIRED = ["/app/home", "/app/tasks", "/app/escalations", "/app/risk-flags"];

const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;
/** ═══ A CLAIM WITH NO SUBJECT, SAID OUT LOUD ═══ Not a pass and not a skip:
 *  `⊘`, counted separately, and the summary names the count. The same form
 *  `monitoring-states.mjs` uses. */
let blocked = 0;
function retiredClaim(id, label, why) {
  blocked += 1;
  console.log(`  ⊘ ${id.padEnd(30)} ${label} — ${why}`);
}
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
  /* THE NEIGHBOUR WAS `/app/coverage` until it became Chat (addendum §2.2).
     Any route that is not Today works; what matters is that Today has not
     mounted in this context when the baseline is read. */
  const { context, page } = await open("mirror-store", "/app/care-reviews");
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
      /* SUP-2 put the Support panel inside `<main>` (it pushes the canvas, so
         it is the canvas's flex sibling). It is shell chrome, like the top bar
         outside `<main>`, not a control Today owns; it is measured in
         `support-panel.mjs`. */
      .filter((e) => !e.closest("[data-support-slot]"))
      .map((e, i) => {
        e.setAttribute("data-mirror-idx", String(i));
        return {
          idx: i,
          tag: e.tagName,
          /* EITHER IDENTIFIER. Today's own chrome carries `data-today-local`;
             the shared live band carries `data-action`. */
          local:
            e.getAttribute("data-today-local") ?? e.getAttribute("data-action"),
          label: (e.getAttribute("aria-label") || e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
        };
      })
  );
  /* ═══ AN INVARIANT THAT HOLDS IN BOTH GATE STATES ═══
     First version asserted "no band controls", which is true while
     `LIVE_LAYER_ENABLED` is false and turns RED on an intentional flip —
     verified by flipping it: the check failed while every §4 check still
     passed, which reads as a defect and is not one.
     SO IT ASSERTS THE CORRESPONDENCE INSTEAD: the band's controls are present
     exactly when the band is. That is decidable from the DOM alone, holds
     whichever way the gate is set, and catches the thing worth catching — a band
     that rendered without its pause control, which would be a WCAG 2.2.2
     failure rather than a gate setting.
     WHETHER THE GATE IS THE REASON for an absent band is not answerable here at
     all; `live-gate.test.ts` reads the source for that. */
  const bandPresent = await page.evaluate(
    () => !!document.querySelector('[data-slot="now-band"]')
  );
  const bandControls = locals.filter(
    (c) => c.local && c.local in BAND_CONTROLS
  ).length;
  check(
    "controls.band-consistent",
    "the live band's controls are present exactly when the band is",
    bandPresent ? bandControls >= 1 : bandControls === 0,
    `band ${bandPresent ? "rendered" : "absent"} · ${bandControls} band control(s)`
  );
  check(
    "controls.all-named",
    "every non-link control on Today is declared page chrome",
    locals.every(
      (c) => c.local && (c.local in LOCAL_CONTROLS || c.local in BAND_CONTROLS)
    ),
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
    "cards.three",
    "one card per destination, in the rail's order",
    /* WAS FIVE. Mentor Practice and Coverage are gone (§2.1, §2.2), and the
       mirror rule is what forces this number down with them: a card for a
       destination that does not exist is the mirror claiming something the
       rail cannot open. */
    cards.length === 3 &&
      cards.map((c) => c.id).join(",") === "escalations,risk-flags,care-reviews",
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
      /* ═══ THE STRIP IS GONE FROM TODAY (L.6) ═══
         This compared the strip's ROW COUNT against the Escalations card's
         claimed figure — a good check, and its `strip.exercised` guard
         correctly fired rather than letting a zero-vs-zero pass once the strip
         stopped rendering.
         L.6 REMOVES the full-width red bars from this surface: "they are
         inverted sections, which this pack already prohibited, and they are not
         the escalation treatment." So there is no strip to agree with.
         THE MIRROR CLAIM IS NOT DROPPED — it has a better owner. The
         card-vs-destination checks above open `/app/escalations` and compare
         the card's figure to the destination's OWN figure, which is the
         comparison that matters. What died is a Today-internal one.
         WHAT REPLACES IT IS L.6's OWN CONTRACT: no strip renders, and the card
         states the condition IN TEXT, which is what makes colour not the sole
         carrier once the bars are gone. */
      const seen = await p2.evaluate(() => ({
        stripRows: document.querySelectorAll(
          '[data-anno-ref="today-escalation-strip"] li'
        ).length,
        banners: [...document.querySelectorAll("main *")].filter((e) => {
          const bg = getComputedStyle(e).backgroundColor;
          const m = bg.match(/\d+/g);
          if (!m) return false;
          const [r, g, b] = m.map(Number);
          /* A saturated red fill spanning most of the column — the shape of the
             thing L.6 removed, detected by its paint rather than by its
             anno-ref, so reintroducing it under a new name still fails. */
          return r > 150 && g < 90 && b < 80 && e.getBoundingClientRect().width > 600;
        }).length,
        card:
          document
            .querySelector('[data-anno-ref="today-card:escalations"]')
            ?.innerText?.replace(/\s+/g, " ") ?? "",
      }));
      const claimed = Number(seen.card.match(/(\d+) active/)?.[1] ?? 0);
      if (claimed > 0) sawNonEmpty += 1;
      check(
        `strip.absent.${name}`,
        "no escalation strip and no full-width red banner renders on Today",
        seen.stripRows === 0 && seen.banners === 0,
        `${seen.stripRows} strip row(s) · ${seen.banners} wide red fill(s)`
      );
      check(
        `strip.card-states-it.${name}`,
        "and the Escalations card states the condition in text",
        claimed === 0 || /active/.test(seen.card),
        `card claims ${claimed} active · "${seen.card.slice(0, 54)}"`
      );
      await c2.close();
    }
    /* THE GUARD SURVIVES, REPOINTED: at least one fixture must actually have a
       live escalation, or the two checks above are asserting nothing. */
    check(
      "strip.exercised",
      "and at least one fixture actually had a live escalation, so the above is not zero-vs-zero",
      sawNonEmpty > 0,
      `${sawNonEmpty} of ${PAIRS.length} pair(s) had an active escalation`
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
    Object.keys(byId).length === 3,
    `${Object.keys(byId).length} card(s)`
  );

  /* ── COVERAGE's AGREEMENT CHECK IS GONE (addendum §2.2) ──────────────────
     It was the strongest form in this file: both sides called `coverageLine`,
     so the assertion was that one sentence appeared verbatim in two places
     rather than that two numbers matched. The destination is Chat now and
     computes no fraction, so there is no sentence to agree with.
     WHAT REPLACES THE FORM, not the subject: §2.11's progress track is the next
     figure that will exist on two surfaces, and it should be checked this way
     rather than by comparing digits. */

  /* ── RISK FLAGS · NO DESTINATION TO AGREE WITH (proto/monitoring-merge) ──
     This counted the open flags the Risk Flags rows stood for and required the
     card's "N open" to equal them. The dashboard folded into Monitoring, whose
     flag figure ("Open risk flags · in last 48h") is computed from the tiered
     roster (`lib/monitoring/tier-roster.ts`), not from the flag fixtures this
     card reads — two sources, so equality would be a coincidence, not a
     check. RESTORED WHEN Monitoring's figure and the card call one function,
     which is the question the merge report asks. The old check is in git at
     2978adb. */
  retiredClaim("agree.risk-flags", "Risk Flags' open flag count equals the card's", "the dashboard folded into Monitoring, which counts from the tier roster");

  /* ── CARE REVIEWS · the header's open count ─────────────────────────────── */
  {
    const { context, page } = await open("mirror-care", "/app/care-reviews");
    /* ═══ RETARGETED TWICE, AND THE SECOND TIME IT HAD BEEN PASSING ∅ ═══
       FIRST it parsed "N open" out of the header's three-segment line; §2.10
       replaced that with a metric pair and this read `data-metric-value="open"`.
       THE PARITY PACK §4.2 THEN REMOVED THE METRIC PAIR ALTOGETHER — the header
       carries no figures at all now, and the open count is the `Open` tab's own
       numeral. So the selector matched nothing.

       THE PROBE DID NOT SAY SO, WHICH IS THE WORSE HALF. `Number("".trim())` is
       `0`, not `NaN`, so a missing element produced a finite zero and sailed
       through the `Number.isFinite` guard — the check then reported
       "destination 0 · today 16" as a DISAGREEMENT between two surfaces when
       one of the two had no figure to read. An assertion whose input is absent
       must fail on the absence, by name, rather than coerce it into a value.
       Hence the explicit `null` sentinel below and the `not found` branch: the
       next time this element is renamed, the probe says which element. */
    const dest = await page.evaluate(() => {
      const el = document.querySelector('[data-anno-ref="care-tab:open"]');
      if (!el) return null;
      /* The numeral, not the label: `aria-label` is "Open, 16" and the visible
         figure is the `aria-hidden` span. This asserts what a sighted reader
         compares, and the label carries the same number by construction. */
      /* RETARGETED (segmented restyle, 2026-10-05): the segment reads
         `Open (16)` now, so the figure is the parenthesised one rather than a
         trailing bare numeral — the old `(\d+)\s*$` returned null on the
         closing bracket and reported the element as missing. */
      const n = (el.textContent ?? "").match(/\((\d+)\)\s*$/);
      return n ? Number(n[1]) : null;
    });
    const onToday = Number(byId["care-reviews"]?.text.match(/(\d+) open/)?.[1] ?? NaN);
    check(
      "agree.care-reviews",
      "Care Reviews' open count equals the card's",
      dest !== null && Number.isFinite(onToday) && dest === onToday,
      dest === null
        ? 'care-tab:open not found — the open count moved again'
        : `destination ${dest} · today ${onToday}`
    );
    await context.close();
  }

  /* ── ESCALATIONS · NO DESTINATION TO AGREE WITH (proto/monitoring-merge) ──
     The check that FOUND a disagreement once (destination 2, card 1) and was
     kept strict because both sides came to call `escalationObligations`. The
     escalations dashboard and its metric pair folded into Monitoring, where
     escalations are the Tier 1 lane and a column, counted from the tier
     roster. Same reasoning, same restoration condition, as the flags claim
     above; the old check is in git at 2978adb. */
  retiredClaim("agree.escalations.active", "the active count is the same on both, and in the same word", "the dashboard folded into Monitoring, which counts from the tier roster");
  retiredClaim("agree.escalations.reachable", "and the destination has at least as many records as the card claims are active", "no escalation record list on Monitoring yet");

  /* ── MENTOR PRACTICE's AGREEMENT CHECK IS GONE (addendum §2.1) ───────────
     It compared the practice queue's group count against the card's "N open".
     Both the destination and the card are removed. */
}

await writeFile(
  `${OUT}/report.json`,
  JSON.stringify({ generated: new Date().toISOString(), rows, cards }, null, 2)
);
await browser.close();
console.log(`\n${blocked} claim(s) blocked (⊘), not counted as passes`);
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
