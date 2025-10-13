/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6D5BFF',
        dark: '#0F172A',
        accent: '#22d3ee'
      }
    }
  },
  plugins: []
};
