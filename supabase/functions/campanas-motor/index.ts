// campanas-motor: manda las notificaciones push de las campañas que esperan en
// la cola (envios_campana). Cada push lleva el título y el mensaje de la
// campaña, el logo del negocio como ícono y abre los cupones del cliente.
// Las reglas (franja horaria, tope semanal, promociones aceptadas) las aplica
// push_tomar en SQL.
//
// POST { negocio_id }                → el panel, con la sesión del equipo, al lanzar
// POST {} + cabecera x-motor-clave   → pg_cron, cada 5 minutos, todos los negocios
//   200 → { enviados, fallidos, omitidos }
//   4xx → { error: { codigo, mensaje } }
// @deno-types="@types/web-push"
import webpush from 'web-push'
import { esquemaCampanasMotor } from '../../../packages/tipos/src/esquemas.ts'
import { ErrorApi, leerJson, responderError, responderJson, servir } from '../_compartido/http.ts'
import { clienteServicio, usuarioAutenticado } from '../_compartido/supabase.ts'

type Suscripcion = { id: string; endpoint: string; p256dh: string; auth: string }
type Resultado = { envio_id: string; enviado: boolean; error?: string; entregadas: string[]; vencidas: string[] }

const LOTE = 100
// La función tiene ~150 s; se deja margen para registrar el último lote.
const PRESUPUESTO_MS = 100_000

servir(async (peticion) => {
  const negocioId = await autorizar(peticion)

  const publica = Deno.env.get('VAPID_PUBLIC_KEY')
  const privada = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publica || !privada) return responderError('push_no_configurado', 503)
  const vapid = { subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@hibeely.com', publicKey: publica, privateKey: privada }

  const servicio = clienteServicio()
  const inicio = Date.now()
  const totales = { enviados: 0, fallidos: 0, omitidos: 0 }

  while (Date.now() - inicio < PRESUPUESTO_MS) {
    const { data: lote, error } = await servicio.rpc('push_tomar', { p_negocio_id: negocioId ?? undefined, p_limite: LOTE })
    if (error) throw error
    if (!lote?.length) break

    const resultados = await Promise.all(
      lote.map(async (envio): Promise<Resultado> => {
        const carga = JSON.stringify({
          titulo: envio.titulo,
          mensaje: envio.mensaje.trim() || `Tu cupón ya está en tu tarjeta de ${envio.negocio_nombre}.`,
          icono: envio.logo_url ?? undefined,
          url: `/t/${envio.token_publico}/cupones`,
          etiqueta: `campana-${envio.campana_id}`,
        })
        // Que el aviso no llegue después de que la promoción venza (máximo 3 días en cola del navegador).
        const ttl = Math.max(60, Math.min(3 * 86_400, Math.floor((Date.parse(envio.termina_en) - Date.now()) / 1000)))
        const resultado: Resultado = { envio_id: envio.envio_id, enviado: false, entregadas: [], vencidas: [] }

        for (const s of (envio.suscripciones ?? []) as Suscripcion[]) {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, {
              vapidDetails: vapid,
              TTL: ttl,
              urgency: 'normal',
              timeout: 10_000,
            })
            resultado.entregadas.push(s.id)
            resultado.enviado = true
          } catch (e) {
            const estado = (e as { statusCode?: number }).statusCode
            // 404/410: el navegador dio de baja la suscripción.
            if (estado === 404 || estado === 410) resultado.vencidas.push(s.id)
            else resultado.error = estado ? `http_${estado}` : 'error_red'
          }
        }
        return resultado
      }),
    )

    const { error: errorRegistro } = await servicio.rpc('push_registrar', { p_resultados: resultados })
    if (errorRegistro) throw errorRegistro
    for (const r of resultados) {
      if (r.enviado) totales.enviados++
      else if (r.error) totales.fallidos++
      else totales.omitidos++
    }
    if (lote.length < LOTE) break
  }

  return responderJson(totales)
})

// pg_cron trae la clave compartida y procesa todos los negocios; el panel trae la
// sesión de alguien del equipo y solo procesa su negocio.
async function autorizar(peticion: Request): Promise<string | null> {
  const clave = Deno.env.get('CAMPANAS_MOTOR_CLAVE')
  const recibida = peticion.headers.get('x-motor-clave')
  if (recibida !== null) {
    if (!clave || !(await iguales(recibida, clave))) throw new ErrorApi('sin_permiso', 403)
    return null
  }

  const { cliente } = await usuarioAutenticado(peticion)
  const datos = esquemaCampanasMotor.safeParse(await leerJson(peticion))
  if (!datos.success) throw new ErrorApi('solicitud_invalida', 400)
  // campanas_negocio solo responde a dueños y administradores del negocio.
  const { error } = await cliente.rpc('campanas_negocio', { p_negocio_id: datos.data.negocio_id }).limit(1)
  if (error) throw new ErrorApi('sin_permiso', 403)
  return datos.data.negocio_id
}

// Compara en tiempo constante (sobre los hashes, para no filtrar el largo).
async function iguales(a: string, b: string): Promise<boolean> {
  const codificar = (texto: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  const [x, y] = await Promise.all([codificar(a), codificar(b)]).then((h) => h.map((b) => new Uint8Array(b)))
  let diferencia = 0
  for (let i = 0; i < x.length; i++) diferencia |= x[i] ^ y[i]
  return diferencia === 0
}
