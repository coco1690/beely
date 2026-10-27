// panel-equipo: invita a una persona al equipo de un negocio.
//  * El dueño invita administradores y cajeros.
//  * Solo el superadmin asigna dueños.
// Si el correo no tiene cuenta, Supabase Auth le envía la invitación para
// definir su clave en {PANEL_URL}/definir-clave. Si ya tiene cuenta (por
// ejemplo, trabaja en otro negocio), solo se agrega la membresía.
//
// POST { negocio_id, email, rol }
//   201 → { usuario_id, email, rol, invitado: boolean }
//   4xx → { error: { codigo, mensaje } }
import { esquemaInvitarMiembro } from '../../../packages/tipos/src/esquemas.ts'
import { ErrorApi, leerJson, responderError, responderJson, servir } from '../_compartido/http.ts'
import { clienteServicio, usuarioAutenticado } from '../_compartido/supabase.ts'

servir(async (peticion) => {
  const { usuario, cliente } = await usuarioAutenticado(peticion)

  const datos = esquemaInvitarMiembro.safeParse(await leerJson(peticion))
  if (!datos.success) return responderError('solicitud_invalida', 400)
  const { negocio_id, email, rol } = datos.data

  // Permiso, leído con RLS: la fila de superadmins solo la ve un superadmin,
  // y cada usuario ve su propia membresía.
  const [{ data: superadmin }, { data: membresia }] = await Promise.all([
    cliente.from('superadmins').select('usuario_id').eq('usuario_id', usuario.id).maybeSingle(),
    cliente.from('miembros_negocio').select('rol').eq('negocio_id', negocio_id).eq('usuario_id', usuario.id).maybeSingle(),
  ])
  const puede = superadmin !== null || (membresia?.rol === 'dueno' && rol !== 'dueno')
  if (!puede) throw new ErrorApi('sin_permiso', 403)

  const servicio = clienteServicio()
  const { data: existente, error: errorBusqueda } = await servicio.rpc('usuario_por_email', { p_email: email })
  if (errorBusqueda) throw errorBusqueda

  let usuarioId = existente
  if (!usuarioId) {
    const panelUrl = Deno.env.get('PANEL_URL') ?? 'http://127.0.0.1:5173'
    const { data: invitado, error: errorInvitacion } = await servicio.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${panelUrl}/definir-clave`,
    })
    if (errorInvitacion || !invitado.user) {
      console.error('No se pudo invitar', errorInvitacion)
      return responderError('error_interno', 502, 'No se pudo enviar la invitación.')
    }
    usuarioId = invitado.user.id
  }

  // Se inserta con el cliente del usuario: RLS vuelve a validar el permiso.
  const { error: errorMiembro } = await cliente
    .from('miembros_negocio')
    .insert({ negocio_id, usuario_id: usuarioId, rol })
  if (errorMiembro) {
    if (errorMiembro.code === '23505') return responderError('ya_es_miembro', 409)
    if (errorMiembro.code === '42501') return responderError('sin_permiso', 403)
    throw errorMiembro
  }

  return responderJson({ usuario_id: usuarioId, email, rol, invitado: !existente }, 201)
})
