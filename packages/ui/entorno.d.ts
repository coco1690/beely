// Variables de entorno de Vite comunes a las apps (ver .env.example de cada una).
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_CLUB_DOMINIO_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
