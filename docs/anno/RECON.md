# `anno` — Recon

Read-only survey of `somethings-webapp` for the annotation layer. No application
code was written for this report.

**Method.** Everything below is read from the repo or measured live in the
browser against `next dev` on `localhost:3000`. Where a question could not be
answered from the repo, it says so rather than inferring. Measurements state the
viewport they were taken at.

**Taken against** `main` @ `1d10523`, 2026-09-01.

---

## 1. Stack and structure

### Framework and config

| | |
|---|---|
| Framework | Next.js **16.2.9**, React **19.2.4**, React DOM 19.2.4 |
| Router | **App Router** (`src/app/`), Turbopack in dev |
| TypeScript | `strict: true`, `noEmit`, `target: ES2017`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, path alias `@/* → ./src/*` |
| Styling | **Tailwind v4**, CSS-first. No `tailwind.config.*` — the theme is `@theme` in `src/app/globals.css`. `cn()` = `clsx` + `tailwind-merge` |
| Tests | `vitest` (26 files, 371 tests), `@playwright/test` + `@axe-core/playwright` for the harness in `scripts/responsive/` |

**Strictness caveat:** `strict: true` is on, but none of the extra-strict flags
are — no `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, or `noPropertyAccessFromIndexSignature`. Indexed access
returns `T`, not `T | undefined`, so a lookup miss is a runtime `undefined` the
compiler will not warn about.

### State management

- **zustand v5** with the `persist` middleware — one store,
  [`src/lib/onboarding/store.ts`](src/lib/onboarding/store.ts) (~2000 lines),
  persisted to `localStorage` under `somethings.mentor-onboarding`. This is the
  app's only global store and it holds the dev-bar axes.
- **react-hook-form** + `@hookform/resolvers` + **zod v4** for forms.
- **sonner** for toasts.
- **`next-themes` is a dependency but is never mounted.** The theme is a
  hand-rolled module store,
  [`src/lib/use-appearance.ts`](src/lib/use-appearance.ts), plus a synchronous
  pre-paint `<script>` in the root layout. `ui/sonner.tsx` documents this
  explicitly: `useTheme()` always fell through, so it reads `useAppearance()`
  instead. **Anything new that needs the theme must read `useAppearance`, not
  `next-themes`.**
- UI primitives: `radix-ui` (unified package) and `@base-ui/react`, wrapped
  shadcn-style in [`src/components/ui/`](src/components/ui/).

### Where a cross-cutting overlay lives

**[`src/app/layout.tsx`](src/app/layout.tsx)** — the only root layout. It is the
sole file every route passes through, and it already renders exactly this shape:

```
<body style={{ paddingBottom: DEV_BAR_H }}>
  {children}
  <Toaster />      ← sonner, app-wide
  <DevBar />       ← fixed, z-50, every route, all environments
