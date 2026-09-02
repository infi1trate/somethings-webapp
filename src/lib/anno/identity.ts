// WHO IS WRITING — R9.
//
// ═══ THE CLIENT ID IS THE IDENTITY, AND IT IS THE ONLY ONE ═══
//
// A UUID, generated once per browser, persisted, and thereafter the primary key
// for authorship. It is not a login and does not pretend to be: two people on one
// laptop are one reviewer, and one person on a laptop and a phone is two. That is
// the honest ceiling of a prototype with no accounts, and naming it here stops it
// being quietly overstated later.
//
// ═══ WHY `authorIpHint` IS INERT BY CONSTRUCTION ═══
//
// Appendix A carries `authorIpHint: string | null` and calls it a "secondary hint
// only, never identity". A rule like that survives exactly as long as the person
// who wrote it, so it is enforced structurally instead:
//
//   • This module does not read, derive, or expose an IP. It cannot — a browser
//     has no access to its own egress address.
//   • `NewComment` has no `authorIpHint` field, so a client cannot send one.
//   • The value is stamped server-side and is write-only from the client's view.
//   • Nothing in this file, or in the store adapters, ever GROUPS, MATCHES or
//     COMPARES on it. Grouping is `authorClientId`, always.
//
// So the field can exist for forensic recall without ever becoming a second,
// weaker identity that slowly acquires meaning.
//
// ═══ THE NAME IS NOT STORED ON THE COMMENT ═══
//
// See `types.ts`. This module owns generating a DEFAULT name; the `Reviewer`
// record owns the current one; `resolveDisplayName` reads it at render. A rename
// is one write to one record and applies to everything retroactively.

import type { Reviewer } from "@/lib/anno/types";

/** ═══ THE STORAGE KEYS ═══
 *
 *  `somethings.` prefix, dot-separated, kebab-case within a segment — the
 *  convention already in use for `somethings.mentor-onboarding`,
 *  `somethings.theme` and `somethings.review-draft.{teenId}.{reviewId}`.
 *
 *  `localStorage`, NOT `sessionStorage`, and that is a deliberate departure from
 *  the review-draft precedent. A draft holds clinical prose and is scoped to a
 *  session on purpose; a client id holds no content at all, and losing it every
 *  session would mint a new reviewer on every tab — filling the roster with
 *  strangers and making "who said this" unanswerable. The id is the one thing
 *  here that has to outlive the session. */
const CLIENT_ID_KEY = "somethings.anno.client-id";
const DISPLAY_NAME_KEY = "somethings.anno.display-name";

/** Every storage touch goes through this. Browsers throw on `localStorage` in
 *  more situations than is commonly assumed — Safari private mode, a full quota,
 *  a blocked-cookies setting — and a thrown identity lookup would take down the
 *  whole annotation layer at import time. */
