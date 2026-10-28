# Monitoring v4 — context report (no strips, a real Tier 1 queue, last elevation pass)

The branch is `proto/monitoring-v4`, cut from `main` at `7517e58` (pack v11 merged). It is local only: no push, no remote, no PR. The dev server on :3000 serves this branch. No code has changed. Nothing here touches `/app/chat`.

## What exists today

### The alert strip
- **Component:** `components/monitoring/overview/tier1-alert-strip.tsx` (`role="alert"`).
- **Where it renders:** only on Monitoring (`monitoring-overview.tsx:154`). **Today does not render it.** Today has its own urgent escalation rows (`today/today-escalations.tsx`, rendered at `today-page.tsx:1182`); those are the "live lane" in the brief.
- **Its four states:** unanswered, acknowledged (the clock stops), joined (a slim bar), and held by another supervisor (Observe · Hand to me).
- **The clock:** `lib/monitoring/alert-clock.ts` ticks once a second from `T1_RESPONSE_SECONDS = 60`. `responseClock` renders "0:00 left" past zero, which is the failure the brief names.

### The other surfaces
- **Hero** (`hero-metrics.tsx`): five fixed 120px `<div>`s, deliberately not clickable since v1. The In-crisis cell is filled `t1-soft` with a pulsing dot.
- **Tier 1 lane** (`tier1-lane.tsx`): rows on `t1-soft` with a `t1` keyline. A row runs together the avatar and presence dot, name, `T1`, mentor, "· stage", the dashed `RequestedChip`, flags, a presence chip and "Join · m:ss". Tier 1 is already never cards: card view renders the same lane.
- **List view** (`tier-list.tsx`): seven subgrid columns and a sticky 12/16 tertiary header. Tier 2 list rows take `t2-soft` (`tier-bits.tsx:35`). "Show all" is a full-width button.
- **Section header** (`tier-bits.tsx:94`): already 17/24 Avantt, a 15px tertiary count, ⓘ, `pt-8 pb-4`.
- **Sparkline** (`ui/bar-sparkline.tsx`): rows use 18px tall bars, 4px wide, `border-strong`.
- **Page subtitle hairline:** the shared `PageHeader`'s `border-b` (`ia/page-header.tsx:115`). **Care Reviews renders it too**, so the premise is wrong; see conflict 8.
- **Tray** (`app-shell/activity-bell.tsx` + `tiering/escalation-notices.tsx`): one "Escalations" group, capped at 5, then the Activity ledger. Opening the bell marks everything seen; **there is no "Mark all read" control.** Tier 1 notices carry `urgent`, which nothing styles.
- **Dev scenarios** (`lib/monitoring/monitoring.mock.ts`): twelve Watch and eight Events.
  - Strip-only: `m3-alert-acked`, `m3-alert-joined`, `m3-alert-other`.
  - Mostly strip: `m3-alert-unacked`, `m3-two-t1`.
  - Probes that assert strip states: `monitoring-scenarios.mjs:48–58` and `monitoring-tiers.mjs` §5 (including "no sound toggle", `:505`).

## Conflicts, each with a proposed default

1. **"Keep the sound and its mute control, move them to the tray."** Neither exists, and a probe asserts there is no sound. **Default:** build both new in the tray.
   - A short Web Audio tone on the arrival of an unconfirmed Tier 1, with no new dependency and no audio file.
   - A mute toggle in the tray header, persisted per persona.
   - Off under `prefers-reduced-motion`? No — sound is not motion, so it stays on unless muted.
2. **The stepper's order, "Requested → Confirmed → Assessment → Note", is not this product's sequence.** Since v3 the mentor assesses first and the supervisor confirms after the assessment arrives. Confirm waits on it (S0 → S1), so "Confirmed · assessing 2 of 3" cannot occur.
   - **Default:** **Requested → Assessment → Confirmed → Note**, with labels from the real stage. Examples: "Assessment in · 2 of 6", "Awaiting confirmation", "Confirmed by Sarah · 0:48", "Note in progress · 3 of 7". The note's count comes from the stored note, which v11 posts atomically, so "in progress" reads "Note in progress" without a count.
3. **Holder is not data.** "Who has it" lives only in the alert clock's in-memory `heldBy`. **Default:** derive the Holder column without inventing anything new:
   - "You" when this supervisor has joined or confirmed
   - the confirming supervisor's name once confirmed
   - the scenario's `heldBy` for "Held by Sarah"
   - "—" otherwise

   Join, Observe and Resume follow from that. "Resume" means you joined, left, and the escalation is still open: session state, not stored.
4. **"Zero in `text-disabled`."** `--text-disabled` does not exist, and v2 answered that a zero is `text-muted` (AA), not Bloom's text/disabled at about 1.5:1. **Default:** `text-muted`.
5. **"15 semibold" and "17/24 semibold."** Weight is not a channel: only Lausanne 400 ships. **Default:** names in Avantt (`font-display`), as v2 answered.
6. **"Mark-all-read never clears unconfirmed Tier 1 rows."** There is no mark-all-read; opening the bell marks things seen. **Default:** a "Needs you now" group of unconfirmed Tier 1 rows that **ignores** seen-state. It stays until confirmation, while the badge counts it. No mark-all-read control is added.
7. **"Join (filled `t1`, white text)."** White on `--t1` (#d2372a) measures about 4.7:1. That passes for a 15px label, so **default:** `--t1` fill and `--text-inverse`, checked in both themes. In dark, `--t1` is #f0695c and white on it fails, so the dark fill is `--t1-ink` with inverse text, as the lozenges already do.
8. **"Remove the hairline under the subtitle; Care Reviews doesn't have it."** Both pages use the shared `PageHeader`, and Care Reviews renders the same hairline. **Default:** remove it from `PageHeader`, so both lose it. The toolbar's 40px stays the separator, and header parity (Monitoring v3) holds.
9. **"Risk flags and Escalations → Events with the filter preset."** Events filters live in a popover with no URL form. **Default:** add `?tab=events&type=flag|escalation` deep links, read into the filter state (derived, never an effect), so the hero cells link to them.
10. **"No amber or red fills anywhere except the Tier 1 soft container at 40% and the Join button."** The In-crisis hero cell's `t1-soft` fill goes. The cell keeps its dot before the numeral and drops it at zero. The record `TierCard` (`tier-card.tsx`) also fills Tiers 1–2, but it is on the record, outside this scope. **Default:** leave it and say so.
11. **Supersessions to record in AGENTS.md:**
    - Monitoring v3's "the alert's answer is a state", where strips are replaced by the tray and the queue
    - "Fill only in the live Tier 1 lane", where the lane becomes the 40% container
    - v2's "hero not clickable", where the cells become buttons
    - "scenarios are twenty"

## Plan (local commits, one per section)

1. **§1:** delete the strip, alert-clock's countdown formatting and the strip-only scenarios. Make the In-crisis cell a button. Add a hidden live region.
2. **§2:** the queue — the container, the six columns, the stepper, Response, Holder, Action and the sort.
3. **⏸ Stop for your review after §2,** as the brief asks.
4. **§3:** elevation — hero buttons, the sticky header, Tier 2 rows, one home for presence, sparklines, the "Show all" button and the subtitle hairline.
5. **§4:** the tray — "Needs you now", sound and mute.
6. **§5:** dev scenarios — renumbered, with strip-only scenarios removed. The monitoring probes are retargeted, and the strip assertions become queue and tray assertions.
