// ═══════════════════════════════════════════════════════════════════════════
// MONITORING SCENARIOS (Monitoring v3, §6) — every state, one click away
//
// Twenty scenarios for the dev bar's Monitoring section, Watch and Events.
// EACH IS DATA ONLY: a transform of the roster, extra seeded escalations (and
// the Tier 1 record state they are in), who holds a Tier 1, a transform of
// the event stream, an initial filter, and environment toggles (motion,
// theme).
//
// ═══ MONITORING v4, §5 ═══ The strip-only scenarios (unacknowledged,
// acknowledged, joined, two Tier 1s, other supervisor) left with the strips,
// and `AlertMock` with them — deleted, not orphaned. Their cases are the
// queue's now: unconfirmed, overdue, confirmed by you, six, held by Sarah. No scenario renders UI of its own —
// the page renders whatever the data says, which is what makes a scenario a
// test of the page rather than a picture of one.
//
// Ids are `m3-…`, under the dev bar's `monitoring:` prefix and the store's
// `monitoringScenarioId`. Unknown to the legacy builders (`scenarios.ts`),
// which fall back to the task-derived default for Today and the badges.
//
// TODO-DATA: every name, count and line here is a fixture.

import type { EventFilter, MonitoringEvent } from "@/lib/monitoring/events";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import type { Tier } from "@/lib/tiering/tiers";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** ═══ A SEEDED TIER 1 (Monitoring v4) ═══ The queue's states are made from
 *  the record's own fields, so a scenario seeds those: how long ago it was
 *  raised, how far it has got, and who confirmed it. */
export interface T1Spec {
  teen: string;
  /** Seconds since it was raised (the 60s window counts from here). */
  ageSec?: number;
  /** assessing: S0 (mid-assessment) · awaiting: assessed, unconfirmed ·
   *  confirmed: confirmed, the crisis note under way. */
  stage?: "assessing" | "awaiting" | "confirmed";
  /** Who confirmed it: "you" (the supervisor persona) or a supervisor's name. */
  confirmedBy?: string;
  /** Seconds from raise to confirmation. */
  ttcSec?: number;
}

export interface MonitoringMock {
  id: string;
  label: string;
  /** The tab the scenario opens on. */
  tab: "watch" | "events";
  /** Teens with an open Tier 1 escalation, seeded (t13 is Jordan's crisis) —
   *  a teen id, or a spec of the record's state (Monitoring v4). */
  tier1?: (string | T1Spec)[];
  /** Tier 1 escalations another supervisor holds, by teen (Monitoring v4):
   *  the queue's Holder chip and Observe. */
  holders?: Readonly<Record<string, string>>;
  roster?: (teens: MonitoringTeen[]) => MonitoringTeen[];
  events?: (events: MonitoringEvent[], now: number) => MonitoringEvent[];
  filter?: (now: number) => Partial<EventFilter>;
  /** Tier 4's registry opens expanded. */
  tier4Open?: boolean;
  /** Environment, not UI: the page sets these on <html> while active. */
  env?: { reducedMotion?: boolean; theme?: "dark" };
  /** Run the export's own code path once on arrival, without a download, so
   *  its confirmation toast is what the reader sees. */
  exported?: boolean;
}

const dateOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Move every teen of `from` tiers to Tier 4 — an empty group, honestly. */
const emptyTiers = (tiers: Tier[]) => (teens: MonitoringTeen[]) =>
  teens.map((t) => (tiers.includes(t.tier) ? { ...t, tier: 4 as Tier, timeInTier: undefined, reviewReason: undefined } : t));

/** A deterministic event, cloned from a template, for density fixtures. */
function generated(template: MonitoringEvent, i: number, at: number): MonitoringEvent {
  return { ...template, id: `m3-gen-${i}`, at, document: undefined, documentId: undefined };
}

