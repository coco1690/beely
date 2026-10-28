// Google Wallet: la tarjeta de sellos como pase de fidelización (LoyaltyClass + LoyaltyObject).
//  * Una clase por programa (`{issuer}.programa-{programa_id}`): nombre, logo y color del negocio.
//  * Un objeto por tarjeta (`{issuer}.tarjeta-{tarjeta_id}`): sellos, premios, QR con el token.
//  * El enlace "Guardar en Google Wallet" es un JWT firmado con la cuenta de servicio que
//    solo nombra el objeto (ya creado por la API), así el JWT queda corto.
//  * Al sumar sellos se hace PATCH del objeto y Google actualiza el pase en el teléfono.
// Docs: https://developers.google.com/wallet/retail/loyalty-cards
import type { ClienteBeely } from './supabase.ts'
import { ErrorApi } from './http.ts'

const API = 'https://walletobjects.googleapis.com/walletobjects/v1'
const ALCANCE = 'https://www.googleapis.com/auth/wallet_object.issuer'

type CuentaServicio = { client_email: string; private_key: string }
export type ConfigWallet = { emisor: string; cuenta: CuentaServicio; dominioBase: string }

// Secretos: GOOGLE_WALLET_ISSUER_ID y GOOGLE_WALLET_SERVICE_ACCOUNT_JSON (el .json completo).
export function configuracionWallet(): ConfigWallet | null {
  const emisor = Deno.env.get('GOOGLE_WALLET_ISSUER_ID')?.trim()
  const json = Deno.env.get('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON')
  if (!emisor || !json) return null
  try {
    const cuenta = JSON.parse(json) as Partial<CuentaServicio>
    if (!cuenta.client_email || !cuenta.private_key) return null
    return {
      emisor,
      cuenta: { client_email: cuenta.client_email, private_key: cuenta.private_key },
      dominioBase: Deno.env.get('CLUB_DOMINIO_BASE') ?? 'hibeely.com',
    }
  } catch {
    console.error('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON no es un JSON válido')
    return null
  }
}

// ---------------------------------------------------------------------
// JWT RS256 con WebCrypto (sin dependencias)
// ---------------------------------------------------------------------
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const textoBase64url = (texto: string) => base64url(new TextEncoder().encode(texto))

const llaves = new Map<string, Promise<CryptoKey>>()
function llavePrivada(pem: string): Promise<CryptoKey> {
  let llave = llaves.get(pem)
  if (!llave) {
    const cuerpo = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
    const der = Uint8Array.from(atob(cuerpo), (c) => c.charCodeAt(0))
    llave = crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    llaves.set(pem, llave)
  }
  return llave
}

export async function firmarJwt(carga: Record<string, unknown>, llavePem: string): Promise<string> {
  const datos = `${textoBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${textoBase64url(JSON.stringify(carga))}`
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await llavePrivada(llavePem), new TextEncoder().encode(datos))
  return `${datos}.${base64url(new Uint8Array(firma))}`
}

// Token OAuth de la cuenta de servicio; se reutiliza mientras la función siga caliente.
let tokenCache: { valor: string; vence: number } | null = null
async function tokenAcceso(cuenta: CuentaServicio): Promise<string> {
  if (tokenCache && tokenCache.vence > Date.now() + 60_000) return tokenCache.valor
  const ahora = Math.floor(Date.now() / 1000)
  const asercion = await firmarJwt(
    { iss: cuenta.client_email, scope: ALCANCE, aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 },
    cuenta.private_key,
  )
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: asercion }),
  })
  if (!r.ok) {
    console.error('Google OAuth rechazó la cuenta de servicio', r.status, await r.text())
    throw new ErrorApi('wallet_fallo', 502)
  }
  const { access_token, expires_in } = (await r.json()) as { access_token: string; expires_in: number }
  tokenCache = { valor: access_token, vence: Date.now() + expires_in * 1000 }
  return access_token
}

