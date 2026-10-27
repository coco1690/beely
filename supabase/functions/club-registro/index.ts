// club-registro: el cliente crea su tarjeta desde la PWA del negocio ({slug}.hibeely.com).
// Pública (anon, sin sesión). Límite de intentos por IP y por celular en club_registrar.
//
// POST { slug, nombre, celular, fecha_nacimiento, acepta_datos: true, acepta_marketing }
//   201 → { token }
//   4xx → { error: { codigo, mensaje } }
//         celular_ya_registrado 409: NO devuelve la tarjeta existente (evita robo de tarjeta).
import { esquemaClubRegistro } from '../../../packages/tipos/src/esquemas.ts'
import { leerJson, responderError, responderErrorSql, responderJson, servir } from '../_compartido/http.ts'
import { clienteServicio } from '../_compartido/supabase.ts'

const estadoPorMotivo: Record<string, number> = {
  celular_ya_registrado: 409,
  demasiados_intentos: 429,
}

// IP de quien llama (la primera de x-forwarded-for), guardada solo como hash.
async function huellaIp(peticion: Request): Promise<string> {
  const ip = peticion.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || peticion.headers.get('x-real-ip') || 'desconocida'
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`beely-club:${ip}`))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

servir(async (peticion) => {
  const datos = esquemaClubRegistro.safeParse(await leerJson(peticion))
  if (!datos.success) return responderError('solicitud_invalida', 400)
  const { slug, nombre, celular, fecha_nacimiento, acepta_marketing } = datos.data

  const { data, error } = await clienteServicio().rpc('club_registrar', {
    p_slug: slug,
    p_celular: celular,
    p_nombre: nombre,
    p_fecha_nacimiento: fecha_nacimiento,
    p_acepta_marketing: acepta_marketing,
    p_huella_ip: await huellaIp(peticion),
  })
  if (error) return responderErrorSql(error)

  const resultado = data as { registrado: boolean; token?: string; motivo?: string }
  if (!resultado.registrado || !resultado.token) {
    const motivo = resultado.motivo ?? 'error_interno'
    return responderError(motivo, estadoPorMotivo[motivo] ?? 500)
  }
  return responderJson({ token: resultado.token }, 201)
})
