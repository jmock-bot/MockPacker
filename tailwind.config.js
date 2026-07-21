/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Charcoal text scale
        ink: {
          DEFAULT: '#26222b',
          soft: '#4a4550',
          faint: '#7c7681',
        },
        // Warm white / cream surfaces
        paper: '#faf7f2',
        cream: '#f3ecdf',
        card: '#ffffff',
        line: '#e8e2d7',
        // Brand: deep maroon
        maroon: {
          DEFAULT: '#6e1423',
          soft: '#8a2434',
          deep: '#4e0d18',
          tint: '#f7e9ec',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(38, 34, 43, 0.08), 0 1px 2px rgba(38, 34, 43, 0.04)',
        raised: '0 6px 24px rgba(38, 34, 43, 0.14)',
      },
    },
  },
  plugins: [],
};
