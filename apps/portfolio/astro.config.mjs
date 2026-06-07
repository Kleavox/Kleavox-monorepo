import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: process.env.PUBLIC_PORTFOLIO_ORIGIN ?? "https://portfolio.example.com",
  vite: {
    ssr: {
      noExternal: ["@kleavox/config"],
    },
  },
});
