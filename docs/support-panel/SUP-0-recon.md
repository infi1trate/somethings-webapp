# SUP-0 Recon: global support panel and top bar

Read only. No code changed. Measured on `feat/bar-02-panel` at `8e25e83`, 2026-10-16. Figma read directly: frame `3928:10078`, `topBar` `3928:10081` and the panel `3934:13443`, with their bound variables.

## Blocking questions (need answers before SUP-1)

1. **Whose screen is this?** The Figma frame is a **supervisor's** view. Its sidebar has Today, Monitoring, Casework (Care Reviews, Referrals), Mentors (Matching, Performance, Training) and Directory; the thread footer reads "Viewing as a supervisor · Take over"; the panel's thread is with "Supervisor Name". The pack's rationale is a **mentor** asking a supervisor while reading the teen thread. In code the Support tab lives in the mentor chat (`ChatThread.kind: "support"`, messages `sender: "mentor" | "them"`). Which personas get the top bar and the panel: mentor, lead mentor, supervisor, admin, or all of them?
2. **The push threshold does not fire at Figma's own width.** SUP-2 pushes when content width is 1280 or more. Figma gets 1280 from a 232px sidebar. In code:
   - **Measured at 1512 on `/app/chat`:** the staff rail is **248px** (`grouped-rail.tsx:364`), and the canvas panel is **1248px** wide (`<main>` 1264 minus its `md:pr-4`). That is below 1280, so the panel would overlay.
   - The mentor icon rail is **92px**, measured canvas **1404px**, which pushes.

   Should the threshold be measured on the content container (as written), should the staff rail move to 232, or should the threshold change?
3. **`/app/*` has no shared layout, so "state survives route changes" needs one.** Each of the 10 route pages renders `<AppChrome>` itself (for example `src/app/app/chat/page.tsx:70`), so the shell unmounts and remounts on every navigation. Open/closed state can live in a store, but scroll position and the live DOM cannot survive a remount. Recommendation: add `src/app/app/layout.tsx` that owns the shell and the panel, with pages passing only their content and active item. This touches all 10 pages, which is why it is raised here rather than done quietly.
4. **SUP-3's Cohorts, Groups and Other have no data.**
   - The support list is a fixed array of two people (`SUPPORT_IDS = ["s-brandy", "s-stephen"]`, `src/lib/chat/seed.ts:59`).
   - People data has `leadId`, `supervisorId` and a free-text region `group` (`people-demo.ts:40-79`), but there is no cohort entity, and no group-chat entity of any kind.
   - Build those sections from new fixture data marked TODO-DATA, or ship Supervisors only and render the other three as empty states?
5. **The canonical tokens this pack names do not exist yet.** CT-01 never ran (the CT series stopped after the CT-00 recon). `surface-raised`, `surface-sunken`, `surface-sunken-strong`, `surface-overlay`, `border-default` and `status-online` are all undefined in code. Run CT-01 first, or build SUP on the legacy names (`--surface-card`, `--surface-s1`, `--border-subtle` and so on) and migrate later?
6. **Figma disagrees with the CT pack on two values, and the CT pack says Figma is the authority.**

   | Token | Figma (this frame) | CT pack | SUP Appendix B |
   |---|---|---|---|
   | `surface-sunken-strong` | `#e8e4db` | `#e5e0d2` | `#e8e4db` |
   | `status-online` | `#1bda7a` | `#11884d` | `#1bda7a` |

   Also: `#1bda7a` as a 9px dot measures **1.85:1 on white** and **1.68:1 on canvas**, under the 3:1 that SC 1.4.11 asks of a non-text indicator. The pack already pairs it with text ("online") for SC 1.4.1, but the dot itself will not meet 3:1. The CT pack's `#11884d` measures **4.51:1** on white.

## 1 · The app shell

- **Component:** `AppShell` (`src/components/app-shell/app-shell.tsx:51`), wrapped by `AppChrome` (`app-chrome.tsx:68`), which computes nav, badges and persona.
- **Structure:**
  - The root is a flex row (`h-dvh`).
  - The rail is `md` and up only: the grouped staff rail at 248px, or the mentor icon rail at 92px.
  - Then a column, `flex min-h-0 min-w-0 flex-1 flex-col`, holding `<TopBar>` (mobile only) above `<main className="... md:py-4 md:pr-4">`.
  - Inside `<main>` is the canvas panel: `bg-[var(--surface-s1)]`, `md:rounded-[var(--radius-panel)]`, `md:shadow-[var(--shadow-panel)]`, scrolling internally.
