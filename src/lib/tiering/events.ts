// ═══════════════════════════════════════════════════════════════════════════
// TIER EVENTS — the append-only record of where a teen sits (pack v1.0)
//
// ═══ A TIER IS NOT A FIELD. IT IS THE LAST PLACEMENT IN A LOG ═══
// Every placement, request, confirmation and step-down is an immutable event
// with a required reason. Nothing edits one; a correction is a NEW event, so
// the history of who decided what, when and why is always readable — which is
// the whole of what a clinical audit asks of this surface.
//
// ═══ MENTOR AND SYSTEM FLAG; ONLY A SUPERVISOR CONFIRMS ═══
// The two halves are two event families:
//   · PENDING  — `requested` (up) and `step-down-requested` (down). A mentor or
//                the system writes these. They never move the tier; they put a
//                "Requested: Tier N" chip beside it.
//   · SETTING  — `placed`, `confirmed`, `stepped-down`. A supervisor writes
//                these, and each one clears whatever was pending.
//   · `declined` clears the pending request without moving anything.
// The gate that keeps the two apart is `canSetTier` below.

import {
  EXITS_TO,
  T1_NO_THREAT_EXIT,
  TIERS,
  TIER_NAME,
  type Tier,
} from "@/lib/tiering/tiers";

export type TierEventKind =
  | "placed"
  | "requested"
  | "confirmed"
  | "declined"
  | "step-down-requested"
  | "stepped-down";

export type ActorRole = "mentor" | "supervisor" | "system";

export interface TierActor {
  id: string;
  name: string;
  role: ActorRole;
}

export interface TierEvent {
  id: string;
  teenId: string;
  at: number;
  kind: TierEventKind;
  /** The tier this event is ABOUT: the one placed, requested, confirmed or
   *  stepped down to. A `declined` event names the request it declines. */
  tier: Tier;
  /** Where the teen sat when this was written. Null for a first placement. */
  fromTier: Tier | null;
  actor: TierActor;
  /** REQUIRED, and never empty — `appendable` refuses an event without one. */
  reason: string;
  /** The escalation this belongs to, when it does. */
  escalationId?: string;
  /** A resolution outcome id, on the step-down a crisis note requests. */
  outcomeId?: string;
}

const SETTING: ReadonlySet<TierEventKind> = new Set(["placed", "confirmed", "stepped-down"]);
const PENDING: ReadonlySet<TierEventKind> = new Set(["requested", "step-down-requested"]);

export const isSetting = (e: TierEvent) => SETTING.has(e.kind);
export const isPending = (e: TierEvent) => PENDING.has(e.kind);

export interface TierState {
  /** Null only for a teen with no placement at all — the record says so
   *  rather than inventing Tier 4. */
  tier: Tier | null;
  /** When the current tier was set. */
  since: number | null;
  setBy: TierActor | null;
  /** The request awaiting a supervisor, if any. */
  pending: TierEvent | null;
  /** Oldest first. */
  history: TierEvent[];
}

const byTime = (a: TierEvent, b: TierEvent) => a.at - b.at || a.id.localeCompare(b.id);

/** ═══ THE TIER IS READ OFF THE LOG, ONCE, HERE ═══ */
export function tierStateFor(events: TierEvent[]): TierState {
  const history = [...events].sort(byTime);
  let tier: Tier | null = null;
  let since: number | null = null;
  let setBy: TierActor | null = null;
  let pending: TierEvent | null = null;
  for (const e of history) {
    if (isSetting(e)) {
      tier = e.tier;
      since = e.at;
      setBy = e.actor;
      pending = null;
    } else if (isPending(e)) {
      pending = e;
    } else if (e.kind === "declined") {
      pending = null;
    }
  }
  return { tier, since, setBy, pending, history };
}

const DAY = 86_400_000;

/** Day N in the current tier, counting the day it was set as day 1. */
export const dayInTier = (s: TierState, now: number) =>
  s.since === null ? null : Math.max(1, Math.floor((now - s.since) / DAY) + 1);

// ── THE RULES ──────────────────────────────────────────────────────────────

