# TierSelect Unification — pack v10.0 + amendment v10.1: report

- **Branch:** `feat/tier-select`, cut from `main` at `9ddf356`.
- **Audits:** the light audit and the v10.1 token audit are in [PHASE0.md](PHASE0.md).
- **Sequence:** "go" on the v10 defaults. v10.1 arrived mid-build and was folded in before any probe was finalised, so nothing below describes the v10-only anatomy except where marked.

## Gates

- **New probe:** `scripts/responsive/tier-select.mjs`, 82 checks, all passing. It writes:
  - `SR-TRANSCRIPT.md`
  - `legend-contrast.json` and `contrast.json`
  - the five-states grid and the squint image
- **Unit tests:** `src/lib/tiering/__tests__/tier-select.test.ts`, 9 tests covering the canon pairings, both copy tables and every CTA path.
- **Retargeted and passing:** `tiering` 128 · `care-v91` 48 · `care-timeline` 55 · `care-v5` 59 · `care-elevation` 83 · `care-v9` 61 · `care-v61` 26 · `chat-escalation` 57 · `care-v8` 13 · `monitoring-v3` 81 (the selectors moved to `data-tier-*`; the "Adjust to" copy moved to the dynamic CTA; the neutral census in `tiering` now excludes the Tier 1–2 lozenges, so the picker's colour is accounted for, not ignored)
- **Unchanged and passing:** `care-v7` 46 · `support-beside-hub` 89 · `chat-shell` 41 · `chat-chrome` 32 · `support-thread` 50 · `activity-bell` 26 · `monitoring-scenarios` 41
- **typecheck:** clean.
- **lint:** one warning, the `mock-api` `_token` one, which is also on `main`.
- **vitest:** 1,203 passing.
- **Mutation testing:** 11 of 11 killed (§8).

## 1 · Branch, files, retired controls, centralised copy

| File | Change |
|---|---|
| `src/components/tiering/tier-select.tsx` | **New.** `TierSelect` (raise / review) and `mentorFirstName`. |
| `src/lib/tiering/tier-cta.ts` | **New.** The CTA's words, as a pure function. |
| `src/lib/tiering/tiers.ts` | Adds `TIER_CRITERIA`. `RAISE_DESCRIPTION` is marked a blocked constant. |
| `src/components/tiering/raise-flow.tsx` | Hosts raise mode and the platform report. **Its radio list is deleted.** |
| `src/components/chat/escalation/exchange.tsx` | `ConfirmCard` hosts review mode (`kind="confirm"`). **The 2×2 grid is deleted.** |
| `src/components/tiering/tier-update-module.tsx` | `TierUpdateModule` hosts review mode (`kind="update"`). **The grid, the pending block and `GhostButton` are deleted.** |
| `src/components/ui/tier-lozenge.tsx` | An opt-in `legend="outline" \| "filled"` prop. Every existing caller is unchanged. |
| `src/app/settings-tokens.css` | The scoped `--tier-legend-{n}-wash`, `-wash-hover` and `-ink` tokens, light and dark. |
| `src/app/globals.css` | `tier-hold` and `tier-check` (both `motion-safe:` only). |
| `AGENTS.md` | The v10 / v10.1 section, plus two rules marked superseded in place. |

**The copy's one home is `src/lib/tiering/tiers.ts`:**
- `TIER_NAME`
- `RAISE_DESCRIPTION`: the mentor's table, verbatim
- `TIER_CRITERIA`: the supervisor's criteria
- `RAISE_TIERS`

**⚠ Provenance.** The tier matrix is not in this repo, so the criteria are the pack's words, comma-joined, with only the first letter capitalised. They should be replaced with the matrix's own text when it is supplied (Meg / Dr. Nissan).

## 2 · Grep proofs

All from `tier-select.mjs` §8, run across `src` and the probe scripts.

| Proof | Result |
|---|---|
| Swapped pairings: every off-canon number–name pair, in `T1 ·`, `Tier 1 ·` and `1:` forms | **0** |
| `Active risk`, `Medium Risk`, `High Risk`, `Active Crisis` | **0** |
| `iminence` | **0.** The T2 string was already right. |
| Radio glyphs in TierSelect: `role="radio"` or a drawn mark | **0.** One native `type="radio"` per card, `sr-only`. |
| Legend washes read outside TierSelect | **0.** `tier-lozenge.tsx` reads the inks only. |
| Retired controls (`data-raise-option`, `data-s1-tier`, `data-tier-option`, "Adjust to Tier", "Post update") | **0** |
| Tier radiogroups other than TierSelect | **0** |

**Reported, not changed.** Tier 1–2 tints that predate this pack still exist outside TierSelect:
- the record's `TierCard` surface
- Monitoring's `tier-bits`, `tier1-lane` and `hero-metrics`

v10.1 says ambient surfaces "keep the no-wash rule". These are those sanctioned T1–2 status surfaces (Monitoring v3's "fill only in the live Tier 1 lane", and v4's unchanged TierCard), not new washes. They are listed so the claim is exact. Bringing them into line would be its own pass.

## 3 · Mode walkthroughs (each a probe section)

**Raise (§1):**
- **Empty:** nothing is checked, and the first card is the one Tab stop.
- **Empty Confirm:** it names both gaps, puts focus on the group and writes nothing.
- **Select Tier 2:** the lozenge fills, the ring and the check land, and nothing moves (every card keeps its height). Confirm escalation stays ink.
- **Note → Confirm:** the escalation opens with `requested: 2` and the note.
- **Jordan, at Tier 3:** that card is tagged Current and is disabled (raise reads it as information, not a choice).

**Review, confirm-tier (§2):**
- The header row: avatar · "Submitted by …" · time.
- Tier 1 arrives checked, tagged "Requested by … · time".
- The criteria are verbatim.
- The reason is seeded: "Reviewed …'s note: "…"".
- The CTA reads "Confirm Tier 1 · Active crisis", and it is the one filled button.
- **Confirm as-is:** Tier 1 is confirmed.
- **Override:** Arrow to Tier 2. The CTA reads "Confirm Tier 2 · High risk" and the live region says so. Confirm writes a Tier 2 placement (the store's rule: only the request itself is `confirmed`) and the escalation is confirmed at Tier 2. Every earlier event is untouched.
- **Named mentor:** "Requested by Alex · time", "Submitted by Alex Rivera · Mentor", "Reviewed Alex's note".

**Update (§3):**
- **Imani, Tier 2:** her card is checked and tagged Current.
- Tier 4 is disabled, with "Steps down one tier at a time" in words and in its accessible description.
- The CTA reads "Choose a new tier". Pressed, it says "Tier 2 is current — choose another tier." and returns focus to the group.
- **Tier 1:** "Update to Tier 1".
- **Tier 3:** "Update to Tier 3", and the reason field becomes "Exit document — why Imani is ready to step down". Posting appends one event and closes the dialog.
- **A pending mentor step-down request (Simone, Tier 3 → 4):**
  - Tier 4 arrives checked and tagged.
  - The CTA reads "Confirm Tier 4 · General", the reason quotes the request, and the ghost button is "Keep in Tier 3".
  - Overriding gives "Update to Tier 2", announced.
  - Confirming appends one event.

**⚠ A defect found and fixed.** When the store has no signed-in name, `nameOf` returns the role, "The mentor". A first-name split of that read **"Requested by The"** (measured). `mentorFirstName` now keeps the role whole: "Requested by the mentor", "Submitted by the mentor", with the role said once.

## 4 · Screen-reader transcript

[SR-TRANSCRIPT.md](SR-TRANSCRIPT.md) is read from **Chrome's own accessibility tree** over CDP, not from attributes. It gives the computed role, name, checked state and description after each key, which proves the glyph's removal did not take the semantics.

- **Shift+Tab** from the reason field into the group: `radio "Tier 1, Active crisis", checked`, described as "Requested by … at …" followed by the criteria.
- **ArrowDown:** `radio "Tier 2, High risk", checked`. Live region: "Button now reads Confirm Tier 2 · High risk".
- **ArrowDown:** Tier 3, described as "Current tier." plus the criteria.
- **ArrowUp**, then **Tab**: one stop out, to `textbox "Reason — posted to the record"`.
- **Tab:** `button "Confirm Tier 2 · High risk"`.

The platform escape is a separate tab stop after the group, and not a radio.

## 5 · Contrast, both themes

From `legend-contrast.json` and `contrast.json`. Each cell is name / description / lozenge, as text contrast on the card.

| | rest | hover | selected |
|---|---|---|---|
| Light T1 | 14.47 / 6.63 / 5.93 | 12.87 / 5.90 / 5.27 | 14.47 / 6.63 / 6.82 |
| Light T2 | 13.99 / 6.41 / 5.90 | 12.01 / 5.50 / 5.07 | 13.99 / 6.41 / 7.03 |
| Light T3 | 15.32 / 7.02 / 6.63 | 14.45 / 6.62 / 6.25 | 15.32 / 7.02 / 7.20 |
| Light T4 | 14.74 / 6.75 / 6.10 | 12.59 / 5.77 / 5.21 | 14.74 / 6.75 / 6.88 |
| Dark T1 | 14.58 / 6.75 / 7.98 | 12.60 / 5.84 / 6.90 | 14.58 / 6.75 / 10.63 |
| Dark T2 | 13.76 / 6.37 / 8.53 | 11.53 / 5.34 / 7.15 | 13.76 / 6.37 / 12.04 |
| Dark T3 | 12.90 / 5.97 / 10.76 | 10.62 / **4.92** / 8.86 | 12.90 / 5.97 / 16.20 |
| Dark T4 | 14.33 / 6.63 / 7.65 | 12.06 / 5.59 / 6.44 | 14.33 / 6.63 / 10.37 |

Every text clears 4.5:1 on every wash, including the hover step. The lowest is dark T3's description on hover, at 4.92.

**Non-text:**

| Element | Light | Dark |
|---|---|---|
| The emphasis ring (2px ink) vs its wash | 14.47 | 14.58 |
| The emphasis ring vs the panel | 16.64 | 13.30 |
| The check vs its wash | 14.47 | 14.58 |
| The focus-visible ring vs the panel (every tier) | 4.99–5.01 | 4.82–4.86 |
| The Requested by tag (text) | 7.63 | 6.16 |

**⚠ "Unselected cards still read as tappable": the values, stated.**
- On its own, neither the wash nor the hairline makes a resting card read as tappable:
  - wash vs panel: 1.09–1.19:1 light, 1.03–1.10:1 dark
  - hairline vs wash: 1.43–1.56:1 light, 1.69–1.91:1 dark
- At rest, the card's 3:1 cue is the **outline lozenge**: 5.3–10.8:1 on every wash, both themes. The other cues are the card's shape and its name in primary ink.
- Hover deepens the wash a step (wash vs panel rises to 1.15–1.39:1 light) and sets the pointer cursor.
- Focus adds the 4.8–5.0:1 ring.
- The cost: the same as v4's rings, which were never the only cue.

## 6 · Squint test

[05-squint.png](05-squint.png) shows raise and review blurred, side by side. It is the same card, row for row: lozenge · name · line.
- **Raise:** three cards, plain sentences, the quiet link, a note box, Confirm and Cancel.
- **Review:** four cards, the denser criteria, a header row, and the full-width CTA.

The skeleton is shared and the register differs, which is what the pack asks.

[06-five-states.png](06-five-states.png) shows every tier, light and dark, in rest · hover · focus-visible · selected · requested. In the shots, the "Current" tag appears on Tier 3 because Jordan is at Tier 3.

## 7 · Deferred, with reasons

- **The T3 and T4 legend hues (sunshine, forest) were proposals, and are kept** ("keep the proposed tiers", 2026-10-27). The mock's hues never arrived as tokens, and the pack forbids raw hex from it. If that changes, they are one file: `--tier-legend-3-*` and `--tier-legend-4-*`.
- **The dark washes are hand-derived.** Bloom's ramps end in saturated colour, not a dark well. This is the same finding, and the same treatment, as the band triad. The dark inks are real ramp steps.
- **The criteria text** waits on the tier matrix (provenance, above).
- **The pre-existing Tier 1–2 tints outside TierSelect** are listed in §2 and left alone.
- **v10's CTA crossfade was replaced by v10.1's card beat** (the lozenge fills and the check lands). The CTA's words change instantly; the live region still says so.
- **TODO-COPY:**
  - the tags
  - "Choose a new tier"
  - the gap lines
  - the reason seeds
  - "Submitted by"

## 8 · Mutation testing

**11 of 11 killed.** Each mutant was applied to the committed tree, run against the probe or the unit tests, and reverted.

| Mutant | Killed by |
|---|---|
| The CTA drops the tier name ("Confirm Tier 2") | unit: "confirm: the checked tier in full" |
| Update promises a no-op ("Update to Tier 2" on Tier 2) | unit: "update: the current tier is no move" |
| Confirm escalation turns red on T1–2 | §1: "Confirm escalation stays ink" |
| The request is not pre-checked | §2: "the request arrives checked" |
| A radio glyph returns | §1: "no radio glyph" |
| Washes removed (neutral cards) | §1: "each card wears its tier's legend wash" |
| The live region stays silent | §2: "the live region says so" |
| The lozenge does not fill on selection | §1: "the lozenge fills and the check lands" |
| The movement rules are ignored | §3: "the movement rule shows, disabled" |
| The check ignores reduced motion | §7: "reduced motion: an instant state swap" |
| The wash leaks onto the platform link | §1: "the platform escape wears no wash" |
