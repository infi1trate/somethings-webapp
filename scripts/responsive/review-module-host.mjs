// ═══ ONE REVIEW MODULE, TWO HOSTS (review-module-02-tasks-host) ═══
//
// The Care page and the Tasks billing queue commit the same clinical decision.
// Until this they drew it two ways, and the claim being verified here is that
// they no longer do — which is a claim about TWO surfaces, so a check on either
// one alone proves nothing.
//
// THE CARE HALF IS NOT CHECKED HERE. `review-body-parity.mjs` owns it: seventeen
// DOM snapshots, byte-compared, with a same-day guard so fixture drift cannot be
// mistaken for a change. Duplicating a weaker version of that in this file would
// be a second answer to a question already answered better.
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

const OUT = process.env.SHOT_OUT ?? "docs/responsive/review-module";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;
function check(id, label, ok, detail) {
  rows.push({ id, label, ok: !!ok, detail });
  if (!ok) failed += 1;
  console.log(`  ${ok ? "✓" : "×"} ${id.padEnd(26)} ${label}${detail ? ` — ${detail}` : ""}`);
}


/** ═══ THESE CHECKS ARE ABOUT BILLING, AND TASKS HOSTS TWO TYPES NOW ═══
 *  arch-G admitted escalations, so the surface's first row is a live escalation
 *  and every assertion below that assumed "the selected item is a billing
 *  review" would be asserting against the wrong pane. Narrowing with the kind
 *  chip is the honest fix: it uses the product's own affordance, it leaves the
 *  escalation assertions to the probe that owns them, and it fails loudly if the
 *  chip ever stops existing. No-op on a scenario with one kind. */
async function narrowToBilling(page) {
  const chip = page.getByRole("button", { name: /^Billing,/ });
  if (await chip.count()) {
    await chip.first().click();
    await page.waitForTimeout(320);
  }
}

