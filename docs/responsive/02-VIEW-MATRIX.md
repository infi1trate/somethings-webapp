# View Matrix — the tracker

~92 view-states across 22 route files. Routes multiply through tab registries, persona gates, subject-role gates and lifecycle states. **This file is the tracker for the whole project.** Phase 1 completes it; every later phase updates the Status column.

Status values: `untouched` → `substrate-fixed` → `verified` (screenshot-diffed at all six viewports + axe clean).

## Redirects — not views, do not audit, do not break

| Route | Redirects to | File |
|---|---|---|
| `/app/mentors` | `/app/team` (client) | `app/app/mentors/page.tsx:12` |
| `/app/teens` | `/app/mentees` (server) | `app/app/teens/page.tsx` |
| `/admin/users` | `/app/team`, or `/app/mentees` when `?segment=teens\|mentees` | `app/admin/users/page.tsx:25` |

Each exists so bookmarks don't 404 and carries a comment explaining the merge. Preserve all three.

## Clusters

| Cluster | Views | Source of the count |
|---|---|---|
| Onboarding wizard `/onboarding` | ~16 | 14 counted steps + 2 interstitials — `lib/onboarding/steps.ts:22–42` |
| Activation hub | 6 | `/hub` + 5 step routes (`profile`, `story`, `training`, `scheduling`, `away`) — `lib/onboarding/hub.ts` |
| Pre-app | 4 | `/`, `/invite/[token]`, `/onboarding/preview`, `/onboarding/submitted` |
| Mentor app routes | ~11 | `/app`, `/app/activity`, `/app/mentees` (×3 persona branches), `/app/team` (×3 scopes), plus the `[section]` catch-all's 5 placeholder states and its `?with=` named-person variant |
| Self profile `/app/profile` | 4 | Profile · First moments · Schedule · Account — `app/app/profile/page.tsx:37` |
| Settings `/app/settings` | 6 | Security, Notifications, Appearance (live) + Language, Accessibility, Audio & video (coming-soon) — `components/settings/settings-sections.ts` |
| Supervisor console | 3 | `/admin/review`, `/admin/profile-update`, `/admin/mentor` (8 tabs) |
| **User records** | **18** | 8 built tabs × subject-role gating — `lib/record/tabs.ts` |
| Overlays | 27 | files containing `DialogContent` / `PopoverContent` / `DropdownMenuContent` |
| Dev | 1 | `/dev/components` |

## Record tab matrix

8 built tabs, gated by the **subject's** role (existence gate, distinct from the viewer permission gate — see `RecordTabDef` in `lib/record/tabs.ts`). Reach non-mentor subjects with `?subjectRole=` (`subjectRoleFromParam`).

| Subject role | Tabs | Count |
|---|---|---|
| mentor | Overview · Mentorship · Profile · First moments · Schedule · Account | 6 |
| teen | Overview · **Care** · Mentorship · Account | 4 |
| lead-mentor | Overview · Supervision · Account | 3 |
| supervisor | Overview · Supervision · Account | 3 |
| admin | Overview · Account | 2 |

Rendered by both `/admin/person/[id]` and `/admin/mentor`. The teen Care tab is the highest-stakes surface in the platform (`care-tab.tsx` 480 LOC, `care-assistant-rail.tsx` 532 LOC, `care-timeline.tsx`) and has **zero** breakpoint treatment. Confirm whether it should exist on mobile at all before designing it.

Right rail default per tab comes from `railDefaultFor()` — Preview beside the teen-facing tabs, Notes elsewhere. Both segments need a mobile placement.

## Cross-cutting modifiers

These change chrome and content, not layout structure. Verify each affected view under each value rather than treating them as separate rows.

- **Personas (4):** `new-mentor`, `mentor`, `lead-mentor`, `supervisor`/`admin` — `lib/types.ts:12`. `MentorShell:31` drops Mentees for a lead, so the nav item count is persona-dependent.
- **Profile lifecycle (5):** `invited`, `pending`, `in_review`, `published`, `rejected` — `lib/types.ts:19`. Drives the status badge, the change-requests dock, and every hub card state.

## Tracker columns for Phase 1

`ID · Cluster · Route · Tab/section · Persona gate · Subject-role gate · Lifecycle gate · Shell · Substrate(s) · Primary user goal · 320 · 390 · 430 · 768 · 1024 · 1280 · Status`

Mark anything undeterminable from code as `NEEDS-VISUAL`. Never describe a rendered UI you haven't verified.

## Substrate map — why the sweep is last

Eight substrates compose almost the whole platform. Fixing them resolves the large majority of the ~92; Phase 19 sweeps the genuine one-offs.

| Substrate | File(s) | Views governed |
|---|---|---|
| App shell + nav | `settings/sidebar.tsx`, `mentor/mentor-shell.tsx`, `admin/admin-shell.tsx` | all 14 shelled mounts + every record tab beneath them |
| Record shell | `record/user-record-shell.tsx` | 18 record tab-views + 4 self-profile tabs |
| Step scaffold + onboarding layout | `onboarding/step-scaffold.tsx`, `onboarding/onboarding-layout.tsx` | ~16 wizard steps + hub steps |
| Phone preview | `settings/phone-preview.tsx` | 6 preview surfaces |
| Tables | `admin/roster.tsx`, `admin/team-directory.tsx`, `record/relationship-table.tsx`, `record/mentee-table.tsx` | ~6 list views |
| Overlays | `ui/dialog.tsx`, `ui/dropdown-menu.tsx`, `ui/popover.tsx` | 27 surfaces |
| Row + section primitives | `settings/section-card.tsx`, `settings/edit-row.tsx`, `account/field-rows.tsx`, `record/row.tsx`, `record/person-row.tsx` | 6 settings sections + Account tabs + most editors |
| Tab bars | `settings/tab-bar.tsx`, the inline nav in `user-record-shell.tsx:213`, `record/segmented-control.tsx` | every tabbed view |
