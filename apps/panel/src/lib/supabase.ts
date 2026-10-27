import { crearClienteBeely } from '@beely/tipos/supabase'

export const supabase = crearClienteBeely(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
