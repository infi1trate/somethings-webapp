# Pack v11.0 — Phase 0 audit (Chat Escalation Experience)

## 1 · Branch

`feat/chat-escalation-v11`, cut from `main` at `3727d38` (v10 / v10.1 TierSelect, merged as #68). No code has changed.

**References.** The repo has the six Figma PNGs in `reference/screenshots/`, under their Figma frame names:
- `MentorChat-RaiseEscalation`
- `-SelectEscalation-{ActiveRisk,HighRisk,MediumRisk}`
- `-EscalationReview-Assessment{,-Complete}`

These are the pack's `figma-02` to `figma-06`, plus a raise frame with the overflow menu open (closest to `figma-01`).

**Absent:**
- `figma-01-clean.png` (no exact match)
- `live-07` to `live-14`
- `monitoring-row-reference.png`

Copies of the six also sit untracked at the repo root. The live states in this report are measured instead (1512×982).

## 2 · The current escalation implementation, and what §1 supersedes

| Concern | Lives in | Pack v11 |
|---|---|---|
| Layout, focus view, back bar, entry announcement, first-action motion gate | `components/chat/chat-page.tsx` (`roomFor`, `focus`, the `--focus-care` tracks, `data-chat-motion`) | §3: re-clamped (§5 below) |
| Banner | `components/chat/thread/status-banner.tsx`, in the chat grid's `banner` area | §1.8: geometry changes (§5 below) |
| Care panel and tabs | `components/chat/rail/care.tsx` (tabs, `panelState`, **`Yield`** :104, `yielded` :374/:457/:471) | §1.1: **`Yield` and `data-care-yield*` deleted** |
| Care hero | `components/chat/rail/care-hero.tsx` (`CareHero`, `TierCell`, **`DiagnosisStrip`** :131, the Mentorship cell, "Supervised by" :238) | §4: identity, metrics and the diagnosis section added. **`DiagnosisStrip` deleted.** |
| Raise | `components/tiering/raise-flow.tsx` (heading, the **`PlatformReport`** sub-flow) → `TierSelect` mode raise | §1.3 / §1.4 / §5 |
| TierSelect | `components/tiering/tier-select.tsx`; copy in `lib/tiering/tiers.ts`; CTA in `lib/tiering/tier-cta.ts` | §5: the **check glyph is deleted**; selected = ring + deepened wash + fill |
| Confirm-tier / update | `exchange.tsx` `ConfirmCard`; `tiering/tier-update-module.tsx` | Unchanged hosts. The per-role controls were already retired in v10. |
| Assessment | `components/chat/escalation/guided-assessment.tsx`; rules in `lib/tiering/deck.ts` | §4 / Phase 4: anatomy alignment |
| Crisis note | **`components/chat/escalation/crisis-note-accordion.tsx`**; rows in `lib/tiering/note-rows.ts`; writes via `saveCrisisNote` / `chooseOutcome` / `saveDebrief` (`lib/tiering/use-tiering.ts:235–277`) | §1.5 / §6: **accordion deleted** for a section deck with an atomic submit |
| Post-submit ("Brandy has this") | Title at `exchange.tsx:601`; **`components/chat/escalation/waiting-module.tsx`** (supervisor quote, "Suggested by Ava", rotating steadying line); nudges from `lib/chat/stay-close.ts` | §1.6 / §7: **the card is deleted and replaced** |
| "Message Brandy in Support" | The hero's ghost button, `exchange.tsx:154–166` (`data-timeline-support`) | §7.3: moves into the post-submit card as its filled button |
| Store | `lib/onboarding/store.ts` (persisted, v57): `escalations`, `tierEvents`, `escalationHistory`, `chatMessages`, `chatEvents`, `chatNotes` | No new slice needed (§8 below) |

## 3 · The focus view: shipped (v9.1), in this form

- A conversation is in the room while this lens holds its record (open, or closed and not yet dismissed).
- The list's track is 0 and the list is inert.
- "← Chats · N" for a mentor, "← Monitoring" for a supervisor.
- Chat and Care split 50/50 with chat ≥ 480.
- The mid-chat open and the dismiss exit are one motion each. Route entries land rather than animate (deferred in v9.1).

**Measured at 1512:**

| | List | Chat | Care | Support | Banner (left → right, height) |
|---|---|---|---|---|---|
| Mentor, steady | 300 | 744 | 360 | — | — |
| Mentor, focus | 0 | 702 | 702 | — | 92 → 1496, 63 |
| Mentor, focus + Support | 0 | 490 | 490 | 420 (4px gap) | 92 → **1072**, 63 |
| Supervisor, steady (no list, by design) | — | 888 | 360 | — | — |
| Supervisor, focus | — | 624 | 624 | — | 248 → 1496, 63 |
| Supervisor, focus + Support | — | 480 | 360 | 404 | 248 → **1088**, 63 |

The content gutter is 16 (the layout's right edge is 1496) and the top bar is 64.

## 4 · Tier tokens

All tier tokens are in `src/app/settings-tokens.css`, light :134–166 and dark :829–853. **No tier hex is inlined anywhere in `src`** (searched for every tier hex, light and dark).

| Family | Tiers | Origin | Use |
|---|---|---|---|
| `--t1`, `--t1-soft`, `--t1-ink`, `--t2`, `--t2-soft`, `--t2-ink` | 1–2 only | Monitoring (proto/monitoring-merge) | Rings, Monitoring tints, the shared lozenge's T1–2 fills |
| `--tier-legend-{1–4}-wash`, `-wash-hover`, `-ink` | 1–4 | v10.1 (#68), scoped to TierSelect by name; the hues were answered ("keep the proposed tiers") | TierSelect washes and the lozenge's outline/filled legend pair |

## 5 · Care Record stat styles (for §4.4)

**`Metric` in `components/record/care-summary.tsx:101–139`.** It is local and not exported. It already renders "Days in mentorship" (:404).

| Part | Style |
|---|---|
| Label | `text-[var(--text-muted)]` + `LABEL_STYLE` = `font: var(--type-field-label)` (400 12/16 Lausanne), with `--type-field-label-tracking` |
| Value | `text-[20px] leading-[26px] tabular-nums text-[var(--text-primary)]` |
| Row | `grid gap-x-6 gap-y-5 border-t border-[var(--border-subtle)] pt-4` in an `@container` |

A sibling copy is `review-body.tsx:80–86` (`STAT_VALUE`, 20/24). **Plan:** extract `Metric` into one shared component, and have the record and the hero both use it. No new style.

## 6 · Provenance model (for §7)

- `lib/record/field-provenance.ts`: `FieldProvenance = "authored" | "ai_inserted" | "ai_assisted"` (:30), with `onInsert` / `onEdit` / `discloses` / `PROVENANCE_PHRASE`. `FieldProvenanceNote` is in `components/record/field-provenance-note.tsx`.
- It is attached only to care-update and record fields today.
- **Chat messages carry no provenance.** `ChatMessage` (`lib/chat/types.ts:79–96`) has only `origin?: { kind: "assessment" }`.
- The send path already keeps an origin when the sent text retains the inserted text (`chat-page.tsx:1095`). That check is the reuse point.

## 7 · Support beside chat and Care

Support is its own column outside the chat grid: 420 for a mentor and 404 for a supervisor, with a 4px gap. Inside the room it gives v9's floor split (`max(480px, 50%)`), and it becomes a drawer below an 800 canvas.

## 8 · Draft persistence (for §6.6)

**The crisis note has no draft today.** Each "Save section" writes straight to the persisted store, stamping `sectionAt` and appending `noteAmendments` on a re-save. Edits in progress live in component state only.

**The precedent is `lib/record/review-draft.ts`.** It holds Care Reviews' drafts, deliberately in **sessionStorage, not the store**, so clinical prose never sits in localStorage (rationale at :6–19). It provides read, write, saved, has, clear and age functions, `useSyncExternalStore` hooks, and keys by teen plus record. A crisis-note draft keyed by escalation id fits it directly.

It survives reload, navigation and Care tab switches. It does not survive closing the browser tab, by design.

## 9 · §4.4 metrics in the data layer

| Slot | Exists? | Source | Proposal |
|---|---|---|---|
| Days in mentorship | **Yes** | `daysInMentorship(teen)`, `lib/record/relationships.ts:240` (fixture match stamps) | Use it, with the record's "N days" wording |
| Engaged days (30d) | **No.** No per-day engagement log exists; `tier-roster.daysEngaged` is hand-set and has no window. | — | **Blocked (Meg).** Render the slot and its label with an inline gate comment, showing an absent marker, not 0 (see §10 C7) |
| Messages sent (30d) | **Thin.** Only the scenario's focus thread is scripted; other threads are 2-message fillers. | Merged thread messages (`chat/seed.ts:858` + store `chatMessages`) | Count the mentor's sent messages in this thread over 30 days, derived from what the conversation actually shows |
| Flags (30d) | **Fixture** | `careFlagsFor(teen)` (`people-demo.ts:1580`), filtered to `kind: "risk_flag"` and `daysAgo ≤ 30` | Use it. Not the roster's `riskFlags`, which mixes windows. |
| Escalations (30d) | **Yes, store-backed** | `escalationsFor(teenId)` (`use-tiering.ts:120`), filtered by `openedAt` within 30 days | Use it (the tiering store, not `careFlags`' escalation records) |
| Notes | **Undefined.** There are four candidates (chat notes, care updates, crisis notes, generated check-in notes). | — | Default: this thread's `chatNotes`. They are real and store-backed, and the same count in both lenses. **Needs a definition**, which I'd add to the Meg gate. |

Nothing is fabricated.

## 10 · Conflicts, with a proposed resolution for each

**C1 · Sidebar 232.**
- Neither rail is 232. A mentor gets the **92** icon rail and staff get the **248** labelled rail (`console-shell.tsx:334`). That split was settled deliberately: the 248 rail on mentors broke `chat-thread`.
- The Figma's "Mentor" frame shows the staff navigation.
- **Resolution:** leave the navigation alone. Fix the list at 300 and Care at 420, and let chat be the fluid column:
  - mentor 1512: 300 · 683 · 1 · 420
  - supervisor 1512, no list: 827 · 420
  - The 544 holds only at a 232 rail.

**C2 · Focus view "640 / 640 at 1512".**
- That only works with a 232 rail. Under the pack's clamps (Care 480–680, chat ≥ 520), 1512 gives:
  - **mentor 724 · 680** (Care hits its max)
  - **supervisor 624 · 624**
- **Resolution:** ship the clamps and report these values.

**C3 · Focus view + Support.**
- With chat 520 and Care 480:
  - The mentor at 1512 leaves **404** for Support. It fits.
  - The supervisor leaves **248**. It does not fit.
- **Resolution:** Support stays beside whenever chat 520 + Care 480 + Support 360 fits, and becomes the drawer otherwise:
  - supervisors on the 248 rail need a viewport of about 1624 or wider
  - mentors on the 92 rail need about 1468 or wider
- This is the v9 cost moved up: a supervisor at 1512 gets Support as a drawer, where today they get 480 · 360 · 404.

**C4 · Banner geometry.**
- The left edge already sits at the sidebar's right edge (92 or 248).
- With Support open, the banner stops at chat + Care (1072 / 1088), because it lives inside the chat grid.
- **Resolution:** lift it into the content container so it runs to the 16px gutter over Support too, and make it 64 high (63 today).

**C5 · "Consume the t1–t4 Monitoring tokens; no parallel palette."**
- Monitoring only has T1–2. The one four-tier set is v10.1's `--tier-legend-*`, which you approved.
- **Resolution:**
  - TierSelect keeps consuming `--tier-legend-*`. No new palette.
  - The selected card takes the deepened step (today's `-wash-hover`, renamed `-wash-deep`).
  - Hover stops deepening the wash and uses the Bloom border-strong hairline plus the focus ring. Washes stay identity, and only selection deepens.

**C6 · "The lozenge disappears on selection" (`live-09` / `live-13`).**
- It does not reproduce on `main`: the lozenge fills on selection (#68 measured it at 5.3–16.2:1, both themes). The live screenshots weren't supplied, so they may predate #68.
- The check glyph does exist (v10.1).
- **Resolution:** delete the check. Selection becomes the ring, the deepened wash and outline → fill. The probe asserts the lozenge is present and filled.

**C7 · Engaged days with no data vs "zero renders as 0".**
- **Resolution:** keep the slot with an *absent* marker, read aloud as "not available yet". It is never 0, because absent is not zero. The gate goes in a comment at the slot.

**C8 · §5.2 copy differs from today's.**
- T1 is now "Specific **suicide** plan with means/timeframe, in-progress self-harm, rapid symptom escalation **or** active command hallucinations."
- The Figma reads "substance abuse" and "mental health … high risk".
- **Resolution:** ship the pack's §5.2 strings verbatim in `TIER_CRITERIA`, used in **both** lenses.
- `RAISE_DESCRIPTION` (the v10 plain language) is deleted.
- **Flagged for Nicole and Dr. Nissan:** clinical criteria now reach mentors.

**C9 · Raise drops the "Current" tag. Is the current tier selectable?**
- In v10 it was disabled. Raising at the current tier is a real event (a Tier 2 teen with a new crisis).
- **Resolution:** all three raise cards are enabled and untagged. The review and update modes keep "Current" (§5.1 removes it from raise only).

**C10 · Removing the platform link leaves `PlatformReport` unreachable.**
- **Resolution:** delete `PlatformReport` (deleted, not orphaned). The `requested: "platform"` category and the supervisor's "Mark reviewed" path stay, for records that already carry it.
- The routing question is left open, as instructed. The thread menu's existing "Report a problem" is a different flow, about the conversation, and is not touched.

**C11 · "Supervised by" link.**
- Today it opens the Support thread (v7).
- **Resolution:** link it to the supervisor's record, `/admin/person/{supervisorId}`, which exists (`s-brandy` returns 200). Mentor lens only.

**C12 · The hero's "Day {n} of {n}".**
- Only T2 (7-day minimum) and T3 (14-day dwell) have a window. T1 reads "1 day at a time" and T4 has none.
- **Resolution:** T2 and T3 get "Day n of N", T1 keeps "In Tier 1 since {time}", and T4 shows no caption. No invented window.

**C13 · `ai_assisted` on a sent message.**
- **Resolution:** add one optional `provenance?: FieldProvenance` to `ChatMessage`, reusing the existing type rather than adding a second one. It is set at send by the existing retention check. Optional, so no store-version bump.
- **The model's own semantics:** a suggestion sent unedited is `ai_inserted`, and one edited before sending is `ai_assisted`. The pack says "marks it `ai_assisted`". I propose following the model, because collapsing the two would make `onEdit`'s distinction meaningless here. Please confirm.
- The bubble gets the existing Sparkles + label idiom as its Ava mark.

**C14 · Crisis-note draft and atomic submit.**
- **Resolution:**
  - The draft lives in sessionStorage, keyed by escalation id (the `review-draft` precedent). It shows "Draft saved {time}" and survives reload, navigation and tab switches. So the atomic submit **can** ship with the draft.
  - The deck is the chart's sections, then Outcome, then Debrief (today's rows). All are required until Dr. Nissan rules (inline gate).
  - "Record section" is an **outline** button and "Submit crisis note" the one filled button, always enabled. Submitting with gaps names them and focuses the first.
  - Submit writes `crisisNote`, `outcome` and `debrief` once. The draft's per-section times become `sectionAt`.
  - `noteAmendments` start only after submit. Edits before submit are the draft, not amendments.
  - The close gate (`noteComplete`) is unchanged.

**C15 · History after close.**
- Today History shows "Crisis note filed" as one entry (`tier-history.tsx:194`). The full note renders only on the supervisor's timeline node.
- **Resolution:** keep that single entry, expandable to the read-only deck in the supervisor lens. The mentor lens never sees the note's contents.

**C16 · One Support door per state (v5).**
- **Resolution:** in the post-submit state, the card's "Message {supervisor} in Support" is the door, and the hero's ghost Support button hides. Everywhere else the hero's door stands.

**C17 · The assessment's "Question n of 6" overline.**
- v6.1 removed it, and `tiering.mjs` asserts it is absent.
- **Resolution:** reinstate it per Phase 4 and retarget the probe.

**C18 · Probes that assert v10 behaviour.**
- `tier-select.mjs` (plain-language raise, the "Current" tag in raise, the platform link, the check), `tiering.mjs` (platform report, no "Question n of 6"), `care-v9` / `care-v91` (yield), and `care-timeline` (the waiting node).
- **Resolution:** retarget each with a `RETARGETED (pack v11.0 …)` note. The v10.1 scoped-wash and grep proofs stand.

**C19 · The Figma's two-column "Teens" header.**
- **Resolution:** the list gains the 64 header ("Teens" plus chevron, and a 40×40 search button). The pills row goes from 46 to 54 (12 top inset, 8 gaps), and rows go from 71/67 to 68 with a 2px gap.
- **Question:** the chevron implies a switcher (Teens ↔ ?) that no frame specifies. Default: show the title without the chevron until there's a destination, rather than ship a dead control.

## Defaults that hold unless you redirect

C1–C19 as proposed. The ones that most need your eye:
- **C3:** a supervisor at 1512 loses Support beside.
- **C13:** `ai_inserted` vs `ai_assisted`.
- **C19:** the dead chevron.
- **C9:** current tier selectable in raise.
- **Notes:** the metric's definition (§9).
