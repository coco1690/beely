import { create } from 'zustand'

// Tema visual de las apps (panel y club): color de acento y modo claro/oscuro.
// Se guarda en localStorage (preferencia de este navegador; cada subdominio tiene
// la suya) y se aplica como data-tema / data-modo en <html>. El plugin de Vite
// `pwaBeely` inyecta en index.html el mismo código para aplicarlo antes de pintar.

// `degradado`: el segundo tono, solo en los temas que rellenan con degradado.
export const temas = [
  { id: 'beely', nombre: 'Beely', color: '#f47b5e', degradado: '#e7577f' },
  { id: 'miel', nombre: 'Miel', color: '#f5b301' },
  { id: 'oceano', nombre: 'Océano', color: '#0277b5' },
  { id: 'bosque', nombre: 'Bosque', color: '#05805c' },
  { id: 'uva', nombre: 'Uva', color: '#7c3aed' },
  { id: 'coral', nombre: 'Coral', color: '#d81b45' },
] as const

export type IdTema = (typeof temas)[number]['id']
export type Modo = 'claro' | 'oscuro'

import { LLAVE_ANTERIOR, LLAVE_TEMA } from './tema-inicial'

export { LLAVE_TEMA }

// Colores propios de un negocio (el club): reemplazan el acento del tema con estilos en <html>.
export type ColoresMarca = { acento: string; acento2: string; sobre: string }

// porDefecto: tema que el club guardaba según el color del negocio; se sigue leyendo por compatibilidad.
// colores: los del negocio, recordados para pintarlos desde el primer cuadro.
type Guardado = { tema: IdTema | null; modo: Modo | null; porDefecto?: IdTema; colores?: ColoresMarca }

const esHex = (valor: unknown): valor is string => typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor)
const esColores = (valor: unknown): valor is ColoresMarca => {
  const c = valor as Partial<ColoresMarca> | null
  return !!c && esHex(c.acento) && esHex(c.acento2) && esHex(c.sobre)
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
const aHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')

function luminancia(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

function aHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}
function desdeHsl(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return aHex(r + m, g + m, b + m)
}

// Acento y degradado del club a partir de los colores del negocio. El degradado va del
// primario al secundario cuando el secundario es un color vivo; si es casi negro, casi
// blanco o gris (p. ej. el #1F1A17 por defecto, pensado para textos), el segundo tono
// sale del primario corrido un poco de matiz y más hondo. El texto encima es blanco u
// oscuro, el que contraste más con los dos tonos.
export function coloresDeNegocio(primario: string | null | undefined, secundario?: string | null): ColoresMarca | null {
  if (!esHex(primario)) return null
  const acento = primario.toLowerCase()
  const [h, s, l] = aHsl(acento)
  const vivo = (hex: string) => {
    const [, sat, lum] = aHsl(hex)
    return sat >= 0.25 && lum >= 0.2 && lum <= 0.85
  }
  const acento2 =
    esHex(secundario) && secundario.toLowerCase() !== acento && vivo(secundario)
      ? secundario.toLowerCase()
      : desdeHsl((h + 345) % 360, Math.min(1, s * 1.05), Math.max(0, l * 0.86))
  const minimo = (texto: string) => Math.min(contraste(acento, texto), contraste(acento2, texto))
  const sobre = minimo('#ffffff') >= minimo('#0e0d0c') ? '#ffffff' : '#0e0d0c'
  return { acento, acento2, sobre }
}

const esTema = (valor: unknown): valor is IdTema => temas.some((t) => t.id === valor)

function leer(): Guardado {
  try {
    const crudo = localStorage.getItem(LLAVE_TEMA) ?? localStorage.getItem(LLAVE_ANTERIOR)
    const valor = (crudo ? JSON.parse(crudo) : {}) as Partial<Record<keyof Guardado, unknown>>
    return {
      tema: esTema(valor.tema) ? valor.tema : null,
      modo: valor.modo === 'oscuro' || valor.modo === 'claro' ? valor.modo : null,
      porDefecto: esTema(valor.porDefecto) ? valor.porDefecto : undefined,
      colores: esColores(valor.colores) ? valor.colores : undefined,
    }
  } catch {
    return { tema: null, modo: null }
  }
}

const modoDelSistema = (): Modo => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro')

function aplicar(tema: IdTema, modo: Modo) {
  const raiz = document.documentElement
  // Se apagan las transiciones un cuadro para que el cambio no quede a medias.
  raiz.classList.add('sin-transiciones')
  raiz.dataset.tema = tema
  raiz.dataset.modo = modo
  requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.remove('sin-transiciones')))
  // La barra del navegador móvil toma el color del fondo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', modo === 'oscuro' ? '#0e0d0c' : '#f7f6f4')
}

// Los colores del negocio van como estilos en <html>: ganan sobre el tema y valen en claro y oscuro.
function aplicarColores(colores: ColoresMarca | undefined) {
  const estilo = document.documentElement.style
  const valores: [string, string | undefined][] = [
    ['--b-acento', colores?.acento],
    ['--b-acento-2', colores?.acento2],
    ['--b-sobre-acento', colores?.sobre],
  ]
  for (const [nombre, valor] of valores) {
    if (valor) estilo.setProperty(nombre, valor)
    else estilo.removeProperty(nombre)
  }
}

function guardar(valor: Guardado) {
  try {
    localStorage.setItem(LLAVE_TEMA, JSON.stringify(valor))
  } catch {
    // Sin almacenamiento (modo privado): el tema dura solo esta visita.
  }
}

type EstadoTema = {
  tema: IdTema
  modo: Modo
  // Lo que eligió la persona; null = sigue el valor por defecto.
  elegido: Guardado
  elegirTema: (tema: IdTema) => void
  alternarModo: () => void
  // El club pinta con los colores de su negocio; null vuelve al tema.
  fijarColores: (colores: ColoresMarca | null) => void
}

export const useTemaStore = create<EstadoTema>((set, get) => {
  const elegido = leer()
  const inicial = { tema: elegido.tema ?? elegido.porDefecto ?? 'beely', modo: elegido.modo ?? modoDelSistema() }
  aplicar(inicial.tema, inicial.modo)
  aplicarColores(elegido.colores)
  return {
    ...inicial,
    elegido,
    elegirTema: (tema) => {
      const nuevo = { ...get().elegido, tema }
      aplicar(tema, get().modo)
      guardar(nuevo)
      set({ tema, elegido: nuevo })
    },
    alternarModo: () => {
      const modo: Modo = get().modo === 'oscuro' ? 'claro' : 'oscuro'
      const nuevo = { ...get().elegido, modo }
      aplicar(get().tema, modo)
      guardar(nuevo)
      set({ modo, elegido: nuevo })
    },
    fijarColores: (colores) => {
      const actual = get().elegido.colores
      const iguales = actual?.acento === colores?.acento && actual?.acento2 === colores?.acento2 && actual?.sobre === colores?.sobre
      if (iguales) return
      const nuevo = { ...get().elegido, colores: colores ?? undefined }
      aplicarColores(nuevo.colores)
      guardar(nuevo)
      set({ elegido: nuevo })
    },
  }
})