- **Is there a slot for a top bar that does not shift the sidebar? Yes.** The column beside the rail already stacks a bar above `<main>`. The rail is a sibling, so a bar in that column cannot move it. The sidebar's top edge is the app's top edge today.
- **What changes there:** `<main>`'s `md:py-4` top padding. Figma's content container starts directly under the 64px bar (`Content-Container-Right` at y=64), so the top padding would drop when the bar renders.
- **The existing `TopBar` is the mobile bar** (`top-bar.tsx:52`): wordmark, Activity bell and avatar, `md:hidden`, built from Figma `2308:19812`. It and the desktop bar would need one responsive answer (see section 6).
- **Global mounts already exist in the root layout** (`src/app/layout.tsx`): `DevBar`, `AnnoLayer` and `Toaster`. That is the precedent for app-level, route-independent UI.

## 2 · The Support tab on `/app/chat`

- **Renders:** `ConversationList` (`src/components/chat/list/conversation-list.tsx:253-297`), using `SegmentedControl` (`src/components/record/segmented-control.tsx:54`, `semantics="tabs"`).
- **Switches:** `workspace: ThreadKind` = `"teen" | "support"` (`src/lib/chat/types.ts:42`). Both lists share `ConversationRow` and the All / Unread / Check-in chips.
- **List state:** local `useState`, seeded from a module-level `listMemory` object (lines 96-107), so it survives remounts but not reloads.
- **Data source: route-scoped.**
  - Threads are built inside `ChatPage` with `useMemo(() => chatScenario(scenarioId, now))` (`chat-page.tsx:109-112`), from static seed. There is no chat provider or context.
  - What is global is the persisted `useOnboardingStore`: `chatScenarioId`, `escalations`, `chatEvents`, `chatNotes` and `chatArtifacts` (`store.ts:323-351`).
- **The "· 1":** `unreadIn("support")` counts threads with `unreadCount > 0`, so it counts conversations, not messages.
  - Every support thread is seeded with `unreadCount: 0`. The 1 is hardcoded for one scenario: `seed.ts:836-839` sets Brandy's thread to 1 when `scenario.id === "escalation-active"`.
  - Unread is never stored; it is recomputed from the seed every time.
- **What a support conversation is:** `ChatThread` (`types.ts:260-283`) with `kind: "support"`. Fields: `id`, `displayName`, `subtitle`, `avatarInitial`, `badge?`, `lastActivityAt`, `preview`, `previewFromMentor`, `unreadCount`, `needsCheckIn`.
  - There are no participants and no thread entity.
  - The two counterparts are `s-brandy` (Brandy Forrestor, lead mentor) and `s-stephen` (Stephen Rowe, supervisor), from `people-demo.ts:213-285`.
- **Inconsistency for SUP-5:** `EscalationState.supervisorId` is hardcoded to `"s-brandy"`, the **lead mentor**, in both `chat-page.tsx:427` (TODO-DATA) and `seed.ts:587`. Yet the banner says "Supervisor notified". Linking "Supervisor notified" into "the relevant supervisor thread" would open the lead mentor's thread.

## 3 · The right rail on `/app/chat`

- **Component:** `Rail` (`src/components/chat/rail/rail.tsx:103-289`).
  - Tabs come from a `SegmentedControl` (`size="sm"`). `RailTab` = `"escalation" | "assist" | "profile" | "toolkit" | "timeline"`, and "Now" is `escalation`.
  - A teen thread shows Assist, Profile, Toolkit and Timeline. A support thread shows Assist and Timeline. An open escalation adds Now in front.
- **Width:** **320px**, not ~280. From `xl` it is the third grid track, `xl:grid-cols-[320px_minmax(0,1fr)_320px]` (`chat-page.tsx:563`); the thread list is also 320 (300 at `md`). Nothing names this width as a constant.
- **Collapse:** only below `xl` (1280).
  - `railOpen` is local state (`chat-page.tsx:135`). The toggle sits in the thread header, `hidden md:flex xl:hidden`, and between `md` and `xl` the open rail overlays the thread.
  - **At `xl` and up it cannot collapse at all.**
