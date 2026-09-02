// THE ANCHORING ENGINE — capture and resolve. PRD R3.
//
// ═══ THE FAILURE THIS EXISTS TO PREVENT ═══
//
// A pin that drifts is worse than no pin: it attaches a reviewer's sentence to
// the wrong thing and nobody can tell. So every path through this file ends in
// one of exactly three outcomes, and the outcome is always recorded:
//
//   TIER 1 — the element that was clicked is back. Pin sits on it. Exact.
//   TIER 2 — that element is gone but its tagged REGION is still here. Pin sits
//            in the region at the recorded fraction. Approximate, and known to
//            be approximate.
//   TIER 3 — the region is gone too. ORPHAN. Rendered at its last known document
//            coordinates in the anchor-lost treatment, never silently placed and
//            never silently dropped.
//
// ═══ HOW THE THREE TIERS MAP ONTO Appendix A's FIELDS ═══
//
// The brief lists `elementRef` and the structural path as two things to "try in
// order", which reads as two independent lookups — but a bounded path measured
// FROM the nearest tagged ancestor cannot be tried when that ancestor is missing.
// So they are a degradation ladder rather than alternatives, which is the only
// arrangement in which all three tiers can actually fire:
//
//   `elementRef`      names the tagged region  → its survival separates 1/2 from 3
//   `structuralPath`  names the element inside → its survival separates 1 from 2
//
// Logged in GAPS.md (anno-02) as an interpretation, not a fact.
//
// ═══ COORDINATES ARE VIEWPORT, NOT DOCUMENT ═══
//
// `getBoundingClientRect()` already accounts for every scroll offset above the
// element, including nested scrollers — which anno-00 found this app is full of
// (every `/app/*` route scrolls an inner div while the document does not move).
// So a resolved pin is placed in viewport space and the overlay is
// `position: fixed`. `fallbackX/Y` are stored in DOCUMENT space as Appendix A
// specifies, and converted on the way out for tier 3.

/** Attribute name, in one place. */
export const ANNO_REF_ATTR = "data-anno-ref";

/** ═══ VOLATILE: A THING THE PAGE IS SHOWING, NOT A PLACE ON THE PAGE ═══
 *
 *  Marks an element whose existence is tied to a particular record rather than to
 *  the route — a task row, a conversation row. Placement inside one is REFUSED
 *  (see `captureAnchor`), which is the anno-02 gate decision: restrict placement
 *  to stable regions.
 *
 *  Two ways to be volatile, because the naming convention already encodes it:
 *
 *   • an explicit `data-anno-volatile` attribute, or
 *   • a name carrying a per-instance id — `task-row:task-2` — which by definition
 *     names one record.
 *
 *  ═══ WHY REFUSE RATHER THAN ANCHOR TO THE STABLE ANCESTOR ═══
 *
 *  Falling back to the container looks kinder and is worse. The structural path
 *  from a worklist to a row is `div:nth-of-type(k)`, and in a virtualized list k
 *  addresses a WINDOW POSITION, not a row — scroll and the same path resolves to
 *  a different task. That is the misattachment this phase already caught once,
 *  reintroduced by a different route. Dropping the path instead and pinning at a
 *  fraction of the container is no better: the container's box is fixed while
 *  rows scroll underneath, so the pin sits still while its subject moves away.
 *
 *  Neither degradation tells the truth, so placement is refused and the reviewer
 *  is told.
 *
 *  ═══ THE COST IS ACCEPTED, NOT OUTSTANDING ═══
 *
 *  A specific task row or conversation row CANNOT BE ANNOTATED. A reviewer pins
 *  the worklist, the task pane, the conversation list or the composer — never
 *  "this row". That was put to Brandon at the anno-02 gate with the measurement
 *  behind it and accepted, so it is a settled trade rather than a known defect.
 *
 *  WHICH MEANS: DO NOT "FIX" THIS BY ADDING A FALLBACK. Softening the refusal
 *  reintroduces the misattachment this whole mechanism exists to prevent —
 *  measured once already, where four pins on four different tasks all resolved to
 *  the same row while reporting tier 1. If record-level annotation is wanted
 *  later, the route is domain-id anchoring (option (c) in GAPS.md), which does
 *  not go through the DOM at all. */
