/** @type {import('tailwindcss').Config} */

// Semantic colors resolve to CSS variables defined in src/index.css.
// Variables hold space-separated RGB channels so Tailwind opacity modifiers
// (e.g. bg-maroon/15) work via rgb(var(--x) / <alpha-value>).
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Class strategy: dark: variants track the .dark class on <html>, matching
  // the CSS-variable palette flip in src/index.css. ThemeContext toggles the
  // class from the user's light/dark/system preference.
  darkMode: 'class',
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
        'line-strong': token('--color-border-strong'),
        // Form-control edges only. Decorative dividers carry no contrast
        // requirement; an input's visible boundary does (WCAG 1.4.11, 3:1).
        'line-control': token('--color-border-control'),
        // Brand accent (confident teal)
        maroon: {
          DEFAULT: token('--color-accent'),
          soft: token('--color-accent-hover'),
          deep: token('--color-accent-deep'),
          tint: token('--color-accent-soft'),
        },
        // Text/icons that sit on the accent (flips to near-black in dark).
        'on-accent': token('--color-on-accent'),
        // Semantic state colors, so components stop hard-coding Tailwind's
        // rose/amber/emerald palettes and recolor correctly in dark mode.
        success: token('--color-success'),
        warning: token('--color-warning'),
        danger: token('--color-danger'),
      },
      fontFamily: {
        // Inter is now actually loaded — self-hosted variable woff2, declared in
        // src/index.css, precached in public/sw.js. It leads the stack so the
        // type scale's optical letter-spacing (-0.021em on display sizes) is
        // applied to the face it was tuned for rather than to whatever system
        // UI font the OS happens to supply.
        //
        // Satoshi is kept ahead of it for anyone who licenses and self-hosts it
        // later: drop the woff2 in public/fonts/, add an @font-face block, and
        // it takes over with no other change.
        sans: [
          'Satoshi',
          'Inter',
          'SF Pro Text',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      // Nine-step scale: [size, { lineHeight, letterSpacing, fontWeight }].
      // Headings tighten as they grow; small text opens up slightly.
      fontSize: {
        'display-lg': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.021em', fontWeight: '700' }],
        display: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.019em', fontWeight: '700' }],
        'title-lg': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.013em', fontWeight: '700' }],
        title: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.009em', fontWeight: '600' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.625rem', letterSpacing: '0' }],
        body: ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '0' }],
        label: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.006em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em', fontWeight: '500' }],
        overline: ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.06em', fontWeight: '700' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        // Existing alias — every `rounded-card` in the app picks up the new
        // 20px card radius without a find-and-replace.
        card: 'var(--radius-lg)',
      },
      boxShadow: {
        e1: 'var(--e1)',
        e2: 'var(--e2)',
        e3: 'var(--e3)',
        // Existing aliases, remapped onto the new scale.
        card: 'var(--e1)',
        raised: 'var(--e3)',
      },
      transitionDuration: {
        press: 'var(--dur-press)',
        reveal: 'var(--dur-reveal)',
        surface: 'var(--dur-surface)',
        transit: 'var(--dur-transit)',
      },
      transitionTimingFunction: {
        press: 'var(--ease-press)',
        decelerate: 'var(--ease-decelerate)',
        accelerate: 'var(--ease-accelerate)',
        spring: 'var(--ease-spring)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-10px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Skeletons pulse rather than shimmer — a sweeping gradient reads as
        // decorative; a soft opacity breath reads as "content is coming".
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--dur-reveal) var(--ease-decelerate)',
        'scale-in': 'scale-in var(--dur-surface) var(--ease-decelerate)',
        'toast-in': 'toast-in var(--dur-surface) var(--ease-spring)',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