async function open(id, url) {
  const view = await openView(
    browser,
    { id, url, seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift" } } },
    XL,
    version
  );
  if (url.startsWith("/app/care-reviews")) {
    await view.page.waitForTimeout(450);
    await narrowToBilling(view.page);
  }
  return view;
}

/** Care's review lives inside a collapsible card; Tasks' pane IS the review. */
async function openCareReview(page) {
  const rev = page.getByRole("button", { name: /^Review$/ }).first();
  if (await rev.count()) {
    await rev.click();
    await page.waitForTimeout(700);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE TASKS PANE RENDERS THE MODULE, NOT THE COMPOSITION IT REPLACED.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("tasks", "/app/care-reviews");
  const t = await page.locator('[data-slot="task-pane"]').innerText();

  // WHAT THE MODULE BRINGS. Each of these was absent from the hand-built
  // composition, and each is evidence a supervisor uses to judge a code.
  for (const [id, needle, why] of [
    ["rationale", /Rationale/, "the labelled rationale, not a Notes block"],
    ["score-strip", /Assigned assessment/, "the score strip"],
    ["denominator", /\/\s*\d+/, "a score with its denominator"],
    ["grid", /View results/, "the answers behind the score"],
    /* ═══ THE PICKER'S LABEL IS PER SURFACE NOW (Figma §3 fork) ═══
       Care keeps "Change code"; Care Reviews says "Change presentation",
       because "code" beside a heading reading "Recommended presentation"
       named two things for one decision. The check accepts EITHER rather
       than being loosened to a substring — both spellings are real, and a
       third would still fail. */
    ["change-code", /Change (code|presentation)/, "the module's own picker control"],
  ]) {
    check(`tasks.${id}`, why, needle.test(t));
  }

  /* ═══ THE PROVENANCE AFFORDANCES ARE ICONS, SO THEY ARE NOT IN `innerText` ═══
     The first version of this check tested the pane's text for "About this
     score" and failed against a control that was present and correct: the
     trigger is an `Info` glyph whose label is its ACCESSIBLE NAME. A check that
     reads rendered text cannot see an icon button, and the fix is to ask for it
     the way a screen reader would.
     TWO OF THEM, and they say different things — one explains the generated
     rationale, one explains the score — which is the distinction the old
     composition had neither half of. */
  const provenance = await page
    .locator('[data-slot="task-pane"] [aria-label]')
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")).filter((l) => /^About this/.test(l ?? ""))
    );
  check(
    "tasks.provenance",
    "both provenance affordances, and they explain different things",
    provenance.length >= 2 && new Set(provenance).size >= 2,
    provenance.join(" | ") || "none"
  );

  // WHAT THE COMPOSITION USED TO SAY, and must not any more — two vocabularies
  // for one thing on one screen is the defect this closes.
  check("tasks.no-notes-label", "the rationale is not called Notes", !/\bNotes\b/.test(t));
  check(
    "tasks.no-assigned-survey",
    "the old metadata cell is gone",
    !/Assigned survey/.test(t),
    /Assigned survey/.test(t) ? "still present" : undefined
  );

  // ═══ WHAT THE HOST STILL OWES ═══
  // The module never displays the code ON RECORD — fine on Care, where the page
  // states it, and a regression here where nothing else would. The host supplies
  // it, with the mentorship stats, in a context strip.
  /* ═══ RETARGETED BY arch-F: THE HOST NO LONGER OWES EITHER ═══
     The module never displayed the code on record, so this host built a context
     strip above the review to state it — which put the code and the mentorship
     figures ABOVE the recommendation they qualify. arch-F moved both where the
     parity spec asks: the code is a subordinate line beneath the recommendation
     title (in the module, opt-in so Care is untouched), the figures are a
     collapsed Record context accordion after the review. The CLAIM is unchanged —
     both facts are still on this pane — and is now asserted where they live. */
  /* ═══ THE LINE IS A CHANGE'S, NOT EVERY CASE'S (arch-G, G1) ═══
     arch-F gated it on the code being present, so a RENEWAL — where the code on
     record IS the recommendation — printed "Current · F33.1" under a title
     already reading F33.1. The parity spec asks for no line in that case. So the
     probe now walks to a CHANGE row to assert the line, and asserts its ABSENCE
     on a renewal, which is the half that would otherwise regress silently. */
  /* ═══ THE KIND IS READ OFF THE ROW NOW, NOT THE PANE (§3, §4.4) ═══
     This walked rows and asked the PANE which kind it was showing, by looking
     for "Change proposed" / "Renewal proposed" in its text. §3 removes the
     proposal lozenge row from the pane on this surface — the list already
     states the kind under the mentee's name (§4.4) and shows the codes in
     their own column, so repeating both at the top of the pane was the row
     read twice.
     SO THE ROW IS ASKED. The assertions below still test the PANE; only the
     way a case is identified moved, which is the half that had to. */
  /* ═══ CHANGE vs NOT-A-CHANGE (rework §6.4) ═══
     This split three ways — change / renewal / assign — and read the kind off
     the ROW, where §4.4 had put it in words. §6.4 collapses the row to TWO
     labels, and the parity pack §5 then renamed both of them: `Change
     requested` for a change, `Presentation review` for both a first assignment
     and a renewal. Each rename broke this matcher in turn; see the note at the
     matcher itself.
     THE TWO-WAY SPLIT IS THE RIGHT ONE FOR THESE CLAIMS, and collapsing to it
     makes them STRONGER rather than weaker. What the checks actually assert is
     that the pane renders the code on record as a subordinate `Current ·` line
     WHEN AND ONLY WHEN the code is moving. MEASURED: a change has that line, a
     renewal does not — and neither does a first assignment, which the old
     three-way split never tested at all because it only ever looked for
     `change` and `renewal`.
     So the discriminator is the row's own label, which is reliable, and the
     assertion covers every non-change case. */
  const cases = { change: null, notChange: null, changeOnRecord: null, notChangeOnRecord: null };
  for (let i = 0; i < 14 && (!cases.change || !cases.notChange); i += 1) {
    const row = page.getByRole("treeitem").nth(i);
    const rowText = (await row.innerText()).replace(/\s+/g, " ");
    /* ═══ RETARGETED BY THE PARITY PACK §5 — THE CAPTIONS WERE RENAMED ═══
       They were "Presentation Change" / "Presentation Review". §5 corrects them
       to `Change requested` (not a spec'd value before) and `Presentation
       review` (sentence case), so this matcher stopped finding either case and
       all three checks below went red with `change: false · non-change: false`.
       A PROBE ARTIFACT, NOT AN APP DEFECT: the pane's behaviour is unchanged,
       and the claims below are unchanged. Only the string the case is
       IDENTIFIED by moved — the same retarget this file already carries one
       layer up, where §6.4 collapsed three labels to two.
       MATCHING BOTH SPELLINGS WOULD BE THE WRONG FIX: the old strings are gone
       and a matcher that accepts them would pass against a regression that
       brought them back. */
    if (!/(Change requested|Presentation review)/.test(rowText)) continue;
    await row.click();
    await page.waitForTimeout(280);
    const pt = (await page.locator('[data-slot="task-pane"]').innerText()).replace(/\s+/g, " ");
    const kind = /Change requested/.test(rowText) ? "change" : "notChange";
    if (!cases[kind]) {
      cases[kind] = pt;
      /* §3 · THE PRIOR CODE IS A LOZENGE, SO READ THE LOZENGE. The word
         "Current" is gone, replaced by a directional glyph, so the subordinate
         line can no longer be identified from prose. The `onRecord` tone is
         rendered by exactly one element and only when a code is superseded. */
      const onRec = page.locator('[data-code-tone="onRecord"]').first();
      cases[`${kind}OnRecord`] =
        (await onRec.count()) > 0 ? await onRec.getAttribute("data-billing-code") : null;
    }
  }
  check(
    "tasks.cases-found",
    "a change and a non-change were both reachable",
    !!cases.change && !!cases.notChange,
    `change: ${!!cases.change} · non-change: ${!!cases.notChange}`
  );
  /* ═══ RETARGETED BY §3 — THE WORD "Current" IS GONE ═══
     This tested `/Current/` plus a code. §3 replaces the word with the
     directional glyph node 4324:1111 puts there: "live currently renders
     `Current F33.0 …` — the code is now in a lozenge, but there is no
     differentiated treatment and no directional glyph."
     THE CLAIM IS UNCHANGED and is what this still asserts: a CHANGE renders the
     code on record as a subordinate line. What moved is how the line says
     "this is what is being superseded" — a glyph rather than a noun — so the
     check reads the lozenge's own tone attribute instead of prose. Stronger
     than the string it replaces: `onRecord` can only appear on a code the
     module rendered through the shared component. */
  check(
    "tasks.current-line",
    "a CHANGE renders the code on record as a subordinate line",
    !!cases.change && !!cases.changeOnRecord,
    cases.changeOnRecord ? `onRecord lozenge: ${cases.changeOnRecord}` : "none"
  );
  check(
    "tasks.no-line-on-renewal",
    "and a NON-CHANGE renders none — the code would be stated twice",
    cases.notChange && !(cases.notChangeOnRecord),
    cases.notChangeOnRecord ? `onRecord present: ${cases.notChangeOnRecord}` : "none, as expected"
  );
  check("tasks.no-on-record-strip", "and the old context strip is gone", !/On record/.test(t));

  /* ═══ ONE BILLING-CODE LOZENGE, ON SCREEN (elevation pack §3) ═══
     "One lozenge component for billing codes across every state and every
     surface." The source half of this is `billing-code-lozenge.test.ts`, which
     asserts the component is DEFINED once. This is the half that catches a new
     inline chip: it walks the rendered pane for code-SHAPED text sitting
     outside the component.

     THE SHAPE, NOT A FIXTURE VALUE. `F33.0` / `F43.22` / `G14.2` are all
     letter + two digits + optional dot-decimal, so the regex matches the class
     of thing rather than the three codes today's fixtures happen to hold — a
     renamed fixture cannot hide an orphan from it.
     THIS IS HOW THE TWO EXTRA RENDERINGS WERE FOUND. Reading the file found
     the inline chip; only walking the DOM found the `Current · F33.0` line,
     which was not a chip at all but plain mono text at an inherited 12.5px. */
  const codes = await page.evaluate(`(() => {
    const owned = [...document.querySelectorAll("[data-billing-code]")].map((e) => ({
      code: e.getAttribute("data-billing-code"),
      tone: e.getAttribute("data-code-tone"),
      size: getComputedStyle(e).fontSize + "/" + getComputedStyle(e).lineHeight,
      radius: getComputedStyle(e).borderTopLeftRadius,
    }));
    const orphans = [];
    for (const e of document.querySelectorAll("span, div, p, dd, td")) {
      if (e.children.length) continue;
      const txt = (e.textContent || "").trim();
      if (!/^[A-Z]\\d\\d(\\.\\d+)?$/.test(txt)) continue;
      if (e.closest("[data-billing-code]")) continue;
      orphans.push(txt + " :: " + (e.className || "").toString().slice(0, 48));
    }
    return { owned, orphans };
  })()`);

  check(
    "tasks.codes-found",
    "the pane renders at least one billing code, so the next two mean something",
    codes.owned.length + codes.orphans.length > 0,
    `${codes.owned.length} owned · ${codes.orphans.length} orphan(s)`
  );
  check(
    "tasks.one-lozenge",
    "and every one of them is the shared lozenge",
    codes.orphans.length === 0,
    codes.orphans.length ? codes.orphans.join(" | ") : "0 orphans"
  );
  /* ONE SHAPE AND ONE TYPE SIZE ACROSS EVERY TONE. Two call sites of one
     component can still diverge if a caller overrides the geometry, so the
     rendered result is compared rather than the import. */
  const shapes = [...new Set(codes.owned.map((c) => `${c.size}|${c.radius}`))];
  check(
    "tasks.one-lozenge-shape",
    "and they share one shape and one type size",
    shapes.length <= 1,
    `${codes.owned.map((c) => c.code + "/" + c.tone).join(", ")} — ${shapes.join(" vs ")}`
  );
  /* ═══ INVERTED — THE ACCORDION IS REMOVED (Figma alignment §3) ═══
     This asserted the mentorship figures lived in a collapsed accordion on the
     pane, with a second check that it started collapsed and said what it held.
     §3 removes it, on an authorised fork of this module from the Care page.
     THE ASSERTION IS NOW THE ABSENCE, and it is stated rather than deleted for
     the reason this codebase states every removal: the accordion is the one
     change in the §3 set that removes CLINICAL CONTEXT rather than chrome —
     arch-F's own note argued "the mentorship length is the one figure that
     changes how the rest reads" — so its absence is worth a check that names
     what went and where it went to.
     IT FAILS THE DAY IT COMES BACK, which is the right way round: if the
     figure is wanted again, this is the line that says the old collapsed-state
     assertions above should come back with it.

     ═══ RETARGETED BY THE REWORK'S §7 — IT CAME BACK, AND THIS IS THE LINE ═══
     §7 asked for the mentor and the mentorship length on this pane, which is
     the second look the note above asked for before the removal shipped. So
     `tasks.no-record-context` is RETIRED BY SUPERSESSION rather than relaxed,
     and it did its job: it named the decision, it named who could reverse it,
     and it failed on the reversal.
     THE COLLAPSED-STATE ASSERTIONS COME BACK WITH IT, exactly as instructed,
     and one more that §7 adds: the block names the MENTOR now, which it did
     not before. `tasks.no-mentor` below is retargeted for the same reason —
     see its own note. */
  /* ═══ RETARGETED AGAIN BY THE ROW-LAYOUT PASS's §3 — AND NOT RELAXED ═══
     §7 put the figures in a collapsed accordion and these three checks
     asserted that. §3.3 removes it: "Remove the disclosure entirely. Nothing
     hides." So the accordion assertions are RETIRED BY SUPERSESSION for the
     second time in this block's life, and the supersession is named because
     that is the only thing distinguishing a retarget from a relaxation.

     WHAT §7 WAS PROTECTING IS UNCHANGED AND IS WHAT THIS ASSERTS NOW. §7's
     claim was never "there is an accordion" — it was "the mentorship figures
     and the mentor's name are on this pane", and arch-F's note is why it
     mattered: "the mentorship length is the one figure that changes how the
     rest reads". §3 moves that content into the header band, so the check
     moves with it.

     IT IS STRICTLY STRONGER THAN WHAT IT REPLACES, which is the test a
     retarget has to pass. The old version was satisfied by an accordion whose
     contents a reader never opened; this one requires the figures to be
     VISIBLE, requires the mentor's name beside an explicit role label, and
     requires that nothing in the band hides them — the last of which the old
     version could not have expressed, because hiding them was the design. */
  const strip = page.locator('[data-slot="record-context"]');
  check(
    "tasks.no-record-strip",
    "the bordered mentorship strip is gone (§3.3 — deleted, not moved)",
    (await strip.count()) === 0,
    `${await strip.count()} strip(s)`
  );

  const band = page
    .locator("[data-pane-teen]")
    .locator("xpath=ancestor::div[contains(@class,'shrink-0')][1]");
  const metrics = band.locator("dl");
  check(
    "tasks.engagement-visible",
    "and the engagement figures are on screen in the header, not behind anything",
    (await metrics.count()) === 1 && (await metrics.first().isVisible()),
    `${await metrics.count()} dl(s)`
  );
  if (await metrics.count()) {
    /* ═══ PER-PAIR, AND THE FIRST VERSION OF THIS WAS WRONG ═══
       It read the whole list's text and tested `/Mentorship/i && /\d+d/`.
       MUTATION-TESTED, THAT PASSED WITH THE DURATION DELETED: "Messages 30d"
       supplies a `\d+d` match, so the assertion was satisfied by the label of
       a DIFFERENT metric. Reading each pair's own `<dd>` through its
       `data-metric` handle is what makes the check name what it means — the
       same fix `today-mirror`'s open-count check needed for the same reason. */
    const dd = async (id) => {
      const n = metrics.first().locator(`[data-metric="${id}"] dd`);
      return (await n.count()) ? (await n.first().innerText()).trim() : null;
    };
    const dur = await dd("mentorship");
    const durLabelEl = metrics.first().locator('[data-metric="mentorship"] dt');
    const durLabel =
      (await durLabelEl.count()) > 0
        ? (await durLabelEl.first().innerText()).replace(/\s+/g, " ")
        : null;
    /* ═══ THE FIGURE arch-F CALLED LOAD-BEARING, BY NAME ═══
       The mentorship duration is the one §7 kept visible in the collapsed
       state, so it is the one asserted here.

       ═══ RETARGETED BY §5.1 — THE UNIT MOVED OUT OF THE VALUE ═══
       This required `/^\d+d$/`, i.e. "140d", on the reasoning that "a figure
       with no unit is what `Mentorship 140` would be". §5.1 settles the unit
       question the other way and gives the reason this check could not see: two
       patterns were running side by side, `Mentorship 140d` putting the unit in
       the value and `Messages 30d 62` putting the window in the label. One
       pattern now — "pure number as the value, units and windows in the label".
       THE CLAIM IS UNCHANGED AND IS STILL BOTH HALVES: a figure, and its unit
       stated somewhere a reader can see. It just reads the PAIR now instead of
       the value, which is what makes it a retarget rather than a relaxation —
       a bare `140` with no "Days" anywhere still fails. */
    check(
      "tasks.engagement-duration",
      "including the mentorship duration, the figure that frames the rest",
      dur !== null &&
        /^\d+$/.test(dur) &&
        durLabel !== null &&
        /day/i.test(durLabel),
      `dd = ${dur === null ? "MISSING" : JSON.stringify(dur)} · dt = ${JSON.stringify(durLabel)}`
    );
    const msgs = await dd("messages");
    /* THE WINDOWED FIGURE STATES ITS WINDOW. "62 messages" without "last 30
       days" cannot be sized — the retired strip's own note said so. The label
       carries it, so the label is read from its own `<dt>`. */
    const dt = metrics.first().locator('[data-metric="messages"] dt');
    const lbl = (await dt.count()) ? (await dt.first().innerText()).replace(/\s+/g, " ") : null;
    /* §5.1 moved the window into the label for this pair too, which is where
       this check was already looking — so it needed no retarget, and that is
       worth noting: the pair that already followed the rule is the one that
       did not break. */
    check(
      "tasks.engagement-window",
      "and the windowed figure names its window rather than standing bare",
      msgs !== null && /^\d+$/.test(msgs) && lbl !== null && /30d|last 30 days/i.test(lbl),
      `dd = ${JSON.stringify(msgs)} · dt = ${JSON.stringify(lbl)}`
    );
  }

  /* ═══ NOTHING IN THE BAND HIDES THE FIGURES ═══
     §3.1's objection was that "two metrics behind a chevron costs a click and
     hides the thing that would have oriented the supervisor before they read
     anything else". This is that objection as an assertion, scoped to the
     header band so the pane's OTHER legitimate disclosures — the assessment
     score strip — do not fail it. */
  const inBand = await band.locator("[aria-expanded]").count();
  check(
    "tasks.header-has-no-disclosure",
    "and the header band holds no disclosure at all",
    inBand === 0,
    `${inBand} disclosure(s) in the band`
  );

  const ctx2 = (await band.innerText()).replace(/\s+/g, " ");
  /* ═══ §3.2's ROLE LABEL, WHICH IS THE POINT OF NAMING THE MENTOR AT ALL ═══
     "Without it, two names near each other are ambiguous about who is who,
     which is the same defect the escalation cards had." So the name alone is
     not enough — the label has to be beside it.

     ═══ RETARGETED TWICE, AND THE SECOND TIME IT TIMED OUT ═══
     Version 1 tested `/MENTOR/i` over the whole band and PASSED with the role
     label deleted, because the metrics contain the word "Mentorship".
     Version 2 read the context line's `<p>` and matched an exact `^Mentor$`
     span. §3 replaced that line with a CHIP — a `<span>`, no paragraph — so the
     locator waited 30s for a `<p>` that no longer exists and the probe crashed
     rather than failing a check. A locator that cannot find its subject is not
     a verdict, which is why this now reads the chip by its own handle.
     THE CLAIM IS UNCHANGED: a role word, and a name, inside one contained
     element. Asserting them on the CHIP is stricter than asserting them on the
     band, because the band also contains the metrics. */
  const chip = band.locator('[data-anno-ref="mentor-chip"]');
  const chipCount = await chip.count();
  check(
    "tasks.header-has-mentor-chip",
    "the mentor is a contained chip, not a run of text (§3)",
    chipCount === 1,
    `${chipCount} chip(s)`
  );
  const chipText =
    chipCount > 0 ? (await chip.first().innerText()).replace(/\s+/g, " ").trim() : "";
  check(
    "tasks.header-names-mentor-with-role",
    "and it states the role beside the name (§3.2)",
    /\bMentor\b/.test(chipText) &&
      /[A-Z][a-z]+ [A-Z][a-z]+/.test(chipText.replace(/Mentor/g, "")),
    JSON.stringify(chipText)
  );
  /* §3's CLICKABILITY DECISION, ASSERTED. It is not a link — there is no mentor
     record to link to — so §3's "it must not look interactive" is the half that
     has to hold: no tab stop, and a `span` rather than a button or an anchor. */
  if (chipCount > 0) {
    const tag = await chip.first().evaluate((e) => e.tagName);
    const tabbable = await chip.first().evaluate((e) => e.tabIndex >= 0);
    check(
      "tasks.mentor-chip-not-interactive",
      "and does not present as interactive (§3, decided: no mentor record exists)",
      tag === "SPAN" && !tabbable,
      `<${tag.toLowerCase()}> tabbable=${tabbable}`
    );
  }

  check(
    "tasks.no-mentor-in-prose",
    "and the review prose still does not address a mentor by name",
    /* THE EXCLUSION MOVED WITH THE CONTENT. It used to subtract the accordion's
       text before testing; the mentor's name is in the header band now, so that
       is what comes out. Same claim, same shape, new location. */
    !/to [A-Z][a-z]+ [A-Z]/.test(t.replace(ctx2, ""))
  );
  await page.locator('[data-slot="task-pane"]').screenshot({ path: `${OUT}/tasks-pane.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE SAME SECTIONS, IN THE SAME ORDER, ON BOTH SURFACES.
// ═══════════════════════════════════════════════════════════════════════════
//
// Section ORDER rather than pixels: the two hosts frame the module differently
// by design (a card on one, a pane on the other) and a pixel comparison would
// fail on the frame while missing a reordering inside it.
{
  const order = async (page, scope) =>
    page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const text = root.innerText;
      const marks = [
        ["recommendation", "Recommended presentation"],
        ["rationale", "Rationale"],
        ["evidence", "Assigned assessment"],
      ];
      return marks
        .map(([id, needle]) => [id, text.indexOf(needle)])
        .filter(([, i]) => i >= 0)
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id);
    }, scope);

  const a = await open("order-tasks", "/app/care-reviews");
  const tasksOrder = await order(a.page, '[data-slot="task-pane"]');
  await a.context.close();

  const b = await open("order-care", "/admin/person/t19?tab=care");
  await openCareReview(b.page);
  const careOrder = await order(b.page, "main");
  await b.context.close();

  check(
    "order.match",
    "the module's sections read in the same order on both",
    tasksOrder.length === 3 && tasksOrder.join(">") === careOrder.join(">"),
    `tasks ${tasksOrder.join(" > ")} | care ${careOrder.join(" > ")}`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE PICKER BEHAVES THE SAME WAY ON BOTH HOSTS.
// ═══════════════════════════════════════════════════════════════════════════
//
// It moved INTO the module, so the focus return, the revert affordance and the
// "picking the code on record is not a change" rule now have one implementation.
// This is the check that the second host actually gets them.
//
// REAL CLICKS, and that matters: driving this through the in-app browser pane
// with programmatic `.click()` reported focus landing on `<body>` on Tasks and on
// the button on Care, which looked exactly like a host-specific defect and was an
// artifact of a pane that does not hold OS focus. A synthetic click is not an
// input event.
/* ═══ THE TWO HOSTS NAME THE CODE ON RECORD DIFFERENTLY ═══
   Tasks' subordinate line says "Current"; Care's spine says "Primary
   presentation". Both are the same fact, and the module is indifferent to which
   — it marks whatever code it is handed. Recorded here rather than unified,
   because unifying the two labels is a naming decision on the record page and
   nothing in arch-E touched it: one more entry for the copy pass. */
for (const [label, url, prep, onRecordRe] of [
  /* THE HOST'S WORDING CHANGED WITH THE BLOCK (arch-F): "On record F33.1"
     became "Current · F33.1" beneath the recommendation title. The picker's own
     marker still reads "On record" — that string is the module's. */
  /* ═══ RETARGETED BY §3 — SAME SUPERSESSION AS `tasks.current-line` ═══
     It read the code out of "Current · F33.1" and §3 removed the word, so the
     regex matched nothing and the picker checks downstream reported "no code to
     search for" — a probe with no input, not a product defect.
     THE LOZENGE IS THE SOURCE NOW: the prior code is the only `onRecord`-toned
     element on the pane, so this asks the DOM for it instead of parsing prose.
     `null` here means "not a regex over body text" — see the branch below. */
  ["tasks", "/app/care-reviews", null, null],
  ["care", "/admin/person/t19?tab=care", openCareReview, /Primary presentation[\s\S]{0,40}?([A-Z]\d+\.\d+)/],
]) {
  const { context, page } = await open(`picker-${label}`, url);
  if (prep) await prep(page);
  /* ═══ WALK TO A CHANGE ROW BEFORE OPENING THE PICKER ═══
     The subordinate line only renders when the code on record DIFFERS from the
     recommendation (arch-G, G1), so a renewal-selected pane has no code for this
     section to look for. It has to happen before the dialog opens: a modal
     blocks pointer events on the list behind it, and the first version of this
     walk timed out clicking a row under the open picker. */
  if (label === "tasks") {
    for (let i = 0; i < 14; i += 1) {
      /* ═══ THE WALK'S STOP CONDITION MOVED WITH THE LINE (§3) ═══
         It stopped on the string "Current ·", with a note about normalising
         `innerText` because a newline fell between the two spans. §3 removed the
         word, so the walk ran all fourteen rows, stopped on none, and the two
         checks below reported "no code to search for" — a probe with no input.
         THE DOM IS THE CONDITION NOW: the `onRecord` lozenge exists exactly when
         a code is being superseded, which is the state this walk is looking
         for. No normalisation needed, because it is not reading prose. */
      if (await page.locator('[data-code-tone="onRecord"]').count()) break;
      await page.getByRole("treeitem").nth(i).click();
      await page.waitForTimeout(260);
    }
  }
  /* PER SURFACE — see the assertion table above. */
  const btn = page
    .getByRole("button", { name: /^Change (code|presentation)$/ })
    .first();
  check(`picker.${label}.control`, "the module's picker control is present", await btn.count());
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(500);
    /* ═══ SEARCH FOR THE CODE FIRST, AND THAT IS THE POINT OF THE FIX ═══
       This read the marker off the dialog's opening shortlist, which made the
       check depend on whether the host's on-record code happened to be one of
       the six common presentations. arch-E reordered Tasks, the default row
       became a teen on F33.1, F33.1 is not in the shortlist, and the check
       failed against a module that marks the code correctly — verified by hand:
       searching "F33.1" renders "1 match · Major depressive disorder,
       recurrent, moderate · F33.1 · On record". The claim is that the module
       marks the code the HOST states, so the probe now asks the host what that
       code is and looks for it where it can be seen. */
    /* THE HOST STATES THE CODE EITHER AS A LOZENGE OR IN PROSE, depending on
       which host it is. Tasks renders the prior code through
       `BillingCodeLozenge` with `tone="onRecord"`; the Care page still states a
       "Primary presentation" line. One branch each, rather than one regex that
       has to cover both. */
    const onRecordCode = onRecordRe
      ? (await page.locator("body").innerText()).match(onRecordRe)?.[1]
      : await page
          .locator('[data-code-tone="onRecord"]')
          .first()
          .getAttribute("data-billing-code")
          .catch(() => null);
    check(`picker.${label}.host-states-code`, "the host states a code to look for", !!onRecordCode, onRecordCode ?? "none");
    const search = page.getByRole("dialog").locator('input[aria-label^="Search presentations"]').first();
    if (onRecordCode) {
      await search.fill(onRecordCode);
      await page.waitForTimeout(500);
    }
    const onRecord = onRecordCode ? await page.getByRole("dialog").getByText(/On record/).count() : 0;
    check(
      `picker.${label}.on-record`,
      "and the module marks that code in the list",
      onRecord > 0,
      onRecordCode ? `${onRecordCode} · ${onRecord} marked` : "no code to search for"
    );
    await search.fill("");
    await page.waitForTimeout(400);

    await page.getByRole("dialog").getByText(/F43\.22/).first().click();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => ({
      focused: (document.activeElement?.innerText || "").replace(/\s+/g, " ").trim(),
      open: !!document.querySelector('[role="dialog"][data-state="open"]'),
      revert: /Revert back to/.test(document.body.innerText),
      shows: /F43\.22/.test(document.body.innerText),
    }));
    check(`picker.${label}.closes`, "picking closes the dialog", !after.open);
    check(
      `picker.${label}.focus`,
      "and hands the keyboard back to the control",
      /^Change (code|presentation)$/.test(after.focused ?? ""),
      after.focused
    );
    check(`picker.${label}.moves`, "the recommendation moves with the decision", after.shows);
    check(`picker.${label}.revert`, "and offers the way back out", after.revert);
  }
  await context.close();
}

await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
