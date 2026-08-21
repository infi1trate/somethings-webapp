// DSM-5 LOOKUP — the ONE module that knows where presentation codes come from.
//
// TODO-DATA: the real source is TBD per the PRD. Everything here is a mock
// fixture, and the whole point of this file is that the swap is local: callers
// only ever see `Dsm5Entry`, `searchDsm5`, `commonDsm5` and `statementForCode`.
// No component reaches past those four, so replacing the fixture with a real
// table, an API, or a licensed dataset touches nothing else.
//
// The set below is deliberately SMALL and adolescent-relevant rather than a
// partial dump of the manual. A half-complete code list invites someone to trust
// it as authoritative; a visibly short demo list does not.

export interface Dsm5Entry {
  code: string;
  /** The plain-language statement. Primary in every result row — a code is not
   *  readable by the mentors who also read this record. */
  statement: string;
}

const DSM5: Dsm5Entry[] = [
  { code: "F41.1", statement: "Generalized anxiety disorder" },
  { code: "F41.0", statement: "Panic disorder" },
  { code: "F41.9", statement: "Anxiety disorder, unspecified" },
  { code: "F40.10", statement: "Social anxiety disorder" },
  { code: "F32.0", statement: "Major depressive disorder, single episode, mild" },
  { code: "F32.1", statement: "Major depressive disorder, single episode, moderate" },
  { code: "F33.0", statement: "Major depressive disorder, recurrent, mild" },
  { code: "F33.1", statement: "Major depressive disorder, recurrent, moderate" },
  { code: "F34.1", statement: "Persistent depressive disorder" },
  { code: "F43.20", statement: "Adjustment disorder, unspecified" },
  { code: "F43.21", statement: "Adjustment disorder with depressed mood" },
  { code: "F43.22", statement: "Adjustment disorder with anxiety" },
  { code: "F43.23", statement: "Adjustment disorder with mixed anxiety and depressed mood" },
  { code: "F43.10", statement: "Post-traumatic stress disorder" },
  { code: "F90.0", statement: "ADHD, predominantly inattentive presentation" },
  { code: "F90.1", statement: "ADHD, predominantly hyperactive presentation" },
  { code: "F90.2", statement: "ADHD, combined presentation" },
  { code: "F42.2", statement: "Obsessive-compulsive disorder" },
  { code: "F50.02", statement: "Anorexia nervosa, binge-eating/purging type" },
  { code: "F51.01", statement: "Primary insomnia" },
  { code: "F91.3", statement: "Oppositional defiant disorder" },
  { code: "F94.0", statement: "Selective mutism" },
];

/** Surfaced BEFORE the user types. An empty search box that asks a supervisor to
 *  recall a code from memory is a worse starting point than the handful this
 *  population actually presents with. TODO-DATA: this is a fixed list; the real
 *  one is "recent across this org" and needs usage data to exist first. */
const COMMON_CODES = ["F41.1", "F33.0", "F43.22", "F90.2", "F43.10", "F40.10"];

export function commonDsm5(): Dsm5Entry[] {
  return COMMON_CODES.map((c) => DSM5.find((d) => d.code === c)!).filter(Boolean);
}

/** Search by CODE NUMBER or by DIAGNOSTIC STATEMENT — one box for both, because
 *  a supervisor who half-remembers "F43" and one who half-remembers "adjustment"
 *  are doing the same task. Code matches sort first: typing a code is an exact
 *  intent, typing words is a browse. */
export function searchDsm5(query: string): Dsm5Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return commonDsm5();
  const codeHits: Dsm5Entry[] = [];
  const textHits: Dsm5Entry[] = [];
  for (const d of DSM5) {
    if (d.code.toLowerCase().includes(q)) codeHits.push(d);
    else if (d.statement.toLowerCase().includes(q)) textHits.push(d);
  }
  return [...codeHits, ...textHits];
}

/** Code → statement. The record stores codes; every surface that shows a
 *  presentation reads its wording from here, so a statement can never drift
 *  between the spine, the timeline and the search results. */
export function statementForCode(code: string): string | undefined {
  return DSM5.find((d) => d.code === code)?.statement;
}
