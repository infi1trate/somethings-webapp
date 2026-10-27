# Pack v10.0 — Phase 0 light audit (TierSelect Unification)

The branch is `feat/tier-select`, cut from `main` @ `9ddf356` (v9.1, merged). No code has changed yet.

## 1 · Three tier controls today, and their hosts

| Control | File | Hosts | Shape |
|---|---|---|---|
| **Raise list** (mentor) | `components/tiering/raise-flow.tsx` (`RaiseFlow`, the inline radiogroup) | `chat/rail/care.tsx:416` (the rail takeover) · `RaiseDialog` → `record/record-tier.tsx:59` | One row per tier: radio, lozenge, name, `raiseDescription`. T1–3 only. The current tier is shown disabled and tagged "Current". |
| **Confirm-tier grid** (supervisor S1) | `chat/escalation/exchange.tsx:390` (`ConfirmCard`) | The confirm timeline node (`exchange.tsx:684`) | A 2×2 grid of "Tier n / name / Requested". No lozenge and no description. CTA: "Confirm Tier n" / "Adjust to Tier n". |
| **Update-tier grid** (supervisor, steady state) | `components/tiering/tier-update-module.tsx` (`TierUpdateModule` in `TierUpdateDialog`) | The tier cell's "Update tier" → `chat/chat-page.tsx:1144` (observer) · `record/record-tier.tsx:88` | A 2×2 grid of long lozenges, with disabled rows from `placementsFrom` carrying their reason. A pending request is pre-selected and quoted above. CTA: "Confirm Tier n" / "Post update", plus a ghost "Keep in Tier N". |

All three radiogroups go into **one `TierSelect`** (`components/tiering/tier-select.tsx`):
- `RaiseFlow` keeps hosting the raise form and its platform-report sub-flow.
- `ConfirmCard` and `TierUpdateModule` become thin hosts of review mode.
- Both grids, and the raise flow's inline list, are deleted.

## 2 · Tier copy is already centralised, except the criteria

`lib/tiering/tiers.ts` is the one canon file. It already holds:
- `TIER_NAME`, in canon pairing
- `RAISE_DESCRIPTION`: matches the pack's mentor table **verbatim** (T1–3)
- `TIER_DESCRIPTION`: the tier cell's ⓘ copy, a different job, so it is unchanged
- `RAISE_TIERS`, `PLATFORM` and `isAlertTier`

**Gap:** the supervisor's clinical criteria exist nowhere in the codebase. Phase 1 adds `TIER_CRITERIA` to the same file.

## 3 · Grep results (mock errors)

| Check | Result |
|---|---|
| Swapped pairings (T1 ↔ High risk, T2 ↔ Active crisis, any other off-canon pair), across `src` and `scripts` | **0.** The mock's error never reached code. |
| `Active risk` · `Medium Risk` · `High Risk` · `Active Crisis` | **0** |
| Mentor T3 description = emergency-contact copy | **0.** `RAISE_DESCRIPTION[3]` is already the pack's line. |
| Full-row tier tints in the three controls | **0.** All rows are neutral (`surface-s1`, checked `surface-s2`). |
| Alert colour in the controls beyond lozenges | **1.** `raise-flow.tsx:257`: Confirm escalation turns `--alert-critical-accent` when T1–2 is picked. See default 3. |

