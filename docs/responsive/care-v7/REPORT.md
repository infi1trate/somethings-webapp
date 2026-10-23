# Care Hero — Micro-Pack v7.0: report

Branch `feat/care-v7`, stacked on `feat/care-v5` at `7b8522e`. Local only.

| Commit | Phase |
|---|---|
| 175d4e6 | 1: `CareHero` — identity strip, role anchor, tier cell; the profile and Support links; the Matched row removed |
| (this) | 2: escalation coexistence, regression, the probe, the unit tests, this report |

- **Probe** `scripts/responsive/care-v7.mjs`: 61 checks, all passing.
- **Unit tests** `src/lib/record/__tests__/mentorship-vitals.test.ts`: 7, all passing.
- **Retargeted probes:**
  - `care-v5` has 68 checks and `care-elevation` has 85, both all passing. One check in each encoded v5's "the mentor sees the Risk tier cell only", which v7 supersedes, so each now asserts "the Mentorship, then Risk tier". The diagnosis-absent half is unchanged.
  - `care-elevation`'s hero-position check now finds the hero inside the `CareHero` root, under the strip.
  - `care-timeline`: 55 checks, untouched and passing.
- **Mutation testing:** 14 of 14 killed. One initially survived and the test was strengthened (§9).

## 1. Files

| File | Change |
|---|---|
| `src/components/chat/rail/care-hero.tsx` | **New, by rename** from `teen-status-card.tsx`. Holds `CareHero`, `IdentityStrip`, `DiagnosisCell`, `MentorshipCell`, `TenureHeadline` and `TierCell`. The tier cell's internals (`dwell`, `DwellLine`, `TierInfo`) are moved unchanged. |
| `src/lib/record/mentorship-vitals.ts` | **New.** `teenIdentity`, `mentorshipVitals`, `tenureAt`, `tickedOver`, and the `VITALS` fixture rows. |
| `src/lib/record/__tests__/mentorship-vitals.test.ts` | **New.** |
| `src/components/chat/rail/care.tsx` | Composes `CareHero`. The escalation hero is passed in as Zones 2–3's replacement, so Zone 1 stays. |
| `src/components/chat/chat-page.tsx` | Adds `onOpenProfile` (the Profile rail tab), the `?rail=profile` deep link and `onOpenSupportTo`. Removes `matchedFor` and its `relLength`/`teenAsMentee` import. |
| `src/components/chat/rail/profile.tsx`, `rail.tsx`, `src/app/dev/components/page.tsx` | The Matched row and the `matchedFor` prop chain removed. |
| `scripts/responsive/care-v7.mjs` | **New.** |
| `scripts/responsive/care-v5.mjs`, `care-elevation.mjs` | Retargeted, as above. |

`TeenStatusCard` is retired, with no export left behind. Its `data-care-hero="steady"` and `data-teen-status` hooks now sit on the hero's card, so selectors from earlier packs still resolve.

## 2. Fixture gaps, and how each was closed

| Pack field | Gap | Resolution |
|---|---|---|
| Age | `DemoTeen` had none | `VITALS[teenId].age`, one row per record teen, **TODO-DATA**. A teen without a row shows no age; nothing is invented at render. |
| Check-ins this window | No count anywhere | `VITALS[teenId].checkIns30d`, the last 30 days, **TODO-DATA**. The fragment is omitted when absent. |
| Tenure | `matchedDaysAgo` existed | Phrased by the mentee table's own `relLength`, so "5 months" in the table is "5 months together" here. The first draft used its own rounding (`floor(d/30.44)`), which would have disagreed with the table. Caught before commit, and now a unit test. |
| Last spoke | `mentorLastSentDaysAgo` / `menteeLastSentDaysAgo` | The more recent of the two: "today", "yesterday" or "Nd ago". |
| Supervised by | People-demo supervision edges | The live mentor maps to `s-brandy`, "Brandy Forrestor". A roster mentor maps to their `leadId`. Every record teen resolves (unit test). |
| Avatar | No teen photography, by design | The record's initials disc (`RecordAvatar`, 24px), marked as a placeholder for the curated-profile photo. |

## 3. Type lockup

| Role | Token | Ink |
|---|---|---|
| Overline | 11/16, medium, 0.06em tracking, uppercase | `text-muted` |
| Anchor headline | `--type-card-title` (Avantt) | `text-primary` |
| Anchor meta | `--type-field-label` (12/16) | `text-secondary` |
| Strip name | `--type-body` (14/20), one step below the headline | `text-primary` |
| Strip age · pronouns | 12/16, tabular | `text-secondary` |
| ICD chip | mono 11, 20px chip, `border-default` | `text-secondary` |

Each cell's rhythm is overline · headline · meta, with 4px between (`space-y-1`), on 14/16px padding.

**Two corrections made during the build:**
- **The ICD chip orphan.** The headline was a flex row, so on "Major depressive disorder, recurrent, mild" the chip wrapped onto a line of its own. The chip now runs inline after the last word, with `nowrap`. The probe asserts it shares the headline's last line.
- **The Mentorship meta.** The pack's single line ("Last spoke · check-ins · Supervised by …") ran past the 327px cell and wrapped with a "·" dangling at the line end. It is now two lines on purpose:
  - the vitals, a pair of facts
  - the supervision, a relationship and a link

  Each "·" travels with the fragment after it. **This departs from the pack's single line;** the reason is the measured overflow.

