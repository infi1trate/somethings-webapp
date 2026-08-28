// ═══════════════════════════════════════════════════════════════════════════
// DRIVEN FLOWS — states that cannot honestly be seeded.
//
// Only one so far, and it is one on principle rather than convenience.
//
// ═══ WHY `rejected` IS DRIVEN AND NOT SEEDED ═══
//
// Standing rule 1: the changeRequests baseline snapshot is captured at the
// MOMENT OF ADMIN REJECTION and is never re-derived from current state. A seeder
// that writes `changeRequests` with hand-authored `baselineValue`s manufactures
// exactly the artifact that rule protects — the screenshots would show a
// snapshot production could never produce, which is worse than no screenshots
// because it looks like evidence.
//
// So the harness does what a lead mentor does: opens the review, flags a field,
// writes a note, and submits. The snapshot is then whatever the app itself
// created. Slower and more brittle per run; correct.
//
// ═══ THE FIRST VERSION DROVE THE WRONG FLOW (gap row 277) ═══
//
// It drove `/admin/profile-update`, and the whole Phase 8 baseline reported A4r
// as unreached with `send-back produced no changeRequests` — nine times, once
// per viewport. The driver was not flaky. It was pointed at a different feature:
//
//   · `/admin/profile-update` → `sendBackProfileUpdate` writes
//     `profileUpdate.status = "changes-requested"` and per-field `adminNote`.
//     It NEVER touches `changeRequests`. That surface reviews POST-PUBLISH edits
//     to an already-live profile.
//   · `/admin/review` → `submitReject` (`page.tsx:201`) is the only writer of
//     `changeRequests` outside the store, and A4r's URL is
//     `/onboarding/submitted` — the WIZARD's screen. The wizard's rejection
//     mechanism is `changeRequests`. That is the flow A4r needs.
//
// Two surfaces, both "an admin sends work back with notes", different stores.
// The step-5 assertion is what caught it: it checked the field the row actually
// needs rather than trusting that a clicked button did something, so the run
// reported the row unreached instead of capturing nine screenshots of an
// unrejected profile. Keep that assertion pointed at the END STATE, never at
// "did the click land".
//
// ═══ WHY `?focus=` INSTEAD OF CLICKING THE CHECKBOX ═══
//
// `/admin/review` accepts `?focus=<stepId>`, which opens review mode with that
// field already flagged (`page.tsx:84-89`) — the Mentor Record's own
// "request a change here" entry point. Using it skips two fragile steps: the
// idle→review mode transition, and toggling a Radix checkbox whose only handle
// is an aria-label containing an em-dash. A deep link the product already
// supports is a more honest driver than a click path invented for the harness.
// ═══════════════════════════════════════════════════════════════════════════

import { STORE_KEY } from "./harness.mjs";

/** The step the harness flags. A FROZEN slug (standing rule 2) read from
 *  `profile-sections.ts`, not invented here — `bio` is mentor-managed, so it is
 *  in `MENTOR_MANAGED_SECTIONS` and therefore eligible for `submitReject`. */
const STEP = "bio";

/** `submitReject` awaits `simulateReview`, a deliberate 600ms mock latency
 *  (`mock-api.ts:81`), and only then writes the store — so the write lands
 *  strictly after the click. Polled rather than slept against a fixed number:
 *  a fixed wait either flakes under load or pads every run. */
async function waitForChangeRequests(page, budgetMs = 5000) {
  const step = 250;
  for (let waited = 0; waited <= budgetMs; waited += step) {
    const n = await page
      .evaluate((key) => {
        try {
          const s = JSON.parse(localStorage.getItem(key) ?? "{}");
          return Array.isArray(s?.state?.changeRequests)
            ? s.state.changeRequests.length
            : 0;
        } catch {
          return 0;
        }
      }, STORE_KEY)
      .catch(() => 0); // a navigation mid-evaluate is expected: submitReject pushes
    if (n > 0) return n;
    await page.waitForTimeout(step);
  }
  return 0;
}

/** Drive a real admin rejection, then hand the page back to the mentor.
 *
 *  Returns `{ ok, reason }` rather than throwing: a flow that cannot complete
 *  should mark its row unreached, not fail the whole baseline run. */
export async function driveReject(page, targetUrl, base) {
  try {
    // ── 1. The lead opens the review, field pre-flagged ────────────────────
    await page.goto(`${base}/admin/review?focus=${STEP}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(800);

    // A NON-LEAD IS NOT REDIRECTED HERE — `page.tsx:208` renders a quiet empty
    // shell for anyone else. So a pathname check would pass while the page is
    // blank, and the pathname is NOT the signal. The note field is: it exists
    // only when review mode is open, which requires the lead gate to have
    // passed. Check the thing that has to be true, not a proxy for it.
    const note = page.locator(`#note-${STEP}`);
    if ((await note.count()) === 0) {
      const persona = await page
        .evaluate((key) => {
          try {
            return JSON.parse(localStorage.getItem(key) ?? "{}")?.state?.persona;
          } catch {
            return "?";
          }
        }, STORE_KEY)
        .catch(() => "?");
      return {
        ok: false,
        reason: `review mode did not open (persona=${persona}, needs lead-mentor)`,
      };
    }

    // ── 2. Write the note ─────────────────────────────────────────────────
    //
    // `canSubmit` needs every flagged row to carry a note, so a blank one leaves
    // the button disabled and the flow would appear to run while changing
    // nothing.
    await note.fill("Harness: driving the rejected lifecycle.");
    await page.waitForTimeout(200);

    // ── 3. Submit ─────────────────────────────────────────────────────────
    const submit = page.getByRole("button", { name: /submit review/i }).first();
    if ((await submit.count()) === 0) {
      return { ok: false, reason: "submit button absent" };
    }
    if (await submit.isDisabled()) {
      return { ok: false, reason: "submit still disabled — note did not register" };
    }
    await submit.click();

    // ── 4. Confirm the app actually wrote a snapshot ───────────────────────
    //
    // The whole point of driving this is that the snapshot is the app's. If it
    // is empty the flow silently did nothing, and reporting the row as reached
    // would be the exact dishonesty this file exists to avoid.
    const wrote = await waitForChangeRequests(page);
    if (!wrote) {
      return { ok: false, reason: "submit produced no changeRequests" };
    }

    // ── 5. Become the mentor and go to the target view ────────────────────
    //
    // The rejected state belongs to the MENTOR's view of it. Written straight to
    // the store and then hard-navigated: a full load rehydrates from
    // localStorage, so there is no race with `persist` flushing over the top —
    // the failure mode measured in Phases 4 and 6.
    //
    // `status` is NOT set here: `submitReject` already set it to "rejected", and
    // overwriting it would replace the app's own state with the harness's guess.
    await page.evaluate((key) => {
      const s = JSON.parse(localStorage.getItem(key) ?? "{}");
      s.state = { ...s.state, persona: "mentor" };
      localStorage.setItem(key, JSON.stringify(s));
    }, STORE_KEY);

    await page.goto(base + targetUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    return { ok: true, changeRequests: wrote };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 160) };
  }
}

export const FLOWS = { reject: driveReject };
