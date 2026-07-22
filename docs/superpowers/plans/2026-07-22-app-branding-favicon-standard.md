# RevHeat App Branding Standard + R-Favicon Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every live RevHeat app serves the canonical RevHeat "R" favicon, pulled from one shared package, with a build-time check that fails any build shipping a missing or non-R favicon — plus a written branding standard + pre-build review gate.

**Architecture:** The `@revheat/design-tokens` package is the single source of truth for the favicon. It ships the R asset set (svg/ico/png) and a `revheat-favicon` CLI with two subcommands: `sync` (copy canonical favicons into an app's public dir) and `verify` (byte-compare an app's served favicons against canonical; exit non-zero on mismatch/missing). Each app gitignores its favicons and runs `sync && verify` at prebuild — so the ONLY way to get a passing build is to pull the R from the package. A `BRANDING.md` in the package documents the standard + agent-run pre-build review gate.

**Tech Stack:** Node 24 (built-in `node:test`, `node:crypto`, `node:fs`), `png-to-ico` (one-time, via npx) for the `.ico`. Apps: Nuxt (Portal, LA web, Call Analyzer), Next.js (Readiness, QuotaFit), Vite (Trend Finder).

## Global Constraints

- Canonical favicon source of truth: `@revheat/design-tokens` `assets/favicon/`. No app may author its own favicon.
- Brand primary: `#6143f9`. Favicon = the R mark (`assets/favicon/favicon.svg`), transparent background.
- The `verify` pass/fail decision is a byte/hash comparison in code — never a model call.
- Enforcement is auto-block: a missing or non-canonical favicon MUST fail the app build.
- Apps consume design-tokens as `github:ken-revheat/design-tokens#<sha>`; rollout bumps each app's pin to the release from Task 2.
- One PR per repo. Each app repo: branch off its `main`, never edit the shared checkout directly. Several apps have worktree/slice dupes under `~/projects` — only the canonical checkouts named below are in scope.
- Front-end polish only: no money/billing/entitlement/sales-logic changes in any task.
- **The `prebuild` hook only fires when the build runs via `npm run build`.** For each app, confirm its CI/deploy build command is `npm run build` (not a bare `nuxt build` / `next build` / `vite build`). If a deploy calls the bundler directly, prepend `revheat-favicon sync public && revheat-favicon verify public && ` to that deploy build command instead — otherwise the auto-block does not gate the real deploy. Verify this per app at Step 9.

## Canonical checkouts (verified)

| App | Canonical path | Build | Uses design-tokens |
|---|---|---|---|
| Portal (app.revheat.com) | `~/projects/lead accelerator/RevHeat-lead-accelerator/apps/portal` | Nuxt (SPA) | yes `#68b2956` |
| Lead Accelerator (web) | `~/projects/lead accelerator/RevHeat-lead-accelerator/apps/web` | Nuxt | yes `#68b2956` |
| QuotaFit | `~/projects/QuotaFit/quotafit-hire` | Next.js | yes `#47627b1` |
| Trend Finder | `~/projects/trend-finder` | Vite | yes `#3cc0312` |
| Readiness Audit | `~/projects/website-readiness-audit` (`packages/portal`) | Next.js | **no** |
| Call Analyzer | `~/projects/call analyzer/obedrevheat-call_analyzer_frontend_MVP` | Nuxt | **no** |
| ICP Builder | — no shipped front-end app — | — | deferred |

Design-tokens worktree for Task 1–2: `~/projects/design-tokens-branding` (branch `feat/app-branding-favicon-standard`, off `origin/main`).

---

## Task 1: Foundation — `.ico`, `revheat-favicon` CLI, `BRANDING.md` (in `@revheat/design-tokens`)

**Files:**
- Create: `~/projects/design-tokens-branding/assets/favicon/favicon.ico` (generated artifact, committed)
- Create: `~/projects/design-tokens-branding/bin/revheat-favicon.mjs`
- Create: `~/projects/design-tokens-branding/BRANDING.md`
- Modify: `~/projects/design-tokens-branding/package.json` (add `bin`, `files` entry, bump `version`)
- Test: `~/projects/design-tokens-branding/test/favicon.test.mjs`

