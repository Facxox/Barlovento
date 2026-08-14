import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx,json}',
  ],
  theme: {
    extend: {
      colors: {
        // Barlovento tokens — pulled from the actual logo, not generic defaults
        carbon: {
          DEFAULT: '#0B0B0B',   // fondo principal (carbón cálido)
          raised: '#1A1A1A',    // tarjetas en fondo negro
          line: '#262626',      // separadores suaves sobre carbón
        },
        cream: '#F5F1E6',       // superficies claras (alternativa al blanco clínico)
        gold: {
          DEFAULT: '#D4AF37',
          deep: '#C9A227',
          shadow: '#8C6F1A',
          light: '#E8C766',
        },
        ink: '#111111',
        bone: '#F5F5F0',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'ui-serif', 'Georgia', 'serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        'ultra': '0.35em',
      },
      maxWidth: {
        editorial: '64ch',
      },
      keyframes: {
        'gold-draw': {
          '0%':   { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '0.85' },
          '50%':      { opacity: '1' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-slide': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        'gold-draw': 'gold-draw 1.2s cubic-bezier(0.65, 0, 0.35, 1) forwards',
        'fade-up':   'fade-up 0.9s ease-out forwards',
        'soft-pulse': 'soft-pulse 3.5s ease-in-out infinite',
        'shimmer':   'shimmer 6s linear infinite',
        'shimmer-slide': 'shimmer-slide 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;