export const ANNO_VOLATILE_ATTR = "data-anno-volatile";

function isVolatile(el: Element): boolean {
  if (el.hasAttribute?.(ANNO_VOLATILE_ATTR)) return true;
  const name = el.getAttribute?.(ANNO_REF_ATTR);
  return !!name && name.includes(":");
}

/** Is this element inside (or itself) something record-bound? */
export function inVolatileRegion(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (isVolatile(node)) return true;
    node = node.parentElement;
  }
  return false;
}

/** How deep a structural path may go below its tagged ancestor. Beyond this the
 *  path is more likely to be describing an implementation detail than a thing a
 *  reviewer meant, and each extra level is another chance to break. */
const MAX_PATH_DEPTH = 8;

export type Anchor = {
  elementRef: string;
  structuralPath: string | null;
  offsetX: number;
  offsetY: number;
  fallbackX: number;
  fallbackY: number;
  scrollContainer: string | null;
};

export type ResolutionTier = 1 | 2 | 3;

export type Resolved = {
  tier: ResolutionTier;
  /** The element the pin is attached to. `null` only at tier 3. */
  element: Element | null;
  /** Viewport coordinates for rendering. */
  x: number;
  y: number;
  /** True when the anchor resolved but is scrolled out of view inside its
   *  container — a positioned pin that should not be painted, which is different
   *  from an orphan and must not be counted as one. */
  offscreen: boolean;
};

/* ════════════════════════ CAPTURE ════════════════════════ */

/** The chain of tagged ancestors, outermost first.
 *
 *  A CHAIN RATHER THAN THE NEAREST NAME ALONE, because names are only stable if
 *  they are unique, and in a two-pane layout they are not: the same
 *  `conversation-row` exists in the list on `/app/chat` and again beside the
 *  thread. Recording `chat-list/conversation-row` disambiguates without forcing
 *  every name in the app to be globally unique — which is a rule nobody could
 *  keep. */
function refChain(el: Element): string[] {
  const names: string[] = [];
  let node: Element | null = el;
  while (node) {
    const name = node.getAttribute?.(ANNO_REF_ATTR);
    if (name) names.unshift(name);
    node = node.parentElement;
  }
  return names;
}

function selectorForChain(chain: string[]): string {
  return chain.map((n) => `[${ANNO_REF_ATTR}="${cssEscape(n)}"]`).join(" ");
}

/** `CSS.escape` is not in jsdom and not in older Safari. Names are authored
 *  kebab-case so this almost never does anything — it exists so a name with a
 *  stray quote cannot break the selector. */
