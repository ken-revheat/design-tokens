# RevHeat App Branding & Style Standard

Every RevHeat front-end app MUST comply before it ships. `@revheat/design-tokens`
is the single source of truth for brand tokens and assets — apps consume it, they
do not re-author it.

## Non-negotiables
- **Favicon:** every app serves the canonical RevHeat "R" favicon. Apps MUST NOT
  commit their own favicon. Add design-tokens as a dependency, then in the app build:
  `revheat-favicon sync <publicDir> && revheat-favicon verify <publicDir>` BEFORE the
  bundler build. Gitignore the synced favicon files. A missing/non-R favicon fails
  the build (auto-block).
- **Color:** brand primary `#6143f9`; use design-tokens `vars.css` / Tailwind preset,
  never hardcoded hexes.
- **Type:** Geist / Geist Mono via design-tokens `fonts.css`.
- **Shell/layout:** consume the design-tokens shell; do not fork per-app shell CSS.

## Pre-build review gate (agent-run, before scaffolding ANY new app)
Before building a new app, an agent reviews the app plan against this file and
confirms it: (1) depends on `@revheat/design-tokens` at the current release;
(2) wires `revheat-favicon sync && verify` into its build; (3) uses brand color +
type + shell from the package rather than re-authored copies. The agent reports a
plain-English gap summary to Ken. No new app is built until this passes — but it is
agent-run, not a human bottleneck.

## Favicon reference by build system
- **Nuxt:** synced files land in `public/`; reference `/favicon.svg` (+ apple-touch
  `/favicon-180.png`) in `nuxt.config` `app.head.link`.
- **Next.js (App Router):** synced files land in `public/`; reference via
  `metadata.icons` in `app/layout.tsx`.
- **Vite/static:** synced files land in `public/`; add `<link rel="icon">` to
  `index.html`.
