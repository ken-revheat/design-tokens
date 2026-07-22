# RevHeat App Branding Standard + R-Favicon Rollout — Design

**Date:** 2026-07-22
**Status:** Approved (design), pending implementation plan
**Owner:** Ken (RevHeat)

## Problem

RevHeat ships several separate front-end apps (Portal, Readiness Audit, Trend
Finder, ICP Builder, Lead Accelerator, QuotaFit, Call Analyzer). Each carries its
own favicon and its own copy of brand styling, and they **drift** — some tabs show a
placeholder/default favicon instead of the RevHeat "R". Two failures follow:

1. **No branded tab icon.** Apps deploy without the RevHeat "R" on the browser tab.
2. **Re-styling after the fact.** Apps get built first and brand-aligned later,
   which is wasteful rework.

## Goals

1. **One canonical R favicon**, defined once, that every app pulls from — no
   hand-pasted per-app copies that can drift.
2. **Automated enforcement (auto-block):** an app's build fails if the favicon it
   is about to ship is missing or is not the canonical RevHeat "R".
3. **A pre-build branding/style review gate:** before any *new* app is scaffolded,
   an agent reviews it against a written RevHeat Branding & Style Standard and flags
   gaps — no waiting on Ken, summary reported to him.
4. **Roll the R favicon onto all seven live apps now**, then deploy + verify the R
   actually renders on each live tab.

## Non-goals

- Redesigning any app's UI. This is favicon + a written standard + an enforcement
  check, not a visual overhaul.
- Touching money, billing, entitlement, or customer-facing sales logic. This work is
  front-end asset + build-tooling only.
- Building a new shared design package. `@revheat/design-tokens` already exists and
  is already consumed; we use it.

## Decisions (locked with Ken, 2026-07-22)

- **Enforcement:** auto-block — a build/CI check, not a checklist-of-memory.
- **Rollout mechanism:** shared source — the canonical favicon lives in the
  `@revheat/design-tokens` package; apps reference it, they do not keep their own.
- **Scope now:** all seven live apps.
- **Pre-build review:** agent-run checklist against the standard; no human bottleneck,
  Ken gets a plain-English summary.

## Current state (verified)

- `@revheat/design-tokens` is a real published-via-GitHub npm package
  (`github:ken-revheat/design-tokens#<sha>`), consumed by Trend Finder, Lead
  Accelerator, Readiness, and QuotaFit.
- It already contains the canonical R favicon set and already exports `./assets/*`:
  - `assets/favicon/favicon.svg` — brand R, `#6143f9`, transparent bg
  - `assets/favicon/favicon-32.png`, `favicon-180.png`, `favicon-512.png`
  - It does **not** ship a `.ico`. Some apps (Trend Finder, Call Analyzer) currently
    reference `favicon.ico`.
- The package already has a `verify` script convention
  (`contrast-check.mjs`, `css-parse-check.mjs`) — the favicon verifier follows the
  same pattern.
- **Wrinkle:** apps pin `@revheat/design-tokens` to *different* commits (e.g.
  `3cc0312`, `68b2956`, `47627b1`). "Shared source" therefore means *each app is
  consistent with the version it pins*; getting the R everywhere requires bumping
  each app's pin as part of the rollout. The verifier keys on the favicon bundled in
  whatever version the app installs, so a pinned app cannot silently ship a non-R
  favicon.

## Architecture

Four cooperating pieces:

### 1. Canonical favicon (in `@revheat/design-tokens`)

The single source of truth is `assets/favicon/` in the package. Add a `.ico`
(multi-resolution, generated from the R) so `.ico`-based apps can reference the
package instead of a local copy. Nothing outside the package may define its own R.

### 2. Per-app wiring

Each app references the favicon from the installed package rather than a
self-authored file:

- **Nuxt apps** (Portal, Readiness `apps/portal`, Lead Accelerator `apps/portal`):
  point the `app.head.link` favicon entries at the package asset, and ensure the
  file served at `/favicon.*` comes from the package (copied at build from
  `node_modules/@revheat/design-tokens/assets/favicon/`, not hand-maintained in
  `public/`).
