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
  ["C2", "/hub/profile"],
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
  ...HUB_STEPS.map(([id, url]) => ({ id, cluster: "C", url, seed: PUBLISHED })),

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
  {
    id: "D5",
    cluster: "D",
    url: "/app/mentees",
    seed: { persona: "lead-mentor" },
  },
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
