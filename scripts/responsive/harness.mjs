// ═══════════════════════════════════════════════════════════════════════════
// THE SHARED HARNESS — viewports, store seeding, page setup.
//
// Used by shots.mjs, axe.mjs and assert.mjs so all three walk the SAME
// view × viewport matrix. If they diverged, a screenshot and its axe result
// would stop describing the same thing.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";

export const BASE = process.env.RESPONSIVE_BASE ?? "http://localhost:3000";
export const STORE_KEY = "somethings.mentor-onboarding";

/** ═══ THE VIEWPORTS ═══
 *
 *  Six from the phase brief, plus the two special cases it names.
 *
 *  `zoom400` — 1280 AT 400% BROWSER ZOOM. Browser zoom scales every CSS pixel
 *  together, so 1280 ÷ 4 = a 320px CSS viewport: layout-identical to `xs` by
 *  construction. It is captured separately anyway because the DPR differs and
 *  because the tracker asks for it by name, but it is NOT an independent layout
 *  test and this comment exists so nobody reads a passing `zoom400` as extra
 *  assurance. The thing zoom400 genuinely tests beyond xs is that nothing
 *  depends on a coarse pointer or a small DPR.
 *
 *  `text200` — 200% TEXT-ONLY zoom, which IS an independent test and the one
 *  `03-DEFINITION-OF-DONE.md` actually asks for. Implemented by doubling the
 *  root font size, so `rem` and unitless line-heights grow while `px` layout
 *  does not — exactly the reflow that breaks fixed-height rows. Runs at 1280
 *  where there is room, so a failure is a type-scaling failure and not a
 *  narrow-viewport failure wearing its clothes.
 *
 *  `landscape` — 844×390, for the overlay-clipping cases: a 390px-tall viewport
 *  is where a `90dvh` sheet and a tall dialog stop fitting. */
export const VIEWPORTS = [
  { label: "xs", width: 320, height: 844 },
  { label: "s", width: 390, height: 844 },
  { label: "m", width: 430, height: 932 },
  { label: "md", width: 768, height: 1024 },
  { label: "lg", width: 1024, height: 768 },
  { label: "xl", width: 1280, height: 900 },
  { label: "zoom400", width: 320, height: 844, dpr: 2, equivalentTo: "xs" },
  { label: "text200", width: 1280, height: 900, rootFontPx: 32 },
  { label: "landscape", width: 844, height: 390 },
];

/** Build the persisted zustand payload for a seed spec.
 *
 *  SHAPE MATTERS: `persist` stores `{ state, version }`, and a version mismatch
 *  runs the migration chain. The version is read from the store module at
 *  runtime rather than hardcoded, so this cannot silently drift when the store
 *  bumps (it is at 38 as of Phase 6). */
export function buildStoreSeed(seed, version) {
  const state = {};
  if (seed.persona) state.persona = seed.persona;
  if (seed.status) state.status = seed.status;

  // `/app/profile` and the wizard gate on `publishedSnapshot !== null`, NOT on
  // `status` — verified in Phase 4 (`onboarding-wizard.tsx:100`,
  // `app/profile/page.tsx:61`). A seed that sets only `status: "published"`
  // leaves those routes redirecting, which is the trap this comment prevents.
  if (seed.published) state.publishedSnapshot = { __seeded: true };

  if (seed.profileUpdate) {
    // A PENDING changeset only. `changeRequests` is deliberately NOT seeded
    // anywhere — see the note in views.mjs about standing rule 1.
    state.profileUpdate = {
      id: "pu-harness",
      status: "pending",
      submittedAt: 1756000000000,
      updatedAt: 1756000000000,
      fields: [
        {
          fieldId: "bio",
          liveValue: "The previously published bio.",
          fieldStatus: "pending",
          adminNote: null,
        },
      ],
    };
  }
  return { state, version };
}

/** Read the store's current persist version so the seed never triggers an
 *  unintended migration. */
export async function readStoreVersion() {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile("src/lib/onboarding/store.ts", "utf8");
  const m = src.match(/version:\s*(\d+)/);
  if (!m) throw new Error("could not read persist version from store.ts");
  return Number(m[1]);
}

export async function launch() {
  const browser = await chromium.launch();
  return browser;
}

/** A context + page primed for one view at one viewport.
 *
 *  THE SEED IS AN INIT SCRIPT, not a post-load write. Writing localStorage from
 *  an already-running page loses the race against `persist` flushing its
 *  in-memory state over the top — measured repeatedly in Phases 4 and 6, where a
 *  restore silently did not stick. `addInitScript` runs before any app JS, so
 *  hydration reads the seeded value as if it had always been there. */
export async function openView(browser, view, vp, version) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr ?? 1,
    // A coarse pointer on the phone tiers, so `(pointer: coarse)` rules — like
    // the drag handle hidden in Phase 5 — are exercised as a phone sees them.
    hasTouch: vp.width <= 430,
    isMobile: false, // Chromium's isMobile forces its own viewport meta; not wanted
    reducedMotion: "reduce", // deterministic screenshots; transitions are tested elsewhere
  });

  const payload = JSON.stringify(buildStoreSeed(view.seed ?? {}, version));
  await context.addInitScript(
    ({ key, payload }) => {
      try {
        localStorage.setItem(key, payload);
      } catch {
        /* private mode / blocked storage — the view still renders defaults */
      }
    },
    { key: STORE_KEY, payload }
  );

  if (vp.rootFontPx) {
    await context.addInitScript((px) => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.fontSize = `${px}px`;
      });
    }, vp.rootFontPx);
  }

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 300));
  });

  await page.goto(BASE + view.url, { waitUntil: "networkidle" });

  // The store hydrates behind `useMounted`, and several surfaces redirect on the
  // first mounted frame. Settle before measuring or the screenshot catches a
  // shell mid-decision.
  await page.waitForTimeout(700);

  if (view.clickSection) {
    // The settings rail is client state; if the URL param did not drive it,
    // click the chip so the row's own section is what gets captured.
    const chip = page
      .locator('nav[aria-label="Settings sections"] button')
      .filter({ hasText: new RegExp(view.clickSection.replace(/-/g, ".?"), "i") })
      .first();
    if (await chip.count()) {
      await chip.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }

  return { context, page, errors };
}

/** Where a view actually ended up, so a redirect is never silently reported as
 *  a successful capture of the requested row. */
export async function landedOn(page) {
  return page.evaluate(() => location.pathname + location.search);
}

/** A view whose state can only be reached by driving a real flow. The runners
 *  SKIP these rather than capturing them in the pre-flow state, because a
 *  screenshot of the wrong state is worse than a missing one — it looks like
 *  evidence. Currently just the `rejected` lifecycle: standing rule 1 says the
 *  changeRequests baseline snapshot is captured at the MOMENT OF ADMIN
 *  REJECTION, so it is driven, not seeded, and the driver is not built yet. */
export const needsFlow = (v) => Boolean(v.flow);
