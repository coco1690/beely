import type { ClienteBeely } from '@beely/tipos/supabase'

// Web Push del club. La suscripción vive en el service worker de este subdominio y se
// guarda en suscripciones_push por RLS (solo para la tarjeta del token).
const llavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushDisponible = () => Boolean(llavePublica) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function bytesDeBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = (texto + '='.repeat((4 - (texto.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

async function guardar(cliente: ClienteBeely, tarjeta: { id: string; negocio_id: string }, suscripcion: PushSubscription) {
  const json = suscripcion.toJSON()
  return cliente.from('suscripciones_push').upsert(
    {
      negocio_id: tarjeta.negocio_id,
      tarjeta_id: tarjeta.id,
      endpoint: suscripcion.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      agente_usuario: navigator.userAgent.slice(0, 300),
      revocada_en: null,
    },
    { onConflict: 'endpoint' },
  )
}

// Pide permiso, suscribe este dispositivo y lo guarda. false si la persona no da permiso.
export async function activarPush(cliente: ClienteBeely, tarjeta: { id: string; negocio_id: string }): Promise<boolean> {
  if (!pushDisponible() || !llavePublica) return false
  if ((await Notification.requestPermission()) !== 'granted') return false
  const registro = await navigator.serviceWorker.ready
  let suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeBase64Url(llavePublica) }))
  let { error } = await guardar(cliente, tarjeta, suscripcion)
  if (error?.code === '42501') {
    // El endpoint era de otra tarjeta en este mismo teléfono: se pide uno nuevo.
    await suscripcion.unsubscribe()
    suscripcion = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeBase64Url(llavePublica) })
    ;({ error } = await guardar(cliente, tarjeta, suscripcion))
  }
  if (error) throw error
  return true
}

// Revoca la suscripción de este dispositivo (opt-out en un toque).
export async function desactivarPush(cliente: ClienteBeely): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registro = await navigator.serviceWorker.getRegistration()
  const suscripcion = await registro?.pushManager.getSubscription()
  if (!suscripcion) return
  await cliente.from('suscripciones_push').update({ revocada_en: new Date().toISOString() }).eq('endpoint', suscripcion.endpoint)
  await suscripcion.unsubscribe()
}