</body>
```

`DevBar` is the working precedent for an every-route fixed overlay: mounted from
the root layout, `position: fixed`, and it reserves its own height via
`--dev-bar-h` so it never covers product pixels. There are **no route groups and
no nested layouts** — `src/app/layout.tsx` is the only `layout.tsx` in the repo,
so there is no per-section layout to hook instead.

### Portal / overlay root, and the z-index ladder

**There is no app-owned portal root.** Every portal is Radix's own
(`DialogPortal`, `PopoverPrimitive.Portal`, `SelectPrimitive.Portal`,
`DropdownMenuPrimitive.Portal`), each appending to `document.body` at mount.
Nothing calls `createPortal` directly.

Ladder in use, by occurrence:

| Layer | Occurrences | Who |
|---|---|---|
| `z-0`, `z-[1]` | 7, 7 | local stacking resets |
| `z-10` | 40 | sticky headers, row overlays — the workhorse |
| `z-[15]` | 2 | intra-component ordering |
| `z-20` | 7 | mobile preview pill |
| `z-30` | 3 | `provenance.tsx` popover, `change-requests-dock.tsx` |
| `z-40` | 5 | `top-bar.tsx`, `bottom-nav.tsx` |
| **`z-50`** | **8** | dialog overlay + content, popover, select, dropdown-menu, dev bar, survey-grid tooltip |

**Current maximum is `z-50`, and it is crowded rather than free.** Six distinct
component families share it, including the dev bar. There is no reserved layer
above 50 — see Risk 5.

---

## 2. Dev bar

### Location and storage

**[`src/components/dev/dev-bar.tsx`](src/components/dev/dev-bar.tsx)** — 599
lines. Exports `DevBar` and `DEV_BAR_H = 40`. Mounted from the root layout;
`fixed inset-x-0 bottom-0 z-50` with a dashed top border (the codebase's
convention for marking prototype chrome). Rendered in **all** environments
including the deployed demo, deliberately.

State is split across two mechanisms:

| Axis | Storage | Setter |
|---|---|---|
| Role / persona | zustand, persisted | `setPersona` |
| Activity scenario | zustand, persisted | `setActivityScenarioId` |
| Tasks scenario | zustand, persisted | `setTasksScenarioId` |
| Chat scenario | zustand, persisted | `setChatScenarioId` |
| Load state | zustand, persisted | `setDevLoadState` |
| Bar hidden | zustand, persisted | `setDevBarHidden` |
| **Record scenario** | **URL query param `?scenario=`** | local `useState` + `window.location.assign` |

### Can role / scenario / load be set programmatically from outside the bar?

**Partly — and the exception matters.**

**Yes, for every store-backed axis.** The store is a zustand vanilla store, so
`getState()` works outside React with no hook and no mount:

```
useOnboardingStore.getState().setPersona("supervisor")
useOnboardingStore.getState().setDevLoadState("error")
useOnboardingStore.getState().setActivityScenarioId("heavy-day")
useOnboardingStore.getState().setTasksScenarioId("breach-overnight")
useOnboardingStore.getState().setChatScenarioId("escalation-active")
```

The bar subscribes with `useOnboardingStore((s) => s.…)`, so the control
re-renders and the app follows. A URL-param handler at mount can call these
directly.

**No, for the record scenario — this is the one that will bite.**
`dev-bar.tsx:174` reads the URL **once**, in a lazy `useState` initialiser:

```ts
const [scenarioId, setScenarioId] = useState<string>(() => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(SCENARIO_PARAM) ?? "";
});
```

After that it is local state, and every change in the bar does a
`window.location.assign()`. The component's own comment states the consequence:
it does not follow a back/forward step. **So a handler that rewrites
`?scenario=` after mount — via `router.push`, `history.pushState`, or
`replaceState` — will change the app's data but will NOT update the bar's
select.** The control would then display one scenario while another is in
effect. Driving it requires a full document load with the param already in the
URL, or a refactor of that initialiser.

The reason is documented and non-arbitrary: standing rule 3 forbids
`useSearchParams` in this project (it demands a Suspense boundary, and a
page-root Suspense breaks hard-load hydration here), and the sanctioned escape
hatch — the `use(searchParams)` prop pattern — is unavailable to a component
mounted from a layout, because layouts are not handed `searchParams`.

### Exact values each control can hold

**Role** — the bar offers four ([`dev-bar.tsx:116`](src/components/dev/dev-bar.tsx)):
`mentor` · `lead-mentor` · `supervisor` · `admin`

> The `Persona` type in [`src/lib/types.ts:12`](src/lib/types.ts) has **five**:
> the above plus **`new-mentor`**, which the bar cannot select. It is reachable
> only through the bar's "Reset" action (`resetToNewMentor`). Any code that
> enumerates roles from the bar will miss it.

**Record scenarios** — 20, from
[`src/lib/dev/record-scenarios.ts`](src/lib/dev/record-scenarios.ts), param name
`scenario` (`SCENARIO_PARAM`):

`new` · `intake-complete` · `steady` · `review-day30` · `review-90` ·
`review-overdue` · `single-flag` · `flag-cluster` · `escalation-crisis` ·
`escalation-and-review` · `paused` · `deactivated` · `longitudinal` ·
`low-data` · `attention-only` · `mentor` · `mentor-at-capacity` ·
`lead-mentor` · `supervisor` · `admin`

**Activity scenarios** — 6, [`src/lib/activity/seed.ts:886`](src/lib/activity/seed.ts):
`quiet-shift` · **`typical-shift` (default)** · `heavy-day` · `network-wide` ·
`first-run` · `long-history`

**Tasks scenarios** — 5, [`src/lib/tasks/seed.ts:863`](src/lib/tasks/seed.ts):
`quiet-day` · **`typical-shift` (default)** · `heavy-caseload` ·
`breach-overnight` · `active-escalation`

**Chat scenarios** — 5, [`src/lib/chat/seed.ts:666`](src/lib/chat/seed.ts):
`fresh-match` · **`active-mentorship` (default)** · `activities-in-flight` ·
`escalation-active` · `re-matched`

**Load states** — 4, [`src/lib/dev/load-state.ts`](src/lib/dev/load-state.ts):
**`ready` (default)** · `loading` · `error` · `partial`

> Scope is **not** universal. `LOAD_STATE_SCREENS = ["Activity", "Tasks"]` — only
> those two implement the states, and the bar names that scope in its own label
> rather than offering an unqualified "Load" that would silently do nothing
> elsewhere.

Note that `typical-shift` is a scenario id in **both** the Activity and Tasks
registries, meaning different things. Any code keying on the bare string without
its axis will conflate them.

### Rendered content, left to right

`DEV` · role radiogroup (Mentor · Lead mentor · Supervisor · Admin) · divider ·
`Scenario` + native `<select>` · divider · `Load (Activity, Tasks)` + native
`<select>` · **[scenario description + `real`/`mocked` chip — record routes
only]** · `Hide` button · reset icon button.

The container is `flex h-full items-center gap-3 overflow-x-auto px-3`, 12px
text, `role="region"` `aria-label="Prototype harness"`, with `EdgeFades` rendered
as a **sibling** of the scroller.

### Width measurements

Measured live. `/app/tasks` (no scenario chip):

| Viewport | clientWidth | scrollWidth | Overflow |
|---|---|---|---|
| 1440 | 1440 | 1440 | **0** |
| 1280 | 1280 | 1280 | **0** |
| 1024 | 1024 | 1024 | **0** |

Fixed content is ~907px of children (DEV 26 · role 287 · Scenario 278 · Load 201
· Hide 61 · reset 28) plus `gap-3` × 7 and 24px of padding — roughly **1015px**
of incompressible chrome.

**The bar never overflows horizontally, and that is misleading.** On a record
route the scenario-description `<p>` is the one flexible child, and it absorbs
all the pressure by collapsing. Measured on
`/admin/person/t13?tab=care&scenario=escalation-and-review`, where the
description needs **846px** to render in full:

| Viewport | Description shown | Fraction visible | State |
|---|---|---|---|
| 1440 | 388px | 46% | ellipsis-truncated |
| 1280 | 228px | 27% | ellipsis-truncated |
| **1024** | **0px** | **0%** | **entirely gone** — only the 40px `real` chip survives |

So: **truncation begins at or below 1440 and becomes total loss at 1024.** The
component's own comment says the label exists so "a screenshot of this bar says
which scenario produced it" — at 1024 that guarantee is already broken today,
before anything is added.

### Contrast of the "Scenario" and "Load" labels

Both use `--text-muted` on `--surface-card`. Computed from live styles:

| Mode | Foreground | Background | Ratio | AA (4.5:1) |
|---|---|---|---|---|
| Light | `#6e6b67` | `#ffffff` | **5.30:1** | Pass |
| Dark | `#a0998d` | `#322f2c` | **4.71:1** | Pass |

