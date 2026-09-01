// A PRE-FLIGHT ON THE PROBES THEMSELVES.
//
// ═══ THE SAME MISTAKE, FIVE TIMES ═══
//
// Every probe passes its in-page code as a TEMPLATE LITERAL to `page.evaluate`. A
// backtick anywhere inside one — almost always in a comment, wrapping an identifier
// the way this codebase's prose does everywhere else — terminates the literal, and
// the file fails to parse. It has happened five times across this harness, in five
// different files, always while writing an explanatory comment.
//
// The escapes have the same shape of problem: `\n` and `\d` inside a template are
// consumed by the template before the regex ever sees them, which turns a working
// pattern into an unterminated one or a literal letter. Both bugs are invisible
// until the file is run, and one of them (the `\d` case) produced a probe that ran
// fine and silently matched nothing.
//
// So: a check that reads the probe SOURCE and refuses the two constructs. Cheap,
// runs in milliseconds, and it is the only version of "remember not to do that"
// that survives a sixth occurrence.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "scripts/responsive";
let fails = 0;

/** Spans of `evaluate(` / `addInitScript(` template literals, by index. Scanned
 *  character by character rather than by regex, because the thing being looked for
 *  is a mis-nested backtick and a regex over backticks is the same trap one level
 *  up. */
function templateSpans(src) {
  const spans = [];
  const marker = /\.(evaluate|waitForFunction)\(\s*`/g;
  let m;
  while ((m = marker.exec(src))) {
    const start = m.index + m[0].length; // just past the opening backtick
    // The literal ends at the next backtick that is not escaped. If the author has
    // put one inside a comment, THAT is the one found — which is exactly the bug,
    // and the reported span will end early and look wrong, which is the signal.
    let i = start;
    while (i < src.length) {
      if (src[i] === "\\") {
        i += 2;
        continue;
      }
      if (src[i] === "`") break;
      i++;
    }
    spans.push({ start, end: i, line: src.slice(0, start).split("\n").length });
  }
  return spans;
}

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".mjs")).sort()) {
  // This file's own prose is about the constructs, so it is the one exemption.
  if (file === "check-probes.mjs") continue;
  const path = join(DIR, file);
  const src = readFileSync(path, "utf8");

  for (const span of templateSpans(src)) {
    const body = src.slice(span.start, span.end);
    const rest = src.slice(span.end + 1, span.end + 3);
    /* A LITERAL THAT DOES NOT CLOSE WITH `)` OR `,` ended early — i.e. on a
       backtick inside it. That is the five-time bug, caught by its consequence
       rather than by looking for backticks in comments, which would have to
       understand comments. */
    if (!/^\s*[),]/.test(rest) && !/^\s*$/.test(rest)) {
      fails++;
      console.log(
        `  ✗ ${file}:${span.line} — an evaluate template literal ends early. A backtick inside it (usually in a comment) has terminated it.`
      );
    }
    /* ESCAPES THE TEMPLATE EATS. `\n` becomes a real newline (an unterminated
       regex) and `\d` becomes a bare `d` (a pattern that matches nothing and
       reports success). Both need doubling, and both are better replaced —
       `String.fromCharCode(10)` and `[0-9]`. */
    for (const [bad, why] of [
      [/(?<!\\)\\n/, "\\n — the template consumes it; split on String.fromCharCode(10)"],
      [/(?<!\\)\\d/, "\\d — the template consumes it; use [0-9]"],
      [/(?<!\\)\\s/, "\\s — the template consumes it; use [ \\\\t] or double the backslash"],
      [/(?<!\\)\\w/, "\\w — the template consumes it; use [A-Za-z0-9_]"],
    ]) {
      if (bad.test(body)) {
        fails++;
        console.log(`  ✗ ${file}:${span.line} — single-escaped ${why}`);
      }
    }
  }
}

console.log(fails === 0 ? "  ✓ every probe's in-page literals are well formed" : "");
console.log(`\n${fails === 0 ? "PROBES OK" : `${fails} PROBLEM(S)`}`);
process.exit(fails === 0 ? 0 : 1);
