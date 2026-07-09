# @revheat/design-tokens

The runtime distribution of the RevHeat design system: one set of design
tokens consumed identically by every RevHeat surface (portal + Vault, Call
Analyzer, Lead Accelerator, QuotaFit, Ask RevHeat, one-off pages).

**Source of truth:** `SYSTEM.md` in the design repo
(`revheat-design-system/01-system/`) is the design contract — every value
here was decided there. This package is the contract's runtime artifact; the
design repo remains the design record. Token changes land here only via the
design contract, and every change must pass the contrast gate (below).

## What's in the box

| Export | Contents |
|---|---|
| `@revheat/design-tokens/tailwind3-preset` | Tailwind 3 preset (JS) mapping tokens into `theme.extend` |
| `@revheat/design-tokens/tailwind4.css` | Tailwind 4 CSS-first `@theme inline` file (imports `vars.css` itself) |
| `@revheat/design-tokens/vars.css` | THE token source — plain CSS custom properties (`--rh-*`) |
| `@revheat/design-tokens/fonts.css` | Canonical `@font-face` set (Geist 400–700, Geist Mono 400–600, self-hosted woff2 under `./fonts/`) |
| `@revheat/design-tokens/assets/*` | Brand assets: wordmark + icon SVGs, favicon set |

There is **no build step** — the committed files are the dist (plain CSS, JS,
woff2), per the proven `@revheat/*` git-dependency recipe.

## Install

```sh
npm i git+https://github.com/ken-revheat/design-tokens.git#<sha>
```

Pin a SHA per the adoption PR; never track a branch.

## Consumption

### Tailwind 3 repos (portal, LA web, CA) — **requires Tailwind >= 3.4**

The documented Tailwind floor for this package is **3.4** (program-pinned).
The preset's `color-mix()` alpha mechanism only needs >= 3.1, but the system
uses 3.4 features (e.g. the `min-w` spacing scale) and all consumer repos are
verified at 3.4.19 — consumers below 3.4 are out of contract.

```js
// tailwind.config.js
module.exports = {
  presets: [require('@revheat/design-tokens/tailwind3-preset')],
  content: [/* ... */],
};
```

```css
/* app entry CSS — import both, once */
@import '@revheat/design-tokens/vars.css';
@import '@revheat/design-tokens/fonts.css';
```

Opacity modifiers (`bg-primary/50`) work via the preset's `color-mix()`
wrapper (Baseline 2023). Where an alpha modifier would be load-bearing,
prefer the shipped state/subtle variant token instead.

### Tailwind 4 repos (QuotaFit)

```css
/* global CSS */
@import "tailwindcss";
@import "@revheat/design-tokens/tailwind4.css";  /* imports vars.css itself */
@import "@revheat/design-tokens/fonts.css";
```

Opacity modifiers are TW4-native. Durations/z-index have no `@theme`
namespace — consume the `--rh-*` vars directly or via arbitrary values.

### Plain CSS (framework-independent: Ask RevHeat browser surface, one-off pages, charts)

```css
@import "@revheat/design-tokens/vars.css";
@import "@revheat/design-tokens/fonts.css";

.card {
  background: var(--rh-surface);
  border: 1px solid var(--rh-border);
  border-radius: var(--rh-radius-lg);
  font-family: var(--rh-font-ui);
}
```

### Identity contracts (both Tailwind majors)

- **Spacing:** the `--rh-space-*` scale intentionally equals Tailwind's
  default 4px-base rem scale — `p-4` / `gap-6` are token-conformant with no
  override. That identity is part of the contract.
- **Font weights:** 400/500/600/700 equals Tailwind's default
  `font-normal/medium/semibold/bold` — no override. Nothing ships 800.

## Verify (the package gate)

```sh
npm run verify
# = node contrast-check.mjs            (AA contrast pairs + no-flat-grey gate; exits 1 on any failure)
#   && node -e "require('./tailwind3-preset.js')"   (preset loads)
```

The same two commands run in CI (`.github/workflows/verify.yml`) on every
push/PR. Any token edit that breaks a contrast pair or introduces a flat
(zero-chroma) grey neutral fails the build.

### Install-verify (run in a consumer before pinning a SHA)

```sh
npm i git+https://github.com/ken-revheat/design-tokens.git#<sha>
node -e "console.log(require.resolve('@revheat/design-tokens/tailwind3-preset'))"
node -e "require('@revheat/design-tokens/tailwind3-preset')"
ls node_modules/@revheat/design-tokens/{vars.css,fonts.css,fonts,assets}
```

All four must succeed before the SHA is pinned in the consumer's adoption PR.

## Fonts

Geist (UI face) and Geist Mono (numeric second register) are self-hosted
woff2, shipped inside the package, `font-display: swap`. No CDN fonts. Both
are SIL OFL 1.1 (Vercel) — full license text in `fonts/OFL.txt`.

**Subsetting status: deferred.** The shipped files are the vendor's full web
cuts from npm `geist@1.7.2` (≈45–52 KB each) — not re-subset. At package
build no clean non-python subsetting CLI was available (`hb-subset`,
`woff2_compress`, `glyphhanger` absent; python tooling is barred in this
environment), so the full cuts ship as-is rather than hacking a pipeline.
The `unicode-range` declarations in `fonts.css` scope the UI faces to latin
usage; they do not imply the files are latin-only. Latin subsetting remains
open — do it with `hb-subset` (harfbuzz) when tooling lands, then update the
`fonts.css` comments and this section.

## License

- Package code (CSS/JS/config): **MIT** — see `LICENSE`.
- Font files (`fonts/*.woff2`): **SIL Open Font License 1.1**, copyright
  Vercel in collaboration with basement.studio — see `fonts/OFL.txt`.
- Brand assets (`assets/*`): RevHeat brand property; distribution inside
  RevHeat products only.
