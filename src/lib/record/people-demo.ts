// TODO-DATA — demo fixtures for the people ROSTER (Teens / Mentors views).
//
// This prototype has NO people/relationship data layer: the store holds one
// mentor draft, and mentees-demo.ts covers only ONE record's Overview. These
// illustrative fixtures stand in so the roster's filters, tenure buckets, the
// Mentor column, and the lead-mentor umbrella are visible; every value here is
// fake and must be replaced by the real user/relationship data when it lands.
//
// Vocabulary law (amended by the caseload prompt): "mentees"/"teens" for the
// PEOPLE — "caseload" is sanctioned for the CAPACITY concept only ("a caseload
// of 4 of 5 mentees"), never as a word for the people themselves. No
// churn/at-risk language anywhere; events describe that an exchange happened,
// never its content; numbers describe how mentoring is going, never grade the
// person.

import type { MentorLifecycleStatus, Story } from "@/lib/types";
import { RISK_CATEGORIES, type RiskTier } from "@/lib/record/risk-taxonomy";
import {
  WEEKDAYS,
  type DaySchedule,
  type Schedule,
  type Weekday,
} from "@/lib/schedule";

/** Who a person IS on the platform. Drives which practice tab their record
 *  has (see lib/record/tabs.ts) and which relationships they carry.
 *
 *  THE HIERARCHY (product): mentors supervise mentees (teens); lead mentors
 *  supervise mentors; supervisors supervise lead mentors primarily and mentors
 *  as a branch of that. Leads and supervisors may step into a mentor's teen to
 *  guide an escalation, but teens are NEVER directly supervised by them —
 *  which is why a lead/supervisor record shows Supervision, not Mentorship. */
export type PersonRole =
  | "mentor"
  | "lead-mentor"
  | "supervisor"
  | "admin"
  | "teen";

export interface DemoMentorRow {
  id: string;
  name: string;
  /** Teen-facing display name when it differs from the legal name (§9.3). */
  goesBy?: string;
  phone: string;
  /** Contact email, when on file — the Contact menu skips Email/Copy-email if
   *  absent (m5 has none, to exercise that path). */
  email?: string;
  group: string;
  /** Lifecycle standing (replaces the old binary `active` + `profile:
   *  "Incomplete"` — an incomplete profile now surfaces as "in-training"). */
  status: MentorLifecycleStatus;
  /** Availability INTENT — is the mentor open to new mentees? Only meaningful
   *  for guided/active; "full" is derived from the caseload regardless (see
   *  availabilityFor). Defaults to true when omitted. */
  accepting?: boolean;
  /** Default caseload capacity (total mentee slots). The lead can override it
   *  per mentor via the store's `caseloads` map; current load derives from
   *  teensForMentor(id).length. */
  capacity: number;
  /** Staff role. Defaults to "mentor" when omitted — most rows are mentors. */
  role?: PersonRole;
  /** The lead mentor who supervises this mentor (supersedes the old global
   *  LEAD_UMBRELLA_MENTOR_IDS constant — a real per-person edge). */
  leadId?: string;
  /** The supervisor above them. Leads report to a supervisor directly;
   *  mentors reach one through their lead. */
  supervisorId?: string;
  /** Pronouns, for the record header. */
  pronouns?: string;
  /** Days since this person was ASSIGNED to their lead/supervisor — the
   *  RELATIONSHIP start date, distinct from any platform join date.
   *
   *  TODO-DATA: new in the relationship pass. Staff carried no assignment date
   *  at all before it, so the Supervision table's date column had nothing true
   *  to show; absent still means absent, and the column says so rather than
   *  borrowing a date that means something else. */
  assignedDaysAgo?: number;
}

/** A past match — the teen's mentor history. TODO-DATA: invented for the demo;
 *  the real relationship table will carry these with true timestamps. */
export interface PastMatch {
  mentorId: string;
  /** Human-readable range, e.g. "Mar 2025 – Aug 2025". */
  range: string;
}

export interface DemoTeen {
  id: string;
  /** THE LEGAL NAME, AND NOW THE THING RENDERED. Standing rule 6 — "teens are
   *  FIRST NAME ONLY, everywhere, always" — was RETIRED by product-owner
   *  decision on 2026-08-28, so every list, header, avatar, toast, dialog and
   *  composed sentence shows this field, reached through `teenDisplayName(teen)`
   *  (lib/record/teen-name.ts).
   *
   *  STILL READ THROUGH THE CHOKEPOINT, not directly. The rule is gone; the
   *  single decision point is not, and it is what made retiring the rule a
   *  one-function change across 47 call sites. See design-system-gaps.md row 254
   *  (the enforcement, and its one carve-out — the Account "Full name" row,
   *  which is now simply consistent with everywhere else) and row 284 (the
   *  reversal).
   *
   *  It has always also been the search key: staff type "Ortiz" and find Caleb. */
  name: string;
  /** THE AUTHORITATIVE FIRST NAME. No longer the display name (rule 6 retired,
   *  2026-08-28) but still the right field for anywhere a first name alone is
   *  wanted — a greeting, a composed sentence.
   *
   *  Stored rather than derived because deriving it means splitting `name` on
   *  whitespace, and that guesses wrong on any compound first name ("Mary Anne").
   *  `firstNameOf` is that split, and it is why this field exists. */
  firstName: string;
  /** Teen-facing nickname when it differs from `firstName` — "Pat" for Patricia.
   *
   *  IT NO LONGER RENDERS IN A LIST OR HEADER. `teenDisplayName` returns the full
   *  legal name, so the three teens carrying a nickname show it only on the
   *  record's "Goes by" row. Flagged in gap row 284 as the one deliberate loss in
   *  the rule-6 reversal — if preferred names should win again, `teen-name.ts`
   *  has the one line to change. */
  goesBy?: string;
  phone: string;
  /** Teens are reached by phone in this demo — no email on file, so the
   *  Contact menu shows Chat / Call / Copy number only. Left absent on purpose
   *  rather than invented: minors reaching a mentor by phone is the real shape
   *  here, and adding addresses would change the Contact menu everywhere. */
  email?: string;
  /** For the record header. */
  pronouns?: string;
  group: string;
  active: boolean;
  /** Days since the teen joined the platform — drives the tenure buckets. */
  joinedDaysAgo: number;
  /** Platform standing, when it is something other than what `active` can say.
   *
   *  `active: boolean` could only ever express two of the three states, so no
   *  fixture teen could START paused — every paused teen had to be produced by
   *  a staff action in-session. This field closes that gap; `defaultMenteeStatus`
   *  prefers it and falls back to the boolean. */
  menteeState?: "active" | "paused" | "deactivated";
  /** The mentor this teen is matched with. */
  mentorId: string;

  // ── Relationship detail (merged in from mentees-demo) ──────────────────
  // These used to live on a SECOND, disjoint fixture (DemoMentee: m-jordan,
  // m-sam, …) that had no ids in common with these teens, so the roster had to
  // branch on `id === "live"` to bridge them. One person universe now: the same
  // teen powers their roster row, the mentor's mentee table, AND their own
  // record. Days-ago numbers (not absolute stamps) so fixtures stay stable.
  /** Days since the match began → relationship length. */
  matchedDaysAgo?: number;
  /** Days since the MENTOR last sent a message. */
  mentorLastSentDaysAgo?: number;
  /** Days since the TEEN last sent one. Who sent last decides the row's
   *  copy and whether it flags — see menteeRecency. */
  menteeLastSentDaysAgo?: number;
  /** Genuine escalation record only (critical family). The waiting-on-mentor
   *  state is DERIVED from the two stamps above, never stored.
   *
   *  LEGACY SHAPE, still the source for the mentee table's row chip and the
   *  45-day staleness rule (`escalationVisible`). The Care page reads `careFlags`
   *  instead, and synthesises an entry from this field for a teen that has one
   *  and no `careFlags` — so Care has one code path and no escalation renders
   *  twice. */
  escalation?: { reason: string; daysAgo: number };
  /** CARE FLAGS — escalations and risk flags as first-class records.
   *
   *  Added because neither existed as a record: the whole schema was
   *  `{reason, daysAgo}` with no severity, no open/resolved state, no raiser and
   *  no resolver, and `risk_flag` was a member of the timeline's type union that
   *  had never once been instantiated. The Care task region orders by severity
   *  and History reports a resolution state; neither was derivable.
   *  TODO-DATA: every value invented. */
  careFlags?: CareFlagRecord[];
  /** Video calls in the last 30 days — a care signal, not an absence metric. */
  videoCount30d?: number;
  /** ACTIVITIES THE TEEN FINISHED. An Attention-signal source: worth noticing,
   *  never something anyone has to act on.
   *
   *  Stored rather than derived because no activity layer exists — zero hits
   *  across the repo for a completed activity of any kind. TODO-DATA: the real
   *  source is the activity service; the shape here is a fixture.
   *
   *  The OTHER Attention signal, "say hi to a new teen", is NOT stored: it is
   *  derived from the no-contact recency state (see mentees-demo), because that
   *  state is real data the messaging stamps already describe. */
  completedActivities?: { id: string; name: string; daysAgo: number }[];
  /** Mentors this teen was matched with before their current one. */
  pastMentors?: PastMatch[];
}

