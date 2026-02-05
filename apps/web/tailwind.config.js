/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canaris: {
          950: '#071222',
          900: '#0a1628',
          800: '#0f2035',
          700: '#162d4a',
          600: '#1e3a5f',
          500: '#2a5080',
          400: '#3a6b9f',
          300: '#5c8dbd',
          200: '#8ba3c1',
          100: '#c3d4e6',
          50: '#e6edf5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
