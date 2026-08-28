# Definition of Done

A view-state may only be marked `verified` in the tracker when **all** of these hold. No partial credit.

## Accessibility — WCAG 2.2 AA, non-negotiable

- [ ] No horizontal scroll at 320px CSS width — **SC 1.4.10 Reflow**
- [ ] Every interactive target ≥44×44pt (HIG) / 48dp (Material 3); none below 24×24 — **SC 2.5.8 Target Size (Minimum)**
- [ ] Visible focus on every interactive element, at every breakpoint — **SC 2.4.7**
- [ ] Focused element never obscured by fixed or sticky chrome — **SC 2.4.11 Focus Not Obscured**
- [ ] Every drag interaction has a single-pointer alternative — **SC 2.5.7 Dragging Movements**
- [ ] Operable in both orientations — **SC 1.3.4**
- [ ] Legible and operable at 200% text-only zoom, and at 1280px @ 400% browser zoom — **SC 1.4.4**
- [ ] Colour is never the sole carrier of meaning — **SC 1.4.1**
- [ ] Keyboard and screen-reader order remain logical after any breakpoint reflow
- [ ] axe-core: zero violations at every viewport

## Overflow — RC-6 guard

- [ ] No element whose content width exceeds its container sits inside an `overflow-hidden` ancestor without an overflow escape
- [ ] Every overlay (dialog, menu, popover, sheet) has a height bound and scrolls rather than clipping
- [ ] `100dvh`, never `100vh`
- [ ] `env(safe-area-inset-*)` respected on all fixed/sticky chrome

## Touch

- [ ] No hover-only affordance without a touch equivalent
- [ ] No native `title=` attribute carrying information the user needs
- [ ] Adjacent controls have enough separation that mis-taps aren't likely (steppers, ± pairs, icon clusters)
- [ ] Any horizontally scrolling strip has a **visible** overflow affordance — scroll-with-no-signal fails Nielsen #6

## Content and states

- [ ] Empty, loading, error and partial states all designed at mobile — not just the happy path
- [ ] Body measure 45–75 characters at every breakpoint (~66 ideal)
- [ ] No truncation that destroys meaning; deliberate truncation only, with the full value reachable
- [ ] No content deleted at a breakpoint to avoid solving the layout. If something genuinely shouldn't exist on a phone, that's a product decision recorded in `design-system-gaps.md`, not a `hidden lg:` class

## System coherence

- [ ] Zero off-scale spacing values — every gap, pad and margin is a token
- [ ] All colour and type from Bloom tokens; no new hexes, no orphaned literals
- [ ] Any Bloom extension is documented with its rationale, its cost, and a path back into the system
- [ ] Aligned to the grid; related items closer than unrelated (Law of Proximity)

## Verification

- [ ] Screenshot-diffed at 320 / 390 / 430 / 768 / 1024 / 1280
- [ ] Verified under every persona and lifecycle state that reaches this view
- [ ] Tracker row updated with the evidence
