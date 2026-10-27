import { invocarFuncion } from '@beely/tipos/supabase'
import { supabase } from './supabase'

export { ErrorBeely, mensajeDe, mensajeDeErrorSupabase } from '@beely/tipos/supabase'

// Llama una Edge Function con la sesión del equipo.
export const llamarFuncion = <T,>(nombre: string, cuerpo: Record<string, unknown>) => invocarFuncion<T>(supabase, nombre, cuerpo)
