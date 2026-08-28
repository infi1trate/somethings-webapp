# Responsive Work — Standing Context

> Read this before touching any layout in this repo. It is the standard, the repo's constraints, and the known root causes. It does not tell you what to build — the phase file does that.

## Standard

Act as a decorated product designer + senior front-end engineer — the caliber of someone shipping at Apple, Linear, Vercel, or Stripe. Hold two things at once:

1. **The simplest UX that solves the real goal.** On a phone, first ask what can be removed, deferred, or drilled into. Never ask how to cram a desktop layout into 390px.
2. **World-class UI, no exceptions.** A narrow viewport is not permission for a degraded surface.

Ground every claim that something is better in a standard: Nielsen's heuristics, WCAG 2.2 AA, Apple HIG / Material 3, Laws of UX (Fitts, Hick, Jakob, Miller), typographic and grid convention.

**Separate fact from judgment.** "Fails WCAG 2.2 SC 2.5.8: target is 18×18px" is a fact. "I'd collapse this to one primary action" is a judgment call. Label them differently.

**Name the tradeoff.** Few choices are strictly dominant. Every recommendation states what it costs.

**Severity:** Critical (breaks the task or fails accessibility) · Serious (significant friction or heuristic violation) · Minor (rough edge) · Polish (craft layer). Accessibility failures are never Polish.

## Repo constraints

**Stack.** Next.js 16.2.9 / React 19.2.4 / Tailwind v4 / shadcn (`radix-nova` style) / zustand / react-hook-form + zod.

**`AGENTS.md` warns this is not the Next.js in your training data.** Read `node_modules/next/dist/docs/` before touching routing, `searchParams`, or metadata. Existing invariant: `use(searchParams)` passed as a prop, never `useSearchParams`, no page-root Suspense (see `app/app/[section]/page.tsx:26`).

**Bloom is the floor, not the ceiling.**
- Semantic tokens: `src/app/settings-tokens.css`
- shadcn alias layer + `@theme inline`: `src/app/globals.css`
- Never hardcode a hex. Never invent a token name. Read the files first.
- New tokens go in the semantic layer with a comment naming their Figma source.
- Default to Bloom where consistency matters. Take liberties only where a moment deserves to be exceptional — and when you do, say so explicitly, name the cost, and propose how the extension graduates back into the system.

**Breakpoints.** `globals.css` defines no `--breakpoint-*` overrides, so Tailwind v4 defaults apply (sm 640 · md 768 · lg 1024 · xl 1280). Current usage: `sm:` 101× · `lg:` 100× · **`md:` zero times.** Tablet has never been designed, only inherited. Fix at the system level; do not sprinkle `md:`.

**The comments are load-bearing.** This codebase records prior decisions, reversals, and measured contrast ratios inline. Read the comment before changing what it describes, and preserve it. Several document patterns that were deliberately *removed* — do not silently reintroduce one. `design-system-gaps.md` is the running debt log; read entries referenced by `gaps.md #N` in any file you touch, and append rather than starting a new file.

**Citations.** Cite `path/to/file.tsx:LINE` for every finding and every change. A finding without a citation gets deleted.

**No app code before the phase's first GATE clears**, unless the phase says otherwise.

## Root causes

These are audit findings against `main` @ `08c91d1`, not guesses. Verify each before acting and say plainly where the audit is wrong.

**RC-1 · There is no mobile navigation, at all.**
`components/settings/sidebar.tsx:82` — `SettingsSidebar` is `w-[92px]` with zero breakpoint treatment, and it is the only nav for all 14 shelled route mounts (`MentorShell` ×11, `AdminShell` ×3). At 390px it takes 24% of the viewport and leaves a ~282px content column. Items are `<button onClick={router.push}>` (`:98`), which drops middle-click, cmd-click and long-press-to-open.

**RC-2 · The live phone preview is deleted below 1024px in six places rather than adapted.**
`components/settings/phone-preview.tsx:30` is locked to `w-[360px] shrink-0` with a `h-[736px]` screen. Because it can't shrink, six surfaces wrap it in `hidden lg:…`:
`profile-editor/matching-profile-editor.tsx:301` · `profile-editor/first-moments-editor.tsx:109` · `app/admin/review/page.tsx:405` · `app/admin/profile-update/page.tsx:302` · `app/onboarding/submitted/page.tsx:115` · plus `app/admin/mentor/page.tsx:1333`, which uses `style={{ zoom: 0.74 }}` instead.
On `/admin/review` the artifact under review is off-screen below 1024px.

**RC-3 · Data tables have no small-screen strategy.**
`min-w-[720px]` (`admin/roster.tsx:344`) · `min-w-[760px]` (`admin/team-directory.tsx:242`) · `min-w-[640px] table-fixed` (`record/relationship-table.tsx:311,394`). Rows navigate via `<tr onClick>` (`roster.tsx:497`, `team-directory.tsx:257`) — not keyboard-focusable as a row, with `stopPropagation` on four action cells as the symptom.

