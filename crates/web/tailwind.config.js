/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.rs", "./index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        db: {
          bg:      "#FAFAF9",
          surface: "#FFFFFF",
          border:  "#E7E5E4",
          text:    "#1C1917",
          muted:   "#78716C",
        },
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.3" },
        },
      },
      animation: {
        "fade-up":    "fade-up 0.25s ease-out forwards",
        "pulse-slow": "pulse-slow 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
