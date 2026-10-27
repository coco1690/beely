import { FunctionsHttpError } from '@supabase/supabase-js'
import { esquemaErrorApi, mensajeDeError } from '@beely/tipos'
import { supabase } from './supabase'

export class ErrorBeely extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

// Llama una Edge Function con la sesión actual y traduce { error: { codigo, mensaje } }.
export async function llamarFuncion<T>(nombre: string, cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(nombre, { body: cuerpo })
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