**Interfaces:**
- Produces (CLI, consumed by every app task):
  - `revheat-favicon sync <publicDir>` — copies the canonical favicon set into `<publicDir>`; exit 0 on success.
  - `revheat-favicon verify <publicDir>` — exit 0 if every canonical-named file present in `<publicDir>` byte-matches canonical AND at least one primary (`favicon.svg` or `favicon.ico`) is present and matches; exit 1 (with a message naming the offending file) otherwise.
- Produces (module, for tests): `bin/revheat-favicon.mjs` exports `canonicalDir()`, `syncTo(dir)`, `verifyDir(dir)` (returns `{ok:boolean, errors:string[]}`).

- [ ] **Step 1: Generate the committed `.ico` from the existing PNGs**

Run (in the worktree):
```bash
cd ~/projects/design-tokens-branding
npx --yes png-to-ico assets/favicon/favicon-32.png assets/favicon/favicon-180.png assets/favicon/favicon-512.png > assets/favicon/favicon.ico
file assets/favicon/favicon.ico   # expect: "MS Windows icon resource"
```
Expected: `favicon.ico` created, `file` reports an icon resource with multiple images.

- [ ] **Step 2: Write the failing test**

Create `test/favicon.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalDir, syncTo, verifyDir } from '../bin/revheat-favicon.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'favtest-')); }

test('canonical set has the required files', () => {
  const files = readdirSync(canonicalDir());
  for (const f of ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'favicon-180.png', 'favicon-512.png']) {
    assert.ok(files.includes(f), `canonical missing ${f}`);
  }
});

test('sync then verify passes', () => {
  const d = tmp();
  syncTo(d);
  const r = verifyDir(d);
  assert.equal(r.ok, true, r.errors.join('; '));
  rmSync(d, { recursive: true, force: true });
});

test('verify fails on a tampered favicon', () => {
  const d = tmp();
  syncTo(d);
  writeFileSync(join(d, 'favicon.svg'), '<svg>not the R</svg>');
  const r = verifyDir(d);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('favicon.svg')));
  rmSync(d, { recursive: true, force: true });
});

test('verify fails when no primary favicon is present', () => {
  const d = tmp();
  // only a non-primary png present, no svg/ico
  copyFileSync(join(canonicalDir(), 'favicon-32.png'), join(d, 'favicon-32.png'));
  const r = verifyDir(d);
  assert.equal(r.ok, false);
  rmSync(d, { recursive: true, force: true });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
cd ~/projects/design-tokens-branding && node --test test/
```
Expected: FAIL — cannot resolve `../bin/revheat-favicon.mjs`.

- [ ] **Step 4: Write the CLI + module**

Create `bin/revheat-favicon.mjs`:
```js
#!/usr/bin/env node
import { readFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CANONICAL = ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'favicon-180.png', 'favicon-512.png'];
const PRIMARY = ['favicon.svg', 'favicon.ico'];

export function canonicalDir() {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'favicon');
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function syncTo(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const f of CANONICAL) copyFileSync(join(canonicalDir(), f), join(dir, f));
}

export function verifyDir(dir) {
  const errors = [];
  const canon = Object.fromEntries(CANONICAL.map(f => [f, sha256(join(canonicalDir(), f))]));
  const present = existsSync(dir) ? readdirSync(dir) : [];
  // Any canonical-named file that IS present must byte-match canonical.
  for (const f of CANONICAL) {
    if (present.includes(f) && sha256(join(dir, f)) !== canon[f]) {
      errors.push(`${f} does not match the canonical RevHeat favicon`);
    }
  }
  // At least one primary must be present and matching.
  const primaryOk = PRIMARY.some(f => present.includes(f) && sha256(join(dir, f)) === canon[f]);
  if (!primaryOk) errors.push(`no canonical primary favicon (${PRIMARY.join(' or ')}) found in ${dir}`);
  return { ok: errors.length === 0, errors };
}

function main() {
  const [cmd, dir] = process.argv.slice(2);
  if (!cmd || !dir || !['sync', 'verify'].includes(cmd)) {
    console.error('usage: revheat-favicon <sync|verify> <publicDir>');
    process.exit(2);
  }
  if (cmd === 'sync') { syncTo(dir); console.log(`revheat-favicon: synced R favicon → ${dir}`); return; }
  const r = verifyDir(dir);
  if (r.ok) { console.log(`revheat-favicon: ${dir} matches the canonical RevHeat R favicon`); return; }
  console.error('revheat-favicon: FAIL\n  - ' + r.errors.join('\n  - '));
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd ~/projects/design-tokens-branding && node --test test/
```
Expected: PASS — 4 tests pass.