Both pass at 12px. Dark mode has only 0.21 of headroom, so any darkening of the
bar's ground or lightening of `--text-muted` would drop it below AA.

---

## 3. Persistence — the R10 fork

### Are there API routes / server actions / route handlers today?

**One route handler, no server actions.**

- [`src/app/api/gate/route.ts`](src/app/api/gate/route.ts) — `POST`, the demo
  gate's form target. Reads `formData`, compares against `SITE_PASSWORD`, sets an
  httpOnly cookie, 303-redirects.
- `grep -rn "use server"` across `src/` returns **nothing**. No server actions.
- [`src/middleware.ts`](src/middleware.ts) — edge middleware implementing the
  password gate, using Web Crypto for a SHA-256 cookie token.

### Is any database, KV, or hosted store wired?

**No. Nothing.**

- `package.json` has no `@vercel/kv`, `@vercel/postgres`, `@supabase/*`,
  `firebase`, `prisma`, `drizzle-orm`, `mongodb`, `redis`, or any other client.
- Env var names referenced anywhere in `src/` and `scripts/`: `SITE_PASSWORD`,
  `NODE_ENV`, and the responsive-harness variables (`RESPONSIVE_BASE`,
  `RESPONSIVE_STAMP`, `SHOT_DIR`, `SHOT_OUT`, `ROUTES`, `BASE`, `BASES`, `ONLY`,
  `SPACING_RATCHET`).
- `.env.example` / `.env.local` add only Google Vertex AI config:
  `ANTHROPIC_VERTEX_PROJECT_ID`, `CLOUD_ML_REGION`,
  `GOOGLE_APPLICATION_CREDENTIALS`. That is an LLM credential, not a datastore.
  (Values not reproduced here — see Risk 7.)

### Does the Vercel deployment have a server runtime, or is it a static export?

**A server runtime is available.** `next.config.ts` sets no `output`, so it is
not `output: "export"`. Two things in the repo *require* a server and would fail
a static export outright: `src/middleware.ts` and the `POST` handler at
`/api/gate`. Adding a route handler needs no new infrastructure.

**Undetermined from the repo:** there is no `vercel.json` and no `.vercel/`
directory, so the actual project settings — region, function limits, whether a
KV/Postgres integration is already provisioned on the Vercel side — **cannot be
confirmed from here.** That needs a look at the Vercel dashboard.

### What is in `localStorage` / `sessionStorage` today?

| Key | Store | Written by | Contents |
|---|---|---|---|
| `somethings.mentor-onboarding` | `localStorage` | zustand `persist` | the entire app store — persona, all scenario ids, load state, `devBarHidden`, onboarding draft, published snapshot, caseload map, activity read-state |
| `somethings.theme` | `localStorage` | [`use-appearance.ts`](src/lib/use-appearance.ts) | `"light" \| "dark" \| "system"`; also read by the pre-paint inline script in the root layout |
| `somethings.review-draft.{teenId}.{reviewId}` | **`sessionStorage`** | [`review-draft.ts`](src/lib/record/review-draft.ts) | in-progress clinical review text — session-scoped on purpose, with `clearSupersededDrafts` |

**Convention:** `somethings.` prefix, dot-separated segments, kebab-case within a
segment, dynamic ids appended as trailing dot-segments. Every access is wrapped
in try/catch (`safe()` in `review-draft.ts`).

**The precedent that matters for `anno`:** clinical draft text is deliberately
`sessionStorage`, never `localStorage`, and never a shared scope. If annotation
bodies can quote record content, they inherit that argument.

### The fork

I am not choosing. Both paths are stated so the decision is a decision.

#### Path A — shared store available or addable

**Store: Vercel KV (Upstash Redis).**

Why this one specifically:

- The deployment is already Vercel and already runs server code, so this adds an
  integration and an env var, not an architecture.
- The data shape is a short append-only list per anchor. That is a Redis list or
  a JSON blob per route key — no schema, no migrations, no ORM. Postgres would
  buy relational querying this feature does not need.
