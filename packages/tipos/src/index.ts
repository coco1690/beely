import { z } from 'zod'
import type { Database } from './database'

export type { Database, Json } from './database'

type EsquemaPublico = Database['public']

export type Tabla<T extends keyof EsquemaPublico['Tables']> = EsquemaPublico['Tables'][T]['Row']
export type InsertarEn<T extends keyof EsquemaPublico['Tables']> = EsquemaPublico['Tables'][T]['Insert']
export type ActualizarEn<T extends keyof EsquemaPublico['Tables']> = EsquemaPublico['Tables'][T]['Update']

// Celular en formato E.164, igual que el check de public.clientes.
export const esquemaCelular = z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Celular inválido')

// Contrato de errores de la API: { error: { codigo, mensaje } }
export const esquemaErrorApi = z.object({
  error: z.object({
    codigo: z.string(),
    mensaje: z.string(),
  }),
})
export type ErrorApi = z.infer<typeof esquemaErrorApi>