- [ ] **Step 6: Wire `bin` + `files` + version in `package.json`**

In `~/projects/design-tokens-branding/package.json`:
- Add top-level: `"bin": { "revheat-favicon": "bin/revheat-favicon.mjs" }`
- Add `"bin"` and `"test"` dir to `files`: append `"bin"` and `"BRANDING.md"` to the `files` array.
- Bump `"version"` from `"1.0.0"` to `"1.1.0"`.
- Update the `verify` script to also run favicon tests:
  `"verify": "node contrast-check.mjs && node css-parse-check.mjs && node -e \"require('./tailwind3-preset.js')\" && node --test test/"`

- [ ] **Step 7: Write `BRANDING.md`**

Create `~/projects/design-tokens-branding/BRANDING.md`:
```markdown
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
```

- [ ] **Step 8: Run the full package verify**

Run:
```bash
cd ~/projects/design-tokens-branding && npm run verify
```
Expected: PASS — existing checks + 4 favicon tests all pass.

- [ ] **Step 9: Commit**

```bash
cd ~/projects/design-tokens-branding
git add assets/favicon/favicon.ico bin/revheat-favicon.mjs test/favicon.test.mjs BRANDING.md package.json
git commit -m "feat: R-favicon CLI (sync+verify), .ico, and app branding standard"
```

---

## Task 2: Release `@revheat/design-tokens` v1.1.0 (get a pin-able SHA)

**Files:** none (git/PR only, in `~/projects/design-tokens-branding`).

**Interfaces:**
- Produces: a merged `main` commit SHA on `github.com/ken-revheat/design-tokens` that app tasks pin to as `github:ken-revheat/design-tokens#<sha>`.

- [ ] **Step 1: Review before PR** — run the code-reviewer subagent on the Task 1 diff (per repo policy, non-trivial new logic). Address findings.
- [ ] **Step 2: Mark reviewed + push branch**
```bash
bash ~/.claude/scripts/claude-mark-reviewed.sh
cd ~/projects/design-tokens-branding && git push -u origin feat/app-branding-favicon-standard
```
- [ ] **Step 3: Open PR**, drive CI green.
```bash
gh pr create -R ken-revheat/design-tokens -t "R-favicon standard + verifier" -b "Canonical R favicon, sync/verify CLI, BRANDING.md. Foundation for app rollout." -H feat/app-branding-favicon-standard
```
- [ ] **Step 4: Hand Ken the merge** (his only gate). After merge, capture the SHA:
```bash
cd ~/projects/design-tokens-branding && git fetch origin main && git rev-parse origin/main
```
Record it as `<DT_SHA>` — used by every app task below.

---

## Task 3: Portal — wire favicon to package (`apps/portal`, Nuxt)

**Files (canonical checkout — branch off its `main` first):**
- Modify: `apps/portal/package.json` (bump design-tokens pin to `<DT_SHA>`, add prebuild)
- Modify: `apps/portal/nuxt.config.ts:16-18` (favicon head links)
- Modify: `apps/portal/.gitignore` (ignore synced favicons)
- Delete from git: `apps/portal/public/favicon.svg`, `favicon-32.png`, `favicon-180.png`, `favicon-512.png` (now synced, not committed)

**Interfaces:** Consumes `revheat-favicon` from `@revheat/design-tokens@<DT_SHA>`.

- [ ] **Step 1: Branch**
```bash
cd "$HOME/projects/lead accelerator/RevHeat-lead-accelerator"
git fetch origin && git worktree add -b feat/portal-r-favicon ../RH-la-portal-favicon origin/main
```
- [ ] **Step 2: Bump the pin** in `apps/portal/package.json`: set
  `"@revheat/design-tokens": "github:ken-revheat/design-tokens#<DT_SHA>"`.