export interface Placement {
  tier: Tier;
  allowed: boolean;
  /** Why not, when it is not. TODO-COPY. */
  why?: string;
  /** The document a step down here records. */
  stepDown: boolean;
}

/** ═══ WHERE A SUPERVISOR MAY PUT A TEEN FROM HERE ═══
 *
 *  Up: anywhere above, in one move — safety first.
 *  Down: ONE step, the tier's exit — except a Tier 1 crisis note whose
 *  outcome was "no longer a threat", which may exit to Tier 3. Tier 1 can
 *  never go straight to Tier 4, and nothing skips a tier on the way down.
 *  The current tier is not a move. */
export function placementsFrom(current: Tier | null, opts: { noThreat?: boolean } = {}): Placement[] {
  return TIERS.map((t) => {
    if (current === null) return { tier: t, allowed: true, stepDown: false };
    if (t === current) return { tier: t, allowed: false, why: "Current tier", stepDown: false };
    if (t < current) return { tier: t, allowed: true, stepDown: false };
    const exit = current === 4 ? null : EXITS_TO[current];
    if (t === exit) return { tier: t, allowed: true, stepDown: true };
    if (current === 1 && t === T1_NO_THREAT_EXIT && opts.noThreat) return { tier: t, allowed: true, stepDown: true };
    return {
      tier: t,
      allowed: false,
      stepDown: true,
      why: current === 1 ? "Tier 1 steps down to Tier 2 first" : `Steps down one tier at a time`,
    };
  });
}

/** ═══ THE GATE: ONLY A SUPERVISOR SETS A TIER ═══
 *
 *  A mentor never places, confirms or steps a teen down — not even one step,
 *  not even after a crisis note. The reasoning is the canon's, recorded here
 *  so the next person who finds a mentor "Step down" button missing knows it
 *  is missing on purpose: the mentor is the person closest to the teen and
 *  the one most likely to be reassured by a good conversation, and placement
 *  is a clinical judgement that has to be made by someone accountable for
 *  it. A mentor's tool is the REQUEST — which is one tap up, and a reasoned
 *  ask down — and a supervisor's confirmation is what completes either.
 *  Changing this is a blocked constant: Meg / Dr. Nissan. */
export const canSetTier = (role: ActorRole) => role === "supervisor";

/** An event is appendable only with a reason, and a SETTING event only from
 *  a supervisor. The store's write goes through this, so the gate is not a
 *  UI convention. */
export function appendable(e: TierEvent): { ok: true } | { ok: false; why: string } {
  if (!e.reason.trim()) return { ok: false, why: "A tier event needs a reason." };
  if (isSetting(e) && !canSetTier(e.actor.role)) return { ok: false, why: "Only a supervisor sets a tier." };
  if (e.kind === "requested" && e.tier === 4) return { ok: false, why: "Tier 4 is never a raise target." };
  return { ok: true };
}

/** A fixture or a write by the store-backed mentor carries id `live` and no
 *  name — the name is the store's, read at render. Surfaces pass the
 *  resolved name to `describeEvent`; this is the fallback. */
export const actorName = (a: TierActor) =>
  a.role === "system" ? "The system" : a.name || (a.role === "mentor" ? "The mentor" : "A supervisor");

/** "Tier 1 confirmed by Brandy Forrestor" — the sentence a history row and
 *  the status header both use. TODO-COPY. */
export function describeEvent(e: TierEvent, who: string = actorName(e.actor)): string {
  switch (e.kind) {
    case "placed":
      return `${who} placed them in Tier ${e.tier} · ${TIER_NAME[e.tier]}`;
    case "requested":
      return `${who} requested Tier ${e.tier} · ${TIER_NAME[e.tier]}`;
    case "confirmed":
      return `${who} confirmed Tier ${e.tier} · ${TIER_NAME[e.tier]}`;
    case "declined":
      return `${who} kept them in Tier ${e.fromTier ?? e.tier} instead of Tier ${e.tier}`;
    case "step-down-requested":
      return `${who} requested a step down to Tier ${e.tier}`;
    case "stepped-down":
      return `${who} stepped them down to Tier ${e.tier} · ${TIER_NAME[e.tier]}`;
  }
}
