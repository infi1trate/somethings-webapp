// ═══════════════════════════════════════════════════════════════════════════
// WHO SUPPORT CAN REACH (SUP-3)
//
// Four sections, in the pack's order: Supervisors, Cohorts, Groups, Other.
//
// ═══ SUPERVISORS IS REAL; THE OTHER THREE ARE PLACEHOLDERS (answered) ═══
// "Placeholder data is fine" for Cohorts / Groups / Other. Supervisors reads
// the fixtures that already exist, per persona:
//   · a mentor — the two support contacts the chat fixture already carries
//     (`SUPPORT_IDS`: their lead mentor and their supervisor), with the same
//     preview, time and unread count the chat list shows, so the two places
//     agree until SUP-5 retires the second one
//   · a lead mentor — their own `supervisorId` (Stephen Rowe)
//   · a supervisor — nobody: the fixtures give Stephen Rowe no `supervisorId`
//     (Dr. Nissan is the clinical authority, not an assigned supervisor), so
//     this is the section's empty state
//   · an admin — nobody, in no cohort or group either: the panel's first run
// Cohorts are mentor cohorts, so staff (lead mentors, supervisors) have none
// and see that section's empty state. Placeholders, chosen so every state the
// pack lists is reachable from the persona switcher.
// The section is "Supervisors" and a mentor's list holds a LEAD mentor in it:
// the 1:1 escalation path is who a mentor asks, whatever their title (flagged).
//
// ═══ PRESENCE IS A PLACEHOLDER ═══ Nothing in the fixtures says who is
// online. It is fixed per person here and named as such.

import { chatScenario } from "@/lib/chat/seed";
import { DEMO_PEOPLE } from "@/lib/record/people-demo";
import type { Persona } from "@/lib/types";

export type SupportSectionId = "supervisors" | "cohorts" | "groups" | "other";

export interface SupportRow {
  id: string;
  name: string;
  /** How the composer and empty state address them, when a first word of
   *  `name` would not do (an unnamed mentor is "the mentor"). */
  shortName?: string;
  /** People have presence; a cohort or group does not. */
  presence?: "online" | "offline";
  /** Empty when nothing has been said yet. */
  preview: string;
  previewFromViewer: boolean;
  /** Last activity; null with no messages. */
  at: number | null;
  unread: number;
}

export interface SupportSection {
  id: SupportSectionId;
  label: string;
  /** What the section says when it has no rows — never a blank region. */
  empty: string;
  rows: SupportRow[];
}

/** TODO-COPY, all four. */
export const SECTION_LABEL: Record<SupportSectionId, string> = {
  supervisors: "Supervisors",
  cohorts: "Cohorts",
  groups: "Groups",
  other: "Other",
};
const SECTION_EMPTY: Record<SupportSectionId, string> = {
  supervisors: "No supervisors assigned yet.",
  cohorts: "You're not in a cohort yet.",
  groups: "You're not in any groups yet.",
  other: "Nothing here yet.",
};
export const SECTION_ORDER: readonly SupportSectionId[] = ["supervisors", "cohorts", "groups", "other"];

/** PLACEHOLDER presence. */
const ONLINE = new Set(["s-brandy"]);

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** PLACEHOLDER rows (answered: placeholder data is fine). TODO-COPY on every
 *  name and preview. The ages are spread so every rung of the timestamp ladder
 *  is on screen in the default fixture: minutes, hours, days, a date, a year. */
function placeholders(now: number): Record<"cohorts" | "groups" | "other", SupportRow[]> {
  const row = (id: string, name: string, preview: string, ago: number, unread = 0): SupportRow => ({
    id,
    name,
    preview,
    previewFromViewer: false,
    at: now - ago,
    unread,
  });
  return {
    cohorts: [
      row("c-fall-26", "Fall 2026 cohort", "The orientation recording is up in Resources.", 3 * HOUR, 2),
      row("c-spring-26", "Spring 2026 cohort", "Thanks, everyone. See you at the next check-in.", 9 * DAY),
    ],
    groups: [
      row("g-nj", "New Jersey mentors", "Anyone have a good opener for a first call?", 2 * DAY, 1),
      row("g-il", "Illinois mentors", "Meetup notes are pinned at the top.", 243 * DAY),
    ],
    other: [
      row("o-help", "Tech help", "Reply here if the app is acting up.", 20 * MIN),
      row("o-team", "Somethings team", "Welcome to Somethings!", 400 * DAY),
    ],
  };
}

function supervisorsFor(persona: Persona, chatScenarioId: string, now: number): SupportRow[] {
  if (persona === "admin") return [];
  if (persona === "mentor" || persona === "new-mentor") {
    return chatScenario(chatScenarioId, now)
      .threads.filter((t) => t.kind === "support")
      .map((t) => ({
        id: t.id,
        name: t.displayName,
        presence: ONLINE.has(t.id) ? "online" : "offline",
        preview: t.preview,
        previewFromViewer: t.previewFromMentor,
        at: t.lastActivityAt || null,
        unread: t.unreadCount,
      }));
  }
  if (persona !== "lead-mentor") return [];
  const id = DEMO_PEOPLE.find((x) => x.id === "s-brandy")?.supervisorId ?? "s-stephen";
  const p = DEMO_PEOPLE.find((x) => x.id === id);
  return p
    ? [{ id, name: p.name, presence: ONLINE.has(id) ? "online" : "offline", preview: "", previewFromViewer: false, at: null, unread: 0 }]
    : [];
}

export function supportDirectory(persona: Persona, chatScenarioId: string, now: number): SupportSection[] {
  const all = placeholders(now);
  const ph =
    persona === "admin"
      ? { cohorts: [], groups: [], other: [] }
      : persona === "mentor" || persona === "new-mentor"
        ? all
        : { ...all, cohorts: [] };
  const rows: Record<SupportSectionId, SupportRow[]> = {
    supervisors: supervisorsFor(persona, chatScenarioId, now),
    ...ph,
  };
  return SECTION_ORDER.map((id) => ({ id, label: SECTION_LABEL[id], empty: SECTION_EMPTY[id], rows: rows[id] }));
}

/** The panel's first run: nobody to reach in any section. */
export function isFirstRun(sections: SupportSection[]): boolean {
  return sections.every((s) => s.rows.length === 0);
}
