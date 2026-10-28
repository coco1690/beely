// club-dominio: conecta {slug}.hibeely.com al club del negocio (solo superadmin).
// Los DNS de hibeely.com siguen en Hostinger, así que el comodín no sirve: cada
// negocio lleva su propio CNAME. Orden:
//  1. Vercel: agrega el dominio al proyecto del club (así nadie más puede reclamarlo).
//  2. Hostinger: crea o reemplaza el CNAME {slug} → CLUB_CNAME_DESTINO.
// Se puede repetir sin efectos: si el dominio ya está en el proyecto o el CNAME
// ya existe, solo se confirma.
//
// POST { negocio_id }
//   200 → { dominio }
//   4xx/5xx → { error: { codigo, mensaje } }
import { esSlugReservado, esquemaClubDominio } from '../../../packages/tipos/src/esquemas.ts'
import { ErrorApi, leerJson, responderError, responderJson, servir } from '../_compartido/http.ts'
import { clienteServicio, usuarioAutenticado } from '../_compartido/supabase.ts'

function configuracion() {
  const valores = {
    vercelToken: Deno.env.get('VERCEL_TOKEN'),
    vercelEquipo: Deno.env.get('VERCEL_EQUIPO_ID'),
    vercelProyecto: Deno.env.get('VERCEL_PROYECTO_CLUB'),
    hostingerToken: Deno.env.get('HOSTINGER_API_TOKEN'),
    destino: Deno.env.get('CLUB_CNAME_DESTINO'),
  }
  if (Object.values(valores).some((v) => !v)) throw new ErrorApi('dominio_no_configurado', 503)
  return valores as { [K in keyof typeof valores]: string }
}

async function agregarEnVercel(c: ReturnType<typeof configuracion>, dominio: string) {
  const base = `https://api.vercel.com/v10/projects/${c.vercelProyecto}/domains`
  const cabeceras = { Authorization: `Bearer ${c.vercelToken}`, 'Content-Type': 'application/json' }
  const r = await fetch(`${base}?teamId=${c.vercelEquipo}`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ name: dominio }),
  })
  if (r.ok) return
  // 409: ya existe. Sirve solo si es de este mismo proyecto.
  if (r.status === 409) {
    const propio = await fetch(`https://api.vercel.com/v9/projects/${c.vercelProyecto}/domains/${dominio}?teamId=${c.vercelEquipo}`, {
      headers: cabeceras,
    })
    if (propio.ok) return
  }
  console.error('Vercel no agregó el dominio', r.status, await r.text())
  throw new ErrorApi('dominio_fallo', 502)
}

async function crearCname(c: ReturnType<typeof configuracion>, base: string, slug: string) {
  // overwrite: true reemplaza solo los registros con el mismo nombre y tipo.
  const r = await fetch(`https://developers.hostinger.com/api/dns/v1/zones/${base}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${c.hostingerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      overwrite: true,
      zone: [{ name: slug, type: 'CNAME', ttl: 300, records: [{ content: `${c.destino.replace(/\.$/, '')}.` }] }],
    }),
  })
  if (r.ok) return
  console.error('Hostinger no creó el CNAME', r.status, await r.text())
  throw new ErrorApi('dominio_fallo', 502)
}

servir(async (peticion) => {
  const { usuario, cliente } = await usuarioAutenticado(peticion)

  const datos = esquemaClubDominio.safeParse(await leerJson(peticion))
  if (!datos.success) return responderError('solicitud_invalida', 400)

  // La fila de superadmins solo la ve un superadmin (RLS).
  const { data: superadmin } = await cliente.from('superadmins').select('usuario_id').eq('usuario_id', usuario.id).maybeSingle()
  if (!superadmin) return responderError('sin_permiso', 403)

  const { data: negocio, error } = await clienteServicio().from('negocios').select('slug').eq('id', datos.data.negocio_id).maybeSingle()
  if (error) throw error
  if (!negocio) return responderError('negocio_no_encontrado', 404)
  if (esSlugReservado(negocio.slug)) return responderError('slug_reservado', 409)

  const c = configuracion()
  const base = Deno.env.get('CLUB_DOMINIO_BASE') ?? 'hibeely.com'
  const dominio = `${negocio.slug}.${base}`
  await agregarEnVercel(c, dominio)
  await crearCname(c, base, negocio.slug)

  return responderJson({ dominio })
})