- **Lifted state:** none. `railOpen`, the active tab (`pickedTab`, per thread, deliberately not persisted) and `railMode` all live in `ChatPage`.
- **Collapsed strip:** does not exist. The rail is either the full 320px panel or `hidden`.
- **Layout arithmetic for SUP-2 at 1512, measured (staff rail):**
  - The canvas is 1248 and the grid computes to **320 / 608 / 320** with no column gap.
  - Pushing a 424px panel (420 + 4) with the rail still open would leave the thread **184px**, so the mutually-exclusive rule is required, not optional.
  - With the rail collapsed to a strip (assume 48), the thread gets 608 + 320 − 48 − 424 = **456px**.
  - Mentor rail: the canvas is 1404 and the grid **320 / 764 / 320**; with a 48px strip and the panel, the thread gets **612px**.
- **Existing mutual-exclusion pattern to reuse:** dev panel vs annotation drawer. Both are module-level open flags read through `useSyncExternalStore` (`src/lib/dev/panel.ts:44-95`, `src/lib/anno/mode.ts:112-132`). Opening one closes the other in the setter (`panel.ts:65`) and at the toggle (`mode-control.tsx:170-171`). The chat rail is not part of it today; the annotation drawer simply overlays it.

## 4 · Primitives that exist (reuse) and gaps (build)

| Need | Exists | Notes |
|---|---|---|
| Non-modal side panel | **No** | `DialogContent variant="side"` (`ui/dialog.tsx`) is Radix modal: focus trap, scrim and outside-dismiss, which is everything rule 5 forbids. The annotation drawer is `aria-modal` with a trap. The dev panel is `aria-modal="false"` but traps Tab and dismisses on outside click. None fits; SUP-2 builds one. |
| Focus handling | Partly | `useFocusTrap` (`lib/anno/use-focus-trap.ts`) traps, which is wrong here. Its focus-return-with-fallback logic is the reusable part. |
| Icon button | **No component** | `Button` sizes `icon` (40) / `icon-sm` (36) / `icon-lg` (48), all `rounded-full`, with only two consumers. Many hand-rolled ones (`size-7` to `size-11`). Hit areas come from `lib/touch-target.ts` (`touchTarget()`, 44px, vertical bleed) and the `--target-min: 44px` token. |
| Search field with icon | **No component** | Several inline versions: `ListToolbar`, `Dsm5SearchList`, the care-timeline search and the roster pill. |
| Avatar | Yes | `RecordAvatar` (16/20/24/30) is the live one and is deliberately dot-free. The shadcn `Avatar` has `AvatarBadge` but zero consumers. Note there is no 32px `RecordAvatar`. |
| Presence dot | **No** | Deliberately removed from `UserRecordShell`. The `StatusDot` type is still exported. |
| Divider | Yes | `ui/separator.tsx` (Radix, `bg-border`); most surfaces use `border-b`. |
| List row | Yes | `ConversationRow` (chat) is closest. `PersonRow` and `RecordRow` also exist. |
| Disclosure header | **No shared one** | `SectionCard` and the grouped rail's group header are the nearest; about 15 ad-hoc `aria-expanded` toggles. |
| Relative time | Several, none matching | `lib/ia/age.ts` `elapsedLabel` (Nm/Nh/Nd, no date fallback). The chat row's private `shortAgo` (now/Nm/Nh/Nd/Nw/Nmo). None does SUP-3's `<7d → Nd`, `<1y → MMM D`, else `MMM YYYY`. `<time dateTime>` is used in `message-bubble.tsx:146`. |
| Bubbles | Yes, different style | `MessageBubble` (mentor right on a tint, teen left) and `TranscriptBubble` (read-only). Neither has the periwinkle outgoing style. |
| Composer | Yes, different shape | `Composer` (`chat/thread/composer.tsx`) has four attach buttons, an auto-grow textarea and a text "Send" pill. SUP-4's toolbar (mic, camera, emoji, GIF, lightbulb, plus, send icon) is a different component. |
| Skeleton | **No shared one** | About 10 local skeletons on `--surface-s2` with `motion-safe:animate-pulse`. |
| Error with retry | **No shared one** | `ListError`, `RegionError` and `FeedError` are the local versions. |
| Offline banner | **No** | No `navigator.onLine` or online/offline listener anywhere. `StatusBanner` (`chat/thread/status-banner.tsx`) is a generic banner to build on. |

