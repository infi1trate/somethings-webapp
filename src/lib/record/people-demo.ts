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
}

// Lifecycle assigned per the strict migration mapping (incomplete → in-training,
// active → active, inactive → paused). Guided + Deactivated are not force-fit
// onto demo rows — see the /dev states matrix (and the live mentor can be
// deactivated). `accepting` is the availability intent (default true).
export const DEMO_MENTORS: DemoMentorRow[] = [
  { id: "m1", name: "John Smith", phone: "+19089101133", email: "john.smith@example.com", group: "Illinois, North Carolina", status: "in-training", capacity: 5 },
  { id: "m2", name: "Maria Lopez", phone: "+17079923410", email: "maria.lopez@example.com", group: "New Jersey", status: "active", accepting: true, capacity: 4 },
  { id: "m3", name: "Devon Clark", phone: "+13125550172", email: "devon.clark@example.com", group: "Illinois", status: "active", accepting: true, capacity: 3 },
  { id: "m4", name: "Aisha Bello", phone: "+17078894521", email: "aisha.bello@example.com", group: "North Carolina", status: "active", accepting: false, capacity: 4 },
  // m5 intentionally has no email — the Contact menu skips Email/Copy-email.
  { id: "m5", name: "Tomás Rivera", phone: "+19735550143", group: "New Jersey", status: "paused", capacity: 2 },
  { id: "m6", name: "Priya Nair", phone: "+13125550188", email: "priya.nair@example.com", group: "Illinois", status: "in-training", capacity: 3 },
];

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
];

// The lead mentor's "umbrella": the mentors they oversee. Their teens are the
// teens matched with those mentors. (The lead persona is Brandy Forrestor.)
export const LEAD_UMBRELLA_MENTOR_IDS = ["m1", "m2", "m3"];

export function leadUmbrellaMentors(): DemoMentorRow[] {
  return DEMO_MENTORS.filter((m) => LEAD_UMBRELLA_MENTOR_IDS.includes(m.id));
}

export function leadUmbrellaTeens(): DemoTeen[] {
  return DEMO_TEENS.filter((t) => LEAD_UMBRELLA_MENTOR_IDS.includes(t.mentorId));
}

export function teensForMentor(mentorId: string): DemoTeen[] {
  return DEMO_TEENS.filter((t) => t.mentorId === mentorId);
}

export function mentorName(mentorId: string): string {
  return DEMO_MENTORS.find((m) => m.id === mentorId)?.name ?? "—";
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