async function llamar(c: ConfigWallet, metodo: string, ruta: string, cuerpo?: unknown): Promise<Response> {
  return fetch(`${API}/${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${await tokenAcceso(c.cuenta)}`, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
}

// Crea el recurso; si ya existe (409) lo reemplaza con PATCH.
async function guardar(c: ConfigWallet, recurso: 'loyaltyClass' | 'loyaltyObject', cuerpo: { id: string }) {
  let r = await llamar(c, 'POST', recurso, cuerpo)
  if (r.status === 409) r = await llamar(c, 'PATCH', `${recurso}/${encodeURIComponent(cuerpo.id)}`, cuerpo)
  if (!r.ok) {
    console.error(`Google Wallet no guardó ${recurso}`, r.status, await r.text())
    throw new ErrorApi('wallet_fallo', 502)
  }
}

// ---------------------------------------------------------------------
// Datos del pase
// ---------------------------------------------------------------------
const columnasPase = `id, negocio_id, token_publico, sellos_actuales, estado, programa_id,
  negocios!inner ( slug, nombre, logo_url, color_primario ),
  programas ( nombre, sellos_requeridos, premio_descripcion,
    disenos_tarjeta ( color_fondo, color_texto, logo_url, imagen_banda_url, titulo, version ) ),
  clientes ( nombre ),
  cupones ( estado, vence_en )`

export async function cargarTarjeta(servicio: ClienteBeely, filtro: { tarjetaId: string } | { slug: string; token: string }) {
  let consulta = servicio.from('tarjetas').select(columnasPase)
  consulta = 'tarjetaId' in filtro ? consulta.eq('id', filtro.tarjetaId) : consulta.eq('token_publico', filtro.token).eq('negocios.slug', filtro.slug)
  const { data, error } = await consulta.maybeSingle()
  if (error) throw error
  return data
}

export type TarjetaPase = NonNullable<Awaited<ReturnType<typeof cargarTarjeta>>>

// Igual que la PWA (PaginaTarjeta): mientras el negocio no cambie el diseño por defecto,
// el pase usa el color del negocio.
const FONDO_INICIAL = '#f5b301'
const TEXTO_INICIAL = '#1f1a17'

export const idClase = (c: ConfigWallet, programaId: string) => `${c.emisor}.programa-${programaId}`
export const idObjeto = (c: ConfigWallet, tarjetaId: string) => `${c.emisor}.tarjeta-${tarjetaId}`

const texto = (valor: string) => ({ defaultValue: { language: 'es-419', value: valor } })
const urlClub = (c: ConfigWallet, t: TarjetaPase) => `https://${t.negocios.slug}.${c.dominioBase}`

export function construirClase(c: ConfigWallet, t: TarjetaPase) {
  const d = t.programas?.disenos_tarjeta ?? null
  const propio = !!d && (d.color_fondo.toLowerCase() !== FONDO_INICIAL || d.color_texto.toLowerCase() !== TEXTO_INICIAL)
  const logo = d?.logo_url ?? t.negocios.logo_url ?? `${urlClub(c, t)}/icono-512.png`
  return {
    id: idClase(c, t.programa_id),
    issuerName: t.negocios.nombre,
    localizedIssuerName: texto(t.negocios.nombre),
    programName: d?.titulo ?? t.programas?.nombre ?? 'Tarjeta de sellos',
    programLogo: { sourceUri: { uri: logo }, contentDescription: texto(t.negocios.nombre) },
    ...(d?.imagen_banda_url ? { heroImage: { sourceUri: { uri: d.imagen_banda_url }, contentDescription: texto(t.negocios.nombre) } } : {}),
    hexBackgroundColor: propio ? d.color_fondo : t.negocios.color_primario,
    countryCode: 'CO',
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
  }
}

export function construirObjeto(c: ConfigWallet, t: TarjetaPase, ahora = new Date()) {
  const requeridos = t.programas?.sellos_requeridos ?? 10
  const faltan = Math.max(requeridos - t.sellos_actuales, 0)
  const premios = t.cupones.filter((p) => p.estado === 'emitido' && new Date(p.vence_en) > ahora).length
  return {
    id: idObjeto(c, t.id),
    classId: idClase(c, t.programa_id),
    state: t.estado === 'activa' ? 'ACTIVE' : 'INACTIVE',
    accountName: t.clientes?.nombre ?? '',
    loyaltyPoints: { label: 'Sellos', balance: { string: `${t.sellos_actuales}/${requeridos}` } },
    secondaryLoyaltyPoints: { label: premios === 1 ? 'Premio listo' : 'Premios listos', balance: { int: premios } },
    barcode: { type: 'QR_CODE', value: t.token_publico },
    textModulesData: [
      { id: 'premio', header: 'Premio', body: t.programas?.premio_descripcion ?? '' },
      {
        id: 'progreso',
        header: faltan === 0 ? '¡Completa!' : 'Te faltan',
        body: faltan === 0 ? 'Reclama tu premio en caja.' : `${faltan} ${faltan === 1 ? 'sello' : 'sellos'} para tu premio.`,
      },
    ],
    linksModuleData: { uris: [{ id: 'club', uri: `${urlClub(c, t)}/t/${t.token_publico}`, description: 'Ver mi tarjeta' }] },
  }
}

// Crea o actualiza clase y objeto, guarda el pase y devuelve el enlace de guardado.
export async function enlaceGuardar(c: ConfigWallet, servicio: ClienteBeely, t: TarjetaPase): Promise<string> {
  const clase = construirClase(c, t)
  await guardar(c, 'loyaltyClass', clase)
  const objeto = construirObjeto(c, t)
  await guardar(c, 'loyaltyObject', objeto)

  const { error: errorDiseno } = await servicio.from('disenos_tarjeta').update({ google_clase_id: clase.id }).eq('programa_id', t.programa_id)
  if (errorDiseno) throw errorDiseno
  const { error } = await servicio.from('pases_wallet').upsert(
    {
      negocio_id: t.negocio_id,
      tarjeta_id: t.id,
      plataforma: 'google',
      objeto_id: objeto.id,
      version_diseno: t.programas?.disenos_tarjeta?.version ?? 1,
      sincronizado_en: new Date().toISOString(),
    },
    { onConflict: 'tarjeta_id,plataforma' },
  )
  if (error) throw error

  const jwt = await firmarJwt(
    {
      iss: c.cuenta.client_email,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [urlClub(c, t)],
      payload: { loyaltyObjects: [{ id: objeto.id, classId: objeto.classId }] },
    },
    c.cuenta.private_key,
  )
  return `https://pay.google.com/gp/v/save/${jwt}`
}

// Tras un sello: si la tarjeta ya tiene pase de Google, lo actualiza. Nunca lanza: el sello
// ya quedó guardado y el pase se pone al día en la próxima sincronización.
export async function sincronizarPaseGoogle(servicio: ClienteBeely, tarjetaId: string): Promise<void> {
  try {
    const c = configuracionWallet()
    if (!c) return
    const { data: pase, error } = await servicio
      .from('pases_wallet')
      .select('id, version_diseno')
      .eq('tarjeta_id', tarjetaId)
      .eq('plataforma', 'google')
      .maybeSingle()
    if (error) throw error
    if (!pase) return

    const t = await cargarTarjeta(servicio, { tarjetaId })
    if (!t) return
    // Si el negocio cambió el diseño desde la última vez, también se actualiza la clase.
    const version = t.programas?.disenos_tarjeta?.version ?? 1
    if (version !== pase.version_diseno) await guardar(c, 'loyaltyClass', construirClase(c, t))

    const objeto = construirObjeto(c, t)
    const r = await llamar(c, 'PATCH', `loyaltyObject/${encodeURIComponent(objeto.id)}`, objeto)
    if (!r.ok) throw new Error(`PATCH loyaltyObject ${r.status}: ${await r.text()}`)
    await servicio.from('pases_wallet').update({ version_diseno: version, sincronizado_en: new Date().toISOString() }).eq('id', pase.id)
  } catch (error) {
    console.error('No se pudo sincronizar el pase de Google Wallet', tarjetaId, error)
  }
}

// En Supabase Edge Runtime el trabajo sigue después de responder; en otro entorno se espera.
type Runtime = { waitUntil: (promesa: Promise<unknown>) => void }
export function enSegundoPlano(promesa: Promise<unknown>): Promise<unknown> | undefined {
  const runtime = (globalThis as { EdgeRuntime?: Runtime }).EdgeRuntime
  if (runtime) return void runtime.waitUntil(promesa)
  return promesa
}
