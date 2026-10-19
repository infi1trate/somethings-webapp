# CT-00 Recon: Bloom color tokens, starting state

Read only. No code changed. Measured on `feat/bar-02-panel` at `1812bec`, 2026-10-07.

## 1 · Theme files and the dark selector

| What | Where |
|---|---|
| Semantic tokens, light | `src/app/settings-tokens.css`, `:root, .theme-light` (line 40) |
| Semantic tokens, dark | `src/app/settings-tokens.css`, `.dark` (line 657) |
| shadcn layer, light | `src/app/globals.css`, `:root, .theme-light` (line 208) |
| shadcn layer, dark | `src/app/globals.css`, `.dark` (line 282), non-alias tokens only |
| Tailwind exposure | `src/app/globals.css`, `@theme inline` (line 138), `--color-*` for the shadcn layer only |
| Dark switch | `.dark` class on `<html>`, set by the inline script at `src/app/layout.tsx:73` from `localStorage["somethings.theme"]`; toggled by `src/lib/use-appearance.ts` |

No `prefers-color-scheme` rule exists. One mechanism, as the pack requires.

## Summary of findings

- **Values match the pack's "current code value" everywhere it states one.** `--text-primary` `#1f1e1d`/`#ffffff`, `--text-muted` `#6e6b67`, `--text-tertiary` `#a0998d`, `--text-inverse` dark `#0e0d0c`, `--icon-tertiary` `#8a8275`, `--button-border-default` dark `#b5b0a6`, `--brand-foreground` `#ffffff`, `--popover` dark `#322f2c`, `--secondary` `#f1ece3`, `--accent` `#f1ece4`, `--surface-s0` `#f6f4ef`. No value drift.
- **Reference counts drift by 1 to 2 on six tokens** (section 5). Cause: the pack's counts came from the 2026-10-05 inventory. Since then the Closed tab work added and moved references and deleted `completed-group.tsx`, and this pass also strips end-of-line `//` comments. `--brand` plus brand classes is exactly 34, as the pack says.
- **`states/active` does not exist in code.** Zero references. The CT-05 item has nothing to remove.
- **`#cc3300` appears once in the whole codebase**: its definition in `settings-tokens.css:202`. Every other use goes through `--state-error` (34), `--dot-critical` (1) and `--destructive` (38), so retiring it is an aliasing job, not a hex hunt.
- **Hardcoded hex: 111 occurrences in 28 files** (1 a test file), listed in section 3. The largest clusters are deterministic avatar palettes (`record-avatar.tsx`, `lib/tasks/avatar.ts`, `lib/anno/identity.ts`), the dev components page, and onboarding illustration and preview art.
- **Only 8 canonical names already exist**, all of them ones CT-02 updates in place (`--text-primary`, `--text-secondary`, `--text-tertiary`, `--icon-*`, `--border-subtle`, `--brand-ink`). No other canonical name collides with an existing token.

## Open questions before CT-01

1. **Figma could not be read this pass.** The Figma connector answers, but `get_variable_defs` needs a layer selected in the Figma desktop app ("You currently have nothing selected"). The canonical values in this recon are the pack's. Selecting the Color Tokens frame (node 46:1891) lets CT-01 confirm them against Figma before writing.
2. **"Expose to Tailwind the same way existing tokens are exposed."** Only the shadcn layer is exposed (`--color-*` in `@theme inline`). The semantic tokens CT-01 extends, such as `--text-primary`, are not exposed; product code reads them as `bg-[var(--surface-card)]`. Following the existing convention means CT-01 adds no `@theme` entries. The alternative, exposing them, would create classes like `text-text-primary` and `border-border-default`. Default if unanswered: follow the existing convention.
3. **The three BLOCKED dark values have no existing dark value to keep.** The pack says "leave existing code dark values in place", but `--accent-subtle`, `--status-error-subtle` and `--status-offline-subtle` do not exist in code today. A light-only definition in `:root` means dark mode would inherit the light pastel (`#dfdfff`, `#ffeaee`, `#ebdcff`). This is harmless while nothing consumes them, which is true through CT-05, but any consumer added before the ramp fix would show a light pastel on a dark surface.
4. **`text-background` and `ring-background` are not backgrounds.** Seven `text-background` uses (inverse text on dark chips and badges) and three `ring-background` (avatar rings) read the token for something other than a page fill. CT-05's rule for `background` (shell, canvas, otherwise ask) will route all ten to "ask". They are listed in section 4 now so the decision can be made up front.
5. **`bg-background` on onboarding and hub pages paints the mentor-facing app's full page**, not the staff console's shell or canvas. CT-05's rule names the staff frame. These are likely canvas, but they are a different surface, so they are flagged here.

Generated from `main`-line branch `feat/bar-02-panel` at the commit this file was produced on. Read only: no code changed.

Counts exclude comments and the theme files' own definitions. `--color-*` Tailwind classes are counted against the shadcn token they read (for example `bg-card` counts toward `--card`).

## 2a · Legacy to canonical map, CT-02

