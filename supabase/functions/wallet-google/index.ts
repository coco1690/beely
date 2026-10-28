// wallet-google: el cliente agrega su tarjeta de sellos a Google Wallet desde la PWA.
// Pública (anon, sin sesión): el token de la tarjeta es la prueba de que es suya.
//
// POST { slug, token }
//   200 → { url }  (https://pay.google.com/gp/v/save/{jwt}: la PWA navega ahí)
//   4xx/5xx → { error: { codigo, mensaje } }
import { esquemaWalletGoogle } from '../../../packages/tipos/src/esquemas.ts'
import { cargarTarjeta, configuracionWallet, enlaceGuardar } from '../_compartido/google-wallet.ts'
import { leerJson, responderError, responderJson, servir } from '../_compartido/http.ts'
import { clienteServicio } from '../_compartido/supabase.ts'

servir(async (peticion) => {
  const datos = esquemaWalletGoogle.safeParse(await leerJson(peticion))
  if (!datos.success) return responderError('solicitud_invalida', 400)

  const config = configuracionWallet()
  if (!config) return responderError('wallet_no_configurado', 503)

  const servicio = clienteServicio()
  const tarjeta = await cargarTarjeta(servicio, datos.data)
  if (!tarjeta) return responderError('tarjeta_no_encontrada', 404)
  if (tarjeta.estado !== 'activa') return responderError('tarjeta_bloqueada', 409)

  return responderJson({ url: await enlaceGuardar(config, servicio, tarjeta) })
})
