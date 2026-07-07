import tailwindAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0a0b0d',
          900: '#101114',
          850: '#15171b',
          800: '#1b1e23',
          700: '#25292f',
          600: '#33383f',
          400: '#8a919c',
          200: '#d7dbe0',
        },
        accent: {
          DEFAULT: '#6c8cff',
          soft: '#4a5f99',
        },
        critical: '#ff5c5c',
        high: '#ff9f43',
        moderate: '#f4d35e',
        low: '#5fd88f',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [tailwindAnimate],
};
