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

(4) mounts the shared shell (verified by `revheat-favicon verify-shell`), reads
product data from `@revheat/ui/catalog`, and wires identity via the
session / `/api/me/products` fetch; (5) its screens follow the **Data honesty on
screen** rules below wherever they show a reading, a count, a quote, or an empty
state.

## RevHeat portal app standard

Every app that renders inside the RevHeat portal MUST:

1. **Mount the shared shell** — render page content inside `<AppShell>` from
   `@revheat/ui/react` (or the Vue equivalent when it ships), and do not keep a
   per-app product/sidebar rail alongside it — the shared shell owns the rail.
   Enforced by `revheat-favicon verify-shell`.
2. **Read the shared catalog** — take the product list from `@revheat/ui/catalog`,
   never a re-authored per-app copy.
3. **Wire identity** — feed the shell the signed-in user's email, internal/staff
   flag, and owned-product set (via `/api/me/products`), not a hard-coded menu.

## Data honesty on screen

Every RevHeat app that shows a reading, a count, a quote, or an empty state MUST
follow these. Each is either the fix for a defect that shipped on Call Analyzer
(2026-09) or a standing law from that product; they are portal-wide because the
next product will hit the same wall.

1. **A number with no writer is fabricated.** If nothing produced the value, the
   screen says "no reading yet" and names what is missing. Never `0`, never `—`,
   never a blank cell that reads as zero. `null` stays `null` all the way to the
   render.
2. **Whoever computed a figure owns every sentence that carries it.** Figure,
   label, and denominator clause come from the same author, verbatim. No other
   generator (a language model, a template, the front end) writes figures or
   metric labels, and the front end never recomposes a clause ("of the 36 of the
   36" came from breaking this).
3. **Every metric states its direction, and the author of the figure states it.**
   "aim: under 20%", never a bare "target". The reader never guesses whether up or
   down is good, and the front end never hard-codes the direction on the author's
   behalf. (Call Analyzer's monthly line hard-codes "under" today — open follow-up:
   a direction field on the API's metric.)
4. **Readings are dated to the moment they were read.** "92% when proposed", not
   an unlabelled figure that reads as today.
5. **Placeholder text never renders as evidence.** "Not discussed…", "No
   evidence…", "No quote…", and stubs under 15 characters are filtered by ONE
   shared helper — at ingest, and again wherever the server reads them. The screen
   shows what it is sent and never filters on its own. A dropped receipt moves the
   item to "watching"; a leaked placeholder is fabricated evidence.
6. **Empty states name the threshold.** "Collecting — needs 5 wins and 5 losses",
   not "no data yet". The reader learns what would change the screen.
7. **Anything the system chose to surface also shows what it held back, and why.**
   A list of proposals sits beside a "watching, not yet proposed" list with the
   reason. Silence reads as "nothing found"; the reason reads as "not enough yet".
8. **One message, one author.** For a given state the screen renders the server's
   message or its own, never both.
9. **A guard withholds the sentence, never prints nonsense.** Rule 1 covers a
   *missing* value: say so out loud. This rule covers an *invalid* one (a fraction
   outside 0–1, a missing denominator): withhold the whole metric line, never print
   "150%".
10. **Frameworks stay backstage.** The method drives what is said; its name is
    never a label on screen.

The pre-build review gate above checks these alongside the visual items. Rules 1
and 5 are candidates for code enforcement shared across apps (a null-aware reading
component in the shell package; the sentinel-quote helper lifted out of the
Call Analyzer API) — tracked separately, not yet shipped.

## Favicon reference by build system
- **Nuxt:** synced files land in `public/`; reference `/favicon.svg` (+ apple-touch
  `/favicon-180.png`) in `nuxt.config` `app.head.link`.
- **Next.js (App Router):** synced files land in `public/`; reference via
  `metadata.icons` in `app/layout.tsx`.
- **Vite/static:** synced files land in `public/`; add `<link rel="icon">` to
  `index.html`.