| Token | Defined | Light | Dark | Refs (total) | of which theme plumbing | Files | Defined at | Drift from pack |
|---|---|---|---|---|---|---|---|---|
| `--text-primary` | yes | `#1f1e1d` | `#ffffff` | 516 | 7 | 154 | settings-tokens.css:47, settings-tokens.css:663 |  |
| `--text-secondary` | yes | `#58534b` | `#b5b0a6` | 418 | 2 | 140 | settings-tokens.css:48, settings-tokens.css:664 |  |
| `--text-muted` | yes | `#6e6b67` | `#a0998d` | 314 | 3 | 120 | settings-tokens.css:51, settings-tokens.css:666 | **314 refs, pack says 312** |
| `--text-tertiary` | yes | `#a0998d` | `#8a8275` | 3 | 0 | 2 | settings-tokens.css:49, settings-tokens.css:665 |  |
| `--text-inverse` | yes | `#ffffff` | `#0e0d0c` | 40 | 0 | 30 | settings-tokens.css:571, settings-tokens.css:835 |  |
| `--icon-primary` | yes | `#000000` | `#ffffff` | 0 | 0 | 0 | settings-tokens.css:62, settings-tokens.css:674 |  |
| `--icon-secondary` | yes | `#58534b` | `#b5b0a6` | 0 | 0 | 0 | settings-tokens.css:63, settings-tokens.css:675 |  |
| `--icon-tertiary` | yes | `#8a8275` | `#8a8275` | 0 | 0 | 0 | settings-tokens.css:64, settings-tokens.css:676 |  |
| `--surface-card` | yes | `#ffffff` | `#322f2c` | 163 | 3 | 95 | settings-tokens.css:74, settings-tokens.css:678 | **163 refs, pack says 164** |
| `--surface-s1` | yes | `#f6f4ef` | `#272421` | 90 | 3 | 65 | settings-tokens.css:44, settings-tokens.css:660 | **90 refs, pack says 91** |
| `--surface-s2` | yes | `#e5e0d2` | `#0e0d0c` | 87 | 1 | 51 | settings-tokens.css:43, settings-tokens.css:659 | **87 refs, pack says 88** |
| `--surface-s0` | yes | `#f6f4ef` | `#272421` | 8 | 0 | 6 | settings-tokens.css:45, settings-tokens.css:661 |  |
| `--border-subtle` | yes | `#dfddd8` | `#3f3b36` | 186 | 3 | 92 | settings-tokens.css:46, settings-tokens.css:662 |  |
| `--border-contour` | yes | `rgb(31 30 29 / 16%)` | `rgb(255 255 255 / 18%)` | 168 | 0 | 80 | settings-tokens.css:198, settings-tokens.css:679 |  |
| `--focus-ring` | yes | `#716a60` | `#8c91ff` | 139 | 2 | 114 | settings-tokens.css:203, settings-tokens.css:721 | **139 refs, pack says 140** |
| `--button-border-default` | yes | `#716a60` | `#b5b0a6` | 4 | 1 | 4 | settings-tokens.css:55, settings-tokens.css:668 |  |
| `--state-error` | yes | `#cc3300` | `#ff6f2f` | 34 | 2 | 24 | settings-tokens.css:202, settings-tokens.css:720 |  |
| `--state-inactive` | yes | `#b8b2a9` | `#58534b` | 4 | 0 | 3 | settings-tokens.css:54, settings-tokens.css:667 |  |
| `--dot-positive` | yes | `#3a7d44` | `#78bc64` | 3 | 0 | 2 | settings-tokens.css:435, settings-tokens.css:763 |  |
| `--dot-warning` | yes | `#ea580c` | `#ffe94b` | 3 | 0 | 2 | settings-tokens.css:436, settings-tokens.css:764 |  |
| `--dot-critical` | yes | `#cc3300` | `#ff6f2f` | 1 | 0 | 1 | settings-tokens.css:437 |  |
| `--brand` | yes | `#ff5001` | `#ff5001` | 34 | 1 | 19 | globals.css:246 |  |
| `--brand-foreground` | yes | `#ffffff` | `#ffffff` | 3 | 1 | 3 | globals.css:247 |  |
| `--brand-ink` | yes | `#cf4203` | `#ff8e5d` | 0 | 0 | 0 | settings-tokens.css:491, settings-tokens.css:800 |  |

## 2b · shadcn layer, CT-03 (var() plus Tailwind class reads)

| Token | Defined | Light | Dark | Refs (total) | of which theme plumbing | Files | Defined at | Drift from pack |
|---|---|---|---|---|---|---|---|---|
| `--foreground` | yes | `#1f1e1d` | `#ffffff` | 148 | 2 | 45 | globals.css:272 |  |
| `--card-foreground` | yes | `#1f1e1d` | `#ffffff` | 2 | 1 | 2 | globals.css:213 |  |
| `--popover-foreground` | yes | `#1f1e1d` | `#ffffff` | 6 | 1 | 6 | globals.css:215 |  |
| `--secondary-foreground` | yes | `#1f1e1d` | `#ffffff` | 10 | 1 | 9 | globals.css:224 |  |
| `--accent-foreground` | yes | `#1f1e1d` | `#ffffff` | 4 | 1 | 3 | globals.css:242 |  |
| `--muted-foreground` | yes | `#6e6b67` | `#a0998d` | 84 | 1 | 35 | globals.css:240, globals.css:293 |  |
| `--card` | yes | `#ffffff` | `#322f2c` | 36 | 1 | 20 | globals.css:212 |  |
| `--popover` | yes | `#ffffff` | `#322f2c` | 8 | 1 | 6 | globals.css:214 |  |
| `--primary` | yes | `#000000` | `#ffffff` | 17 | 1 | 7 | globals.css:221, globals.css:285 |  |
| `--primary-foreground` | yes | `#ffffff` | `#0e0d0c` | 8 | 1 | 7 | globals.css:222, globals.css:286 |  |
| `--secondary` | yes | `#f1ece3` | `#272421` | 12 | 1 | 10 | globals.css:223, globals.css:292 |  |
| `--accent` | yes | `#f1ece4` | `#272421` | 8 | 1 | 7 | globals.css:241, globals.css:294 |  |
| `--muted` | yes | `#dcdcdc` | `#322f2c` | 48 | 1 | 27 | globals.css:216 |  |
| `--destructive` | yes | `#cc3300` | `#ff6f2f` | 38 | 1 | 14 | globals.css:217 |  |
| `--border` | yes | `#e7e0d5` | `#3f3b36` | 14 | 2 | 12 | globals.css:243, globals.css:295 |  |
| `--input` | yes | `#e2dccf` | `#3f3b36` | 8 | 1 | 6 | globals.css:244, globals.css:296 |  |
| `--ring` | yes | `#ff5001` | `#8c91ff` | 32 | 2 | 18 | globals.css:245, globals.css:297 |  |
| `--background` | yes | `#faf6ef` | `#0e0d0c` | 22 | 2 | 15 | globals.css:271, globals.css:301 | **22 refs, pack says 21** |
| `--sidebar` | yes | `#ffffff` | `#322f2c` | 1 | 1 | 1 | globals.css:261 |  |
| `--sidebar-foreground` | yes | `#1f1e1d` | `#ffffff` | 1 | 1 | 1 | globals.css:262 |  |
| `--sidebar-primary` | yes | `#000000` | `#ffffff` | 1 | 1 | 1 | globals.css:263, globals.css:287 |  |
| `--sidebar-primary-foreground` | yes | `#ffffff` | `#0e0d0c` | 1 | 1 | 1 | globals.css:264, globals.css:288 |  |
| `--sidebar-accent` | yes | `#f2f2f2` | `#272421` | 1 | 1 | 1 | globals.css:265, globals.css:298 |  |
| `--sidebar-accent-foreground` | yes | `#1f1e1d` | `#ffffff` | 1 | 1 | 1 | globals.css:266 |  |
| `--sidebar-border` | yes | `#e5e0d8` | `#3f3b36` | 1 | 1 | 1 | globals.css:267, globals.css:299 |  |
| `--sidebar-ring` | yes | `#ff5001` | `#8c91ff` | 1 | 1 | 1 | globals.css:268, globals.css:300 |  |

## 2c · State layers, CT-04

| Token | Defined | Light | Dark | Refs (total) | of which theme plumbing | Files | Defined at | Drift from pack |
|---|---|---|---|---|---|---|---|---|
| `--tint-hover` | yes | `rgb(0 0 0 / 0.04)` | `rgb(255 255 255 / 0.06)` | 141 | 0 | 78 | settings-tokens.css:564, settings-tokens.css:831 |  |
| `--tint-press` | yes | `rgb(0 0 0 / 0.06)` | `rgb(255 255 255 / 0.09)` | 12 | 0 | 10 | settings-tokens.css:565, settings-tokens.css:832 |  |
| `--tint-faint` | yes | `rgb(0 0 0 / 0.02)` | `rgb(255 255 255 / 0.04)` | 10 | 0 | 8 | settings-tokens.css:563, settings-tokens.css:805 |  |

