import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: process.env.PUBLIC_PORTFOLIO_ORIGIN ?? "https://portfolio.example.com",
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
    ssr: {
      noExternal: ["@kleavox/config"],
    },
  },
});