- Free tier covers a prototype's comment volume comfortably.
- One dependency (`@vercel/kv`), and it is a thin wrapper over `fetch`, so it
  does not pull a driver into the bundle.

If threading, full-text search, or per-user history later grow past a flat list,
**Vercel Postgres** is the migration target — but that is a later problem and
choosing it now costs schema work this cycle.

**Smallest possible API surface** — one route handler file,
`src/app/api/anno/route.ts`, plus one dynamic segment:

```
GET    /api/anno?route=<pathname>
       → 200 { comments: Comment[] }

POST   /api/anno
       body { route, anchor, body, author }
       → 201 { id, createdAt }

PATCH  /api/anno/<id>
       body { resolved: boolean }
       → 200 { id, resolved }

DELETE /api/anno/<id>
       → 204
```

```ts
type Comment = {
  id: string;          // nanoid
  route: string;       // pathname the anchor lives on
  anchor: Anchor;      // see §4 — must survive virtualization
  body: string;        // plain text
  author: string;      // free-text name, no auth in this prototype
  createdAt: number;   // epoch ms
  resolved: boolean;
};
```

Four endpoints, one KV key per route (`anno:<route>`), no auth beyond the
existing gate cookie. Anything smaller cannot support resolve; anything larger is
not needed this cycle.

#### Path B — no store this cycle

Device-local `localStorage` under `somethings.anno.<route>`, matching the
existing key convention, plus **export/import as a JSON file** so a reviewer can
hand their comments to someone else out-of-band.

**The PRD goal this fails: shared review.** Comments written on one device are
invisible on every other device, to every other reviewer, and in every other
browser profile. Two people reviewing the same prototype produce two disjoint
sets of comments and neither can see the other's. Clearing site data destroys
them with no warning and no recovery. This is not a degraded version of shared
review — it is a different feature that looks identical in screenshots, which is
exactly why the drawer has to say so.

**What the drawer must say.** Not a tooltip, not a footnote — persistent, in the
drawer body, above the comment list, in the same visual weight as the comments:

> **These comments are saved on this device only.**
> Nobody else can see them, and they will not appear on your phone or in another
> browser. Clearing your browser data deletes them. Use **Export** to send them
> to someone.

And on the composer's submit control, the word must not be "Post" or "Send" —
both imply transmission to someone. **"Save to this device"** is the honest
label. The export affordance must be visible in the drawer at all times, not
buried in an overflow menu, because it is the only way the work leaves the
machine.

---

## 4. Anchoring surface

### Stable `data-*` attributes today

There is a convention, but it was not built for anchoring.

| Attribute | Uses | Notes |
|---|---|---|
| `data-slot` | **102** | shadcn's convention. Mostly auto-applied inside `ui/` primitives (`data-slot="select-item"` etc.), but ~20 are hand-placed on real surfaces: `conversation-list`, `composer`, `chat-back`, `bottom-nav`, `task-pane`, `task-pane-footer`, `event-evidence-pane`, `status-banner`, `profile`, `timeline-note`, `assist-do`, `resolve-dialog`, `view-all-in-tasks`, `dialog-portal` |
| `data-record-section` | **30** | 12 distinct values, all on the teen record: `account`, `action-required`, `attention`, `care-review-card`, `care-review-expansion`, `care-review-workspace`, `care-summary`, `care-summary-doc`, `care-timeline`, `care-update`, `current-mentor`, `first-moments` |
| `data-region` | 9 | 7 values, profile preview only: `bio`, `identity`, `interests`, `media`, `spotify`, `vibe`, + one interpolated |
| everything else | 1–4 each | `data-size`, `data-variant`, `data-section`, `data-row`, `data-row-id`, `data-diff-field`, `data-tone`, `data-kind`, `data-outcome-code`, `data-detail-view`, … one-offs |

**`data-record-section` is the closest thing to a semantic anchor** — stable,
hand-authored, section-level. But it covers **only the teen record**. Nothing
comparable exists on Tasks, Activity, Team, Settings, or onboarding.

**There are no stable per-instance ids.** `useId()` is used for `aria-controls`
wiring; its output is React-generated and not stable across renders or builds, so
it cannot be an anchor key.

### Scrolling containers that aren't the document body

Verified live per route.

| Route family | Document scrolls? | Scroll container |
|---|---|---|
| `/app/*`, `/admin/*` (all) | **No** | `main > div` — `.relative.h-full.overflow-y-auto` in [`app-shell.tsx:220`](src/components/app-shell/app-shell.tsx) |
| `/app/tasks` | No | + the worklist's own `.overflow-y-auto.overscroll-contain` (**virtualized**), + `task-pane`, + `conversation-excerpt` |
| `/app/chat` | No | + the conversation list's rows scroller, + `thread.tsx`, + `rail-panel.tsx` |
| `/app/activity` | No | + `activity/pane/pane-shell.tsx` |
| `/admin/person/[id]` | No | + `ui/data-view.tsx`, `dsm5-search.tsx`, `mentee-table.tsx`, `caseload-modal.tsx` |
| **`/onboarding`** | **Yes** | **none — the document itself scrolls** |
| `/onboarding/preview` | — | `mentor-profile-preview.tsx` (scrollbar hidden) |