- **Vite/static apps** (Trend Finder): copy the package favicon into the build
  output and reference it from `index.html`; drop the stale local `favicon.ico`.
- **QuotaFit / Call Analyzer:** same pattern — reference the package favicon,
  remove the divergent local set.
- Bump each app's `@revheat/design-tokens` pin to the version that includes the
  `.ico` + verifier.

### 3. Auto-block verifier (in `@revheat/design-tokens`)

A new script shipped in the package (e.g. `verify-favicon.mjs`, exposed as an npm
`bin`, e.g. `revheat-verify-favicon`). Behavior:

- Computes the canonical hash(es) of the package's own `assets/favicon/` files at
  its installed version.
- Locates the favicon file(s) the consuming app will actually serve (build output /
  `public`), and byte-compares them to the canonical set.
- **Exit non-zero** (fails the build) if any required favicon is missing or does not
  match the canonical R.
- Each app invokes it in a build/prebuild/CI step so a non-R or missing favicon
  cannot deploy.

Deterministic decision (per operating discipline): the pass/fail rule is a byte/hash
comparison in code — no model call, no per-run judgment.

### 4. Branding & Style Standard + pre-build review gate

- A written **`BRANDING.md`** (RevHeat App Branding & Style Standard) in the
  `@revheat/design-tokens` repo — the distributed home every app already installs.
  Covers: brand color(s), type (Geist/Geist Mono), the shell, and the **favicon
  rule** (every app ships the canonical R; enforced by the verifier).
- A **pre-build checklist** section: before scaffolding a new app, an agent reviews
  the app plan against `BRANDING.md`, confirms it consumes the design-tokens shell +
  favicon + verifier, and reports a plain-English gap summary to Ken. Wired as a
  required step (skill / CLAUDE.md pointer) so it fires before any new app build.

## Data / control flow

```
@revheat/design-tokens (canonical R + verifier + BRANDING.md)
        │  installed as a pinned dependency
        ▼
   each app  ──build──►  copies package favicon into output
        │                    │
        │                    ▼
        └────────────►  revheat-verify-favicon  ──►  byte-match canonical?
                                                       ├─ yes → build proceeds
                                                       └─ no  → BUILD FAILS
```

## Error handling / edge cases

- **App doesn't consume the package** (e.g. a raw static app): the verifier is still
  runnable standalone (`npx @revheat/design-tokens ...` style) and can be added to
  its CI; documented in `BRANDING.md`.
- **`.ico` requested but not in an old pin:** rollout bumps every app's pin to the
  version that ships the `.ico`, so no app references a missing asset.
- **Verifier false-fail on path differences:** the verifier accepts the app's
  favicon output path(s) as arguments/config so each build system points it at the
  right served files.

## Testing / verification

- **Verifier unit behavior:** feed it a matching favicon (passes), a wrong image
  (fails), a missing file (fails).
- **Per-app:** build each app with the new wiring; confirm the verifier passes and
  the served `/favicon.*` is the R.
- **Live:** after deploy, load each live URL and confirm the R renders on the tab
  (`read_page`/headers, screenshot only as the single final visual check).

## Rollout order

1. `design-tokens`: add `.ico`, add verifier + `bin`, add `BRANDING.md`. Release
   (new commit/tag).
2. Wire + bump each app (Portal, Readiness, Trend Finder, ICP, Lead Accelerator,
   QuotaFit, Call Analyzer), one PR per repo, each with the verifier in its build.
3. Deploy + verify the R on each live tab.
4. Add the pre-build review gate pointer (skill / CLAUDE.md) so new apps inherit it.

## Open items for the plan

- Confirm each app's exact favicon output path + build hook for the verifier.
- Confirm Portal's repo of record (Nuxt `apps/portal` in the LA monorepo) and its
  deploy path (CF Pages).
- ICP currently has no shipped front-end app; apply the standard when its app lands.
