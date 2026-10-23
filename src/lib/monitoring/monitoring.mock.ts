// ═══════════════════════════════════════════════════════════════════════════
// MONITORING SCENARIOS (Monitoring v3, §6) — every state, one click away
//
// Twenty scenarios for the dev bar's Monitoring section, Watch and Events.
// EACH IS DATA ONLY: a transform of the roster, extra seeded escalations, the
// Tier 1 alert's state, a transform of the event stream, an initial filter,
// and environment toggles (motion, theme). No scenario renders UI of its own —
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

/** The Tier 1 alert's answer, and who holds it. */
export interface AlertMock {
  /** unanswered · acknowledged by you · you joined the session */
  answer: "none" | "acknowledged" | "joined";
  /** Another supervisor holds it: your actions become Observe / Hand to me. */
  heldBy?: string;
}

export interface MonitoringMock {
  id: string;
  label: string;
  /** The tab the scenario opens on. */
  tab: "watch" | "events";
  /** Teens with an open Tier 1 escalation, seeded (t13 is Jordan's crisis). */
  tier1?: string[];
  alert?: AlertMock;
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
  { id: "m3-alert-unacked", label: "Alert · unacknowledged", tab: "watch", tier1: ["t13"], alert: { answer: "none" } },
  { id: "m3-alert-acked", label: "Alert · acknowledged", tab: "watch", tier1: ["t13"], alert: { answer: "acknowledged" } },
  { id: "m3-alert-joined", label: "Alert · joined", tab: "watch", tier1: ["t13"], alert: { answer: "joined" } },
  { id: "m3-two-t1", label: "Two Tier 1s", tab: "watch", tier1: ["t13", "t15"], alert: { answer: "none" } },
  { id: "m3-alert-other", label: "Alert · other supervisor", tab: "watch", tier1: ["t13"], alert: { answer: "none", heldBy: "Sarah" } },
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
  { id: "m3-reduced-motion", label: "Reduced motion", tab: "watch", tier1: ["t13"], alert: { answer: "none" }, env: { reducedMotion: true } },
  { id: "m3-dark", label: "Dark mode", tab: "watch", tier1: ["t13"], alert: { answer: "none" }, env: { theme: "dark" } },

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
  { id: "m3-ev-open", label: "Open escalation present", tab: "events", tier1: ["t13"], alert: { answer: "none" }, filter: () => ({ range: "24h" }) },
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
