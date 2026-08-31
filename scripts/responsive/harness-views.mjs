// ═══════════════════════════════════════════════════════════════════════════
// THE VIEW MATRIX — one entry per TRACKER ROW, not per route.
//
// Derived from `docs/responsive/TRACKER.md` clusters A–I (67 rows). The tracker
// stays the human-readable source of truth; this is its executable form, and the
// `id` in each entry is the tracker's row ID so a screenshot, an axe result and
// a tracker row can always be lined up.
//
// CLUSTER J (26 OVERLAYS) IS NOT HERE YET, by decision: overlays cannot be
// reached by URL, so each needs a bespoke trigger script. The navigable 67 ship
// first so Phase 9 has a baseline to work against; overlays are a second pass.
//
// ═══ HOW STATE IS REACHED ═══
//
// `seed` writes the persisted zustand store BEFORE app JS runs (via Playwright's
// addInitScript). That ordering is the whole point: writing localStorage from an
// already-running page loses the race against `persist` re-writing its
// in-memory state over the top — measured repeatedly during Phases 4–6.
//
// `flow` is for a state that CANNOT honestly be seeded. Only the `rejected`
// lifecycle uses it: standing rule 1 says the changeRequests baseline snapshot is
// captured at the MOMENT OF ADMIN REJECTION and never re-derived, so authoring
// `baselineValue` in a seeder would manufacture the exact artifact that rule
// protects. Those rows drive the real admin flow instead.
// ═══════════════════════════════════════════════════════════════════════════

/** Subject fixtures per role, from `people-demo.ts`. There is NO admin-role
 *  person in the fixtures (established in Phase 3), which is why H17/H18 route
 *  through `/admin/mentor?subjectRole=admin` — the only surface that takes the
 *  subject role as a param — and are flagged as a different chrome. */
const SUBJECT = {
  mentor: "m1",
  teen: "t21",
  "lead-mentor": "s-brandy",
  supervisor: "s-stephen",
};

const WIZARD_STEPS = [
  ["B1", "verify"],
  ["B2", "register"],
  ["B3", "confirm"],
  ["B4", "examples"],
  ["B5", "profile-photo"],
  ["B6", "nickname"],
  ["B7", "languages"],
  ["B8", "bio"],
  ["B9", "spotify"],
  ["B10", "media"],
  ["B11", "vibe"],
  ["B12", "interests"],
];

const HUB_STEPS = [
  ["C1", "/hub"],
  // ═══ C2 REMOVED — `/hub/profile` IS NOT A ROUTE ═══
  //
  // Second row of this kind after D5, and the same shape of error: it asked for
  // a URL the product deliberately does not serve. `hub/[step]/page.tsx` says so
  // in its first line — "Placeholder module for the FOUR NON-PROFILE hub steps
  // (Story, Training, Scheduling, Away)" — and line 35 does
  // `if (mounted && !isValid) router.replace("/hub")`. The hub's Profile step
  // routes BY STATE, to the wizard or to `/app/profile`, so it never lands on a
  // `/hub/profile` page. C3-C6 share the route and never drifted, which is what
  // made this look like a C2-specific bug rather than a bad row.
  //
  // The states it was meant to cover are already covered: the wizard is cluster
  // B and `/app/profile` is E1. Matrix goes 68 rows to 67.
  ["C3", "/hub/story"],
  ["C4", "/hub/training"],
  ["C5", "/hub/scheduling"],
  ["C6", "/hub/away"],
];

const SETTINGS = [
  ["F1", "security"],
  ["F2", "notifications"],
  ["F3", "appearance"],
  ["F4", "language"],
  ["F5", "accessibility"],
  ["F6", "audio-video"],
];

/** subject-role → its tab set, from `lib/record/tabs.ts`. */
const RECORD = [
  ["H1", "mentor", "overview"],
  ["H2", "mentor", "mentorship"],
  ["H3", "mentor", "profile"],
  ["H4", "mentor", "first-moments"],
  ["H5", "mentor", "schedule"],
  ["H6", "mentor", "account"],
  ["H7", "teen", "overview"],
  ["H8", "teen", "care"],
  ["H9", "teen", "mentorship"],
  ["H10", "teen", "account"],
  ["H11", "lead-mentor", "overview"],
  ["H12", "lead-mentor", "supervision"],
  ["H13", "lead-mentor", "account"],
  ["H14", "supervisor", "overview"],
  ["H15", "supervisor", "supervision"],
  ["H16", "supervisor", "account"],
];

/** A published mentor — the state most in-app routes require. `/app/profile`
 *  gates on `publishedSnapshot !== null` specifically, not on `status`. */