## 4. Single-home audit

| Fact | Its one home | Notes |
|---|---|---|
| Tenure | the Mentorship headline | The Profile tab's **Matched** row was removed. The probe counts "together" exactly once on the page. The supervisor's lens shows no tenure: the record's mentee table carries it there. |
| Name, pronouns | the chat header and the identity strip | **The one sanctioned repetition.** The header is navigation chrome, while the strip is the document title of a surface also reached from Monitoring and the record. |
| Last spoke | the Mentorship meta | **Named exception (second).** It sits near the chat list's last-activity time. The list time is a timestamp for sorting; this is a relational fact in the pair's terms. |
| Supervisor | the Mentorship's supervision line | Escalation-state mentions ("Message Brandy in Support") belong to the escalation hero, which replaces Zones 2–3, so the two are never on screen together. |
| Diagnosis | the Diagnosis cell (supervisor, lead) | Never in the mentor's DOM: no `[data-care-brief]`, no ICD pattern, no "full care record" (probe). |
| Tier | the tier cell | Unchanged from v5. |

## 5. Contrast (AA 4.5:1, measured on the real surfaces)

| Element | Light | Dark |
|---|---|---|
| Strip · name | 15.14 | 15.43 |
| Strip · age, pronouns | 6.94 | 7.15 |
| Strip · View their profile | 15.14 | 15.43 |
| Overline | 5.30 | 4.71 |
| Anchor headline | 16.64 | 13.30 |
| Anchor meta / supervision line | 7.63 | 6.16 |
| Supervisor link | 16.64 | 13.30 |
| ICD chip | 7.63 | 6.16 |
| Care-record link | 16.64 | 13.30 |

The dark overline is the closest to the floor, at 4.71. It is the existing overline token, unchanged by this pack.

## 6. Keyboard order (probe-measured)

- **Mentor:** View their profile → Brandy Forrestor (Support) → About Tier N → Escalate
- **Supervisor:** View their profile → View full care record → About Tier N → Update tier

This matches the pack's order: the profile link, then the anchor's link, then the tier info, then the tier action. The supervisor link is an inline link inside a sentence, so it is exempt from the 24px target minimum (WCAG 2.5.8); the others are at least 32px tall.

## 7. Squint test

Screenshots in this folder:
- `01-mentor-steady`
- `02-supervisor-steady`
- `03-mentor-escalation`, `03-supervisor-escalation`
- `04-mentor-dark`

At a squint:
- **Steady:** the anchor headline is the first mark in both lenses ("7 days together" / the diagnosis). The strip reads as a quiet title line above the card. The tier lozenge is second.
- **Escalation:** the strip keeps the subject ("Jordan Tate · 15 · they/them"), and the escalation headline remains the one emphasis.

## 8. Deferred, with reasons

- **The avatar crossfade between Profile and Care** (make it magical 1). The Profile tab has no avatar to hand off to, and adding one so a transition has a partner would be decoration (the standing direction is restraint). It becomes cheap the day the curated profile gets its photo header: give both avatars one `view-transition-name` and wrap the tab change in `startViewTransition`, as the onboarding wizard does.
- **The tenure tick-over settle** (make it magical 2) is **built**. It is the existing `tier-settle` beat, played once per teen per day (a sessionStorage key and a DOM class, with no re-render), and reduced motion stills it. The probe does not drive it, because no fixture teen ticks over on a given day by design. `tickedOver` is unit-tested at the day→week boundary and at every month boundary to 400 days.
- **Supervisor-lens tenure.** It is not shown. The pack gives the supervisor's Zone 2 to the diagnosis, and the record's mentee table already states tenure.
- **"Last spoke" wording** and every other new string are **TODO-COPY**.

## 9. Mutation testing

Run by `scratchpad/mut/run-v7.py`. Each mutant was applied to source, the dev server rebuilt, and the probe or unit test was run. Result: **14 of 14 killed.**

| Mutant | Caught by |
|---|---|
| The mentor sees the diagnosis | role gate, zone order (6 checks) |
| The strip hides under an escalation | escalation coexistence (6) |
| The profile link opens Care | View their profile → Profile tab |
| `?rail=profile` ignored | the deep link lands |
| `?rail=profile` pins the tab | picking Care holds |
| Tenure repeated in the meta | the meta template |
| A characterisation in the meta ("a steady pair") | the meta template |
| Support opens the wrong thread | Supervised by → `s-brandy` |
| The ICD chip orphaned (flex row) | chip on the headline's last line (2) |
| The supervisor link out of tab order | keyboard order |
| Age · pronouns on a failing ink (1.96:1) | contrast (4) |
| A long name does not truncate | overflow (2) |
| Tick-over inverted | unit test (2) |
| **Tenure re-rounded by 3%** | **survived, then killed.** No fixture teen sat near a rounding boundary. Added a sweep of every day from 0 to 400 against `relLength`, and the mutant now fails it. |
