// Clientes de Supabase para las Edge Functions.
//  * clienteUsuario: actúa con el JWT de quien llama → RLS aplica.
//  * clienteServicio: service_role, solo para la lógica de negocio (registrar_sello…).
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Database } from '../../../packages/tipos/src/database.ts'
import { ErrorApi } from './http.ts'

export type ClienteBeely = SupabaseClient<Database>

const url = () => Deno.env.get('SUPABASE_URL') ?? ''

export function clienteServicio(): ClienteBeely {
  return createClient<Database>(url(), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Valida el JWT del equipo y devuelve el usuario con un cliente que respeta RLS.
export async function usuarioAutenticado(peticion: Request): Promise<{ usuario: User; cliente: ClienteBeely }> {
  const autorizacion = peticion.headers.get('Authorization')
  if (!autorizacion?.startsWith('Bearer ')) throw new ErrorApi('no_autenticado', 401)

  const cliente = createClient<Database>(url(), Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: autorizacion } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await cliente.auth.getUser(autorizacion.slice('Bearer '.length))
  if (error || !data.user) throw new ErrorApi('no_autenticado', 401)
  return { usuario: data.user, cliente }
}
