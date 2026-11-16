/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Cairo', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 950: '#090D16', 900: '#0F1522', 850: '#141B2B', 800: '#1C2436', 700: '#2A3449' },
      },
    },
  },
  plugins: [],
};