// Lifecycle assigned per the strict migration mapping (incomplete → in-training,
// active → active, inactive → paused). Guided + Deactivated are not force-fit
// onto demo rows — see the /dev states matrix (and the live mentor can be
// deactivated). `accepting` is the availability intent (default true).
//
// SUPERVISION EDGES: m1–m3 report to lead `s-brandy`, m4–m6 to lead `s-omar`;
// both leads report to supervisor `s-stephen`. The store-backed mentor ("live")
// also reports to `s-brandy` — matching the Team card the record already shows.
export const DEMO_MENTORS: DemoMentorRow[] = [
  { id: "m1", name: "John Smith", phone: "+19089101133", email: "john.smith@example.com", group: "Illinois, North Carolina", status: "in-training", capacity: 5, leadId: "s-brandy", assignedDaysAgo: 34, pronouns: "he/him" },
  { id: "m2", name: "Maria Lopez", phone: "+17079923410", email: "maria.lopez@example.com", group: "New Jersey", status: "active", accepting: true, capacity: 4, leadId: "s-brandy", assignedDaysAgo: 210, pronouns: "she/her" },
  { id: "m3", name: "Devon Clark", goesBy: "Dev", phone: "+13125550172", email: "devon.clark@example.com", group: "Illinois", status: "active", accepting: true, capacity: 3, leadId: "s-brandy", assignedDaysAgo: 96, pronouns: "they/them" },
  { id: "m4", name: "Aisha Bello", phone: "+17078894521", email: "aisha.bello@example.com", group: "North Carolina", status: "active", accepting: false, capacity: 4, leadId: "s-omar", assignedDaysAgo: 61, pronouns: "she/her" },
  // m5 intentionally has no email — the Contact menu skips Email/Copy-email.
  { id: "m5", name: "Tomás Rivera", phone: "+19735550143", group: "New Jersey", status: "paused", capacity: 2, leadId: "s-omar", assignedDaysAgo: 402, pronouns: "he/him" },
  { id: "m6", name: "Priya Nair", phone: "+13125550188", email: "priya.nair@example.com", group: "Illinois", status: "in-training", capacity: 3, leadId: "s-omar", assignedDaysAgo: 12, pronouns: "she/her" },
];

/** Staff above the mentors. These existed only as display STRINGS in
 *  mentees-demo's `team` fixture ("Stephen Rowe · Supervisor") — they are real
 *  people now, so their records open and their Supervision tab has content. */
export const DEMO_STAFF: DemoMentorRow[] = [
  {
    id: "s-brandy",
    name: "Brandy Forrestor",
    phone: "+19089105501",
    email: "brandy.forrestor@example.com",
    group: "North Carolina, New Jersey",
    status: "active",
    capacity: 0, // leads carry no mentees of their own
    role: "lead-mentor",
    supervisorId: "s-stephen",
    pronouns: "she/her",
    assignedDaysAgo: 520,
  },
  {
    id: "s-omar",
    name: "Omar Haddad",
    phone: "+13125550990",
    email: "omar.haddad@example.com",
    group: "Illinois",
    status: "active",
    capacity: 0,
    role: "lead-mentor",
    supervisorId: "s-stephen",
    pronouns: "he/him",
    assignedDaysAgo: 180,
  },
  {
    id: "s-stephen",
    name: "Stephen Rowe",
    phone: "+19735550100",
    email: "stephen.rowe@example.com",
    group: "All regions",
    status: "active",
    capacity: 0,
    role: "supervisor",
    pronouns: "he/him",
  },
];

/** Every non-teen person, mentors + staff. */
export const DEMO_PEOPLE: DemoMentorRow[] = [...DEMO_MENTORS, ...DEMO_STAFF];

// ── Teen-facing profile content ─────────────────────────────────────────────
// TODO-DATA. Field names MIRROR MentorDraft so a fixture mentor's record reads
// identically to the store-backed one.
//
// TEXT ONLY, with ONE EXCEPTION. The match-card photo, chat avatar, audio intro
// and vibe board are ASSET-backed on MentorDraft (data URLs the live mentor
// actually uploaded). There are no real assets for demo people, and inventing
// binary content would make the record lie about what's on file — so those slots
// render as honest "Not on file" rows and stay read-only.
//
// THE EXCEPTION IS THE STORY (user request: populate it for every active
// mentor). It earns one because the story is the only asset field a MENTOR
// doesn't own — a lead or supervisor curates it, so a staff reader needs
// something to look at to judge the editor at all, and an empty state on every
// record leaves that surface untestable.
//
// The panels under /public/stories are ILLUSTRATED, not photographic: soft
// vertical gradient washes with the moment's name set on the image. That keeps
// faith with the paragraph above — a generated photoreal face on a mentor's
// profile would be exactly the lie we refuse elsewhere, while an obvious
// illustration reads as prototype content at a glance. TODO-DATA.
//
// PROFILE COMPLETENESS TRACKS STATUS. This codebase derives "in-training" FROM
// an incomplete profile (see the DemoMentorRow.status note), so the two
// in-training mentors — m1 and m6 — carry deliberately PARTIAL profiles. A
// fully-filled in-training profile would contradict the status badge on the
// same screen. The four active/paused mentors are complete.
export interface PersonProfile {
  /** Teen-facing display name (MentorDraft.displayName). */
  displayName?: string;
  /** Editable here as well as read from DemoMentorRow — a staff edit to
   *  pronouns has to land somewhere, and the record header reads the resolved
   *  value (override ?? fixture row). */
  pronouns?: string;
  languages?: string[];
  bio?: string;
  /** "Title · Artist". The live mentor stores a Spotify URL; a label is what
   *  the record actually renders, and a fake URL would invite a dead click. */
  spotifyTrack?: string;
  /** Interest NAMES only — MentorDraft.InterestEntry pairs each with a photo,
   *  which is one of the asset fields above. */
  interests?: string[];
  /** Canned openers, split the way MentorDraft.firstMessages is. */
  firstMessages?: { online?: string[]; offline?: string[] };
  /** The first-moment story — three vertical images a teen swipes on opening
   *  the chat. Shaped as MentorDraft.stories (a collection) so the record reads
   *  a fixture person and the live mentor through the same firstMomentStory()
   *  helper. STAFF-CURATED: writes come from a lead or supervisor on the
   *  record, never from the mentor. */
  stories?: Story[];
}

/** One fixture story from three panel paths — spelling out the Story wrapper
 *  four times taught nothing. Slide ids are stable so a staff reorder diffs
 *  against the same entities instead of looking fully rewritten. */
function story(mentorId: string): Story[] {
  return [
    {
      id: `${mentorId}-first-moment`,
      type: "first-moment",
      slides: [1, 2, 3].map((n) => ({
        id: `${mentorId}-slide-${n}`,
        photo: `/stories/${mentorId}-${n}.svg`,
      })),
    },
  ];
}

export const MENTOR_PROFILES: Record<string, PersonProfile> = {
  // m1 — IN TRAINING: has written a bio and picked languages, hasn't finished
  // the match-card extras yet. Intentionally incomplete (see note above).
  m1: {
    displayName: "John",
    languages: ["English"],
    bio: "I coach middle-school basketball on weekends and I'm usually the person friends call when they need help fixing something. Still finding my footing here, but I'm a good listener and I don't rattle easily.",
  },
  m2: {
    displayName: "Maria",
    languages: ["English", "Spanish"],
    bio: "I grew up in Newark and I work in a hospital lab, which means I'm calm about blood and terrible at horror movies. I'm happiest cooking for too many people at once. If you want someone who'll actually remember what you told them last week, that's me.",
    spotifyTrack: "Pa'lla Voy · Marc Anthony",
    interests: ["Cooking", "Running", "Photography"],
    firstMessages: {
      online: [
        "Hey! I'm Maria — really glad you're here. No pressure to say anything big, I'm around.",
        "Tell me one thing that went okay this week. Small counts.",
      ],
      offline: [
        "Just got your message — I'm away from my phone but I'll write back tonight.",
      ],
    },
    stories: story("m2"),
  },
  m3: {
    displayName: "Dev",
    languages: ["English", "ASL"],
    bio: "I fix bikes, I draw a lot, and I have strong opinions about breakfast. I came to mentoring because someone did it for me at fifteen and it changed the shape of things. I'm easy to talk to and hard to shock.",
    spotifyTrack: "Motion Sickness · Phoebe Bridgers",
    interests: ["Cycling", "Drawing", "Music", "Board games"],
    firstMessages: {
      online: [
        "Hi, I'm Dev. Whenever you feel like talking, I'm here — and if you'd rather just send a meme first, that works too.",
      ],
      offline: [
        "I'm offline right now but your message is safe with me. Back tomorrow morning.",
      ],
    },
    stories: story("m3"),
  },
  m4: {
    displayName: "Aisha",
    languages: ["English", "Yoruba"],
    bio: "I teach ninth-grade biology, so I've heard every excuse ever invented and I'm still on your side. Outside school I garden badly and read a lot. I believe most things get lighter once you say them out loud to someone.",
    spotifyTrack: "Essence · Wizkid",
    interests: ["Gardening", "Reading", "Hiking"],
    firstMessages: {
      online: [
        "Hey, I'm Aisha. You don't owe me a big introduction — start wherever you want.",
        "What's something you're actually looking forward to?",
      ],
      offline: [
        "I'm with my class right now. I'll get back to you this afternoon.",
      ],
    },
    stories: story("m4"),
  },
  m5: {
    displayName: "Tomás",
    languages: ["Spanish", "English"],
    bio: "I'm a carpenter and a very slow guitarist. I have two kids and a dog who thinks he's a third kid. I'm not going to give you advice you didn't ask for — mostly I'm just steady, and I show up when I say I will.",
    spotifyTrack: "Vivir Mi Vida · Marc Anthony",
    interests: ["Woodworking", "Guitar", "Fishing"],
    firstMessages: {
      online: [
        "Hola — I'm Tomás. Happy to talk in English or Spanish, whichever feels easier.",
      ],
      offline: ["On a job site today. I'll write back this evening."],
    },
    // PAUSED still gets a story. Paused is a break in an active mentorship, not
    // an unfinished onboarding — Tomás was matched for 402 days. An empty story
    // here would read as a gap in his file rather than as a pause.
    stories: story("m5"),
  },
  // m6 — IN TRAINING: interests picked, bio not written yet.
  m6: {
    displayName: "Priya",
    languages: ["English", "Hindi", "Malayalam"],
    interests: ["Baking", "Film", "Swimming"],
  },
};

