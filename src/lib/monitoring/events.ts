// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — EVENTS (Monitoring v2, Part A)
//
// ═══ WHY ═══ Escalations and risk flags lost their dashboards when they
// folded into Monitoring. They are still EVENTS — with flows and documents —
// and they are the inputs that produced every tier placement on the Watch
// tab. Clinical ops need to navigate them as events: every escalation in the
// last 30 days, who confirmed it, how fast, how it closed. This is that audit
// view's one source.
//
// ═══ ONE STORE ═══ Derived, at read time, from what the Watch tab and the
// per-teen timeline already read: `useTiering` (the tier log and every
// escalation record) plus the roster's per-teen flag signals. Nothing here
// is stored, so the Events tab cannot disagree with the Watch tab.
//
// ═══ WHAT IS SEEDED, AND SAYS SO ═══ Two things have no upstream yet:
//   · FLAGS are per-teen COUNTS in the roster (`SIGNALS`), not events. They
//     are expanded here into one event per flag, spread deterministically
//     over the signal's window.
//   · REVIEWS & NOTES (the 7-day update note, the placement note) are not
//     modelled anywhere. They are seeded from the tier cadence, and their
//     document fields are null — "fields TBD" on screen.
// Plus ~40 generated events over 90 days on the roster's generated teens, so
// the range filters mean something.
//
// NAMED "EVENTS", NOT "ACTIVITY" (answered: "go" on the context report).
// `/app/activity` is the Activity ledger behind the top-bar bell — a
// different feed, on its own fixture cast, and a second "Activity" would
// collide with it.

import type { EscalationState } from "@/lib/chat/types";
import { DEMO_PEOPLE } from "@/lib/record/people-demo";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import type { TierActor, TierEvent } from "@/lib/tiering/events";
import { CRISIS_SECTION_LABEL, crisisSections, escalationTarget, sectionDone } from "@/lib/tiering/escalation";
import { PLATFORM, T1_RESPONSE_SECONDS, type Tier } from "@/lib/tiering/tiers";

export type MonitoringEventKind = "escalation" | "flag" | "tier_change" | "note";
export type MonitoringEventState = "open" | "confirmed" | "closed" | "recorded";

export interface MonitoringDocument {
  title: string;
  /** Null when the document's fields are not defined yet — "fields TBD". */
  fields: { label: string; value: string }[] | null;
}