Measured examples: `/admin/person/t13` → one scroller, 828/1807.
`/app/tasks` → 548/1804. `/app/activity` → 828/1175. `/onboarding` → zero inner
scrollers, `documentElement` scrolls.

**Two different coordinate systems exist.** See Risk 2.

### Virtualization, `content-visibility`, lazy mounting

- **Virtualization: yes, one place, hand-rolled.**
  [`src/components/tasks/worklist.tsx`](src/components/tasks/worklist.tsx) on
  `/app/tasks`. `ROW_H = 56` and `HEADER_H = 34` are declared **contracts**, not
  outcomes; `OVERSCAN = 6`; the window is computed from `scrollTop` and rows are
  absolutely positioned inside a container sized `rows.length * ROW_H`. A
  hundred-row list mounts about a dozen nodes. **An element ref to an unmounted
  task row does not exist**, and the file says so directly at line 573: a row
  "may not exist yet, which is the entire problem virtualization creates."
  The mitigation is in the same file — offsets are deterministic
  (`rowsTop + i * ROW_H`), and there is already a row→offset map at line 537.
- **Lazy-mounted content: yes, `/app/activity`.** `IntersectionObserver` in
  [`activity-ledger.tsx:843`](src/components/activity/activity-ledger.tsx) pages
  in older events, and in
  [`activity-row.tsx:331`](src/components/activity/activity-row.tsx) per row.
  Events past the initial window are not in the DOM until scrolled to.
- **`content-visibility`: not used anywhere.** No occurrences in `src/`.

### Animated / transitioning layout regions whose geometry settles after mount

| Where | What | Duration |
|---|---|---|
| [`care-review-card.tsx:483`](src/components/record/care-review-card.tsx) | `grid-template-rows: 0fr → 1fr` in-card expansion | **300ms** |
| [`worklist.tsx:897`](src/components/tasks/worklist.tsx) | `transition-[height]` on a collapsing region | ease-out |
| [`domain-tabs.tsx:164`](src/components/tasks/domain-tabs.tsx) | opacity | 260ms |
| [`task-pane.tsx:702`](src/components/tasks/task-pane.tsx) | opacity | 120ms |
| [`care-timeline.tsx:483`](src/components/record/care-timeline.tsx) | colour flash on a targeted row | 800ms |
| onboarding (`onboarding-layout`, `welcome-intro`, `cycling-examples`, `swipe-deck`) | `animate-in` / slide / zoom entrances | 500–700ms |

All of the above honour `motion-reduce`. Additionally, four components run a
**`ResizeObserver`** and change layout from it: `ui/scroll-affordance.tsx`,
`tasks/worklist.tsx`, `record/segmented-control.tsx`,
`onboarding/mentor-profile-preview.tsx`.

**Consequence for anchoring:** a rect measured in the first frame after mount is
wrong on any of these surfaces. The onboarding entrances are the worst case at
700ms. A single `requestAnimationFrame` is not enough — this codebase has already
been bitten by exactly that (a single-rAF measure caught a transitioning column
at 380px instead of 420px, and the fix was a `ResizeObserver`).

---

## 5. Design system

### Where tokens are defined

- **[`src/app/settings-tokens.css`](src/app/settings-tokens.css)** — 677 lines,
  the **Bloom** token set. Surfaces, text, borders, bands, alerts, tints,
  typography, radii, shadows, spacing. Heavily annotated with measured contrast
  ratios and the reasoning behind each divergence from Bloom.
- **[`src/app/globals.css`](src/app/globals.css)** — 474 lines. Tailwind v4
  `@theme` bridge (`--color-*`, `--font-*`, `--radius-*`) plus the shadcn
  compatibility aliases (`--background`, `--primary`, `--muted`, …) mapped onto
  Bloom tokens. Also owns `--nav-reserve`, `--topbar-reserve`, `--breakpoint-md:
  60rem`, `--breakpoint-aside: 72rem`.

### Neutral ramp

