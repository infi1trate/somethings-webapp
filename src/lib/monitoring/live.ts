// ═══ THE LIVE LAYER — STATE CHANGES, NOT MESSAGES ═══
//
// A literal message feed is not buildable here and would not be a monitor. At
// ~8–12 mentors × 15–25 teens across a 5.5-hour window, throughput is thousands
// of messages a shift; a scrolling wall of teen messages competes preattentively
// with the queue, which is where recorded clinical judgment actually happens.
// Motion beats stasis, so the feed would win attention and produce nothing.
//
// The justification for real time is narrow and it is the whole justification: a
// response-time breach seen at minute four is a save, and the same breach seen at
// 10pm is a coaching note. Anything equally actionable an hour later belongs in
// the queue, so the band carries ONLY time-perishable items.
//
// NO MESSAGE CONTENT. The band shows that a conversation is live, never what is
// in it. Reading content requires opening the conversation — an intentional,
// logged act. That is the privacy posture and it is also what keeps the band
// scannable. The cost is less ambient texture; taken deliberately.

import { LIVE_BAND_MAX, MENTOR_ONLINE_HOURS } from "@/lib/monitoring/constants";

export type LiveKind =
  | "awaitingReply"
  | "mentorOffline"
  | "outreachWindow"
  | "wentActive"
  | "flagArrived"
  | "escalationTriggered";

export interface LiveItem {
  id: string;
  kind: LiveKind;
  /** One line, already composed — no message content, ever. NEEDS-COPY-NICOLE
   *  on every producer's phrasing. */
  line: string;
  at: number;
  /** For the coverage view's row treatment. Never used to reorder anything
   *  (locked decisions 5, 6, 14): live changes how a row LOOKS, never where it
   *  sits, because a list that reorders under a reader loses their place. */
  conversationId: string | null;
}

/** ═══ THE BAND'S STATES, AND WHY EACH ONE EXISTS SEPARATELY ═══
 *
 *  `dormant`    off-hours, by design — and it must SAY so, because a dormant
 *               band that looks broken is worse than no band.
 *  `degraded`   the transport is gone. Silence because a socket dropped is
 *               indistinguishable from a quiet shift, and on a safety surface
 *               that ambiguity is the failure mode that matters most.
 *  `quiet`      online, genuinely low activity. Distinct from both above.
 *  `live`       items present.
 *  `paused`     the reader stopped it (WCAG 2.2.2).
 *  `off`        the feature flag is off — the band does not render at all. */
export type LiveBandState = "off" | "dormant" | "degraded" | "quiet" | "live" | "paused";

/** NEEDS-COPY-NICOLE, all four of the non-`live` states. Each names what is true
 *  rather than what is missing. */
export const LIVE_STATE_LINE: Record<Exclude<LiveBandState, "off" | "live">, string> = {
  dormant: "Outside shift hours — nothing is expected to arrive until the next shift.",
  degraded: "Live updates are disconnected, so this band can’t say whether anything is happening.",
  quiet: "Connected. Nothing time-sensitive right now.",
  paused: "Paused by you. New items are held, not dropped.",
};

export function isWithinShiftHours(now: number): boolean {
  const d = new Date(now);
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= MENTOR_ONLINE_HOURS.startHour && h < MENTOR_ONLINE_HOURS.endHour;
}

export function bandStateFor(opts: {
  enabled: boolean;
  transport: "connected" | "lost";
  paused: boolean;
  now: number;
  items: LiveItem[];
}): LiveBandState {
  if (!opts.enabled) return "off";
  if (opts.transport === "lost") return "degraded";
  if (opts.paused) return "paused";
  if (!isWithinShiftHours(opts.now)) return "dormant";
  return opts.items.length > 0 ? "live" : "quiet";
}

/** ═══ THE CAP, AND WHY OVERFLOW IS A COUNT AND NOT A SCROLLBAR ═══
 *  A band that scrolls is a second list, and a second list above the queue is
 *  the feed this design rejected. Newest first — the band is the only place on
 *  the surface where recency is the ordering, because perishability is its whole
 *  contents. */
export function bandItems(items: LiveItem[]): { shown: LiveItem[]; overflow: number } {
  const ordered = [...items].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  return {
    shown: ordered.slice(0, LIVE_BAND_MAX),
    overflow: Math.max(0, ordered.length - LIVE_BAND_MAX),
  };
}

/** Which live kinds may interrupt. ONLY an escalation arrival earns
 *  `aria-live="assertive"` and the global layer; everything else is a quiet
 *  entrance in the band and a "N new" affordance (see `now-band.tsx`). Nothing
 *  in the band ever changes pane selection (locked decision 15). */
export function interrupts(kind: LiveKind): boolean {
  return kind === "escalationTriggered";
}