function cssEscape(s: string): string {
  const g = globalThis as { CSS?: { escape?: (v: string) => string } };
  return g.CSS?.escape ? g.CSS.escape(s) : s.replace(/["\\]/g, "\\$&");
}

/** A bounded CSS path from `ancestor` down to `el`.
 *
 *  `nth-of-type` RATHER THAN `nth-child`, deliberately: sibling wrappers get
 *  added and removed constantly (a conditional `<span>`, a portal marker), and
 *  `nth-child` shifts for every one of them while `nth-of-type` only shifts when
 *  a sibling of the SAME TAG appears. It is the more stable of the two by a wide
 *  margin in a React tree.
 *
 *  Returns null when the element IS the ancestor (nothing to describe) or when
 *  the path would exceed the depth cap. */
function structuralPathBetween(ancestor: Element, el: Element): string | null {
  if (el === ancestor) return null;

  const segments: string[] = [];
  let node: Element | null = el;

  while (node && node !== ancestor) {
    const parent: Element | null = node.parentElement;
    if (!parent) return null;

    const tag = node.tagName.toLowerCase();
    const sameTag = [...parent.children].filter(
      (c) => c.tagName.toLowerCase() === tag
    );
    const index = sameTag.indexOf(node) + 1;
    segments.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${index})` : tag);

    if (segments.length > MAX_PATH_DEPTH) return null;
    node = parent;
  }

  return node === ancestor && segments.length > 0 ? segments.join(" > ") : null;
}

/** The nearest ancestor that scrolls. Returns null for the document.
 *
 *  Checks `scrollHeight > clientHeight` as well as the computed overflow: a
 *  container styled `overflow-y-auto` that is not currently overflowing does not
 *  scroll, and treating it as the scroll parent would register a listener that
 *  never fires while missing the real one further up. */
function nearestScrollContainer(el: Element): Element | null {
  let node: Element | null = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    const scrolls =
      /auto|scroll|overlay/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 1;
    if (scrolls) return node;
    node = node.parentElement;
  }
  return null;
}

/** A selector that will find this scroll container again.
 *
 *  Prefers a tagged name. Falls back to a structural path from the nearest
 *  tagged ancestor, and finally to null — a null `scrollContainer` means "the
 *  document", which is also the honest answer when the container cannot be
 *  described stably, because the reposition observers then fall back to window
 *  scroll rather than binding to something they cannot re-find. */
function describeScrollContainer(container: Element | null): string | null {
  if (!container) return null;
  const own = container.getAttribute(ANNO_REF_ATTR);
  if (own) return `[${ANNO_REF_ATTR}="${cssEscape(own)}"]`;

  const chain = refChain(container);
  if (chain.length === 0) return null;
  const ancestorSel = selectorForChain(chain);
  const ancestor = document.querySelector(ancestorSel);
  if (!ancestor) return null;
  const path = structuralPathBetween(ancestor, container);
  return path ? `${ancestorSel} > ${path}`.replace(" > > ", " > ") : ancestorSel;
}

/** Capture an anchor for a click at `clientX/clientY` on `target`.
 *
 *  `offsetX/offsetY` are the fraction of the ANCHOR ELEMENT's box — where the
 *  anchor element is the deepest thing that will be re-resolved, i.e. the
 *  structural target if there is one and the tagged region otherwise. One
 *  meaning, whichever tier eventually applies, so a fraction never has to be
 *  reinterpreted at load. */
export function captureAnchor(
  target: Element,
  clientX: number,
  clientY: number
): Anchor | null {
  /* ═══ THE anno-02 GATE DECISION, ENFORCED AT CAPTURE ═══
     Refused before anything is measured, so a record-bound anchor cannot be
     created at all rather than being created and later found unreliable. The
     caller distinguishes this from "nothing tagged here" via `whyRefused`. */
  if (inVolatileRegion(target)) return null;

  const chain = refChain(target);
  /* NO TAGGED ANCESTOR = NO ANCHOR. Returning null rather than inventing a
     document-rooted path: a pin whose only anchor is "the 4th div in the body"
     is a tier-3 orphan the moment anything reflows, and creating it would inflate
     the orphan rate with pins that never had a chance. The UI's answer is to
     refuse placement there. */
  if (chain.length === 0) return null;

  /* ═══ THE REGION MUST BE THE DEEPEST *UNIQUE* PREFIX ═══
   *
   *  Taking the whole chain looks right and is not. Measured in the anno-02
   *  spike: four pins placed on four different rows of the tasks worklist all
   *  captured `app-main/tasks-worklist-scroller/task-row`, because the name
   *  repeats on all 15 mounted rows — and `querySelector` returns the first. All
   *  four then resolved to the same row, reporting TIER 1 while pointing at the
   *  wrong task. A confident pin on the wrong thing is the exact failure R3
   *  exists to prevent, and it is worse than an orphan because nothing shows.
   *
   *  So the region is the deepest prefix of the chain that identifies exactly one
   *  element, and everything below it is described by the structural path — which
   *  is what that field is for. Walking from the deepest inward keeps the most
   *  specific anchor that is still unambiguous. */
  let regionChain: string[] | null = null;
  for (let i = chain.length; i >= 1; i--) {
    const candidate = chain.slice(0, i);
    if (document.querySelectorAll(selectorForChain(candidate)).length === 1) {
      regionChain = candidate;
      break;
    }
  }
  /* Nothing in the chain identifies one element — every tagged ancestor repeats.
     Refusing to capture is the honest outcome: any anchor written here would
     resolve to an arbitrary sibling. */
  if (!regionChain) return null;

  const regionSel = selectorForChain(regionChain);
  const region = document.querySelector(regionSel);
  if (!region) return null;

  const structuralPath = structuralPathBetween(region, target);
  const anchorEl = structuralPath ? target : region;
  const rect = anchorEl.getBoundingClientRect();

  const offsetX = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
  const offsetY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;

  return {
    elementRef: regionChain.join("/"),
    structuralPath,
    offsetX: clamp01(offsetX),
    offsetY: clamp01(offsetY),
    // DOCUMENT space, per Appendix A.
    fallbackX: Math.round(clientX + window.scrollX),
    fallbackY: Math.round(clientY + window.scrollY),
    scrollContainer: describeScrollContainer(nearestScrollContainer(target)),
  };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/* ════════════════════════ RESOLVE ════════════════════════ */

/** Resolve an anchor against the live DOM. Never throws — a malformed selector
 *  from an older record resolves to an orphan rather than taking down the
 *  overlay that is trying to render fifty pins. */
export function resolveAnchor(anchor: Anchor): Resolved {
  const orphan = (): Resolved => ({
    tier: 3,
    element: null,
    x: anchor.fallbackX - window.scrollX,
    y: anchor.fallbackY - window.scrollY,
    offscreen: false,
  });

  let matches: NodeListOf<Element>;
  try {
    matches = document.querySelectorAll(selectorForChain(anchor.elementRef.split("/")));
  } catch {
    return orphan();
  }
  /* ═══ AMBIGUOUS IS UNRESOLVED, NOT "TAKE THE FIRST" ═══
     If the reference matches more than one element it identifies none of them,
     and picking index 0 is how a pin silently lands on the wrong row. An
     ambiguous reference is an ORPHAN — the reader is told the anchor was lost,
     which is true, instead of being shown a confident pin on someone else's
     task. Capture makes this rare by choosing a unique prefix; resolve enforces
     it when the DOM has changed since. */
  if (matches.length !== 1) return orphan();
  const region = matches[0];

  // TIER 1 — the exact element, if a structural path was recorded and still hits.
  if (anchor.structuralPath) {
    let exact: Element | null = null;
    try {
      exact = region.querySelector(`:scope > ${anchor.structuralPath}`);
    } catch {
      exact = null;
    }
    if (exact) return place(exact, anchor, 1);
    // TIER 2 — region survived, the element inside did not.
    return place(region, anchor, 2);
  }

  /* No structural path means the pin was placed on the tagged element itself, so
     finding that element IS the exact resolution. Tier 1, not tier 2 — the
     distinction is whether what was clicked came back, and here it did. */
  return place(region, anchor, 1);
}

function place(el: Element, anchor: Anchor, tier: ResolutionTier): Resolved {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width * anchor.offsetX;
  const y = rect.top + rect.height * anchor.offsetY;

  /* ═══ OFFSCREEN IS NOT ORPHANED ═══
     A resolved element scrolled out of its container is a pin that should not be
     painted this frame. It is emphatically NOT an anchoring failure, and folding
     it into the orphan count would make the PRD's 10% kill criterion fire on
     nothing worse than a scrolled list. Reported separately. */
  const offscreen =
    rect.width === 0 ||
    rect.height === 0 ||
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.top > window.innerHeight ||
    rect.left > window.innerWidth;

  return { tier, element: el, x, y, offscreen };
}

/** How many elements on this page carry a tag. For the instrumentation readout
 *  and the per-route counts in the anno-02 report. */
/** Why `captureAnchor` would refuse here — for the placement UI in anno-03, which
 *  has to say something more useful than nothing happening on click. */
export function whyRefused(target: Element): "volatile" | "untagged" | null {
  if (inVolatileRegion(target)) return "volatile";
  if (refChain(target).length === 0) return "untagged";
  return null;
}

export function countTagged(root: ParentNode = document): number {
  return root.querySelectorAll(`[${ANNO_REF_ATTR}]`).length;
}

export function taggedNames(root: ParentNode = document): string[] {
  return [...root.querySelectorAll(`[${ANNO_REF_ATTR}]`)]
    .map((e) => e.getAttribute(ANNO_REF_ATTR) ?? "")
    .filter(Boolean);
}
