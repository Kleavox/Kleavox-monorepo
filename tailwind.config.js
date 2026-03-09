/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        // Dark cinematic palette
        void: '#080808',
        carbon: '#111111',
        ash: '#1a1a1a',
        smoke: '#2a2a2a',
        mist: '#3a3a3a',
        ghost: '#6b6b6b',
        silver: '#a0a0a0',
        snow: '#f0f0f0',
        // Accent — cold electric red
        signal: {
          DEFAULT: '#ff2d2d',
          dim: '#8b1a1a',
          glow: 'rgba(255, 45, 45, 0.15)',
        },
        live: {
          DEFAULT: '#00ff87',
          dim: '#004d29',
          glow: 'rgba(0, 255, 135, 0.15)',
        },
      },
      letterSpacing: {
        widest2: '0.3em',
        widest3: '0.5em',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker': 'flicker 4s linear infinite',
        'scan': 'scan 8s linear infinite',
        'fade-up': 'fadeUp 0.6s ease forwards',
      },
      keyframes: {
        flicker: {
          '0%, 95%, 100%': { opacity: '1' },
          '96%': { opacity: '0.8' },
          '97%': { opacity: '1' },
          '98%': { opacity: '0.6' },
          '99%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