const PUBLISHED = { persona: "mentor", status: "published", published: true };

/** THE ACTIVATION HUB'S ACTUAL AUDIENCE — approved but not yet published.
 *
 *  Cluster C used `PUBLISHED` and two of its rows drifted for that reason:
 *  `hub/page.tsx:31` does `if (mounted && everPublished) router.replace("/app")`,
 *  where `everPublished` is `publishedSnapshot !== null` — exactly what the
 *  `published: true` seed sets. The seed guaranteed the redirect it was then
 *  reported as suffering. "Published mentors belong in the mentor app (Settings),
 *  not the setup hub" is the route's own comment; the hub is the surface BEFORE
 *  that snapshot exists.
 *
 *  So: `status: "published"` (the profile is approved) with NO snapshot. That
 *  distinction is load-bearing across this codebase — `/app/profile` and the
 *  wizard gate on `publishedSnapshot`, never on `status`. Only C1 and C2 carried
 *  the guard, which is why C3-C6 rendered fine and the wrong seed went unnoticed. */
const ACTIVATING = { persona: "mentor", status: "published" };

export const VIEWS = [
  // ── A · Pre-app ─────────────────────────────────────────────────────────
  { id: "A1", cluster: "A", url: "/", seed: {} },
  {
    id: "A2",
    cluster: "A",
    url: "/invite/demo-invite-token",
    seed: { persona: "new-mentor", status: "invited" },
  },
  {
    id: "A3",
    cluster: "A",
    url: "/onboarding/preview",
    seed: { persona: "mentor", status: "pending" },
  },
  {
    id: "A4",
    cluster: "A",
    url: "/onboarding/submitted",
    seed: { persona: "mentor", status: "in_review" },
  },
  {
    id: "A4r",
    cluster: "A",
    url: "/onboarding/submitted",
    // The rejected half of A4. Real flow, not a seed — see the module note.
    flow: "reject",
    // THE FLOW'S PREREQUISITES, not the end state: a LEAD, because
    // `/admin/review` renders a blank shell for anyone else, plus a submission
    // waiting on review. `driveReject` becomes the mentor afterwards, because
    // the rejected state belongs to the mentor's view of it.
    //
    // NO `profileUpdate` HERE. It was seeded while the driver pointed at
    // `/admin/profile-update`, a different feature reviewing post-publish edits
    // (see flows.mjs). Seeding it now would put an unrelated pending changeset
    // behind the screenshot.
    seed: { persona: "lead-mentor", status: "in_review" },
    note: "rejected lifecycle via the real admin send-back",
  },

  // ── B · Onboarding wizard ───────────────────────────────────────────────
  ...WIZARD_STEPS.map(([id, slug]) => ({
    id,
    cluster: "B",
    url: `/onboarding?step=${slug}`,
    seed: { persona: "new-mentor", status: "invited" },
  })),

  // ── C · Activation hub ──────────────────────────────────────────────────
  ...HUB_STEPS.map(([id, url]) => ({ id, cluster: "C", url, seed: ACTIVATING })),

  // ── D · Mentor app routes ───────────────────────────────────────────────
  { id: "D1", cluster: "D", url: "/app", seed: PUBLISHED },
  { id: "D2", cluster: "D", url: "/app/activity", seed: PUBLISHED },
  {
    id: "D3",
    cluster: "D",
    url: "/app/activity",
    seed: { persona: "supervisor" },
  },
  { id: "D4", cluster: "D", url: "/app/mentees", seed: PUBLISHED },
  // ═══ D5 REMOVED — IT WAS NOT A VIEW ═══
  //
  // It asked for `/app/mentees` as a LEAD, and `app/app/mentees/page.tsx:35`
  // does `if (isLead) router.replace("/app/team")`. That is not a bug being
  // worked around: a lead supervises mentors, not teens, and `mentor-shell.tsx`
  // records the decision that leads have no Mentees destination at all. The row
  // asked the harness to screenshot a route the product deliberately does not
  // serve, and then reported the redirect as drift.
  //
  // `/app/team` as a lead is already covered by D8, which is the view D5 was
  // actually reaching. Removing it takes the matrix from 69 rows to 68.
  {
    id: "D6",
    cluster: "D",
    url: "/app/mentees",
    seed: { persona: "supervisor" },
  },
  { id: "D7", cluster: "D", url: "/app/team", seed: PUBLISHED },
  { id: "D8", cluster: "D", url: "/app/team", seed: { persona: "lead-mentor" } },
  { id: "D9", cluster: "D", url: "/app/team", seed: { persona: "supervisor" } },
  { id: "D10", cluster: "D", url: "/app/tasks", seed: { persona: "supervisor" } },
  { id: "D11", cluster: "D", url: "/app/tasks", seed: PUBLISHED },
  // D12 is five placeholder sections plus the `?with=` named variant. The
  // tracker counts it as ONE row; captured as its most-populated instance plus
  // the named-person variant, because they are different renderings.
  { id: "D12", cluster: "D", url: "/app/chat", seed: PUBLISHED },
  { id: "D12w", cluster: "D", url: "/app/chat?with=t21", seed: PUBLISHED },
  {
    id: "D13",
    cluster: "D",
    url: "/app/escalation/esc-1",
    seed: { persona: "supervisor" },
  },

  // ── E · Self profile ────────────────────────────────────────────────────
  { id: "E1", cluster: "E", url: "/app/profile?tab=profile", seed: PUBLISHED },
  {
    id: "E2",
    cluster: "E",
    url: "/app/profile?tab=first-moments",
    seed: PUBLISHED,
  },
  { id: "E3", cluster: "E", url: "/app/profile?tab=schedule", seed: PUBLISHED },
  { id: "E4", cluster: "E", url: "/app/profile?tab=account", seed: PUBLISHED },

  // ── F · Settings ────────────────────────────────────────────────────────
  ...SETTINGS.map(([id, section]) => ({
    id,
    cluster: "F",
    url: `/app/settings?section=${section}`,
    seed: PUBLISHED,
    // The section rail is client state; if the param does not drive it the
    // runner clicks the chip by name. Both paths are exercised.
    clickSection: section,
  })),

  // ── G · Supervisor console ──────────────────────────────────────────────
  {
    id: "G1",
    cluster: "G",
    url: "/admin/review",
    seed: { persona: "lead-mentor", status: "in_review" },
  },
  {
    // THE SAME CONSOLE IN THE OTHER CHROME. A supervisor reviews inside
    // `AdminShell` and a lead inside `MentorShell` (see `ReviewShell` in
    // `admin/review/page.tsx`), which is a different rail, a different top bar
    // and a different responsive break — so G1 alone stopped covering this route
    // the moment supervisors were admitted to it on 2026-08-31.
    id: "G1s",
    cluster: "G",
    url: "/admin/review",
    seed: { persona: "supervisor", status: "in_review" },
    note: "the review console in the supervisor's own chrome",
  },
  {
    id: "G2",
    cluster: "G",
    url: "/admin/profile-update",
    // `/admin/profile-update` is LEAD-ONLY (page.tsx:96 redirects everyone
    // else) and renders "Nothing to review" without a pending changeset, so
    // this row needs both the persona and a pending update.
    seed: { persona: "lead-mentor", status: "published", profileUpdate: true },
  },
  {
    id: "G3",
    cluster: "G",
    url: "/admin/mentor?tab=overview",
    seed: { persona: "supervisor" },
  },

  // ── H · User records ────────────────────────────────────────────────────
  ...RECORD.map(([id, role, tab]) => ({
    id,
    cluster: "H",
    url: `/admin/person/${SUBJECT[role]}?tab=${tab}`,
    seed: { persona: "supervisor" },
  })),
  // H17/H18 — the admin SUBJECT. No admin-role fixture exists, so these are
  // unreachable on `/admin/person/[id]`; `?subjectRole=` is read only by
  // `/admin/mentor` (page.tsx:329), which renders its OWN record chrome rather
  // than UserRecordShell. Captured there and flagged, not silently substituted.
  {
    id: "H17",
    cluster: "H",
    url: "/admin/mentor?subjectRole=admin&tab=overview",
    seed: { persona: "supervisor" },
    note: "admin subject: no fixture; different chrome (/admin/mentor)",
  },
  {
    id: "H18",
    cluster: "H",
    url: "/admin/mentor?subjectRole=admin&tab=account",
    seed: { persona: "supervisor" },
    note: "admin subject: no fixture; different chrome (/admin/mentor)",
  },

  // ── I · Dev ─────────────────────────────────────────────────────────────
  {
    id: "I1",
    cluster: "I",
    url: "/dev/components",
    seed: PUBLISHED,
    note: "not user-facing: verify it does not break, do not polish",
  },
];

/** The three redirects the matrix must NOT audit as views, but must confirm
 *  still redirect (`02-VIEW-MATRIX.md`). */
export const REDIRECTS = [
  { from: "/app/mentors", to: "/app/team", seed: PUBLISHED },
  { from: "/app/teens", to: "/app/mentees", seed: PUBLISHED },
  {
    from: "/admin/users?segment=teens",
    to: "/app/mentees",
    seed: { persona: "supervisor" },
  },
];
