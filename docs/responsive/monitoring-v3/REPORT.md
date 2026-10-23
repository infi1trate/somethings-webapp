# Monitoring v3: report

Branch `proto/monitoring-v3`, stacked on `feat/care-v5`. Local commits only, nothing pushed.

| Commit | Section |
|---|---|
| c466756 | §1 header parity |
| 2d37965 | §2 no reflow |
| a609d7f | §3 tier headers |
| 43bb6d3 | §4 cards |
| 5e44f9d | §5 Events |
| d0bfe5b | §6 scenarios |

**Probes:**
- `monitoring-v3.mjs`: 81 checks.
- `monitoring-scenarios.mjs`: all 20 scenarios through the dev bar, both tabs, zero console errors.
- Retargeted where v3 superseded them: `monitoring-tiers`, `-watch`, `-events`.

**Mutation testing:** 11 of 11 killed. One mutant survived the first run, an Open dot in the alert hue at every tier; the fixture only had an open Tier 1. An open Tier 3 check now kills it.

## Acceptance

| Criterion | Measured |
|---|---|
| Shared header | `PageHeader` on both pages. The title is 32/40 Avantt at (280, 88) on both, the date line 16/24 sans `text-secondary` at y=132, the toolbar row 44 tall at y=213. |
| Zero layout shift | Every header, toolbar, hero and hero-cell rect is identical across Watch ↔ Events. The content cross-fades over 120ms, and doesn't under reduced motion. |
| Tier headers | One line at 17/24. The cadence sits behind a 20px ⓘ whose tooltip shows on hover and focus, dismisses with Esc, and is wired by `aria-describedby`. |
| Cards | White, with the tier as a contour. No tint fill outside the live Tier 1 lane. The engagement block is labelled, with the sparkline under the numeral; the signals are icon-led; Tier 4 shows as rows. |
| Events | One toolbar row with a Filters popover and badge. Repeats collapse. State is quiet text. Day headers are sticky. Windowed by day. |
| Scenarios | All 20 are selectable from the dev bar, plus Reset. |
| AA | Card text in light: 7.63 · 5.34 · 5.30 · 16.64. In dark: 6.16 · 4.71 · 4.71 · 13.30. Tier is never colour alone (tag, words, lozenge). |

## Token notes

- **Tier 2:** `--t2` is unchanged. As a 45% contour it reads clean, and Bloom has no cooler warm to move to, so there's no swatch to propose.
- **Sunken:** `--surface-sunken` equals the page canvas. The Events glyph circles therefore use `--surface-sunken-strong`, and row hover uses `--tint-hover`.
- **Disabled:** `--text-disabled` doesn't exist. Zero counts use `text-muted`, which passes AA.
- **Weight:** "Semibold" can't render in Lausanne, so the face (Avantt) carries the emphasis.

## Found and fixed along the way

- **Tooltip overflow:** a centred, invisible cadence tooltip widened a 320px canvas by 31px.
- **Presence chip:** it couldn't shrink, and ran 122px past its card in the long-names scenario.
- **Events windowing:**
  - The observer was clipped by the shell's scroller.
  - A day a filter moved to the top stayed a placeholder.
- **Copy:** "Assessment suggests:" appeared twice in the Care ledger. This was found by the v5 probe.

## Deferred

- **Sessions:** Observe and Join have no session to enter yet (`TODO(monitoring)`).
- **Pre-existing failures:** `tasks-frame` and `tasks-a2-states` fail identically on the base branch.
