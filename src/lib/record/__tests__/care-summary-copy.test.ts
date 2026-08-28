// THE GOVERNING RULES, AS A SCAN OVER THE SOURCE.
//
// The care-record rules forbid whole CLASSES of sentence: no verbatim message
// content, no sentiment scores, no person-level tiering, no causal claims, no
// prediction. Those are not properties of a function's return value — they are
// properties of the copy — so a behavioural test cannot catch them. A scan can,
// and it catches the case that actually happens: someone adds a sentence months
// from now that reads better and breaks a rule.
//
// ═══ WHAT THIS SCAN CAN AND CANNOT DO ═══
//
// It strips comment lines before matching, because the comments in these files
// necessarily DISCUSS the forbidden phrasings in order to explain why they are
// forbidden — "a percentile attached to a child is a risk score" must not fail
// the percentile check. The stripper is line-based and deliberately simple; it
// is not a parser. So this is a smoke alarm, not a proof: a violation written on
// the same line as a comment could slip past. It still turns five rules that
// existed only in a brief into five rules that fail a test run.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FILES = [
  "src/lib/record/care-summary-doc.ts",
  "src/components/record/care-summary-doc.tsx",
  "src/lib/record/care-demo.ts",
];

/** ═══ WHY care-demo.ts IS SCANNED FROM A MARKER ═══
 *
 *  It holds the History row copy for a committed summary, which is in scope, and
 *  also the entire care fixture set, which is not. Scanning all of it failed on
 *  "the discussion that led to the escalation" — a label on a conversation link
 *  that predates this feature. That phrase describes the record's own structure
 *  rather than claiming a cause for a teen's state, so it is left alone rather
 *  than edited to satisfy a scan aimed at a different surface.
 *
 *  The slice runs from the marker to end of file, so anything added below it is
 *  covered by default. */
const CARE_DEMO_MARKER = "── COMMITTED CARE SUMMARIES AS HISTORY ";

/** Source with comment lines and block comments removed. See the header. */
function copyOf(file: string): string {
  let raw = readFileSync(join(process.cwd(), file), "utf8");
  if (file.endsWith("care-demo.ts")) {
    const at = raw.indexOf(CARE_DEMO_MARKER);
    // A missing marker means the block was renamed or removed, and silently
    // scanning nothing would leave the rule unenforced while still passing.
    if (at === -1) throw new Error(`marker not found in ${file}`);
    raw = raw.slice(at);
  }
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");
}

const SOURCES = FILES.map((f) => [f, copyOf(f)] as const);

/** Each rule: what it forbids, and the patterns that would betray it. */
const RULES: { rule: string; patterns: RegExp[] }[] = [
  {
    rule: "no causal claims — the document reports, it does not explain why",
    patterns: [
      /\bbecause of\b/i,
      /\bcaused by\b/i,
      /\bdue to\b/i,
      /\bled to\b/i,
      /\bas a result of\b/i,
      /\bdriven by\b/i,
      /\bexplains? the\b/i,
    ],
  },
  {
    rule: "no prediction — a window is described, never a future",
    patterns: [
      /\bwill likely\b/i,
      /\bis likely to\b/i,
      /\bexpected to\b/i,
      /\bpredicts?\b/i,
      /\bforecast/i,
      /\bat risk of\b/i,
      /\bheading (?:toward|towards)\b/i,
      /\bif this continues\b/i,
    ],
  },
  {
    rule: "no person-level tiering — a tier describes a flag, never a teen",
    patterns: [
      /\bhigh[- ]risk (?:teen|mentee|youth|client)\b/i,
      /\btop \d+%/i,
      /\bpercentile\b/i,
      /\b(?:tier|tiered) (?:teen|mentee|youth)\b/i,
      /\b(?:teen|mentee) is (?:imminent|clinical)/i,
    ],
  },
  {
    rule: "no sentiment scores — direction words only, never a number on a mood",
    patterns: [
      /\bsentiment (?:score|value|index|rating)\b/i,
      /\bmood score\b/i,
      /\bpositivity\b/i,
      /\bwellbeing score\b/i,
    ],
  },
  {
    rule: "no verbatim message content",
    patterns: [
      /\bmessage (?:text|body|content) \b/i,
      /\bverbatim\b/i,
      /\btranscript (?:excerpt|quote|snippet)\b/i,
      /\bthey (?:said|wrote):/i,
    ],
  },
];

describe("the care summary's copy obeys the record rules", () => {
  for (const { rule, patterns } of RULES) {
    it(rule, () => {
      const hits: string[] = [];
      for (const [file, src] of SOURCES) {
        for (const p of patterns) {
          const m = src.match(p);
          if (m) hits.push(`${file}: /${p.source}/ matched ${JSON.stringify(m[0])}`);
        }
      }
      expect(hits).toEqual([]);
    });
  }

  it("never asserts a contact figure it cannot derive", () => {
    // THE BUG THIS LOCKS. `contactDays` comes from the mocked theme extraction
    // and is 0 wherever that mock has no row, so three separate sentences told
    // supervisors there had been "fewer than 3 conversation days" or "too little
    // contact" on records with months of it. A refusal must name the missing
    // INPUT, never invent a fact about the record.
    const hits: string[] = [];
    for (const [file, src] of SOURCES) {
      for (const p of [
        /too little contact/i,
        /fewer than \$\{?SUMMARY_MIN_CONTACT_DAYS\}? conversation days/i,
        /fewer than \d+ conversation days/i,
        /little (?:contact|conversation) in the window/i,
      ]) {
        const m = src.match(p);
        if (m) hits.push(`${file}: ${JSON.stringify(m[0])}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("states provenance and refuses the determination", () => {
    // Guardrail 6, the other direction: these strings MUST be present. A scan
    // that only forbids can be satisfied by deleting the document.
    const card = SOURCES.find(([f]) => f.endsWith("care-summary-doc.tsx"))![1];
    expect(card).toMatch(/not itself a clinical determination/i);
    const lib = SOURCES.find(([f]) => f.endsWith("care-summary-doc.ts"))![1];
    expect(lib).toMatch(/mocked — no pipeline/i);
  });
});