**RC-4 · The typography system in code is not Bloom's typography system.**
`settings-tokens.css:82–95, 236–239` defines an ad-hoc set (`--type-display`, `--type-card-title`, `--type-row-value`, `--type-title-lg`…) with single fixed values. The Figma source is the canonical Display / Headline / Title / Body / Label / Label-Alt taxonomy **with Mobile and Web modes** — the mobile ramp has nowhere to live. Compounding: only `TWKLausanne-400` and `Avantt-Bold` ship (`app/layout.tsx:9–27`), so every weight-500/600 token renders synthetically (`gaps.md #12`). Hundreds of inline literals (`text-[14px] leading-[20px]`) bypass tokens entirely.

**RC-5 · Fixed chrome ignores safe areas and focus obstruction.**
`env(safe-area-inset-*)` appears in exactly one file (`onboarding/change-requests-dock.tsx:63`). The onboarding mobile preview pill is `fixed … bottom-0 p-4` (`onboarding-layout.tsx:144–150`) while `step-scaffold.tsx:82` ends its form with an inline `mt-10` Continue and no bottom reservation — so the primary CTA of every wizard step sits under the pill. `dev/role-toggle.tsx:136` is `fixed bottom-3 z-50` and renders in **all** environments including the deployed demo.

**RC-6 · `overflow-hidden` is used for corner-rounding and never paired with a scroll escape.**
55 uses of `overflow-hidden` in `src`; **one** co-occurs with `overflow-x-auto` / `overflow-y-auto` / `max-h-`. Correct on desktop where content never exceeds the box; silently destroys content on any axis that overflows. Confirmed instances:
- `record/relationship-table.tsx:302` — wrapper is `overflow-hidden`, table inside is `min-w-[640px]`, no `overflow-x` anywhere in the chain. Below a 640px container the right of the table is **clipped, not scrollable** — not by wheel, drag, or keyboard.
- `ui/dropdown-menu.tsx:43` — `overflow-hidden`, no `max-h`, no `overflow-y`.
- `ui/dialog.tsx:64` — no `max-h`, no overflow handling at all.
- `ui/popover.tsx` — no height bound.
- `ui/select.tsx:75` — **correct**: `max-h-(--radix-select-content-available-height)` + `overflow-y-auto`. This is the reference implementation; copy this line.

## Reference implementations — copy these, don't invent

The right pattern usually already exists somewhere in this repo. Search before designing.

| Need | Already solved at |
|---|---|
| Mobile alternative to a desktop side panel | `onboarding/onboarding-layout.tsx:144–166` — persistent trigger opening a dialog |
| Overlay height bound + scroll | `ui/select.tsx:75` |
| Card-list row (mobile list item) | `record/person-row.tsx:105–203` — `min-h-11`, truncate on both lines, `shrink-0` trailing cluster, three variants so it never nests interactives |
| Card-list *page* | `app/app/activity/page.tsx` — `max-w-2xl`, every row a `<Link>` with `min-h-11`, real empty state, deep links |
| Extending a compact control to a 44px touch target | `admin/chat-action.tsx:47` (`min-h-9` + `after:inset-x-0 after:-inset-y-1`) and `record/segmented-control.tsx:47` (`hit: after:-inset-y-2` on `h-7`) |
| A control that survives container reflow | `record/segmented-control.tsx:104` — `ResizeObserver` re-measure |
| Safe-area-aware fixed bottom chrome | `onboarding/change-requests-dock.tsx:63` |
| Responsive alert/banner | `record/attention-card.tsx:118,142` — `flex-wrap` on the banner, `sm:flex-row` on the card |
| Nested-link avoidance in a clickable row | `record/mentee-table.tsx:333–405` — full-bleed overlay link + `pointer-events` opt-in, with the measured hydration error documented |

**Touch targets are an enforcement gap, not a knowledge gap.** `ChatAction` and `SegmentedControl` apply the `::after` extension deliberately and comment on it; `caseload-controls.tsx:28` (`STEP_BTN`, `size-7`, no extension) and `mentor-status-badge.tsx:85` (badge trigger, no min-height) don't. Prefer one shared utility over 40 individual fixes.

## Ask, don't assume

- Which personas use which surfaces on a phone.
- Whether any surface is deliberately desktop-only for the ePHI posture.
- The bottom-nav item set, if bottom tabs win — six items exceeds the recommended ceiling and the demotion is a product call.
- Whether Bloom already carries breakpoint tokens in the Figma source.
- How to seed persona / subject-role / lifecycle state for screenshots.
