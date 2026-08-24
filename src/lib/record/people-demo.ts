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
  name: string;
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
   *  state is DERIVED from the two stamps above, never stored. */
  escalation?: { reason: string; daysAgo: number };
  /** Video calls in the last 30 days — a care signal, not an absence metric. */
  videoCount30d?: number;
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
    id: "t1", name: "Nick Casparro", pronouns: "he/him", phone: "+17078892558",
    group: "North Carolina", active: true, joinedDaysAgo: 1, mentorId: "m1",
    matchedDaysAgo: 1, mentorLastSentDaysAgo: 0, menteeLastSentDaysAgo: 1,
    videoCount30d: 0,
  },
  {
    id: "t2", name: "Patricia Johnson", goesBy: "Pat", pronouns: "she/her", phone: "+19089101254",
    group: "New Jersey", active: true, joinedDaysAgo: 4, mentorId: "m2",
    matchedDaysAgo: 2, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 0,
    videoCount30d: 1,
  },
  {
    // Teen wrote 6d ago and the mentor hasn't replied → waiting-on-mentor.
    id: "t3", name: "Amy Hashing", pronouns: "she/her", phone: "+19089101035",
    group: "North Carolina", active: true, menteeState: "paused", joinedDaysAgo: 12, mentorId: "m1",
    matchedDaysAgo: 7, mentorLastSentDaysAgo: 7, menteeLastSentDaysAgo: 6,
    videoCount30d: 0,
  },
  {
    id: "t4", name: "John Kneeland", pronouns: "he/him", phone: "+12158805908",
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
    id: "t5", name: "Marcus Lee", goesBy: "Marc", pronouns: "he/him", phone: "+13125550210",
    group: "Illinois", active: true, joinedDaysAgo: 2, mentorId: "m3",
    matchedDaysAgo: 2, mentorLastSentDaysAgo: 0, menteeLastSentDaysAgo: 0,
    videoCount30d: 0,
  },
  {
    id: "t6", name: "Sofia Ramos", pronouns: "she/her", phone: "+19735550267",
    group: "New Jersey", active: true, menteeState: "paused", joinedDaysAgo: 25, mentorId: "m2",
    matchedDaysAgo: 14, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 1,
    videoCount30d: 2,
  },
  {
    id: "t7", name: "Ethan Park", pronouns: "he/him", phone: "+17078893390",
    group: "North Carolina", active: true, joinedDaysAgo: 6, mentorId: "m4",
    matchedDaysAgo: 3, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 2,
    videoCount30d: 1,
  },
  {
    // Mentor replied, teen has been quiet 9 days → teen-quiet.
    id: "t8", name: "Zoe Bennett", pronouns: "she/her", phone: "+19089104412",
    group: "North Carolina", active: true, joinedDaysAgo: 55, mentorId: "m1",
    matchedDaysAgo: 34, mentorLastSentDaysAgo: 3, menteeLastSentDaysAgo: 9,
    videoCount30d: 1,
  },
  {
    id: "t9", name: "Liam Foster", pronouns: "he/him", phone: "+19735550318",
    group: "New Jersey", active: true, joinedDaysAgo: 18, mentorId: "m4",
    matchedDaysAgo: 14, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 1,
    videoCount30d: 3,
    // Names the observable cause, not a prediction about the teen.
    escalation: { reason: "Asked about changing schools mid-year", daysAgo: 3 },
  },
  {
    id: "t10", name: "Ava Mitchell", pronouns: "she/her", phone: "+13125550344",
    group: "Illinois", active: true, joinedDaysAgo: 3, mentorId: "m5",
    matchedDaysAgo: 2, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 0,
    videoCount30d: 0,
  },
  {
    id: "t11", name: "Noah Diaz", pronouns: "he/him", phone: "+17078895501",
    group: "North Carolina", active: true, menteeState: "paused", joinedDaysAgo: 9, mentorId: "m2",
    matchedDaysAgo: 3, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 3,
    videoCount30d: 1,
  },
  {
    id: "t12", name: "Mia Chen", pronouns: "she/her", phone: "+19089108833",
    group: "New Jersey", active: true, joinedDaysAgo: 70, mentorId: "m6",
    matchedDaysAgo: 40, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 2,
    videoCount30d: 4,
    pastMentors: [{ mentorId: "m4", range: "Dec 2024 – Feb 2025" }],
  },

  // ── The live mentor's mentees ──────────────────────────────────────────
  {
    id: "t13", name: "Jordan Tate", goesBy: "Jordy", pronouns: "they/them", phone: "+19089102201",
    group: "North Carolina", active: true, joinedDaysAgo: 122, mentorId: "live",
    matchedDaysAgo: 118, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 2,
    videoCount30d: 0,
    pastMentors: [{ mentorId: "m5", range: "Feb 2025 – Apr 2025" }],
  },
  {
    id: "t14", name: "Sam Karim", pronouns: "he/him", phone: "+13125550788",
    group: "Illinois", active: true, menteeState: "paused", joinedDaysAgo: 15, mentorId: "live",
    matchedDaysAgo: 7, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 0,
    videoCount30d: 3, // video-comfort: low chat volume may be video, not absence
  },
  {
    id: "t15", name: "Riley Moss", pronouns: "she/her", phone: "+17078894102",
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
    id: "t17", name: "Naomi Reed", pronouns: "she/her", phone: "+19089107000",
    group: "North Carolina", active: true, joinedDaysAgo: 210, mentorId: "live",
    matchedDaysAgo: 196, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 1,
    videoCount30d: 0,
  },
  {
    id: "t18", name: "Caleb Ortiz", pronouns: "he/him", phone: "+19089107001",
    group: "North Carolina", active: true, joinedDaysAgo: 188, mentorId: "live",
    matchedDaysAgo: 171, mentorLastSentDaysAgo: 3, menteeLastSentDaysAgo: 2,
    videoCount30d: 1,
  },
  {
    id: "t19", name: "Simone Ba", pronouns: "she/her", phone: "+19089107002",
    group: "North Carolina", active: true, joinedDaysAgo: 176, mentorId: "live",
    matchedDaysAgo: 160, mentorLastSentDaysAgo: 4, menteeLastSentDaysAgo: 3,
    videoCount30d: 2,
  },
  {
    id: "t20", name: "Theo Lindqvist", pronouns: "he/him", phone: "+19089107003",
    group: "North Carolina", active: true, joinedDaysAgo: 165, mentorId: "live",
    matchedDaysAgo: 149, mentorLastSentDaysAgo: 5, menteeLastSentDaysAgo: 4,
    videoCount30d: 0,
  },
  {
    id: "t21", name: "Imani Clarke", pronouns: "she/her", phone: "+19089107004",
    group: "North Carolina", active: true, joinedDaysAgo: 151, mentorId: "live",
    matchedDaysAgo: 140, mentorLastSentDaysAgo: 6, menteeLastSentDaysAgo: 1,
    videoCount30d: 1,
  },
  {
    id: "t22", name: "Ravi Menon", pronouns: "he/him", phone: "+19089107005",
    group: "North Carolina", active: true, joinedDaysAgo: 143, mentorId: "live",
    matchedDaysAgo: 128, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 2,
    videoCount30d: 2,
  },
  {
    id: "t23", name: "Elena Duarte", pronouns: "she/her", phone: "+19089107006",
    group: "North Carolina", active: true, joinedDaysAgo: 134, mentorId: "live",
    matchedDaysAgo: 119, mentorLastSentDaysAgo: 3, menteeLastSentDaysAgo: 3,
    videoCount30d: 0,
  },
  {
    id: "t24", name: "Jonah Whitfield", pronouns: "he/him", phone: "+19089107007",
    group: "North Carolina", active: true, joinedDaysAgo: 121, mentorId: "live",
    matchedDaysAgo: 108, mentorLastSentDaysAgo: 4, menteeLastSentDaysAgo: 4,
    videoCount30d: 1,
  },
  {
    id: "t25", name: "Yuki Tanaka", pronouns: "they/them", phone: "+19089107008",
    group: "North Carolina", active: true, joinedDaysAgo: 112, mentorId: "live",
    matchedDaysAgo: 97, mentorLastSentDaysAgo: 5, menteeLastSentDaysAgo: 1,
    videoCount30d: 2,
  },
  {
    id: "t26", name: "Marisol Vega", pronouns: "she/her", phone: "+19089107009",
    group: "North Carolina", active: true, joinedDaysAgo: 103, mentorId: "live",
    matchedDaysAgo: 90, mentorLastSentDaysAgo: 6, menteeLastSentDaysAgo: 2,
    videoCount30d: 0,
  },
  {
    id: "t16", name: "Alex Petrov", pronouns: "he/him", phone: "+19735550655",
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
const ONLINE_NOW = new Set([
  "live", // the viewer is, by definition, in the app
  "t13",
  "t15",
  "t21",
  "m2",
  "s-brandy",
]);

/** Is this person online right now? Offline renders NOTHING — presence is an
 *  exception worth noticing, not a label on everyone. */
export function isOnlineNow(personId: string): boolean {
  return ONLINE_NOW.has(personId);
}
