// THIRD-PARTY DATA ACCESS LOG — A STUB, AND MARKED AS ONE.
//
// ═══════════════════════════════════════════════════════════════════════════
// TODO-DATA: THIS DOES NOT LOG ANYTHING. There is no access-logging seam in this
// codebase to route into — audited: zero matches across `src/` for accessLog,
// logAccess, auditAccess, dataAccess or any third-party-access concept, and the
// record view (which rule 12 cites as the precedent for data-layer enforcement)
// enforces its section-mode matrix WITHOUT logging reads.
//
// So rather than invent a logging system inside a feed query, this is the seam and
// nothing else. When a real audit log lands, `recordNetworkAccess` is the one
// function to implement and no caller changes.
//
// WHY IT EXISTS AT ALL, EMPTY: reading a ledger row about a teen who is not yours
// IS a third-party data access, whether or not anyone is currently writing it
// down. Having the call site in place means the day the log exists, the coverage
// is already correct — as opposed to someone later trying to find every place
// network-scope data was read.
// ═══════════════════════════════════════════════════════════════════════════

export interface NetworkAccessEvent {
  /** Who looked. */
  viewerId: string;
  /** How many rows about teens outside their caseload were returned to them. */
  rowCount: number;
  /** The teens those rows concerned. Ids, not names — this is an audit record,
   *  and it should not itself become a place teen names accumulate. */
  teenIds: string[];
  /** When. Passed in rather than read from the clock, so the caller's simulated
   *  time and the log agree and so this stays a pure function. */
  at: number;
}

/** THE SEAM. One call, from the network-scope branch of the feed query.
 *
 *  Deliberately returns void and swallows nothing — it does not throw, because a
 *  logging failure must never blank a supervisor's feed. When this is implemented
 *  against a real backend, that property has to survive: log failures are the
 *  logger's problem, not the reader's. */
export function recordNetworkAccess(event: NetworkAccessEvent): void {
  // TODO-DATA: implement against the real audit log. Intentionally a no-op.
  //
  // NOT console.log: a prototype that prints teen ids to the console on every
  // feed render is a worse privacy posture than the thing this is meant to
  // improve, and it would be the one artefact of this file anybody actually saw.
  void event;
}
