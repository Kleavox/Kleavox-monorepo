/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.rs", "./index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans:  ["Inter", "system-ui", "sans-serif"],
        mono:  ["'JetBrains Mono'", "'Fira Code'", "Consolas", "monospace"],
      },
      colors: {
        db: {
          bg:      "#F5F4F0",
          surface: "#FFFFFF",
          border:  "#CBC8BE",
          text:    "#1A1A1A",
          muted:   "#6B6860",
          subtle:  "#EFEDE8",
        },
        up:   "#15803D",
        down: "#B91C1C",
        live: "#DC2626",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.3" },
        },
        "live-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.7", transform: "scale(0.97)" },
        },
      },
      animation: {
        "fade-in":    "fade-in 0.2s ease-out forwards",
        "pulse-dot":  "pulse-dot 2s ease-in-out infinite",
        "live-pulse": "live-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