/** A mentor's teen-facing profile, or an empty object when we hold nothing.
 *  Never returns undefined — callers render per-field empty states. */
export function profileFor(id: string): PersonProfile {
  return MENTOR_PROFILES[id] ?? {};
}

/** Which profile fields we hold for this mentor — drives the record's
 *  completeness line, and explains the "in-training" badge on the same page. */
export function profileCompleteness(id: string): {
  filled: number;
  total: number;
} {
  const p = profileFor(id);
  // `stories` is NOT a slot. Completeness measures the MENTOR'S own onboarding
  // progress — it's what explains the "in training" badge — and the story is
  // curated by their lead. Counting staff work against a mentor's profile
  // would let a lead's afternoon push someone's bar to full.
  const slots = [
    p.displayName,
    p.languages?.length,
    p.bio,
    p.spotifyTrack,
    p.interests?.length,
    p.firstMessages?.online?.length,
  ];
  return { filled: slots.filter(Boolean).length, total: slots.length };
}

// ── Active Hours ────────────────────────────────────────────────────────────
// TODO-DATA. The store holds ONE schedule (the live mentor's), so fixture
// mentors carry their own here. Shapes match lib/schedule's Schedule exactly.
function days(
  spec: Partial<Record<Weekday, [string, string]>>
): Record<Weekday, DaySchedule> {
  return WEEKDAYS.reduce(
    (acc, d) => {
      const hours = spec[d];
      acc[d] = hours
        ? { enabled: true, from: hours[0], to: hours[1] }
        : { enabled: false, from: "9:00 AM", to: "5:00 PM" };
      return acc;
    },
    {} as Record<Weekday, DaySchedule>
  );
}

export const MENTOR_SCHEDULES: Record<string, Schedule> = {
  m1: {
    timezone: "America/Chicago",
    autoDetect: false,
    days: days({
      Tuesday: ["6:00 PM", "9:00 PM"],
      Thursday: ["6:00 PM", "9:00 PM"],
      Saturday: ["10:00 AM", "2:00 PM"],
    }),
  },
  m2: {
    timezone: "America/New_York",
    autoDetect: false,
    days: days({
      Monday: ["7:00 PM", "10:00 PM"],
      Wednesday: ["7:00 PM", "10:00 PM"],
      Friday: ["7:00 PM", "10:00 PM"],
      Sunday: ["1:00 PM", "5:00 PM"],
    }),
  },
  m3: {
    timezone: "America/Chicago",
    autoDetect: false,
    days: days({
      Monday: ["4:00 PM", "8:00 PM"],
      Tuesday: ["4:00 PM", "8:00 PM"],
      Wednesday: ["4:00 PM", "8:00 PM"],
      Thursday: ["4:00 PM", "8:00 PM"],
    }),
  },
  m4: {
    timezone: "America/New_York",
    autoDetect: false,
    days: days({
      Monday: ["3:30 PM", "6:00 PM"],
      Tuesday: ["3:30 PM", "6:00 PM"],
      Thursday: ["3:30 PM", "6:00 PM"],
      Saturday: ["9:00 AM", "12:00 PM"],
    }),
  },
  m5: {
    timezone: "America/New_York",
    autoDetect: false,
    days: days({ Saturday: ["11:00 AM", "3:00 PM"], Sunday: ["11:00 AM", "3:00 PM"] }),
  },
  m6: {
    timezone: "America/Chicago",
    autoDetect: false,
    days: days({
      Wednesday: ["5:00 PM", "8:00 PM"],
      Friday: ["5:00 PM", "8:00 PM"],
    }),
  },
};

/** A mentor's Active Hours, or null when we hold none (staff and teens keep no
 *  teen-facing schedule). */
export function scheduleFor(id: string): Schedule | null {
  return MENTOR_SCHEDULES[id] ?? null;
}