export interface MonitoringEvent {
  id: string;
  at: number;
  kind: MonitoringEventKind;
  teenId: string;
  teenName: string;
  /** A record teen has one; a generated roster row does not. */
  recordId?: string;
  mentorId: string;
  mentorName: string;
  supervisorId?: string;
  supervisorName?: string;
  /** The tier this event is about — for the tier filter. */
  tier?: Tier;
  fromTier?: Tier;
  toTier?: Tier;
  /** One line. TODO-COPY. */
  detail: string;
  state: MonitoringEventState;
  responseSeconds?: number;
  documentId?: string;
  document?: MonitoringDocument;
  /** Tier changes: an entry in an append-only log, never edited. */
  immutable: boolean;
  /** Immutable entries: the audit lozenge's word (the log event's kind). */
  auditLabel?: string;
  /* Escalation audit fields, for the CSV. */
  flaggedAt?: number;
  confirmedAt?: number;
  closedAt?: number;
  /** Flag only: part of a surge pattern. */
  surge?: boolean;
  /** Escalation only: the escalation is still open (links to the live timeline). */
  live?: boolean;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "0:48" under an hour, "2h 14m" above it. */
export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "Sarah R." — the roster's short form. */
export const shortName = (name: string) => {
  const [a, b] = name.split(" ");
  return b ? `${a} ${b[0]}.` : a;
};

const staff = (id: string) => DEMO_PEOPLE.find((p) => p.id === id);

export interface EventSources {
  roster: MonitoringTeen[];
  eventsFor: (teenId: string) => TierEvent[];
  escalationsFor: (teenId: string) => EscalationState[];
  nameOf: (a: TierActor) => string;
  now: number;
}

/* ── ESCALATIONS, from the records ──────────────────────────────────────── */

function escalationEvent(e: EscalationState, teen: MonitoringTeen, s: EventSources): MonitoringEvent {
  const target = escalationTarget(e);
  const log = s.eventsFor(teen.recordId!).filter((x) => x.escalationId === e.id);
  const setter = log.find((x) => x.kind === "confirmed" || x.kind === "placed" || x.kind === "stepped-down");
  const supervisor = setter ? s.nameOf(setter.actor) : staff(e.supervisorId)?.name;
  const supShort = supervisor ? shortName(supervisor) : undefined;
  const confirmedAt = e.confirmedAt ?? setter?.at;
  const responseMs = e.meta?.timeToConfirmMs ?? (confirmedAt ? confirmedAt - e.openedAt : undefined);
  const stepDown = log.filter((x) => x.kind === "stepped-down").at(-1);
  const closedTier = stepDown?.tier ?? (e.outcome?.id === "tier_update" ? e.confirmedTier : undefined);
  const mentor = teen.mentor;
  const raised = target === PLATFORM ? "Platform concern" : `Flagged Tier ${target}`;
  const parts = [`${raised} by ${mentor}`];
  if (e.confirmedTier !== undefined && responseMs !== undefined) parts.push(`confirmed Tier ${e.confirmedTier}${supShort ? ` by ${supShort}` : ""} in ${duration(responseMs)}`);
  if (e.resolvedAt !== null) parts.push(`closed${closedTier ? ` → Tier ${closedTier}` : ""}, ${duration(e.resolvedAt - e.openedAt)}`);
  else if (e.confirmedTier === undefined) {
    const left = T1_RESPONSE_SECONDS * 1000 - (s.now - e.openedAt);
    parts.splice(0, 1, "Open · unconfirmed", left > 0 ? `${duration(left)} left` : `${duration(s.now - e.openedAt)} waiting`);
  } else parts.push("open");
  const note = e.crisisNote;
  const tier = e.confirmedTier ?? (target === PLATFORM ? undefined : target);
  return {
    id: `ev-esc-${e.id}`,
    at: e.openedAt,
    kind: "escalation",
    teenId: teen.id,
    teenName: teen.teen,
    recordId: teen.recordId,
    mentorId: teen.mentor,
    mentorName: mentor,
    supervisorId: setter?.actor.id ?? e.supervisorId,
    supervisorName: supShort,
    tier,
    fromTier: setter?.fromTier ?? undefined,
    toTier: closedTier,
    detail: parts.join(" · "),
    state: e.resolvedAt !== null ? "closed" : e.confirmedTier !== undefined ? "confirmed" : "open",
    responseSeconds: responseMs !== undefined ? Math.round(responseMs / 1000) : undefined,
    documentId: note ? `doc-crisis-${e.id}` : undefined,
    document:
      tier !== undefined && note
        ? {
            title: "Crisis note",
            fields: crisisSections(tier)
              .filter((id) => sectionDone(note, id))
              .map((id) => ({ label: CRISIS_SECTION_LABEL[id], value: sectionValue(note, id) ?? "" })),
          }
        : target === PLATFORM
          ? { title: "Platform concern report", fields: [{ label: "Report", value: e.contextNote ?? "" }] }
          : undefined,
    immutable: false,
    flaggedAt: e.openedAt,
    confirmedAt,
    closedAt: e.resolvedAt ?? undefined,
    live: e.resolvedAt === null,
  };
}

function sectionValue(note: NonNullable<EscalationState["crisisNote"]>, id: keyof typeof CRISIS_SECTION_LABEL): string | undefined {
  switch (id) {
    case "subtype":
      return [note.subtype, ...(note.tags ?? [])].filter(Boolean).join(" · ").replace(/_/g, " ");
    case "safety-plan":
      return note.safetyPlan ? `${note.safetyPlan.status}${note.safetyPlan.usage ? ` · ${note.safetyPlan.usage}` : ""}` : "";
    case "resources":
      return note.resources?.shared ? note.resources.list : "None shared";
    case "referral":
      return note.referral?.made ? note.referral.list.join(", ").replace(/_/g, " ") : "No referral";
    case "emergency":
      return [note.contact?.engaged ? "Contact engaged" : "Contact not engaged", note.services?.contacted ? note.services.which.join(", ").replace(/_/g, " ") : "No services"].join(" · ");
  }
}

/* ── TIER CHANGES, from the log — immutable ─────────────────────────────── */

const TIER_DOC: Partial<Record<TierEvent["kind"], string>> = {
  placed: "Placement note",
  confirmed: "Placement note",
  "stepped-down": "Update note",
};

function tierChangeEvent(t: TierEvent, teen: MonitoringTeen, s: EventSources): MonitoringEvent {
  const who = shortName(s.nameOf(t.actor));
  const doc = TIER_DOC[t.kind] ?? "Tier note";
  const move = t.fromTier !== null ? `T${t.fromTier} → T${t.tier}` : `Placed T${t.tier}`;
  return {
    id: `ev-tier-${t.id}`,
    at: t.at,
    kind: "tier_change",
    teenId: teen.id,
    teenName: teen.teen,
    recordId: teen.recordId,
    mentorId: teen.mentor,
    mentorName: teen.mentor,
    supervisorId: t.actor.id,
    supervisorName: who,
    tier: t.tier,
    fromTier: t.fromTier ?? undefined,
    toTier: t.tier,
    detail: `${move} · ${doc.toLowerCase()} · ${who}`,
    state: "recorded",
    documentId: `doc-tier-${t.id}`,
    document: { title: doc, fields: [{ label: "Reason", value: t.reason }] },
    immutable: true,
    auditLabel: t.kind === "stepped-down" ? "Stepped down" : t.kind === "confirmed" ? "Confirmed" : "Placed",
  };
}

/* ── FLAGS, expanded from the roster's counts ───────────────────────────── */

const WINDOW_MS: Record<string, number> = { "24h": DAY, "48h": 2 * DAY, "3d": 3 * DAY, "7d": 7 * DAY, "30d": 30 * DAY };
/** What the flags were about — fixture, like the counts. TODO-DATA. */
const FLAG_TOPIC: Record<string, string> = {
  t13: "not safe tonight",
  t15: "skipping meals",
  t19: "withdrawing from friends",
  t21: "hopelessness",
  t17: "sleep",
};

function flagEvents(teen: MonitoringTeen, s: EventSources): MonitoringEvent[] {
  const { count, window, trigger } = teen.riskFlags;
  if (!count || !window) return [];
  const span = WINDOW_MS[window] ?? 7 * DAY;
  const topic = FLAG_TOPIC[teen.recordId ?? ""] ?? "language the classifier flagged";
  const pattern =
    trigger === "surge" ? `Surge · ${count} flags in ${window}` : trigger === "slow-burn" ? `Slow-burn · ${count} flags over ${window}` : `${count} flag${count === 1 ? "" : "s"} in ${window}`;
  return Array.from({ length: count }, (_, i) => ({
    id: `ev-flag-${teen.id}-${i}`,
    /* Spread across the window, newest first, deterministic. */
    at: s.now - Math.round(((i + 0.5) / count) * span),
    kind: "flag" as const,
    teenId: teen.id,
    teenName: teen.teen,
    recordId: teen.recordId,
    mentorId: teen.mentor,
    mentorName: teen.mentor,
    tier: teen.tier,
    detail: `${pattern} · ${topic}`,
    state: "recorded" as const,
    immutable: false,
    surge: trigger === "surge",
  }));
}

/* ── NOTES, seeded from the cadence — fields TBD ────────────────────────── */

const SUPERVISOR_IDS = ["s-stephen", "s-nissan", "s-brandy", "s-omar"];

function noteEvents(teen: MonitoringTeen, s: EventSources, i: number): MonitoringEvent[] {
  if (teen.tier !== 2 && teen.tier !== 3) return [];
  const sup = shortName(staff(SUPERVISOR_IDS[i % SUPERVISOR_IDS.length])?.name ?? "A supervisor");
  /* Tier 2 checks in daily, Tier 3 weekly: one update note per cadence. */
  const every = teen.tier === 2 ? DAY : 7 * DAY;
  const title = teen.tier === 2 ? "Daily check-in note" : "7-day update note";
  return [0, 1].map((n) => ({
    id: `ev-note-${teen.id}-${n}`,
    at: s.now - (n + 1) * every + (i % 5) * HOUR,
    kind: "note" as const,
    teenId: teen.id,
    teenName: teen.teen,
    recordId: teen.recordId,
    mentorId: teen.mentor,
    mentorName: teen.mentor,
    supervisorName: sup,
    tier: teen.tier,
    detail: `${title} · ${teen.mentor} · ${sup}`,
    state: "recorded" as const,
    documentId: `doc-note-${teen.id}-${n}`,
    document: { title, fields: null },
    immutable: false,
  }));
}

/* ── THE GENERATED 90 DAYS, on the generated teens ──────────────────────── */

function seeded(seed: number) {
  let v = seed;
  return () => {
    v = (v * 1664525 + 1013904223) % 4294967296;
    return v / 4294967296;
  };
}

function generatedEvents(teens: MonitoringTeen[], s: EventSources): MonitoringEvent[] {
  const pool = teens.filter((t) => !t.recordId);
  if (pool.length === 0) return [];
  const rnd = seeded(20261022);
  const sups = SUPERVISOR_IDS.map((id) => shortName(staff(id)?.name ?? "A supervisor"));
  const out: MonitoringEvent[] = [];
  for (let i = 0; i < 40; i++) {
    const teen = pool[Math.floor(rnd() * pool.length)];
    const at = s.now - Math.round((2 + rnd() * 88) * DAY);
    const sup = sups[Math.floor(rnd() * sups.length)];
    const roll = rnd();
    const base = { teenId: teen.id, teenName: teen.teen, mentorId: teen.mentor, mentorName: teen.mentor, supervisorName: sup };
    if (roll < 0.22) {
      /* A closed escalation: raised at 2 or 3, confirmed, stepped down. */
      const req: Tier = rnd() < 0.3 ? 1 : 2;
      const resp = Math.round((20 + rnd() * 600) * 1000);
      const open = Math.round((1 + rnd() * 40) * HOUR);
      out.push({
        ...base,
        id: `ev-gen-esc-${i}`,
        at,
        kind: "escalation",
        tier: req,
        fromTier: 4,
        toTier: 3,
        detail: `Flagged Tier ${req} by ${teen.mentor} · confirmed Tier ${req} by ${sup} in ${duration(resp)} · closed → Tier 3, ${duration(open)}`,
        state: "closed",
        responseSeconds: Math.round(resp / 1000),
        documentId: `doc-gen-${i}`,
        document: { title: "Crisis note", fields: null },
        immutable: false,
        flaggedAt: at,
        confirmedAt: at + resp,
        closedAt: at + open,
      });
    } else if (roll < 0.55) {
      const surge = rnd() < 0.3;
      out.push({ ...base, id: `ev-gen-flag-${i}`, at, kind: "flag", tier: teen.tier, detail: surge ? "Surge · 3 flags in 48h · conflict at home" : "1 flag · school stress", state: "recorded", immutable: false, surge, supervisorName: undefined });
    } else if (roll < 0.78) {
      out.push({ ...base, id: `ev-gen-tier-${i}`, at, kind: "tier_change", tier: 4, fromTier: 3, toTier: 4, detail: `T3 → T4 · update note · ${sup}`, state: "recorded", documentId: `doc-gen-${i}`, document: { title: "Update note", fields: null }, immutable: true, auditLabel: "Stepped down" });
    } else {
      out.push({ ...base, id: `ev-gen-note-${i}`, at, kind: "note", tier: 3, detail: `7-day update note · ${teen.mentor} · ${sup}`, state: "recorded", documentId: `doc-gen-${i}`, document: { title: "7-day update note", fields: null }, immutable: false });
    }
  }
  return out;
}

/** Every event on the platform, newest first. */
export function monitoringEvents(s: EventSources): MonitoringEvent[] {
  const out: MonitoringEvent[] = [];
  s.roster.forEach((teen, i) => {
    if (teen.recordId) {
      for (const e of s.escalationsFor(teen.recordId)) out.push(escalationEvent(e, teen, s));
      for (const t of s.eventsFor(teen.recordId)) if (t.kind === "placed" || t.kind === "confirmed" || t.kind === "stepped-down") out.push(tierChangeEvent(t, teen, s));
    }
    out.push(...flagEvents(teen, s), ...noteEvents(teen, s, i));
  });
  out.push(...generatedEvents(s.roster, s));
  return out.sort((a, b) => b.at - a.at);
}

/* ── FILTERS ────────────────────────────────────────────────────────────── */

export type RangeId = "24h" | "7d" | "30d" | "90d" | "custom";
export const RANGE_MS: Record<Exclude<RangeId, "custom">, number> = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY, "90d": 90 * DAY };
export const KIND_LABEL: Record<MonitoringEventKind, string> = { escalation: "Escalations", flag: "Risk flags", tier_change: "Tier changes", note: "Reviews & notes" };

