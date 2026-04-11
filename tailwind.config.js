/** @type {import('tailwindcss').Config} */
module.exports = {
  plugins: [
    function motionReducePlugin({ addVariant }) {
      addVariant('motion-reduce', '@media (prefers-reduced-motion: reduce)');
    },
  ],
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '1200px',
      },
      backgroundColor: {
        primary: '#FFFFFF',
        secondary: '#F8FAFC',
        tertiary: '#F1F5F9',
        dark: '#0F172A',
      },
      textColor: {
        primary: '#0F172A',
        secondary: '#475569',
        tertiary: '#94A3B8',
        inverse: '#FFFFFF',
      },
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
      },
      boxShadow: {
        elevated: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
      },
    },
  },
  darkMode: 'class',
};