// t13–t16 are matched to the store-backed mentor ("live") and carry the full
// relationship detail, so the record's mentee table renders real people instead
// of the old parallel DemoMentee fixture. Between them they exercise all four
// recency states: mentor-replied · mentee-wrote · waiting-on-mentor · teen-quiet.
export const DEMO_TEENS: DemoTeen[] = [
  // t1–t12 now carry the SAME relationship detail t13–t16 always had, so every
  // mentor's mentee table reads like a real caseload instead of blank columns.
  // Most are quiet-and-fine; the exceptions (t3 waiting, t8 quiet, t9 escalated)
  // are deliberately few — defaults whisper, exceptions speak.
  {
    id: "t1", name: "Nick Casparro", firstName: "Nick", pronouns: "he/him", phone: "+17078892558",
    group: "North Carolina", active: true, joinedDaysAgo: 1, mentorId: "m1",
    matchedDaysAgo: 1, mentorLastSentDaysAgo: 0, menteeLastSentDaysAgo: 1,
    videoCount30d: 0,
  },
  {
    id: "t2", name: "Patricia Johnson", firstName: "Patricia", goesBy: "Pat", pronouns: "she/her", phone: "+19089101254",
    group: "New Jersey", active: true, joinedDaysAgo: 4, mentorId: "m2",
    matchedDaysAgo: 2, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 0,
    videoCount30d: 1,
  },
  {
    // Teen wrote 6d ago and the mentor hasn't replied → waiting-on-mentor.
    id: "t3", name: "Amy Hashing", firstName: "Amy", pronouns: "she/her", phone: "+19089101035",
    group: "North Carolina", active: true, menteeState: "paused", joinedDaysAgo: 12, mentorId: "m1",
    matchedDaysAgo: 7, mentorLastSentDaysAgo: 7, menteeLastSentDaysAgo: 6,
    videoCount30d: 0,
  },
  {
    id: "t4", name: "John Kneeland", firstName: "John", pronouns: "he/him", phone: "+12158805908",
    group: "Illinois", active: false, joinedDaysAgo: 40, mentorId: "m3",
    matchedDaysAgo: 31, mentorLastSentDaysAgo: 12, menteeLastSentDaysAgo: 20,
    videoCount30d: 0,
    pastMentors: [
      { mentorId: "m1", range: "Jan 2025 – Mar 2025" },
      // TODO-DATA: gives the live mentor a DATED ended match so the Past mentees
      // section exercises both copy paths (dated vs. flag-only).
      { mentorId: "live", range: "Jun 2024 – Jan 2025" },
    ],
  },
  {
    id: "t5", name: "Marcus Lee", firstName: "Marcus", goesBy: "Marc", pronouns: "he/him", phone: "+13125550210",
    group: "Illinois", active: true, joinedDaysAgo: 2, mentorId: "m3",
    // NO STAMPS ON PURPOSE — matched two days ago, neither side has sent
    // anything. `0` would mean "sent today", the opposite of the fact, which is
    // why the no-contact state had to exist before this fixture could.
    matchedDaysAgo: 2,
    videoCount30d: 0,
  },
  {
    id: "t6", name: "Sofia Ramos", firstName: "Sofia", pronouns: "she/her", phone: "+19735550267",
    group: "New Jersey", active: true, menteeState: "paused", joinedDaysAgo: 25, mentorId: "m2",
    matchedDaysAgo: 14, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 1,
    videoCount30d: 2,
    careFlags: [
      {
        id: "cf-t6-1",
        kind: "risk_flag",
        severity: "warning",
        reason: "Asked to pause while exams were on",
        raisedBy: "Maria Lopez",
        raisedByRole: "Mentor",
        daysAgo: 14,
        source: "person",
        conversationWith: "t6",
        conversationId: "conv-t6-a",
        outcome: "no_action",
        resolvedDaysAgo: 12,
        resolvedBy: "Brandy Forrestor",
        resolvedByRole: "Lead mentor",
        resolutionNote:
          "Agreed a four-week pause with the teen and their parent. Nothing else outstanding.",
        /* THE `single-flag` SCENARIO IS THIS RECORD, so it is the one a reviewer
           opens to see a flag expansion at all — and every field in it was an
           em-dash.
           A PERSON-RAISED FLAG WITH NO RISK CATEGORY. `categories` stays absent
           on purpose: a mentor flagging a scheduling request is not a safety
           classification, and reaching for the nearest taxonomy id to fill the
           chip would put a risk label on a teen asking about exams. The
           em-dash on Category is the honest answer, and it is a different
           absence from t17's `CATEGORY_4`, which is an id the taxonomy does not
           map. Both paths now exist on real records. */
        flagDetail: {
          mediaType: "Message",
          /* No safety category and a scheduling request: the remaining-population
             tier, which is what "general monitoring" is for. */
          priority: "generalMonitoring",
          detectedAtTime: "8:47 AM",
          flaggedContent:
            "can we pause for a bit? exams start in two weeks and i don't think i can do the calls and revise at the same time. not quitting, just want to come back after",
        },
      },
    ],
  },
  {
    id: "t7", name: "Ethan Park", firstName: "Ethan", pronouns: "he/him", phone: "+17078893390",
    group: "North Carolina", active: true, joinedDaysAgo: 6, mentorId: "m4",
    matchedDaysAgo: 3, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 2,
    videoCount30d: 1,
  },
  {
    // Mentor replied, teen has been quiet 9 days → teen-quiet.
    id: "t8", name: "Zoe Bennett", firstName: "Zoe", pronouns: "she/her", phone: "+19089104412",
    group: "North Carolina", active: true, joinedDaysAgo: 55, mentorId: "m1",
    matchedDaysAgo: 34, mentorLastSentDaysAgo: 3, menteeLastSentDaysAgo: 9,
    videoCount30d: 1,
  },
  {
    id: "t9", name: "Liam Foster", firstName: "Liam", pronouns: "he/him", phone: "+19735550318",
    group: "New Jersey", active: true, joinedDaysAgo: 18, mentorId: "m4",
    matchedDaysAgo: 14, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 1,
    videoCount30d: 3,
    /* ═══ MOVED OFF THE LEGACY `escalation` SHAPE ═══
       It read `escalation: { reason, daysAgo }`, which `careFlagsFor`
       synthesises into a record with no raiser, no categories and — the reason
       this changed — NO `escalationDetail`, because the legacy shape has
       nowhere to put one. Every field in this record's History expansion was an
       em-dash, and no fixture could fix that while the shape stayed.
       `review-day30` is this teen, so that was the empty one on the scenario a
       reviewer opens to see the first cadence review.
       The legacy branch in `careFlagsFor` stays for any record still on it.
       Names the observable cause, not a prediction about the teen. */
    careFlags: [
      {
        id: "cf-t9-1",
        kind: "escalation",
        severity: "critical",
        reason: "Asked about changing schools mid-year",
        raisedBy: "Sofia Delgado",
        raisedByRole: "Mentor",
        daysAgo: 3,
        source: "person",
        categories: ["UNSAFE_ENVIRONMENT_BELOW_CPS"],
        conversationWith: "t9",
        conversationId: "conv-t9-a",
        momentSummary: {
          provenance: "ai",
          text: "The teen asked about changing schools in two exchanges a day apart, and in the second described avoiding a particular corridor between classes. Nothing earlier this month referred to school.",
        },
        /* AN OPEN ESCALATION, TWO WEEKS INTO A MENTORSHIP. No assessment was
           recorded and nobody has been contacted yet, which is what an
           escalation looks like three days in — the renderer combines those two
           into one "Emergency contact and conversations" row rather than
           printing two dashes about the same absent person. */
        escalationDetail: {
          type: "Welfare concern",
          // suicideRisk: absent — no assessment was recorded at this tier.
          reasonDetail:
            "The teen asked their mentor whether changing schools partway through the year was possible and what it would take. On the following call they said they had been taking a longer route between classes to avoid a group of students, and that they had not told anyone at school.",
          mentorInformation:
            "Mentor reported the teen raised it themselves and answered every follow-up question. No disclosure of physical harm. Mentor noted the teen has been consistent with calls since matching two weeks ago and has not moved or missed one.",
          // contactConversations: absent — nobody has been contacted yet.
          nextSteps:
            "Supervisor to review within five working days and decide whether the school should be contacted. Mentor to keep the next two calls at their scheduled times and note whether the teen raises the corridor or the group again.",
          safetyPlan:
            "Not required at this tier. Teen has the crisis line number from intake and confirmed receiving it.",
        },
      },
    ],
  },
  {
    id: "t10", name: "Ava Mitchell", firstName: "Ava", pronouns: "she/her", phone: "+13125550344",
    group: "Illinois", active: true, joinedDaysAgo: 3, mentorId: "m5",
    matchedDaysAgo: 2,
    videoCount30d: 0,
  },
  {
    id: "t11", name: "Noah Diaz", firstName: "Noah", pronouns: "he/him", phone: "+17078895501",
    group: "North Carolina", active: true, menteeState: "paused", joinedDaysAgo: 9, mentorId: "m2",
    matchedDaysAgo: 3, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 3,
    videoCount30d: 1,
  },
  {
    id: "t12", name: "Mia Chen", firstName: "Mia", pronouns: "she/her", phone: "+19089108833",
    group: "New Jersey", active: true, joinedDaysAgo: 70, mentorId: "m6",
    matchedDaysAgo: 40, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 2,
    videoCount30d: 4,
    pastMentors: [{ mentorId: "m4", range: "Dec 2024 – Feb 2025" }],
  },

  // ── The live mentor's mentees ──────────────────────────────────────────
  {
    id: "t13", name: "Jordan Tate", firstName: "Jordan", goesBy: "Jordy", pronouns: "they/them", phone: "+19089102201",
    group: "North Carolina", active: true, joinedDaysAgo: 122, mentorId: "live",
    matchedDaysAgo: 118, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 2,
    videoCount30d: 0,
    pastMentors: [{ mentorId: "m5", range: "Feb 2025 – Apr 2025" }],
    careFlags: [
      {
        id: "cf-t13-1",
        kind: "escalation",
        severity: "critical",
        reason: "Said they had stopped sleeping and had not eaten since Friday",
        raisedBy: "Brandon Forant",
        raisedByRole: "Mentor",
        daysAgo: 2,
        source: "person",
        categories: ["ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS"],
        conversationWith: "t13",
        conversationId: "conv-t13-a",
        // TODO-DATA. EVENTS, NOT CONTENT — this describes the shape of the
        // exchange and the timing. If a summary here ever reads like a quote it
        // is wrong, and the review modal is not a place to fix that.
        momentSummary: {
          provenance: "ai",
          text: "Across four exchanges over four days the teen described losing sleep and skipping meals, each message more urgent than the last. Their mentor escalated within an hour of the final one.",
        },
        // CRISIS-ELEVATED. The label band gains the word "Crisis" and nothing
        // else — no extra chrome, per the brief.
        crisis: { type: "suicidal_ideation" },
        /* THE CRISIS CASE, FULLY RECORDED AND STILL OPEN — the shape a
           supervisor opens this expansion to read. `escalation-crisis` and
           `escalation-and-review` are both this record, so it is the one the
           demo lands on for the top of the tier.
           OPEN, so there is no resolution footer: `resolvedBy` is absent and
           the collapsed row's "Open" carries the state. Every other field is
           present, because on a crisis at this tier a blank is a finding. */
        escalationDetail: {
          type: "Crisis",
          suicideRisk:
            "Asked directly about thoughts of suicide, a plan and access to means. The teen said the thought had been present since Friday and described a specific method available in the house. They said they had not acted on it and did not want to. No previous attempt is recorded and none was disclosed. Assessed as high acute risk on the plan and the access rather than on intent, and the means were removed the same evening.",
          emergencyContact: "Marguerite Boileau (mother) · +1 908 555 0173",
          reasonDetail:
            "Over four days the teen described sleeping very little and skipping meals since Friday, each message more urgent than the last. In the final exchange they said they had thought about not being here and that they had a way to do it. The mentor escalated within the hour.",
          mentorInformation:
            "Mentor reported the teen answered directly and did not withdraw from the conversation. They confirmed they were at home and that a parent was in the house. The teen said they had not acted on the thought and agreed to stay on chat until someone called.",
          contactConversations:
            "Reached the mother at 6:05 PM. She confirmed she was at home with the teen and had removed the means described. Crisis line supervisor joined a three-way call at 6:40 PM and completed a risk assessment; no emergency services were dispatched. A welfare call at 9:00 PM confirmed the teen was asleep and the parent was awake with them.",
          nextSteps:
            "Daily supervisor check for the next five days. Mentor to hold contact to the scheduled calls and route anything new straight to the supervisor rather than replying. Clinical referral raised the same evening; first appointment offered within 72 hours.",
          safetyPlan:
            "Means removed from the house and confirmed by the parent. Crisis line saved on the teen's phone and dialled once together so it is not the first time. Teen named their mother and their older cousin as the two people they will tell. Agreed that a missed scheduled call triggers a call to the parent rather than a wait.",
        },
      },
    ],
  },
  {
    id: "t14", name: "Sam Karim", firstName: "Sam", pronouns: "he/him", phone: "+13125550788",
    group: "Illinois", active: true, menteeState: "paused", joinedDaysAgo: 15, mentorId: "live",
    matchedDaysAgo: 7, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 0,
    videoCount30d: 3, // video-comfort: low chat volume may be video, not absence
  },
  {
    id: "t15", name: "Riley Moss", firstName: "Riley", pronouns: "she/her", phone: "+17078894102",
    group: "North Carolina", active: true, joinedDaysAgo: 44, mentorId: "live",
    // Teen wrote 5d ago, mentor hasn't replied → derived waiting-on-mentor.
    matchedDaysAgo: 40, mentorLastSentDaysAgo: 6, menteeLastSentDaysAgo: 5,
    videoCount30d: 0,
    pastMentors: [{ mentorId: "m2", range: "Jun 2025 – Sep 2025" }],
  },
  // TODO-DATA: ten more of the live mentor's mentees, added so the Mentees card's
  // PAUSED GROUP can exceed its 8-row scroll threshold and its 9+ search
  // threshold with real rows rather than a contrived duplicate. Long tenures on
  // purpose — the days-in-mentorship column is only interesting across a spread.
  {
    id: "t17", name: "Naomi Reed", firstName: "Naomi", pronouns: "she/her", phone: "+19089107000",
    group: "North Carolina", active: true, joinedDaysAgo: 210, mentorId: "live",
    matchedDaysAgo: 196, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 1,
    videoCount30d: 0,
    careFlags: [
      {
        id: "cf-t17-1",
        kind: "escalation",
        severity: "critical",
        reason: "Told their mentor a family member had been hospitalised",
        raisedBy: "Brandon Forant",
        raisedByRole: "Mentor",
        daysAgo: 40,
        source: "person",
        categories: ["ABUSE_DISCLOSURE"],
        conversationWith: "t17",
        conversationId: "conv-t17-a",
        outcome: "supported",
        // The brief's own example pair — escalation type "Crisis", sub-type
        // "Other". Without this the "all fields populated" case was not.
        crisis: { type: "other" },
        referral: { type: "family_services" },
        resolvedDaysAgo: 38,
        resolvedBy: "Dr. Amara Patel",
        resolvedByRole: "Supervisor",
        resolutionNote:
          "Spoke with the teen and their parent the same evening. Immediate support was in place and the mentorship carried on without a pause.",
        // CASE 1 of Workstream C2 — a RESOLVED escalation with every field
        // populated, so the expansion can be judged at its fullest.
        escalationDetail: {
          type: "Crisis",
          suicideRisk:
            "Asked directly about thoughts of self-harm and suicide during the same call. The teen said no to both and gave direct answers to each follow-up. No plan, no means described and no previous attempt on record. Assessed as low risk; the distress was attributed to the hospital admission and to being alone in the house.",
          emergencyContact: "Denise Okafor (aunt) · +1 704 555 0148",
          reasonDetail:
            "The teen told their mentor during a scheduled call that a family member had been admitted to hospital that morning and that they were at home alone. They described difficulty sleeping and said they had not eaten since the previous day.",
          mentorInformation:
            "Mentor reported the teen was tearful but engaged for the full call and answered every question. No mention of self-harm and none of the standing risk indicators were raised. Mentor confirmed the teen knew where their aunt was and had a phone with charge.",
          contactConversations:
            "Reached the aunt at 7:40 PM the same evening. She confirmed she was already travelling to the house and expected to arrive within the hour. A follow-up call at 9:15 PM confirmed she was with the teen. No emergency services were contacted.",
          nextSteps:
            "Mentor to hold the next two scheduled calls at their usual times rather than adding extra contact. Supervisor to review at the 30-day mark. Family services referral raised so the household has a named worker.",
          safetyPlan:
            "Teen has their aunt's number saved and agreed to call her first. Crisis line number sent in chat and confirmed received. Teen agreed to tell their mentor at the next call if the sleeping difficulty continued.",
          resolvedAtTime: "9:32 PM",
        },
      },
      {
        // A SECOND OPEN ESCALATION, so one record carries all three task types at
        // once — the only way to see the band triad as a graduated scale in a
        // single Action required section, which is what the tone work has to be
        // judged against. It also closes a real gap the audit found: exactly one
        // escalation was open across 26 teens, so the critical band was
        // effectively unreviewable.
        id: "cf-t17-3",
        kind: "escalation",
        severity: "critical",
        reason: "Said a family member had taken their phone away for a week",
        raisedBy: "Brandy Forrestor",
        raisedByRole: "Lead mentor",
        daysAgo: 3,
        source: "person",
        categories: ["ABUSE_DISCLOSURE"],
        conversationWith: "t17",
        // A DIFFERENT conversation from cf-t17-2 below — same teen, same
        // `conversationWith`, separate exchanges. This is the pair that proves
        // grouping keys on the THREAD and not the person: these two must stay
        // two cards.
        conversationId: "conv-t17-c",
        momentSummary: {
          provenance: "ai",
          text: "The teen mentioned losing access to their phone and asked to move a scheduled call. Two earlier exchanges this month referred to tension at home.",
        },
        // CASE 2 of Workstream C2 — an OPEN escalation with NO suicide
        // assessment and NO emergency-contact conversation, so both em-dash
        // paths render on a real record. `resolvedBy` is absent, so no
        // attribution footer: the collapsed row's "Open" already carries state.
        escalationDetail: {
          type: "Welfare concern",
          // suicideRisk: deliberately absent — no assessment was recorded.
          emergencyContact: undefined,
          reasonDetail:
            "Lead mentor raised this after the teen said a family member had taken their phone for a week and asked whether missing calls would count against them. The question about consequences, rather than the phone itself, is what prompted the escalation.",
          mentorInformation:
            "Lead mentor reviewed the last three weeks of scheduled contact. Two calls moved at short notice, both rescheduled by the teen and both kept. No missed calls without notice.",
          // contactConversations: deliberately absent — nobody has been
          // contacted yet, which is exactly what an open escalation looks like.
          nextSteps:
            "Supervisor to review within five working days. Mentor to keep the next call at its scheduled time and note whether the teen raises the arrangement again.",
          safetyPlan:
            "Not required at this tier. Teen has the crisis line number from intake and confirmed it at their 90-day check.",
        },
      },
      {
        /* ═══ THE SECOND FLAG IN ONE MONTH ═══
           Added so the chart's per-month badge has a count above one somewhere
           in the demo — every other month held exactly one event, so the "3" on
           a single badge was a state no scenario could reach. 25 days ago puts
           it in the same calendar month as `cf-t17-2` below (28 days) without
           sharing a DAY with it, which keeps the two distinct in History while
           the chart counts them together. */
        id: "cf-t17-5",
        kind: "risk_flag",
        severity: "warning",
        reason: "Left a scheduled call after a few minutes",
        raisedBy: "Brandy Forrestor",
        raisedByRole: "Lead mentor",
        daysAgo: 25,
        source: "person",
        conversationWith: "t17",
        conversationId: "conv-t17-b",
        flagDetail: {
          mediaType: "Message",
          priority: "generalMonitoring",
          detectedAtTime: "5:03 PM",
          flaggedContent:
            "sorry i have to go, i'll explain next time",
        },
      },
      {
        id: "cf-t17-2",
        kind: "risk_flag",
        severity: "warning",
        reason: "Missed three scheduled calls in a row",
        raisedBy: "Brandy Forrestor",
        raisedByRole: "Lead mentor",
        daysAgo: 6,
        source: "person",
        // DELIBERATELY UNMAPPED, so the "Uncategorised" path is exercised on a
        // real record rather than only in theory. `unmappedCategories()`
        // reports it; the chip never shows the raw value.
        categories: ["CATEGORY_4"],
        conversationWith: "t17",
        conversationId: "conv-t17-b",
        // CASE 3 of Workstream C2 — an OPEN flag, and the NON-MESSAGE media type
        // the brief requires. An image carries no words, so `flaggedContent` is
        // absent and the quote block does not render — the em-dash rule covers
        // the label.
        flagDetail: {
          mediaType: "Image",
          /* An unmapped category on a missed-calls flag — nothing here argues for
             a clinician, and pattern tracking is exactly the response. */
          priority: "generalMonitoring",
          detectedAtTime: "4:12 PM",
        },
      },
      {
        // CASE 4 of Workstream C2 — a REVIEWED flag of Message type, so the
        // verbatim quote, the AI rationale and the attribution footer all render
        // together. Its own conversation, so it stays a separate card from the
        // two above.
        id: "cf-t17-4",
        kind: "risk_flag",
        severity: "warning",
        reason: "Described feeling like a burden to the people around them",
        raisedBy: "Somethings",
        raisedByRole: "System",
        daysAgo: 21,
        source: "system",
        // THE REAL TAXONOMY ID. I first wrote "SELF_HARM_SUICIDE", which is not
        // in `RISK_CATEGORIES` at all — the chip silently rendered nothing,
        // because `riskCategory()` returns null for an unmapped value and the
        // Category cell falls to its em-dash. Passive ideation is the correct
        // entry for a statement of low self-worth with no plan, means or
        // timeframe, which is exactly what the excerpt below is.
        categories: ["PASSIVE_SUICIDAL_IDEATION"],
        conversationWith: "t17",
        conversationId: "conv-t17-d",
        resolvedDaysAgo: 20,
        resolvedBy: "Dr. Amara Patel",
        resolvedByRole: "Supervisor",
        resolutionNote:
          "Reviewed with the mentor the following morning. The teen was describing a rough week at home rather than intent, and said so directly when asked. No change to the presentation; mentor to keep the usual cadence.",
        momentSummary: {
          provenance: "ai",
          text: "The message pairs a statement of low self-worth with a reference to other people being better off, which the model scores against the self-harm indicator set. Two messages earlier in the same exchange describe a family argument. No plan, means or timeframe appears anywhere in the conversation.",
        },
        flagDetail: {
          mediaType: "Message",
          /* PASSIVE_SUICIDAL_IDEATION is a clinical-support category in the
             playbook, and this is the record that shows that tier. */
          priority: "clinicalReview",
          detectedAtTime: "11:47 PM",
          // VERBATIM — see the field's own note, and the report. Synthetic.
          flaggedContent:
            "honestly everyone would have an easier week if i just wasn't around making everything harder",
          reviewedAtTime: "8:15 AM",
        },
      },
    ],
  },
  {
    id: "t18", name: "Caleb Ortiz", firstName: "Caleb", pronouns: "he/him", phone: "+19089107001",
    group: "North Carolina", active: true, joinedDaysAgo: 188, mentorId: "live",
    matchedDaysAgo: 171, mentorLastSentDaysAgo: 3, menteeLastSentDaysAgo: 2,
    videoCount30d: 1,
    completedActivities: [
      { id: "act-t18-1", name: "Hot Takes", daysAgo: 2 },
      { id: "act-t18-2", name: "Two Truths", daysAgo: 11 },
    ],
  },
  {
    id: "t19", name: "Simone Ba", firstName: "Simone", pronouns: "she/her", phone: "+19089107002",
    group: "North Carolina", active: true, joinedDaysAgo: 176, mentorId: "live",
    matchedDaysAgo: 160, mentorLastSentDaysAgo: 4, menteeLastSentDaysAgo: 3,
    videoCount30d: 2,
  },
  {
    id: "t20", name: "Theo Lindqvist", firstName: "Theo", pronouns: "he/him", phone: "+19089107003",
    group: "North Carolina", active: false, joinedDaysAgo: 165, mentorId: "live",
    matchedDaysAgo: 149, mentorLastSentDaysAgo: 5, menteeLastSentDaysAgo: 4,
    videoCount30d: 0,
  },
  {
    id: "t21", name: "Imani Clarke", firstName: "Imani", pronouns: "she/her", phone: "+19089107004",
    group: "North Carolina", active: true, joinedDaysAgo: 151, mentorId: "live",
    matchedDaysAgo: 140, mentorLastSentDaysAgo: 6, menteeLastSentDaysAgo: 1,
    videoCount30d: 1,
    // BOTH SECTIONS AT ONCE — four grouped flags above, an activity below. The
    // whole point of the lighter Attention treatment is that it does not compete
    // with Action required, which can only be judged on a record carrying both.
    completedActivities: [{ id: "act-t21-1", name: "Hot Takes", daysAgo: 5 }],
    careFlags: [
      {
        id: "cf-t21-1",
        kind: "risk_flag",
        severity: "warning",
        // SYSTEM-DETECTED: the reason names what was OBSERVED in the exchange,
        // never what was written. Events, not content.
        reason: "Language matching the hate-speech classifier appeared in chat",
        raisedBy: "Moderation",
        raisedByRole: "Automated review",
        daysAgo: 9,
        source: "system",
        categories: ["HATE_SPEECH_RACIAL_SLURS", "GROOMING_BEHAVIOR"],
        conversationWith: "t21",
        conversationId: "conv-t21-a",
        momentSummary: {
          provenance: "system",
          text: "Three messages in one evening exchange matched two classifier categories. No earlier match exists on this conversation.",
        },
        /* ═══ ONE SWEEP, ONE DETECTION TIME, FOUR MATCHES ═══
           All four records below share `detectedAtTime` because they came out of
           the same pass over the same evening — the grouping's whole premise.
           Four different times would quietly tell a reviewer they were four
           separate incidents.
           THE QUOTED TEXT IS WHAT THE CLASSIFIER MATCHED ON, and it is written
           to be recognisable as that match WITHOUT reproducing a slur. A fixture
           is read by everyone who opens this repo; the demo needs a reviewer to
           see that verbatim content renders and is attributable, which does not
           require the ugliest possible string to demonstrate. Real data will not
           have that courtesy, and the component is what has to hold. */
        flagDetail: {
          mediaType: "Message",
          /* Hate speech alongside a grooming match. Not act-now on its own, but
             it is not something a mentor is left to coach through either. */
          priority: "clinicalReview",
          detectedAtTime: "9:14 PM",
          flaggedContent:
            "everyone from over there is the same, my cousin says they shouldn't even be allowed at our school",
        },
      },
      // ── THE GROUPING CASE ────────────────────────────────────────────────
      // ONE moderation sweep of ONE evening's exchange, producing four separate
      // category hits. This is the realistic origin of the failure mode the
      // grouping is designed against: a classifier does not raise one tidy flag
      // per conversation, it raises one per match, and four cards for one chat
      // is already unreadable at 26 teens.
      //
      // All four share `conv-t21-a` and the same `daysAgo`, because they came out
      // of the same sweep. They are NOT duplicates of each other — each names a
      // different category, which is exactly why the group has to expand rather
      // than collapse to a single label.
      {
        id: "cf-t21-2",
        kind: "risk_flag",
        severity: "warning",
        reason: "Language matching the threat classifier appeared in the same exchange",
        raisedBy: "Moderation",
        raisedByRole: "Automated review",
        daysAgo: 9,
        source: "system",
        categories: ["CREDIBLE_SPECIFIC_THREAT_TO_HARM_ANOTHER"],
        conversationWith: "t21",
        conversationId: "conv-t21-a",
        momentSummary: {
          provenance: "system",
          text: "One message in the same exchange matched the threat classifier at high confidence. The match names a specific person and a specific place.",
        },
        // HIGH, and the only one of the four that is: a named person and a named
        // place is what separates this from the ideation category.
        flagDetail: {
          mediaType: "Message",
          /* A credible threat naming a person and a place. Act now — the one
             fixture at the top tier, and it has to be a real one. */
          priority: "imminent",
          detectedAtTime: "9:14 PM",
          flaggedContent:
            "if he waits by the bus doors again i'm going to make him regret it, i'm not walking away this time",
        },
      },
      {
        id: "cf-t21-3",
        kind: "risk_flag",
        severity: "warning",
        reason: "A second grooming-pattern match in the same exchange",
        raisedBy: "Moderation",
        raisedByRole: "Automated review",
        daysAgo: 9,
        source: "system",
        categories: ["GROOMING_BEHAVIOR"],
        conversationWith: "t21",
        conversationId: "conv-t21-a",
        momentSummary: {
          provenance: "system",
          text: "A second message in the same exchange matched the grooming-pattern classifier. The pattern is an adult account moving the conversation off-platform.",
        },
        flagDetail: {
          mediaType: "Message",
          /* An adult moving a minor off-platform and telling them not to tell a
             parent. `GROOMING_BEHAVIOR` is `"unassigned"` in the taxonomy, which
             is the gap the note on `priority` describes: derived, this would
             have come out as general monitoring. */
          priority: "imminent",
          detectedAtTime: "9:14 PM",
          flaggedContent:
            "he keeps saying we should talk somewhere else where no one can see it and that i shouldn't tell my mum because she'd take it the wrong way",
        },
      },
      {
        // UNMAPPED, inside a group — so the expanded list exercises the
        // "Uncategorised" chip too, not just the collapsed count.
        id: "cf-t21-4",
        kind: "risk_flag",
        severity: "warning",
        reason: "An uncategorised classifier match in the same exchange",
        raisedBy: "Moderation",
        raisedByRole: "Automated review",
        daysAgo: 9,
        source: "system",
        categories: ["CATEGORY_4"],
        conversationWith: "t21",
        conversationId: "conv-t21-a",
        momentSummary: {
          provenance: "system",
          text: "A fourth message in the same exchange matched a classifier category this build does not map. The match is recorded so the sweep is complete; the category is reported as uncategorised.",
        },
        /* MEDIUM, not high — an unmapped category cannot justify the top
           priority, because nothing here knows what it matched. */
        flagDetail: {
          mediaType: "Message",
          /* An unmapped category cannot justify a top tier, because nothing here
             knows what it matched. */
          priority: "generalMonitoring",
          detectedAtTime: "9:14 PM",
          flaggedContent:
            "i've just been staying up all night on my phone because it's easier than lying there",
        },
      },
    ],
  },
  {
    id: "t22", name: "Ravi Menon", firstName: "Ravi", pronouns: "he/him", phone: "+19089107005",
    group: "North Carolina", active: false, joinedDaysAgo: 143, mentorId: "live",
    matchedDaysAgo: 128, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 2,
    videoCount30d: 2,
    careFlags: [
      {
        id: "cf-t22-1",
        kind: "escalation",
        severity: "critical",
        reason: "Said a fight at home had made it hard to be on calls",
        raisedBy: "Brandon Forant",
        raisedByRole: "Mentor",
        daysAgo: 96,
        source: "person",
        categories: ["ABUSE_DISCLOSURE"],
        conversationWith: "t22",
        conversationId: "conv-t22-a",
        outcome: "supported",
        resolvedDaysAgo: 94,
        resolvedBy: "Omar Haddad",
        resolvedByRole: "Supervisor",
        resolutionNote:
          "Checked in with the parent, agreed a different call time, and the calls resumed the following week.",
        /* A RESOLVED ESCALATION ON A CLOSED RECORD, which is its own case: the
           mentorship has since ended, so this expansion is being read as
           history rather than as a live concern. It carries `resolvedAtTime`,
           so the footer reads "Resolved by Omar Haddad · {date} at {time}".
           NO SUICIDE ASSESSMENT, deliberately: none was recorded, and on a
           welfare concern that is the ordinary case rather than a gap. The
           em-dash says so. */
        escalationDetail: {
          type: "Welfare concern",
          emergencyContact: "Priya Menon (mother) · +1 908 555 0291",
          reasonDetail:
            "The teen told their mentor that an argument at home the night before had left the house tense and that they had taken calls in a stairwell to get away from it. They asked whether the calls could move to a time when fewer people were home.",
          mentorInformation:
            "Mentor reported the teen was steady through the call and raised the arrangement themselves rather than being asked. No disclosure of physical harm and none of the standing indicators were present. Mentor noted two calls that month had started late for the same reason.",
          contactConversations:
            "Spoke with the mother the following afternoon. She described a disagreement between adults in the household and agreed the evening slot was difficult. No further concern was raised and no external service was contacted.",
          nextSteps:
            "Calls moved to 4:30 PM on the same days. Mentor to note whether the teen raises the household again in the next month. No supervisor review scheduled beyond the standard cadence.",
          safetyPlan:
            "Not required at this tier. Teen confirmed they had somewhere in the house they could go and had the crisis line number from intake.",
          resolvedAtTime: "3:18 PM",
        },
      },
    ],
  },
  {
    id: "t23", name: "Elena Duarte", firstName: "Elena", pronouns: "she/her", phone: "+19089107006",
    group: "North Carolina", active: true, joinedDaysAgo: 134, mentorId: "live",
    matchedDaysAgo: 119, mentorLastSentDaysAgo: 3, menteeLastSentDaysAgo: 3,
    videoCount30d: 0,
    completedActivities: [{ id: "act-t23-1", name: "Icebreakers", daysAgo: 4 }],
  },
  {
    id: "t24", name: "Jonah Whitfield", firstName: "Jonah", pronouns: "he/him", phone: "+19089107007",
    group: "North Carolina", active: true, joinedDaysAgo: 121, mentorId: "live",
    matchedDaysAgo: 108, mentorLastSentDaysAgo: 4, menteeLastSentDaysAgo: 4,
    videoCount30d: 1,
  },
  {
    id: "t25", name: "Yuki Tanaka", firstName: "Yuki", pronouns: "they/them", phone: "+19089107008",
    group: "North Carolina", active: false, joinedDaysAgo: 112, mentorId: "live",
    matchedDaysAgo: 97, mentorLastSentDaysAgo: 5, menteeLastSentDaysAgo: 1,
    videoCount30d: 2,
  },
  {
    id: "t26", name: "Marisol Vega", firstName: "Marisol", pronouns: "she/her", phone: "+19089107009",
    group: "North Carolina", active: false, joinedDaysAgo: 103, mentorId: "live",
    matchedDaysAgo: 90, mentorLastSentDaysAgo: 6, menteeLastSentDaysAgo: 2,
    videoCount30d: 0,
  },
  {
    id: "t16", name: "Alex Petrov", firstName: "Alex", pronouns: "he/him", phone: "+19735550655",
    group: "New Jersey", active: false, joinedDaysAgo: 92, mentorId: "live",
    // Mentor replied, but the teen has been quiet 9 days → teen-quiet.
    matchedDaysAgo: 65, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 9,
    videoCount30d: 1,
  },
];