export interface EventFilter {
  range: RangeId;
  /** Custom range, inclusive dates as `YYYY-MM-DD` (local). */
  from?: string;
  to?: string;
  kinds: MonitoringEventKind[];
  tiers: Tier[];
  mentor: string;
  supervisor: string;
}

export const DEFAULT_FILTER: EventFilter = { range: "30d", kinds: ["escalation", "flag", "tier_change", "note"], tiers: [1, 2, 3, 4], mentor: "", supervisor: "" };

/** The range as [start, end] ms. */
export function rangeBounds(f: EventFilter, now: number): [number, number] {
  if (f.range !== "custom") return [now - RANGE_MS[f.range], now];
  const start = f.from ? new Date(`${f.from}T00:00:00`).getTime() : now - 30 * DAY;
  const end = f.to ? new Date(`${f.to}T23:59:59.999`).getTime() : now;
  return [start, end];
}

export function filterEvents(events: MonitoringEvent[], f: EventFilter, now: number): MonitoringEvent[] {
  const [start, end] = rangeBounds(f, now);
  const m = f.mentor.trim().toLowerCase();
  const sup = f.supervisor.trim().toLowerCase();
  return events.filter(
    (e) =>
      e.at >= start &&
      e.at <= end &&
      f.kinds.includes(e.kind) &&
      (e.tier === undefined || f.tiers.includes(e.tier)) &&
      (!m || e.mentorName.toLowerCase().includes(m)) &&
      (!sup || (e.supervisorName ?? "").toLowerCase().includes(sup))
  );
}

