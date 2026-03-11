// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",

  devtools: { enabled: true },

  modules: ["@nuxtjs/tailwindcss"],

  css: ["~/assets/css/main.css"],

  // Use routeRules to set headers - more reliable than meta tags in some environments
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://static.cloudflareinsights.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://i.ytimg.com https://*.ytimg.com; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;"
      }
    }
  },

  app: {
    head: {
      title: "DeauWait — YouTube Live Watcher",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "Wait for a YouTube channel to go live. Auto-redirects when stream is detected.",
        },
        { name: "theme-color", content: "#080808" }
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Geist+Mono:wght@300;400;500&display=swap",
        },
        { rel: "preconnect", href: "https://www.youtube.com" },
        { rel: "preconnect", href: "https://s.ytimg.com" },
        { rel: "dns-prefetch", href: "https://www.youtube.com" },
        { rel: "dns-prefetch", href: "https://www.google.com" },
      ],
    },
  },
});
