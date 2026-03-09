// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],

  app: {
    head: {
      title: 'DeauWait — YouTube Live Watcher',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Wait for your favorite YouTube channel to go live.' }
      ],
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com'
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: ''
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap'
        }
      ]
    }
  },

  runtimeConfig: {
    // Server-only
    port: process.env.PORT || 3001,
    // YouTube API key (optional, for future use)
    youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  },

  nitro: {
    // Nuxt server engine config
  },

  compatibilityDate: '2024-11-01'
})
