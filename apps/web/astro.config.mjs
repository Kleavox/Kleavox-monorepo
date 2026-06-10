import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: process.env.PUBLIC_ROOT_ORIGIN ?? "https://example.com",
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
    ssr: {
      noExternal: ["@kleavox/config", "@kleavox/core"],
    },
  },
});
