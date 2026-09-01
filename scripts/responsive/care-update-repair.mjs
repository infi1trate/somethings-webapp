// THE CRASH THAT TOOK DOWN THE WHOLE PERSON RECORD, AND ITS TWO GUARDS.
//
// `careUpdateToEvent` read `u.body[s.id].trim()` on a PERSISTED body. A stored
// update missing a section key threw `Cannot read properties of undefined`
// through alertsForTeen → RecordTaskRegions → PersonRecordPage, so the record
// rendered nothing on any tab.
//
// This seeds exactly that malformed record and asserts the page survives it —
// then asserts the store REPAIRED it, so the bad shape does not outlive the load.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};

// Four shapes of broken, because the guard has to hold for all of them.
const BROKEN = {
  "missing one section": { clinical: "Some clinical prose.", assessment: "maintained" },
  "missing both sections": { assessment: "improved" },
  "body is empty": {},
  "field is not a string": { clinical: 42, diagnostic: null, assessment: "escalated" },
};

const b = await chromium.launch();
for (const [label, body] of Object.entries(BROKEN)) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [KEY, {
      state: {
        persona: "supervisor",
        careUpdates: {
          "cu-t17-broken": {
            id: "cu-t17-broken",
            teenId: "t17",
            createdAt: Date.now() - 86400000,
            author: "Dr. Amara Patel",
            authorRole: "Supervisor",
            body,
          },
        },
      },
      version: VERSION,
    }]
  );
  const p = await ctx.newPage();
  const pageErrors = [];
  p.on("pageerror", (e) => pageErrors.push(String(e).split("\n")[0].slice(0, 160)));

  console.log(`\n═══ stored care update: ${label} ═══`);
  for (const tab of ["overview", "care"]) {
    await p.goto(`${BASE}/admin/person/t17?tab=${tab}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => ({
      len: document.body.innerText.length,
      crashed: /Application error|client-side exception/i.test(document.body.innerText),
    }));
    check(!r.crashed && r.len > 400, `?tab=${tab} renders`, `len=${r.len}`);
  }
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors[0] ?? "");

  // THE REPAIR: the rehydrate should have backfilled the missing keys.
  const repaired = await p.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)).state;
    return s.careUpdates?.["cu-t17-broken"]?.body ?? null;
  }, KEY);
  check(
    repaired && typeof repaired.clinical === "string" && typeof repaired.diagnostic === "string",
    "the stored body was repaired to strings",
    JSON.stringify(repaired)
  );
  // AND THE PROSE SURVIVED. A repair that overwrites a supervisor's clinical text
  // would be far worse than the crash it fixes.
  if (typeof body.clinical === "string") {
    check(repaired.clinical === body.clinical, "existing prose untouched by the repair");
  }
  await ctx.close();
}

await b.close();
console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
