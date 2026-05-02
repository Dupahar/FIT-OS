/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#0D1117',
          muted: 'rgba(255,255,255,0.45)',
          active: 'rgba(255,255,255,0.95)',
        },
        accent: {
          green: '#00B894',
          blue: '#0984E3',
          amber: '#F39C12',
          red: '#E74C3C',
          frozen: '#185FA5',
        },
        surface: '#F8F9FA',
        border: 'rgba(0,0,0,0.08)',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
}
