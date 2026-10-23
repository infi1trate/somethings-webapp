"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  VIEW_OPTIONS_DEFAULT,
  VIEW_PRESETS,
  type ViewOptions,
  type ViewPreset,
} from "@/lib/ui/view-options";
import { PIN_CAP, type PinnedMentee } from "@/lib/record/pinned";

/** ═══ THE READING-TRACE CAP (rework §5.1, §5.2) ═══
 *  Not `PIN_CAP`: a pin is a deliberate working set of five and a trace is
 *  incidental. See the setters for why it is bounded at all. */
const CARE_TRACE_CAP = 500;
/** ═══ THE RECENT-SCENARIO LIST'S CAP (bar-02) ═══
 *  Five, from the phase file. It is a shortcut row at the top of a panel, not a
 *  history: past five, scanning it costs more than scanning the grouped list
 *  underneath, which is the thing it exists to save you from. */
const SCENARIO_RECENTS_CAP = 5;
import {
  emptyDraft,
  type ChangeRequest,
  type HubStepKey,
  type HubStepStatus,
  type MentorDraft,
  type MentorLifecycleStatus,
  type ProfileStatus,
  type ProfileUpdate,
  type ActivityItem,
  type Persona,
  type InternalNote,
} from "@/lib/types";
import {
  DEFAULT_SCHEDULE,
  cloneSchedule,
  type Schedule,
} from "@/lib/schedule";
// Type-only: the shape of a staff edit to another person's profile. people-demo
// holds no store import, so this stays one-directional.
import type { PersonProfile } from "@/lib/record/people-demo";
// activity/read-state is a pure logic module with no store import — same
// one-directional discipline as care-demo below.
import {
  clearRow as clearOverlayRow,
  markRead as markOverlayRead,
  restoreRow as restoreOverlayRow,
  type ActivityScope,
  type ReadOverlay,
} from "@/lib/activity/read-state";
import type { ActivityDensity } from "@/lib/activity/views";
// The default id, not the whole registry. `lib/tasks/seed.ts` imports only
// `tasks/sla` and `tasks/types`, neither of which reaches back here, so there is
// no cycle — checked rather than assumed, since a cycle through the store shows
// up as an undefined default at module-init time and not as an error.
import { DEFAULT_TASK_SCENARIO_ID } from "@/lib/tasks/seed";
import { DEFAULT_CHAT_SCENARIO_ID } from "@/lib/chat/seed";
/* ALIASED AT THE IMPORT. `ChatEvent` and `Note` are good names inside the chat
   module and poor ones in a 1,900-line store that already has an `activity` feed
   and an `internalNotes` field. The alias is where the disambiguation belongs —
   renaming them in `lib/chat/types.ts` would make every chat component read worse
   to make one file read better. */
import type {
  ChatEvent as ChatEventRecord,
  ChatMessage as ChatMessageRecord,
  EscalationState as ChatEscalation,
  Note as ChatNoteRecord,
  SentArtifact as ChatArtifactRecord,
} from "@/lib/chat/types";
// care-demo is a pure data module with no store import — one-directional.
import type {
  CareFlagClosure,
  CareReviewDecision,
  CareUpdateRecord,
} from "@/lib/record/care-demo";
// A VALUE import, not a type — the rehydrate repair below iterates the sections
// to backfill a stored body. Same one-directional edge as the types above.
import { CARE_UPDATE_SECTIONS } from "@/lib/record/care-demo";
import {
  DEFAULT_LOAD_STATE,
  LOAD_STATES,
  type LoadState,
} from "@/lib/dev/load-state";
import type { CareSummaryCommit } from "@/lib/record/care-summary-doc";
import type { RelationshipEvent } from "@/lib/record/relationships";
import { guardianFor } from "@/lib/record/guardian";
import type { AccountLock, GuardianDetails } from "@/lib/record/guardian";
import {
  PROFILE_SECTIONS,
  normForCompare,
} from "@/lib/onboarding/profile-sections";
import {
  isGatedField,
  isImmediateTeenFacingField,
  cloneValue,
} from "@/lib/onboarding/profile-update";
import { emptyHubSteps } from "@/lib/onboarding/hub";
import { normaliseClosedRecord, type ClosedCareReview } from "@/lib/tasks/closed-review";
import { devClockByKey } from "@/lib/home/dev-clock";
import { appendable, type TierEvent } from "@/lib/tiering/events";
import { pinsFor, todayScenarioById } from "@/lib/home/scenarios";

// A persisted-shape copy of the draft (no password, no volatile blob url) — the
// approved baseline used to detect post-publish edits in the mentor's settings.
function snapshotDraft(draft: MentorDraft): MentorDraft {
  return JSON.parse(
    JSON.stringify({
      ...draft,
      password: "",
      media: { ...draft.media, url: null },
    })
  ) as MentorDraft;
}

/** Notification preferences (settings-03), keyed PER PERSONA (the dev lens's
 *  four states each keep their own switches) → category id → on/off. Sparse:
 *  a missing persona or category means "use the category's default" (see
 *  notifications-config.ts), so no exhaustive backfill is needed. */
export type NotificationPrefs = Record<string, Record<string, boolean>>;

/** A mentee match's standing. "paused" has NOT ended — see menteeStatus. */
export type MenteeStatus = "active" | "paused" | "deactivated";

/** A mentor's caseload setting (caseload prompt): capacity mode + total mentee
 *  slots. "automatic" = capacity adjusts by the matching algorithm (TODO-DATA:
 *  no algorithm exists in this prototype — honest stub); "custom" = the lead
 *  set it by hand. Sparse per-mentor map — a missing entry means "automatic at
 *  the mentor's default capacity" (people-demo `capacity`, or `slots.total`
 *  for the store-backed "live" mentor). */
export type Caseload = { mode: "automatic" | "custom"; total: number };