Out of scope and noted: `tier-card.tsx` (the record's TierCard surface) and `monitoring/overview/tier-bits.tsx` tint **T1–2 only**. They are status surfaces, not selection rows, and Monitoring v3 sanctions them.

## 4 · Phase 1–2 defaults (they hold unless you redirect)

1. **⚠ Provenance: the criteria.** There is no tier-matrix document in the repo. The pack's parenthetical is the only source, so it ships verbatim, comma-joined, with only the first letter of each tier's line capitalised. It is marked as a blocked constant pending the matrix's own text (Meg / Dr. Nissan):
   - T1 "Specific plan with means/timeframe, in-progress self-harm, rapid symptom escalation, active command hallucinations."
   - T2 "Passive suicidal ideation, current abuse/neglect disclosures, active eating disorder/substance use without imminence."
   - T3 "Low-level distress, historical mental-health issues with no active high-risk indicators."
   - T4 "No issues that need supervisor intervention."
2. **The emphasis ring is a 2px ink border, not a box-shadow ring.** Review mode sits inside the current timeline node, which v4 makes the only element both raised and ringed. A border is the treatment v8 and v9 already use for "the selected one inside the current node". Rows stay neutral; colour lives in the lozenge alone.
3. **Confirm escalation goes neutral (ink) on every tier.** The blocked constant ("alert colour, Tiers 1–2 lozenges only") retires v1's red-on-T1–2 CTA. The two red entry points (the conversation and message menus) are untouched; they are the named exception and sit outside this component.
4. **Movement rules hold in update mode.** Review and update show all four rows. Rows `placementsFrom` disallows (down one step at a time; T1 to T2 first) stay visible, `aria-disabled`, with their reason. This is clinical policy, so the pack's "offers 1–4" is read as "shows 1–4". The confirm-tier step allows all four, as it does today.
5. **Update mode with the current tier checked.** "Update to Tier 3" would be a no-op, so the CTA reads "Choose a new tier". It stays pressable (the codebase's rule: a disabled button says "no" without saying why). Pressing it says "Tier 3 is current — choose another tier" and moves focus to the group. Checking any other row relabels it to "Update to Tier n".
6. **Update mode with a request pending** (a mentor's step-down request outside an escalation):
   - the requested row arrives checked, tagged "Requested by {mentor} · {time}"
   - the CTA reads "Confirm Tier n · {name}"
   - the ghost "Keep in Tier N" (decline) stays
7. **Raise mode with the current tier.** Its row keeps the quiet "Current" tag and stays non-selectable, as v1 had it.
8. **The reason seed** (TODO-COPY): "Reviewed {mentor}'s note: "{note}"". It is neutral, so it stays true on an override, it stays editable, and it is required. The note it references is the raise note.
9. **Confirming T3 or T4 still closes the escalation.** The existing "standard tier update" line stays under the group.
10. **The header row's avatar is initials** (the shared `Avatar` fallback). The populated mentor has no photo, a known gap.
11. **Magic:**
    - The requested row settles with the existing `tier-settle` keyframe.
    - The CTA relabel is a keyed 120ms crossfade.
    - Both are `motion-safe:` only.

## 5 · Retargeting load

Ten probes address the old controls by `data-raise-option` / `data-s1-tier` / `data-tier-option` / `data-tier-submit` / `confirm-tier`, about 57 references in all:
- tiering 18
- care-v91 8
- care-timeline 6
- care-v5 5
- care-elevation 4
- care-v9 4
- care-v61 4
- chat-escalation 4
- care-v8 2
- monitoring-v3 2

`tiering.mjs` asserts the retiring copy ("Adjust to Tier 2"), and that assertion moves to the dynamic CTA. A new probe, `tier-select.mjs`, carries the pack's walkthroughs, the screen-reader transcript, the contrast readings and the squint shots.

---

## Amendment v10.1 — Phase 0 additions (the lozenge as selector)

v10.1 arrived after "go", mid-build, and was folded in before the probes were finalised.

**1 · The lozenge's outline ↔ filled pair. Gap: it existed for T1 and T2 only, and one-way.**
- `TierLozenge` drew T1 and T2 filled always, and T3 and T4 outlined always.
- No tier had both states, and T3 and T4 had no tier hue to fill with.
- **Fix:** an opt-in `legend="outline" | "filled"` prop, from the scoped inks. Every existing caller is unchanged: the prop is omitted outside TierSelect.

**2 · Wash steps on the tier ramps. Gap: two of four, and not Bloom steps.**

| Tier | Before | Wash / hover proposed (light) | Ink |
|---|---|---|---|
| T1 | `--t1-soft` #fbe4e0, a concept-board value with no hover step | blush/50 #FFEAEE · blush/100 #FFD9DF | blush/950 (= `--t1-ink`) |
| T2 | `--t2-soft` #fbe9d4, a concept-board value with no hover step | apricot/100 #FFE8CA · apricot/200 #FFD49C (apricot/50 is #FFFCF8, effectively white) | apricot/800 (= `--t2-ink`) |
| T3 | **none.** The T3 identity was `--text-secondary`. | sunshine/100 #FFF6CE · sunshine/200 #FFF0A2 | sunshine/900 |
| T4 | **none.** No ring at all. | forest/50 #E8F5E3 · forest/100 #CCE8C2 | forest/700 |

- **The tokens are scoped by name:** `--tier-legend-{n}-wash`, `-wash-hover` and `-ink`, in `settings-tokens.css`.
- **The T3 and T4 hues were a proposal.** The mock's values never arrived as tokens, and no raw hex was taken from it. **Answered: kept** ("keep the proposed tiers", 2026-10-27).
- **Dark washes are hand-derived.** Bloom's ramps end in saturated colour, not a dark well (the band triad's finding). The dark inks are real ramp steps.

**3 · "iminence".** The T2 criteria string already read "imminence". The probe now greps for the misspelling and finds zero.
