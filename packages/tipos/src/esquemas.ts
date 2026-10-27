// Esquemas zod compartidos entre el panel, la PWA y las Edge Functions.
// Las Edge Functions (Deno) importan este archivo por ruta relativa; por eso
// solo depende de `zod`, que cada función resuelve con su deno.json.
import { z } from 'zod'

// guid: acepta cualquier uuid con formato (los ids de la semilla no son v4).
export const esquemaUuid = z.guid('Identificador inválido')

// Celular en formato E.164, igual que el check de public.clientes.
export const esquemaCelular = z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Celular inválido')

const esquemaColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Usa un color como #F5B301')

export const rolesEquipo = ['dueno', 'administrador', 'cajero'] as const
export const esquemaRol = z.enum(rolesEquipo)
export type RolEquipo = z.infer<typeof esquemaRol>

// Token de la tarjeta tal como viene del QR o escrito a mano en caja.
export const esquemaTokenTarjeta = z.string().trim().min(8, 'Token muy corto').max(200, 'Token muy largo')

// ---------------------------------------------------------------------
// Edge Functions del panel
// ---------------------------------------------------------------------

// POST /functions/v1/panel-sello
export const esquemaPanelSello = z.object({
  negocio_id: esquemaUuid,
  token: esquemaTokenTarjeta,
  sede_id: esquemaUuid.nullable().optional(),
  // Según la regla del programa: monto para por_monto / monto mínimo, unidades para por_unidad.
  monto_venta: z.number().positive().max(9_999_999_999).nullable().optional(),
  unidades: z.number().int().min(1).max(100).optional(),
  // Una por intento de sello: si la red repite la petición no se suma dos veces.
  clave_idempotencia: esquemaUuid,
})
export type PanelSello = z.infer<typeof esquemaPanelSello>

export const esquemaResultadoSello = z.object({
  duplicado: z.boolean(),
  tarjeta_id: z.string(),
  sellos_sumados: z.number().optional(),
  sellos_actuales: z.number(),
  sellos_requeridos: z.number().optional(),
  premio_emitido: z.boolean(),
  motivo: z.string().optional(),
  detalle: z.enum(['tope_diario', 'compra_no_aplica']).optional(),
  cupon: z
    .object({ id: z.string(), codigo: z.string(), descripcion: z.string(), vence_en: z.string() })
    .nullable()
    .optional(),
})
export type ResultadoSello = z.infer<typeof esquemaResultadoSello>

// POST /functions/v1/panel-equipo
export const esquemaInvitarMiembro = z.object({
  negocio_id: esquemaUuid,
  email: z.email('Correo inválido').trim().toLowerCase(),
  rol: esquemaRol,
})
export type InvitarMiembro = z.infer<typeof esquemaInvitarMiembro>

// ---------------------------------------------------------------------
// Formularios del panel
// ---------------------------------------------------------------------

export const esquemaIngreso = z.object({
  email: z.email('Correo inválido').trim().toLowerCase(),
  clave: z.string().min(8, 'Mínimo 8 caracteres'),
})

export const esquemaNuevaClave = z
  .object({
    clave: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmacion: z.string(),
  })
  .refine((v) => v.clave === v.confirmacion, { message: 'Las claves no coinciden', path: ['confirmacion'] })

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullable()

export const esquemaSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/, 'Solo minúsculas, números y guiones (3 a 40)')

export const esquemaCrearNegocio = z.object({
  slug: esquemaSlug,
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  zona_horaria: z.string().min(1),
})

export const esquemaMarcaNegocio = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  razon_social: textoOpcional(120),
  nit: textoOpcional(20),
  color_primario: esquemaColor,
  color_secundario: esquemaColor,
  zona_horaria: z.string().min(1),
})

export const esquemaSede = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  direccion: textoOpcional(160),
  latitud: z.number().min(-90).max(90).nullable(),
  longitud: z.number().min(-180).max(180).nullable(),
  activa: z.boolean(),
})

export const reglasSello = ['por_venta', 'por_unidad', 'por_monto'] as const

export const esquemaPrograma = z
  .object({
    nombre: z.string().trim().min(2).max(60),
    sellos_requeridos: z.number().int().min(2, 'Mínimo 2').max(30, 'Máximo 30'),
    regla_sello: z.enum(reglasSello),
    monto_minimo: z.number().positive('Debe ser mayor que 0').nullable(),
    monto_por_sello: z.number().positive('Debe ser mayor que 0').nullable(),
    max_sellos_dia: z.number().int().min(1, 'Mínimo 1').max(50, 'Máximo 50'),
    premio_descripcion: z.string().trim().min(2).max(80),
    premio_vigencia_dias: z.number().int().min(1).max(365),
  })
  .refine((v) => v.regla_sello !== 'por_monto' || v.monto_por_sello !== null, {
    message: 'Con la regla "por monto" indica cuánto vale cada sello',
    path: ['monto_por_sello'],
  })

// ---------------------------------------------------------------------
// Errores: los códigos salen de las excepciones de las funciones SQL.
// ---------------------------------------------------------------------
export const mensajesError: Record<string, string> = {
  tarjeta_no_encontrada: 'No encontramos esa tarjeta en este negocio.',
  tarjeta_bloqueada: 'La tarjeta está bloqueada.',
  programa_inactivo: 'El programa de sellos está inactivo.',
  negocio_inactivo: 'El negocio no está activo; no se pueden sumar sellos.',
  sede_no_encontrada: 'La sede no existe o está inactiva.',
  origen_invalido: 'Origen de sello inválido.',
  cupon_no_encontrado: 'No encontramos ese cupón.',
  cupon_ya_canjeado: 'Ese cupón ya fue canjeado.',
  cupon_no_disponible: 'Ese cupón no está disponible.',
  cupon_vencido: 'Ese cupón está vencido.',
  sin_permiso: 'No tienes permiso para esta acción.',
  no_autenticado: 'Tu sesión expiró. Vuelve a ingresar.',
  solicitud_invalida: 'Revisa los datos enviados.',
  slug_en_uso: 'Ese subdominio ya está en uso.',
  zona_horaria_invalida: 'Zona horaria inválida.',
  ya_es_miembro: 'Esa persona ya es parte del equipo.',
  error_interno: 'Algo salió mal. Intenta de nuevo.',
}

export const mensajeDeError = (codigo: string): string => mensajesError[codigo] ?? mensajesError.error_interno ?? codigo
