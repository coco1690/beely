import type { Database } from '@beely/tipos'
import { create } from 'zustand'
import { mensajeDe } from '../lib/funciones'
import { supabase } from '../lib/supabase'

// Fila de public.superadmin_negocios(): el negocio con sus métricas del periodo.
export type NegocioPlataforma = Database['public']['Functions']['superadmin_negocios']['Returns'][number]

export type PuntoSerie = { dia: string; sellos: number; clientes: number }

// Forma del jsonb de public.superadmin_tablero().
export type Tablero = {
  dias: number
  negocios: { total: number; activos: number; suspendidos: number; cancelados: number; nuevos: number; por_plan: Record<string, number> }
  clientes: { total: number; nuevos: number }
  sellos: { periodo: number }
  cupones: { emitidos_periodo: number; canjeados_periodo: number }
  equipo: { miembros: number }
  serie: PuntoSerie[]
}

export const periodos = [7, 30, 90] as const
export type Periodo = (typeof periodos)[number]

type EstadoPlataforma = {
  dias: Periodo
  negocios: NegocioPlataforma[] | null
  tablero: Tablero | null
  error: string | null
  elegirDias: (dias: Periodo) => Promise<void>
  cargarNegocios: () => Promise<void>
  cargarTablero: () => Promise<void>
}

export const usePlataformaStore = create<EstadoPlataforma>()((set, get) => ({
  dias: 30,
  negocios: null,
  tablero: null,
  error: null,

  elegirDias: async (dias) => {
    set({ dias })
    await Promise.all([get().cargarNegocios(), get().cargarTablero()])
  },

  cargarNegocios: async () => {
    const { data, error } = await supabase.rpc('superadmin_negocios', { p_dias: get().dias })
    if (error) set({ error: mensajeDe(error) })
    else set({ negocios: data, error: null })
  },

  cargarTablero: async () => {
    const { data, error } = await supabase.rpc('superadmin_tablero', { p_dias: get().dias })
    if (error) set({ error: mensajeDe(error) })
    else set({ tablero: data as unknown as Tablero, error: null })
  },
}))
