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

// porDefecto: tema que el club guardaba según el color del negocio; se sigue leyendo por compatibilidad.
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
}

export const useTemaStore = create<EstadoTema>((set, get) => {
  const elegido = leer()
  const inicial = { tema: elegido.tema ?? elegido.porDefecto ?? 'beely', modo: elegido.modo ?? modoDelSistema() }
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
  }
})