**Reduced motion:** there is no global `prefers-reduced-motion` rule for the `animate-in` classes the dialog uses. Local components guard themselves with `motion-safe:` / `motion-reduce:`.

## 5 · Routing and history

- **Next.js 16.2.9 App Router.** `useRouter()` exposes `back()` and `forward()` only (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md:48-49`), with no history length, can-go-back or can-go-forward. The codebase records the same finding at `src/lib/record/origins.ts:12-14`.
- **So the disabled states need a small tracker.** Stamp an index into each history entry on navigation, and read it on `popstate`. A full reload keeps the stamped index on its entry, but forward entries left after a reload cannot be counted without the stamp.
- Next documents that `pushState` and `replaceState` integrate with its router (`01-getting-started/04-linking-and-navigating.md:343`), which is the hook for writing the stamp.

## 6 · Breakpoints and responsive behaviour

| Name | Width | Source | What it does today |
|---|---|---|---|
| `sm` | 640 | Tailwind default | scattered |
| `md` | **960** (retuned from 768) | `globals.css:61` `--breakpoint-md: 60rem` | The **rail tier**: below it, mobile top bar plus bottom nav and no rail; at or above it, rail and the floating canvas panel |
| `lg` | 1024 | default | record side panels |
| `aside` | 1152 | `globals.css:76` | side-panel tier |
| `xl` | 1280 | default | chat's three-column grid and rail; Care Reviews' list/pane split |
| arbitrary | 1100, 1440, 1600, 1943 | inline `min-[…]` / `max-[…]` | per-surface |

**Conflict with SUP-1's responsive rule.**
- SUP-1 says to collapse the search field and drop history below about 900px of content width.
- The app already switches to the mobile chrome below 960px of *viewport*: a mobile top bar with wordmark, bell and avatar, and no rail.
- Those two need reconciling: either the desktop bar replaces the mobile bar at every width, or the desktop bar exists from 960 up and the support CTA is added to the mobile bar. Below 768 the panel is a full-screen sheet either way.

## 7 · Tokens: which of Appendix B exist

| Pack name | In code? | Nearest existing |
|---|---|---|
| `surface-canvas` `#f6f4ef` | no | `--surface-s1` (same value) |
| `surface-raised` `#ffffff` | no | `--surface-card` (same value) |
| `surface-sunken` | no | none (Figma binds it to `#f6f4ef`, i.e. canvas) |
| `surface-sunken-strong` `#e8e4db` | no | none; `--surface-s2` is `#e5e0d2` |
| `surface-overlay` `#ffffff` | no | `--surface-card` |
| `border-default` `#cbc6be` | no | none; `--border-contour` is an alpha |
| `border-subtle` `#dfddd8` | **yes** | matches |
| `text-primary` `#0e0d0c` | yes, **different value** | code is `#1f1e1d` (CT-02 changes it) |
| `text-secondary` `#58534b` | **yes** | matches |
| `text-tertiary` `#716a60` | yes, **different value** | code is `#a0998d` (CT-02 changes it) |
| `status-online` `#1bda7a` | no | none |
| `radius-lrg` 12px | no | `--radius-nav-item` and `--radius-inset` are 12px under other names |
| `Elevation/1` `0 3px 6px rgba(0,0,0,.13)` | no | nearest `--shadow-elevation-4` (`0 9px 31.2px`) |
| `Shadow/Small` `0 0 16px rgba(0,0,0,.08)` | no | `--shadow-panel` is `0 0 10px rgba(0,0,0,.08)` |
| `radius-full` | no | `--radius-pill: 9999px` |
| Geist Mono (⌘K chip) | **not loaded** | `--font-mono` is the system stack |

**Figma notes:**
- The panel still binds legacy variables alongside the current ones: `Surface/Z0`, `Surface/Z3` `#f7f5f1`, `Surface/Divider` `#f2f0ec`, `Text/Tertiary` `#999388`, `Black/60` `#909090`, and `Color Modes/Text/text-primary` `#1c1c1c`. That confirms Appendix A's two-generations finding.
- The top bar sits on the **shell** colour, the same as the sidebar, not on canvas. Its history pill and search field are the canvas-coloured pieces. "Background = page canvas" in SUP-1 reads as "no fill of its own", which is how it renders over the shell.
