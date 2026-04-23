/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b1b9c9',
          400: '#8993a9',
          500: '#69748d',
          600: '#535d75',
          700: '#444c60',
          800: '#3a4051',
          900: '#1f2330',
          950: '#13161f',
        },
        brand: {
          50:  '#eefdf6',
          100: '#d5fbe9',
          200: '#aef5d4',
          300: '#76eab5',
          400: '#3ad591',
          500: '#16bb74',
          600: '#0a995c',
          700: '#0a784c',
          800: '#0c5f3f',
          900: '#0c4e35',
          950: '#022b1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'soft': '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(15 23 42 / 0.06)',
        'glow': '0 0 0 1px rgb(22 187 116 / 0.3), 0 6px 30px rgb(22 187 116 / 0.18)',
      },
    },
  },
  plugins: [],
};
