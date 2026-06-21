/**
 * Service Worker — Shajara PWA
 * 4.4  Push notifications
 * 6.3  Offline caching (app shell + static assets)
 */

const CACHE_NAME    = 'shajara-v1'
const API_CACHE     = 'shajara-api-v1'

// App shell — these are cached on install for full offline support
const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ── Install: cache app shell ─────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
})

// ── Activate: remove old caches ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
    ])
  )
})

// ── Fetch: caching strategy ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 1. API requests → Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') return  // only cache GET
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // 2. Media (uploaded photos) → Cache first, update in background
  if (url.pathname.startsWith('/media/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request)
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }

  // 3. Static assets (JS, CSS, fonts, images) → Cache first
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
      )
    )
    return
  }

  // 4. HTML navigation → Network first, fallback to cached index.html (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/') || caches.match('/index.html')
      )
    )
    return
  }

  // 5. Everything else → Network only
})

// ── Push Notifications (4.4) ─────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data.json() } catch {}
  const title   = data.title || '🌳 Shajara'
  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/icon-192.png',
    badge:   '/icon-192.png',
    data:    { url: data.url || '/' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: "Ko'rish" },
      { action: 'dismiss', title: 'Yopish' },
    ],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