// ── Relationships ────────────────────────────────────────────────────────────

/** Any person by id — mentors, staff, or teens. The single lookup a record
 *  route needs. */
export function personById(
  id: string
): DemoMentorRow | DemoTeen | undefined {
  return DEMO_PEOPLE.find((p) => p.id === id) ?? DEMO_TEENS.find((t) => t.id === id);
}

/** A person's role, defaulting sensibly (most mentor rows omit it, and any
 *  DemoTeen is a teen). */
export function roleOf(p: DemoMentorRow | DemoTeen): PersonRole {
  return "mentorId" in p ? "teen" : (p.role ?? "mentor");
}

/** The people a lead or supervisor oversees. A LEAD sees their mentors; a
 *  SUPERVISOR sees their leads first, then those leads' mentors (the branch). */
export function superviseesOf(id: string): DemoMentorRow[] {
  const leads = DEMO_STAFF.filter((s) => s.supervisorId === id);
  const direct = DEMO_MENTORS.filter((m) => m.leadId === id);
  const viaLeads = leads.flatMap((l) =>
    DEMO_MENTORS.filter((m) => m.leadId === l.id)
  );
  return [...leads, ...direct, ...viaLeads];
}

/** A teen's mentors, current first then past (most recent first). Returns the
 *  mentor row plus how to label the match. */
