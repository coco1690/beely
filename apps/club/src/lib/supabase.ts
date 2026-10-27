import { crearClienteBeely, type ClienteBeely } from '@beely/tipos/supabase'

// El cliente final no tiene sesión: la anon key + las cabeceras que lee RLS
// (x-negocio-slug, x-tarjeta-token). Un cliente por combinación, creado una vez.
const clientes = new Map<string, ClienteBeely>()

export function clienteClub(slug: string, token?: string | null): ClienteBeely {
  const llave = `${slug}|${token ?? ''}`
  let cliente = clientes.get(llave)
  if (!cliente) {
    cliente = crearClienteBeely(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { 'x-negocio-slug': slug, ...(token ? { 'x-tarjeta-token': token } : {}) } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `beely-club-${clientes.size}` },
    })
    clientes.set(llave, cliente)
  }
  return cliente
}
