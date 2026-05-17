/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.rs", "./index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "Consolas", "monospace"],
      },
      colors: {
        db: {
          bg:      "#0A0A0A",
          surface: "#111111",
          s2:      "#191919",
          border:  "#242424",
          text:    "#D4D0C8",
          muted:   "#4A4742",
          dim:     "#2A2725",
        },
        up:    "#2ECC71",
        down:  "#E74C3C",
        live:  "#E74C3C",
        amber: "#E67E22",
        sky:   "#3B8EDF",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.3" },
        },
      },
      animation: {
        "fade-in":    "fade-in 0.15s ease-out",
        "blink":      "blink 1s step-end infinite",
        "pulse-slow": "pulse-slow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
