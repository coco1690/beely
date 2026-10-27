// Cliente de Supabase y llamadas a Edge Functions, compartidos por el panel y el club.
// Subruta aparte (`@beely/tipos/supabase`) para que las Edge Functions, que importan
// esquemas.ts por ruta relativa, no arrastren supabase-js de npm.
import { createClient, FunctionsHttpError, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { Database } from './database'
import { mensajeDeError } from './esquemas'
import { esquemaErrorApi } from './index'

export type ClienteBeely = SupabaseClient<Database>

// Con la anon key: todo lo que lee el frontend pasa por RLS.
export function crearClienteBeely(
  url: string | undefined,
  llaveAnon: string | undefined,
  opciones?: SupabaseClientOptions<'public'>,
): ClienteBeely {
  if (!url || !llaveAnon) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY (copia .env.example a .env.local en la app)')
  }
  return createClient<Database>(url, llaveAnon, opciones)
}

export class ErrorBeely extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

// Llama una Edge Function y traduce el contrato { error: { codigo, mensaje } }.
export async function invocarFuncion<T>(cliente: ClienteBeely, nombre: string, cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await cliente.functions.invoke<T>(nombre, { body: cuerpo })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const respuesta = esquemaErrorApi.safeParse(await error.context.json().catch(() => null))
      if (respuesta.success) throw new ErrorBeely(respuesta.data.error.codigo, respuesta.data.error.mensaje)
    }
    throw new ErrorBeely('error_red', 'No pudimos conectar con Beely. Revisa tu conexión.')
  }
  return data as T
}

// Mensaje legible para errores de PostgREST/RPC (el message es el código de la excepción SQL).
export function mensajeDeErrorSupabase(error: { message: string; code?: string }): string {
  if (error.code === '42501') return mensajeDeError('sin_permiso')
  if (error.code === '23505') return 'Ya existe un registro con esos datos.'
  return mensajeDeError(error.message)
}

export function mensajeDe(error: unknown): string {
  if (error instanceof ErrorBeely) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return mensajeDeErrorSupabase(error as { message: string; code?: string })
  }
  return mensajeDeError('error_interno')
}
