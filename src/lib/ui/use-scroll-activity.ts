// ═══════════════════════════════════════════════════════════════════════════
// §2 · "APPEARS ON SCROLL", WITHOUT REACT STATE
//
// §2 asks the scrollbar to appear "on scroll and on hover of the scrollable
// region, fad[ing] at rest". Hover and focus are CSS — see `.scroll-slim` in
// `globals.css`. "On scroll" is the half CSS cannot express, because there is no
// `:scrolling` pseudo-class.
//
// ═══ A DOM ATTRIBUTE, NOT A `useState` ═══
//
// The obvious shape is `const [scrolling, setScrolling] = useState(false)` with
// a timeout. THAT WOULD RE-RENDER THE LIST ON EVERY SCROLL EVENT — a 123-row
// virtualised list, twice per gesture, for a cosmetic fade. And the repo has
// form: `react-hooks/set-state-in-effect` is an error here, and the one place
// that needed cross-render scroll state reached for `useSyncExternalStore`
// rather than effects.
//
// So this writes `data-scrolling` straight onto the node and React never hears
// about it. The attribute is the state, the stylesheet is the consumer, and the
// render path is untouched — which is also why it is safe on a virtualiser whose
// own scroll handler is doing real work on the same events.
//
// ═══ `passive`, BECAUSE THIS MUST NOT COST A FRAME ═══
//
// A non-passive scroll listener blocks the compositor until it returns. This one
// sets an attribute and a timer; declaring it passive tells the browser it will
// never call `preventDefault`, so scrolling stays on the compositor thread.

import { useEffect, useRef } from "react";

/** How long the bar stays awake after the last scroll event. 900ms is the macOS
 *  convention this is imitating — long enough that a reader who pauses
 *  mid-gesture does not watch it vanish and return, short enough that it is gone
 *  by the time they have read the row they stopped on. */
const REST_MS = 900;

/** Attaches the `data-scrolling` lifecycle to a scrolling element.
 *
 *  THE REF IS THE SCROLLER ITSELF, not a wrapper — `.scroll-slim` styles the
 *  element whose `::-webkit-scrollbar` is being drawn, so the attribute has to
 *  land on that same element for the selector to match. */
export function useScrollActivity(ref: React.RefObject<HTMLElement | null>): void {
  /* The timer survives re-renders without being one of their inputs. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      el.setAttribute("data-scrolling", "true");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        /* THE NODE MAY BE GONE. A virtualised list unmounts its scroller on a
           route change, and a timer that fires afterwards would be writing to a
           detached element — harmless, but `removeAttribute` on null is not. */
        el.removeAttribute("data-scrolling");
        timer.current = null;
      }, REST_MS);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer.current) clearTimeout(timer.current);
      /* LEAVE NOTHING BEHIND. If the effect re-runs because the ref changed, a
         stale `data-scrolling` would keep the old bar lit. */
      el.removeAttribute("data-scrolling");
    };
  }, [ref]);
}
