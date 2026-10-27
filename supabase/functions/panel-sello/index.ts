// panel-sello: el cajero (o cualquier miembro del equipo) suma un sello
// desde el panel tras escanear el QR de la tarjeta.
//
// POST { negocio_id, token, sede_id?, monto_venta?, unidades?, clave_idempotencia }
//   200 → resultado de registrar_sello (sellos_sumados, sellos_actuales, premio_emitido, cupon?)
//   4xx → { error: { codigo, mensaje } }
import { esquemaPanelSello } from '../../../packages/tipos/src/esquemas.ts'
import { ErrorApi, leerJson, responderError, responderErrorSql, responderJson, servir } from '../_compartido/http.ts'
import { clienteServicio, usuarioAutenticado } from '../_compartido/supabase.ts'

servir(async (peticion) => {
  const { usuario, cliente } = await usuarioAutenticado(peticion)

  const datos = esquemaPanelSello.safeParse(await leerJson(peticion))
  if (!datos.success) return responderError('solicitud_invalida', 400)
  const { negocio_id, token, sede_id, monto_venta, unidades, clave_idempotencia } = datos.data

  // RLS de negocios deja ver la fila solo a miembros del negocio (o a la plataforma).
  const { data: negocio, error } = await cliente.from('negocios').select('id').eq('id', negocio_id).maybeSingle()
  if (error) throw error
  if (!negocio) throw new ErrorApi('sin_permiso', 403)

  const { data: resultado, error: errorSello } = await clienteServicio().rpc('registrar_sello', {
    p_negocio_id: negocio_id,
    p_token_tarjeta: token,
    p_venta_externa_id: `panel:${clave_idempotencia}`,
    p_sede_id: sede_id ?? undefined,
    p_monto_venta: monto_venta ?? undefined,
    p_unidades: unidades ?? 1,
    p_origen: 'panel',
    p_creado_por: usuario.id,
  })
  if (errorSello) return responderErrorSql(errorSello)

  return responderJson(resultado)
})