### Runtime-built token names

Template literals that build a token name at runtime. A text count cannot see these, so each is listed.

- `src/components/record/person-row.tsx:58` builds `var(--alert-${tone}-bg)`
- `src/components/record/person-row.tsx:59` builds `var(--alert-${tone}-fg)`

## 3 · Hardcoded hex outside the theme files

111 occurrences in 28 files (1 of them test files). Grouped by file; tests last.

### `src/app/dev/components/page.tsx` (14)

- L62 `#e5e0d2` · `{ token: "surface/s2", value: "#e5e0d2" },`
- L63 `#f6f4ef` · `{ token: "surface/s1 · s0", value: "#f6f4ef" },`
- L64 `#dfddd8` · `{ token: "border/border-subtle", value: "#dfddd8" },`
- L65 `#1f1e1d` · `{ token: "text/primary", value: "#1f1e1d" },`
- L66 `#58534b` · `{ token: "text/secondary", value: "#58534b" },`
- L67 `#a0998d` · `{ token: "text/tertiary", value: "#a0998d", note: "⚠ 2.57:1 — decorative only" },`
- L68 `#797774` · `{ token: "muted (untokenized)", value: "#797774", note: "⚠ 4.06:1 on s1" },`
- L69 `#b8b2a9` · `{ token: "states/inactive", value: "#b8b2a9" },`
- L70 `#716a60` · `{ token: "button/border/default", value: "#716a60", note: "focus ring" },`
- L71 `#b164ff` · `{ token: "preview accent", value: "#b164ff" },`
- L72 `#f1ece3` · `{ token: "preview chip bg", value: "#f1ece3" },`
- L317 `#58534b` · `<li>Inactive — bare icon, medium #58534b label</li>`
- L319 `#716a60` · `<li>Focus — 2px #716a60 ring, 2px offset (gaps #4)</li>`
- L331 `#716a60` · `note="Config-driven from the §3 registry (never hardcoded). ←/→/Home/End are keyboard-operable; active = 1.5px #716a60 underline + bold."`

### `src/app/gate/page.tsx` (2)

- L29 `#fff2ea` · `<main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 py-16">`
- L29 `#faf6ef` · `<main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 py-16">`

### `src/app/invite/[token]/page.tsx` (2)

- L42 `#fff2ea` · `<main className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 py-12">`
- L42 `#faf6ef` · `<main className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 py-12">`

### `src/app/onboarding/preview/page.tsx` (2)

- L74 `#fff2ea` · `<div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1] sm:px-6 sm:py-10">`
- L74 `#f6f4f1` · `<div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1] sm:px-6 sm:py-10">`

### `src/app/onboarding/submitted/page.tsx` (3)

- L99 `#fff2ea` · `<div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1]">`
- L99 `#f6f4f1` · `<div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1]">`
- L264 `#dfeddb` · `<div className="bg-[#dfeddb] px-6 py-6 sm:px-7">`

### `src/app/page.tsx` (2)

- L112 `#fff2ea` · `<main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] p`
- L112 `#faf6ef` · `<main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] p`

### `src/components/admin/roster.tsx` (2)

- L891 `#7b5bd6` · `role === "Mentor" ? "border-[#7b5bd6]/40 text-[#5b41a8]" : "border-destructive/40 text-destructive"`
- L891 `#5b41a8` · `role === "Mentor" ? "border-[#7b5bd6]/40 text-[#5b41a8]" : "border-destructive/40 text-destructive"`

### `src/components/anno/anno-layer.tsx` (2)

- L603 `#7b5bd6` · `style={{ background: "#7b5bd6", boxShadow: "0 0 0 1px #6e6b67" }}`
- L603 `#6e6b67` · `style={{ background: "#7b5bd6", boxShadow: "0 0 0 1px #6e6b67" }}`

### `src/components/anno/comment-row.tsx` (6)

- L184 `#7b5bd6` · `background: resolved ? "transparent" : "#7b5bd6",`
- L185 `#7b5bd6` · `border: resolved ? "2px solid #7b5bd6" : "2px solid #ffffff",`
- L185 `#ffffff` · `border: resolved ? "2px solid #7b5bd6" : "2px solid #ffffff",`
- L186 `#6e6b67` · `boxShadow: "0 0 0 1px #6e6b67",`
- L187 `#7b5bd6` · `color: resolved ? "#7b5bd6" : "#ffffff",`
- L187 `#ffffff` · `color: resolved ? "#7b5bd6" : "#ffffff",`

### `src/components/anno/identity-popover.tsx` (2)

- L102 `#6e6b67` · `style={{ background: chipFor(clientId), boxShadow: "0 0 0 1px #6e6b67" }}`
- L179 `#6e6b67` · `style={{ background: conflictWith.colorChip, boxShadow: "0 0 0 1px #6e6b67" }}`

### `src/components/anno/mode-control.tsx` (3)

- L193 `#7b5bd6` · `style={{ background: "#7b5bd6", color: "#ffffff", boxShadow: "0 0 0 1px #6e6b67" }}`
- L193 `#ffffff` · `style={{ background: "#7b5bd6", color: "#ffffff", boxShadow: "0 0 0 1px #6e6b67" }}`
- L193 `#6e6b67` · `style={{ background: "#7b5bd6", color: "#ffffff", boxShadow: "0 0 0 1px #6e6b67" }}`

### `src/components/anno/pin.tsx` (4)

- L65 `#7b5bd6` · `export const PIN_FILL = "#7b5bd6";`
- L66 `#ffffff` · `export const PIN_FILL_TEXT = "#ffffff";`
- L67 `#ffffff` · `export const PIN_STROKE = "#ffffff";`
- L70 `#6e6b67` · `export const PIN_EDGE = "#6e6b67";`

### `src/components/onboarding/backdrops.tsx` (6)

- L21 `#ffede6` · `export const INTRO_GRADIENT = "bg-gradient-to-b from-[#ffede6] to-white";`
- L22 `#f3f9dc` · `export const STEP_GRADIENT = "bg-gradient-to-b from-[#f3f9dc] via-[#ffdccc] to-white";`
- L22 `#ffdccc` · `export const STEP_GRADIENT = "bg-gradient-to-b from-[#f3f9dc] via-[#ffdccc] to-white";`
- L49 `#ffa8b2` · `className="absolute left-1/2 top-1/2 size-[760px] max-w-none -translate-x-1/2 -translate-y-1/2 bg-[#ffa8b2] opacity-40 sm:size-[900px]"`
- L68 `#ff5001` · `className="absolute -left-40 -top-28 size-[460px] bg-[#ff5001] sm:size-[580px]"`
- L73 `#71e0ff` · `className="absolute -right-48 bottom-0 size-[620px] translate-y-1/4 bg-[#71e0ff] sm:size-[860px]"`

