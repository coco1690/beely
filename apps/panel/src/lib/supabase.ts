import { createClient } from '@supabase/supabase-js'
import type { Database } from '@beely/tipos'

const url = import.meta.env.VITE_SUPABASE_URL
const llaveAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !llaveAnon) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY (copia apps/panel/.env.example a .env.local)')
}

// Cliente con la anon key: todo lo que lee el panel pasa por RLS.
export const supabase = createClient<Database>(url, llaveAnon)
