// ═══════════════════════════════════════════════════════════════════════════
// THE READ-ONLY RECORD IS ONE MODULE ON BOTH HOSTS (Closed-tab pack §2, §6.11)
//
// Care Reviews' closed record renders its documentation through
// `CareUpdateBodyView`, the read view the Care page already renders a committed
// care update with. "Shared-module parity applies: both hosts must support it
// identically." So the claim is checked byte for byte: the same body and the
// same per-field provenance, rendered on each host, must produce the same
// `[data-care-update-view]` subtree.
//
// THE SAME RECORD ON BOTH SIDES. `closed-2` in `heavy-caseload` is fixture
// index 1 of `closedHistory` — CLINICAL[1], DIAGNOSTIC[2], `maintained`,
// clinical `ai_inserted`, diagnostic `authored` — so the Care page is seeded
// with exactly that body as its latest care update. The input is asserted on
// both sides before the comparison: two empty subtrees would compare equal.

import { chromium } from "playwright";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

/* Verbatim from `src/lib/tasks/closed-history.ts` — index 1. */
const BODY = {
  clinical:
    "Low mood persists, concentrated in the evenings. The teen has withdrawn from two activities they previously enjoyed and reports more frequent arguments at home.",
  diagnostic:
    "GAD-7 is 12. Worry and restlessness items carry most of the score, consistent with the exam-related pattern the mentor has noted.",
  assessment: "maintained",
};

const seed = (extra) => [
  KEY,
  { state: { persona: "supervisor", tasksScenarioId: "heavy-caseload", ...extra }, version: VERSION },
];
const subtree = (page) =>
  page.evaluate(() => document.querySelector("[data-care-update-view]")?.outerHTML ?? null);

const b = await chromium.launch();

/* ── Care Reviews · the closed record ── */
const c1 = await b.newContext({ viewport: { width: 1600, height: 1000 } });
await c1.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), seed({}));
const p1 = await c1.newPage();
await p1.goto(`${BASE}/app/care-reviews`, { waitUntil: "networkidle" });
await p1.waitForSelector("[data-pane-teen]");
await p1.locator('[data-anno-ref="care-tab:closed"]').click();
await p1.locator('[data-anno-ref="task-row:closed-2"]').click();
await p1.waitForTimeout(500);
const reviews = await subtree(p1);

/* ── Care page · the same body as the latest care update ── */
const c2 = await b.newContext({ viewport: { width: 1600, height: 1000 } });
await c2.addInitScript(
  ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
  seed({
    careUpdates: {
      "cu-parity": {
        id: "cu-parity",
        teenId: "t19",
        createdAt: Date.now(),
        author: "Sasha Rivera",
        authorRole: "Supervisor",
        body: BODY,
        clinicalProvenance: "ai_inserted",
        diagnosticProvenance: "authored",
      },
    },
  })
);
const p2 = await c2.newPage();
await p2.goto(`${BASE}/admin/person/t19?tab=care`, { waitUntil: "networkidle" });
await p2.waitForTimeout(1500);
const care = await subtree(p2);

console.log("\n── the shared read view, Care Reviews vs the Care page");
check(!!reviews && reviews.includes(BODY.clinical), "Care Reviews rendered the closed record's documentation", `${reviews?.length ?? 0} chars`);
check(!!care && care.includes(BODY.clinical), "the Care page rendered the seeded update", `${care?.length ?? 0} chars`);
check(!!reviews && /AI draft inserted, unedited/.test(reviews), "the provenance note is in the compared subtree, so it is compared too");
const same = !!reviews && reviews === care;
check(same, "the two subtrees are byte-identical", same ? `${reviews.length} chars each` : "differ");
if (!same && reviews && care) {
  let i = 0;
  while (i < Math.min(reviews.length, care.length) && reviews[i] === care[i]) i++;
  console.log(`    first difference at ${i}:\n    reviews: …${reviews.slice(Math.max(0, i - 60), i + 80)}\n    care:    …${care.slice(Math.max(0, i - 60), i + 80)}`);
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
