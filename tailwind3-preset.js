/**
 * RevHeat design tokens — Tailwind 3 preset
 * (@revheat/design-tokens export `./tailwind3-preset`)
 *
 * Consumers: portal (Nuxt+TW3), LA web (TW3), CA (TW3).
 *
 * Usage in a consuming repo:
 *   // tailwind.config.js
 *   module.exports = {
 *     presets: [require('@revheat/design-tokens/tailwind3-preset')],
 *     content: [...],
 *   }
 *   // and import vars.css + fonts.css once in the app entry CSS:
 *   //   @import '@revheat/design-tokens/vars.css';
 *   //   @import '@revheat/design-tokens/fonts.css';
 *
 * TAILWIND FLOOR: >= 3.4 (program-pinned; the documented contract floor).
 * The color-mix() alpha mechanism below needs only >= 3.1 (color-mix is
 * Baseline 2023), but the program pins 3.4 — SYSTEM.md §7's score chip uses
 * the 3.4 min-w spacing scale, and every consumer repo is verified at
 * 3.4.19. Consumers below 3.4 are out of contract.
 *
 * Format decision (SYSTEM.md §11.2): tokens are FULL hex values in
 * vars.css. Opacity modifiers (`bg-primary/50`) are supported in TW3 via
 * color-mix() — Tailwind substitutes `<alpha-value>` textually, producing
 * e.g. `color-mix(in oklab, var(--rh-primary) calc(0.5 * 100%), transparent)`.
 * Tokens that never take alpha modifiers map as plain var() for zero cost.
 *
 * Every value below references a token that exists in vars.css — no literals.
 */

/** Wrap a CSS var so Tailwind opacity modifiers work on a full-value color. */
const withAlpha = (cssVar) =>
  `color-mix(in oklab, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`;

module.exports = {
  theme: {
    extend: {
      colors: {
        // surfaces / text / borders
        paper: 'var(--rh-bg)',
        surface: {
          DEFAULT: 'var(--rh-surface)',
          subtle: 'var(--rh-surface-subtle)',
        },
        ink: withAlpha('--rh-ink'), // ink takes alpha (scrims, disabled overlays)
        'text-secondary': 'var(--rh-text-secondary)',
        'text-muted': 'var(--rh-text-muted)',
        'text-disabled': 'var(--rh-text-disabled)',
        border: {
          DEFAULT: 'var(--rh-border)',
          strong: 'var(--rh-border-strong)',
          input: 'var(--rh-border-input)',
        },
        neutral: {
          50: 'var(--rh-n-50)',
          100: 'var(--rh-n-100)',
          200: 'var(--rh-n-200)',
          300: 'var(--rh-n-300)',
          400: 'var(--rh-n-400)',
          500: 'var(--rh-n-500)',
          600: 'var(--rh-n-600)',
          700: 'var(--rh-n-700)',
          800: 'var(--rh-n-800)',
          900: 'var(--rh-n-900)',
        },

        // primary + states (DEFAULT takes alpha for selection tints etc.)
        primary: {
          DEFAULT: withAlpha('--rh-primary'),
          hover: 'var(--rh-primary-hover)',
          active: 'var(--rh-primary-active)',
          subtle: 'var(--rh-primary-subtle)',
          border: 'var(--rh-primary-border)',
          foreground: 'var(--rh-primary-foreground)',
        },

        // status
        success: {
          DEFAULT: 'var(--rh-success)',
          hover: 'var(--rh-success-hover)',
          subtle: 'var(--rh-success-subtle)',
          border: 'var(--rh-success-border)',
          foreground: 'var(--rh-success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--rh-warning)',
          hover: 'var(--rh-warning-hover)',
          subtle: 'var(--rh-warning-subtle)',
          border: 'var(--rh-warning-border)',
          foreground: 'var(--rh-warning-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--rh-destructive)',
          hover: 'var(--rh-destructive-hover)',
          subtle: 'var(--rh-destructive-subtle)',
          border: 'var(--rh-destructive-border)',
          foreground: 'var(--rh-destructive-foreground)',
        },

        // heat ramp — data encoding only (policy lives in vars.css §6).
        // Solids only; the gradient is consumed via `bg-heat-gradient` below,
        // never re-derived from these stops.
        heat: {
          1: 'var(--rh-heat-1)',
          2: 'var(--rh-heat-2)',
          3: 'var(--rh-heat-3)',
          4: 'var(--rh-heat-4)',
          5: 'var(--rh-heat-5)',
        },
      },

      backgroundImage: {
        // the ONE sanctioned gradient — continuums only (dial arc, heat bar)
        'heat-gradient': 'var(--rh-heat-gradient)',
      },

      fontFamily: {
        sans: 'var(--rh-font-ui)',       // Geist (canonical, OFL — G1 font-EULA gate, 2026-07-09)
        display: 'var(--rh-font-display)',
        mono: 'var(--rh-font-mono)',
      },

      fontSize: {
        xs: ['var(--rh-text-xs)', 'var(--rh-leading-xs)'],
        sm: ['var(--rh-text-sm)', 'var(--rh-leading-sm)'],
        base: ['var(--rh-text-base)', 'var(--rh-leading-base)'],
        lg: ['var(--rh-text-lg)', 'var(--rh-leading-lg)'],
        xl: ['var(--rh-text-xl)', 'var(--rh-leading-xl)'],
        '2xl': ['var(--rh-text-2xl)', 'var(--rh-leading-2xl)'],
        '3xl': ['var(--rh-text-3xl)', 'var(--rh-leading-3xl)'],
        '4xl': ['var(--rh-text-4xl)', 'var(--rh-leading-4xl)'],
        stat: ['var(--rh-text-stat)', 'var(--rh-leading-stat)'], // big score numeral; pair with tabular-nums
      },

      // fontWeight: vars.css's weight scale (400/500/600/700) intentionally
      // equals Tailwind's default font-normal/medium/semibold/bold — no
      // override needed; that identity is part of the contract (the analog
      // of the spacing identity below). Nothing ships 800: font-extrabold
      // has no token and is out of contract.

      letterSpacing: {
        tight: 'var(--rh-tracking-tight)',
        wide: 'var(--rh-tracking-wide)',
      },

      // Spacing: vars.css's scale intentionally equals Tailwind's default
      // 4px-base rem scale, so p-4 / gap-6 etc. are already token-conformant.
      // No override needed — that identity is the contract.

      borderRadius: {
        xs: 'var(--rh-radius-xs)',
        sm: 'var(--rh-radius-sm)',
        md: 'var(--rh-radius-md)',   // buttons + inputs, always
        lg: 'var(--rh-radius-lg)',   // cards + panels, always
        full: 'var(--rh-radius-full)',
      },

      boxShadow: {
        // exactly two levels; no colored glows exist in the system
        1: 'var(--rh-shadow-1)',
        2: 'var(--rh-shadow-2)',
      },

      transitionDuration: {
        fast: 'var(--rh-duration-fast)',
        base: 'var(--rh-duration-base)',
        slow: 'var(--rh-duration-slow)',
      },

      transitionTimingFunction: {
        out: 'var(--rh-ease-out)',
        'in-out': 'var(--rh-ease-in-out)',
        in: 'var(--rh-ease-in)',
      },

      zIndex: {
        dropdown: 'var(--rh-z-dropdown)',
        sticky: 'var(--rh-z-sticky)',
        overlay: 'var(--rh-z-overlay)',
        modal: 'var(--rh-z-modal)',
        popover: 'var(--rh-z-popover)',
        toast: 'var(--rh-z-toast)',
      },
    },
  },
};
