// ═══════════════════════════════════════════════════════════════════════════
// THE CUSTOM ASSERTIONS — what axe and a screenshot diff will not catch.
//
// Every function here runs IN THE PAGE and returns plain data. They are written
// as one injected bundle rather than five `page.evaluate` calls so a single view
// is measured in one layout pass — otherwise a scroll or a hover between calls
// changes what the next one sees.
// ═══════════════════════════════════════════════════════════════════════════

/** Returned to Node as JSON. Kept flat so the reporter can group it any way. */
export const IN_PAGE = () => {
  const out = {
    hScroll: null,
    targets: { fail: [], warn: [] },
    rc6: [],
    vhUsage: [],
  };

  const desc = (el) => {
    const cls = String(el.className || "").slice(0, 60);
    const id = el.id ? `#${el.id}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}`;
  };

  // ── 1. SC 1.4.10 Reflow — no horizontal document scroll ────────────────
  //
  // Measured on the DOCUMENT, not on a container: a scroller that scrolls
  // itself is fine and is the whole point of the DataView/tab-strip work. What
  // fails Reflow is the PAGE moving sideways.
  out.hScroll = {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflows:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  };

  // ── 2. SC 2.5.8 Target Size + the HIG/Material quality bar ─────────────
  //
  // TWO LISTS, REPORTED SEPARATELY AND DELIBERATELY. Under 24×24 is a WCAG AA
  // failure. 24–43 is under HIG's 44 and Material's 48 but legal. Conflating
  // them is how a quality bar gets mistaken for a legal floor, and how a team
  // starts arguing about whether AA is negotiable.
  //
  // THE EFFECTIVE SIZE INCLUDES `::after` EXTENSIONS. The whole touch-target
  // utility introduced in Phase 0 works by growing a transparent pseudo-element,
  // so a checker that reads `getBoundingClientRect` alone would report every
  // extended control as still failing and the fix as having done nothing.
  const INTERACTIVE =
    'a[href],button,input,select,textarea,summary,[role="button"],' +
    '[role="switch"],[role="tab"],[role="radio"],[role="checkbox"],' +
    '[role="combobox"],[role="menuitem"],[tabindex]:not([tabindex="-1"])';

  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (el.closest("[data-responsive-ignore]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue; // not rendered
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;

    const a = getComputedStyle(el, "::after");
    const grow = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? -n : 0; // negative inset grows outward
    };
    let w = r.width;
    let h = r.height;
    if (a.content && a.content !== "none" && a.position === "absolute") {
      w += grow(a.left) + grow(a.right);
      h += grow(a.top) + grow(a.bottom);
    }
    w = Math.round(w);
    h = Math.round(h);

    const label = (
      el.getAttribute("aria-label") ||
      el.textContent ||
      el.getAttribute("name") ||
      ""
    )
      .trim()
      .slice(0, 40);
    const entry = { el: desc(el), label, w, h };
    if (w < 24 || h < 24) out.targets.fail.push(entry);
    else if (w < 44 || h < 44) out.targets.warn.push(entry);
  }

  // ── 3. THE RC-6 GUARD — the important one ──────────────────────────────
  //
  // An element whose content is wider than its box, sitting inside an
  // `overflow-hidden` ancestor, with NO scrollable ancestor in between. That is
  // content the reader cannot reach by any means — the exact shape of the
  // relationship-table clip (300px of table, unreachable by wheel, drag or
  // touch) that Phase 5 fixed.
  //
  // TWO CLASSES OF FALSE POSITIVE ARE EXCLUDED, and both are deliberate design:
  //   · DELIBERATE TRUNCATION — `truncate` / `line-clamp` set overflow hidden ON
  //     THE ELEMENT ITSELF and mean "show an ellipsis". Detected by computed
  //     `text-overflow: ellipsis` or a line clamp, not by class name, so a
  //     hand-rolled truncation is caught too.
  //   · `sr-only` — clips to 1px by design to hide visually while staying in the
  //     accessibility tree.
  const isDeliberateTruncation = (el) => {
    const cs = getComputedStyle(el);
    if (cs.textOverflow === "ellipsis") return true;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== "none") return true;
    // sr-only: 1px box with clip / clip-path
    const r = el.getBoundingClientRect();
    if (r.width <= 1 && r.height <= 1) return true;
    return false;
  };

  const scrollable = (v) => v === "auto" || v === "scroll" || v === "overlay";
  const clipping = (v) => v === "hidden" || v === "clip";

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    for (const axis of ["x", "y"]) {
      const over =
        axis === "x"
          ? el.scrollWidth - el.clientWidth
          : el.scrollHeight - el.clientHeight;
      if (over <= 2) continue; // sub-pixel noise
      if (isDeliberateTruncation(el)) continue;

      // Walk from the element outward. The FIRST ancestor (including the element
      // itself) that scrolls on this axis rescues the content; the first that
      // clips without a scroller before it condemns it.
      let node = el;
      let verdict = null;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        const v = axis === "x" ? cs.overflowX : cs.overflowY;
        if (scrollable(v)) {
          verdict = "reachable";
          break;
        }
        if (clipping(v)) {
          verdict = node === el ? "self-clip" : "clipped";
          break;
        }
        node = node.parentElement;
      }
      if (verdict === "clipped" || verdict === "self-clip") {
        out.rc6.push({
          axis,
          lostPx: Math.round(over),
          el: desc(el),
          clippedBy: node ? desc(node) : null,
          kind: verdict,
        });
      }
    }
  }

  // ── 5. `100vh` MUST STAY AT ZERO ───────────────────────────────────────
  //
  // Runtime rather than a grep, because a `vh` value can arrive from a computed
  // style, a token, or a third-party stylesheet that no source search covers. On
  // mobile Safari `vh` is the LARGEST viewport, so a `100vh` box is taller than
  // the visible area whenever the URL bar is showing.
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    for (const prop of ["height", "minHeight", "maxHeight"]) {
      const raw = el.style?.[prop] || "";
      if (/\b\d+vh\b/.test(raw)) {
        out.vhUsage.push({ el: desc(el), prop, value: raw });
      }
    }
    void cs;
  }

  return out;
};