export function mentorsForTeen(
  teenId: string
): { mentor: DemoMentorRow; current: boolean; range?: string }[] {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen) return [];
  const out: { mentor: DemoMentorRow; current: boolean; range?: string }[] = [];
  const current = DEMO_PEOPLE.find((m) => m.id === teen.mentorId);
  if (current) out.push({ mentor: current, current: true });
  for (const p of teen.pastMentors ?? []) {
    const m = DEMO_PEOPLE.find((x) => x.id === p.mentorId);
    if (m) out.push({ mentor: m, current: false, range: p.range });
  }
  return out;
}

// The lead mentor's "umbrella" — kept as helpers, now derived from the real
// `leadId` edges rather than a hardcoded id list. The lead persona is Brandy.
export const LEAD_PERSONA_ID = "s-brandy";

export function leadUmbrellaMentors(): DemoMentorRow[] {
  return DEMO_MENTORS.filter((m) => m.leadId === LEAD_PERSONA_ID);
}

export function leadUmbrellaTeens(): DemoTeen[] {
  const ids = leadUmbrellaMentors().map((m) => m.id);
  return DEMO_TEENS.filter((t) => ids.includes(t.mentorId));
}

export function teensForMentor(mentorId: string): DemoTeen[] {
  return DEMO_TEENS.filter((t) => t.mentorId === mentorId);
}

