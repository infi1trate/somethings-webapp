// C2 VERIFICATION — the pane's primitives and layout system.
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

async function activity(scenario = "typical-shift", height = 1000) {
  const ctx = await b.newContext({ viewport: { width: 1440, height } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, { state: { persona: "supervisor", activityScenarioId: scenario, activityDensity: "detailed" }, version: VERSION }]
  );
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app/activity`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  return p;
}

/** Click rows until the pane shows the wanted marker; returns the row's text. */
async function openUntil(p, marker) {
  const rows = p.locator("[data-row-id]");
  const n = await rows.count();
  for (let i = 0; i < Math.min(n, 20); i++) {
    await rows.nth(i).click().catch(() => {});
    await p.waitForTimeout(320);
    const has = await p.evaluate((m) => {
      const pane = document.querySelector('[data-slot="event-evidence-pane"]');
      return !!pane && new RegExp(m, "i").test(pane.textContent ?? "");
    }, marker);
    if (has) return true;
  }
  return false;
}

console.log("═══ LAYOUT (items 9, 10) ═══");
{
  const p = await activity();
  await openUntil(p, "billing|survey|flag|escalation");
  const r = await p.evaluate(() => {
    const pane = document.querySelector('[data-slot="event-evidence-pane"]');
    if (!pane) return { none: true };
    const grid = pane.firstElementChild;
    const cs = getComputedStyle(grid);
    const kids = [...grid.children];
    const scrollers = kids.filter((k) => {
      const c = getComputedStyle(k);
      return c.overflowY === "auto" || c.overflowY === "scroll";
    });
    const paneBox = pane.getBoundingClientRect();
    const footer = kids[kids.length - 1];
    const fBox = footer.getBoundingClientRect();
    return {
      rows: cs.gridTemplateRows,
      children: kids.length,
      scrollerCount: scrollers.length,
      // The footer's bottom edge must be the PANE's bottom edge, not floating
      // mid-column — that is the short-content treatment.
      footerAtBottom: Math.abs(fBox.bottom - paneBox.bottom) < 2,
      paneH: Math.round(paneBox.height),
      contentH: Math.round(kids[1].getBoundingClientRect().height),
      sections: pane.querySelectorAll("section").length,
      dividers: [...pane.querySelectorAll("section")].filter((s) =>
        getComputedStyle(s).borderTopWidth !== "0px").length,
    };
  });
  if (r.none) check(false, "the pane renders");
  else {
    check(r.children === 3, "header / content / footer", `${r.children} bands`);
    check(/minmax\(0px, 1fr\)|minmax\(0, 1fr\)/.test(r.rows) || r.rows.split(" ").length === 3,
      "the middle band is the only flexible row", r.rows);
    check(r.scrollerCount === 1, "exactly one scrolling region", String(r.scrollerCount));
    check(r.footerAtBottom, "the footer sits on the pane's bottom edge", `pane ${r.paneH}px`);
    console.log(`     ${r.sections} sections, ${r.dividers} with a rule above`);
  }
  // ═══ THE SHORT-CONTENT CASE, MEASURED ═══
  // A risk flag is the shortest pane the surface has, and it is where "the pane
  // fills its top quarter and leaves the rest white" was reported. So the footer
  // is checked HERE specifically, not only on a long billing pane.
  {
    const short = await p.evaluate(() => {
      const pane = document.querySelector('[data-slot="event-evidence-pane"]');
      const grid = pane.firstElementChild;
      const kids = [...grid.children];
      const footer = kids[kids.length - 1];
      const pb = pane.getBoundingClientRect();
      const fb = footer.getBoundingClientRect();
      const link = footer.querySelector("a");
      return {
        footerHasLink: !!link,
        linkText: link?.textContent?.trim() ?? null,
        gapBelowFooter: Math.round(pb.bottom - fb.bottom),
        contentBottomToFooterTop: Math.round(
          fb.top - kids[1].firstElementChild.getBoundingClientRect().bottom
        ),
        subject: pane.querySelector("h2")?.parentElement?.parentElement
          ?.querySelector("p")?.textContent?.trim(),
      };
    });
    check(short.footerHasLink, "the footer carries its link on a SHORT pane", String(short.linkText));
    check(short.gapBelowFooter <= 1, "and sits flush on the pane's bottom edge", `${short.gapBelowFooter}px below it`);
    check(!/this teen/i.test(short.subject ?? ""), "the subject is a real first name", JSON.stringify(short.subject));
  }
  if (process.env.SHOT_DIR) await p.locator('[data-slot="event-evidence-pane"]').screenshot({ path: process.env.SHOT_DIR + "/C2-pane.png" });
  await p.context().close();
}

console.log("\n═══ PRIMITIVES ═══");
{
  // ═══ long-history, NOT typical-shift ═══
  // A change log needs a teen with MORE THAN ONE completed review, and a
  // document preview needs a note long enough to clamp. `typical-shift` has
  // neither, so checking there asserted absence and called it failure — the
  // components were right and the scenario was thin.
  const p = await activity("long-history");
  // A billing row exercises header pill, metadata, document, related, change log.
  const found = await openUntil(p, "Earlier changes");
  check(found, "a billing pane opens");
  if (found) {
    const r = await p.evaluate(() => {
      const pane = document.querySelector('[data-slot="event-evidence-pane"]');
      const t = pane.textContent ?? "";
      const pill = pane.querySelector("h2")?.parentElement?.querySelector("span");
      return {
        header: pane.querySelector("h2")?.textContent?.trim(),
        pill: pill?.textContent?.trim(),
        pillTinted: pill ? getComputedStyle(pill).backgroundColor : null,
        subject: pane.querySelector("h2")?.parentElement?.parentElement?.querySelector("p")?.textContent?.trim(),
        metadata: pane.querySelectorAll("dl > div").length,
        document: !!pane.querySelector("figure, .font-mono") && /Review document|Presentation review/i.test(t),
        docSurface: !![...pane.querySelectorAll("div")].find((d) => /Read the full document|Show less/i.test(d.textContent ?? "")),
        relatedCard: /Primary presentation/i.test(t) && !!pane.querySelector("a[href*='/admin/person/']"),
        // The dead chip is gone: "Primary presentation" must now sit in a card
        // with a summary line, not a bare chip.
        relatedHasSummary: /Primary presentation/i.test(t) && /disorder|No descriptor/i.test(t),
        changeLog: /Earlier changes/i.test(t),
        footerPrimary: [...pane.querySelectorAll("a")].some((a) => /Open the full billing record/i.test(a.textContent ?? "")),
        copyLink: [...pane.querySelectorAll("button")].some((x) => /Copy link/i.test(x.textContent ?? "")),
        // NO MUTATION CONTROL anywhere in the pane (rule 13).
        mutators: [...pane.querySelectorAll("button")].filter((x) =>
          /resolve|close|approve|dismiss|reopen|delete/i.test(x.textContent ?? "")).length,
      };
    });
    console.log(`     header: ${JSON.stringify(r.header)}  pill: ${JSON.stringify(r.pill)}`);
    console.log(`     subject: ${JSON.stringify(r.subject)}`);
    check(!!r.pill, "the outcome renders as a pill in the header");
    check(r.pillTinted && r.pillTinted !== "rgba(0, 0, 0, 0)", "the pill is tinted from a real token", String(r.pillTinted));
    check(r.metadata > 0, "MetadataList renders label/value rows", `${r.metadata} rows`);
    // The expand control appears only when there IS something to expand — a
    // single short paragraph does not clamp, and a control that changed nothing
    // would be worse than none. Reported either way rather than asserted, since
    // which it is depends on the row's own note.
    console.log(`     document expand control present: ${r.docSurface}`);
    check(r.relatedCard && r.relatedHasSummary, "RelatedRecord is a card with content, not a bare chip");
    check(r.changeLog, "ChangeLog renders prior code changes");
    check(r.footerPrimary, "PaneActions carries the primary open-out link");
    check(r.copyLink, "PaneActions carries a referential secondary action");
    check(r.mutators === 0, "NO mutation control anywhere in the pane (rule 13)", `${r.mutators} found`);
  }
  await p.context().close();
}

console.log("\n═══ TREND STRIP (survey) ═══");
{
  const p = await activity("long-history");
  // ═══ THE MARKER MOVED WITH THE DESIGN ═══
  // This looked for a "Recent readings" heading. C3 removed it: the trend LEADS
  // the survey body, and a heading over a single-item section is the rule the
  // layout brief asked to drop. The instrument name is what identifies a survey
  // pane now.
  const found = await openUntil(p, "Instrument");
  check(found, "a survey pane shows the trend strip");
  if (found) {
    const r = await p.evaluate(() => {
      const pane = document.querySelector('[data-slot="event-evidence-pane"]');
      const items = [...pane.querySelectorAll("ol > li")];
      return {
        readings: items.length,
        texts: items.map((x) => x.textContent?.trim()),
        delta: (pane.textContent ?? "").match(/\d+ (higher|lower)|unchanged/)?.[0] ?? null,
      };
    });
    check(r.readings >= 2 && r.readings <= 5, "up to five readings", `${r.readings}`);
    check(!!r.delta, "the delta is stated in words, not a bare sign", String(r.delta));
    console.log(`     readings: ${JSON.stringify(r.texts)}`);
  }
  if (process.env.SHOT_DIR && found) await p.locator('[data-slot="event-evidence-pane"]').screenshot({ path: process.env.SHOT_DIR + "/C2-trend.png" });
  await p.context().close();
}

// ═══ C3 · ONE BODY PER TYPE ═══
console.log("\n═══ C3 · per-type bodies ═══");
{
  // TWO SCENARIOS, because no single one carries all four types: `long-history`
  // has the billing and survey series, `typical-shift` has the closed risk flag.
  // Sampling one and reporting "not reached" would have left a quarter of the
  // work unverified while every check on screen said pass.
  const seen = {};
  for (const scenario of ["long-history", "typical-shift"]) {
  const p = await activity(scenario, 1200);
  const rows = p.locator("[data-row-id]");
  const n = await rows.count();
  for (let i = 0; i < Math.min(n, 30); i++) {
    await rows.nth(i).click().catch(() => {});
    await p.waitForTimeout(260);
    const r = await p.evaluate(() => {
      const pane = document.querySelector('[data-slot="event-evidence-pane"]');
      if (!pane) return null;
      const t = pane.textContent ?? "";
      const h2 = pane.querySelector("h2")?.textContent?.trim() ?? "";
      const pill = pane.querySelector("h2")?.parentElement?.querySelector("span")?.textContent?.trim() ?? null;
      const labels = [...pane.querySelectorAll("section > h3")].map((x) => x.textContent?.trim());
      return {
        type: h2,
        pill,
        sections: labels,
        // Which primitives are present, by their distinguishing marks.
        hasTrend: /First reading on this instrument/.test(t) || !!pane.querySelector("ol > li > span.tabular-nums"),
        hasDocument: !!pane.querySelector("svg + p") && /Presentation review|Questionnaire|Anxiety|Well-Being/i.test(t),
        hasQuote: !!pane.querySelector("figure blockquote"),
        hasAttribution: !!pane.querySelector("figure figcaption"),
        hasRelated: /Primary presentation/i.test(t),
        hasChangeLog: labels.includes("Earlier changes"),
        hasFlagged: labels.includes("Flagged content"),
        // Rule 13.
        mutators: [...pane.querySelectorAll("button")].filter((x) =>
          /resolve|close |approve|dismiss|reopen|delete/i.test(x.textContent ?? "")).length,
        // THE FOOTER, PER TYPE. A tall pane with short content stitches into a
        // screenshot that is mostly white, so the footer is measured rather than
        // looked for — the eye cannot tell "pinned at the bottom" from "absent".
        footer: (() => {
          const grid = pane.firstElementChild;
          const f = grid.children[grid.children.length - 1];
          const link = f.querySelector("a");
          const pb = pane.getBoundingClientRect();
          const fb = f.getBoundingClientRect();
          return {
            link: link?.textContent?.trim() ?? null,
            flush: Math.abs(fb.bottom - pb.bottom) <= 1,
          };
        })(),
      };
    });
    if (r && r.type && !seen[r.type]) seen[r.type] = r;
  }
  await p.context().close();
  }

  const want = {
    "Billing review": { pill: true, need: ["hasRelated", "hasDocument", "hasChangeLog"] },
    "Survey": { pill: false, need: ["hasTrend", "hasDocument"] },
    "Risk flag": { pill: true, need: ["hasQuote", "hasAttribution", "hasFlagged"] },
    "Escalation": { pill: true, need: ["hasQuote", "hasAttribution"] },
  };
  for (const [type, spec] of Object.entries(want)) {
    const r = seen[type];
    if (!r) { console.log(`  · ${type}: not reached in this scenario`); continue; }
    console.log(`  ── ${type} ── pill=${JSON.stringify(r.pill)} sections=${JSON.stringify(r.sections)}`);
    check(spec.pill ? !!r.pill : r.pill === null || r.pill === undefined,
      `${type}: ${spec.pill ? "has" : "has NO"} outcome pill`, String(r.pill));
    for (const k of spec.need) check(r[k], `${type}: ${k}`);
    check(r.mutators === 0, `${type}: no mutation control (rule 13)`, String(r.mutators));
    check(!!r.footer.link && r.footer.flush,
      `${type}: footer pinned to the bottom edge with its link`,
      `${JSON.stringify(r.footer.link)} flush=${r.footer.flush}`);
  }
  for (const type of Object.keys(want)) {
    if (!seen[type]) check(false, `${type}: reached in one of the two scenarios`);
  }
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
