import { z } from 'zod'
import type { Database } from './database'

export type { Database, Json } from './database'
export * from './esquemas'

type EsquemaPublico = Database['public']

export type Tabla<T extends keyof EsquemaPublico['Tables']> = EsquemaPublico['Tables'][T]['Row']
export type InsertarEn<T extends keyof EsquemaPublico['Tables']> = EsquemaPublico['Tables'][T]['Insert']
export type ActualizarEn<T extends keyof EsquemaPublico['Tables']> = EsquemaPublico['Tables'][T]['Update']

// Contrato de errores de la API: { error: { codigo, mensaje } }
export const esquemaErrorApi = z.object({
  error: z.object({
    codigo: z.string(),
    mensaje: z.string(),
  }),
})
export type ErrorApi = z.infer<typeof esquemaErrorApi>
