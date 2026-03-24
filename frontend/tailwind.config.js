/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './context/**/*.{js,ts,jsx,tsx}',
    './modals/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom dark palette used by Sessions/Inbox pages
        dark: {
          50:  '#f8f8fc',
          100: '#e8e8f0',
          200: '#c8c8d8',
          300: '#a0a0b8',
          400: '#6b6b8a',
          500: '#4a4a6a',
          600: '#33334f',
          700: '#222238',
          800: '#16162a',
          900: '#0d0d1a',
          950: '#07070f',
        },
      },
    },
  },
  plugins: [],
};
