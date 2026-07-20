const CACHE = 'orbit-v2'
const OFFLINE_ASSETS = ['/', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)
  // Only cache same-origin requests (app shell, pages, JS/CSS) — never
  // Supabase/API calls, those need to stay live or go through the
  // offline write queue instead.
  if (url.origin !== self.location.origin) return

  e.respondWith(
    (async () => {
      try {
        const res = await fetch(e.request)
        if (res && res.status === 200) {
          const cache = await caches.open(CACHE)
          await cache.put(e.request, res.clone())
        }
        return res
      } catch {
        const cached = await caches.match(e.request)
        return cached || (await caches.match('/'))
      }
    })()
  )
})
