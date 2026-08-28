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
// So the harness does what a lead mentor does: opens the changeset, writes a
// note, and sends it back. The snapshot is then whatever the app itself created.
// Slower and more brittle per run; correct.
// ═══════════════════════════════════════════════════════════════════════════

import { STORE_KEY } from "./harness.mjs";

/** The field the harness seeds a pending changeset for — `buildStoreSeed` puts
 *  one `bio` field in `profileUpdate`, and the note textarea's id is derived
 *  from the fieldId (`admin/profile-update/page.tsx`). */
const FIELD = "bio";

/** Drive a real admin send-back, then hand the page back to the mentor.
 *
 *  Returns `{ ok, reason }` rather than throwing: a flow that cannot complete
 *  should mark its row unreached, not fail the whole baseline run. */
export async function driveReject(page, targetUrl, base) {
  try {
    // ── 1. The lead opens the changeset ────────────────────────────────────
    await page.goto(`${base}/admin/profile-update`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(800);

    // `/admin/profile-update` is LEAD-ONLY and redirects everyone else
    // (`page.tsx:96`), so a wrong persona lands somewhere harmless and silently.
    // Check rather than assume.
    const landed = await page.evaluate(() => location.pathname);
    if (!landed.startsWith("/admin/profile-update")) {
      return { ok: false, reason: `redirected to ${landed} (persona not lead?)` };
    }

    // ── 2. Open the field's disclosure ─────────────────────────────────────
    //
    // The note textarea only renders when the row is open (`isOpen =
    // open[fieldId] || isFlagged`), so the toggle has to be pressed before the
    // field exists to fill.
    const row = page.locator(`[data-diff-field="${FIELD}"]`);
    if ((await row.count()) === 0) {
      return { ok: false, reason: "no pending changeset row — seed missing?" };
    }
    const toggle = row.locator("button").first();
    await toggle.click().catch(() => {});
    await page.waitForTimeout(300);

    // ── 3. Write the note ─────────────────────────────────────────────────
    //
    // `hasNotes` gates the send-back button, so a blank note leaves it disabled
    // and the flow would appear to run while changing nothing.
    const note = page.locator(`#pu-note-${FIELD}`);
    if ((await note.count()) === 0) {
      return { ok: false, reason: "note field did not open" };
    }
    await note.fill("Harness: driving the rejected lifecycle.");
    await page.waitForTimeout(200);

    // ── 4. Send it back ───────────────────────────────────────────────────
    const send = page.getByRole("button", { name: /send back/i }).first();
    if ((await send.count()) === 0) {
      return { ok: false, reason: "send-back button absent" };
    }
    await send.click();
    await page.waitForTimeout(1000);

    // ── 5. Confirm the app actually wrote a snapshot ───────────────────────
    //
    // The whole point of driving this is that the snapshot is the app's. If it
    // is empty the flow silently did nothing, and reporting the row as reached
    // would be the exact dishonesty this file exists to avoid.
    const wrote = await page.evaluate((key) => {
      try {
        const s = JSON.parse(localStorage.getItem(key) ?? "{}");
        return Array.isArray(s?.state?.changeRequests)
          ? s.state.changeRequests.length
          : 0;
      } catch {
        return 0;
      }
    }, STORE_KEY);
    if (!wrote) {
      return { ok: false, reason: "send-back produced no changeRequests" };
    }

    // ── 6. Become the mentor and go to the target view ────────────────────
    //
    // The rejected state belongs to the MENTOR's view of it. Written straight to
    // the store and then hard-navigated: a full load rehydrates from
    // localStorage, so there is no race with `persist` flushing over the top —
    // the failure mode measured in Phases 4 and 6.
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
