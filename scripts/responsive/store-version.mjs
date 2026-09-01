// THE PERSIST VERSION, READ FROM THE STORE — not typed into each probe.
//
// Nine probe scripts carried `Number(process.env.STORE_VERSION ?? 42)`, and every
// one of them was a landmine: seeding a v43 store with a v42 payload runs the
// migration path instead of the state the probe meant to set up, and it fails
// SILENTLY — the page renders, the checks run, and they measure a scenario the
// harness did not actually seed. Then the number drifts again at v44.
//
// Reading the store is the only version of this that cannot go stale. Same regex
// as `harness.mjs`'s own `readStoreVersion`, and deliberately synchronous so a
// probe can use it in a top-level const.
import { readFileSync } from "node:fs";

const src = readFileSync("src/lib/onboarding/store.ts", "utf8");
const m = src.match(/version:\s*(\d+)/);
if (!m) throw new Error("could not read persist version from store.ts");

/** The env var still wins, so a probe can be pointed at an older payload on
 *  purpose — which is a real thing to want when testing a migration. */
export const STORE_VERSION = Number(process.env.STORE_VERSION ?? m[1]);
