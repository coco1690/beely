// Utilidades de PWA compartidas por el panel y el club.

export function esAppInstalada(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || matchMedia('(display-mode: standalone)').matches
}

// Íconos de Beely (packages/ui/iconos). El plugin `pwaBeely` los sirve en la raíz de cada app.
export const iconosBeely = [
  { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icono-mascara-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
] as const

export type OpcionesManifest = {
  nombre: string
  nombreCorto: string
  descripcion: string
  // Ruta con que abre la app instalada. null = la página donde se instaló: el club la
  // deja así para que la app abra en la tarjeta del cliente (iOS no comparte el
  // almacenamiento de Safari con la app instalada, así que el token va en la URL).
  inicio?: string | null
  colorFondo?: string
  colorTema?: string
}

// Manifest web de una app de Beely. El panel lo genera fijo al compilar; el club, por negocio.
export function crearManifest({
  nombre,
  nombreCorto,
  descripcion,
  inicio = '/',
  colorFondo = '#1c1917',
  colorTema = '#1c1917',
}: OpcionesManifest) {
  return {
    name: nombre,
    short_name: nombreCorto,
    description: descripcion,
    lang: 'es',
    id: '/',
    ...(inicio === null ? {} : { start_url: inicio }),
    scope: '/',
    display: 'standalone',
    background_color: colorFondo,
    theme_color: colorTema,
    icons: iconosBeely,
  }
}