interface OnboardingState {
  draft: MentorDraft;
  status: ProfileStatus;
  completed: string[]; // slugs the mentor has saved
  rejectionNote: string | null;
  /** Section-tied changes the reviewer requested; read by the dock, the welcome
   *  modal, and the per-step note cards. */
  changeRequests: ChangeRequest[];
  /** The last approved version of the profile, captured when it's published.
   *  Diffed against the live draft to detect post-publish edits; `everPublished`
   *  is simply `publishedSnapshot !== null`. */
  publishedSnapshot: MentorDraft | null;
  /** Per-step completion for the four non-profile hub steps. The Profile step's
   *  status is derived from `status` (see lib/onboarding/hub.ts), not stored here. */
  hubSteps: Record<HubStepKey, HubStepStatus>;
  /** Shown-once flag for the hub's first-visit welcome modal. Set true the first
   *  time the hub opens the intro, so it never reappears. Persisted. */
  hubWelcomeSeen: boolean;
  /** Staff-owned account config (§4 Roles & permissions, Phase 6). Top-level
   *  additions backfill via the shallow persist merge — no migration needed. */
  slots: { total: number; dailyNew: number };
  accountStatus: "active" | "deactivated";
  deactivatedOn: string | null; // display date, set at deactivation
  /** Post-publish changeset (Profile Update Review). One open changeset max;
   *  teens keep seeing publishedSnapshot until approval. */
  profileUpdate: ProfileUpdate | null;
  /** Mentor-side activity feed (send-backs, approvals). */
  activity: ActivityItem[];
  /** Dev persona lens (Phase 10) — drives the settings role + sidebar avatar. */
  persona: Persona;
  /** Lead Mentor / Supervisor own account photo (Account › Photo row) —
   *  internal, direct-save, never teen-visible, never review-gated. */
  staffPhoto: string | null;
  /** Internal staff notes on the Mentor Record (record-05) — never
   *  mentor-visible; append-only. */
  internalNotes: InternalNote[];
  /** record-05: staff-controlled teen visibility ("Unpublish profile").
   *  Hidden ≠ deactivated: content and mentorships stay; teens just don't
   *  see the profile until it's republished. */
  profileHidden: boolean;
  /** True once the mentor has left the "You're approved!" screen via its CTA
   *  and entered their live home — so the dev persona lens (and the submitted
   *  page's own guard) can tell "just approved, not yet acknowledged" apart
   *  from "established, logged in." Reset with the mentor. */
  enteredHome: boolean;
  /** Session-only UI for the welcome-back modal (not persisted — shows once per
   *  session entry, reopenable from the dock). */
  welcomeOpen: boolean;
  welcomeAutoShown: boolean;
  /** Notification switches, per persona → category id (settings-03). */
  notificationPrefs: NotificationPrefs;
  /** Per-mentor caseload overrides, keyed by mentor id ("live" = the
   *  store-backed mentor). Sparse — see the Caseload type note. */
  caseloads: Record<string, Caseload>;
  /** Manual lifecycle-status overrides set by staff (lead + supervisor) from the
   *  roster or record, keyed by mentor id ("live" = the store-backed mentor).
   *  Sparse: a missing key falls back to the fixture status (demo mentors) or
   *  the derived liveLifecycle (the store mentor). When set for "live" it wins
   *  over the derived standing everywhere it renders. */
  mentorStatuses: Record<string, MentorLifecycleStatus>;
  /** Manual availability INTENT overrides (open to new mentees?) set by staff,
   *  keyed by mentor id. Sparse: missing → fixture `accepting` (demo) or true
   *  (live). Only the accepting/not-accepting intent is stored — "Full" is
   *  always derived from the caseload (count === cap), never stored. */
  mentorAccepting: Record<string, boolean>;
  /** Per-MENTEE match standing, keyed by teen id. Sparse: a missing key falls
   *  back to the fixture's own `active` (see defaultMenteeStatus). Replaces the
   *  old binary `menteeActive` — the mentee table shows three states, and two
   *  parallel sources for one fact is how they drift apart.
   *
   *  "paused" has NOT ended: the row stays in the list but stops counting as
   *  active. Only "deactivated" moves a mentee to Past mentees. */
  menteeStatus: Record<string, MenteeStatus>;
  /** APPROVED presentation reviews, keyed by review id. APPEND-ONLY BY DESIGN:
   *  there is no setter that edits or removes an entry, because the record is
   *  append-only — a correction is a NEW review whose approval lands as its own
   *  entry referencing the original. Sparse: a missing key means that review is
   *  still pending, which is what puts it in the action slot. */
  careReviews: Record<string, CareReviewDecision>;
  /** v33 — CLOSED CARE FLAGS, keyed by flag id. Append-only, like careReviews: a
   *  close is recorded, never unrecorded, and a closed flag leaves the task
   *  region because the record now holds its resolution — not because anything
   *  was deleted. */
  careFlagClosures: Record<string, CareFlagClosure>;
  /** ═══ THUMBS ON THE AI-USAGE CAVEAT, PER RECORD ═══
   *
   *  PER RECORD, not global. The caveat says "AI is used in parts of THIS page",
   *  so the opinion is about what a reader just read; a global key would let one
   *  thumbs-down on one teen silence the control on every other record.
   *
   *  IT HAS TO BE IN THE STORE AT ALL because the module is MOUNTED TWICE — once
   *  in the rail and once, `min-[1100px]:hidden`, for narrow viewports. Both are
   *  in the DOM at every width. Component state would give them one rating each
   *  and they would disagree the moment either was used.
   *
   *  NO SCHEMA VERSION. `merge` spreads `...current` before `...persisted`, so a
   *  payload written before this field existed keeps the `{}` default and needs
   *  no backfill — the version log's entries are for fields whose stored SHAPE
   *  could be wrong, not merely absent. Verified against a live v43 payload.
   *
   *  ═══ TODO-DATA — NOTHING CONSUMES THIS ═══
   *  There is no feedback pipeline. The rating and the note are written here and
   *  here is where they stop: no endpoint, no aggregate, nobody reading them. So
   *  the acknowledgement says the note was NOTED, never that it was sent — a
   *  control claiming to have delivered something it did not is worse than no
   *  control at all. */
  aiUsageFeedback: Record<
    string,
    { rating: "up" | "down"; note: string | null; at: number }
  >;
  /** APPEND-ONLY log of committed care summaries, keyed by teen id (v40).
   *
   *  AN ARRAY PER TEEN, not one entry per teen: every cycle commits its own
   *  summary, and a map keyed by teen would overwrite the previous cycle's
   *  evidence — which is precisely the thing a clinical record must not lose. A
   *  reader comparing this quarter to the last one is reading two entries.
   *
   *  NO SETTER EDITS OR REMOVES ONE. The entries are FROZEN SNAPSHOTS taken at
   *  the moment a review was approved (see `commitFor`), never re-derived from
   *  the current record, because re-derivation would rewrite the evidence a past
   *  decision was made on. `careRailOpen` used to live here; the rail it
   *  controlled is gone, and so is it. */
  careSummaryCommits: Record<string, CareSummaryCommit[]>;
  /** v39 — IS THE DEV BAR HIDDEN? A presentation preference, not demo data.
   *
   *  DELIBERATELY NOT CLEARED BY `reset()`, for the same reason `persona` is not:
   *  it is a lens on the prototype rather than a fact about it, and a starting
   *  point from the landing page bringing the bar back after someone had put it
   *  away would be the app overruling them. Settings is where it comes back. */
  devBarHidden: boolean;
  /** THE ACTIVITY LEDGER'S READ/CLEAR OVERLAY (v35). Keyed
   *  `viewerId::scope::eventId` — see lib/activity/read-state.ts for why scope is
   *  part of the key and not a filter over it (standing rule 10).
   *
   *  NEVER stored on an event row (rule 9). The events are fixtures in
   *  lib/activity/seed.ts and are not persisted at all; only this overlay is,
   *  because only this is the viewer's own state. */
  activityRead: ReadOverlay;
  /** WHICH SEED SCENARIO THE LEDGER IS SHOWING (v36). Prototype chrome, but
   *  persisted deliberately: the read/clear overlay is keyed by event id, so a
   *  reload that reset the scenario would leave the overlay pointing at events
   *  that were no longer on screen — and the A2 persistence would never actually
   *  be exercised, because every reload would re-seed from scratch. */
  activityScenarioId: string;
  /** v41 — THE HARNESS'S LOAD-STATE AXIS. Lifted out of `activity-ledger.tsx`,
   *  where it was `useState` and therefore reset on every navigation: you could
   *  not set "error", leave the screen and come back to it. A load state is a
   *  property of the harness like `persona` and the scenario, not of one feed.
   *  See `lib/dev/load-state.ts` for why it has one consumer today. */
  devLoadState: LoadState;
  /** ═══ THE PINNED SIMULATED CLOCK (Today Phase J.1) ═══
   *  A `DEV_CLOCK_POSITIONS` key, or null to run on the real clock. DEV-ONLY
   *  and null for every real session — only the dev bar writes it. Stored as a
   *  KEY rather than a timestamp so a pinned position survives a reload as the
   *  same wall-clock moment; a stored instant would drift into the past and a
   *  "Mon 5:15 PM" pin would silently become last Monday. */
  devClockKey: string | null;
  /** ═══ THE TODAY SCENARIO (Phase J.2) ═══
   *  Dev-only. A `TODAY_SCENARIOS` id, or null. It is a LABEL for a setting of
   *  the tasks axis, the monitoring axis and the pin set — the setter applies
   *  all three — so it is stored only so the picker can show which composition
   *  is selected. Nothing reads it to derive data. */
  todayScenarioId: string | null;
  /** WHICH TASKS SEED SCENARIO THE WORKLIST SHOWS (v42).
   *
   *  LIFTED OUT OF `tasks-page.tsx`, where it was `useState` inside a panel
   *  pinned bottom-right — under the fixed mobile bottom nav, which made it
   *  untappable below `md` (gap row 311), and page-local, so it reset on every
   *  navigation away. Same two faults `activityScenarioId` had and the same fix:
   *  the axis belongs to the harness, not to the screen it acts on. */
  tasksScenarioId: string;
  /** ═══ MONITORING'S OWN SCENARIO AXIS (arch-mon Phase 7) ═══
   *  Null = derive the surface from `tasksScenarioId`, which is what Home's deep
   *  links and the five existing task scenarios rely on. A Monitoring key
   *  overrides it. A separate axis rather than more entries in the task
   *  registry: a dead classifier or a dormant live band has no meaning on Tasks
   *  or Home, and adding them there would change what those surfaces show. */
  monitoringScenarioId: string | null;
  /** ═══ EPHEMERAL, AND DELIBERATELY NOT PERSISTED ═══
   *
   *  A bump tells the Tasks page to drop its reviewed/resolved state. It is a
   *  SIGNAL, not a fact about the user, so it is absent from `partialize` — which
   *  also means adding it costs no schema version and no migration. Persisting it
   *  would be worse than useless: a stored nonce would fire the reset once on the
   *  next load, for no reason anybody could trace. */
  tasksResetNonce: number;
  /** ═══ THE CHAT AXIS (v43) ═══
   *
   *  Fifth screen level on the harness's scenario select, and here for the same
   *  reason the other two are: a scenario that lives in a page's `useState` resets
   *  the moment you navigate, which makes it useless for reviewing a surface you
   *  reach by clicking through the product. */
  chatScenarioId: string;
  /** ═══ WHAT THE MENTOR CHAT PERSISTS, AND WHY EACH ONE HAS TO ═══
   *
   *  Only four things. Everything else on that surface — which rail tab is open,
   *  what is half-typed in the composer, where a card deck is — is per-thread UI
   *  that is worthless after a reload and would mean a localStorage write per
   *  keystroke.
   *
   *  ESCALATIONS ARE THE LOAD-BEARING ONE. An escalation stays open until someone
   *  explicitly resolves it; a mentor who raises one, navigates to the teen's
   *  record and comes back must find it exactly where it was. That is not a
   *  convenience, it is the feature.
   *
   *  Keyed by thread id, which is a person id. One open escalation per thread —
   *  a second one on the same conversation is the same crisis. */
  escalations: Record<string, ChatEscalation>;
  /** APPEND-ONLY. Activities sent and taken back, notes written, escalations
   *  opened and resolved. There is no remove and no update: a rescinded activity
   *  gets a SECOND event, because "sent and then pulled back" is the true history
   *  and "never sent" is not. Keyed by thread id. */
  chatEvents: Record<string, ChatEventRecord[]>;
  /** APPEND-ONLY. What the mentor has SENT this session, merged with the
   *  scenario's fixture messages at read time (`chat-page.tsx`), exactly as
   *  `chatEvents` is. Keyed by thread id. Before this slice existed the
   *  composer's Send cleared the box and called nothing (pack v3.0, Phase 0):
   *  there was nowhere for a sent message to go. */
  chatMessages: Record<string, ChatMessageRecord[]>;
  /** Documentation. Keyed by note id rather than by thread, because a note is
   *  reached from Timeline, from a reminder and from the thread it references —
   *  three paths that would each need their own index into a thread-keyed map. */
  chatNotes: Record<string, ChatNoteRecord>;
  /** Sent activity artifacts, keyed by artifact id. Their `completion` is the one
   *  mutable field in the chat model, so they cannot live in the append-only
   *  event log. */
  chatArtifacts: Record<string, ChatArtifactRecord>;
  /** ═══ THE TIER LOG — APPEND-ONLY (Tiering & Escalation pack) ═══
   *  Every placement, request, confirmation and step-down this session wrote,
   *  merged at read time with the fixtures' (`lib/tiering/seed.ts`). One log
   *  for every teen; the chat, the user record and Monitoring all read it. */
  tierEvents: TierEvent[];
  /** Escalations that were resolved and then superseded by a new one on the
   *  same thread — kept whole, so History can still tell the earlier story. */
  escalationHistory: ChatEscalation[];
  /** ═══ APPEND, THROUGH THE GATE ═══ Refuses an event without a reason, and a
   *  tier-SETTING event from anyone but a supervisor (`appendable`). Returns
   *  whether it was written, so a caller cannot believe it was. */
  appendTierEvent: (event: TierEvent) => boolean;
  setActivityScenarioId: (id: string) => void;
  setTasksScenarioId: (id: string) => void;
  setMonitoringScenarioId: (id: string | null) => void;
  setChatScenarioId: (id: string) => void;
  /** ═══ APPEND. THE ONLY MUTATION THE EVENT LOG HAS ═══
   *  No remove and no update, so "an event, once written, is never retracted" is a
   *  property of the store rather than a convention every caller has to keep. A
   *  rescinded activity gets a SECOND event; the first one stays. */
  appendChatEvent: (event: ChatEventRecord) => void;
  /** A message the mentor sent. Append-only, like `appendChatEvent`. */
  appendChatMessage: (message: ChatMessageRecord) => void;
  /** Sent artifacts. Upsert rather than append, because `completion` is the one
   *  mutable field in the chat model — a teen opening a set changes it. */
  putChatArtifact: (artifact: ChatArtifactRecord) => void;
  /** ═══ PUT, AND THERE IS NO REMOVE ═══
   *  A note is a record of what somebody observed at a time, so nothing on this
   *  surface edits or deletes one — see `NoteDetail` on why, and on the amendment
   *  path that is a real gap (row 356). `put` rather than `append` only because the
   *  map is keyed by id, which is what lets Timeline, a reminder and a thread chip
   *  all reach the same note without three indexes. */
  putChatNote: (note: ChatNoteRecord) => void;
  /** ═══ ONE OPEN ESCALATION PER THREAD, AND IT STAYS UNTIL SOMEBODY CLOSES IT ═══
   *  Keyed by thread id, so a second escalation on the same conversation is the
   *  same crisis rather than a second row. `put` because the record is edited in
   *  place as the assessment is worked through — the append-only log is where the
   *  HISTORY of it lives, and both exist. */
  putEscalation: (escalation: ChatEscalation) => void;
  /** Clears the Tasks worklist's reviewed items. Lives here because the control
   *  is in the dev footer and the state is in the page — a counter is the smallest
   *  seam that does not make the page reach into the bar or the reverse. */
  resetTasksReviewed: () => void;
  setShiftSeenAt: (at: number) => void;
  setDevLoadState: (state: LoadState) => void;
  setDevClockKey: (key: string | null) => void;
  setTodayScenarioId: (id: string | null) => void;
  /** Marks a review viewed. Idempotent — opening the same row twice is one
   *  view, and the pane's effect fires on every selection change. */
  /** Records a scenario as used. Moves an existing entry to the front rather
   *  than duplicating it — a recents row with the same entry twice is a row
   *  that has stopped being recents. */
  noteScenarioUsed: (prefixedId: string) => void;
  markCareReviewViewed: (id: string) => void;
  /** Records a committed review — the whole record, not a pointer to it (see
   *  `closedCareReviews`). Idempotent on id: a second commit of the same review
   *  is the resubmission the Closed tab exists to prevent. */
  recordClosedCareReview: (record: ClosedCareReview) => void;
  /** The dev harness's reset, matching `resetTasksReviewed`'s scope. */
  resetCareReviewState: () => void;
  /** WHEN THE SUPERVISOR LAST OPENED THE TASKS WORKLIST (v37).
   *
   *  The shift-start digest's gate: it renders on the first session after a gap of
   *  more than 8 hours (Tasks spec §7). PERSISTED, necessarily — the whole
   *  question is "has it been a shift since you were last here", which component
   *  state cannot answer across a reload. 0 means never opened, which counts as a
   *  gap and shows the digest. */
  tasksLastVisitAt: number;
  /** ═══ WHEN THE SUPERVISOR LAST STARTED A SHIFT (v44) ═══
   *
   *  The shift-start digest's gate, and it belongs to HOME rather than to Tasks.
   *  `tasksLastVisitAt` was the old one and is superseded: Tasks wrote it on
   *  every mount, so a supervisor who opened Tasks before Home would have killed
   *  Home's digest by looking at the wrong page first. The digest is a fact about
   *  the SESSION, so the surface that shows it is the surface that stamps it.
   *
   *  `tasksLastVisitAt` IS LEFT IN PLACE rather than removed. Dropping a
   *  persisted field costs a migration to delete a number, and this codebase has
   *  already made that call once for this exact field. It is migrated FROM at
   *  v44 so an existing session keeps its place in the shift rather than meeting
   *  the digest again on upgrade, and nothing writes it any more.
   *
   *  PERSISTED, necessarily — "has it been a shift since you were last here" is
   *  not a question component state can answer across a reload. 0 means never,
   *  which counts as a gap and shows the digest once. */
  shiftLastSeenAt: number;
  /** ACTIVITY FEED DENSITY (v38). Per user, persisted — A11 asks for the choice to
   *  survive, and a reading-density preference that resets every session is worse
   *  than no toggle at all. */
  activityDensity: ActivityDensity;
  /** ═══ LIST VIEW OPTIONS, PER DESTINATION (Layout Pass §5, v46) ═══
   *
   *  Density and layout for the queue surfaces. SPARSE AND KEYED BY
   *  DESTINATION: §5 asks for per-destination persistence, and a supervisor who
   *  wants 123 flags compact does not necessarily want sixteen billing reviews
   *  compact. An absent key means "never touched the control", which reads as
   *  the default rather than as a stored choice — so the day a default changes,
   *  everyone who never expressed a preference moves with it.
   *
   *  PERSISTED FOR THE SAME REASON `activityDensity` IS (v38): a reading-density
   *  preference that resets every session is worse than no toggle at all. It
   *  rides the one store this app already persists, so it is per-user in the
   *  only sense this prototype has a user. */
  viewOptions: Record<string, ViewOptions>;
  setViewOptions: (scope: string, next: Partial<ViewOptions>) => void;
  /** ═══ WHEN THE SHIFT BANNER WAS DISMISSED (Today Phase C.6, v48) ═══
   *
   *  C.6: "Dismissal persists for the current shift only, per supervisor." It
   *  was `useState(false)` on the page — so it survived nothing, not even a
   *  navigation to a destination and back, which is the single most likely
   *  thing a supervisor does immediately after reading the banner.
   *
   *  AN INSTANT, NOT A BOOLEAN, AND THAT IS WHAT MAKES IT SHIFT-SCOPED. A flag
   *  would need a second field saying which shift it belonged to, and the two
   *  could disagree. One timestamp compared through `isNewShift` — the same
   *  eight-hour boundary the banner already uses to decide whether a shift is
   *  new — expires itself: once eight hours pass the dismissal is in a previous
   *  shift and the banner returns without anything having to clear it.
   *
   *  0 MEANS NEVER DISMISSED, the same sentinel `shiftLastSeenAt` uses. */
  shiftDigestDismissedAt: number;
  dismissShiftDigest: (at: number) => void;
  /** ═══ THE SUPERVISOR'S PINNED MENTEES (Today Phase E, v49) ═══
   *
   *  A private working set — see `lib/record/pinned.ts` for why it lives on the
   *  SUPERVISOR rather than on the teen. Ordered by pin time ascending, which
   *  is insertion order, which is Phase F's rendering order.
   *
   *  CAPPED IN THE SETTER AS WELL AS IN THE CONTROL. The control explains at
   *  the cap rather than disabling (E.8), and this refuses regardless — a cap
   *  enforced only in a component is a cap the next caller does not have. */
  pinnedMentees: PinnedMentee[];
  /** ═══ VIEWED CARE REVIEWS (rework §5.2) ═══
   *  Item ids the supervisor has OPENED IN THE DETAIL PANE. Per-supervisor and
   *  private, like `pinnedMentees` — it is a reading trace, not a clinical
   *  fact, and it is not visible to mentors or mentees.
   *  AN ARRAY RATHER THAN A SET because the store is JSON-persisted; the
   *  selectors build a Set where membership is tested in a loop.
   *  CAPPED on merge for the reason `pinnedMentees` is: an unbounded list in
   *  localStorage grows for the life of the browser profile. */
  viewedCareReviews: string[];
  /** ═══ RECENTLY-USED SCENARIOS, NEWEST FIRST (bar-02) ═══
   *  PREFIXED values exactly as the select carries them (`tasks:quiet-day`), so
   *  one list spans all five scenario families and an entry names which family
   *  it belongs to without a second field.
   *  PERSISTED, AND IT HAS TO BE: selecting a scenario NAVIGATES, so a
   *  non-persisted recents list would be empty every time the panel opened —
   *  which is the bar-00 finding about `devClockKey` arriving by a different
   *  road. Capped, sanitised and de-duplicated on merge. */
  scenarioRecents: string[];
  /** ═══ SUBMITTED CARE REVIEWS (rework §5.1) ═══
   *  Committed reviews, persisted — Brandon's answer to the audit was
   *  "persist". Before this they lived in `useState` on the page and the
   *  Submitted tab would have been empty on every fresh visit, which is a tab
   *  that lies about history rather than one that shows it.
   *
   *  ═══ v54 · THE RECORD, NOT A POINTER — AND IT IS ACTUALLY PERSISTED NOW ═══
   *  This was `submittedCareReviews: { id, at }[]`, "the item id and when it
   *  was committed, and nothing else", so that it would "never become a second
   *  copy of clinical data that can drift from the first". Two defects, both
   *  measured in the Closed-tab pack:
   *    1. THE CONTENT WAS DISCARDED. The assessment, both prose fields and their
   *       provenance reached the commit and were dropped here; the draft holding
   *       the same text was cleared on the same commit. A closed review
   *       re-rendered as an empty form.
   *    2. IT WAS NEVER IN `partialize`, so the "persisted" set lived in memory
   *       and a reload emptied the Closed tab.
   *  The drift argument was backwards — the fixture is what moves; a record is
   *  what must not. See `lib/tasks/closed-review.ts`.
   *  UNCAPPED. It was capped at 500 as a trace; a record is not truncated. The
   *  Closed tab's volume comes from fixture history, not from this array. */
  closedCareReviews: ClosedCareReview[];
  pinMentee: (id: string, at: number) => void;
  unpinMentee: (id: string) => void;
  setTasksLastVisitAt: (at: number) => void;
  setActivityDensity: (density: ActivityDensity) => void;
  seedActivityRead: (overlay: ReadOverlay) => void;
  markActivityRowsRead: (
    viewerId: string,
    scope: ActivityScope,
    eventIds: string[]
  ) => void;
  clearActivityRow: (
    viewerId: string,
    scope: ActivityScope,
    eventId: string
  ) => void;
  restoreActivityRow: (
    viewerId: string,
    scope: ActivityScope,
    eventId: string
  ) => void;
  /** Care updates a supervisor has written, keyed by update id. APPEND-ONLY:
   *  no setter edits or removes one. "Editing" an update appends an amendment
   *  whose `amends` names the original, and both keep rendering. */
  careUpdates: Record<string, CareUpdateRecord>;
  /** When a supervisor last hit refresh on a teen's AI summary, keyed by teen
   *  id. TODO-DATA: regeneration isn't wired, so this only re-stamps the
   *  "Updated" date — but it has to persist, or the date would jump backwards
   *  on the next navigation. */
  careSummaryRefreshedAt: Record<string, number>;
  /** APPEND-ONLY log of ended pairings — unmatches and unassignments.
   *
   *  An ARRAY, not a map: the same pair could conceivably end, resume and end
   *  again, and a map keyed by pair would overwrite the first ending. There is
   *  no setter that edits or removes an entry, and nothing here touches account
   *  state — that is the whole point of the field existing. The current edge is
   *  DERIVED by replaying this over the fixture edge (lib/record/relationships),
   *  so history and present state cannot disagree. */
  relationshipEvents: RelationshipEvent[];
  /** Parent/guardian consent record per teen. Sparse — a missing key means
   *  nothing has been entered, which is rendered as empty rather than as a
   *  placeholder: an invented parent name on a minor's consent record would be
   *  worse than a blank. */
  guardians: Record<string, GuardianDetails>;
  /** ACCOUNT LOCKS, keyed by person id. Locking blocks the person's email and
   *  phone from signing up AGAIN, which is a different and heavier thing than
   *  deactivation — see lib/record/guardian. Sparse: a missing key means not
   *  locked. */
  accountLocks: Record<string, AccountLock>;
  /** Staff edits to ANOTHER person's teen-facing profile, keyed by person id.
   *  Sparse and PARTIAL: a missing key (or field) falls back to the fixture in
   *  people-demo, so this map holds only what a lead/supervisor changed.
   *
   *  Why a separate map rather than `draft`: `draft` is the ONE store-backed
   *  mentor's own profile with the whole gated review-changeset flow attached.
   *  A lead editing someone else's record is a staff edit to a different
   *  person, not a change request against their own — same pattern as
   *  `caseloads` / `mentorStatuses`. Never keyed by "live". */
  personProfiles: Record<string, PersonProfile>;
  /** Staff edits to another person's Active Hours, keyed by person id. Whole
   *  schedules (the editor commits all of it), fixture default underneath. */
  personSchedules: Record<string, Schedule>;
  /** The record subject's org role + group memberships — staff-editable on the
   *  Mentorship › Organization card. Single-mentor prototype, so plain fields
   *  rather than per-mentor keyed maps. */
  mentorRole: string;
  mentorGroups: string[];
  /** The mentor's Active Hours (availability schedule) — editable on the
   *  record's Schedule tab (staff) and the mentor self-view. */
  schedule: Schedule;
  _hasHydrated: boolean;