/** A teen's default match standing, before any staff override. The fixtures
 *  carry a boolean, so they can only express two of the three states. */
/** An escalation or a risk flag, as a record rather than a sentence.
 *
 *  VOCABULARY LAW: `reason` names the OBSERVABLE CAUSE — what someone saw, or
 *  what a teen said had happened — never a forecast, and never the content of a
 *  message. "Said they had stopped sleeping", not "at risk of disengaging".
 *
 *  RESOLUTION IS THE ABSENCE OF A FIELD. `resolvedDaysAgo === undefined` means
 *  OPEN, so an unresolved flag cannot be produced by forgetting to set a state —
 *  the open case is the one carrying LESS data, which is how it actually
 *  arrives. */
/** SAFETY CATEGORIES — the taxonomy, and the ONLY place raw values become
 *  readable strings.
 *
 *  BUILT, NOT REPAIRED. The brief described these as leaking into the UI as raw
 *  constants; audited, this codebase had NO category taxonomy at all — zero
 *  SCREAMING_SNAKE literals anywhere in src, and a flag's `reason` was free
 *  prose. So there was nothing to un-leak; the enum and its display map are new.
 *
 *  THE MAP IS THE CONTRACT. Nothing may render a category except through
 *  `categoryLabel`, which returns "Uncategorised" for anything it does not know.
 *  That is the point: a value the product has not learned to name must NOT reach
 *  a supervisor as `CATEGORY_4`, and it must not be silently dropped either —
 *  an uncategorised safety flag is still a safety flag, and `unmappedCategories`
 *  exists so the gap is countable rather than invisible.
 *
 *  TODO-DATA: the real taxonomy comes from the moderation layer, which does not
 *  exist yet. These five are the ones the brief named. */
/** DERIVED FROM THE TAXONOMY, not a second hand-written copy.
 *
 *  This map used to hold the five categories inline, and it is now the display
 *  projection of `RISK_CATEGORIES` (lib/record/risk-taxonomy.ts), which carries
 *  all twenty-one along with their tier and clinical theme. One source of truth:
 *  a category cannot exist with a label but no theme, or gain a theme and keep an
 *  old label. Every consumer still reaches it through `categoryLabel` and none of
 *  them changed. */
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  RISK_CATEGORIES.map((c) => [c.id, c.label])
);

/** TODO-COPY. What an unmapped category reads as. Deliberately not the raw
 *  value, and deliberately not blank. */
export const UNCATEGORISED_LABEL = "Uncategorised";

export function categoryLabel(value: string): string {
  return CATEGORY_LABEL[value] ?? UNCATEGORISED_LABEL;
}

/** Every category on the roster that has no display name — reported, not
 *  hidden. Dev-time visibility for a gap that would otherwise only show up as
 *  an "Uncategorised" chip a reader cannot act on. */
export function unmappedCategories(): string[] {
  const seen = new Set<string>();
  for (const t of DEMO_TEENS) {
    for (const f of t.careFlags ?? []) {
      for (const c of f.categories ?? []) {
        if (!(c in CATEGORY_LABEL)) seen.add(c);
      }
    }
  }
  return [...seen].sort();
}

/** What a supervisor did about a flag. TODO-COPY on every label. */
export const FLAG_OUTCOME = [
  { id: "supported", label: "Supported in place" },
  { id: "escalated", label: "Escalated for review" },
  { id: "referred", label: "Referred out" },
  { id: "no_action", label: "No action needed" },
] as const;
export type FlagOutcome = (typeof FLAG_OUTCOME)[number]["id"];

/** Crisis types, per the brief. Elevation is a FLAG ON an escalation, not a
 *  third severity — the critical family already carries it and the word
 *  "Crisis" in the label does the rest. */
export const CRISIS_TYPE = [
  { id: "self_harm", label: "Self-harm" },
  { id: "suicidal_ideation", label: "Suicidal ideation" },
  { id: "suicide_attempt", label: "Suicide attempt" },
  { id: "homicidal_ideation", label: "Homicidal ideation" },
  { id: "other", label: "Other" },
] as const;
export type CrisisType = (typeof CRISIS_TYPE)[number]["id"];

export const REFERRAL_TYPE = [
  { id: "mental_health", label: "Mental health professional" },
  { id: "medical", label: "Medical provider" },
  { id: "emergency", label: "Emergency services" },
  { id: "crisis_hotline", label: "Crisis hotline" },
  { id: "school_counselor", label: "School counsellor" },
  { id: "family_services", label: "Family services" },
  { id: "substance_abuse", label: "Substance abuse treatment" },
  { id: "other", label: "Other" },
] as const;
export type ReferralType = (typeof REFERRAL_TYPE)[number]["id"];

export interface CareFlagRecord {
  id: string;
  kind: "escalation" | "risk_flag";
  /** Escalations run critical, risk flags warning. Kept separate from `kind`
   *  because severity is what the task region SORTS on, and a future kind
   *  should not have to imply its own severity. */
  severity: "critical" | "warning";
  reason: string;
  raisedBy: string;
  raisedByRole: string;
  daysAgo: number;
  /** Absent = OPEN. */
  resolvedDaysAgo?: number;
  resolvedBy?: string;
  resolvedByRole?: string;
  resolutionNote?: string;

  // ── Added for the task-card system ────────────────────────────────────
  /** Safety categories. Raw values — NEVER rendered directly; see
   *  `categoryLabel`. An empty or absent array is a flag nobody categorised,
   *  which is different from one categorised as unknown. */
  categories?: string[];
  /** WHO OR WHAT RAISED IT. "system" means the moderation layer detected it in
   *  chat; "person" means a mentor or staff member raised it by hand. The
   *  provenance line reads differently for each, and conflating them would let
   *  a machine's guess wear a person's judgement. */
  source?: "system" | "person";
  /** The teen whose conversation this came from, for the discussion link. The
   *  link goes to the CONVERSATION SURFACE — message text is never rendered on
   *  the record or in the review modal. */
  conversationWith?: string;
  /** THE CONVERSATION THIS FLAG CAME OUT OF — a THREAD id, and emphatically NOT
   *  a person id.
   *
   *  `conversationWith` above is the PERSON (the teen), which on a teen's own
   *  record is the same value on every flag they have. Grouping on it therefore
   *  groups by teen, which collapses unrelated concerns raised months apart into
   *  one card and hides them behind a single count. That is the exact failure the
   *  grouping is meant to prevent, inverted.
   *
   *  So the key is its own field. Flags that arose from ONE exchange share one
   *  `conversationId`; flags from separate exchanges do not, even on the same
   *  teen with the same `conversationWith`. Absent = ungrouped, rendered as its
   *  own card.
   *
   *  TODO-DATA: the real id comes from the messaging layer, which does not exist
   *  yet. `conv-<teen>-<letter>` is a fixture shape, not a contract. */
  conversationId?: string;
  /** A SYSTEM- OR AI-WRITTEN SUMMARY OF THE FLAGGED MOMENT — a description of
   *  what happened, never the words that were said. Vocabulary law: events, not
   *  content. If a fixture here ever reads like a quote, it is wrong.
   *
   *  `provenance` separates the two very different things this can be: a
   *  deterministic classifier reporting what it matched ("system"), and a model
   *  writing prose about an exchange ("ai"). They earn different trust and the
   *  card labels them differently, so they are never merged into one flag.
   *
   *  Absent on most flags, deliberately — a card with no summary is the common
   *  case and has to look finished without one. */
  momentSummary?: { text: string; provenance: "system" | "ai" };
  /** CRISIS ELEVATION. Set by a supervisor during review; adds the word
   *  "Crisis" to the label band and nothing else. */
  crisis?: { type: CrisisType; note?: string };
  /** A referral made during review. */
  referral?: { type: ReferralType; detail?: string };

