# Chat Escalation Experience — pack v11.0: report

The branch is `feat/chat-escalation-v11`, cut from `main` at `3727d38`. The audit and its 19 conflicts are in [PHASE0.md](PHASE0.md). Each conflict was answered on 2026-10-28; the answers are recorded in AGENTS.md under "Chat Escalation Experience".

## Gates

- **New probe:** `scripts/responsive/chat-escalation-v11.mjs`. It covers report-back items 2–12, and its screenshots are in this folder.
- **The regression suite:** 24 probes, plus the new one. See §14 for the counts.
- **Unit tests:** 98 files, 1,203 passing. That includes `tier-select.test.ts`, now asserting §5.2 verbatim, and `stay-close.test.ts`, retargeted.
- **typecheck:** clean.
- **lint:** one warning, the `mock-api` `_token` one, which is also on `main`.

## 1 · Branch, files and deletions

| Area | Files |
|---|---|
| Shell | `app-shell/app-shell.tsx` (the banner slot and `data-support-chat`), `app-shell/shell-banner.tsx` (new), `app-shell/grouped-rail.tsx` (the 1680 twin on every collapse class), `support/support-panel.tsx` (`--chat-card`) |
| Chat layout | `chat/chat-page.tsx` (the room clamps, the 800 step, the banner portal, `data-chat-room`, the motion gate on the slot, provenance at send), `chat/list/conversation-list.tsx` (the 64 header and its search, the 54 pills, the inset rows), `chat/list/conversation-row.tsx`, `chat/thread/thread.tsx` (a 64 header, and "Supervisor notified" linking to History), `chat/thread/status-banner.tsx` (64 high), `chat/thread/message-bubble.tsx` (the Ava mark) |
| Hero | `chat/rail/care-hero.tsx`, `chat/rail/care.tsx`, `record/metric.tsx` (new, extracted from `care-summary.tsx`), `lib/record/hero-metrics.ts` (new), `lib/record/mentorship-vitals.ts` (v7's ages restored), `lib/ui/use-media.ts` (new) |
| TierSelect | `tiering/tier-select.tsx`, `tiering/raise-flow.tsx`, `lib/tiering/tiers.ts` (§5.2), `ui/tier-lozenge.tsx`, `app/settings-tokens.css` (`-wash-hover` → `-wash-deep`) |
| Assessment | `chat/escalation/guided-assessment.tsx` |
| Crisis note | `chat/escalation/crisis-note-deck.tsx` (new), `lib/tiering/crisis-draft.ts` (new), `lib/tiering/use-tiering.ts` (`submitCrisisNote`), `chat/escalation/exchange.tsx` |
| Post-submit | `chat/escalation/post-submit-card.tsx` (new), `lib/tiering/post-submit-copy.ts` (new), `lib/chat/stay-close.ts`, `lib/chat/types.ts` (`ChatMessage.provenance`) |

**Deleted, not orphaned** (the probe greps for each):
- `Yield`
- `DiagnosisStrip`
- `crisis-note-accordion.tsx`
- `waiting-module.tsx` and its supervisor "echo" plumbing
- `PlatformReport`
- `STEADYING_LINES`
- the TierSelect check glyph and its `tier-check` keyframe
- `--wash-hover`

The detached hero Support door hides while the post-submit card shows. No legacy Figma token family appears anywhere in `src`.

## 2 · Measured widths (1512 × 982)

| State | Rail | List | Chat | Care | Support | Banner |
|---|---|---|---|---|---|---|
| Mentor, steady | 92 | 300 | 684 | 420 | — | — |
| Mentor, room | 92 | 0 | 724 | 680 (cap) | — | 92 → 1496 × 64 |
| Mentor, room + Support | 92 | 0 | 520 | 480 | 400 | 92 → 1496 × 64 |
| Supervisor, steady | 248 | — | 828 | 420 | — | — |
| Supervisor, room | 248 | — | 624 | 624 | — | 248 → 1496 × 64 |
| Supervisor, room + Support | **72** (it yields) | — | 520 | 480 | 420 | 72 → 1496 × 64 |

- The content gutter is 16 and the top bar is 64.
- The Care panel's own 1px border is its divider; the 420 includes it.
- **The Figma's 544 chat** holds only at its 232 rail. That rail isn't this product's (C1, answered).
- **Below a 1000 canvas with Support open,** for example at a 1280 viewport, the room steps down to v9's split (chat `max(480, 50%)`, Care the rest) rather than collapsing. This was a defect found and fixed in the regression: with no rule below 1000, the chat fell to 13px.

## 3 · Banner geometry

The banner now renders in the shell's slot at `md` and up. It runs from the rail's right edge to the 16px gutter and is 64 high, over the Support column too. The canvas card's and Support's top corners close beneath it, so it reads as the split surface's top edge.

Below `md` it stays in the chat grid, where the fixed bars are accounted for.

"Supervisor notified {time}" now opens Care's History tab.

## 4–5 · The hero, and the scroll

The hero holds its five sections in every state, in both lenses:
1. Identity
2. The mentorship
3. Risk tier
4. Metrics
5. Diagnosis (supervisor and lead only)

**Sizes:**
- The metric values are 20/26, the hero's largest text, over 16/24 headlines.
- Sections are 12 top and bottom and 16 in from the edge.

**Scrolling:**
- The hero scrolls away under the sticky tab bar, which sits on an opaque fill with its hairline.
- `elementFromPoint` under the bar hits the bar.
- Tab order runs hero → tabs → panel across the stick.
- Opening an escalation scrolls the panel to the top once.

Screenshots: `03-hero-*.png` and `05-scrolled.png`.

## 6 · TierSelect

| | |
|---|---|
| **Mentors** | Still read the plain-language lines. The clinical criteria are for supervisors only (answered), which reverses the pack's §1.3. |
| **Supervisors** | Read §5.2 verbatim. |
| **Glyphs** | No check glyph and no radio glyph. |
| **Selected** | The 2px ink ring, `--tier-legend-{n}-wash-deep`, and the lozenge outline → filled. The lozenge is always present. |
| **Hover** | The hairline steps to `--border-strong`. The wash stays identity. |
| **Raise mode** | No "Current" tag; every card choosable; no platform link; "What's happening?" with a required marker; a 280-character counter; a sticky footer. |

**Contrast:** text on every wash, at rest and deepened, is in the v10.1 table and holds at 4.92:1 or better (`tier-select.mjs`). The deepened step is the old hover step, which was already measured.

## 7 · Copy

All four §5.2 strings come from `TIER_CRITERIA` in `lib/tiering/tiers.ts`. A source grep finds no copy elsewhere. "Active crisis", "imminence" and "Medium risk" shipped, and the probe greps for "Active risk", "Medium Risk" and "iminence" (zero hits).

## 8 · No disabled buttons

Every CTA in the arc is enabled and validates inline:
- Confirm escalation
- Submit to supervisor
- Confirm Tier n
- Record section
- Submit crisis note
- Close & follow-up

The raise note shows no error while pristine. It shows one on blur after input, and on a submit attempt.

## 9 · The crisis note deck

The probe's walkthrough:
1. **Record:** Clinical subtype records and advances, and "Draft saved {time}" appears.
2. **No auto-advance:** choosing a subtype does not advance, so the tags are never stranded.
3. **Edit:** tapping a recorded row reopens it with its values intact.
4. **Gaps:** Submit with gaps says "Record 6 more sections to submit." and posts nothing.
5. **Reload:** the draft survives a reload (1 of 7).
6. **Submit:** posts the whole note in one write (sections, `sectionAt`, outcome, debrief) and clears the draft.

**Draft persistence shipped.** It lives in sessionStorage, keyed by escalation. Required sections are a blocked constant (Dr. Nissan), so all of them are required for now.

## 10 · Post-submit

`09-post-submit.png` shows the card:
- "Assessment sent." and "{Supervisor} has it and is reviewing."
- One orienting line, then the Ava mark and Ava's paths, each with a quiet Use.
- One filled button: "Message {supervisor} in Support". The hero's door steps aside.

Use drops the line into the composer, focused, with the caret at the end (Magic 3), and sends nothing.

A sent suggestion records its provenance:
- **Unedited:** `ai_inserted`, and the bubble carries the Sparkles mark with the model's phrase.
- **Edited:** `ai_assisted`.

## 11–12 · Walkthroughs and squint

Both lenses run the arc in the probes: raise, assessment, submit, post-submit, confirm, the deck, close and dismiss (`care-timeline`, `care-elevation`, `chat-escalation-v11`).

The one layout change without an apparent cause was the 1280 + Support collapse. It is fixed (§2).

Squint test: each state has one dominant element.

| State | Dominant element |
|---|---|
| Steady | The hero |
| Raise | The selected card |
| Assessment mid-capture | The focused question |
| Post-submit | The Support button |

## 13 · Deferred, with reasons

- **Gates, built and flagged:**
  - Engaged days and the metric windows (Meg)
  - The "Notes" definition (Meg; it defaults to chat notes)
  - Required crisis-note sections and Ava's generation boundary (Dr. Nissan)
  - Post-submit copy (Nicole)
  - The hero's tier action being suppressed during an open escalation (Brandon)
- **Tier criteria and mentors:** the pack wanted mentors to read the criteria. They don't (answered), so that gate never opened.
- **Platform-concern routing:** an open product question. The flow is deleted, and existing records keep "Mark reviewed".
- **The probe states between Record and Submit:** the in-progress note lives in the session draft. A probe replaying a stored state in a new context therefore sees the confirmed record until Submit (`care-timeline`, noted in place).
- **`care-v61`** measured the deleted accordion. It is reduced to the four claims that outlive it; the deck's full measurement is `chat-escalation-v11` §8.

## 14 · Probe counts

All green. Retargeted probes carry `RETARGETED (pack v11.0 …)` notes.

**New**
- `chat-escalation-v11`: 70

**Retargeted**

| Probe | Checks |
|---|---|
| `tier-select` | 81 |
| `tiering` | 128 |
| `care-v91` | 48 |
| `care-v9` | 61 |
| `care-v8` | 13 |
| `care-v7` | 46 |
| `care-v61` | 4 (reduced to its surviving claims) |
| `care-v5` | 59 |
| `care-elevation` | 83 |
| `care-timeline` | 55 |
| `chat-escalation` | 57 |
| `support-beside-hub` | 89 |
| `support-handoff` | 13 |

**Unchanged**

| Probe | Checks |
|---|---|
| `chat-thread` | 28 (it also passes here; it fails on `main`, so the clock-drift miss may have moved) |
| `chat-chrome` | 32 |
| `chat-shell` | 41 |
| `chat-send` | 18 |
| `chat-lifecycle` | 24 |
| `support-thread` | 50 |
| `support-panel` | 104 |
| `ia-rail` | 23 |
| `console-shell` | 11 |
| `activity-bell` | 26 |
| `monitoring-v3` | 81 |

**Defects the run caught and fixed:**
- the 1280 + Support collapse, where chat fell to 13px (§2)
- the metric values not sharing a baseline when a label wraps at 420
- the raise footer letting cards show through beneath it
- "Requested by The" on an unnamed mentor (carried over from v10)

**Not run this pass:** the mutation pass. You asked to ship it when green, so it was skipped. It is the first follow-up.
