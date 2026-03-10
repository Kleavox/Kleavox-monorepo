// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{vue,js,ts,jsx,tsx}',
    './nuxt.config.ts',
  ],
  theme: {
    extend: {
      colors: {
        void: '#080808',
        carbon: '#111111',
        ash: '#1a1a1a',
        smoke: '#2a2a2a',
        mist: '#3a3a3a',
        ghost: '#6b6b6b',
        silver: '#a0a0a0',
        snow: '#f0f0f0',
        signal: {
          DEFAULT: '#ff2d2d',
          dim: '#8b1a1a',
        },
        live: {
          DEFAULT: '#00ff87',
          dim: '#004d29',
        }
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        widest2: '0.3em',
        widest3: '0.5em',
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker': 'flicker 4s linear infinite',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flicker: {
          '0%, 95%, 100%': { opacity: '1' },
          '96%': { opacity: '0.8' },
          '97%': { opacity: '1' },
          '98%': { opacity: '0.6' },
          '99%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