/** ── 4. SC 2.4.11 Focus Not Obscured ──────────────────────────────────────
 *
 *  THE THRESHOLD IS "ENTIRELY HIDDEN", NOT "TOUCHED". SC 2.4.11 (AA) reads
 *  "not ENTIRELY hidden due to author-created content"; partial obscuring is
 *  2.4.12, which is AAA and not the bar `03-DEFINITION-OF-DONE.md` sets. A first
 *  version of this check flagged any overlap with any fixed or sticky element
 *  and reported 288 hits across three views — not a finding, a broken checker.
 *
 *  IT USES THE BROWSER'S OWN HIT-TESTING rather than comparing rectangles.
 *  `elementFromPoint` accounts for paint order, z-index, stacking contexts and
 *  transforms — all the things a rect comparison guesses at and gets wrong. A
 *  sticky ANCESTOR of the focused element trivially overlaps it and obscures
 *  nothing, which is most of what the rect version was reporting.
 *
 *  A grid of nine points is sampled. If every one of them hit-tests to something
 *  that is neither the focused element nor in its ancestor/descendant chain, the
 *  element is entirely covered. If the rect sits outside the viewport after the
 *  browser's own scroll-into-view, that is also a failure and a more interesting
 *  one — it means fixed chrome pushed it out of reach entirely. */
export async function focusNotObscured(page, maxTabs = 60) {
  return page.evaluate(async (max) => {
    const focusables = [
      ...document.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ),
    ].filter((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden";
    });

    const related = (hit, el) =>
      hit === el || el.contains(hit) || hit.contains(el);

    const hits = [];
    let checked = 0;
    for (const el of focusables.slice(0, max)) {
      el.focus({ preventScroll: false });
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const r = el.getBoundingClientRect();
      checked++;

      const offscreen =
        r.bottom <= 0 ||
        r.top >= innerHeight ||
        r.right <= 0 ||
        r.left >= innerWidth;
      if (offscreen) {
        hits.push({
          focused:
            (el.getAttribute("aria-label") || el.textContent || "")
              .trim()
              .slice(0, 40) || el.tagName.toLowerCase(),
          reason: "offscreen after scroll-into-view",
        });
        continue;
      }

      // Nine sample points, inset 2px so a border does not hit the neighbour.
      const xs = [r.left + 2, r.left + r.width / 2, r.right - 2];
      const ys = [r.top + 2, r.top + r.height / 2, r.bottom - 2];
      let covered = 0;
      let sampled = 0;
      let by = null;
      for (const x of xs) {
        for (const y of ys) {
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
          sampled++;
          const hit = document.elementFromPoint(x, y);
          if (!hit) continue;
          if (!related(hit, el)) {
            covered++;
            by ??=
              hit.tagName.toLowerCase() +
              (hit.getAttribute("data-slot")
                ? `[${hit.getAttribute("data-slot")}]`
                : "");
          }
        }
      }
      if (sampled > 0 && covered === sampled) {
        hits.push({
          focused:
            (el.getAttribute("aria-label") || el.textContent || "")
              .trim()
              .slice(0, 40) || el.tagName.toLowerCase(),
          obscuredBy: by,
          reason: "entirely covered",
        });
      }
    }
    return { checked, capped: focusables.length > max, hits };
  }, maxTabs);
}
