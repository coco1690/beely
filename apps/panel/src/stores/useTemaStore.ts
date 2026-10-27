import { create } from 'zustand'

// Tema visual del panel: color de acento y modo claro/oscuro.
// Se guarda en localStorage (preferencia de este navegador) y se aplica como
// data-tema / data-modo en <html>; index.html lo aplica antes de pintar.

export const temas = [
  { id: 'miel', nombre: 'Miel', color: '#f5b301' },
  { id: 'oceano', nombre: 'Océano', color: '#0277b5' },
  { id: 'bosque', nombre: 'Bosque', color: '#05805c' },
  { id: 'uva', nombre: 'Uva', color: '#7c3aed' },
  { id: 'coral', nombre: 'Coral', color: '#d81b45' },
] as const

export type IdTema = (typeof temas)[number]['id']
export type Modo = 'claro' | 'oscuro'

const LLAVE = 'beely-panel-tema'

type Guardado = { tema: IdTema; modo: Modo }

function leer(): Guardado {
  const porDefecto: Guardado = {
    tema: 'miel',
    modo: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro',
  }
  try {
    const crudo = localStorage.getItem(LLAVE)
    if (!crudo) return porDefecto
    const valor = JSON.parse(crudo) as Partial<Guardado>
    return {
      tema: temas.some((t) => t.id === valor.tema) ? (valor.tema as IdTema) : porDefecto.tema,
      modo: valor.modo === 'oscuro' || valor.modo === 'claro' ? valor.modo : porDefecto.modo,
    }
  } catch {
    return porDefecto
  }
}

function aplicar({ tema, modo }: Guardado) {
  const raiz = document.documentElement
  // Se apagan las transiciones un cuadro para que el cambio no quede a medias.
  raiz.classList.add('sin-transiciones')
  raiz.dataset.tema = tema
  raiz.dataset.modo = modo
  requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.remove('sin-transiciones')))
  // La barra del navegador móvil toma el color del fondo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', modo === 'oscuro' ? '#0e0d0c' : '#f7f6f4')
  try {
    localStorage.setItem(LLAVE, JSON.stringify({ tema, modo }))
  } catch {
    // Sin almacenamiento (modo privado): el tema dura solo esta visita.
  }
}

type EstadoTema = Guardado & {
  elegirTema: (tema: IdTema) => void
  alternarModo: () => void
}

export const useTemaStore = create<EstadoTema>((set, get) => {
  const inicial = leer()
  aplicar(inicial)
  return {
    ...inicial,
    elegirTema: (tema) => {
      aplicar({ tema, modo: get().modo })
      set({ tema })
    },
    alternarModo: () => {
      const modo: Modo = get().modo === 'oscuro' ? 'claro' : 'oscuro'
      aplicar({ tema: get().tema, modo })
      set({ modo })
    },
  }
})
