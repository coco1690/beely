import { mensajeDe } from '@beely/tipos/supabase'
import { create } from 'zustand'
import { apuntarManifest, guardarToken, olvidarToken, slugActual } from '../lib/club'
import { clienteClub } from '../lib/supabase'

// Lo que el club muestra antes de registrarse: marca, programa y sedes del negocio.
async function consultarNegocio(slug: string) {
  const { data, error } = await clienteClub(slug)
    .from('negocios')
    .select(
      `id, slug, nombre, logo_url, color_primario, version_politica_datos,
       programas ( nombre, sellos_requeridos, premio_descripcion, regla_sello, monto_minimo, monto_por_sello, max_sellos_dia ),
       sedes ( id, nombre, direccion )`,
    )
    .maybeSingle()
  if (error) throw error
  return data
}

// La tarjeta del token: RLS solo deja ver esa tarjeta, su cliente, sus cupones y sus sellos.
async function consultarTarjeta(slug: string, token: string) {
  const { data, error } = await clienteClub(slug, token)
    .from('tarjetas')
    .select(
      `id, negocio_id, token_publico, sellos_actuales, sellos_historicos, premios_ganados, ultima_visita_en, estado, creado_en,
       clientes ( id, nombre, acepta_marketing ),
       negocios ( slug ),
       programas ( sellos_requeridos, premio_descripcion, premio_vigencia_dias,
         disenos_tarjeta ( color_fondo, color_texto, color_etiquetas, titulo, logo_url ) ),
       cupones ( id, codigo, descripcion, origen, estado, vence_en, canjeado_en, creado_en ),
       eventos_sello ( id, cantidad, origen, creado_en, sedes ( nombre ) )`,
    )
    .order('creado_en', { referencedTable: 'eventos_sello', ascending: false })
    .limit(20, { referencedTable: 'eventos_sello' })
    .order('vence_en', { referencedTable: 'cupones', ascending: true })
    .maybeSingle()
  if (error) throw error
  return data
}

export type NegocioClub = NonNullable<Awaited<ReturnType<typeof consultarNegocio>>>
export type TarjetaClub = NonNullable<Awaited<ReturnType<typeof consultarTarjeta>>>
export type CuponClub = TarjetaClub['cupones'][number]

type Estado = 'cargando' | 'listo' | 'no_encontrado' | 'error'

type EstadoClub = {
  slug: string | null
  negocio: NegocioClub | null
  estadoNegocio: Estado
  token: string | null
  tarjeta: TarjetaClub | null
  estadoTarjeta: Estado
  error: string | null
  cargarNegocio: () => Promise<void>
  abrirTarjeta: (token: string) => Promise<void>
  refrescarTarjeta: () => Promise<void>
  cambiarMarketing: (acepta: boolean) => Promise<void>
  salir: () => void
}

export const useClubStore = create<EstadoClub>((set, get) => ({
  slug: slugActual(),
  negocio: null,
  estadoNegocio: 'cargando',
  token: null,
  tarjeta: null,
  estadoTarjeta: 'cargando',
  error: null,

  cargarNegocio: async () => {
    const slug = get().slug
    if (!slug) return set({ estadoNegocio: 'no_encontrado' })
    try {
      const negocio = await consultarNegocio(slug)
      if (!negocio) return set({ estadoNegocio: 'no_encontrado' })
      apuntarManifest(slug)
      document.title = `${negocio.nombre} · Club`
      document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', negocio.nombre)
      set({ negocio, estadoNegocio: 'listo' })
    } catch (error) {
      set({ estadoNegocio: 'error', error: mensajeDe(error) })
    }
  },

  abrirTarjeta: async (token) => {
    const slug = get().slug
    if (!slug) return set({ estadoTarjeta: 'no_encontrado' })
    if (get().token !== token) set({ token, tarjeta: null, estadoTarjeta: 'cargando' })
    try {
      const tarjeta = await consultarTarjeta(slug, token)
      if (get().token !== token) return
      if (!tarjeta) return set({ estadoTarjeta: 'no_encontrado' })
      guardarToken(slug, token)
      set({ tarjeta, estadoTarjeta: 'listo', error: null })
    } catch (error) {
      // Si ya había tarjeta en pantalla (refresco sin red), se deja la última.
      if (!get().tarjeta) set({ estadoTarjeta: 'error', error: mensajeDe(error) })
    }
  },

  refrescarTarjeta: async () => {
    const token = get().token
    if (token) await get().abrirTarjeta(token)
  },

  cambiarMarketing: async (acepta) => {
    const { slug, token, tarjeta } = get()
    if (!slug || !token || !tarjeta?.clientes) return
    const { error } = await clienteClub(slug, token)
      .from('clientes')
      .update({ acepta_marketing: acepta })
      .eq('id', tarjeta.clientes.id)
    if (error) throw error
    set({ tarjeta: { ...tarjeta, clientes: { ...tarjeta.clientes, acepta_marketing: acepta } } })
  },

  salir: () => {
    const slug = get().slug
    if (slug) olvidarToken(slug)
    set({ token: null, tarjeta: null, estadoTarjeta: 'cargando' })
  },
}))

// Cupones que se pueden usar hoy (emitidos y sin vencer).
export const cuponesVigentes = (tarjeta: TarjetaClub | null): CuponClub[] =>
  (tarjeta?.cupones ?? []).filter((c) => c.estado === 'emitido' && new Date(c.vence_en) > new Date())
