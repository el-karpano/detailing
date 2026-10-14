import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const clientMeta = JSON.parse(
  readFileSync(new URL('./src/data/client-meta.json', import.meta.url), 'utf8')
) as { name: string; shortName: string; description: string }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'mimo-chat-dev',
        configureServer(server) {
          server.middlewares.use('/api/chat', async (req, res) => {
            try {
              const chunks: Buffer[] = []
              for await (const c of req) chunks.push(c as Buffer)
              const raw = Buffer.concat(chunks)
              const request = new Request('http://local/api/chat', {
                method: req.method,
                headers: { 'Content-Type': req.headers['content-type'] || 'application/json' },
                body: req.method === 'GET' ? undefined : raw,
              })
              const { handleChat } = await import('./worker/chat.js')
              const response = await handleChat(request, {
                MIMO_API_KEY: env.MIMO_API_KEY,
                MIMO_BASE_URL: env.MIMO_BASE_URL,
                MIMO_MODEL: env.MIMO_MODEL,
              })
              res.statusCode = response.status
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(await response.text())
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: String(e) }))
            }
          })
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: [
          'favicon.svg',
          'icons/icon-180.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/maskable-512.png',
        ],
        manifest: {
          id: '/',
          name: clientMeta.name,
          short_name: clientMeta.shortName,
          description: clientMeta.description,
          lang: 'ru',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          importScripts: ['sw-push.js'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'images',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
          ],
        },
      }),
    ],
    server: { port: 5173 },
  }
})
