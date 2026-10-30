import { invocarFuncion } from "@beely/tipos/supabase";
import { supabase } from "./supabase";

export {
  ErrorBeely,
  mensajeDe,
  mensajeDeErrorSupabase,
} from "@beely/tipos/supabase";

// Llama una Edge Function con la sesión del equipo.
export const llamarFuncion = <T>(
  nombre: string,
  cuerpo: Record<string, unknown>,
) => invocarFuncion<T>(supabase, nombre, cuerpo);

// Conecta {slug}.hibeely.com al club: dominio en Vercel + CNAME en Hostinger (solo superadmin).
export const conectarDominioClub = (negocioId: string) =>
  llamarFuncion<{ dominio: string }>("club-dominio", { negocio_id: negocioId });

// Manda ya los push en cola del negocio (los de una campaña recién lanzada).
// Lo que no salga ahora (fuera de la franja horaria) lo manda pg_cron después.
export const enviarPushCampanas = (negocioId: string) =>
  llamarFuncion<{ enviados: number; fallidos: number; omitidos: number }>(
    "campanas-motor",
    { negocio_id: negocioId },
  );