  update: (patch: Partial<MentorDraft>) => void;
  markComplete: (slug: string) => void;
  setStatus: (status: ProfileStatus) => void;
  acceptInvite: (prefill: Partial<MentorDraft>) => void;
  setRejection: (note: string | null) => void;
  setChangeRequests: (requests: ChangeRequest[]) => void;
  /** Snapshot the current draft as the approved/published version (called on
   *  approve). Anchors post-publish change detection. */
  capturePublishedSnapshot: () => void;
  /** Set one non-profile hub step's completion status. */
  setHubStep: (key: HubStepKey, status: HubStepStatus) => void;
  /** Mark the hub's first-visit welcome modal as seen (one-way). */
  markHubWelcomeSeen: () => void;
  /** Mentor confirmed an unchanged field is fine as-is (explicit override). */
  confirmUnchanged: (id: string) => void;
  /** Undo a confirmed-unchanged back to none. */
  unconfirmChangeRequest: (id: string) => void;
  setWelcomeOpen: (open: boolean) => void;
  markWelcomeAutoShown: () => void;
  /** Staff: mentor-slots config (§4 Phase 6). */
  setSlots: (patch: Partial<{ total: number; dailyNew: number }>) => void;
  /** Staff: reversible deactivation round-trip (§4 Phase 6). */
  setAccountStatus: (
    status: "active" | "deactivated",
    deactivatedOn?: string | null
  ) => void;
  /** Gated save (§1.6): writes the draft AND enqueues each changed gated
   *  field into the open changeset, capturing liveValue from the published
   *  snapshot at enqueue time (§1.5 — never re-derived). Editing an enqueued
   *  field is absorbed; a changes-requested field flips back to pending
   *  (resubmission); editing back to the live value drops the field. Plain
   *  draft write pre-publish. */
  saveGatedFields: (patch: Partial<MentorDraft>) => void;
  /** Discard one proposed change: draft reverts to the enqueue-time live
   *  value; last field discarded clears the changeset silently. */
  discardProfileUpdateField: (fieldId: string) => void;
  /** Reviewer (Lead Mentor) send-back: noted fields flip to changes-requested; un-noted fields
   *  stay pending inside the changes-requested changeset (spec §3 note). */
  sendBackProfileUpdate: (notes: Record<string, string>) => void;
  /** Reviewer (Lead Mentor) approve: apply every proposed value (snapshot the draft), clear
   *  the changeset, fire the activity item (§1.4 all-or-nothing). */
  approveProfileUpdate: () => void;
  markActivityRead: () => void;
  /** RECORD-SCOPED staff edit (record-04a, invariant 2): sets one account
   *  field (draft key, or the top-level staffPhoto) and appends ONE
   *  staff-attributed activity entry — the audit trail for "Last changed
   *  by". Never fires mentor-facing toasts; never touches gated saves,
   *  changesets, or snapshots. */
  staffEditAccountField: (
    fieldId: string,
    value: unknown,
    actor: string
  ) => void;
  /** RECORD-SCOPED: a Lead Mentor's DIRECT edit of a teen-facing profile field.
   *  Unlike staffEditAccountField, it also writes the publishedSnapshot (when
   *  one exists) so the change is what teens see immediately — a direct edit,
   *  not a review changeset. Logs the same staff-attributed audit entry. */
  staffEditProfileField: (
    fieldId: string,
    value: unknown,
    actor: string
  ) => void;
  /** RECORD-SCOPED (record-05): append one internal staff note. */
  addInternalNote: (text: string, author: string) => void;
  /** RECORD-SCOPED (record-05): hide/restore teen visibility, with a
   *  staff-attributed activity entry (never reads as the mentor's action). */
  setProfileHidden: (hidden: boolean, actor: string) => void;
  setPersona: (p: Persona) => void;
  setStaffPhoto: (url: string | null) => void;
  /** Set one notification switch for the given persona (settings-03). */
  setNotificationPref: (
    persona: Persona,
    categoryId: string,
    enabled: boolean
  ) => void;
  /** Set a mentor's caseload (full value — the caller resolves the current
   *  override-or-default before writing). Caseload prompt. */
  setCaseload: (mentorId: string, caseload: Caseload) => void;
  /** Manually set a mentor's lifecycle status (staff toggle from the roster /
   *  record). Writes the override map keyed by mentor id. */
  setMentorStatus: (mentorId: string, status: MentorLifecycleStatus) => void;
  /** Manually set a mentor's availability INTENT (open to new mentees?). "Full"
   *  stays derived from the caseload — only this intent is stored. */
  setMentorAccepting: (mentorId: string, accepting: boolean) => void;
  setMenteeStatus: (teenId: string, status: MenteeStatus) => void;
  /** Record a supervisor's decision on a pending review. NO update/delete
   *  counterpart exists, on purpose (see careReviews). */
  approveCareReview: (
    decision: CareReviewDecision,
    /** The cycle's evidence, frozen. Omitted when no summary could be stated —
     *  see the note at the implementation. */
    summary?: CareSummaryCommit
  ) => void;
  /** Appends a flag closure. No counterpart reopens one — see the field. */
  setAiUsageFeedback: (
    teenId: string,
    rating: "up" | "down",
    note?: string | null
  ) => void;
  closeCareFlag: (closure: CareFlagClosure) => void;
  setDevBarHidden: (hidden: boolean) => void;
  /** Append a care update. No update/delete counterpart, on purpose. */
  addCareUpdate: (update: CareUpdateRecord) => void;
  refreshCareSummary: (teenId: string, at: number) => void;
  /** End a pairing. APPENDS — there is deliberately no un-end and no delete. */
  endRelationship: (event: RelationshipEvent) => void;
  setGuardian: (teenId: string, patch: Partial<GuardianDetails>) => void;
  /** Pass null to UNLOCK. A lock blocks a real person from returning, so the
   *  remedy has to exist. */
  setAccountLock: (personId: string, lock: AccountLock | null) => void;
  /** Release a manual lifecycle override so the DERIVED standing shows again.
   *  Without this the override map was a one-way door: `mentorStatuses[id] ??
   *  liveLifecycle(...)` meant one dropdown click permanently masked the real
   *  accountStatus/profileHidden axes. */
  clearMentorStatus: (mentorId: string) => void;
  /** Staff edits to the record subject's org role + group memberships. */
  setMentorRole: (role: string) => void;
  setMentorGroups: (groups: string[]) => void;
  /** Replace the Active Hours schedule (the editor commits the whole thing). */
  setSchedule: (schedule: Schedule) => void;
  /** Staff edit to another person's profile — MERGES the patch over any
   *  existing override, so callers send only the field they changed. */
  setPersonProfile: (personId: string, patch: PersonProfile) => void;
  /** Staff edit to another person's Active Hours (whole schedule). */
  setPersonSchedule: (personId: string, schedule: Schedule) => void;
  /** The "You're approved!" CTA — the mentor has entered their live home. */
  markHomeEntered: () => void;
  setHasHydrated: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      status: "invited",
      completed: [],
      rejectionNote: null,
      changeRequests: [],
      publishedSnapshot: null,
      hubSteps: emptyHubSteps(),
      hubWelcomeSeen: false,
      slots: { total: 16, dailyNew: 1 },
      accountStatus: "active",
      deactivatedOn: null,
      profileUpdate: null,
      activity: [],
      welcomeOpen: false,
      welcomeAutoShown: false,
      _hasHydrated: false,
      persona: "mentor",
      staffPhoto: null,
      internalNotes: [],
      profileHidden: false,
      enteredHome: false,
      notificationPrefs: {},
      caseloads: {},
      mentorStatuses: {},
      mentorAccepting: {},
      menteeStatus: {},
      careReviews: {},
      careFlagClosures: {},
      aiUsageFeedback: {},
      careSummaryCommits: {},
      devBarHidden: false,
      activityRead: {},
      activityScenarioId: "typical-shift",
      devLoadState: DEFAULT_LOAD_STATE,
      devClockKey: null,
      todayScenarioId: null,
      tasksScenarioId: DEFAULT_TASK_SCENARIO_ID,
      monitoringScenarioId: null,
      chatScenarioId: DEFAULT_CHAT_SCENARIO_ID,
      escalations: {},
      chatEvents: {},
      chatMessages: {},
      chatNotes: {},
      chatArtifacts: {},
      tierEvents: [],
      escalationHistory: [],
      tasksResetNonce: 0,
      tasksLastVisitAt: 0,
      shiftLastSeenAt: 0,
      activityDensity: "dense",
      viewOptions: {},
      shiftDigestDismissedAt: 0,
      pinnedMentees: [],
      viewedCareReviews: [],
      scenarioRecents: [],
      closedCareReviews: [],
      careUpdates: {},
      careSummaryRefreshedAt: {},
      relationshipEvents: [],
      guardians: {},
      accountLocks: {},
      personProfiles: {},
      personSchedules: {},
      mentorRole: "Mentor",
      mentorGroups: ["North Carolina", "New Jersey"],
      schedule: cloneSchedule(DEFAULT_SCHEDULE),

      update: (patch) =>
        set((state) => ({ draft: { ...state.draft, ...patch } })),

      markComplete: (slug) =>
        set((state) =>
          state.completed.includes(slug)
            ? state
            : { completed: [...state.completed, slug] }
        ),

      setStatus: (status) => set({ status }),

      acceptInvite: (prefill) =>
        set((state) => {
          // Seed the DB-sourced basics, but only into fields the mentor hasn't
          // already filled (so a revisit never clobbers their edits).
          const merged = { ...state.draft } as unknown as Record<string, unknown>;
          const existing = state.draft as unknown as Record<string, unknown>;
          for (const [key, value] of Object.entries(prefill)) {
            const current = existing[key];
            const isEmpty =
              current == null ||
              current === "" ||
              (Array.isArray(current) && current.length === 0);
            if (isEmpty) merged[key] = value;
          }
          return {
            status: state.status === "invited" ? "pending" : state.status,
            draft: merged as unknown as MentorDraft,
          };
        }),

      setRejection: (note) => set({ rejectionNote: note }),

      setChangeRequests: (requests) => set({ changeRequests: requests }),

      capturePublishedSnapshot: () =>
        set((state) => ({ publishedSnapshot: snapshotDraft(state.draft) })),

      setHubStep: (key, status) =>
        set((state) => ({ hubSteps: { ...state.hubSteps, [key]: status } })),

      markHubWelcomeSeen: () => set({ hubWelcomeSeen: true }),

      confirmUnchanged: (id) =>
        set((state) => ({
          changeRequests: state.changeRequests.map((c) =>
            c.id === id ? { ...c, confirmedUnchanged: true } : c
          ),
        })),

      unconfirmChangeRequest: (id) =>
        set((state) => ({
          changeRequests: state.changeRequests.map((c) =>
            c.id === id ? { ...c, confirmedUnchanged: false } : c
          ),
        })),

      setWelcomeOpen: (welcomeOpen) => set({ welcomeOpen }),

      markWelcomeAutoShown: () => set({ welcomeAutoShown: true }),

