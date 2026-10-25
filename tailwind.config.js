/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#FAFAF8', 100: '#F3F4F1', 200: '#E9EBE6', 300: '#DADDD6' },
        lime: { 400: '#86DB63', 500: '#6CCF4F', 600: '#58B83C' },
        night: { 700: '#1B201D', 800: '#121614', 900: '#0A0C0B' },
        steel: { 200: '#CDD2D8' },
        forest: { 50: '#EEF6F1', 100: '#D5EADD', 200: '#A9D3B9', 300: '#74B892', 400: '#3F9A6B', 500: '#1F8A52', 600: '#176B40', 700: '#145536', 800: '#11432B', 900: '#111613' },
        emerald: { 400: '#34D399', 500: '#10B981', 600: '#059669' },
        amber: { 50: '#FFF8E6', 100: '#FDEBC0', 400: '#F2B33D', 500: '#E3A008', 600: '#B57F05', 700: '#8A5F00' },
        coral: { 50: '#FDF0EC', 100: '#FAD9CF', 400: '#EC8667', 500: '#E0663F', 600: '#C24E2A', 700: '#9A3B1D' },
        ink: { 900: '#1B2620', 700: '#3B4740', 500: '#5F6B64', 400: '#7D8781', 300: '#A9B0AB', 200: '#D7DBD5' },
      },
      fontFamily: {
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,38,32,0.04), 0 4px 16px -4px rgba(27,38,32,0.08)',
        lift: '0 2px 4px rgba(27,38,32,0.05), 0 12px 32px -8px rgba(27,38,32,0.16)',
      },
      borderRadius: { xl2: '0.625rem' },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulseRing: { '0%': { transform: 'scale(0.8)', opacity: 0.7 }, '100%': { transform: 'scale(2.2)', opacity: 0 } },
      },
      animation: {
        rise: 'rise 420ms cubic-bezier(.2,.7,.2,1) both',
        pulseRing: 'pulseRing 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