### `src/components/onboarding/interests-deck-field.tsx` (4)

- L166 `#b164ff` · `className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#b164ff]/15 to-[#71e0ff]/20 px-6 text-center tra`
- L166 `#71e0ff` · `className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#b164ff]/15 to-[#71e0ff]/20 px-6 text-center tra`
- L166 `#b164ff` · `className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#b164ff]/15 to-[#71e0ff]/20 px-6 text-center tra`
- L166 `#71e0ff` · `className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#b164ff]/15 to-[#71e0ff]/20 px-6 text-center tra`

### `src/components/onboarding/intro/examples-intro.tsx` (5)

- L27 `#ff6f9c` · `{ src: "/profile-example1.png", accent: "#ff6f9c" },`
- L28 `#7bbf57` · `{ src: "/profile-example2.png", accent: "#7bbf57" },`
- L29 `#7b7ff0` · `{ src: "/profile-example3.png", accent: "#7b7ff0" },`
- L30 `#ffb200` · `{ src: "/profile-example4.png", accent: "#ffb200" },`
- L31 `#34c3d9` · `{ src: "/profile-example5.png", accent: "#34c3d9" },`

### `src/components/onboarding/intro/welcome-intro.tsx` (3)

- L23 `#ffede6` · `<main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-[#ffede6] to-white px-4 py-10 sm:`
- L27 `#ffa8b2` · `<div className="flex flex-col overflow-hidden rounded-[2rem] border border-[#ffa8b2] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.1)] lg:flex-ro`
- L73 `#ffa8b2` · `className="absolute left-1/2 top-1/2 h-[150%] w-[135%] max-w-none -translate-x-1/2 -translate-y-1/2 bg-[#ffa8b2] sm:w-[115%] lg:h-[160%] lg:`

### `src/components/onboarding/mentor-profile-preview.tsx` (6)

- L27 `#b164ff` · `const PURPLE = "#b164ff";`
- L28 `#71e0ff` · `const CYAN = "#71e0ff";`
- L168 `#1f1e1d` · `"theme-light relative h-full bg-white text-[#1f1e1d]",`
- L237 `#fff` · `<use href="#bust" fill="#fff" filter="url(#bustErodeMid)" />`
- L240 `#fff` · `<use href="#bust" fill="#fff" filter="url(#bustErodeCore)" />`
- L300 `#b164ff` · `className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-[#b164ff]/40 px-3 py-1.5 text-sm text-white backdrop-blur-s`

### `src/components/onboarding/spotify-song.tsx` (5)

- L7 `#b164ff` · `const PURPLE = "#b164ff";`
- L10 `#0b0b0d` · `"repeating-radial-gradient(circle at 50% 50%, #0b0b0d 0px, #0b0b0d 1px, #1d1d20 1px, #1d1d20 2.4px), radial-gradient(circle at 36% 30%, rgba`
- L10 `#0b0b0d` · `"repeating-radial-gradient(circle at 50% 50%, #0b0b0d 0px, #0b0b0d 1px, #1d1d20 1px, #1d1d20 2.4px), radial-gradient(circle at 36% 30%, rgba`
- L10 `#1d1d20` · `"repeating-radial-gradient(circle at 50% 50%, #0b0b0d 0px, #0b0b0d 1px, #1d1d20 1px, #1d1d20 2.4px), radial-gradient(circle at 36% 30%, rgba`
- L10 `#1d1d20` · `"repeating-radial-gradient(circle at 50% 50%, #0b0b0d 0px, #0b0b0d 1px, #1d1d20 1px, #1d1d20 2.4px), radial-gradient(circle at 36% 30%, rgba`

### `src/components/onboarding/steps/profile-photo.tsx` (1)

- L100 `#71e0ff` · `<div className="relative flex h-56 items-end justify-center overflow-hidden rounded-2xl border bg-[#71e0ff]/15">`

### `src/components/onboarding/welcome-back-modal.tsx` (1)

- L75 `#dfeddb` · `<DialogHeader className="gap-2 bg-[#dfeddb] py-6 pl-6 pr-12 text-left">`

### `src/components/record/record-avatar.tsx` (10)

- L29 `#efe7f7` · `{ bg: "#efe7f7", fg: "#5b41a8" },`
- L29 `#5b41a8` · `{ bg: "#efe7f7", fg: "#5b41a8" },`
- L30 `#e6efe8` · `{ bg: "#e6efe8", fg: "#3a7d44" },`
- L30 `#3a7d44` · `{ bg: "#e6efe8", fg: "#3a7d44" },`
- L31 `#f2e9df` · `{ bg: "#f2e9df", fg: "#8a5a2b" },`
- L31 `#8a5a2b` · `{ bg: "#f2e9df", fg: "#8a5a2b" },`
- L32 `#e6edf3` · `{ bg: "#e6edf3", fg: "#3f5c78" },`
- L32 `#3f5c78` · `{ bg: "#e6edf3", fg: "#3f5c78" },`
- L33 `#f5e7ea` · `{ bg: "#f5e7ea", fg: "#9a4257" },`
- L33 `#9a4257` · `{ bg: "#f5e7ea", fg: "#9a4257" },`

### `src/components/record/record-overview.tsx` (3)

- L34 `#ffc7ad` · `const C_DEACTIVATED = "#ffc7ad";`
- L230 `#fff` · `<circle cx={hx} cy={py(cas)} r={4} fill={C_CASELOAD} stroke="#fff" strokeWidth={2} />`
- L241 `#ff5001` · `<tspan fill="#ff5001">●</tspan> Caseload {cas}`

### `src/components/record/spotify-chip.tsx` (1)

- L53 `#1db954` · `<span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#1db954] text-white">`

### `src/components/settings/phone-preview.tsx` (3)

- L82 `#404040` · `"w-full rounded-[var(--radius-preview-frame)] bg-gradient-to-b from-[#404040] to-[#171717] p-[6px] shadow-[0_18px_50px_rgba(31,30,29,0.4)]",`
- L82 `#171717` · `"w-full rounded-[var(--radius-preview-frame)] bg-gradient-to-b from-[#404040] to-[#171717] p-[6px] shadow-[0_18px_50px_rgba(31,30,29,0.4)]",`
- L87 `#0a0a0a` · `<div className="rounded-[43px] bg-[#0a0a0a] p-[3px]">`

### `src/lib/anno/identity.ts` (8)

- L187 `#7b5bd6` · `"#7b5bd6", "#2933fb", "#0f8a8a", "#b8560e", "#8f3f9e", "#1f6f4a",`
- L187 `#2933fb` · `"#7b5bd6", "#2933fb", "#0f8a8a", "#b8560e", "#8f3f9e", "#1f6f4a",`
- L187 `#0f8a8a` · `"#7b5bd6", "#2933fb", "#0f8a8a", "#b8560e", "#8f3f9e", "#1f6f4a",`
- L187 `#b8560e` · `"#7b5bd6", "#2933fb", "#0f8a8a", "#b8560e", "#8f3f9e", "#1f6f4a",`
- L187 `#8f3f9e` · `"#7b5bd6", "#2933fb", "#0f8a8a", "#b8560e", "#8f3f9e", "#1f6f4a",`
- L187 `#1f6f4a` · `"#7b5bd6", "#2933fb", "#0f8a8a", "#b8560e", "#8f3f9e", "#1f6f4a",`
- L188 `#a3562c` · `"#a3562c", "#3a5bb8",`
- L188 `#3a5bb8` · `"#a3562c", "#3a5bb8",`