      setSlots: (patch) =>
        set((state) => ({ slots: { ...state.slots, ...patch } })),

      setAccountStatus: (accountStatus, deactivatedOn = null) =>
        set({ accountStatus, deactivatedOn }),

      saveGatedFields: (patch) =>
        set((state) => {
          const draft = { ...state.draft, ...patch };
          const snap = state.publishedSnapshot;
          if (!snap) return { draft }; // pre-publish: plain write
          const now = Date.now();

          // ── Immediate teen-facing keys (first moments) ────────────────────
          // These are NOT gated, so they never enter the changeset. But the
          // record and the phone preview read `publishedSnapshot ?? draft`, so
          // writing only the draft would leave staff looking at the OLD value
          // forever. Move the snapshot too, and log ONE activity entry so the
          // change stays auditable without asking anyone to approve it.
          const immediateKeys = Object.keys(patch).filter(
            isImmediateTeenFacingField
          );
          const immediate: Partial<OnboardingState> = {};
          if (immediateKeys.length > 0) {
            immediate.publishedSnapshot = {
              ...snap,
              ...Object.fromEntries(
                immediateKeys.map((k) => [
                  k,
                  (draft as unknown as Record<string, unknown>)[k],
                ])
              ),
            } as typeof snap;
            immediate.activity = [
              {
                id: `act-${now}`,
                type: "profile_update_live" as const,
                fieldIds: immediateKeys,
                createdAt: now,
                read: false,
              },
              ...state.activity,
            ];
          }

          const prior = state.profileUpdate;
          let fields = prior ? [...prior.fields] : [];
          let touched = false;
          for (const key of Object.keys(patch)) {
            if (!isGatedField(key)) continue;
            const proposed = (draft as unknown as Record<string, unknown>)[key];
            const existing = fields.find((f) => f.fieldId === key);
            const live = existing
              ? existing.liveValue
              : cloneValue(
                  (snap as unknown as Record<string, unknown>)[key]
                );
            const differs =
              JSON.stringify(normForCompare(key as keyof MentorDraft, proposed)) !==
              JSON.stringify(normForCompare(key as keyof MentorDraft, live));
            if (!differs) {
              if (existing) {
                fields = fields.filter((f) => f.fieldId !== key);
                touched = true;
              }
              continue;
            }
            if (existing) {
              if (existing.fieldStatus === "changes-requested") {
                // Resubmission: back to pending; the note is resolved.
                fields = fields.map((f) =>
                  f.fieldId === key
                    ? { ...f, fieldStatus: "pending" as const, adminNote: null }
                    : f
                );
                touched = true;
              }
              // pending fields absorb further edits — liveValue stays fixed.
            } else {
              fields.push({
                fieldId: key,
                liveValue: live,
                fieldStatus: "pending",
                adminNote: null,
              });
              touched = true;
            }
          }
          if (fields.length === 0)
            return { draft, profileUpdate: null, ...immediate };
          const status =
            touched || !prior
              ? ("pending" as const) // new/resubmitted work → back in the queue
              : prior.status;
          return {
            draft,
            profileUpdate: {
              id: prior?.id ?? `pu-${now}`,
              status,
              submittedAt: prior?.submittedAt ?? now,
              updatedAt: now,
              fields,
            },
            ...immediate,
          };
        }),

      discardProfileUpdateField: (fieldId) =>
        set((state) => {
          const u = state.profileUpdate;
          const field = u?.fields.find((f) => f.fieldId === fieldId);
          if (!u || !field) return state;
          const fields = u.fields.filter((f) => f.fieldId !== fieldId);
          const draft = {
            ...state.draft,
            [fieldId]: cloneValue(field.liveValue),
          } as MentorDraft;
          return {
            draft,
            profileUpdate: fields.length
              ? { ...u, fields, updatedAt: Date.now() }
              : null, // last field discarded → cleared silently
          };
        }),

      sendBackProfileUpdate: (notes) =>
        set((state) => {
          const u = state.profileUpdate;
          if (!u) return state;
          const now = Date.now();
          const fields = u.fields.map((f) =>
            notes[f.fieldId]?.trim()
              ? {
                  ...f,
                  fieldStatus: "changes-requested" as const,
                  adminNote: notes[f.fieldId].trim(),
                }
              : f // un-noted fields stay pending, publish with next approval
          );
          const flagged = fields
            .filter((f) => f.fieldStatus === "changes-requested")
            .map((f) => f.fieldId);
          return {
            profileUpdate: {
              ...u,
              status: "changes-requested",
              updatedAt: now,
              fields,
            },
            activity: [
              {
                id: `act-${now}`,
                type: "profile_changes_requested" as const,
                fieldIds: flagged,
                createdAt: now,
                read: false,
              },
              ...state.activity,
            ],
          };
        }),

      approveProfileUpdate: () =>
        set((state) => {
          const u = state.profileUpdate;
          if (!u) return state;
          const now = Date.now();
          return {
            // Apply every proposed value: the draft holds proposed; discarded
            // fields were already reverted — snapshotting IS the publish.
            publishedSnapshot: snapshotDraft(state.draft),
            profileUpdate: null,
            activity: [
              {
                id: `act-${now}`,
                type: "profile_update_live" as const,
                fieldIds: u.fields.map((f) => f.fieldId),
                createdAt: now,
                read: false,
              },
              ...state.activity,
            ],
          };
        }),

      markActivityRead: () =>
        set((state) =>
          state.activity.some((a) => !a.read)
            ? { activity: state.activity.map((a) => (a.read ? a : { ...a, read: true })) }
            : state
        ),

      staffEditAccountField: (fieldId, value, actor) =>
        set((state) => {
          const now = Date.now();
          const entry = {
            id: `act-${now}`,
            type: "staff_account_edit" as const,
            fieldIds: [fieldId],
            createdAt: now,
            read: false,
            actor,
          };
          if (fieldId === "staffPhoto") {
            return {
              staffPhoto: (value as string | null) ?? null,
              activity: [entry, ...state.activity],
            };
          }
          return {
            draft: { ...state.draft, [fieldId]: value },
            activity: [entry, ...state.activity],
          };
        }),

      staffEditProfileField: (fieldId, value, actor) =>
        set((state) => {
          const now = Date.now();
          const entry = {
            id: `act-${now}`,
            type: "staff_account_edit" as const,
            fieldIds: [fieldId],
            createdAt: now,
            read: false,
            actor,
          };
          // Direct edit: write the draft AND (when published) the snapshot the
          // record + teens read from, so the change is live immediately.
          return {
            draft: { ...state.draft, [fieldId]: value },
            publishedSnapshot: state.publishedSnapshot
              ? { ...state.publishedSnapshot, [fieldId]: value }
              : state.publishedSnapshot,
            activity: [entry, ...state.activity],
          };
        }),

      addInternalNote: (text, author) =>
        set((state) => ({
          internalNotes: [
            {
              id: `note-${Date.now()}`,
              text: text.trim(),
              author,
              createdAt: Date.now(),
            },
            ...state.internalNotes,
          ],
        })),

      setProfileHidden: (hidden, actor) =>
        set((state) => {
          const now = Date.now();
          return {
            profileHidden: hidden,
            activity: [
              {
                id: `act-${now}`,
                type: hidden
                  ? ("profile_unpublished" as const)
                  : ("profile_republished" as const),
                fieldIds: [],
                createdAt: now,
                read: false,
                actor,
              },
              ...state.activity,
            ],
          };
        }),

      setPersona: (p) => set({ persona: p }),

      markHomeEntered: () => set({ enteredHome: true }),
      setStaffPhoto: (url) => set({ staffPhoto: url }),

      setNotificationPref: (persona, categoryId, enabled) =>
        set((state) => ({
          notificationPrefs: {
            ...state.notificationPrefs,
            [persona]: {
              ...(state.notificationPrefs[persona] ?? {}),
              [categoryId]: enabled,
            },
          },
        })),

      setCaseload: (mentorId, caseload) =>
        set((state) => ({
          caseloads: { ...state.caseloads, [mentorId]: caseload },
        })),

      setMentorStatus: (mentorId, status) =>
        set((state) => ({
          mentorStatuses: { ...state.mentorStatuses, [mentorId]: status },
        })),

      setMentorAccepting: (mentorId, accepting) =>
        set((state) => ({
          mentorAccepting: { ...state.mentorAccepting, [mentorId]: accepting },
        })),
      setMenteeStatus: (teenId, status) =>
        set((state) => ({
          menteeStatus: { ...state.menteeStatus, [teenId]: status },
        })),
      setDevBarHidden: (hidden) => set({ devBarHidden: hidden }),

