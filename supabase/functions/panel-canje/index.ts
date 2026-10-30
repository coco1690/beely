// panel-canje: el cajero (o cualquier miembro del equipo) canjea desde la caja un
// cupón de la tarjeta que tiene abierta, por ejemplo el premio de los sellos.
//
// POST { negocio_id, codigo, sede_id?, clave_idempotencia }
//   200 → resultado de canjear_cupon (duplicado, cupon_id, estado, descripcion)
//   4xx → { error: { codigo, mensaje } }
import { esquemaPanelCanje } from '../../../packages/tipos/src/esquemas.ts'
import { enSegundoPlano, sincronizarPaseGoogle } from '../_compartido/google-wallet.ts'
import { ErrorApi, leerJson, responderError, responderErrorSql, responderJson, servir } from '../_compartido/http.ts'
import { clienteServicio, usuarioAutenticado } from '../_compartido/supabase.ts'

servir(async (peticion) => {
  const { usuario, cliente } = await usuarioAutenticado(peticion)

  const datos = esquemaPanelCanje.safeParse(await leerJson(peticion))
  if (!datos.success) return responderError('solicitud_invalida', 400)
  const { negocio_id, codigo, sede_id, clave_idempotencia } = datos.data

  // RLS de negocios deja ver la fila solo a miembros del negocio (o al superadmin).
  const { data: negocio, error } = await cliente.from('negocios').select('id').eq('id', negocio_id).maybeSingle()
  if (error) throw error
  if (!negocio) throw new ErrorApi('sin_permiso', 403)

  const { data: resultado, error: errorCanje } = await clienteServicio().rpc('canjear_cupon', {
    p_negocio_id: negocio_id,
    p_codigo: codigo,
    p_venta_externa_id: `panel:${clave_idempotencia}`,
    p_sede_id: sede_id ?? undefined,
    p_canjeado_por: usuario.id,
  })
  if (errorCanje) return responderErrorSql(errorCanje)

  // El pase de Google Wallet cuenta los premios listos: se pone al día sin demorar la caja.
  const canje = resultado as { duplicado: boolean; cupon_id: string }
  if (!canje.duplicado) {
    enSegundoPlano(
      (async () => {
        const { data: cupon } = await clienteServicio().from('cupones').select('tarjeta_id').eq('id', canje.cupon_id).maybeSingle()
        if (cupon?.tarjeta_id) await sincronizarPaseGoogle(clienteServicio(), cupon.tarjeta_id)
      })(),
    )
  }

  return responderJson(resultado)
})
