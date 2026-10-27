/// <reference lib="webworker" />
// Service worker del club: precarga la app con Workbox (abre aunque no haya red)
// y muestra los Web Push que manda el motor de campañas.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// Toda navegación (/, /t/{token}…) abre la app precargada; /api queda para la red.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/manifest\.webmanifest/] }))

type MensajePush = { titulo?: string; mensaje?: string; url?: string; etiqueta?: string }

self.addEventListener('push', (evento) => {
  let datos: MensajePush = {}
  try {
    datos = (evento.data?.json() ?? {}) as MensajePush
  } catch {
    datos = { mensaje: evento.data?.text() }
  }
  evento.waitUntil(
    self.registration.showNotification(datos.titulo ?? 'Tienes novedades', {
      body: datos.mensaje,
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      tag: datos.etiqueta,
      data: { url: datos.url ?? '/' },
    }),
  )
})

// Al tocar el aviso: enfoca la app si ya está abierta; si no, la abre en la URL del aviso.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL((evento.notification.data as { url?: string } | null)?.url ?? '/', self.location.origin).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin)
      if (abierta) return abierta.focus().then((v) => v.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