      // ── ACTIVITY LEDGER OVERLAY (v35) ───────────────────────────────────
      // Each action delegates to lib/activity/read-state.ts. The store holds the
      // map and nothing else: it does not know the key format, and there is NO
      // action that removes an entry — standing rule 11, clearing is never
      // deleting, and the module deliberately exports no delete.
      setTasksLastVisitAt: (at) => set({ tasksLastVisitAt: at }),
      setActivityDensity: (density) => set({ activityDensity: density }),
      /** MERGED PER SCOPE, so setting density does not clear layout. */
      dismissShiftDigest: (at) => set({ shiftDigestDismissedAt: at }),
      pinMentee: (id, at) =>
        set((st) => {
          if (st.pinnedMentees.some((p) => p.id === id)) return st;
          if (st.pinnedMentees.length >= PIN_CAP) return st;
          return { pinnedMentees: [...st.pinnedMentees, { id, at }] };
        }),
      unpinMentee: (id) =>
        set((st) => ({
          pinnedMentees: st.pinnedMentees.filter((p) => p.id !== id),
        })),
      setViewOptions: (scope, next) =>
        set((st) => ({
          viewOptions: {
            ...st.viewOptions,
            [scope]: {
              ...VIEW_OPTIONS_DEFAULT,
              ...st.viewOptions[scope],
              ...next,
            },
          },
        })),
      setActivityScenarioId: (id) =>
        // Switching scenario drops the overlay so the new scenario seeds from its
        // own fixture decision about what starts unread. NOT a delete of anything
        // meaningful (rule 11 is about a viewer clearing a ROW) — this is the
        // prototype simulator swapping one fixture ledger for another.
        set({ activityScenarioId: id, activityRead: {} }),
      /* ═══ AND IT DROPS THE CARE TRACES (rework §9) ═══
         Exactly the reasoning `setChatScenarioId` below already runs on:
         "switching scenario drops everything keyed to the old fixtures".
         `viewedCareReviews` and `closedCareReviews` hold ENTRY IDS —
         `task-3`, a coalesce group's id — and every task scenario rebuilds
         those ids from index 1. So without this, switching from a 19-row
         fixture to a 3-row one left a reading trace whose ids now name
         DIFFERENT reviews: rows marked read that nobody had opened, and a
         Submitted tab listing submissions against records that no longer
         exist. Found while §9 looked for a fixture that would make the
         Submitted empty state reachable; the answer was that the switch should
         have been clearing it all along.
         IT IS ALSO WHAT MAKES §9's `care-submitted-empty` AND
         `care-all-unviewed` REACHABLE without a fixture — see the note under
         `TASK_SCENARIOS`. */
      setTasksScenarioId: (id) =>
        set({
          tasksScenarioId: id,
          viewedCareReviews: [],
          /* CLOSED RECORDS ARE PER FIXTURE TOO. They are self-contained now, but
             their ids are the old fixture's task ids, and the new fixture reuses
             `task-1…n` — so a kept record would hide a DIFFERENT open review. */
          closedCareReviews: [],
          /* ═══ `scenarioRecents` IS NOT CLEARED HERE, AND IT WAS ═══
             A blanket insert put it beside the two care traces, so selecting a
             Care Reviews scenario RECORDED it as recent and then immediately
             cleared the list — the recents row never appeared, and the value
             read `[]` a moment after a set that had just written it. Found by
             probing the action: it fired with the right id and `before=[]`
             every time, which is what pointed at something downstream.
             THE TRACES BELONG HERE AND RECENTS DOES NOT. The traces are keyed
             to the fixture being replaced, so they are stale the instant it
             changes. Recents is a record of what a reviewer REACHED FOR; a
             scenario switch is the event that adds to it, so clearing it here
             erased exactly the thing the action should have been feeding. */
        }),
      /* The tier log and the escalation records are ONE store across both dev
         axes now, so switching either scenario drops what this session wrote
         against the old fixtures — the same reasoning as the chat switch. */
      /* ═══ AND THE CHAT WRITES WITH THEM (pack v5.0, bug 1) ═══ Dropping the
         escalation records while KEEPING the thread's events resurrected the
         fixture's open escalation under a stale "closed the escalation" chip
         — close it again and the thread carried two (measured: 3:05 and 5:05,
         no raise between). The chat switch and Reset already clear all of
         these together; this switch was the one asymmetric reset. */
      setMonitoringScenarioId: (id) =>
        set({ monitoringScenarioId: id, tierEvents: [], escalationHistory: [], escalations: {}, chatEvents: {}, chatMessages: {}, chatNotes: {}, chatArtifacts: {} }),
      /* Switching scenario drops everything keyed to the old fixtures — the same
         reasoning as `setActivityScenarioId` clearing its read overlay. An
         escalation on Jordan's thread means nothing once the roster's threads have
         been rebuilt from another scenario's dialogue. */
      appendChatEvent: (event) =>
        set((st) => ({
          chatEvents: {
            ...st.chatEvents,
            [event.threadId]: [...(st.chatEvents[event.threadId] ?? []), event],
          },
        })),
      appendChatMessage: (message) =>
        set((st) => ({
          chatMessages: {
            ...st.chatMessages,
            [message.threadId]: [...(st.chatMessages[message.threadId] ?? []), message],
          },
        })),
      putChatArtifact: (artifact) =>
        set((st) => ({
          chatArtifacts: { ...st.chatArtifacts, [artifact.id]: artifact },
        })),
      putChatNote: (note) =>
        set((st) => ({ chatNotes: { ...st.chatNotes, [note.id]: note } })),
      putEscalation: (escalation) =>
        set((st) => {
          const prev = st.escalations[escalation.threadId];
          /* A NEW escalation on a thread whose last one was resolved: the old
             record is history, not something to overwrite. */
          const superseded = prev && prev.id !== escalation.id && prev.resolvedAt !== null;
          return {
            escalations: { ...st.escalations, [escalation.threadId]: escalation },
            ...(superseded ? { escalationHistory: [...st.escalationHistory, prev] } : {}),
          };
        }),
      appendTierEvent: (event) => {
        if (!appendable(event).ok) return false;
        set((st) => ({ tierEvents: [...st.tierEvents, event] }));
        return true;
      },
      setChatScenarioId: (id) =>
        set({
          chatScenarioId: id,
          escalations: {},
          chatEvents: {},
          chatMessages: {},
          chatNotes: {},
          chatArtifacts: {},
          tierEvents: [],
          escalationHistory: [],
        }),
      resetTasksReviewed: () =>
        set((st) => ({ tasksResetNonce: st.tasksResetNonce + 1 })),
      setShiftSeenAt: (at) => set({ shiftLastSeenAt: at }),
      setDevLoadState: (state) => set({ devLoadState: state }),
      /* Validated against the table rather than stored blind, so a stale key
         from an older build falls back to the live clock instead of pinning
         nothing and reading as broken. */
      setDevClockKey: (key) =>
        set({ devClockKey: key && devClockByKey(key) ? key : null }),
      /* ═══ ONE SELECTION, THREE AXES WRITTEN (Phase J.3) ═══
         A Today scenario is a composition, so choosing one sets the fixtures it
         names rather than becoming a fourth data source. Clearing it leaves the
         axes where they are: the reader chose those values, even if by way of a
         composition, and silently reverting them would be the control lying
         about its own effect. */
      /* ═══ CAPPED, AND THE CAP IS STATED (§5.2, §5.1) ═══
         A reading trace grows for the life of a browser profile. 500 is far
         past any real shift and far short of a localStorage problem; the
         oldest entries fall off, which is correct for a trace — the rows a
         supervisor looked at a month ago are not rows this list still needs to
         mark. */
      /* NEWEST FIRST, DE-DUPLICATED, CAPPED. The filter runs BEFORE the unshift
         so an entry already present moves rather than repeats. */
      noteScenarioUsed: (prefixedId) =>
        set((st) => {
          if (!prefixedId) return {};
          const next = [
            prefixedId,
            ...st.scenarioRecents.filter((x) => x !== prefixedId),
          ].slice(0, SCENARIO_RECENTS_CAP);
          return { scenarioRecents: next };
        }),
      markCareReviewViewed: (id) =>
        set((st) =>
          st.viewedCareReviews.includes(id)
            ? st
            : { viewedCareReviews: [...st.viewedCareReviews, id].slice(-CARE_TRACE_CAP) }
        ),
      recordClosedCareReview: (record) =>
        set((st) =>
          st.closedCareReviews.some((r) => r.id === record.id)
            ? st
            : { closedCareReviews: [...st.closedCareReviews, record] }
        ),
      resetCareReviewState: () =>
        set({ viewedCareReviews: [], closedCareReviews: [] }),
      setTodayScenarioId: (id) => {
        const sc = todayScenarioById(id);
        if (!sc) {
          set({ todayScenarioId: null });
          return;
        }
        set({
          todayScenarioId: sc.id,
          tasksScenarioId: sc.tasks,
          monitoringScenarioId: sc.monitoring,
          /* Stamped so `pins[0]` is the oldest — F.3 orders ascending by pin
             time, so the rendered order has to match the declared array. */
          pinnedMentees: pinsFor(sc, Date.now()),
        });
      },
      seedActivityRead: (overlay) => set({ activityRead: overlay }),
      markActivityRowsRead: (viewerId, scope, eventIds) =>
        set((s) => ({
          activityRead: markOverlayRead(
            s.activityRead,
            viewerId,
            scope,
            eventIds
          ),
        })),
      clearActivityRow: (viewerId, scope, eventId) =>
        set((s) => ({
          activityRead: clearOverlayRow(s.activityRead, viewerId, scope, eventId),
        })),
      restoreActivityRow: (viewerId, scope, eventId) =>
        set((s) => ({
          activityRead: restoreOverlayRow(
            s.activityRead,
            viewerId,
            scope,
            eventId
          ),
        })),
      /** ONE ACTION FOR BOTH HALVES. A rating replaces whatever was there and
       *  clears any note with it — changing your mind from down to up must not
       *  leave the complaint attached to a thumbs-up. Passing a note is the
       *  submit path; omitting it sets the rating and writes no note. */
      setAiUsageFeedback: (teenId, rating, note) =>
        set((state) => ({
          aiUsageFeedback: {
            ...state.aiUsageFeedback,
            [teenId]: { rating, note: note ?? null, at: Date.now() },
          },
        })),
      closeCareFlag: (closure) =>
        set((state) => ({
          careFlagClosures: {
            ...state.careFlagClosures,
            [closure.flagId]: closure,
          },
        })),
      // ONE `set`, TWO WRITES, ON PURPOSE. The decision and the evidence it was
      // made on land together or not at all. Split into two actions, an
      // interruption between them — a thrown render, a closed tab — would leave a
      // record holding a billing-code decision with no evidence behind it, and
      // nothing downstream could tell that apart from a decision made on nothing.
      //
      // `summary` is optional because a decision can legitimately be made with no
      // summary available: under three contact days the document refuses, and
      // forcing a commit there would fabricate an entry.
      approveCareReview: (decision, summary) =>
        set((state) => ({
          careReviews: { ...state.careReviews, [decision.reviewId]: decision },
          careSummaryCommits: summary
            ? {
                ...state.careSummaryCommits,
                [summary.teenId]: [
                  ...(state.careSummaryCommits[summary.teenId] ?? []),
                  summary,
                ],
              }
            : state.careSummaryCommits,
        })),
      addCareUpdate: (update) =>
        set((state) => ({
          careUpdates: { ...state.careUpdates, [update.id]: update },
        })),
      refreshCareSummary: (teenId, at) =>
        set((state) => ({
          careSummaryRefreshedAt: { ...state.careSummaryRefreshedAt, [teenId]: at },
        })),
      endRelationship: (event) =>
        set((state) => ({
          relationshipEvents: [...state.relationshipEvents, event],
        })),
      setGuardian: (teenId, patch) =>
        set((state) => ({
          guardians: {
            ...state.guardians,
            // Seeded from the FIXTURE, not from empty: every teen has a
            // guardian on file, so a first edit to one field must not blank the
            // other four. Merged on top of any earlier staff edit.
            [teenId]: { ...guardianFor(teenId), ...state.guardians[teenId], ...patch },
          },
        })),
      setAccountLock: (personId, lock) =>
        set((state) => {
          const next = { ...state.accountLocks };
          if (lock) next[personId] = lock;
          else delete next[personId];
          return { accountLocks: next };
        }),
      setPersonProfile: (personId, patch) =>
        set((state) => ({
          personProfiles: {
            ...state.personProfiles,
            // Merge, so editing the bio doesn't wipe an earlier interests edit.
            [personId]: { ...state.personProfiles[personId], ...patch },
          },
        })),
      setPersonSchedule: (personId, schedule) =>
        set((state) => ({
          personSchedules: { ...state.personSchedules, [personId]: schedule },
        })),
      clearMentorStatus: (mentorId) =>
        set((state) => {
          const next = { ...state.mentorStatuses };
          delete next[mentorId];
          return { mentorStatuses: next };
        }),

      setMentorRole: (role) => set({ mentorRole: role }),
      setMentorGroups: (groups) => set({ mentorGroups: groups }),
      setSchedule: (schedule) => set({ schedule }),

      setHasHydrated: () => set({ _hasHydrated: true }),