export const MONITORING_MOCKS: MonitoringMock[] = [
  // ── WATCH ────────────────────────────────────────────────────────────────
  { id: "m3-quiet", label: "Quiet shift", tab: "watch" },
  /* ═══ THE QUEUE'S STATES (Monitoring v4, §5) ═══ One Tier 1 inside its
     window; one overdue, sorted above a younger one; one you confirmed;
     the six; one another supervisor holds. */
  { id: "m4-unconfirmed", label: "Alert · unconfirmed (1)", tab: "watch", tier1: [{ teen: "t13", ageSec: 20, stage: "awaiting" }] },
  {
    id: "m4-overdue",
    label: "Alert · overdue",
    tab: "watch",
    /* Listed younger-first, so the sort is what puts the overdue row on top. */
    tier1: [
      { teen: "t15", ageSec: 25, stage: "assessing" },
      { teen: "t13", ageSec: 3 * 60 + 2, stage: "awaiting" },
    ],
  },
  { id: "m4-confirmed", label: "Confirmed by you", tab: "watch", tier1: [{ teen: "t13", ageSec: 6 * 60, stage: "confirmed", confirmedBy: "you", ttcSec: 48 }] },
  /* ═══ SIX TIER 1s (Monitoring v4) ═══ The queue's whole case: mixed
     stages, mixed holders, sorted by response state — no strips anywhere. */
  {
    id: "m4-six-t1",
    label: "Six Tier 1s",
    tab: "watch",
    tier1: [
      { teen: "t13", ageSec: 15 * 60, stage: "awaiting" },
      { teen: "t15", ageSec: 18, stage: "assessing" },
      { teen: "t17", ageSec: 3 * 60 + 20, stage: "assessing" },
      { teen: "t19", ageSec: 42 * 60, stage: "confirmed", confirmedBy: "Sarah", ttcSec: 48 },
      { teen: "t21", ageSec: 9 * 60, stage: "confirmed", confirmedBy: "you", ttcSec: 36 },
      { teen: "t22", ageSec: 40, stage: "assessing" },
    ],
    holders: { t17: "Sarah" },
  },
  { id: "m4-held", label: "Held by Sarah", tab: "watch", tier1: [{ teen: "t13", ageSec: 30, stage: "awaiting" }], holders: { t13: "Sarah" } },
  {
    id: "m3-recommended",
    label: "Recommended tier pending",
    tab: "watch",
    /* The canon's word is "Requested" (★ Recommended was superseded): two
       teens carry a requested tier awaiting a supervisor. */
    roster: (teens) =>
      teens.map((t) => (t.id === "t17" ? { ...t, requestedTier: 2 as Tier, reviewReason: "Confirm Tier 2" } : t.id === "t22" ? { ...t, requestedTier: 2 as Tier, reviewReason: "Confirm Tier 2" } : t)),
  },
  { id: "m3-empty-t2-t3", label: "Empty Tier 2 and Tier 3", tab: "watch", roster: emptyTiers([2, 3]) },
  { id: "m3-t4-open", label: "Tier 4 expanded", tab: "watch", tier4Open: true },
  {
    id: "m3-overflow",
    label: "Long names and many presence chips",
    tab: "watch",
    roster: (teens) =>
      teens.map((t, i) =>
        t.tier <= 3
          ? {
              ...t,
              teen: i % 2 ? "Maximiliana Wolfeschlegel-Steinhausen" : "Christopher-Alexander Montgomery",
              mentor: "Bartholomew Featherstonehaugh",
              presence: "Mentor in session · Supervisor coaching",
            }
          : t
      ),
  },
  { id: "m3-reduced-motion", label: "Reduced motion", tab: "watch", tier1: ["t13"], env: { reducedMotion: true } },
  { id: "m3-dark", label: "Dark mode", tab: "watch", tier1: ["t13"], env: { theme: "dark" } },

  // ── EVENTS ───────────────────────────────────────────────────────────────
  { id: "m3-ev-empty", label: "Empty range", tab: "events", events: (ev, now) => ev.filter((e) => now - e.at > DAY), filter: () => ({ range: "24h" }) },
  {
    id: "m3-ev-sparse",
    label: "Sparse",
    tab: "events",
    events: (ev, now) => {
      const recent = ev.filter((e) => now - e.at <= 7 * DAY).slice(0, 4);
      return [...recent, ...ev.filter((e) => now - e.at > 7 * DAY)];
    },
    filter: () => ({ range: "7d" }),
  },
  {
    id: "m3-ev-dense",
    label: "Dense",
    tab: "events",
    /* 420+ across 90 days: the existing stream, plus deterministic clones of
       its quiet kinds spread evenly. */
    events: (ev, now) => {
      const quiet = ev.filter((e) => e.kind === "note" || e.kind === "flag");
      if (quiet.length === 0) return ev;
      const extra = Array.from({ length: 420 }, (_, i) => generated(quiet[i % quiet.length], i, now - Math.round(((i + 0.5) / 420) * 89 * DAY)));
      return [...ev, ...extra].sort((a, b) => b.at - a.at);
    },
    filter: () => ({ range: "90d" }),
  },
  { id: "m3-ev-open", label: "Open escalation present", tab: "events", tier1: ["t13"], filter: () => ({ range: "24h" }) },
  {
    id: "m3-ev-repeats",
    label: "Collapsed repeats",
    tab: "events",
    /* Five flags on Jordan today, interleaved with the rest of the day. */
    events: (ev, now) => {
      const flag = ev.find((e) => e.kind === "flag" && e.teenId === "t13") ?? ev.find((e) => e.kind === "flag");
      if (!flag) return ev;
      const five = Array.from({ length: 5 }, (_, i) => ({ ...flag, id: `m3-rep-${i}`, teenId: "t13", teenName: "Jordan T.", at: now - (i * 2 + 0.5) * HOUR, detail: i === 0 ? "5 flags in 12h · not safe tonight" : flag.detail }));
      return [...ev.filter((e) => !(e.kind === "flag" && e.teenId === "t13" && now - e.at < DAY)), ...five].sort((a, b) => b.at - a.at);
    },
  },
  { id: "m3-ev-filters", label: "Filters active", tab: "events", filter: () => ({ kinds: ["escalation", "flag"], tiers: [1, 2] }) },
  { id: "m3-ev-custom", label: "Custom range", tab: "events", filter: (now) => ({ range: "custom", from: dateOf(now - 21 * DAY), to: dateOf(now) }) },
  { id: "m3-ev-exported", label: "Export ready", tab: "events", exported: true },
];

export const MONITORING_MOCK_BY_ID: ReadonlyMap<string, MonitoringMock> = new Map(MONITORING_MOCKS.map((m) => [m.id, m]));
export const monitoringMock = (id: string | null | undefined): MonitoringMock | undefined => (id ? MONITORING_MOCK_BY_ID.get(id) : undefined);