- [ ] **Step 3: Add prebuild** to `apps/portal/package.json` `scripts`:
```json
"prebuild": "revheat-favicon sync public && revheat-favicon verify public",
```
(Nuxt's `build` runs `prebuild` automatically via npm lifecycle.)
- [ ] **Step 4: Point head links at synced files.** In `apps/portal/nuxt.config.ts` favicon `link` entries, ensure:
```ts
link: [
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon-180.png' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
]
```
- [ ] **Step 5: Gitignore synced favicons + remove committed copies**
```bash
cd ../RH-la-portal-favicon/apps/portal
printf '\n# synced from @revheat/design-tokens (do not edit)\npublic/favicon.svg\npublic/favicon.ico\npublic/favicon-32.png\npublic/favicon-180.png\npublic/favicon-512.png\n' >> .gitignore
git rm --cached public/favicon.svg public/favicon-32.png public/favicon-180.png public/favicon-512.png 2>/dev/null || true
```
- [ ] **Step 6: Install + build (proves sync+verify gate the build)**
```bash
cd ../RH-la-portal-favicon/apps/portal && npm install && npm run build
```
Expected: `revheat-favicon: synced …` then `… matches the canonical RevHeat R favicon`, then Nuxt build succeeds; `.output/public/favicon.svg` is the R.
- [ ] **Step 7: Prove the gate bites** (negative test)
```bash
echo 'x' > public/favicon.svg && npm run build; echo "exit=$?"
git checkout -- public/favicon.svg 2>/dev/null; rm -f public/favicon.svg
```
Expected: build FAILS at `revheat-favicon verify` naming `favicon.svg`; `exit` non-zero. (Then re-sync restores it.)
- [ ] **Step 8: Review, commit, PR** (code-reviewer subagent → mark-reviewed → commit → PR to `ken-revheat/lead-accelerator`). Hand Ken the merge.
- [ ] **Step 9: Deploy + verify** — deploy Portal (app.revheat.com, CF Pages) via its canonical path; then load `https://app.revheat.com`, confirm `/favicon.svg` served is the R (headers/`read_page`; one screenshot as final visual check).

---

## Task 4: Lead Accelerator web — wire favicon to package (`apps/web`, Nuxt)

**Files (same monorepo/checkout as Task 3):**
- Modify: `apps/web/package.json` (pin `<DT_SHA>`, add `prebuild`)
- Modify: `apps/web/nuxt.config.ts:52` (replace `favicon.png` link with the R set)
- Modify: `apps/web/.gitignore`
- Delete from git: `apps/web/public/favicon.png`, `apps/web/public/favicon.ico`

- [ ] **Step 1: Branch** (own worktree)
```bash
cd "$HOME/projects/lead accelerator/RevHeat-lead-accelerator"
git worktree add -b feat/la-web-r-favicon ../RH-la-web-favicon origin/main
```
- [ ] **Step 2:** Bump `apps/web/package.json` design-tokens pin to `<DT_SHA>`.
- [ ] **Step 3:** Add `"prebuild": "revheat-favicon sync public && revheat-favicon verify public"` to `apps/web/package.json` scripts.
- [ ] **Step 4:** In `apps/web/nuxt.config.ts`, replace the `favicon.png` link (line ~52) with:
```ts
{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
{ rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon-180.png' },
{ rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
```
- [ ] **Step 5:** Gitignore synced favicons; `git rm --cached public/favicon.png public/favicon.ico`.
- [ ] **Step 6:** `cd ../RH-la-web-favicon/apps/web && npm install && npm run build` — expect sync+verify pass, build ok, `.output/public/favicon.svg` is the R.
- [ ] **Step 7:** Negative test (as Task 3 Step 7).
- [ ] **Step 8:** Review → commit → PR (`ken-revheat/lead-accelerator`). Hand Ken the merge.
- [ ] **Step 9:** Deploy + verify LA web on its live URL (CF Pages); confirm R on tab.

---

## Task 5: QuotaFit — wire favicon to package (Next.js)

**Files:**
- Modify: `package.json` (pin `<DT_SHA>`, add `prebuild`)
- Modify: `src/app/layout.tsx:8-13` (`metadata.icons` → R set)
- Modify: `.gitignore`
- Delete from git: `public/favicon.svg`, `public/favicon-32.png`, `public/favicon-512.png`, `public/apple-touch-icon.png`

- [ ] **Step 1: Branch**
```bash
cd ~/projects/QuotaFit/quotafit-hire && git fetch origin && git worktree add -b feat/quotafit-r-favicon ../qf-r-favicon origin/main
```
- [ ] **Step 2:** Bump design-tokens pin to `<DT_SHA>` in `package.json`.
- [ ] **Step 3:** Add to `package.json` scripts: `"prebuild": "revheat-favicon sync public && revheat-favicon verify public"`. (Next's `build` triggers npm `prebuild`.)
- [ ] **Step 4:** Set `metadata.icons` in `src/app/layout.tsx` to reference the synced files:
```ts
icons: {
  icon: [
    { url: '/favicon.svg', type: 'image/svg+xml' },
    { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
  ],
  apple: '/favicon-180.png',
},
```
(Remove the old `apple-touch-icon.png` / `favicon-512` references.)
- [ ] **Step 5:** Gitignore synced favicons; `git rm --cached public/favicon.svg public/favicon-32.png public/favicon-512.png public/apple-touch-icon.png`. Add `public/favicon-180.png` to the synced set (now provided by the package).
- [ ] **Step 6:** `cd ../qf-r-favicon && npm install && npm run build` — expect sync+verify pass, `next build` ok.
- [ ] **Step 7:** Negative test (as Task 3 Step 7, targeting `public/favicon.svg`).
- [ ] **Step 8:** Review → commit → PR (`ken-revheat/quotafit-hire`). Hand Ken the merge.
- [ ] **Step 9:** Deploy + verify on QuotaFit's live URL; confirm R on tab. (Confirm deploy path at execution.)

---

## Task 6: Trend Finder — add R favicon + `<link>` (Vite)

**Files:**
- Modify: `package.json` (pin `<DT_SHA>`, add `prebuild`)
- Modify: `index.html` (add `<link rel="icon">`)
- Modify: `.gitignore`
- Delete from git: `public/favicon.ico` (default, unbranded)

- [ ] **Step 1: Branch**
```bash
cd ~/projects/trend-finder && git fetch origin && git worktree add -b feat/tf-r-favicon ../tf-r-favicon origin/main
```
- [ ] **Step 2:** Bump design-tokens pin to `<DT_SHA>` in `package.json`.
- [ ] **Step 3:** Add to `package.json` scripts: `"prebuild": "revheat-favicon sync public && revheat-favicon verify public"`. (Vite `build` triggers npm `prebuild`.)
- [ ] **Step 4:** In `index.html` `<head>`, add:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png" />
```
- [ ] **Step 5:** Gitignore synced favicons; `git rm --cached public/favicon.ico`.
- [ ] **Step 6:** `cd ../tf-r-favicon && npm install && npm run build` — expect sync+verify pass, `vite build` ok, `dist/favicon.svg` + `dist/favicon.ico` are the R.
- [ ] **Step 7:** Negative test (target `public/favicon.ico`).
- [ ] **Step 8:** Review → commit → PR (`ken-revheat/trend-finder`). Hand Ken the merge.
- [ ] **Step 9:** Deploy + verify on Trend Finder's live URL; confirm R on tab. (Confirm deploy path at execution.)

---

## Task 7: Readiness Audit — add design-tokens + favicon (Next.js spike)

**Files:**
- Modify: `packages/portal/package.json` (add design-tokens dep `<DT_SHA>`, add `prebuild`)
- Modify: `packages/portal/src/app/layout.tsx:3-6` (add `metadata.icons`)
- Create: `packages/portal/public/` (favicons synced here; gitignored)
- Modify: `packages/portal/.gitignore`

- [ ] **Step 1: Branch**
```bash
cd ~/projects/website-readiness-audit && git fetch origin && git worktree add -b feat/readiness-r-favicon ../wra-r-favicon origin/main
```
- [ ] **Step 2:** Add dependency to `packages/portal/package.json`:
  `"@revheat/design-tokens": "github:ken-revheat/design-tokens#<DT_SHA>"`.
- [ ] **Step 3:** Add to `packages/portal/package.json` scripts:
  `"prebuild": "revheat-favicon sync public && revheat-favicon verify public"`.
- [ ] **Step 4:** Add `icons` to the exported `metadata` in `packages/portal/src/app/layout.tsx`:
```ts
icons: {
  icon: [
    { url: '/favicon.svg', type: 'image/svg+xml' },
    { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
  ],
  apple: '/favicon-180.png',
},
```
- [ ] **Step 5:** Create `.gitignore` entries in `packages/portal/.gitignore` for the synced favicon files (svg/ico/32/180/512).
- [ ] **Step 6:** `cd ../wra-r-favicon/packages/portal && npm install && npm run build` — expect sync creates `public/`, verify passes, `next build` ok.
- [ ] **Step 7:** Negative test (target `public/favicon.svg`).
- [ ] **Step 8:** Review → commit → PR (`ken-revheat/website-readiness-audit`). Hand Ken the merge.
- [ ] **Step 9:** Deploy + verify — Readiness deploys via `deploy/deploy.sh` (18.220.192.215, us-east-2); confirm R on the live tab.

---

## Task 8: Call Analyzer — add design-tokens + favicon (Nuxt)

**Files:**
- Modify: `package.json` (add design-tokens dep `<DT_SHA>`, add `prebuild`)
- Modify: `nuxt.config.ts` (add favicon head links)
- Modify: `.gitignore`
- Delete from git: `public/favicon.ico` (default, unbranded)

- [ ] **Step 1: Branch**
```bash
cd "$HOME/projects/call analyzer/obedrevheat-call_analyzer_frontend_MVP" && git fetch origin && git worktree add -b feat/ca-r-favicon ../ca-r-favicon origin/main
```
- [ ] **Step 2:** Add `"@revheat/design-tokens": "github:ken-revheat/design-tokens#<DT_SHA>"` to `package.json` dependencies.
- [ ] **Step 3:** Add to `package.json` scripts: `"prebuild": "revheat-favicon sync public && revheat-favicon verify public"`.
- [ ] **Step 4:** In `nuxt.config.ts` `app.head.link`, add:
```ts
{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
{ rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon-180.png' },
{ rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
```
- [ ] **Step 5:** Gitignore synced favicons; `git rm --cached public/favicon.ico`.
- [ ] **Step 6:** `cd ../ca-r-favicon && npm install && npm run build` — expect sync+verify pass, Nuxt build ok, `.output/public/favicon.svg` is the R.
- [ ] **Step 7:** Negative test (target `public/favicon.ico`).
- [ ] **Step 8:** Review → commit → PR (`ken-revheat/call_analyzer_frontend_MVP`). Hand Ken the merge.
- [ ] **Step 9:** Deploy + verify on Call Analyzer's live URL; confirm R on tab. (Confirm deploy path at execution.)

---

## Task 9: Pre-build review gate pointer + close-out

**Files:**
- Modify: `~/.claude/CLAUDE.md` (or the app-scaffolding skill) — add a one-line pointer to the branding gate.

- [ ] **Step 1:** Add a "before building any new RevHeat app" pointer that references `@revheat/design-tokens/BRANDING.md` and requires the agent-run review (depends on design-tokens, wires `revheat-favicon sync && verify`, uses package color/type/shell) before scaffolding. Report a plain-English gap summary to Ken.
- [ ] **Step 2:** Verify all seven live apps (six + ICP-deferred noted) show the R on their live tabs; write a one-line status per app.
- [ ] **Step 3:** Record ICP deferral: standard applies when the ICP front-end app lands (trigger = ICP app scaffolding).

---

## Self-review notes

- **Spec coverage:** canonical favicon (Task 1) ✓; per-app wiring from shared package (Tasks 3–8) ✓; auto-block verifier (Task 1 + each app's prebuild + negative test) ✓; BRANDING.md + pre-build gate (Task 1 Step 7, Task 9) ✓; all live apps (Tasks 3–8; ICP deferred with trigger) ✓; deploy+verify each (each Task Step 9) ✓; `.ico` gap (Task 1 Step 1) ✓; pin-bump wrinkle (Task 2 `<DT_SHA>` threaded through) ✓.
- **Deploy-path unknowns** (QuotaFit, Trend Finder, Call Analyzer) are flagged to confirm at execution — Portal (CF Pages) and Readiness (`deploy/deploy.sh`) are known.
- **Consistency:** `revheat-favicon sync/verify` names, the five canonical filenames, and `<DT_SHA>` are used identically across all tasks.
