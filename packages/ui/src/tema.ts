import { create } from 'zustand'

// Tema visual de las apps (panel y club): color de acento y modo claro/oscuro.
// Se guarda en localStorage (preferencia de este navegador; cada subdominio tiene
// la suya) y se aplica como data-tema / data-modo en <html>. El plugin de Vite
// `pwaBeely` inyecta en index.html el mismo código para aplicarlo antes de pintar.

export const temas = [
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

// porDefecto: el tema del negocio en el club, recordado para pintarlo desde el primer cuadro.
type Guardado = { tema: IdTema | null; modo: Modo | null; porDefecto?: IdTema }

const esTema = (valor: unknown): valor is IdTema => temas.some((t) => t.id === valor)

function leer(): Guardado {
  try {
    const crudo = localStorage.getItem(LLAVE_TEMA) ?? localStorage.getItem(LLAVE_ANTERIOR)
    const valor = (crudo ? JSON.parse(crudo) : {}) as Partial<Record<keyof Guardado, unknown>>
    return {
      tema: esTema(valor.tema) ? valor.tema : null,
      modo: valor.modo === 'oscuro' || valor.modo === 'claro' ? valor.modo : null,
      porDefecto: esTema(valor.porDefecto) ? valor.porDefecto : undefined,
    }
  } catch {
    return { tema: null, modo: null }
  }
}

const modoDelSistema = (): Modo => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro')

// El tema más cercano a un color de marca (#rrggbb), por tono. Así el club de cada
// negocio arranca con el acento que más se parece a su color.
export function temaMasCercano(color: string): IdTema {
  const tono = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max === min) return null
    const d = max - min
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (h * 60 + 360) % 360
  }
  const objetivo = /^#[0-9a-f]{6}$/i.test(color) ? tono(color) : null
  if (objetivo === null) return 'miel'
  let mejor: IdTema = 'miel'
  let distancia = Infinity
  for (const t of temas) {
    const h = tono(t.color) ?? 0
    const d = Math.min(Math.abs(h - objetivo), 360 - Math.abs(h - objetivo))
    if (d < distancia) {
      distancia = d
      mejor = t.id
    }
  }
  return mejor
}

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
  // Tema que se usa mientras la persona no elija uno (el club usa el del negocio).
  fijarTemaPorDefecto: (tema: IdTema) => void
}

export const useTemaStore = create<EstadoTema>((set, get) => {
  const elegido = leer()
  const inicial = { tema: elegido.tema ?? elegido.porDefecto ?? 'miel', modo: elegido.modo ?? modoDelSistema() }
  aplicar(inicial.tema, inicial.modo)
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
    fijarTemaPorDefecto: (tema) => {
      const actual = get().elegido
      if (actual.porDefecto === tema && (actual.tema || get().tema === tema)) return
      const nuevo = { ...actual, porDefecto: tema }
      guardar(nuevo)
      if (actual.tema) return set({ elegido: nuevo })
      aplicar(tema, get().modo)
      set({ tema, elegido: nuevo })
    },
  }
})