### `src/lib/anno/server/repo.ts` (1)

- L237 `#7b5bd6` · `colorChip: typeof r.colorChip === "string" ? r.colorChip : "#7b5bd6",`

### `src/lib/tasks/avatar.ts` (8)

- L85 `#4a3585` · `"#4a3585",`
- L86 `#2b3d80` · `"#2b3d80",`
- L87 `#1f5450` · `"#1f5450",`
- L88 `#7a4318` · `"#7a4318",`
- L89 `#6d2a67` · `"#6d2a67",`
- L90 `#26522c` · `"#26522c",`
- L91 `#7d3327` · `"#7d3327",`
- L92 `#2f4a66` · `"#2f4a66",`

### `src/lib/anno/server/upstash-driver.test.ts` (2)

- L285 `#7b5bd6` · `await upsertReviewer({ clientId: "c-1", displayName: "Amber Otter", colorChip: "#7b5bd6" });`
- L286 `#7b5bd6` · `await upsertReviewer({ clientId: "c-1", displayName: "Quiet Finch", colorChip: "#7b5bd6" });`

## 4 · Named usage sites

### `--brand` (var) and the `brand` Tailwind classes · 34 references

| File:line | Element | Paints | Match |
|---|---|---|---|
| `app/admin/mentor/page.tsx:1161` | `span` | value | `var(--brand` |
| `app/admin/mentor/page.tsx:1162` | `span` | color | `var(--brand` |
| `app/globals.css:173` | `(css rule)` | --color-brand | `var(--brand` |
| `components/record/record-overview.tsx:31` | `(not in JSX)` | value | `var(--brand` |
| `components/record/record-overview.tsx:33` | `(not in JSX)` | value | `var(--brand` |
| `components/record/record-overview.tsx:263` | `LegendKey` | value | `var(--brand` |
| `components/record/record-overview.tsx:409` | `TrendingUp` | value | `var(--brand` |
| `components/record/user-record-shell.tsx:246` | `span` | backgroundColor | `var(--brand` |
| `components/record/user-record-shell.tsx:247` | `span` | color | `var(--brand` |
| `app/admin/review/page.tsx:298` | `div` | bg | `bg-brand/5` |
| `app/admin/review/page.tsx:306` | `div` | bg | `bg-brand` |
| `app/admin/review/page.tsx:317` | `div` | fill | `fill-brand` |
| `app/admin/review/page.tsx:317` | `div` | text | `text-brand` |
| `app/invite/[token]/page.tsx:48` | `div` | border-t | `border-t-brand` |
| `components/account/photo-row.tsx:190` | `div` | text | `text-brand` |
| `components/onboarding/cycling-examples.tsx:53` | `GuidanceCard` | border | `border-brand/40` |
| `components/onboarding/guidance-card.tsx:40` | `Icon` | text | `text-brand` |
| `components/onboarding/hub/hub-welcome-modal.tsx:44` | `DialogHeader` | bg | `bg-brand/10` |
| `components/onboarding/intro-examples-modal.tsx:86` | `div` | bg | `bg-brand` |
| `components/onboarding/intro-examples-modal.tsx:100` | `div` | bg | `bg-brand` |
| `components/onboarding/media-intro-field.tsx:200` | `span` | bg | `bg-brand/15` |
| `components/onboarding/media-intro-field.tsx:200` | `span` | text | `text-brand` |
| `components/onboarding/media-intro-field.tsx:201` | `span` | bg | `bg-brand/20` |
| `components/onboarding/onboarding-wizard.tsx:130` | `div` | border-t | `border-t-brand` |
| `components/onboarding/onboarding-wizard.tsx:149` | `div` | border-t | `border-t-brand` |
| `components/onboarding/steps/profile-photo.tsx:159` | `Loader2` | text | `text-brand` |
| `components/onboarding/steps/profile-photo.tsx:191` | `div` | border | `border-brand/35` |
| `components/onboarding/steps/profile-photo.tsx:191` | `div` | bg | `bg-brand/5` |
| `components/onboarding/steps/vibe.tsx:57` | `Sparkles` | text | `text-brand` |
| `components/profile-editor/photo-field.tsx:42` | `Loader2` | text | `text-brand` |
| `components/settings/notifications-section.tsx:64` | `(not in JSX)` | bg | `bg-brand` |
| `components/ui/button.tsx:16` | `(not in JSX)` | bg | `bg-brand` |
| `components/ui/button.tsx:16` | `(not in JSX)` | hover:bg | `hover:bg-brand/90` |
| `components/ui/progress.tsx:24` | `typeof` | bg | `bg-brand` |

### `--state-error` · 34 references

| File:line | Element | Paints | Match |
|---|---|---|---|
| `app/admin/mentor/page.tsx:1280` | `(not in JSX)` | value | `var(--state-error` |
| `app/admin/mentor/page.tsx:1297` | `(not in JSX)` | value | `var(--state-error` |
| `app/dev/components/page.tsx:289` | `span` | value | `var(--state-error` |
| `app/gate/page.tsx:81` | `(not in JSX)` | color | `var(--state-error` |
| `app/gate/page.tsx:97` | `(not in JSX)` | value | `var(--state-error` |
| `app/globals.css:217` | `(css rule)` | --destructive | `var(--state-error` |
| `app/settings-tokens.css:437` | `(css rule)` | --dot-critical | `var(--state-error` |
| `components/anno/anno-composer.tsx:133` | `p` | value | `var(--state-error` |
| `components/anno/anno-layer.tsx:576` | `div` | value | `var(--state-error` |
| `components/anno/comment-row.tsx:323` | `p` | value | `var(--state-error` |
| `components/anno/comment-row.tsx:350` | `span` | value | `var(--state-error` |
| `components/anno/identity-popover.tsx:189` | `p` | value | `var(--state-error` |
| `components/app-shell/bottom-nav.tsx:69` | `(not in JSX)` | value | `var(--state-error` |
| `components/app-shell/top-bar.tsx:109` | `Bell` | value | `var(--state-error` |
| `components/monitoring/event-pane.tsx:911` | `(not in JSX)` | value | `var(--state-error` |
| `components/monitoring/monitoring-page.tsx:1094` | `(not in JSX)` | value | `var(--state-error` |
| `components/profile-editor/matching-extensions.tsx:42` | `(not in JSX)` | value | `var(--state-error` |
| `components/record/care-review-workspace.tsx:408` | `span` | value | `var(--state-error` |
| `components/record/care-summary-doc.tsx:914` | `(not in JSX)` | value | `var(--state-error` |
| `components/record/care-update-compose.tsx:583` | `HTMLTextAreaElement` | color | `var(--state-error` |
| `components/record/care-update-compose.tsx:615` | `div` | value | `var(--state-error` |
| `components/record/care-update-compose.tsx:644` | `FieldError` | value | `var(--state-error` |
| `components/record/care-update-compose.tsx:975` | `div` | value | `var(--state-error` |
| `components/record/care-update-compose.tsx:999` | `(not in JSX)` | color | `var(--state-error` |
| `components/record/deactivate-action.tsx:40` | `(not in JSX)` | color | `var(--state-error` |
| `components/record/deactivate-action.tsx:40` | `(not in JSX)` | color | `var(--state-error` |
| `components/record/decision-footer.tsx:101` | `p` | color | `var(--state-error` |
| `components/record/decision-footer.tsx:113` | `(not in JSX)` | value | `var(--state-error` |
| `components/record/row.tsx:298` | `div` | value | `var(--state-error` |
| `components/settings/edit-row.tsx:156` | `div` | value | `var(--state-error` |
| `components/settings/section-card.tsx:73` | `(not in JSX)` | value | `var(--state-error` |
| `components/settings/section-card.tsx:144` | `div` | value | `var(--state-error` |
| `components/settings/sidebar.tsx:141` | `(not in JSX)` | value | `var(--state-error` |
| `components/today/today-page.tsx:367` | `(not in JSX)` | color | `var(--state-error` |

