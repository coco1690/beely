// Utilidades HTTP comunes de las Edge Functions: CORS, respuestas JSON y el
// contrato de errores { error: { codigo, mensaje } }.
import { mensajeDeError } from '../../../packages/tipos/src/esquemas.ts'

export const cabecerasCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function responderJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabecerasCors, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function responderError(codigo: string, estado: number, mensaje = mensajeDeError(codigo)): Response {
  return responderJson({ error: { codigo, mensaje } }, estado)
}

// Estado HTTP para cada código que lanzan las funciones SQL.
const estadoPorCodigo: Record<string, number> = {
  tarjeta_no_encontrada: 404,
  sede_no_encontrada: 404,
  cupon_no_encontrado: 404,
  negocio_no_encontrado: 404,
  sin_permiso: 403,
  tarjeta_bloqueada: 409,
  programa_inactivo: 409,
  negocio_inactivo: 409,
  cupon_ya_canjeado: 409,
  cupon_no_disponible: 409,
  cupon_vencido: 409,
  origen_invalido: 422,
}

// Convierte el error de PostgREST (message = nombre de la excepción) en respuesta de la API.
export function responderErrorSql(error: { message: string }): Response {
  const estado = estadoPorCodigo[error.message]
  if (estado) return responderError(error.message, estado)
  console.error('Error SQL no mapeado', error)
  return responderError('error_interno', 500)
}

export class ErrorApi extends Error {
  constructor(readonly codigo: string, readonly estado: number) {
    super(codigo)
  }
}

// Envuelve el handler: CORS, solo POST y errores inesperados → 500 con el contrato.
export function servir(manejador: (peticion: Request) => Promise<Response>): void {
  Deno.serve(async (peticion) => {
    if (peticion.method === 'OPTIONS') return new Response('ok', { headers: cabecerasCors })
    if (peticion.method !== 'POST') return responderError('metodo_no_permitido', 405, 'Usa POST.')
    try {
      return await manejador(peticion)
    } catch (error) {
      if (error instanceof ErrorApi) return responderError(error.codigo, error.estado)
      console.error(error)
      return responderError('error_interno', 500)
    }
  })
}

export async function leerJson(peticion: Request): Promise<unknown> {
  try {
    return await peticion.json()
  } catch {
    throw new ErrorApi('solicitud_invalida', 400)
  }
}