| Token | Light | Note |
|---|---|---|
| `--surface-s2` | `#e5e0d2` | app background, sidebar rail |
| `--surface-s1` | `#f6f4ef` | main content panel |
| `--surface-s0` | `#f6f4ef` | cards (== s1, gaps.md #10) |
| `--surface-card` | `#ffffff` | elevated card |
| `--border-subtle` | `#dfddd8` | decorative borders |
| `--border-contour` | `rgb(31 30 29 / 16%)` | raised from 8% after measuring 1.167:1 |
| `--text-primary` | `#1f1e1d` | 15.14:1 on s1 |
| `--text-secondary` | `#58534b` | 6.94:1 on s1 |
| `--text-muted` | `#6e6b67` | 5.30:1 on card, 4.82:1 on s1 |
| `--text-tertiary` | `#a0998d` | **⚠ 2.57:1 on s1 — fails AA. Decorative only** |
| `--state-inactive` | `#b8b2a9` | disabled fill |

### Semantic colours

- **Bands** (severity/status lozenges): `sand` `#f4efe1`/`#5e4a21` (routine) ·
  `amber` `#f4e8d2`/`#694217` (risk flag) · `clay` `#f6d3c6`/`#75301f`
  (escalation — "earthy, not pink") · `sage` `#beefd6`/`#406333` (settled) ·
  `rose` `#ffd9df`/`#b70b1f` (acute).
- **Task domain tints**: escalation `#ffd9df`/`#8f0a19` · risk
  `#ffe8ca`/`#6b3d03` · billing `#dfdfff`/`#2933fb` · monitoring
  `#e8f5e3`/`#2e4325`.
- **Alerts**: `--alert-critical-*` (`#c9351d` accent) · `--alert-warm-*`
  (`#b8560e`) · `--alert-warning-*` (`#96590a`).
- **States**: `--state-error` `#cc3300` · `--state-dirty` `#b45309` ·
  `--focus-ring` = `--button-border-default` `#716a60`.
- **Dots**: positive `#3a7d44` · warning `#ea580c` · critical = `--state-error`.
- **Brand**: `--brand` / `--ring` / `--chart-1` / `--doodle-tangelo` all
  `#ff5001`.
- **Doodle ramp** (decorative illustration only): tangelo `#ff5001`, yellow
  `#ffb200`, green `#3dbe6b`, sky `#34c3d9`, purple `#7b5bd6`, pink `#ff6fb5`.
- **`--preview-accent` `#b164ff`** — the teen phone-preview chrome.

### Reserved: saturated red

**Confirmed.** [`settings-tokens.css:157`](src/app/settings-tokens.css) states it
directly:

> "A WELL IS NOT AN ALARM. The alarm budget (§3.3) reserves FILLED SATURATED red
> for the Respond strip and the interrupt banner only."

`--task-respond-bg: #c9351d` is defined in `:root` **and deliberately not
overridden in `.dark`** — "an alarm does not theme" — because
`--alert-critical-accent` inverts to a bright tangelo in dark mode where white on
it measures 2.78:1, a real AA failure caught by measurement.

**So the pin cannot be red.** Nor can it be tangelo `#ff5001`, which is the brand
colour and simultaneously `--ring`, `--chart-1` and the dark-mode critical accent.

### What high-visibility hue is genuinely unclaimed?

**Honest answer: none is fully unclaimed.** Every high-visibility hue in the
token set already carries meaning:

| Hue | Claimed by |
|---|---|
| Red `#c9351d` | alarm budget — reserved |
| Tangelo `#ff5001` | brand, focus ring, chart-1 |
| Blush / rose | escalation tint, acute band |
| Apricot / amber | risk flag |
| Periwinkle `#2933fb` | billing tint |
| Forest / emerald / sage | monitoring, positive, settled |
| Sky `#34c3d9`, `#b8f1ff` | info status, doodle |
| Yellow `#ffb200` | doodle |
| Pink `#ff6fb5` | doodle |
| Violet `#7b5bd6` / `#b164ff` | doodle ramp; `--preview-accent` |

**The least-conflicted is violet/purple.** Its two claims are both outside staff
console chrome: `--doodle-*` appears only in
[`doodles.tsx`](src/components/doodles.tsx) and one illustration in
`record-overview.tsx`, and `--preview-accent` appears only inside the teen
phone-preview frame. A violet pin would never sit adjacent to either.

That is a judgment call, not a fact, and it means minting a token — which is a
decision for you, not one I should make in recon. **Flagging it rather than
answering it.**

### Typography

Tokens are complete `font` shorthands plus a matching `-tracking` companion,
consumed as `style={{ font: "var(--type-x)" }}`:

`--type-record-name` 700 32/40 Avantt · `--type-display` 700 24/32 ·
`--type-title-lg` 700 24/32 · `--type-title-sm` 700 16/24 · `--type-card-title`
700 16/24 · `--type-button` 700 16/20 · `--type-body` 400 14/20 Lausanne ·
`--type-row-value` 400 14/20 · `--type-row-label` 400 12/16 · `--type-helper` 400
12/16 · `--type-label-sm` 400 12/16 · `--type-tab` 400 16/20 · `--type-message`
400 16/24 · `--type-meta` = `--type-row-label`.

**Usage rule:** Avantt Bold = display/headings/buttons/wordmark; TWK Lausanne =
body and UI. Only those two families, only 400 and 700 — `type-ramp-faces.test.ts`
enforces this, and notes that the Figma ramp also wants Lausanne 700 and Avantt
Regular, neither of which is loaded.

**Geist Mono — correction.** The premise is wrong. **Geist Mono is not loaded in
this project at all.** `roster.tsx:725` says so in as many words: "--font-mono,
not Geist Mono: Geist is not loaded in this project." `--font-mono` is a system
stack — `ui-monospace, SFMono-Regular, Menlo, monospace`.

And its usage rule is the opposite of the premise: mono is **not** for eyebrows
or labels. It is used for **codes and identifiers** — DSM-5 codes (`F33.1`), task
ids, shortcut keys — in `tasks/worklist.tsx`, `tasks/strips.tsx`,
`tasks/shortcuts.tsx`, `tasks/task-pane.tsx`, `activity/pane/bodies.tsx`.
Eyebrows/overlines use `--type-label-sm` or `--type-row-label` in Lausanne with
letter-spacing, not mono.

### `lib/motion.ts`

**Does not exist.** There is no motion module and no exported motion constants.
Durations and easings are written inline at each call site
(`duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]`, `duration-[260ms] ease-out`,
`duration-[120ms]`, `duration-[800ms]`, `duration-500`, `duration-700`), each
paired with a `motion-reduce:` escape. `tw-animate-css` is a dependency and
supplies the `animate-in` / `fade-in` / `slide-in-from-*` / `zoom-in-*` utilities.

**If `anno` wants shared motion constants, it will be creating that module, not
reusing one.**

### Reuse inventory

| Need | What exists | Verdict |
|---|---|---|
| Toast | **sonner**, wrapped at [`ui/sonner.tsx`](src/components/ui/sonner.tsx), `<Toaster/>` in the root layout. Theme from `useAppearance`, not `next-themes` | **Reuse** |
| Undo | **Nothing.** Every `toast()` call is message-only; no `action`, no undo. Two components explicitly note "no undo and no confirmation" as a deliberate choice | **Build, or don't promise undo** |
| Drawer / side panel | **No generic component.** Five bespoke ones: [`chat/rail/rail-panel.tsx`](src/components/chat/rail/rail-panel.tsx), [`chat/thread/detail-sheet.tsx`](src/components/chat/thread/detail-sheet.tsx), [`activity/pane/pane-shell.tsx`](src/components/activity/pane/pane-shell.tsx), [`tasks/task-pane.tsx`](src/components/tasks/task-pane.tsx), [`onboarding/change-requests-dock.tsx`](src/components/onboarding/change-requests-dock.tsx) | **Pick a precedent to copy; `pane-shell` and `task-pane` are the closest to a review drawer** |
| Focus trap | **No utility of our own.** Radix `Dialog` brings its own trap + scroll lock. `inert` is applied by hand in `care-review-card.tsx` to neutralise a collapsed region | **Reuse Radix `Dialog`, or hand-roll for a non-modal drawer** |
| Dialog | [`ui/dialog.tsx`](src/components/ui/dialog.tsx) — Radix, `z-50`, subtracts `--dev-bar-h` from its fixed chrome | **Reuse** |
| Touch targets | [`lib/touch-target.ts`](src/lib/touch-target.ts) — `touchTarget(h)` for a closed set of visual heights, each reaching 44px | **Reuse** |
| Scroll affordance | [`ui/scroll-affordance.tsx`](src/components/ui/scroll-affordance.tsx) — edge fades, `ResizeObserver`-driven | **Reuse** |

---

## 6. Routes

29 routes. Every one renders; verified by `scripts/responsive/surface-smoke.mjs`.

| Route | What it shows |
|---|---|
| `/` | The prototype's front door — persona/scenario launcher |
| `/gate` | Shared-password gate. Ships no JS; posts to `/api/gate` |
| `/invite/[token]` | Invite acceptance — calls `acceptInvite`, seeds the store, sends the mentor into onboarding |
| `/onboarding` | The mentor profile wizard (the only route where the **document** scrolls) |
| `/onboarding/preview` | Teen-facing preview of the mentor's profile; locks once `in_review`/`published` |
| `/onboarding/submitted` | Post-submit home — where a mentor waits for review |
| `/hub` | The mentor's setup hub — profile + four other steps |
| `/hub/[step]` | Placeholder for the four non-profile hub steps (Story, Training, …) |
| `/app` | Mentor Home — the post-approval landing |
| `/app/chat` | Conversation list (+ thread pane above `md`) |
| `/app/chat/[personId]` | One conversation — thread, composer, rail |
| `/app/tasks` | Supervisor worklist — **virtualized**, domain tabs, task pane |
| `/app/activity` | Activity ledger — feed + event evidence pane; two surfaces on one route |
| `/app/mentees` | Mentees list, scoped by persona |
| `/app/teens` | Legacy redirect → `/app/mentees` |
| `/app/team` | Staff directory, scope varies by persona |
| `/app/mentors` | Mentors roster, merged into Team |
| `/app/people` | Staff bottom-bar destination grouping Team + Mentees |
| `/app/profile` | Mentor's own user record, on the shared `UserRecordShell` |
| `/app/settings` | Universal settings — preferences only after the IA restructure |
| `/app/escalation/[escalationId]` | Landing for every escalation link-out |
| `/app/[section]` | Placeholder for not-yet-built nav sections |
| `/admin/person/[id]` | Person record for anyone who isn't the store-backed mentor — the teen record, Care/Activity tabs |
| `/admin/mentor` | Mentor record (`record-02` shell) for the one store-backed mentor |
| `/admin/review` | Lead Mentor's clinical-review screen |
| `/admin/profile-update` | Lead Mentor's delta review of a profile update |
| `/admin/users` | **Retired** — the supervisor "Users" surface is gone |
| `/dev/components` | Phase 0 component audit — every shared component and state |
| `/api/gate` | `POST` only — the gate's form target (not a page) |

---

## Risks I found that the PRD didn't anticipate

**1. The task list is virtualized — element-ref anchoring cannot work there.**
`/app/tasks` mounts ~12 of potentially 97 rows. A comment anchored to a task row
by element ref will find nothing whenever that row is scrolled out, and
`OVERSCAN = 6` means it goes missing about half a screen away. This is the single
biggest anchoring constraint in the repo. It is survivable — `ROW_H`/`HEADER_H`
are fixed contracts and `worklist.tsx:537` already builds a row-id → offset map —
but it means the anchor model needs a **synthetic/offset anchor** alongside the
DOM-ref one, decided before `anno-01`, not retrofitted.

**2. Two scroll coordinate systems.** Every `/app/*` and `/admin/*` route scrolls
an inner div while `documentElement` does not move; `/onboarding` scrolls the
document with no inner scroller. An overlay that positions against
`window.scrollY` is correct on onboarding and frozen everywhere else; one that
positions against a container is the reverse. Both cases must be handled from the
start.

**3. The dev bar cannot be driven for the record axis after mount.** Covered in
§2. A URL-param handler that sets `?scenario=` post-mount changes the data but
leaves the bar's select showing the old value — a control lying about its own
state, which is the exact failure the file's own comments elsewhere call out as
worse than no control. If `anno` needs to restore a scenario from a comment's
permalink, that restore must be a **full document load**, not a client-side push.

**4. The dev bar has no horizontal room left, and already loses information at
1024.** The scenario description needs 846px and gets 0px at 1024. Because the
bar's `overflow-x-auto` plus a shrinkable `<p>` absorbs pressure silently, adding
a control will *not* produce a visible overflow — it will just take more of the
description until it is gone at 1280 too. Anything added to the bar must
displace something, and the description is already the thing being displaced.

**5. `z-50` is a floor shared by six component families, not a free ceiling.**
Dialogs, popovers, selects, dropdowns, the survey-grid tooltip and the dev bar
all sit at exactly 50, and there is nothing above. An annotation overlay at
`z-50` will interleave unpredictably with Radix portals (which append to
`document.body` in mount order, so the winner depends on *when* a menu was
opened). The layer needs an explicitly reserved value above 50 **and** a decision
about what happens when a dialog is open — the PRD should say whether annotation
is reachable over a modal or suppressed under it.

**6. The forbidden-vocabulary rule is already violated in shipped code.**
"caseload" appears **319 times** across ~20 files. 138 are in comments, but the
rest include **user-visible copy** (`record-overview.tsx:241` renders
"Caseload {n}" in a chart legend), **aria-labels** (`caseload-controls.tsx:173`
"Decrease caseload", `:200` "Increase caseload"), **store fields**
(`s.caseloads`, `setCaseload`), and **two component filenames**
(`record/caseload-modal.tsx`, `record/caseload-controls.tsx`). If `anno` displays
route names, component names, or an element path in its anchors, it will surface
these strings into the annotation UI — making the annotation layer a new
publication surface for vocabulary the product has ruled out. Decide whether
`anno` sanitises, or whether the underlying violation gets fixed first.

**7. A credential in `.env.local` is self-documented as compromised.** The file
carries a `TODO` from its author stating the Google service-account key "was
shared in chat, so treat the current one as compromised," pending rotation and a
move out of `~/Downloads`. Unrelated to `anno`, but it is live, unaddressed, and
I encountered it during this survey. (Values were not read into this report.)

**8. `.env.example` documents an API route that does not exist.** It describes a
"suggest-interests route" that "falls back to a mock" — there is no such route in
`src/app/api/`; the only handler is `/api/gate`. Either it was removed and the
docs went stale, or it was planned and never built. Worth knowing before treating
`.env.example` as a reliable map of server capability.

**9. There is no stable per-element identity to anchor to.** `data-slot` is
shadcn's styling hook, not an identity — `data-slot="select-item"` appears on
every select item on the page. `data-record-section` is genuinely stable and
semantic but exists **only on the teen record**. `useId()` output is not stable
across builds. So on most routes, `anno` has nothing to anchor to today and will
need to either add attributes or derive a structural path — and a structural path
is exactly what virtualization (Risk 1) and lazy mounting (`/app/activity`) break.

**10. Geometry settles up to 700ms after mount.** Six animated regions plus four
`ResizeObserver` consumers. A pin placed on first paint will be wrong on the
record's expanding review card (300ms), the tasks worklist (height transition),
and every onboarding entrance (500–700ms). This repo has already been burned by a
single-`requestAnimationFrame` measurement; the established fix here is
`ResizeObserver`, and `anno` should assume that from the start rather than
discovering it.

**11. The theme has two possible sources and only one is real.** `next-themes` is
installed but never mounted; `useTheme()` silently returns a default. Any
annotation component that reaches for `next-themes` — the obvious choice, since
it is right there in `package.json` — will render light chrome over a dark app.
Read `useAppearance()`.

**12. The dev bar renders in production.** It is mounted unconditionally from the
root layout, in all environments including the deployed demo, by explicit design.
If `anno` mounts the same way, it ships to the demo too. That is probably the
intent, but it should be a stated decision rather than an inherited one — and it
interacts with the gate: anyone with the shared password can read and write
comments, and the gate is explicitly "NOT authentication," with one shared
password and no per-person audit.

---

## Answers I could not determine

- **Vercel project settings.** No `vercel.json`, no `.vercel/` in the repo. Region,
  function configuration, and whether any KV/Postgres integration is already
  provisioned on the Vercel side cannot be read from here.
- **Assumptions A1–A5.** These are referenced in the gate but are not present in
  the repo and were not supplied to me, so I have not confirmed or corrected
  them. Send them and I will check each against what is above.
- **The PRD itself** is not in the repo (`docs/` contains only `responsive/`), so
  "goals the PRD anticipated" is inferred from your brief, not read.
