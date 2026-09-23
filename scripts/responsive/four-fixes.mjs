// Verification for the four fixes of 2026-08-31. One question per fix, answered
// from the DOM rather than from a screenshot.
//
//  1 · Care summary — no "AI" tag at rest; the info button opens one.
//  2 · Tasks — no "Since you were last here" strip.
//  3 · Left rail — no horizontal scroll (nav-overflow.mjs owns this one).
//  4 · /admin/review as a supervisor — the console renders, in the console's own
//      chrome, with review actions, instead of redirecting to the record.
import { chromium } from "playwright";
import { STORE_KEY, buildStoreSeed, readStoreVersion } from "./harness.mjs";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

const BASE = process.env.RESPONSIVE_BASE ?? "http://localhost:3003";
const version = await readStoreVersion();
const b = await chromium.launch();

async function pageAs(persona, path, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const seed = buildStoreSeed({ persona, ...extra }, version);
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [STORE_KEY, seed]
  );
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  return p;
}

let fails = 0;
const check = (ok, label, detail = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
};

// ── 1 · CARE SUMMARY ────────────────────────────────────────────────────────
console.log("\n═══ 1 · Care summary: the AI tag lives in the hover ═══");
{
  const p = await pageAs("supervisor", "/admin/person/t13?tab=care", { published: true });
  const card = p.locator('[data-record-section="care-summary-doc"]');
  await card.first().waitFor({ timeout: 15000 }).catch(() => {});
  const n = await card.count();
  check(n > 0, "the summary card renders", `${n} card(s)`);
  if (n > 0) {
    // "AI" as a standalone word in visible text — the old pill.
    const visibleAI = await card.first().evaluate((el) =>
      Array.from(el.querySelectorAll("*"))
        .filter((n) => {
          const t = Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent.trim()).join("");
          if (t !== "AI") return false;
          const r = n.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).length
    );
    check(visibleAI === 0, "no AI tag visible at rest", `${visibleAI} found`);
    const infos = card.first().locator('button[aria-label="About this generated text"]');
    const ic = await infos.count();
    check(ic > 0, "each section keeps its info button", `${ic} button(s)`);
    if (ic > 0) {
      await infos.first().click();
      await p.waitForTimeout(250);
      const panel = p.locator('[role="note"]').first();
      const txt = (await panel.textContent()) ?? "";
      check(txt.trim().startsWith("AI"), "the panel leads with the AI tag", JSON.stringify(txt.slice(0, 30)));
      check(!txt.includes("AIAI-generated"), "the tag and the note do not both say AI");
      check(txt.includes("not itself a clinical determination"), "the panel still carries the note");
      await p.keyboard.press("Escape");
      await p.waitForTimeout(200);
      check((await p.locator('[role="note"]').count()) === 0, "Escape dismisses it (SC 1.4.13)");
    }
  }
  await p.context().close();
}

// ── 2 · TASKS ───────────────────────────────────────────────────────────────
console.log("\n═══ 2 · Tasks: the shift digest is gone ═══");
{
  const p = await pageAs("supervisor", "/app/care-reviews", { published: true });
  const body = (await p.locator("body").textContent()) ?? "";
  check(!body.includes("Since you were last here"), "no \"Since you were last here\"");
  check(!body.toLowerCase().includes("since your last shift"), "no shift-digest variant either");
  // The tabs are still there and still first — the thing that was above them.
  const tabs = await p.locator('[role="tab"]').count();
  check(tabs > 0, "the domain tabs still render", `${tabs} tab(s)`);
  await p.context().close();
}

// ── 4 · SUPERVISOR REVIEW ───────────────────────────────────────────────────
console.log("\n═══ 4 · A supervisor can review a new mentor's profile ═══");
for (const persona of ["supervisor", "admin", "lead-mentor", "mentor"]) {
  const p = await pageAs(persona, "/admin/review", { status: "in_review" });
  await p.waitForTimeout(1200);
  const url = new URL(p.url()).pathname;
  const body = (await p.locator("body").textContent()) ?? "";
  const mayReview = persona !== "mentor" && persona !== "new-mentor";
  if (mayReview) {
    check(url === "/admin/review", `${persona}: stays on the review console`, url);
    // The review console's own verb. Present only when the page really rendered.
    const hasAction = /Start review|Approve|Request changes/i.test(body);
    check(hasAction, `${persona}: review actions render`);
  } else {
    check(url !== "/admin/review", `${persona}: still redirected away`, url);
  }
  // WHOSE CHROME. The lead reviews inside the mentor app; the console tiers keep
  // the console rail. `navLabel` is the rail's accessible name, so it names the
  // shell without depending on a class.
  const rail = await p.locator("aside nav[aria-label]").first().getAttribute("aria-label").catch(() => null);
  if (url === "/admin/review") {
    // The console rail names itself "Supervisor sections" — that string IS the
    // AdminShell chrome, which is what the two console tiers should get.
    const want = persona === "lead-mentor" ? /Mentor navigation/i : /Supervisor sections/i;
    check(want.test(rail ?? ""), `${persona}: correct shell chrome`, `rail="${rail}"`);
  }
  await p.context().close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
