// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE TIERS (proto/monitoring-merge), NOW A RE-EXPORT
//
// The tiers moved to `lib/tiering/tiers.ts` with the Tiering & Escalation
// pack, because the chat and the user record state them too and one teen
// cannot have three definitions. Kept so existing imports do not move.

export {
  EXITS_TO,
  T1_RESPONSE_SECONDS,
  TIER_CADENCE,
  TIER_MINIMUM_DAYS,
  TIER_NAME,
  TIER_RING,
  type Tier,
} from "@/lib/tiering/tiers";
