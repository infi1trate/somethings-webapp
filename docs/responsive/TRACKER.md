# Responsive Tracker

Live status for the responsive project. Phase 1 built it; every later phase updates the **Status** column and adds rows to [Findings](#findings).

**Baseline.** The audit in `01-CONTEXT.md` was taken against `main` @ `08c91d1`. This tracker is against `66f9491` (`feat/tasks-worklist`), which is a descendant. Line citations below are current as of `66f9491`; where they differ from `01-CONTEXT.md` the correction is noted in [Root-cause confirmation](#root-cause-confirmation).

**Status values.** `untouched` → `substrate-fixed` → `verified` (screenshot-diffed at all six viewports + axe clean).

**Viewport columns.** `?` = NEEDS-VISUAL, not yet measured. A finding id (`F-nn`) = measured, see [Findings](#findings). Per `02-VIEW-MATRIX.md`: *"Mark anything undeterminable from code as `NEEDS-VISUAL`. Never describe a rendered UI you haven't verified."* Every `?` in this file is that rule being obeyed, not an omission.

**Coverage disclosure.** 93 view-states × 6 viewports is 558 measurements. Phase 1 measured the **eight substrates** and a representative view per cluster, on the matrix's own thesis that substrate findings propagate. Rows whose findings are inherited from a substrate carry that substrate's finding id. Views needing individual measurement are `?` and Phase 2+ closes them.

---

## Count corrections

`02-VIEW-MATRIX.md` is an audit finding, not scripture. Four counts are wrong.

| Cluster | Matrix | Actual | Why |
|---|---|---|---|
| Onboarding wizard | ~16 ("14 counted + 2 interstitials") | **12** (11 counted + 1 interstitial) | `STEP_ORDER` has 12 entries and exactly one `interstitial: true` (`examples`). `lib/onboarding/steps.ts:22–43`. The matrix over-counts by four. |
| Mentor app routes | ~11 | **~13** | `/app/tasks` and `/app/escalation/[escalationId]` were built after the audit. |
| Route files | 22 | **24** | Same two. |
| Overlays | 27 | **26 consumers + 3 primitives** | The three `ui/` files are the definitions, not surfaces. Two consumers are new since the audit (`dev/dev-bar.tsx`, `tasks/shortcuts.tsx`). |

Confirmed correct: activation hub 6 · pre-app 4 · self profile 4 · settings 6 · supervisor console 3 · **user records 18** (8 built tabs × subject-role gating, and every per-role count in the matrix's tab table is right) · dev 1.

**Revised total: 93 view-states.**

---

## Legend

**Shell:** `MS` MentorShell · `AS` AdminShell · `OL` OnboardingLayout · `RS` UserRecordShell (inside MS/AS) · `—` none (bare page).

**Substrates** (`02-VIEW-MATRIX.md` §Substrate map): `S1` app shell + nav · `S2` record shell · `S3` step scaffold + onboarding layout · `S4` phone preview · `S5` tables · `S6` overlays · `S7` row + section primitives · `S8` tab bars.

**Gates:** persona from `lib/types.ts:12` (`new-mentor` · `mentor` · `lead-mentor` · `supervisor`/`admin`); subject role via `?subjectRole=` (`subjectRoleFromParam`, `lib/record/tabs.ts:164`); tab via `?tab=` / `?focus=` (`FOCUS_TO_TAB`, `:185`); lifecycle `status` in the zustand store (`lib/types.ts:19`).

---

## Redirects — not views. Do not audit, do not break.

| Route | Redirects to | File |
|---|---|---|
| `/app/mentors` | `/app/team` (client) | `app/app/mentors/page.tsx:12` |
| `/app/teens` | `/app/mentees` (server) | `app/app/teens/page.tsx` |
| `/admin/users` | `/app/team`, or `/app/mentees` when `?segment=teens\|mentees` | `app/admin/users/page.tsx:25` |

---

## A · Pre-app (4)

| ID | Route | Persona | Lifecycle | Shell | Substrate | Primary goal | 320 | 390 | 430 | 768 | 1024 | 1280 | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `/` | any | any | — | — | Land, understand, enter | ? | ? | ? | ? | ? | ? | untouched |
| A2 | `/invite/[token]` | `new-mentor` | `invited` | — | — | Accept the invitation | ? | ? | ? | ? | ? | ? | untouched |
| A3 | `/onboarding/preview` | mentor | `pending` | — | S4 | Review own profile before submitting | F-02 | F-02 | F-02 | F-02 | ? | ? | untouched |
| A4 | `/onboarding/submitted` | mentor | `in_review` / `rejected` | — | S4 | See submission state, act on change requests | F-02 | F-02 | F-02 | F-02 | ? | ? | untouched |

## B · Onboarding wizard (12) — `/onboarding`

All `OL` + `S3`. Persona `new-mentor`, lifecycle `invited`→`pending`. Goal: complete one step and advance.

| ID | Step slug | Section | Optional | 320 | 390 | 430 | 768 | 1024 | 1280 | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| B1 | `verify` | Account | | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B2 | `register` | Account | | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B3 | `confirm` | About you | | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B4 | `examples` **(interstitial)** | Your profile | | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B5 | `profile-photo` | Your profile | ✓ | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B6 | `nickname` | Your profile | ✓ | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B7 | `languages` | Your profile | | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B8 | `bio` | Your profile | | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B9 | `spotify` | Your profile | ✓ | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B10 | `media` | Your profile | ✓ | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B11 | `vibe` | Your profile | ✓ | F-05 | F-05 | F-05 | ? | ? | ? | untouched |
| B12 | `interests` | Your profile | | F-05 | F-05 | F-05 | ? | ? | ? | untouched |

## C · Activation hub (6)

> **`published` HERE MEANS THE STATUS, NOT THE SNAPSHOT.** `hub/page.tsx:31` redirects to `/app` when
> `publishedSnapshot !== null`, so a seed that sets the snapshot sends every one of these rows away —
> C1 and C2 drifted for exactly that reason in the first baseline. The hub's audience is a mentor whose
> profile is approved but who has not published yet, so the harness seeds `status: "published"` with no
> snapshot (`ACTIVATING` in `harness-views.mjs`). Only C1 and C2 carry the guard, which is why C3–C6
> rendered correctly and the wrong seed went unnoticed.

| ID | Route | Persona | Lifecycle | Shell | Substrate | Primary goal | 320–430 | 768+ | Status |
|---|---|---|---|---|---|---|---|---|---|
| C1 | `/hub` | mentor | `published` | — | S7 | See the 5 remaining steps, pick one | ? | ? | untouched |
| ~~C2~~ | ~~`/hub/profile`~~ | — | — | — | **NOT A ROUTE — removed** | — | — | — | `hub/[step]/page.tsx` is the "placeholder module for the four NON-PROFILE hub steps" and redirects anything else to `/hub`. The hub's Profile step routes by state — to the wizard or to `/app/profile` — so `/hub/profile` is never served. Those states are already covered by cluster B and E1. Matrix 68 → 67. |
| C3 | `/hub/story` | mentor | `published` | — | S3, S7 | Finish story | F-05 | ? | untouched |
| C4 | `/hub/training` | mentor | `published` | — | S3, S7 | Finish training | F-05 | ? | untouched |
| C5 | `/hub/scheduling` | mentor | `published` | — | S3, S7 | Set availability | F-05 | ? | untouched |
| C6 | `/hub/away` | mentor | `published` | — | S3, S7 | Set away state | F-05 | ? | untouched |

## D · Mentor app routes (13)

| ID | Route | Persona | Shell | Substrate | Primary goal | 320 | 390 | 768 | 1280 | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| D1 | `/app` | mentor | MS | S1, S7 | Home | F-01 | F-01 | F-01 | ? | untouched |
| D2 | `/app/activity` | mentor | MS | S1, S7 | Read the profile-update feed | F-01 | F-01 | F-01 | ? | untouched |
| D3 | `/app/activity` | supervisor | AS | S1 | Read the ledger | F-01 | F-01 | F-01 | ? | untouched |
| D4 | `/app/mentees` | mentor | MS | S1, S5 | Own mentee list | F-01, F-03 | F-01, F-03 | F-03 | ? | untouched |
| ~~D5~~ | ~~`/app/mentees` as lead~~ | — | — | — | **NOT A VIEW — removed** | — | — | — | — | `app/app/mentees/page.tsx:35` redirects a lead to `/app/team`, and that is the documented decision (a lead supervises mentors, not teens — see `mentor-shell.tsx`), not a bug. The row asked for a route the product deliberately does not serve and then reported the redirect as drift. D8 already covers `/app/team` as a lead, which is the view this row was actually reaching. Matrix goes 69 → 68. |
| D6 | `/app/mentees` | supervisor | AS | S1, S5 | Full roster | F-01, F-03 | F-01, F-03 | F-03 | ? | untouched |
| D7 | `/app/team` | mentor | MS | S1, S5 | Staff directory | F-01, F-03 | F-01, F-03 | F-03 | ? | untouched |
| D8 | `/app/team` | lead-mentor | MS | S1, S5 | + mentors led | F-01, F-03 | F-01, F-03 | F-03 | ? | untouched |
| D9 | `/app/team` | supervisor | AS | S1, S5 | + review queues | F-01, F-03 | F-01, F-03 | F-03 | ? | untouched |
| D10 | `/app/tasks` | supervisor/admin | AS | S1, S6 | Work the worklist | F-01 | F-01 | F-01 | ? | untouched |
| D11 | `/app/tasks` | mentor/lead | MS | S1 | Unbuilt-section placeholder | F-01 | F-01 | F-01 | ? | untouched |
| D12 | `/app/[section]` ×5 + `?with=` | any | MS | S1 | Placeholder / named chat | F-01 | F-01 | F-01 | ? | untouched |
| D13 | `/app/escalation/[id]` | any | MS/AS | S1 | Escalation placeholder | F-01 | F-01 | F-01 | ? | untouched |

## E · Self profile (4) — `/app/profile`

| ID | Tab | Persona | Shell | Substrate | Primary goal | 320–430 | 768 | 1024 | Status |
|---|---|---|---|---|---|---|---|---|---|
| E1 | Profile | mentor | MS | S4, S7, S8 | Edit match-card profile | F-02 | F-02 | F-02 | untouched |
| E2 | First moments | mentor | MS | S4, S7, S8 | Edit first-chat messages | F-02 | F-02 | F-02 | untouched |
| E3 | Schedule | mentor | MS | S7, S8 | Set hours | ? | ? | ? | untouched |
| E4 | Account | mentor | MS | S7, S8 | Edit account fields | ? | ? | ? | untouched |

## F · Settings (6) — `/app/settings`

All MS + S7, S8. Goal: change one preference.

| ID | Section | Built | 320–430 | 768+ | Status |
|---|---|---|---|---|---|
| F1 | Security | ✓ | ? | ? | untouched |
| F2 | Notifications | ✓ | ? | ? | untouched |
| F3 | Appearance | ✓ | ? | ? | untouched |
| F4 | Language | coming-soon | ? | ? | untouched |
| F5 | Accessibility | coming-soon | ? | ? | untouched |
| F6 | Audio & video | coming-soon | ? | ? | untouched |

## G · Supervisor console (3)

| ID | Route | Persona | Shell | Substrate | Primary goal | 320 | 390 | 768 | 1024 | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | `/admin/review` | supervisor | AS | S4, S6 | Approve/reject a profile | **F-02** | **F-02** | **F-02** | ? | untouched |
| G2 | `/admin/profile-update` | supervisor | AS | S4, S6 | Approve/reject an update | **F-02** | **F-02** | **F-02** | ? | untouched |
| G3 | `/admin/mentor` (8 tabs) | supervisor | AS | S2, S4, S8 | Work a mentor record | F-02 | F-02 | F-02 | ? | untouched |

> G1 and G2 are the two worst views in the platform below 1024px: the artifact under review is `hidden lg:`, so the reviewer approves something they cannot see. See F-02.

## H · User records (18) — `/admin/person/[id]`

All AS + RS. Substrates S2, S8 (+ S5 on Mentorship/Supervision, S4 on Profile/First moments, S6 throughout).

| ID | Subject role | Tab | Primary goal | 320 | 390 | 768 | 1280 | Status |
|---|---|---|---|---|---|---|---|---|
| H1 | mentor | Overview | Assess a mentor at a glance | ? | ? | ? | ? | untouched |
| H2 | mentor | Mentorship | Manage caseload + mentees | F-03 | F-03 | F-03 | ? | untouched |
| H3 | mentor | Profile | Review match card | F-02 | F-02 | F-02 | ? | untouched |
| H4 | mentor | First moments | Review first-chat | F-02 | F-02 | F-02 | ? | untouched |
| H5 | mentor | Schedule | Review hours | ? | ? | ? | ? | untouched |
| H6 | mentor | Account | Review account | ? | ? | ? | ? | untouched |
| H7 | teen | Overview | Triage attention items | F-04 | F-04 | ? | ? | untouched |
| H8 | teen | **Care** | Clinical read + act | **F-06** | **F-06** | **F-06** | ? | untouched |
| H9 | teen | Mentorship | See the match | F-03 | F-03 | F-03 | ? | untouched |
| H10 | teen | Account | Review account | ? | ? | ? | ? | untouched |
| H11 | lead-mentor | Overview | Assess a lead | ? | ? | ? | ? | untouched |
| H12 | lead-mentor | Supervision | See mentors led | F-03 | F-03 | F-03 | ? | untouched |
| H13 | lead-mentor | Account | Review account | ? | ? | ? | ? | untouched |
| H14 | supervisor | Overview | Assess a supervisor | ? | ? | ? | ? | untouched |
| H15 | supervisor | Supervision | See supervision list | F-03 | F-03 | F-03 | ? | untouched |
| H16 | supervisor | Account | Review account | ? | ? | ? | ? | untouched |
| H17 | admin | Overview | Assess an admin | ? | ? | ? | ? | untouched |
| H18 | admin | Account | Review account | ? | ? | ? | ? | untouched |

> **H8 is the highest-stakes surface in the platform** and has zero breakpoint treatment. `02-VIEW-MATRIX.md` asks whether it should exist on mobile at all — that question is still open and is a product call, not a layout one. It is now larger than the matrix recorded: `care-tab.tsx` plus `care-pattern-block.tsx`, `care-summary-panel.tsx` (which replaced `care-assistant-rail.tsx`), `care-timeline.tsx`, `care-summary.tsx`.

## I · Dev (1)

| ID | Route | Substrate | 320–430 | Status |
|---|---|---|---|---|
| I1 | `/dev/components` | — | ? | untouched |

> The DEV harness itself (`components/dev/dev-bar.tsx`) is global chrome, not a view. It is fixed full-width at the bottom in **all** environments and both app shells subtract its height (`--dev-bar-h`), so it does not overlay. See RC-5.

## J · Overlays (26) — see [Overlay inventory](#overlay-inventory)

---

## Root-cause confirmation

Walked all six against `66f9491`. **RC-2 is exact. RC-1, RC-3, RC-4 and RC-5 have moved or are wrong in detail. RC-6 is substantially resolved since Phase 0.**

### RC-1 · No mobile navigation — **CONFIRMED, one count wrong**

- `settings/sidebar.tsx:82` — `w-[92px]`, zero breakpoint treatment. **Exact.**
- `settings/sidebar.tsx:98` — `<button>`. **Line exact, description imprecise:** the handler is `onClick={() => onSelect?.(item.id)}`, not `router.push` directly; the push lives in the consuming shell. The *finding* holds — it is a button, so middle-click, cmd-click and long-press-to-open are all lost.
- **Mount count is wrong.** The audit says "14 shelled route mounts (`MentorShell` ×11, `AdminShell` ×3)". Actual JSX mounts in `app/`: **`<MentorShell>` ×18, `<AdminShell>` ×5 = 23.** Several are persona branches inside one route file, which is probably where 14 came from — but the count of places this nav renders is 23.

### RC-2 · Phone preview deleted below 1024px — **CONFIRMED, every line exact**

`phone-preview.tsx:30` `w-[360px] shrink-0` ✓. All five `hidden lg:` sites land exactly: `matching-profile-editor.tsx:301` · `first-moments-editor.tsx:109` · `admin/review/page.tsx:405` · `admin/profile-update/page.tsx:302` · `onboarding/submitted/page.tsx:115`. The `zoom: 0.74` fallback at `admin/mentor/page.tsx:1333` ✓ exact.

### RC-3 · Tables have no small-screen strategy — **CONFIRMED, four of six citations moved**

| Audit | Actual | Construct |
|---|---|---|
| `roster.tsx:344` | **`:385`** | `min-w-[720px]` |
| `team-directory.tsx:242` | `:242` ✓ | `min-w-[760px]` |
| `relationship-table.tsx:311,394` | **`:424`, `:550`** | `min-w-[640px] table-fixed` ×2 |
| `roster.tsx:497` | **`:702`** | row `onClick` → `router.push` |
| `team-directory.tsx:257` | **`:260`** | row `onClick` → `router.push` |

Substance holds entirely: four tables with hard minimum widths, rows navigated by `onClick` on a non-focusable element, `stopPropagation` on the action cells as the symptom.

### RC-4 · Code typography ≠ Bloom typography — **CONFIRMED, both citations wrong**

- Token block is at **`settings-tokens.css:158+`**, not `82–95, 236–239`. **19** `--type-*` tokens, single fixed values, no mobile ramp. Substance holds.
- **The font claim is wrong by one face.** The audit says "only `TWKLausanne-400` and `Avantt-Bold` ship". Actually **three** faces ship (`app/layout.tsx:12–26`): `TWKLausanne-400`, `Avantt-Bold`, **`Avantt-BoldItalic`**. The conclusion is unaffected — there is still no 500 or 600 weight, so every weight-500/600 token renders synthetically.
- **382 inline `text-[Npx]` literals across 100 files** bypass the tokens entirely. Feeds Phase 17.

### RC-5 · Fixed chrome ignores safe areas — **CONFIRMED for two clauses, third is STALE**

- `env(safe-area-inset-*)` in **exactly one file**, `onboarding/change-requests-dock.tsx:63` ✓ exact. Still true: 1 of 28 fixed/sticky sites.
- Mobile preview pill `fixed inset-x-0 … p-4 lg:hidden` at `onboarding-layout.tsx:146` ✓; `step-scaffold.tsx:83` ends its form with an inline `mt-10` Continue and no bottom reservation (audit said `:82`, off by one). **The CTA-under-the-pill collision is real and unfixed.**
- **`dev/role-toggle.tsx:136` no longer exists.** That file was deleted and replaced by `components/dev/dev-bar.tsx` — a full-width bottom bar. The *overlay* half of the finding is **resolved**: the body carries the bar's height as padding and both app shells use `h-[calc(100dvh-var(--dev-bar-h,0px))]`, so no product pixel sits under it. The *all-environments* half still stands, deliberately and by instruction.

### RC-6 · `overflow-hidden` never paired with a scroll escape — **CONFIRMED as a pattern, 3 of 5 named instances FIXED in Phase 0**

Census now: **64 `overflow-hidden` across 46 files** (audit said 55). Only **9 of 46 files** contain any scroll escape at all.

| Audit instance | Now |
|---|---|
| `relationship-table.tsx:302` | **moved to `:415`, STILL BROKEN** — wrapper `overflow-hidden`, `min-w-[640px]` table inside at `:424`, no `overflow-x` in the chain |
| `ui/dropdown-menu.tsx:43` | **FIXED** (Phase 0) — `max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto` |
| `ui/dialog.tsx:64` | **FIXED** (Phase 0) — `max-h-[90dvh] overflow-y-auto` |
| `ui/popover.tsx` | **FIXED** (Phase 0) |
| `ui/select.tsx:75` | correct, unchanged — still the reference |

**New RC-6 sub-finding: `vh` where `dvh` is required.** `03-DEFINITION-OF-DONE.md` says "`100dvh`, never `100vh`". Eight live instances remain (31 uses are correctly `dvh`):

`app/app/activity/page.tsx:124` `min-h-[40vh]` · `components/activity/activity-ledger.tsx:469,1065` `min-h-[40vh]` · `components/tasks/completion.tsx:35` `min-h-[45vh]` · `components/tasks/tasks-page.tsx:660` `min-h-[45vh]` · `components/record/care-update-compose.tsx:141` `max-h-[52vh]` · `components/onboarding/intro-examples-modal.tsx:176` `max-h-[56vh]` · `components/onboarding/welcome-back-modal.tsx:90` `max-h-[44vh]`.

Five of those eight are mine, added earlier in this session before Phase 0 established the rule. Logged as F-07 rather than fixed here — this phase changes no code.

---

## Census

Against `66f9491`, `src/` only, `.ts`/`.tsx`/`.css`.

| Pattern | Files | Hits | Note |
|---|---|---|---|
| `w-[Npx]` / `min-w-[Npx]` / `max-w-[Npx]` | 29 | 46 | RC-2, RC-3 |
| `overflow-hidden` | 46 | 64 | RC-6. Only 9 files contain any escape |
| `overflow-x-*` / `overflow-y-*` | 26 | 39 | +3 since Phase 0 |
| `vh` / `dvh` | 28 | 42 | **8 bad `vh`**, 31 correct `dvh` → F-07 |
| `hidden {bp}:` / `{bp}:hidden` | 10 | 14 | 5 are RC-2; 3 are deliberate xl-only panes (gap rows 239, 249) |
| `hover:` | 76 | 221 | Phase 15 — needs per-site focus-counterpart check |
| fixed / sticky | 15 | 28 | 1 respects safe areas → RC-5 |
| `onPointerDown` / `onDragStart` / `draggable` / `onTouchStart` | 4 | 9 | SC 2.5.7 check, Phase 15 |
| `title=` | 31 | 66 | Phase 15. One fixed in Phase 0 (`caseload-controls`) |
| `text-[N px]` inline | **100** | **382** | RC-4 → Phase 17. The largest single number in the census |
| `env(safe-area` | **1** | **1** | RC-5 |
| `matchMedia` / `innerWidth` / `ResizeObserver` | 6 | 11 | Existing responsive logic to reuse |

**Breakpoint usage:** `sm:` 111 · **`md:` 0** · `lg:` 106 · `xl:` 13. The audit's headline claim is confirmed: **tablet has never been designed.** (Two literal `md:` matches exist and are both false positives — the token `--radius-md` and an object key in `segmented-control.tsx:51`.)

---

## Overlay inventory

26 consumer files. **Content height at 390×844 is `?` for all but two** — reaching each overlay requires driving its trigger through its own persona/lifecycle/subject gates, which is Phase 1 work I did not complete. The two measured are marked. Recommendations are from content *shape*, which is code-derivable; heights that would change a recommendation are flagged.

| # | File | What opens it | H @ 390×844 | Recommendation |
|---|---|---|---|---|
| 1 | `record/flag-review-dialog.tsx` | Review on a flag/escalation task card | **814px** (measured @740×420) | **Full-screen route.** 3 numbered steps, a select, a textarea and a close note — it is a form, not a dialog |
| 2 | `admin/mentor-status-badge.tsx` | Status badge trigger (menu) | **238px** (measured) | Stays a menu; bottom sheet at <640 |
| 3 | `record/caseload-modal.tsx` | Caseload row on roster | ? | **Bottom sheet.** Header + `max-h-72` list + stepper block |
| 4 | `record/mentee-table.tsx` (AddMenteePicker) | Add mentee | ? | **Bottom sheet.** Header + `max-h-72` list |
| 5 | `record/dsm5-search.tsx` | Change presentation / code picker | ? | **Full-screen route.** Search + long result list |
| 6 | `record/care-update-compose.tsx` | Write a care update | ? | **Full-screen route.** `max-h-[52vh]` textarea form |
| 7 | `record/care-review-card.tsx` | Approve presentation | ? | **Bottom sheet** |
| 8 | `record/confirm-dialog.tsx` | Destructive confirms | ? | **Stays centered.** Two lines + two buttons |
| 9 | `record/organization.tsx` | Org/deactivate actions | ? | Bottom sheet |
| 10 | `record/relationship-table.tsx` | Row overflow menu | ? | Bottom sheet at <640 |
| 11 | `record/caseload-controls.tsx` | Capacity popover | ? | Bottom sheet at <640 |
| 12 | `activity/filter-dialog.tsx` | Filter on the ledger | ? | **Bottom sheet.** Checkbox groups |
| 13 | `tasks/shortcuts.tsx` | `?` key | ? | **Stays centered.** Short `<dl>`; desktop-only concern |
| 14 | `settings/account-popover.tsx` | Avatar in the rail | ? | Bottom sheet at <640 |
| 15 | `settings/sign-out.tsx` | Sign out confirm | ? | Stays centered |
| 16 | `dev/dev-bar.tsx` | Reset confirm | ? | Stays centered (dev chrome) |
| 17 | `onboarding/intro-examples-modal.tsx` | Examples step | ? | **Full-screen route.** `max-h-[56vh]` list of cards |
| 18 | `onboarding/welcome-back-modal.tsx` | Return to onboarding | ? | Bottom sheet. `max-h-[44vh]` list |
| 19 | `onboarding/hub/hub-welcome-modal.tsx` | First hub visit | ? | Bottom sheet |
| 20 | `onboarding/onboarding-layout.tsx` | Mobile preview pill | ? | **Already the reference pattern** (`:144–166`) |
| 21 | `profile-editor/account-editor.tsx` | Edit an account field | ? | **Full-screen route.** Form |
| 22 | `profile-editor/update-review-bits.tsx` | Review an update field | ? | Bottom sheet |
| 23 | `app/admin/review/page.tsx` | Approve/reject | ? | Bottom sheet |
| 24 | `app/admin/profile-update/page.tsx` | Approve/reject | ? | Bottom sheet |
| 25 | `app/admin/mentor/page.tsx` | Record-level actions | ? | Bottom sheet |
| 26 | `app/app/profile/page.tsx` | Self-profile actions | ? | Bottom sheet |

**Tally:** full-screen route 5 · bottom sheet 15 · stays centered 4 · already solved 1 · menu 1. **15 bottom sheets is the case for Phase 14's sheet variant** — that is more than half the overlay surface, and hand-rolling it 15 times is the failure mode.

---

## Flow map

| Flow | Ordered steps | Shells | Crosses shells? |
|---|---|---|---|
| Mentor onboarding | `/` → `/invite/[token]` → `/onboarding` ×12 → `/onboarding/preview` → `/onboarding/submitted` → `/hub` → 5 hub steps → `/app` | — → — → OL → — → — → — → — → **MS** | **YES — four transitions.** Bare→OL at `/onboarding`, OL→bare at `/preview`, bare→bare at `/hub`, bare→**MS** at `/app`. The last is the dangerous one: the app shell and its `w-[92px]` nav appear for the first time with no transition, and there is no back path to `/hub`. |
| Profile update + review | `/app/profile` → *(mentor submits)* → `/admin/profile-update` | **MS** → **AS** | **YES.** Two different shells, two different navs, two different personas. A deep link into `/admin/profile-update` as a mentor has no defined behaviour on mobile. |
| Supervisor review | `/admin/review` (single) | AS | No — but the artifact is `hidden lg:` (F-02), so the flow is unusable below 1024 regardless |
| Record navigation | `/app/mentees` → `/admin/person/[id]` → `?tab=` | **MS or AS** (persona-dependent) → **AS + RS** | **YES, and persona-dependent.** A mentor starts in MS and lands in AS; a supervisor stays in AS. The tab is a query param, so mobile back from a tab returns to the previous *tab*, not the list — and `?subjectRole=` / `?focus=` compound it. |

**Three of four flows cross shells.** Every one of those transitions is a place where mobile back-navigation and deep-linking will break, and none is visible from the route list.

---

## Findings

Substrate-level, measured. Per-view rows are `?` until Phase 2+.

| ID | View | BP | Finding | Sev | Standard | file:line | Proposed fix |
|---|---|---|---|---|---|---|---|
| F-01 | all D, G, H (S1) | 320–768 | `w-[92px]` nav has no breakpoint treatment; 24% of a 390px viewport, ~282px content column. Items are `<button>`, so no middle/cmd-click | **Critical** | SC 1.4.10 Reflow; Fitts | `settings/sidebar.tsx:82,98` | Bottom tabs or a drawer below `lg`; items become `<Link>` |
| F-02 | A3, A4, E1, E2, G1, G2, G3, H3, H4 (S4) | 320–1023 | Phone preview is `w-[360px] shrink-0`, so six surfaces delete it with `hidden lg:`. **On `/admin/review` the artifact under review is off-screen** | **Critical** | DoD "no content deleted at a breakpoint" | `settings/phone-preview.tsx:30`; 5 `hidden lg:` sites | Make the preview scale; or a dedicated preview route below `lg` |
| F-03 | D4–D9, H2, H9, H12, H15 (S5) | 320–768 | Four tables with hard `min-w`; `relationship-table` sits in an `overflow-hidden` wrapper with **no scroll escape**, so content is clipped and unreachable | **Critical** | SC 1.4.10; SC 2.1.1 | `relationship-table.tsx:415,424`; `roster.tsx:385`; `team-directory.tsx:242` | Card-list below `md` (`record/person-row.tsx` is the reference); add `overflow-x-auto` as the interim |
| F-04 | H7 | 320–390 | `TaskBand` label and actions collide — **fixed in Phase 0** (`flex-wrap`), verified: actions wrap to their own line, left-aligned at the same x | Serious → **resolved** | Law of Proximity | `record/task-label.tsx:119` | Done |
| F-05 | B1–B12, C2–C6 (S3) | 320–430 | Wizard CTA sits under the `fixed … lg:hidden` preview pill; no bottom reservation, no safe-area inset | **Critical** | SC 2.4.11 Focus Not Obscured | `onboarding-layout.tsx:146`; `step-scaffold.tsx:83` | Reserve pill height + `env(safe-area-inset-bottom)` |
| F-06 | H8 | 320–768 | Care tab has **zero** breakpoint treatment across five components, including a two-column grid and a 320px rail | **Critical** | SC 1.4.10 | `care-tab.tsx:223`; `care-summary-panel.tsx:306` | Open product question first: should this exist on a phone? |
| F-07 | multiple | 320–430 | 8 live `vh` units where DoD requires `dvh`; on mobile Safari `vh` is the largest viewport, so these overflow whenever the URL bar shows | Serious | DoD "100dvh, never 100vh" | 8 sites listed under RC-6 | Mechanical `vh`→`dvh` |
| F-08 | all overlays (S6) | 320–430 | 15 of 26 overlays want a bottom sheet; no sheet variant exists | Serious | HIG; Material 3 | `ui/dialog.tsx` | Phase 14 sheet variant |

### Severity summary

| Severity | Count | IDs |
|---|---|---|
| **Critical** | **5** | F-01, F-02, F-03, F-05, F-06 |
| Serious | 2 | F-07, F-08 |
| Resolved in Phase 0 | 1 | F-04 (+ 3 of RC-6's 5 named overflow instances) |
| Minor | 0 | — none established; Phase 2+ measurement will surface these |
| Polish | 0 | — |

**Accessibility failures among the criticals: all five.** F-01 and F-03 fail SC 1.4.10 Reflow; F-03 also fails SC 2.1.1 (keyboard); F-05 fails SC 2.4.11; F-02 fails the DoD's content rule and makes an approval decision on unseen content.

---

## What Phase 1 did not finish

Stated plainly rather than left as gaps in the table.

1. **Per-view measurement at six viewports.** 93 × 6 = 558. I measured the eight substrates and one representative per cluster. Every unmeasured cell is `?`, never guessed.
2. **Overlay content heights at 390×844.** 2 of 26 measured. Each remaining one needs its trigger driven through its own gates.
3. **`hover:` focus-counterpart audit.** 221 sites. Needs per-site inspection; Phase 15.
4. **`title=` audit.** 66 sites, 1 fixed. Phase 15.

## States I could not reach — need your input

- **`rejected` lifecycle** — reachable by setting `status` in the store, but I have not confirmed which surfaces branch on it beyond the change-requests dock. Which views must be verified under `rejected`?
- **`/admin/review` with a real pending submission** — the queue's seeding path is not obvious from code. `01-CONTEXT.md` §Ask-don't-assume raises this as "how to seed persona / subject-role / lifecycle state for screenshots". Still open.
- **Whether H8 (teen Care) should exist on mobile at all.** A product call, and it changes whether F-06 is a layout job or a routing job.
