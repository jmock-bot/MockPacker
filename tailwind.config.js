/** @type {import('tailwindcss').Config} */

// Semantic colors resolve to CSS variables defined in src/index.css.
// Variables hold space-separated RGB channels so Tailwind opacity modifiers
// (e.g. bg-maroon/15) work via rgb(var(--x) / <alpha-value>).
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Media strategy: dark: variants track prefers-color-scheme, matching the
  // CSS-variable palette flip in src/index.css.
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Charcoal text scale
        ink: {
          DEFAULT: token('--color-text'),
          soft: token('--color-text-muted'),
          faint: token('--color-text-faint'),
        },
        // Warm white / cream surfaces
        paper: token('--color-bg'),
        cream: token('--color-surface-alt'),
        card: token('--color-surface'),
        line: token('--color-border'),
        // Brand accent (confident teal)
        maroon: {
          DEFAULT: token('--color-accent'),
          soft: token('--color-accent-hover'),
          deep: token('--color-accent-deep'),
          tint: token('--color-accent-soft'),
        },
        // Text/icons that sit on the accent (flips to near-black in dark).
        'on-accent': token('--color-on-accent'),
      },
      fontFamily: {
        sans: [
          'SF Pro Text',
          '-apple-system',
          'BlinkMacSystemFont',
          'Satoshi',
          'Inter',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-float)',
      },
    },
  },
  plugins: [],
};
