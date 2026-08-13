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

import type { MentorLifecycleStatus } from "@/lib/types";

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
   *  Contact menu shows Chat / Call / Copy number only. */
  email?: string;
  group: string;
  active: boolean;
  /** Days since the teen joined the platform — drives the tenure buckets. */
  joinedDaysAgo: number;
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
  { id: "m1", name: "John Smith", phone: "+19089101133", email: "john.smith@example.com", group: "Illinois, North Carolina", status: "in-training", capacity: 5, leadId: "s-brandy" },
  { id: "m2", name: "Maria Lopez", phone: "+17079923410", email: "maria.lopez@example.com", group: "New Jersey", status: "active", accepting: true, capacity: 4, leadId: "s-brandy" },
  { id: "m3", name: "Devon Clark", phone: "+13125550172", email: "devon.clark@example.com", group: "Illinois", status: "active", accepting: true, capacity: 3, leadId: "s-brandy" },
  { id: "m4", name: "Aisha Bello", phone: "+17078894521", email: "aisha.bello@example.com", group: "North Carolina", status: "active", accepting: false, capacity: 4, leadId: "s-omar" },
  // m5 intentionally has no email — the Contact menu skips Email/Copy-email.
  { id: "m5", name: "Tomás Rivera", phone: "+19735550143", group: "New Jersey", status: "paused", capacity: 2, leadId: "s-omar" },
  { id: "m6", name: "Priya Nair", phone: "+13125550188", email: "priya.nair@example.com", group: "Illinois", status: "in-training", capacity: 3, leadId: "s-omar" },
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

// t13–t16 are matched to the store-backed mentor ("live") and carry the full
// relationship detail, so the record's mentee table renders real people instead
// of the old parallel DemoMentee fixture. Between them they exercise all four
// recency states: mentor-replied · mentee-wrote · waiting-on-mentor · teen-quiet.
export const DEMO_TEENS: DemoTeen[] = [
  { id: "t1", name: "Nick Casparro", phone: "+17078892558", group: "North Carolina", active: true, joinedDaysAgo: 1, mentorId: "m1" },
  { id: "t2", name: "Patricia Johnson", phone: "+19089101254", group: "New Jersey", active: true, joinedDaysAgo: 4, mentorId: "m2" },
  { id: "t3", name: "Amy Hashing", phone: "+19089101035", group: "North Carolina", active: true, joinedDaysAgo: 12, mentorId: "m1" },
  { id: "t4", name: "John Kneeland", phone: "+12158805908", group: "Illinois", active: false, joinedDaysAgo: 40, mentorId: "m3" },
  { id: "t5", name: "Marcus Lee", goesBy: "Marc", phone: "+13125550210", group: "Illinois", active: true, joinedDaysAgo: 2, mentorId: "m3" },
  { id: "t6", name: "Sofia Ramos", phone: "+19735550267", group: "New Jersey", active: true, joinedDaysAgo: 25, mentorId: "m2" },
  { id: "t7", name: "Ethan Park", phone: "+17078893390", group: "North Carolina", active: true, joinedDaysAgo: 6, mentorId: "m4" },
  { id: "t8", name: "Zoe Bennett", phone: "+19089104412", group: "North Carolina", active: true, joinedDaysAgo: 55, mentorId: "m1" },
  { id: "t9", name: "Liam Foster", phone: "+19735550318", group: "New Jersey", active: true, joinedDaysAgo: 18, mentorId: "m4" },
  { id: "t10", name: "Ava Mitchell", phone: "+13125550344", group: "Illinois", active: true, joinedDaysAgo: 3, mentorId: "m5" },
  { id: "t11", name: "Noah Diaz", phone: "+17078895501", group: "North Carolina", active: true, joinedDaysAgo: 9, mentorId: "m2" },
  { id: "t12", name: "Mia Chen", phone: "+19089108833", group: "New Jersey", active: true, joinedDaysAgo: 70, mentorId: "m6" },

  // ── The live mentor's mentees ──────────────────────────────────────────
  {
    id: "t13", name: "Jordan Tate", goesBy: "Jordy", phone: "+19089102201",
    group: "North Carolina", active: true, joinedDaysAgo: 122, mentorId: "live",
    matchedDaysAgo: 122, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 2,
    videoCount30d: 0,
    pastMentors: [{ mentorId: "m5", range: "Feb 2025 – Apr 2025" }],
  },
  {
    id: "t14", name: "Sam Karim", phone: "+13125550788",
    group: "Illinois", active: true, joinedDaysAgo: 15, mentorId: "live",
    matchedDaysAgo: 15, mentorLastSentDaysAgo: 1, menteeLastSentDaysAgo: 0,
    videoCount30d: 3, // video-comfort: low chat volume may be video, not absence
  },
  {
    id: "t15", name: "Riley Moss", phone: "+17078894102",
    group: "North Carolina", active: true, joinedDaysAgo: 44, mentorId: "live",
    // Teen wrote 5d ago, mentor hasn't replied → derived waiting-on-mentor.
    matchedDaysAgo: 44, mentorLastSentDaysAgo: 6, menteeLastSentDaysAgo: 5,
    videoCount30d: 0,
    pastMentors: [{ mentorId: "m2", range: "Jun 2025 – Sep 2025" }],
  },
  {
    id: "t16", name: "Alex Petrov", phone: "+19735550655",
    group: "New Jersey", active: false, joinedDaysAgo: 92, mentorId: "live",
    // Mentor replied, but the teen has been quiet 9 days → teen-quiet.
    matchedDaysAgo: 92, mentorLastSentDaysAgo: 2, menteeLastSentDaysAgo: 9,
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