### `--destructive` and `destructive` classes · 38 references

| File:line | Element | Paints | Match |
|---|---|---|---|
| `app/globals.css:160` | `(css rule)` | --color-destructive | `var(--destructive` |
| `app/admin/review/page.tsx:374` | `(not in JSX)` | text | `text-destructive` |
| `components/admin/roster.tsx:891` | `span` | border | `border-destructive/40` |
| `components/admin/roster.tsx:891` | `span` | text | `text-destructive` |
| `components/onboarding/media-intro-field.tsx:206` | `span` | bg | `bg-destructive` |
| `components/onboarding/photo-examples.tsx:97` | `figure` | ring | `ring-destructive/40` |
| `components/onboarding/steps/confirm.tsx:368` | `p` | text | `text-destructive` |
| `components/ui/badge.tsx:8` | `(not in JSX)` | aria-invalid:border | `aria-invalid:border-destructive` |
| `components/ui/badge.tsx:8` | `(not in JSX)` | aria-invalid:ring | `aria-invalid:ring-destructive/20` |
| `components/ui/badge.tsx:8` | `(not in JSX)` | dark:aria-invalid:ring | `dark:aria-invalid:ring-destructive/40` |
| `components/ui/badge.tsx:16` | `(not in JSX)` | bg | `bg-destructive/10` |
| `components/ui/badge.tsx:16` | `(not in JSX)` | text | `text-destructive` |
| `components/ui/badge.tsx:16` | `(not in JSX)` | focus-visible:ring | `focus-visible:ring-destructive/20` |
| `components/ui/badge.tsx:16` | `(not in JSX)` | dark:bg | `dark:bg-destructive/20` |
| `components/ui/badge.tsx:16` | `(not in JSX)` | dark:focus-visible:ring | `dark:focus-visible:ring-destructive/40` |
| `components/ui/badge.tsx:16` | `(not in JSX)` | hover:bg | `hover:bg-destructive/20` |
| `components/ui/button.tsx:11` | `(not in JSX)` | aria-invalid:border | `aria-invalid:border-destructive` |
| `components/ui/button.tsx:11` | `(not in JSX)` | aria-invalid:ring | `aria-invalid:ring-destructive/20` |
| `components/ui/button.tsx:24` | `(not in JSX)` | bg | `bg-destructive/10` |
| `components/ui/button.tsx:24` | `(not in JSX)` | text | `text-destructive` |
| `components/ui/button.tsx:24` | `(not in JSX)` | hover:bg | `hover:bg-destructive/20` |
| `components/ui/button.tsx:24` | `(not in JSX)` | focus-visible:ring | `focus-visible:ring-destructive/20` |
| `components/ui/checkbox.tsx:17` | `typeof` | aria-invalid:border | `aria-invalid:border-destructive` |
| `components/ui/checkbox.tsx:17` | `typeof` | aria-invalid:ring | `aria-invalid:ring-destructive/20` |
| `components/ui/checkbox.tsx:17` | `typeof` | dark:aria-invalid:border | `dark:aria-invalid:border-destructive/50` |
| `components/ui/checkbox.tsx:17` | `typeof` | dark:aria-invalid:ring | `dark:aria-invalid:ring-destructive/40` |
| `components/ui/form.tsx:99` | `typeof` | text | `text-destructive` |
| `components/ui/form.tsx:149` | `(not in JSX)` | text | `text-destructive` |
| `components/ui/input.tsx:11` | `(not in JSX)` | aria-invalid:border | `aria-invalid:border-destructive` |
| `components/ui/input.tsx:11` | `(not in JSX)` | aria-invalid:ring | `aria-invalid:ring-destructive/15` |
| `components/ui/radio-group.tsx:29` | `typeof` | aria-invalid:border | `aria-invalid:border-destructive` |
| `components/ui/radio-group.tsx:29` | `typeof` | aria-invalid:ring | `aria-invalid:ring-destructive/20` |
| `components/ui/radio-group.tsx:29` | `typeof` | dark:aria-invalid:border | `dark:aria-invalid:border-destructive/50` |
| `components/ui/radio-group.tsx:29` | `typeof` | dark:aria-invalid:ring | `dark:aria-invalid:ring-destructive/40` |
| `components/ui/select.tsx:50` | `typeof` | aria-invalid:border | `aria-invalid:border-destructive` |
| `components/ui/select.tsx:50` | `typeof` | aria-invalid:ring | `aria-invalid:ring-destructive/15` |
| `components/ui/textarea.tsx:10` | `(not in JSX)` | aria-invalid:border | `aria-invalid:border-destructive` |
| `components/ui/textarea.tsx:10` | `(not in JSX)` | aria-invalid:ring | `aria-invalid:ring-destructive/15` |

### `--focus-ring` · 139 references