function safeGet(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** `crypto.randomUUID` is available in every browser this prototype targets and
 *  in Node 19+. The fallback exists for a non-secure context (plain `http://` on
 *  a LAN address, which is exactly how someone demos this from a phone), where
 *  `randomUUID` is undefined. It is not cryptographically equivalent and does not
 *  need to be — this is a correlation key, not a secret. */
function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return `anno-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ═══ THE FRIENDLY NAME ═══
 *
 *  Two words, adjective + animal. The brief's bar is that it be "memorable enough
 *  to say out loud in a review" — so the test each word has to pass is whether
 *  "Quiet Finch says the pin overlaps the composer" reads as a sentence about a
 *  person.
 *
 *  What is deliberately NOT in these lists:
 *
 *   • Nothing evaluative about the bearer. No "Clever", no "Lazy", no "Grumpy" —
 *     a reviewer does not choose their name, so it must not be a verdict on them.
 *   • No animals with a settled pejorative sense in English (rat, snake, pig,
 *     weasel, sloth). Being assigned one reads as a comment, not a label.
 *   • Nothing gendered, and nothing that reads as a real given name.
 *   • Nothing that collides with this product's own vocabulary — no clinical
 *     words, and none of the terms the codebase has ruled out.
 *
 *  16 × 24 = 384 combinations. With ~10 reviewers the chance of any collision is
 *  around 11%, which is why `nameFor` is seeded by client id and
 *  `uniqueDisplayName` deconflicts against the live roster rather than trusting
 *  the space to be big enough. */
const ADJECTIVES = [
  "Amber", "Quiet", "Copper", "Rapid", "Slate", "Golden", "Wandering", "Bright",
  "Northern", "Velvet", "Autumn", "Silver", "Patient", "Cobalt", "Steady", "Willow",
] as const;

const ANIMALS = [
  "Otter", "Finch", "Heron", "Marten", "Falcon", "Bison", "Lynx", "Sparrow",
  "Badger", "Kestrel", "Dolphin", "Ibis", "Puffin", "Osprey", "Hare", "Wren",
  "Stoat", "Curlew", "Beaver", "Swift", "Plover", "Elk", "Egret", "Roe",
] as const;

/** FNV-1a. A hash, not a random draw, so one client id always produces the same
 *  name — a reviewer who clears their display name gets their own name back
 *  rather than a stranger's. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The deterministic name for a client id. Exported for tests and for rendering a
 *  reviewer whose record has not arrived yet. */
export function nameFor(clientId: string): string {
  const h = hash(clientId);
  const a = ADJECTIVES[h % ADJECTIVES.length];
  const n = ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length];
  return `${a} ${n}`;
}

/** The same name, deconflicted against everyone already in the roster.
 *
 *  Walks the animal list before the adjective list, so the second "Amber Otter"
 *  becomes "Amber Finch" rather than "Quiet Otter" — a different animal is easier
 *  to hear across a table than a different adjective. Only if the whole space is
 *  exhausted does it suffix a digit, which is the "User 3" outcome the brief
 *  rules out and is therefore the last resort rather than the first. */
export function uniqueDisplayName(
  clientId: string,
  taken: readonly Reviewer[]
): string {
  const used = new Set(
    taken.filter((r) => r.clientId !== clientId).map((r) => r.displayName)
  );
  const h = hash(clientId);
  const adjIndex = h % ADJECTIVES.length;
  const animIndex = Math.floor(h / ADJECTIVES.length) % ANIMALS.length;

  for (let da = 0; da < ADJECTIVES.length; da++) {
    for (let dn = 0; dn < ANIMALS.length; dn++) {
      const candidate = `${ADJECTIVES[(adjIndex + da) % ADJECTIVES.length]} ${
        ANIMALS[(animIndex + dn) % ANIMALS.length]
      }`;
      if (!used.has(candidate)) return candidate;
    }
  }
  let n = 2;
  while (used.has(`${nameFor(clientId)} ${n}`)) n++;
  return `${nameFor(clientId)} ${n}`;
}

/** ═══ COLOUR CHIPS — NOT DESIGN-SYSTEM TOKENS ═══
 *
 *  `Reviewer.colorChip` needs a value and the Bloom token set has no
 *  per-identity palette: every high-visibility hue in it already carries meaning
 *  (see anno-00 §5). Per Appendix B, that is logged in GAPS.md rather than
 *  minted as a token here.
 *
 *  These are therefore INTERIM literals, deliberately not `--anno-*` variables,
 *  so nothing downstream can mistake them for a sanctioned ramp. They are only
 *  ever a small chip beside a name — they are NOT the pin fill, which Appendix B
 *  specifies separately and which anno-04 measures for contrast. */
const CHIPS = [
  "#7b5bd6", "#2933fb", "#0f8a8a", "#b8560e", "#8f3f9e", "#1f6f4a",
  "#a3562c", "#3a5bb8",
] as const;

export function chipFor(clientId: string): string {
  return CHIPS[hash(clientId) % CHIPS.length];
}

/** ═══ THE CLIENT ID, READ OR MINTED ═══
 *
 *  Idempotent: repeated calls in one session return the same value, and a call in
 *  a later session returns the persisted one.
 *
 *  IF STORAGE IS UNAVAILABLE this still returns a usable id — a fresh one, cached
 *  in memory for the life of the page. Authorship then works for the session and
 *  is lost on reload, which is a worse experience but a working one, and it is
 *  strictly better than an identity call that throws. The caller can ask whether
 *  that happened via `identityIsPersistent()`. */
let memoryClientId: string | null = null;

export function getClientId(): string {
  if (memoryClientId) return memoryClientId;
  const stored = safeGet(CLIENT_ID_KEY);
  if (stored) {
    memoryClientId = stored;
    return stored;
  }
  const minted = uuid();
  safeSet(CLIENT_ID_KEY, minted);
  memoryClientId = minted;
  return minted;
}

/** False when the id could not be written — the UI should say identity is
 *  session-only rather than letting a reviewer believe their name will stick. */
export function identityIsPersistent(): boolean {
  return safeGet(CLIENT_ID_KEY) !== null;
}

/** The reviewer's own chosen name, if they have set one. */
export function getStoredDisplayName(): string | null {
  return safeGet(DISPLAY_NAME_KEY);
}

export function setStoredDisplayName(name: string): boolean {
  return safeSet(DISPLAY_NAME_KEY, name);
}

/** The `Reviewer` record for this device: the stored name if one was chosen,
 *  otherwise the generated one, deconflicted against the roster. */
export function selfReviewer(roster: readonly Reviewer[] = []): Reviewer {
  const clientId = getClientId();
  return {
    clientId,
    displayName: getStoredDisplayName() ?? uniqueDisplayName(clientId, roster),
    colorChip: chipFor(clientId),
    lastSeenAt: new Date().toISOString(),
  };
}

/** TEST SEAM. Clears the in-memory cache so a suite can exercise minting more
 *  than once in one process. Not for application code. */
export function __resetIdentityForTests(): void {
  memoryClientId = null;
}