/** The one quiet summary line's numbers. */
export function rangeSummary(events: MonitoringEvent[]) {
  const esc = events.filter((e) => e.kind === "escalation");
  const byTier = (t: Tier) => esc.filter((e) => e.tier === t).length;
  const resp = esc.map((e) => e.responseSeconds).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
  const median = resp.length ? (resp.length % 2 ? resp[(resp.length - 1) / 2] : Math.round((resp[resp.length / 2 - 1] + resp[resp.length / 2]) / 2)) : null;
  const flags = events.filter((e) => e.kind === "flag");
  return {
    escalations: esc.length,
    t1: byTier(1),
    t2: byTier(2),
    medianResponseSeconds: median,
    flags: flags.length,
    surge: flags.filter((f) => f.surge).length,
    tierChanges: events.filter((e) => e.kind === "tier_change").length,
    open: esc.filter((e) => e.state !== "closed").length,
    closed: esc.filter((e) => e.state === "closed").length,
  };
}

/* ── EXPORT ─────────────────────────────────────────────────────────────── */

const iso = (ms?: number) => (ms === undefined ? "" : new Date(ms).toISOString());
const cell = (v: string | number | undefined) => {
  const s = v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_COLUMNS = ["type", "at", "teen", "mentor", "supervisor", "tier", "flagged_at", "confirmed_at", "closed_at", "response_seconds", "from_tier", "to_tier", "state", "document", "detail"] as const;

/** The audit deliverable: the filtered events, one row each. */
export function eventsCsv(events: MonitoringEvent[]): string {
  const rows = events.map((e) =>
    [
      e.kind,
      iso(e.at),
      e.teenName,
      e.mentorName,
      e.supervisorName ?? "",
      e.tier ?? "",
      iso(e.flaggedAt),
      iso(e.confirmedAt),
      iso(e.closedAt),
      e.responseSeconds ?? "",
      e.fromTier ?? "",
      e.toTier ?? "",
      e.state,
      e.document?.title ?? "",
      e.detail,
    ]
      .map(cell)
      .join(",")
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}

/** Where an event's teen opens: the live timeline while its escalation is
 *  open, the record's Care tab (the tier history) otherwise; a generated teen
 *  has neither. */
export function timelineHref(e: MonitoringEvent): string | null {
  if (!e.recordId) return null;
  if (e.kind === "escalation" && e.live) return `/app/chat/${e.recordId}`;
  return `/admin/person/${e.recordId}?tab=care`;
}
