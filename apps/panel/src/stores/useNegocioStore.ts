import type { RolEquipo, Tabla } from '@beely/tipos'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type Negocio = Tabla<'negocios'>
export type Sede = Tabla<'sedes'>
export type RolPanel = RolEquipo | 'superadmin'

export type Membresia = { negocio: Negocio; rol: RolPanel }

type EstadoNegocio = {
  membresias: Membresia[]
  negocioId: string | null
  sedes: Sede[]
  sedeCajaId: string | null
  cargando: boolean
  error: string | null
  cargar: (usuarioId: string, esSuperadmin: boolean) => Promise<void>
  elegirNegocio: (negocioId: string) => Promise<void>
  elegirSedeCaja: (sedeId: string | null) => void
  recargarNegocio: () => Promise<void>
  recargarSedes: () => Promise<void>
  limpiar: () => void
}

const CLAVE_NEGOCIO = 'beely.panel.negocio'
const claveSede = (negocioId: string) => `beely.panel.sede.${negocioId}`

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave: string, valor: string | null): void {
  try {
    if (valor) localStorage.setItem(clave, valor)
    else localStorage.removeItem(clave)
  } catch {
    // Navegación privada: no recordamos la elección, pero el panel sigue funcionando.
  }
}

export const useNegocioStore = create<EstadoNegocio>()((set, get) => ({
  membresias: [],
  negocioId: null,
  sedes: [],
  sedeCajaId: null,
  cargando: true,
  error: null,

  cargar: async (usuarioId, esSuperadmin) => {
    // Solo la primera carga muestra "Cargando…"; las recargas no desmontan la página.
    set({ cargando: get().membresias.length === 0, error: null })
    const [{ data: negocios, error }, { data: propias }] = await Promise.all([
      supabase.from('negocios').select('*').order('nombre'),
      supabase.from('miembros_negocio').select('negocio_id, rol').eq('usuario_id', usuarioId),
    ])
    if (error) {
      set({ cargando: false, error: error.message })
      return
    }
    const rolPorNegocio = new Map((propias ?? []).map((m) => [m.negocio_id, m.rol as RolEquipo]))
    const membresias: Membresia[] = (negocios ?? []).flatMap((negocio) => {
      const rol = rolPorNegocio.get(negocio.id) ?? (esSuperadmin ? 'superadmin' : null)
      return rol ? [{ negocio, rol }] : []
    })
    set({ membresias, cargando: false })

    // El superadmin arranca en la plataforma: solo retoma un negocio que abrió antes a propósito.
    const actual = get().negocioId ?? leer(CLAVE_NEGOCIO)
    const inicial = membresias.find((m) => m.negocio.id === actual) ?? (esSuperadmin ? undefined : membresias[0])
    if (inicial) await get().elegirNegocio(inicial.negocio.id)
    else set({ negocioId: null, sedes: [], sedeCajaId: null })
  },

  elegirNegocio: async (negocioId) => {
    guardar(CLAVE_NEGOCIO, negocioId)
    set({ negocioId, sedes: [], sedeCajaId: null })
    await get().recargarSedes()
  },

  elegirSedeCaja: (sedeId) => {
    const { negocioId } = get()
    if (negocioId) guardar(claveSede(negocioId), sedeId)
    set({ sedeCajaId: sedeId })
  },

  recargarNegocio: async () => {
    const { negocioId, membresias } = get()
    if (!negocioId) return
    const { data } = await supabase.from('negocios').select('*').eq('id', negocioId).single()
    if (data) set({ membresias: membresias.map((m) => (m.negocio.id === data.id ? { ...m, negocio: data } : m)) })
  },

  recargarSedes: async () => {
    const { negocioId } = get()
    if (!negocioId) return
    const { data } = await supabase.from('sedes').select('*').eq('negocio_id', negocioId).order('nombre')
    const sedes = data ?? []
    const activas = sedes.filter((s) => s.activa)
    const recordada = leer(claveSede(negocioId))
    const sedeCajaId = activas.find((s) => s.id === recordada)?.id ?? (activas.length === 1 ? activas[0]!.id : null)
    set({ sedes, sedeCajaId })
  },

  limpiar: () => set({ membresias: [], negocioId: null, sedes: [], sedeCajaId: null, cargando: true, error: null }),
}))

// Negocio activo y rol de quien usa el panel.
export function useNegocioActivo(): Membresia | null {
  return useNegocioStore((e) => e.membresias.find((m) => m.negocio.id === e.negocioId) ?? null)
}

export const puedeConfigurar = (rol: RolPanel | undefined) =>
  rol === 'dueno' || rol === 'administrador' || rol === 'superadmin'
export const puedeGestionarEquipo = (rol: RolPanel | undefined) => rol === 'dueno' || rol === 'superadmin'
