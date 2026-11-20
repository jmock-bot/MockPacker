/** @type {import('tailwindcss').Config} */

// Every value here resolves to a CSS variable defined in src/index.css, which
// is the single source of truth for the design tokens. Variables hold
// space-separated RGB channels so opacity modifiers (bg-accent/15) work.
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    // Type — FOUR sizes, and only four. `fontSize` is replaced, not extended,
    // so Tailwind's default text-xs / text-sm / text-xl scale does not exist:
    // reaching for a fifth size produces no CSS instead of a quiet drift.
    // Contrast comes from weight, tracking and whitespace, not from a ladder
    // of in-between sizes.
    //   display — the ONE dominant element on a screen (3x body; capped at 13vw so
    //             a scaled-up numeral can never outgrow the viewport)
    //   body    — everything you read (16px floor, scales with system text size)
    //   label   — controls, metadata with weight
    //   caption — quiet supporting text (12px floor)
    fontSize: {
      display: ['min(3rem, 13vw)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
      body: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
      label: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.01em', fontWeight: '600' }],
      caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em', fontWeight: '500' }],
    },
    // Elevation — two planes carry shadow. `content` is soft and diffuse with
    // a lit top edge; `controls` is higher and tighter. Nothing else casts one.
    boxShadow: {
      content: 'var(--shadow-content), var(--edge-highlight)',
      controls: 'var(--shadow-controls), var(--edge-highlight)',
      none: 'none',
    },
    // Stacking — one named layer per plane, plus overlay and toast above them.
    zIndex: {
      0: '0',
      canvas: '0',
      content: '10',
      controls: '30',
      chrome: '40',
      overlay: '50',
      toast: '100',
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: token('--color-text'),
          soft: token('--color-text-muted'),
          faint: token('--color-text-faint'),
        },
        // Canvas base color (the fixed gradient layer paints over it).
        paper: token('--color-bg'),
        cream: token('--color-surface-alt'),
        card: token('--color-surface'),
        line: token('--color-border'),
        'line-strong': token('--color-border-strong'),
        // Form-control edges only (WCAG 1.4.11, 3:1).
        'line-control': token('--color-border-control'),
        // The ONE interaction color. Means "you can tap this", nothing else.
        accent: {
          DEFAULT: token('--color-accent'),
          hover: token('--color-accent-hover'),
          pressed: token('--color-accent-pressed'),
          tint: token('--color-accent-tint'),
        },
        'on-accent': token('--color-on-accent'),
        // Semantic state colors — the only other hues.
        success: token('--color-success'),
        warning: token('--color-warning'),
        danger: token('--color-danger'),
      },
      fontFamily: {
        // Inter, self-hosted (src/index.css), precached in public/sw.js.
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      transitionDuration: {
        press: 'var(--dur-press)',
        reveal: 'var(--dur-reveal)',
        surface: 'var(--dur-surface)',
        transit: 'var(--dur-transit)',
      },
      // Ease-out only. No spring, no bounce.
      transitionTimingFunction: {
        press: 'var(--ease-press)',
        decelerate: 'var(--ease-decelerate)',
        accelerate: 'var(--ease-accelerate)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Skeletons breathe in opacity only — a functional loading cue.
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--dur-reveal) var(--ease-decelerate)',
        'scale-in': 'scale-in var(--dur-surface) var(--ease-decelerate)',
        'toast-in': 'toast-in var(--dur-surface) var(--ease-decelerate)',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