      reset: () =>
        set({
          draft: emptyDraft(),
          status: "invited",
          completed: [],
          rejectionNote: null,
          changeRequests: [],
          publishedSnapshot: null,
          hubSteps: emptyHubSteps(),
          hubWelcomeSeen: false,
          slots: { total: 16, dailyNew: 1 },
          accountStatus: "active",
          deactivatedOn: null,
          profileUpdate: null,
          activity: [],
          staffPhoto: null, // persona is a dev lens, not data — reset leaves it
          internalNotes: [],
          profileHidden: false,
          enteredHome: false,
          notificationPrefs: {}, // dev lens keeps switches per persona; reset clears
          caseloads: {}, // caseload overrides reset with the mentor
          mentorStatuses: {}, // status overrides reset with the mentor
          mentorAccepting: {}, // availability intent resets with the mentor
          menteeStatus: {},
          careReviews: {}, // dev "start over" restores the pending reviews
          careFlagClosures: {}, // …and reopens the closed flags
          careSummaryCommits: {}, // …and un-commits the frozen summaries
          activityRead: {}, // dev "start over" returns every row to its seed state
          activityScenarioId: "typical-shift",
          // Reset returns the harness to a normal load, like it returns the
          // persona lens: a "start over" that left the feed in an error state
          // would look like the reset had failed.
          devLoadState: DEFAULT_LOAD_STATE,
      devClockKey: null,
      todayScenarioId: null,
          tasksScenarioId: DEFAULT_TASK_SCENARIO_ID,
          monitoringScenarioId: null,
          chatScenarioId: DEFAULT_CHAT_SCENARIO_ID,
          /* RESET CLEARS THE CHAT WRITES. Reset re-seeds every fixture, so an
             escalation left open would be an escalation with no conversation
             behind it — orphaned by id, and pinned to a thread whose messages have
             been rebuilt from scratch. */
          escalations: {},
          chatEvents: {},
          chatMessages: {},
          chatNotes: {},
          chatArtifacts: {},
          tierEvents: [],
          escalationHistory: [],
          tasksLastVisitAt: 0,
          shiftLastSeenAt: 0, // …and brings the shift-start digest back
          activityDensity: "dense",
      viewOptions: {},
      shiftDigestDismissedAt: 0,
      pinnedMentees: [],
      viewedCareReviews: [],
      /* RESET CLEARS RECENTS, deliberately: it re-seeds every fixture, so a list
         of scenarios reached against the old ones is exactly as stale as the chat
         writes cleared below. This is the ONE action that should clear it —
         `setTasksScenarioId` briefly did too, which was a bug; see its note. */
      scenarioRecents: [],
      closedCareReviews: [],
          careUpdates: {},
          careSummaryRefreshedAt: {},
          relationshipEvents: [], // dev "start over" restores the fixture edges
          guardians: {},
          accountLocks: {},
          // Staff edits to other people's records clear too — reset is the dev
          // "start over", and leaving them would strand edits whose fixture
          // baseline has just been restored.
          personProfiles: {},
          personSchedules: {},
          mentorRole: "Mentor",
          mentorGroups: ["North Carolina", "New Jersey"],
          schedule: cloneSchedule(DEFAULT_SCHEDULE),
          welcomeOpen: false,
          welcomeAutoShown: false,
        }),
    }),
    {
      name: "somethings.mentor-onboarding",
      // v2: interests string[] → InterestEntry[] + drop additionalImages. v3: vibe
      // board. v4: genderIdentity. v5: changeRequests list (replaces rejectionNote).
      // v6: changeRequests gain stepId/fieldKey/baselineValue/confirmedUnchanged
      // (replacing step/done). v7: add hubSteps. v8: hubWelcomeSeen (first-visit
      // hub welcome modal) replaces the old submit toast. v9: publishedSnapshot
      // (post-publish change detection). v10: accountPhoto (internal/account
      // photo on the settings Profile tab). v11: profilePhoto → matchCardPhoto
      // (§4 Phase 3 rename — draft, snapshot, and persisted change-request
      // field mappings). v12: firstMessages + storySlides (§4 Phase 3
      // extensions; snapshot backfilled so published mentors don't read as
      // falsely dirty). v13: storySlides → stories[] (LIBRARY-READY §4 rev —
      // single 'first-moment' entry; draft, snapshot, and change-request
      // fieldKeys remapped). v14: profileUpdate changeset + activity feed;
      // post-publish in_review/rejected retired. Convert state in place.
      // v19: notificationPrefs (settings-03) — sparse per-persona switch map;
      // backfill {} (defaults live in notifications-config.ts, not the store).
      // v20: caseloads (caseload prompt) — sparse per-mentor {mode,total} map;
      // backfill {} (defaults: people-demo capacity / slots.total for "live").
      // v21: mentorStatuses (manual status toggle) — sparse per-mentor override
      // map; backfill {} (fallback = fixture status / derived liveLifecycle).
      // v22: mentorAccepting (availability intent toggle) — sparse per-mentor
      // bool map; backfill {} (fallback = fixture accepting / true for "live").
      // v23: mentorRole + mentorGroups (staff-editable org role + memberships) —
      // backfill "Mentor" / the default groups.
      // v24: schedule (Active Hours) — backfill DEFAULT_SCHEDULE.
      // v25: menteeActive (per-mentee active/inactive override) — sparse map;
      //      backfill {} so a missing key falls back to the fixture's `active`.
      // v26: personProfiles + personSchedules (staff edits to OTHER people's
      //      teen-facing profile + Active Hours) — sparse maps keyed by person
      //      id; backfill {} so every field falls back to the people-demo
      //      fixture until a lead/supervisor actually changes it.
      // v28: menteeActive (boolean) → menteeStatus (active/paused/deactivated).
      //      The mentee table shows three states; a boolean can only carry two,
      //      and keeping both would be two sources for one fact. Migrate in
      //      place: false → "deactivated", anything else → "active".
      // v27: first moments UNGATED. Any open changeset may still hold
      //      firstMessages/stories entries that no longer have a review path —
      //      they'd be stuck in a queue nothing can approve. APPLY them (the
      //      draft already holds the proposed value, so publishing is just
      //      snapshotting it — same reasoning as approveProfileUpdate), drop the
      //      entries, and clear the changeset when nothing gated remains.
      // v29: careReviews (approved presentation reviews, keyed by review id) —
      //      sparse map; backfill {} so every fixture review reads as pending
      //      again. Append-only: no setter edits or removes an entry.
      // v30: careUpdates + careSummaryRefreshedAt — sparse maps, both additive.
      //      Backfill {} so a record with no staff-written updates reads as one.
      // v31: relationshipEvents (append-only ended-pairing log) — backfill [] so
      //      an older persisted state reads as "no pairing has been ended".
      // v32: guardians (parent consent per teen) + accountLocks (signup blocks)
      //      — both sparse and additive; backfill {}.
      // v33: careFlagClosures (escalation / risk-flag closures, keyed by flag
      //      id) — sparse and additive; backfill {} so an older persisted state
      //      reads as "no flag has been closed". Append-only.
      // v38: activityDensity ("dense" | "detailed") — the Activity feed's reading
      //      density. A SCALAR WITH A CLOSED VALUE SET, so the migration backfills
      //      "dense" and the merge self-heals anything outside the union rather
      //      than trusting a persisted string to still be one of two words.
      // v37: tasksLastVisitAt (when the supervisor last opened the Tasks
      //      worklist) — a SCALAR, backfilled 0. Zero reads as "never opened",
      //      which counts as a >8h gap and shows the shift-start digest, so an
      //      older persisted state meets the digest once rather than never.
      // v36: activityScenarioId (which seed scenario the Activity ledger shows)
      //      — a SCALAR, so the backfill is a default rather than {}. Defaults to
      //      the typical shift: the scenario the surface is meant to be judged on.
      // v35: activityRead (the Activity ledger's per-viewer read/clear overlay,
      //      keyed viewerId::scope::eventId) — a MAP, backfilled {}. An empty
      //      overlay means every event reads as unread, which is correct for a
      //      viewer who has never opened the feed. SCOPE IS IN THE KEY; see
      //      lib/activity/read-state.ts and standing rule 10.
      // v34: careRailOpen (Care assistant rail expanded?) — REMOVED at v40 with
      //      the rail itself. The v34 migration below still backfills it, which
      //      is deliberate: a migration is a record of what a stored payload
      //      looked like, and editing history to match today's shape is how a
      //      chain of migrations stops being replayable. The field is simply
      //      dropped at v40.
      // v39: devBarHidden (is the prototype harness put away?) — a SCALAR with a
      //      default, so the backfill is `false` and every existing session keeps
      //      the bar it already had. NOT in `reset()`: see the note on the field.
      // v40: careSummaryCommits (committed per-cycle care summaries) — a MAP of
      //      ARRAYS, backfilled {}. An empty log is correct for every existing
      //      session: no summary has ever been committed, and BACKFILLING ONE
      //      WOULD BE FABRICATING EVIDENCE for decisions already in the record.
      //      Old records therefore show approved reviews with no summary beside
      //      them, which is the truth about them.
      // v41: devLoadState (the harness's load-state axis, lifted out of the
      //      Activity page) — a CLOSED UNION, so the backfill is the default
      //      rather than {} and anything unrecognised becomes "ready". A session
      //      opening on "error" because a stored value drifted would look like a
      //      broken app rather than a set control.
      // v42: tasksScenarioId (which Tasks seed the worklist shows) — lifted out
      //      of the page's own pinned panel, which was unreachable below `md`.
      //      A scalar preference, so the backfill is the default id.
      // v43: the mentor chat's four persisted fields plus its scenario axis.
      //      `chatScenarioId` is a scalar preference (backfill: the default id);
      // v44: shiftLastSeenAt (when the supervisor last started a shift) — a
      //      SCALAR, and the one migration in this chain that CARRIES A VALUE
      //      rather than backfilling a default. `tasksLastVisitAt` held the same
      //      instant under a name that stopped being true when the shift-start
      //      digest moved to Home, so an existing session inherits its place in
      //      the shift instead of meeting the digest again on upgrade. The old
      //      field stays: deleting it would cost a migration to remove a number,
      //      which is the trade this codebase already declined once for it.
      //      `escalations`, `chatEvents`, `chatNotes` and `chatArtifacts` are
      //      sparse maps, so {} is the correct backfill and reads as "this mentor
      //      has raised nothing, sent nothing and written nothing" — which is true
      //      of every state persisted before this version existed.
      // v46: viewOptions — the Layout Pass §5 density/layout map, keyed by
      //      destination. Sparse and additive, so {} is the correct backfill and
      //      reads as "this user has not opened the control", which is true of
      //      every state persisted before this version existed.
      // v47: viewOptions entries become {preset} — Refinement §4 collapsed the
      //      density and layout axes into one three-step preset. NO `migrate`
      //      ARM: the `merge` sanitiser reads the v46 shape and carries
      //      `density: "compact"` across as `preset: "compact"`, which is the
      //      only value with a same-named destination. Everything else falls to
      //      the default, including every `layout` a user had chosen — the axis
      //      is gone and there is nothing to carry it to.
      // v48: shiftDigestDismissedAt — Today's banner dismissal, as an instant
      //      rather than a flag so `isNewShift` expires it. 0 backfills as
      //      "never dismissed", true of every state persisted before this.
      // v49: pinnedMentees — the supervisor's private working set, ordered by
      //      pin time. [] backfills as "nothing pinned", true of every state
      //      persisted before this version existed.
      // v50: devClockKey — the pinned simulated clock (Today Phase J.1). A
      //      dev-harness axis, so it sanitises to null on merge exactly as
      //      `devLoadState` does: an unknown key must not pin a nonexistent
      //      moment.
      // v51: todayScenarioId — the Today dev axis (Phase J.2). Sanitises to
      //      null on merge like every other harness field.
      // v52: viewedCareReviews + submittedCareReviews — the §5.2 reading trace
      //      and the §5.1 submitted set. Both sanitise to [] on merge and are
      //      re-capped, exactly as `pinnedMentees` is: a persisted array from
      //      an older build may be any shape at all.
      // v53: scenarioRecents — bar-02's recent-scenario row. Sanitised to [],
      //      de-duplicated and re-capped on merge, like every other persisted
      //      array here: a list from an older build may be any shape at all,
      //      and a malformed entry would put a dead scenario id in the panel's
      //      shortcut row where it would silently no-op on click.
      // v54: closedCareReviews replaces submittedCareReviews — the whole record
      //      rather than `{ id, at }`, and now in `partialize`. The old entries
      //      are DROPPED on merge (Brandon, 2026-10-06): they carry no content,
      //      so a row for one would be a record with nothing in it. Their items
      //      return to Open in the sessions that had them.
      // v55: `tierEvents` and `escalationHistory` (Tiering & Escalation pack),
      //      both arrays, both in `partialize`. Backfilled to [] — a session
      //      from before tiering has written no tier events, which is true.
      version: 55,
      migrate: (persisted, version) => {
        const s = persisted as {
          draft?: Record<string, unknown>;
          rejectionNote?: string | null;
          changeRequests?: unknown;
          hubSteps?: unknown;
          hubWelcomeSeen?: unknown;
          publishedSnapshot?: unknown;
        };
        /* ═══ v44 — CARRY, DO NOT BACKFILL ═══
           The only migration in this chain that moves a VALUE. `tasksLastVisitAt`
           held exactly this instant under a name that stopped being true when the
           shift-start digest moved to Home, so an existing session inherits its
           place in the shift rather than meeting the digest again on upgrade.
           Guarded on absence, not on the version alone, so replaying the chain
           cannot overwrite a stamp Home has already written. */
        const v44 = persisted as { shiftLastSeenAt?: number; tasksLastVisitAt?: number };
        if (version < 44 && typeof v44.shiftLastSeenAt !== "number") {
          v44.shiftLastSeenAt =
            typeof v44.tasksLastVisitAt === "number" ? v44.tasksLastVisitAt : 0;
        }
        if (s?.draft) {
          const d = s.draft;
          if (version < 2) {
            if (Array.isArray(d.interests)) {
              d.interests = (d.interests as unknown[]).map((it) =>
                typeof it === "string" ? { name: it, photo: null } : it
              );
            }
            delete d.additionalImages;
          }
          if (version < 3 && !Array.isArray(d.vibe)) {
            d.vibe = []; // new field — backfill so reads don't break
          }
          if (version < 4 && typeof d.genderIdentity !== "string") {
            d.genderIdentity = ""; // new field — backfill so reads don't break
          }
          // v10: internal/account photo (settings Profile tab).
          if (version < 10 && !("accountPhoto" in d)) {
            d.accountPhoto = null;
          }
        }
        // v5: change-request list supersedes the single rejectionNote. Backfill an
        // empty list; carry any old note over as one item so a mid-revision reload
        // doesn't lose it.
        if (version < 5 && !Array.isArray(s.changeRequests)) {
          s.changeRequests = s.rejectionNote
            ? [
                {
                  id: "legacy",
                  step: "bio",
                  sectionLabel: "Your profile",
                  note: s.rejectionNote,
                  done: false,
                },
              ]
            : [];
        }
        // v6: map old change requests (step/done) onto the new shape. Snapshot the
        // baseline from the persisted draft so nothing reads as "edited" until the
        // mentor actually edits.
        if (version < 6 && Array.isArray(s.changeRequests)) {
          const fieldFor = (stepId: string) =>
            PROFILE_SECTIONS.find((sec) => sec.step === stepId)?.fieldKey ?? "bio";
          s.changeRequests = (s.changeRequests as Record<string, unknown>[]).map(
            (c) => {
              const stepId = (c.stepId as string) ?? (c.step as string) ?? "bio";
              const fieldKey = (c.fieldKey as string) ?? fieldFor(stepId);
              const baselineValue =
                "baselineValue" in c
                  ? c.baselineValue
                  : s.draft?.[fieldKey] ?? null;
              return {
                id: c.id,
                stepId,
                fieldKey,
                sectionLabel: c.sectionLabel,
                note: c.note,
                baselineValue,
                confirmedUnchanged:
                  (c.confirmedUnchanged as boolean) ?? Boolean(c.done),
              };
            }
          );
        }
        // v7: backfill hub-step state.
        if (version < 7) {
          if (typeof s.hubSteps !== "object" || s.hubSteps === null) {
            s.hubSteps = emptyHubSteps();
          }
        }
        // v8: first-visit hub welcome modal flag (replaces the old submit toast).
        if (version < 8) {
          if (typeof s.hubWelcomeSeen !== "boolean") {
            s.hubWelcomeSeen = false;
          }
        }
        // v9: post-publish change-detection baseline.
        if (version < 9) {
          if (!("publishedSnapshot" in s)) {
            s.publishedSnapshot = null;
          }
        }
        // v11: profilePhoto → matchCardPhoto (§4 Phase 3). Rename the field on
        // the live draft AND the published snapshot, and remap any persisted
        // change-request fieldKeys so nothing dangles. (Timing of snapshot
        // capture is untouched — this converts stored data in place.)
        if (version < 11) {
          const renamePhoto = (o: unknown) => {
            const rec = o as Record<string, unknown> | null | undefined;
            if (rec && "profilePhoto" in rec) {
              rec.matchCardPhoto = rec.profilePhoto;
              delete rec.profilePhoto;
            }
          };
          renamePhoto(s.draft);
          renamePhoto(s.publishedSnapshot);
          if (Array.isArray(s.changeRequests)) {
            for (const c of s.changeRequests as Record<string, unknown>[]) {
              if (c.fieldKey === "profilePhoto") c.fieldKey = "matchCardPhoto";
            }
          }
        }
        // v12: First messages + First moment story (§4 Phase 3). Backfill BOTH
        // the draft and the published snapshot — a snapshot missing the keys
        // would make every published mentor read as dirty on these sections.
        if (version < 12) {
          const backfill = (o: unknown) => {
            const rec = o as Record<string, unknown> | null | undefined;
            if (!rec) return;
            if (!("firstMessages" in rec)) {
              rec.firstMessages = { online: [], offline: [] };
            }
            if (!("storySlides" in rec)) {
              rec.storySlides = [];
            }
          };
          backfill(s.draft);
          backfill(s.publishedSnapshot);
        }
        // v13: storySlides → stories[] (LIBRARY-READY, §4 rev). The old flat
        // slide list becomes the single 'first-moment' story's slides.
        if (version < 13) {
          const toStories = (o: unknown) => {
            const rec = o as Record<string, unknown> | null | undefined;
            if (!rec || "stories" in rec) return;
            rec.stories = [
              {
                id: "first-moment",
                type: "first-moment",
                slides: Array.isArray(rec.storySlides) ? rec.storySlides : [],
              },
            ];
            delete rec.storySlides;
          };
          toStories(s.draft);
          toStories(s.publishedSnapshot);
          if (Array.isArray(s.changeRequests)) {
            for (const c of s.changeRequests as Record<string, unknown>[]) {
              if (c.fieldKey === "storySlides") c.fieldKey = "stories";
            }
          }
        }
        // v14: Profile Update Review — post-publish in_review/rejected are
        // retired (published mentors stay published; the changeset replaces
        // the lock/reject loop). Stale whole-profile requests are dropped.
        if (version < 14) {
          if (!("profileUpdate" in s)) (s as Record<string, unknown>).profileUpdate = null;
          if (!Array.isArray((s as Record<string, unknown>).activity)) (s as Record<string, unknown>).activity = [];
          const st = s as unknown as { status?: string; publishedSnapshot?: unknown; changeRequests?: unknown };
          if (st.publishedSnapshot && (st.status === "in_review" || st.status === "rejected")) {
            st.status = "published";
            st.changeRequests = [];
          }
        }
        // v15: nickname → displayName (§9 v1.1 name-model split). Rename on
        // draft + snapshot, remap changeset/activity/change-request field ids,
        // and seed an empty display name from firstName (the §9.1 onboarding
        // seed, applied retroactively).
        if (version < 15) {
          const renameName = (o: unknown) => {
            const rec = o as Record<string, unknown> | null | undefined;
            if (!rec) return;
            if ("nickname" in rec) {
              rec.displayName = rec.displayName ?? rec.nickname;
              delete rec.nickname;
            }
            if (!rec.displayName && typeof rec.firstName === "string") {
              rec.displayName = rec.firstName;
            }
          };
          renameName(s.draft);
          renameName(s.publishedSnapshot);
          if (Array.isArray(s.changeRequests)) {
            for (const c of s.changeRequests as Record<string, unknown>[]) {
              if (c.fieldKey === "nickname") c.fieldKey = "displayName";
            }
          }
          const st = s as unknown as {
            profileUpdate?: { fields?: { fieldId?: string }[] } | null;
            activity?: { fieldIds?: string[] }[];
          };
          for (const f of st.profileUpdate?.fields ?? []) {
            if (f.fieldId === "nickname") f.fieldId = "displayName";
          }
          for (const a of st.activity ?? []) {
            if (Array.isArray(a.fieldIds)) {
              a.fieldIds = a.fieldIds.map((id) =>
                id === "nickname" ? "displayName" : id
              );
            }
          }
        }
        // v16: Phase 10 personas + staff photo.
        if (version < 16) {
          const st = s as unknown as { persona?: unknown; staffPhoto?: unknown };
          if (typeof st.persona !== "string") st.persona = "mentor";
          if (!("staffPhoto" in st)) st.staffPhoto = null;
        }
        // v17: record-05 — internal staff notes + teen-visibility flag.
        if (version < 17) {
          const st = s as unknown as {
            internalNotes?: unknown;
            profileHidden?: unknown;
          };
          if (!Array.isArray(st.internalNotes)) st.internalNotes = [];
          if (typeof st.profileHidden !== "boolean") st.profileHidden = false;
        }
        // v18: "entered home" flag for the dev lens / approved-screen gate.
        // Backfill: an already-published mentor has, by definition, been
        // through approval — treat them as home so they don't see a spurious
        // "You're approved!" on the next Mentor switch.
        if (version < 18) {
          const st = s as unknown as {
            enteredHome?: unknown;
            publishedSnapshot?: unknown;
          };
          if (typeof st.enteredHome !== "boolean") {
            st.enteredHome = st.publishedSnapshot != null;
          }
        }
        // v19: notification preferences map (settings-03). Sparse — an empty
        // object means "all categories at their default".
        if (version < 19) {
          const st = s as unknown as { notificationPrefs?: unknown };
          if (typeof st.notificationPrefs !== "object" || st.notificationPrefs === null) {
            st.notificationPrefs = {};
          }
        }
        // v20: per-mentor caseload overrides (caseload prompt). Sparse — an
        // empty object means "automatic at each mentor's default capacity".
        if (version < 20) {
          const st = s as unknown as { caseloads?: unknown };
          if (typeof st.caseloads !== "object" || st.caseloads === null) {
            st.caseloads = {};
          }
        }
        if (version < 21) {
          const st = s as unknown as { mentorStatuses?: unknown };
          if (
            typeof st.mentorStatuses !== "object" ||
            st.mentorStatuses === null
          ) {
            st.mentorStatuses = {};
          }
        }
        if (version < 22) {
          const st = s as unknown as { mentorAccepting?: unknown };
          if (
            typeof st.mentorAccepting !== "object" ||
            st.mentorAccepting === null
          ) {
            st.mentorAccepting = {};
          }
        }
        if (version < 23) {
          const st = s as unknown as {
            mentorRole?: unknown;
            mentorGroups?: unknown;
          };
          if (typeof st.mentorRole !== "string") st.mentorRole = "Mentor";
          if (!Array.isArray(st.mentorGroups))
            st.mentorGroups = ["North Carolina", "New Jersey"];
        }
        if (version < 24) {
          const st = s as unknown as { schedule?: unknown };
          if (typeof st.schedule !== "object" || st.schedule === null) {
            st.schedule = cloneSchedule(DEFAULT_SCHEDULE);
          }
        }
        if (version < 25) {
          const st = s as unknown as { menteeActive?: unknown };
          if (typeof st.menteeActive !== "object" || st.menteeActive === null) {
            st.menteeActive = {};
          }
        }
        if (version < 26) {
          const st = s as unknown as {
            personProfiles?: unknown;
            personSchedules?: unknown;
          };
          if (
            typeof st.personProfiles !== "object" ||
            st.personProfiles === null
          ) {
            st.personProfiles = {};
          }
          if (
            typeof st.personSchedules !== "object" ||
            st.personSchedules === null
          ) {
            st.personSchedules = {};
          }
        }
        if (version < 27) {
          // Release first-moments fields from any open changeset, publishing
          // the mentor's proposed value rather than discarding their work.
          const st = s as unknown as {
            profileUpdate?: ProfileUpdate | null;
            draft?: Record<string, unknown>;
            publishedSnapshot?: Record<string, unknown> | null;
          };
          const u = st.profileUpdate;
          if (u && Array.isArray(u.fields)) {
            const releasing = u.fields.filter((f) =>
              isImmediateTeenFacingField(f.fieldId)
            );
            if (releasing.length > 0) {
              // The draft holds the proposed value — snapshotting it publishes.
              if (st.publishedSnapshot && st.draft) {
                for (const f of releasing) {
                  st.publishedSnapshot[f.fieldId] = st.draft[f.fieldId];
                }
              }
              const rest = u.fields.filter(
                (f) => !isImmediateTeenFacingField(f.fieldId)
              );
              st.profileUpdate = rest.length > 0 ? { ...u, fields: rest } : null;
            }
          }
        }
        if (version < 28) {
          const st = s as unknown as {
            menteeActive?: Record<string, boolean>;
            menteeStatus?: Record<string, MenteeStatus>;
          };
          if (typeof st.menteeStatus !== "object" || st.menteeStatus === null) {
            const out: Record<string, MenteeStatus> = {};
            for (const [id, wasActive] of Object.entries(st.menteeActive ?? {})) {
              out[id] = wasActive === false ? "deactivated" : "active";
            }
            st.menteeStatus = out;
          }
          delete st.menteeActive;
        }
        if (version < 32) {
          const st = s as unknown as {
            guardians?: Record<string, GuardianDetails>;
            accountLocks?: Record<string, AccountLock>;
          };
          if (typeof st.guardians !== "object" || st.guardians === null)
            st.guardians = {};
          if (typeof st.accountLocks !== "object" || st.accountLocks === null)
            st.accountLocks = {};
        }
        if (version < 31) {
          const st = s as unknown as { relationshipEvents?: RelationshipEvent[] };
          if (!Array.isArray(st.relationshipEvents)) st.relationshipEvents = [];
        }
        if (version < 30) {
          const st = s as unknown as {
            careUpdates?: Record<string, CareUpdateRecord>;
            careSummaryRefreshedAt?: Record<string, number>;
          };
          if (typeof st.careUpdates !== "object" || st.careUpdates === null) {
            st.careUpdates = {};
          }
          if (
            typeof st.careSummaryRefreshedAt !== "object" ||
            st.careSummaryRefreshedAt === null
          ) {
            st.careSummaryRefreshedAt = {};
          }
        }
        if (version < 29) {
          // careReviews is new and additive — backfill the empty map so every
          // fixture review reads as pending on an older persisted state.
          const st = s as unknown as {
            careReviews?: Record<string, CareReviewDecision>;
          };
          if (typeof st.careReviews !== "object" || st.careReviews === null) {
            st.careReviews = {};
          }
          // v37: a scalar — 0 means never opened (see the version log above).
          const st37 = persisted as { tasksLastVisitAt?: unknown };
          if (typeof st37.tasksLastVisitAt !== "number") {
            st37.tasksLastVisitAt = 0;
          }
        }
        if (version < 41) {
          // v41: closed union — anything unrecognised becomes the default.
          const st41 = persisted as { devLoadState?: unknown };
          if (!LOAD_STATES.includes(st41.devLoadState as LoadState)) {
            st41.devLoadState = DEFAULT_LOAD_STATE;
          }
        }
        if (version < 40) {
          // v40: a MAP OF ARRAYS — {} is the backfill, and see the version log
          // for why an empty log is the only honest one.
          const st40 = persisted as { careSummaryCommits?: unknown };
          if (
            typeof st40.careSummaryCommits !== "object" ||
            st40.careSummaryCommits === null
          ) {
            st40.careSummaryCommits = {};
          }
        }
        if (version < 38) {
          // v38: closed union — anything unrecognised becomes the default.
          const st38 = persisted as { activityDensity?: unknown };
          if (st38.activityDensity !== "detailed") {
            st38.activityDensity = "dense";
          }
          /* v45: Monitoring's scenario axis. NULLABLE, so "absent" and "null"
             mean the same thing and this only has to reject a wrong SHAPE — a
             stored string that is not a Monitoring key is left alone and falls
             through to the task-derived default at read time, which is the same
             forgiving behaviour a stale bookmark gets. */
          const st45 = persisted as { monitoringScenarioId?: unknown };
          if (
            st45.monitoringScenarioId !== null &&
            typeof st45.monitoringScenarioId !== "string"
          ) {
            st45.monitoringScenarioId = null;
          }
          // v42: a scalar preference — same shape as v36 below.
          const st42 = persisted as { tasksScenarioId?: unknown };
          if (typeof st42.tasksScenarioId !== "string") {
            st42.tasksScenarioId = DEFAULT_TASK_SCENARIO_ID;
          }
          /* v43: one scalar and four sparse maps. Explicit rather than left to
             the shallow persist merge, for the reason the version log records at
             v29 and again at v32: the merge does backfill a MISSING key, and it
             does nothing at all for a key that is present and the wrong shape —
             which is what a hand-edited localStorage payload and a
             half-completed earlier migration both produce. */
          const st43 = persisted as {
            chatScenarioId?: unknown;
            escalations?: unknown;
            chatEvents?: unknown;
            chatNotes?: unknown;
            chatArtifacts?: unknown;
          };
          if (typeof st43.chatScenarioId !== "string") {
            st43.chatScenarioId = DEFAULT_CHAT_SCENARIO_ID;
          }
          for (const k of ["escalations", "chatEvents", "chatNotes", "chatArtifacts"] as const) {
            if (!st43[k] || typeof st43[k] !== "object") st43[k] = {};
          }
          // v36: a scalar preference — backfill the default, not {}.
          const st36 = persisted as { activityScenarioId?: unknown };
          if (typeof st36.activityScenarioId !== "string") {
            st36.activityScenarioId = "typical-shift";
          }
          // v35: a MAP — {} is the right backfill (see the version log above).
          const st35 = persisted as { activityRead?: unknown };
          if (
            typeof st35.activityRead !== "object" ||
            st35.activityRead === null
          ) {
            st35.activityRead = {};
          }
          // v34's careRailOpen backfill USED TO SIT HERE and is deleted, not
          // kept for the record: there is no longer a field for it to fill, so
          // it would write a key nothing reads onto every migrated payload. A
          // key already present in a stored payload is dropped on the next
          // write, since `partialize` is a whitelist and no longer lists it.
          // v33: same backfill, same reasoning as careReviews above.
          const st33 = persisted as { careFlagClosures?: unknown };
          if (
            typeof st33.careFlagClosures !== "object" ||
            st33.careFlagClosures === null
          ) {
            st33.careFlagClosures = {};
          }
        }
        // v55: arrays — [] is the right backfill.
        const st55 = persisted as { tierEvents?: unknown; escalationHistory?: unknown };
        if (!Array.isArray(st55.tierEvents)) st55.tierEvents = [];
        if (!Array.isArray(st55.escalationHistory)) st55.escalationHistory = [];
        return s as unknown as OnboardingState;
      },
      // Self-healing merge — defense-in-depth for the shape transforms.
      // `migrate` only runs when the stored version MISmatches; twice in dev
      // we observed a store stamped with the current version WITHOUT its
      // transforms applied (rehydrate/write race), which would otherwise never
      // repair. This mirrors the v10–v12 shape changes idempotently on every
      // rehydrate. Data plumbing only — snapshot-capture timing is untouched.
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<OnboardingState>),
        } as OnboardingState;
        const repair = (o: unknown) => {
          const rec = o as Record<string, unknown> | null | undefined;
          if (!rec) return;
          if ("profilePhoto" in rec) {
            rec.matchCardPhoto = rec.matchCardPhoto ?? rec.profilePhoto;
            delete rec.profilePhoto;
          }
          if (!("accountPhoto" in rec)) rec.accountPhoto = null;
          if (!("firstMessages" in rec)) {
            rec.firstMessages = { online: [], offline: [] };
          }
          // storySlides (v12 shape) → stories[] (v13); backfill when absent.
          if (!("stories" in rec)) {
            rec.stories = [
              {
                id: "first-moment",
                type: "first-moment",
                slides: Array.isArray(rec.storySlides) ? rec.storySlides : [],
              },
            ];
          }
          delete rec.storySlides;
          // nickname (≤v14 shape) → displayName (v15). Shape repair only —
          // the firstName seed is one-time (migrate), not per-rehydrate, so a
          // deliberately cleared display name stays cleared.
          if ("nickname" in rec) {
            rec.displayName = rec.displayName ?? rec.nickname;
            delete rec.nickname;
          }
          if (typeof rec.displayName !== "string") rec.displayName = "";
        };
        repair(merged.draft);
        repair(merged.publishedSnapshot);
        if (Array.isArray(merged.changeRequests)) {
          for (const c of merged.changeRequests as unknown as Record<
            string,
            unknown
          >[]) {
            if (c.fieldKey === "profilePhoto") c.fieldKey = "matchCardPhoto";
            if (c.fieldKey === "storySlides") c.fieldKey = "stories";
            if (c.fieldKey === "nickname") c.fieldKey = "displayName";
          }
        }
        for (const f of merged.profileUpdate?.fields ?? []) {
          if (f.fieldId === "nickname") f.fieldId = "displayName";
        }
        // v16 shape (top-level persona + staffPhoto).
        if (typeof (merged as { persona?: unknown }).persona !== "string") {
          merged.persona = "mentor";
        }
        if (typeof merged.staffPhoto === "undefined") merged.staffPhoto = null;
        if (typeof (merged as { enteredHome?: unknown }).enteredHome !== "boolean") {
          merged.enteredHome = merged.publishedSnapshot != null;
        }
        // v19 shape: notificationPrefs is always a plain object.
        if (
          typeof (merged as { notificationPrefs?: unknown }).notificationPrefs !==
            "object" ||
          merged.notificationPrefs === null
        ) {
          merged.notificationPrefs = {};
        }
        // v20 shape: caseloads is always a plain object.
        if (
          typeof (merged as { caseloads?: unknown }).caseloads !== "object" ||
          merged.caseloads === null
        ) {
          merged.caseloads = {};
        }
        // v21 shape: mentorStatuses is always a plain object.
        if (
          typeof (merged as { mentorStatuses?: unknown }).mentorStatuses !==
            "object" ||
          merged.mentorStatuses === null
        ) {
          merged.mentorStatuses = {};
        }
        // v22 shape: mentorAccepting is always a plain object.
        if (
          typeof (merged as { mentorAccepting?: unknown }).mentorAccepting !==
            "object" ||
          merged.mentorAccepting === null
        ) {
          merged.mentorAccepting = {};
        }
        // v23 shape: mentorRole (string) + mentorGroups (array).
        if (typeof (merged as { mentorRole?: unknown }).mentorRole !== "string") {
          merged.mentorRole = "Mentor";
        }
        if (!Array.isArray((merged as { mentorGroups?: unknown }).mentorGroups)) {
          merged.mentorGroups = ["North Carolina", "New Jersey"];
        }
        // v24 shape: schedule is always a Schedule object.
        if (
          typeof (merged as { schedule?: unknown }).schedule !== "object" ||
          merged.schedule === null
        ) {
          merged.schedule = cloneSchedule(DEFAULT_SCHEDULE);
        }
        // v32 shape: both new maps are always plain objects.
        if (
          typeof (merged as { guardians?: unknown }).guardians !== "object" ||
          merged.guardians === null
        ) {
          merged.guardians = {};
        }
        if (
          typeof (merged as { accountLocks?: unknown }).accountLocks !== "object" ||
          merged.accountLocks === null
        ) {
          merged.accountLocks = {};
        }
        // v31 shape: relationshipEvents is always an ARRAY (not a map).
        if (!Array.isArray((merged as { relationshipEvents?: unknown }).relationshipEvents)) {
          merged.relationshipEvents = [];
        }
        // v30 shape: the care-update maps are always plain objects.
        if (
          typeof (merged as { careUpdates?: unknown }).careUpdates !== "object" ||
          merged.careUpdates === null
        ) {
          merged.careUpdates = {};
        }
        /** ═══ EVERY STORED CARE UPDATE HAS A BODY WITH EVERY SECTION ═══
         *
         *  A body missing a section key crashed the WHOLE person record:
         *  `careUpdateToEvent` read `u.body[s.id].trim()` and threw, through
         *  `alertsForTeen` → `RecordTaskRegions`, so the page rendered nothing on
         *  any tab. `care-demo.ts` now reads defensively, which stops the crash;
         *  this stops the bad shape SURVIVING, so the record is repaired once
         *  rather than tolerated on every read forever.
         *
         *  BOTH HALVES ARE WANTED. The read guard protects a body this repair has
         *  not seen yet — a record written by another tab mid-session, or a shape
         *  that arrives after some future section is added. The repair keeps the
         *  data honest. Neither alone is enough.
         *
         *  IT ONLY ADDS MISSING KEYS. An existing string is never touched, so a
         *  supervisor's clinical prose cannot be rewritten by a migration — which
         *  is the one thing a repair on clinical text must never do. */
        {
          // THROUGH `unknown` DELIBERATELY. `CareUpdateRecord.body` is typed as a
          // complete `CareUpdateBody`, and the whole point here is that the
          // PERSISTED value may not be one — so the cast has to admit it is
          // describing untrusted data rather than pretending the type holds.
          const updates = merged.careUpdates as unknown as Record<
            string,
            { body?: Record<string, unknown> }
          >;
          for (const u of Object.values(updates ?? {})) {
            if (!u || typeof u !== "object") continue;
            if (typeof u.body !== "object" || u.body === null) {
              u.body = {};
            }
            for (const s of CARE_UPDATE_SECTIONS) {
              if (typeof u.body[s.id] !== "string") u.body[s.id] = "";
            }
          }
        }
        if (
          typeof (merged as { careSummaryRefreshedAt?: unknown })
            .careSummaryRefreshedAt !== "object" ||
          merged.careSummaryRefreshedAt === null
        ) {
          merged.careSummaryRefreshedAt = {};
        }
        // v29 shape: careReviews is always a plain object.
        if (
          typeof (merged as { careReviews?: unknown }).careReviews !== "object" ||
          merged.careReviews === null
        ) {
          merged.careReviews = {};
        }
        // v28 shape: menteeStatus is always a plain object.
        if (
          typeof (merged as { menteeStatus?: unknown }).menteeStatus !== "object" ||
          merged.menteeStatus === null
        ) {
          merged.menteeStatus = {};
        }
        // v26 shape: the person-override maps are always plain objects.
        if (
          typeof (merged as { personProfiles?: unknown }).personProfiles !==
            "object" ||
          merged.personProfiles === null
        ) {
          merged.personProfiles = {};
        }
        if (
          typeof (merged as { careFlagClosures?: unknown }).careFlagClosures !==
            "object" ||
          merged.careFlagClosures === null
        ) {
          merged.careFlagClosures = {};
        }
        if (
          typeof (merged as { careSummaryCommits?: unknown })
            .careSummaryCommits !== "object" ||
          merged.careSummaryCommits === null
        ) {
          merged.careSummaryCommits = {};
        }
        if (
          typeof (merged as { activityRead?: unknown }).activityRead !==
            "object" ||
          merged.activityRead === null
        ) {
          merged.activityRead = {};
        }
        if (
          typeof (merged as { activityScenarioId?: unknown })
            .activityScenarioId !== "string"
        ) {
          merged.activityScenarioId = "typical-shift";
        }
        if (
          typeof (merged as { tasksLastVisitAt?: unknown }).tasksLastVisitAt !==
          "number"
        ) {
          merged.tasksLastVisitAt = 0;
        }
        if (
          typeof (merged as { tasksScenarioId?: unknown }).tasksScenarioId !==
          "string"
        ) {
          merged.tasksScenarioId = DEFAULT_TASK_SCENARIO_ID;
        }
        if (
          merged.activityDensity !== "dense" &&
          merged.activityDensity !== "detailed"
        ) {
          merged.activityDensity = "dense";
        }
        /* ═══ viewOptions IS SANITISED PER ENTRY, NOT JUST PER TYPE (v46) ═══
           The same posture as `activityDensity` above and for the same stated
           reason: reading a two-word union back off disk is safer than
           trusting a persisted string to still be one of two words. A map adds
           one failure this scalar does not have — a VALID map holding an
           invalid entry — so each entry is checked and a bad one is dropped
           rather than the whole map discarded. Dropping the entry falls back to
           the default, which is what an untouched control already does. */
        /* ═══ pinnedMentees IS SANITISED AND RE-CAPPED ON MERGE (v49) ═══
           Same posture as `viewOptions` below. The extra thing checked here is
           the CAP: a persisted state from a build with a larger cap — or a
           hand-edited one — would otherwise put more than five in a section
           that promises five, and Today does not paginate. Truncating keeps
           the OLDEST pins, because they are the ones the supervisor has lived
           with longest. */
        /* ═══ THE CARE-REVIEW TRACES, SANITISED THE SAME WAY (v52) ═══
           Same posture as `pinnedMentees` below and for the same reason: a
           persisted array from an older build may be any shape at all, and a
           malformed entry here would mark the wrong row viewed or put a
           phantom into the Submitted tab.
           TRUNCATION KEEPS THE NEWEST, which is the opposite of pins: a pin is
           a working set whose oldest members are the ones lived with longest,
           and a trace's newest entries are the ones still worth marking. */
        const vcr = (merged as { viewedCareReviews?: unknown }).viewedCareReviews;
        merged.viewedCareReviews = Array.isArray(vcr)
          ? [...new Set(vcr.filter((x): x is string => typeof x === "string" && !!x))].slice(
              -CARE_TRACE_CAP
            )
          : [];

        /* ═══ scenarioRecents, SANITISED AND RE-CAPPED (v53) ═══
           Same posture as the trace above. The extra care here is that these are
           SCENARIO IDS, so a malformed or retired entry does not just look odd —
           it renders a clickable shortcut that no-ops, which is worse than not
           offering it. Non-strings go, duplicates collapse, and the cap holds.
           TRUNCATION KEEPS THE NEWEST, from the FRONT: this list is newest-first
           (unlike the traces, which append), so the slice is `0, CAP` rather
           than `-CAP`. Getting that backwards would keep the five OLDEST and
           call them recent.
           WHETHER AN ID STILL RESOLVES IS NOT CHECKED HERE. The store cannot
           import the five scenario registries without a cycle, so the panel
           filters unresolvable entries at render — which is also where it can
           say so rather than silently dropping them. */
        const rec = (merged as { scenarioRecents?: unknown }).scenarioRecents;
        merged.scenarioRecents = Array.isArray(rec)
          ? [
              ...new Set(rec.filter((x): x is string => typeof x === "string" && !!x)),
            ].slice(0, SCENARIO_RECENTS_CAP)
          : [];

        /* v54 · THE OLD `{ id, at }` TRACE IS DROPPED, NOT CONVERTED — there is
           no content to convert, and inventing an empty record would put a
           clinical row on screen with nothing in it. */
        delete (merged as { submittedCareReviews?: unknown }).submittedCareReviews;
        const ccr = (merged as { closedCareReviews?: unknown }).closedCareReviews;
        if (!Array.isArray(ccr)) {
          merged.closedCareReviews = [];
        } else {
          /* A PERSISTED RECORD IS UNTRUSTED INPUT, even though we wrote it: an
             older build, a hand-edited store or a partial write may leave any
             shape. The checks are the fields the Closed tab cannot render
             without; anything failing them is dropped rather than half-drawn. */
          const seenClosed = new Set<string>();
          merged.closedCareReviews = ccr
            .filter((e): e is ClosedCareReview => {
            const o = e as Partial<ClosedCareReview> | null;
            if (!o || typeof o !== "object") return false;
            if (typeof o.id !== "string" || !o.id || seenClosed.has(o.id)) return false;
            if (typeof o.submittedAt !== "number" || !Number.isFinite(o.submittedAt)) return false;
            if (!o.body || typeof o.body !== "object") return false;
            if (!o.decision || typeof o.decision.code !== "string") return false;
            if (!o.snapshot?.item || o.snapshot.item.payload?.kind !== "billing") return false;
            if (!o.snapshot.review) return false;
            seenClosed.add(o.id);
            return true;
          })
            /* OLDER RECORDS, BROUGHT TO THE CURRENT SHAPE: `kept` / `renewed`
               read as `reviewed`, and `assignedTo` is filled from the record's
               own snapshot — see `normaliseClosedRecord`. */
            .map(normaliseClosedRecord);
        }

        const pm = (merged as { pinnedMentees?: unknown }).pinnedMentees;
        if (!Array.isArray(pm)) {
          merged.pinnedMentees = [];
        } else {
          const seen = new Set<string>();
          merged.pinnedMentees = pm
            .filter((e): e is PinnedMentee => {
              const o = e as Partial<PinnedMentee> | null;
              if (!o || typeof o !== "object") return false;
              if (typeof o.id !== "string" || !o.id) return false;
              if (typeof o.at !== "number" || !Number.isFinite(o.at)) return false;
              if (seen.has(o.id)) return false;
              seen.add(o.id);
              return true;
            })
            .slice(0, PIN_CAP);
        }

        const vo = (merged as { viewOptions?: unknown }).viewOptions;
        if (typeof vo !== "object" || vo === null || Array.isArray(vo)) {
          merged.viewOptions = {};
        } else {
          const clean: Record<string, ViewOptions> = {};
          for (const [k, v] of Object.entries(vo as Record<string, unknown>)) {
            const o = v as { preset?: unknown; density?: unknown } | null;
            if (!o || typeof o !== "object") continue;
            /* ═══ THE v46 SHAPE IS READ, NOT DISCARDED (v47) ═══
               v46 stored `{density, layout}`. §4 collapsed the two axes into
               one three-step preset, and the honest mapping is that both of
               v46's density values SURVIVE as presets of the same name — so a
               supervisor who chose Compact yesterday still has Compact, and
               only the layout half is dropped because the axis is gone.
               Done here rather than in `migrate` because this map is sparse
               and per-entry: `migrate` would have to walk it anyway, and one
               reader is better than two that can disagree. */
            const legacy = o.density === "compact" ? "compact" : null;
            const preset = VIEW_PRESETS.includes(o.preset as ViewPreset)
              ? (o.preset as ViewPreset)
              : (legacy ?? VIEW_OPTIONS_DEFAULT.preset);
            clean[k] = { preset };
          }
          merged.viewOptions = clean;
        }
        if (
          typeof (merged as { personSchedules?: unknown }).personSchedules !==
            "object" ||
          merged.personSchedules === null
        ) {
          merged.personSchedules = {};
        }
        // v27 invariant: NO ungated field may sit in the changeset. Such an
        // entry is unreachable — no surface can approve it — so it would pin a
        // "Profile updates" queue item forever. Idempotent, so it also repairs a
        // store stamped v27 whose migrate didn't run (the rehydrate/write race
        // this merge exists for).
        if (merged.profileUpdate) {
          const keep = merged.profileUpdate.fields.filter(
            (f) => !isImmediateTeenFacingField(f.fieldId)
          );
          if (keep.length !== merged.profileUpdate.fields.length) {
            merged.profileUpdate =
              keep.length > 0
                ? { ...merged.profileUpdate, fields: keep }
                : null;
          }
        }
        return merged;
      },
      // Quota-resilient: if a write exceeds the localStorage limit (or storage
      // is unavailable, e.g. SSR / private mode), keep working in-memory
      // instead of throwing.
      storage: createJSONStorage(() => ({
        getItem: (name) =>
          typeof localStorage === "undefined"
            ? null
            : localStorage.getItem(name),
        setItem: (name, value) => {
          if (typeof localStorage === "undefined") return;
          try {
            localStorage.setItem(name, value);
          } catch {
            // Out of quota / private mode — the draft stays in memory.
          }
        },
        removeItem: (name) => {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(name);
          }
        },
      })),
      // Never persist the password, or the recorded clip's blob URL (dead after
      // reload, and large) — both stay in-memory only. The snapshot is already
      // stored in that safe shape (see snapshotDraft).
      partialize: (state) => ({
        draft: {
          ...state.draft,
          password: "",
          media: { ...state.draft.media, url: null },
        },
        status: state.status,
        completed: state.completed,
        rejectionNote: state.rejectionNote,
        changeRequests: state.changeRequests,
        publishedSnapshot: state.publishedSnapshot,
        hubSteps: state.hubSteps,
        hubWelcomeSeen: state.hubWelcomeSeen,
        slots: state.slots,
        accountStatus: state.accountStatus,
        deactivatedOn: state.deactivatedOn,
        profileUpdate: state.profileUpdate,
        activity: state.activity,
        persona: state.persona,
        // Beside `persona` on purpose: both are dev lenses that outlive a
        // `reset()`, and both have to survive a NAVIGATION to mean anything.
        // `partialize` is an explicit whitelist — a new field that is not listed
        // here reads back as `undefined` on the next page load, which is exactly
        // how the first version of the hide button appeared to work and then
        // forgot itself the moment you left the page.
        devBarHidden: state.devBarHidden,
        staffPhoto: state.staffPhoto,
        internalNotes: state.internalNotes,
        profileHidden: state.profileHidden,
        enteredHome: state.enteredHome,
        notificationPrefs: state.notificationPrefs,
        caseloads: state.caseloads,
        mentorStatuses: state.mentorStatuses,
        mentorAccepting: state.mentorAccepting,
        menteeStatus: state.menteeStatus,
        careReviews: state.careReviews,
        careFlagClosures: state.careFlagClosures,
        aiUsageFeedback: state.aiUsageFeedback,
        careSummaryCommits: state.careSummaryCommits,
        activityRead: state.activityRead,
        activityScenarioId: state.activityScenarioId,
        tasksScenarioId: state.tasksScenarioId,
        monitoringScenarioId: state.monitoringScenarioId,
        chatScenarioId: state.chatScenarioId,
        escalations: state.escalations,
        chatEvents: state.chatEvents,
        chatMessages: state.chatMessages,
        chatNotes: state.chatNotes,
        chatArtifacts: state.chatArtifacts,
        tierEvents: state.tierEvents,
        escalationHistory: state.escalationHistory,
        devLoadState: state.devLoadState,
        /* bar-02. See the field's note on why this one must persist. */
        scenarioRecents: state.scenarioRecents,
        /* v54. The closed records — the one care trace that MUST survive a
           reload, because it is the clinical record. */
        closedCareReviews: state.closedCareReviews,
        tasksLastVisitAt: state.tasksLastVisitAt,
        activityDensity: state.activityDensity,
        viewOptions: state.viewOptions,
        shiftDigestDismissedAt: state.shiftDigestDismissedAt,
        pinnedMentees: state.pinnedMentees,
        careUpdates: state.careUpdates,
        careSummaryRefreshedAt: state.careSummaryRefreshedAt,
        relationshipEvents: state.relationshipEvents,
        guardians: state.guardians,
        accountLocks: state.accountLocks,
        personProfiles: state.personProfiles,
        personSchedules: state.personSchedules,
        mentorRole: state.mentorRole,
        mentorGroups: state.mentorGroups,
        schedule: state.schedule,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
    }
  )
);
