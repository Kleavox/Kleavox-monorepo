import { resolve } from "node:path";
import { getPublicOrigin } from "@kleavox/config";
import { sharedFavicon } from "@kleavox/vite-config";
import { defineConfig, loadEnv, type Plugin } from "vite";

function htmlVars(rootOrigin: string): Plugin {
  const passHref = getPublicOrigin(rootOrigin, "pass");
  const vars: Record<string, string> = {
    ROOT_ORIGIN: rootOrigin,
    ROOT_HOST: new URL(rootOrigin).host,
    LINK_HREF: getPublicOrigin(rootOrigin, "link"),
    PASS_HREF: passHref,
    PULSE_HREF: getPublicOrigin(rootOrigin, "pulse"),
    PORT_HREF: getPublicOrigin(rootOrigin, "port"),
    PASS_SIGNIN_HREF: `${passHref}/?returnTo=${encodeURIComponent(rootOrigin)}`,
    YEAR: String(new Date().getFullYear()),
  };
  return {
    name: "kleavox:html-vars",
    transformIndexHtml(html) {
      return html.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rootOrigin = env.PUBLIC_ROOT_ORIGIN ?? "https://example.com";
  return {
    plugins: [htmlVars(rootOrigin), sharedFavicon()],
    build: {
      assetsInlineLimit: 0,
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, "index.html"),
          privacy: resolve(import.meta.dirname, "privacy.html"),
          terms: resolve(import.meta.dirname, "terms.html"),
        },
      },
    },
  };
});