  /** ═══ ESCALATION DETAIL — the History expansion's field set ═══
   *
   *  Escalations only. Every field is OPTIONAL and the renderer prints a label
   *  with an em-dash for the ones that are absent, because this is an audit
   *  surface: "nobody recorded a safety plan" is information, and omitting the
   *  row would hide it.
   *
   *  `reason` above stays the ROW TITLE — the one line that identifies the entry
   *  in a collapsed list. `reasonDetail` here is the paragraph a supervisor
   *  writes, which is a different length and a different job.
   *
   *  "Referral?" from the legacy detail view is DELIBERATELY ABSENT: the field
   *  spec omits it. `referral` above still exists and still drives the closure
   *  entry's label — it is simply not part of this expansion.
   *
   *  TODO-DATA: fixture shape. The real source is the escalation service. */
  escalationDetail?: {
    /** Chip. The kind of escalation raised — "Crisis", "Welfare concern". */
    type: string;
    /** ═══ FREE-FORM PROSE, NOT A SEVERITY LEVEL ═══
     *
     *  It was typed `"Low" | "Moderate" | "High"` and rendered as a tonal chip.
     *  That was wrong about the field: what gets recorded here is an
     *  ASSESSMENT — what was asked, what was answered, what was concluded — and
     *  a three-value union cannot hold any of it. Widening the type is the
     *  point of the change, not a side effect of it: a `string` is what stops
     *  the next fixture from collapsing an assessment back into one word.
     *
     *  Absent = no assessment was recorded, which is a real and common state,
     *  not missing data — an escalation at the welfare tier routinely has none.
     *  The renderer prints the label with an em-dash so the absence is on the
     *  record rather than hidden. */
    suicideRisk?: string;
    /** Text. Absent = none on file. */
    emergencyContact?: string;
    reasonDetail?: string;
    mentorInformation?: string;
    /** Conversations with the emergency contact or first responders. */
    contactConversations?: string;
    nextSteps?: string;
    safetyPlan?: string;
    /** Local time of the resolution, for "Resolved by X · {date} at {time}". The
     *  DATE is derived from `resolvedDaysAgo` so it cannot drift from the row. */
    resolvedAtTime?: string;
  };

  /** ═══ FLAG DETAIL — the History expansion's field set ═══
   *
   *  Risk flags only. `momentSummary` above already carries "why this was
   *  flagged" and its provenance, so it is NOT duplicated here.
   *
   *  TODO-DATA: fixture shape. The real source is the moderation service. */
  flagDetail?: {
    /** Neutral chip. What the flagged item WAS. */
    mediaType: "Message" | "Video" | "Audio" | "Image";
    /** ═══ THE PLAYBOOK'S RESPONSE TIER ═══
     *
     *  Was `"high" | "medium"`, which was a severity of its own invention. The
     *  product already carries the playbook's three tiers in `risk-taxonomy.ts`
     *  — imminent / clinicalReview / generalMonitoring — and a second scale
     *  beside them is two vocabularies for one judgement. So this IS that type.
     *
     *  STORED, NOT DERIVED FROM `categories`, and that is deliberate. `tierOf()`
     *  would give this for free, but the taxonomy has real gaps —
     *  `GROOMING_BEHAVIOR` is `"unassigned"` today — and deriving would silently
     *  file a safeguarding flag under general monitoring because a lookup
     *  table has a hole. An explicit field fails loudly instead; the mismatch
     *  is then a fixture to fix, not a downgrade nobody sees.
     *
     *  Still named separately from `severity`, for the original reason:
     *  `severity` is what the task region SORTS on and a display tier should
     *  not silently become a sort key. */
    priority: RiskTier;
    /** Local time of detection, for "{date} · {time}". */
    detectedAtTime?: string;
    /** ═══ THE TEEN'S OWN WORDS, VERBATIM ═══
     *
     *  Rendered as a quote, exactly as authored — never paraphrased, truncated
     *  or summarised.
     *
     *  THIS CONTRADICTS A RULE THIS CODEBASE CALLS LOCKED, and it is recorded
     *  here rather than quietly absorbed. `people-demo.ts` says of
     *  `conversationWith` that "message text is never rendered on the record";
     *  `flag-review-dialog.tsx` says "MESSAGE CONTENT IS NEVER RENDERED HERE.
     *  Not in the context step, not anywhere"; `tasks/conversation.ts` calls it
     *  "the locked rule — no message content in list rows, ever".
     *
     *  The R6-History field spec requires it on this surface, on the reasoning
     *  that the exact wording IS the clinical datum. That is a product decision
     *  and it is Brandon's to make; it is flagged in the report rather than
     *  settled here. Removing it again is deleting one block and this field.
     *
     *  The nearest precedent that already exists: `RiskFlagPayload.flaggedExcerpt`
     *  renders verbatim in the TASKS pane, under the framing that the pane is the
     *  conversation surface. */
    flaggedContent?: string;
    /** Time of the review, paired with `resolvedBy` for the footer. */
    reviewedAtTime?: string;
  };
  /** What the supervisor concluded, recorded at close. */
  outcome?: FlagOutcome;
}

/** Every flag on a teen, newest first. Falls back to the legacy `escalation`
 *  field so a teen that predates `careFlags` still reports one — with the raiser
 *  named honestly as unknown rather than invented. */
export function careFlagsFor(teen: DemoTeen): CareFlagRecord[] {
  const flags = teen.careFlags?.length
    ? teen.careFlags
    : teen.escalation
      ? [
          {
            id: `cf-${teen.id}-legacy`,
            kind: "escalation" as const,
            severity: "critical" as const,
            reason: teen.escalation.reason,
            // The legacy shape records no raiser. Saying "a mentor" is true of
            // every escalation in this product; inventing a name would not be.
            raisedBy: "A mentor",
            raisedByRole: "Mentor",
            daysAgo: teen.escalation.daysAgo,
          },
        ]
      : [];
  return [...flags].sort((a, b) => a.daysAgo - b.daysAgo);
}

export function defaultMenteeStatus(
  t: DemoTeen
): "active" | "paused" | "deactivated" {
  // The explicit field wins; the boolean is the legacy two-state fallback.
  return t.menteeState ?? (t.active ? "active" : "deactivated");
}

/** ENDED matches for a mentor, from the two shapes the fixtures carry:
 *   1. a teen still pointing at this mentor whose match is stood down
 *      (`active: false`) — NO end date exists for these, only the flag;
 *   2. a teen who lists this mentor in `pastMentors` — carries a human range
 *      ("Jun 2024 – Jan 2025"), so the end month is recoverable.
 *
 *  GAP (reported): neither shape records an OUTCOME. A graduation and a rematch
 *  are indistinguishable here, so the copy stays neutral ("ended"). Adding
 *  `PastMatch.outcome` is the fix; until then this section can only say that
 *  something stopped, not how it went. */
export function pastMenteesFor(
  mentorId: string,
  /** Override-aware "has this match ended?" — the caller has store access, this
   *  module doesn't. Defaults to the fixture flag. */
  hasEnded: (t: DemoTeen) => boolean = (t) => t.active === false
): { teen: DemoTeen; endedLabel: string | null }[] {
  const out: { teen: DemoTeen; endedLabel: string | null }[] = [];
  for (const t of DEMO_TEENS) {
    if (t.mentorId === mentorId && hasEnded(t)) {
      out.push({ teen: t, endedLabel: null });
      continue;
    }
    const past = t.pastMentors?.find((p) => p.mentorId === mentorId);
    // Second half of "Jun 2024 – Jan 2025" is the end.
    if (past) out.push({ teen: t, endedLabel: past.range.split("–").pop()?.trim() ?? null });
  }
  return out;
}

/** Display name for a mentor id. Searches staff too, so a teen matched to a
 *  lead resolves. "live" is the store-backed mentor and has no fixture row —
 *  callers with store access should prefer the draft name. */
export function mentorName(mentorId: string): string {
  return DEMO_PEOPLE.find((m) => m.id === mentorId)?.name ?? "—";
}

// ── Tenure buckets ──────────────────────────────────────────────────────────
// Cumulative "time on the platform" windows. A teen who joined 4 days ago is in
// both "First 7 days" and "First 30 days" (not "New"). "All" bypasses.
export type TenureBucket = "all" | "new" | "first-7" | "first-30";

export const TENURE_FILTERS: { id: TenureBucket; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "first-7", label: "First 7 days" },
  { id: "first-30", label: "First 30 days" },
];

export function inTenureBucket(joinedDaysAgo: number, bucket: TenureBucket): boolean {
  switch (bucket) {
    case "new":
      return joinedDaysAgo <= 2;
    case "first-7":
      return joinedDaysAgo <= 7;
    case "first-30":
      return joinedDaysAgo <= 30;
    default:
      return true;
  }
}

/** Compact join recency — "Today" / "Yesterday" / "N days ago" / "N weeks ago". */
export function relJoined(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}


// ─── ONLINE PRESENCE ────────────────────────────────────────────────────────
//
// TODO-DATA: THIS DOES NOT EXIST UPSTREAM. Audited the codebase for presence —
// every "online" in it refers to first-message LANES (online/offline copy) or to
// availability HOURS, neither of which is "is this person here right now".
//
// So this is a fixture set, and deliberately a small one. It is NOT derived from
// message recency: "messaged today" is not "online now", and a green dot on a
// teen who isn't there is a claim a mentor could act on.
//
// PRESENCE IS NOT STANDING. A paused teen can be online; an active one can be
// offline. Standing is the word-chip beside the role badge; this is the dot on
// the avatar, and the two must never be read as the same fact.
