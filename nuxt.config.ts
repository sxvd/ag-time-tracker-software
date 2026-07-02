export default defineNuxtConfig({
  compatibilityDate: '2026-06-09',
  devtools: { enabled: false },
  srcDir: 'frontend',
  serverDir: 'backend',
  css: ['~/assets/main.css'],
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      title: 'AirGradient Time Tracker',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'AirGradient internal time tracking with Breezy.' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Catamaran:wght@500;600;700;800&family=Cabin:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap' }
      ]
    }
  },
  runtimeConfig: {
    aiInsightsApiKey: process.env.NUXT_AI_INSIGHTS_API_KEY || '',
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || ''
  },
  typescript: {
    strict: true
  },
  nitro: {
    experimental: {
      wasm: true
    }
  }
})
