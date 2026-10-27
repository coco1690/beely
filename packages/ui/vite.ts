// Plugin de Vite compartido por las apps de Beely: íconos, manifest y <head> de PWA.
//  * Sirve (dev) y publica (build) los íconos de packages/ui/iconos en la raíz.
//  * Con `manifest`, publica /manifest.webmanifest fijo (el panel). Sin él, la app
//    sirve su propio manifest dinámico en esa ruta (el club, uno por negocio).
//  * Inyecta en <head> los enlaces de íconos y manifest, las metas de iOS y el
//    script que aplica el tema guardado antes de pintar.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HtmlTagDescriptor, Plugin } from 'vite'
import { crearManifest, type OpcionesManifest } from './src/pwa.ts'
import { scriptTemaInicial } from './src/tema-inicial.ts'

const carpetaIconos = fileURLToPath(new URL('./iconos', import.meta.url))
const tipos: Record<string, string> = { '.png': 'image/png', '.svg': 'image/svg+xml' }

export function pwaBeely({ titulo, manifest }: { titulo: string; manifest?: OpcionesManifest }): Plugin {
  const iconos = readdirSync(carpetaIconos)
  return {
    name: 'beely-pwa',
    configureServer(servidor) {
      servidor.middlewares.use((peticion, respuesta, siguiente) => {
        const ruta = (peticion.url ?? '').split('?')[0] ?? ''
        const archivo = ruta.slice(1)
        if (iconos.includes(archivo)) {
          respuesta.setHeader('Content-Type', tipos[archivo.slice(archivo.lastIndexOf('.'))] ?? 'application/octet-stream')
          respuesta.end(readFileSync(join(carpetaIconos, archivo)))
          return
        }
        if (manifest && ruta === '/manifest.webmanifest') {
          respuesta.setHeader('Content-Type', 'application/manifest+json')
          respuesta.end(JSON.stringify(crearManifest(manifest)))
          return
        }
        siguiente()
      })
    },
    generateBundle() {
      for (const archivo of iconos) {
        this.emitFile({ type: 'asset', fileName: archivo, source: readFileSync(join(carpetaIconos, archivo)) })
      }
      if (manifest) {
        this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(crearManifest(manifest), null, 2) })
      }
    },
    transformIndexHtml() {
      const meta = (name: string, content: string): HtmlTagDescriptor => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' })
      const enlace = (rel: string, href: string, extra: Record<string, string> = {}): HtmlTagDescriptor => ({
        tag: 'link',
        attrs: { rel, href, ...extra },
        injectTo: 'head',
      })
      return [
        { tag: 'script', children: scriptTemaInicial, injectTo: 'head-prepend' },
        meta('theme-color', '#f7f6f4'),
        enlace('icon', '/favicon.svg', { type: 'image/svg+xml' }),
        enlace('apple-touch-icon', '/apple-touch-icon.png'),
        enlace('manifest', '/manifest.webmanifest'),
        meta('apple-mobile-web-app-title', titulo),
        meta('mobile-web-app-capable', 'yes'),
        meta('apple-mobile-web-app-capable', 'yes'),
        meta('apple-mobile-web-app-status-bar-style', 'default'),
      ]
    },
  }
}