| File:line | Element | Paints | Match |
|---|---|---|---|
| `app/admin/mentor/page.tsx:1250` | `PopoverTrigger` | color | `var(--focus-ring` |
| `app/admin/mentor/page.tsx:1329` | `(not in JSX)` | color | `var(--focus-ring` |
| `app/admin/person/[id]/page.tsx:248` | `(not in JSX)` | color | `var(--focus-ring` |
| `app/app/activity/page.tsx:35` | `(not in JSX)` | color | `var(--focus-ring` |
| `app/app/escalation/[escalationId]/page.tsx:97` | `(not in JSX)` | color | `var(--focus-ring` |
| `app/app/settings/page.tsx:129` | `div` | color | `var(--focus-ring` |
| `app/gate/page.tsx:18` | `(not in JSX)` | color | `var(--focus-ring` |
| `app/globals.css:297` | `(css rule)` | --ring | `var(--focus-ring` |
| `app/globals.css:300` | `(css rule)` | --sidebar-ring | `var(--focus-ring` |
| `app/page.tsx:41` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/activity-ledger.tsx:61` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/activity-row.tsx:48` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/activity-row.tsx:417` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/filter-dialog.tsx:48` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/pane/bodies.tsx:41` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/pane/document-preview.tsx:29` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/pane/pane-actions.tsx:32` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/pane/related-record.tsx:30` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/activity/view-rail.tsx:30` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/admin/chat-action.tsx:54` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/admin/roster.tsx:570` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/admin/roster.tsx:646` | `td` | color | `var(--focus-ring` |
| `components/admin/roster.tsx:757` | `span` | color | `var(--focus-ring` |
| `components/admin/roster.tsx:867` | `span` | color | `var(--focus-ring` |
| `components/anno/anno-composer.tsx:33` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/anno/anno-drawer.tsx:49` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/anno/comment-row.tsx:46` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/anno/identity-popover.tsx:34` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/anno/mode-control.tsx:36` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/anno/pin.tsx:52` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/app-shell/bottom-nav.tsx:54` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/app-shell/grouped-rail.tsx:56` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/app-shell/top-bar.tsx:45` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/activity/activity-builder.tsx:43` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/activity/activity-cover.tsx:39` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/chat-page.tsx:64` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/documentation/context-reference.tsx:36` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/documentation/note-composer.tsx:39` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/documentation/note-detail.tsx:29` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/escalation/assessment-panel.tsx:39` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/escalation/crisis-view.tsx:45` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/escalation/resolve-dialog.tsx:44` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/list/conversation-list.tsx:48` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/list/conversation-row.tsx:38` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/rail/assist.tsx:36` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/rail/timeline.tsx:35` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/thread/composer.tsx:39` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/thread/detail-sheet.tsx:43` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/thread/event-chip.tsx:44` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/thread/message-actions.tsx:45` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/thread/status-banner.tsx:159` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/chat/thread/thread-menu.tsx:46` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/dev/dev-bar.tsx:197` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/dev/dev-panel.tsx:55` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/ia/list-toolbar.tsx:56` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/ia/retired-route.tsx:41` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/ia/view-options.tsx:46` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/monitoring/escalation-region.tsx:43` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/monitoring/escalation-timeline.tsx:61` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/monitoring/event-list.tsx:237` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/monitoring/event-pane.tsx:79` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/monitoring/monitoring-page.tsx:89` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/monitoring/now-band.tsx:31` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/profile-editor/account-editor.tsx:299` | `div` | color | `var(--focus-ring` |
| `components/profile-editor/account-editor.tsx:338` | `PillButton` | color | `var(--focus-ring` |
| `components/profile-editor/account-editor.tsx:442` | `div` | color | `var(--focus-ring` |
| `components/profile-editor/account-editor.tsx:466` | `PillButton` | color | `var(--focus-ring` |
| `components/profile-editor/account-editor.tsx:641` | `p` | color | `var(--focus-ring` |
| `components/profile-editor/matching-extensions.tsx:30` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/profile-editor/update-review-bits.tsx:26` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/ai-notes-panel.tsx:39` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/attention-card.tsx:64` | `AlertCircle` | color | `var(--focus-ring` |
| `components/record/care-network.tsx:93` | `div` | color | `var(--focus-ring` |
| `components/record/care-review-card.tsx:51` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/care-review-workspace.tsx:50` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/care-sparkline.tsx:44` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/care-summary.tsx:72` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/care-timeline.tsx:52` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/care-timeline.tsx:1819` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/care-update-compose.tsx:82` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/caseload-controls.tsx:34` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/caseload-controls.tsx:94` | `PopoverTrigger` | color | `var(--focus-ring` |
| `components/record/contact-actions.tsx:18` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/deactivate-action.tsx:34` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/decision-footer.tsx:40` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/dsm5-search.tsx:35` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/escalation-note-module.tsx:46` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/flag-review-dialog.tsx:57` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/flag-task-card.tsx:49` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/hover-note.tsx:33` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/mentee-table.tsx:77` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/mentee-table.tsx:441` | `div` | color | `var(--focus-ring` |
| `components/record/organization.tsx:95` | `div` | color | `var(--focus-ring` |
| `components/record/organization.tsx:110` | `DropdownMenuTrigger` | color | `var(--focus-ring` |
| `components/record/person-row.tsx:27` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/person-row.tsx:165` | `VideoChip` | color | `var(--focus-ring` |
| `components/record/pin-mentee-toggle.tsx:52` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/record-authority-note.tsx:54` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/record-button.tsx:27` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/relationship-table.tsx:65` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/relationship-table.tsx:865` | `DropdownMenuTrigger` | color | `var(--focus-ring` |
| `components/record/review-body.tsx:78` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/row.tsx:37` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/row.tsx:263` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/segmented-control.tsx:196` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/spotify-chip.tsx:15` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/supervision.tsx:52` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/survey-comparison-grid.tsx:49` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/task-section.tsx:45` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/record/user-record-shell.tsx:344` | `div` | color | `var(--focus-ring` |
| `components/settings/account-popover.tsx:46` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/settings/account-popover.tsx:152` | `DialogTrigger` | value | `var(--focus-ring` |
| `components/settings/account-popover.tsx:152` | `DialogTrigger` | value | `var(--focus-ring` |
| `components/settings/account-popover.tsx:279` | `PopoverTrigger` | value | `var(--focus-ring` |
| `components/settings/account-popover.tsx:279` | `PopoverTrigger` | value | `var(--focus-ring` |
| `components/settings/edit-row.tsx:8` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/settings/notifications-section.tsx:27` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/settings/pill-button.tsx:9` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/settings/section-card.tsx:8` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/settings/security-section.tsx:18` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/settings/sidebar.tsx:16` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/settings/tab-bar.tsx:12` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/conversation-excerpt.tsx:40` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/domain-tabs.tsx:53` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/kind-filter.tsx:41` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/review-row.tsx:449` | `SortButton` | color | `var(--focus-ring` |
| `components/tasks/strips.tsx:31` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/task-pane.tsx:80` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/task-pane.tsx:1145` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/tasks-page.tsx:152` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/tasks-page.tsx:1684` | `TabComplete` | color | `var(--focus-ring` |
| `components/tasks/worklist.tsx:703` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/tasks/worklist.tsx:2115` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/today/pinned-mentees.tsx:54` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/today/suggested-schedule.tsx:55` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/today/today-page.tsx:133` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/ui/data-view.tsx:145` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/ui/data-view.tsx:284` | `(not in JSX)` | color | `var(--focus-ring` |
| `components/ui/evidence-primitives.tsx:30` | `(not in JSX)` | color | `var(--focus-ring` |

### `--ring` and `ring-ring` / `outline-ring` classes · 32 references

| File:line | Element | Paints | Match |
|---|---|---|---|
| `app/globals.css:157` | `(css rule)` | --color-ring | `var(--ring` |
| `app/admin/review/page.tsx:267` | `div` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `app/globals.css:315` | `(css rule)` | outline | `outline-ring/50` |
| `app/hub/page.tsx:105` | `summary` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/admin/mentor-status-badge.tsx:101` | `DropdownMenuTrigger` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/admin/mentor-status-badge.tsx:208` | `DropdownMenuTrigger` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/onboarding/change-requests-dock.tsx:97` | `div` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/onboarding/change-requests-dock.tsx:153` | `Button` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/onboarding/change-requests-dock.tsx:169` | `Button` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/onboarding/change-requests-dock.tsx:232` | `(not in JSX)` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/onboarding/cycling-examples.tsx:34` | `(not in JSX)` | focus-visible:outline | `focus-visible:outline-ring` |
| `components/onboarding/intro-examples-modal.tsx:86` | `div` | focus-visible:outline | `focus-visible:outline-ring` |
| `components/onboarding/intro-examples-modal.tsx:104` | `div` | group-focus-within:ring | `group-focus-within:ring-ring` |
| `components/onboarding/intro-examples-modal.tsx:145` | `DialogTrigger` | focus-visible:outline | `focus-visible:outline-ring` |
| `components/onboarding/intro-examples-modal.tsx:171` | `DialogClose` | focus-visible:outline | `focus-visible:outline-ring` |
| `components/onboarding/vibe-board-field.tsx:24` | `(not in JSX)` | focus-visible:outline | `focus-visible:outline-ring` |
| `components/onboarding/welcome-back-modal.tsx:98` | `li` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/ui/badge.tsx:8` | `(not in JSX)` | focus-visible:border | `focus-visible:border-ring` |
| `components/ui/badge.tsx:8` | `(not in JSX)` | focus-visible:ring | `focus-visible:ring-ring/50` |
| `components/ui/button.tsx:11` | `(not in JSX)` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/ui/checkbox.tsx:17` | `typeof` | focus-visible:border | `focus-visible:border-ring` |
| `components/ui/checkbox.tsx:17` | `typeof` | focus-visible:ring | `focus-visible:ring-ring/50` |
| `components/ui/input-otp.tsx:55` | `(not in JSX)` | ring | `ring-ring/40` |
| `components/ui/input.tsx:11` | `(not in JSX)` | focus-visible:border | `focus-visible:border-ring` |
| `components/ui/input.tsx:11` | `(not in JSX)` | focus-visible:ring | `focus-visible:ring-ring/15` |
| `components/ui/radio-group.tsx:29` | `typeof` | focus-visible:border | `focus-visible:border-ring` |
| `components/ui/radio-group.tsx:29` | `typeof` | focus-visible:ring | `focus-visible:ring-ring/50` |
| `components/ui/select.tsx:50` | `typeof` | focus-visible:border | `focus-visible:border-ring` |
| `components/ui/select.tsx:50` | `typeof` | focus-visible:ring | `focus-visible:ring-ring/15` |
| `components/ui/switch.tsx:46` | `(not in JSX)` | focus-visible:ring | `focus-visible:ring-ring/40` |
| `components/ui/textarea.tsx:10` | `(not in JSX)` | focus-visible:border | `focus-visible:border-ring` |
| `components/ui/textarea.tsx:10` | `(not in JSX)` | focus-visible:ring | `focus-visible:ring-ring/15` |

### `--surface-s0` · 8 references

| File:line | Element | Paints | Match |
|---|---|---|---|
| `app/app/activity/page.tsx:142` | `ul` | value | `var(--surface-s0` |
| `app/dev/components/page.tsx:102` | `div` | value | `var(--surface-s0` |
| `components/profile-editor/account-editor.tsx:491` | `div` | value | `var(--surface-s0` |
| `components/profile-editor/account-editor.tsx:593` | `div` | value | `var(--surface-s0` |
| `components/profile-editor/account-editor.tsx:617` | `div` | value | `var(--surface-s0` |
| `components/settings/notifications-section.tsx:25` | `(not in JSX)` | value | `var(--surface-s0` |
| `components/settings/section-card.tsx:71` | `(not in JSX)` | value | `var(--surface-s0` |
| `components/settings/security-section.tsx:16` | `(not in JSX)` | value | `var(--surface-s0` |

### `--background` and `bg-background` · 22 references

| File:line | Element | Paints | Match |
|---|---|---|---|
| `app/globals.css:139` | `(css rule)` | background | `var(--background` |
| `app/admin/profile-update/page.tsx:337` | `(not in JSX)` | text | `text-background` |
| `app/admin/review/page.tsx:409` | `div` | bg | `bg-background/85` |
| `app/globals.css:318` | `(css rule)` | bg | `bg-background` |
| `app/hub/[step]/page.tsx:45` | `div` | bg | `bg-background` |
| `app/hub/[step]/page.tsx:57` | `div` | bg | `bg-background` |
| `app/hub/page.tsx:36` | `div` | bg | `bg-background` |
| `app/hub/page.tsx:58` | `div` | bg | `bg-background` |
| `app/onboarding/preview/page.tsx:71` | `div` | bg | `bg-background` |
| `app/onboarding/submitted/page.tsx:67` | `div` | bg | `bg-background` |
| `components/account/photo-row.tsx:188` | `div` | bg | `bg-background/70` |
| `components/admin/roster.tsx:99` | `(not in JSX)` | text | `text-background` |
| `components/admin/roster.tsx:904` | `(not in JSX)` | text | `text-background` |
| `components/admin/team-directory.tsx:69` | `(not in JSX)` | text | `text-background` |
| `components/onboarding/steps/confirm.tsx:347` | `p` | text | `text-background` |
| `components/profile-editor/photo-field.tsx:41` | `div` | bg | `bg-background/70` |
| `components/record/care-timeline.tsx:55` | `(not in JSX)` | text | `text-background` |
| `components/ui/avatar.tsx:65` | `typeof` | ring | `ring-background` |
| `components/ui/avatar.tsx:81` | `(not in JSX)` | ring | `ring-background` |
| `components/ui/avatar.tsx:97` | `(not in JSX)` | ring | `ring-background` |
| `components/ui/button.tsx:18` | `(not in JSX)` | bg | `bg-background` |
| `components/ui/button.tsx:20` | `(not in JSX)` | bg | `bg-background` |

### `states/active` tokens · 0 references

None.

## 5 · Where the code differs from the pack's "current value"

- `--text-muted`: 314 refs, pack says 312
- `--surface-card`: 163 refs, pack says 164
- `--surface-s1`: 90 refs, pack says 91
- `--surface-s2`: 87 refs, pack says 88
- `--focus-ring`: 139 refs, pack says 140
- `--background`: 22 refs, pack says 21
