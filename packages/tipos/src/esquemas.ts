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

// POST /functions/v1/panel-canje
export const esquemaPanelCanje = z.object({
  negocio_id: esquemaUuid,
  codigo: z.string().trim().min(4, 'Código muy corto').max(40, 'Código muy largo'),
  sede_id: esquemaUuid.nullable().optional(),
  // Una por intento de canje: si la red repite la petición responde duplicado sin fallar.
  clave_idempotencia: esquemaUuid,
})
export type PanelCanje = z.infer<typeof esquemaPanelCanje>

export const esquemaResultadoCanje = z.object({
  duplicado: z.boolean(),
  cupon_id: z.string(),
  estado: z.string(),
  descripcion: z.string().optional(),
})
export type ResultadoCanje = z.infer<typeof esquemaResultadoCanje>

// POST /functions/v1/panel-equipo
export const esquemaInvitarMiembro = z.object({
  negocio_id: esquemaUuid,
  email: z.email('Correo inválido').trim().toLowerCase(),
  rol: esquemaRol,
  // Opcional: si llega y el correo no tiene cuenta, se crea con esta clave y sin correo de invitación.
  clave: z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres').optional(),
})
export type InvitarMiembro = z.infer<typeof esquemaInvitarMiembro>

// ---------------------------------------------------------------------
// Club (PWA del cliente)
// ---------------------------------------------------------------------

// Edad mínima para registrarse sin autorización de un adulto (Ley 1581, datos de menores).
export const edadMinimaClub = 14

// AAAA-MM-DD, no futura, desde 1900 y con la edad mínima cumplida.
export const esquemaFechaNacimiento = z.iso
  .date('Fecha inválida')
  .refine((v) => v >= '1900-01-01', 'Fecha inválida')
  .refine((v) => {
    const hoy = new Date()
    const limite = new Date(Date.UTC(hoy.getUTCFullYear() - edadMinimaClub, hoy.getUTCMonth(), hoy.getUTCDate()))
    return v <= limite.toISOString().slice(0, 10)
  }, `Debes tener al menos ${edadMinimaClub} años`)

export const esquemaNombreCliente = z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres')

// POST /functions/v1/club-registro
export const esquemaClubRegistro = z.object({
  slug: z.string().trim().toLowerCase().min(3).max(40),
  nombre: esquemaNombreCliente,
  celular: esquemaCelular,
  fecha_nacimiento: esquemaFechaNacimiento,
  acepta_datos: z.literal(true, 'Necesitamos tu autorización para crear la tarjeta'),
  acepta_marketing: z.boolean(),
})
export type ClubRegistro = z.infer<typeof esquemaClubRegistro>

export const esquemaResultadoRegistro = z.object({ token: z.string() })

// POST /functions/v1/wallet-google: enlace para guardar la tarjeta en Google Wallet.
export const esquemaWalletGoogle = z.object({
  slug: z.string().trim().toLowerCase().min(3).max(40),
  token: esquemaTokenTarjeta,
})

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

// Contraseña inicial opcional en los formularios del panel: vacía = invitación por correo.
export const esquemaClaveInicial = z
  .string()
  .max(72, 'Máximo 72 caracteres')
  .refine((v) => v === '' || v.length >= 8, 'Mínimo 8 caracteres')

// Cambiar la clave desde el panel: se confirma la actual antes de guardar la nueva.
export const esquemaCambiarClave = z
  .object({
    actual: z.string().min(1, 'Escribe tu clave actual'),
    clave: z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres'),
    confirmacion: z.string(),
  })
  .refine((v) => v.clave === v.confirmacion, { message: 'Las claves no coinciden', path: ['confirmacion'] })
  .refine((v) => v.clave !== v.actual, { message: 'La clave nueva debe ser distinta', path: ['clave'] })

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullable()

// Subdominios de hibeely.com que no pueden ser el club de un negocio.
export const slugsReservados = ['app', 'www', 'api', 'admin', 'panel', 'club', 'mail', 'correo', 'soporte', 'ayuda', 'docs', 'blog', 'status'] as const
export const esSlugReservado = (slug: string): boolean => (slugsReservados as readonly string[]).includes(slug)

export const esquemaSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/, 'Solo minúsculas, números y guiones (3 a 40)')
  .refine((slug) => !esSlugReservado(slug), 'Ese subdominio está reservado')

export const esquemaCrearNegocio = z.object({
  slug: esquemaSlug,
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  zona_horaria: z.string().min(1),
})

// POST /functions/v1/club-dominio (superadmin): conecta {slug}.hibeely.com al club.
export const esquemaClubDominio = z.object({ negocio_id: esquemaUuid })

// Superadmin: agregar a otro superadmin por correo.
export const esquemaAgregarSuperadmin = z.object({
  email: z.email('Correo inválido').trim().toLowerCase(),
})

// Superadmin: plan de Beely. Los límites vacíos (null) son "sin límite".
export const esquemaCodigoPlan = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9_]{0,28}[a-z0-9])?$/, 'Solo minúsculas, números y guion bajo (máximo 30)')

const limitePlan = (max: number) =>
  z.number('Escribe un número').int('Sin decimales').min(1, 'Mínimo 1').max(max, `Máximo ${max}`).nullable()

export const esquemaPlan = z.object({
  codigo: esquemaCodigoPlan,
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(40, 'Máximo 40 caracteres'),
  descripcion: textoOpcional(200),
  precio_mensual: z.number('Escribe un precio').min(0, 'No puede ser negativo').max(9_999_999_999, 'Precio muy alto'),
  max_sedes: limitePlan(1000),
  max_clientes: limitePlan(10_000_000),
  activo: z.boolean(),
})
export type Plan = z.infer<typeof esquemaPlan>

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
// Campañas de promociones (migración 0009). Las validaciones repiten las de
// public.campana_guardar(); las fechas son días (AAAA-MM-DD) del negocio.
// ---------------------------------------------------------------------
export const tiposPromocion = ['porcentaje', 'monto_fijo', 'producto_gratis', 'dos_por_uno'] as const
export type TipoPromocion = (typeof tiposPromocion)[number]
export const segmentosCampana = ['todos', 'inactivos', 'cumple', 'nuevos'] as const
export type SegmentoCampana = (typeof segmentosCampana)[number]

const esquemaDia = z.iso.date('Elige una fecha')

export const esquemaCampana = z
  .object({
    tipo: z.enum(tiposPromocion),
    valor: z.number('Escribe un número').positive('Debe ser mayor que 0').nullable(),
    producto: z.string().trim().max(80, 'Máximo 80 caracteres'),
    titulo: z.string().trim().min(3, 'Mínimo 3 caracteres').max(60, 'Máximo 60 caracteres'),
    mensaje: z.string().trim().max(180, 'Máximo 180 caracteres'),
    filtro: z.enum(segmentosCampana),
    inicia: esquemaDia,
    termina: esquemaDia,
  })
  .refine((v) => !(v.tipo === 'porcentaje' || v.tipo === 'monto_fijo') || v.valor !== null, {
    message: 'Escribe el descuento',
    path: ['valor'],
  })
  .refine((v) => v.tipo !== 'porcentaje' || v.valor === null || v.valor <= 100, {
    message: 'Máximo 100%',
    path: ['valor'],
  })
  .refine((v) => !(v.tipo === 'producto_gratis' || v.tipo === 'dos_por_uno') || v.producto.length > 0, {
    message: 'Escribe el producto',
    path: ['producto'],
  })
  .refine((v) => v.termina >= v.inicia, { message: 'Termina antes de empezar', path: ['termina'] })
export type Campana = z.infer<typeof esquemaCampana>

// ---------------------------------------------------------------------
// Errores: los códigos salen de las excepciones de las funciones SQL.
// ---------------------------------------------------------------------
export const mensajesError: Record<string, string> = {
  tarjeta_no_encontrada: 'No encontramos esa tarjeta en este negocio.',
  tarjeta_bloqueada: 'La tarjeta está bloqueada.',
  programa_inactivo: 'El programa de sellos está inactivo.',
  negocio_inactivo: 'El negocio no está activo; no puede sumar sellos ni lanzar campañas.',
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
  slug_reservado: 'Ese subdominio está reservado.',
  dominio_no_configurado: 'Falta configurar las llaves de Vercel y Hostinger para crear subdominios.',
  dominio_fallo: 'No se pudo conectar el subdominio del club. Intenta de nuevo desde la ficha del negocio.',
  zona_horaria_invalida: 'Zona horaria inválida.',
  ya_es_miembro: 'Esa persona ya es parte del equipo.',
  negocio_no_encontrado: 'No encontramos este club.',
  celular_ya_registrado: 'Este número ya tiene tarjeta; pide en caja que te la reenvíen o verifica tu número.',
  demasiados_intentos: 'Demasiados intentos. Espera un rato y vuelve a intentarlo.',
  confirmacion_incorrecta: 'Escribe el subdominio exacto del negocio para confirmar.',
  usuario_no_encontrado: 'No hay una cuenta de Beely con ese correo. Primero debe ingresar o ser invitada a un negocio.',
  ya_es_superadmin: 'Esa persona ya es superadmin.',
  clave_actual_incorrecta: 'Tu clave actual no es correcta.',
  plan_no_disponible: 'Ese plan no existe o está desactivado.',
  no_puedes_quitarte: 'No puedes quitarte a ti mismo; pídeselo a otro superadmin.',
  wallet_no_configurado: 'Google Wallet aún no está disponible para este club.',
  wallet_fallo: 'Google Wallet no respondió. Intenta de nuevo en un momento.',
  fechas_invalidas: 'Revisa las fechas: empieza hoy o después y dura hasta un año.',
  campana_no_encontrada: 'No encontramos esa campaña.',
  campana_no_editable: 'Esa campaña ya se lanzó; ya no se puede cambiar.',
  campana_vencida: 'Las fechas de esa campaña ya pasaron. Cámbialas para lanzarla.',
  error_interno: 'Algo salió mal. Intenta de nuevo.',
}

export const mensajeDeError = (codigo: string): string => mensajesError[codigo] ?? mensajesError.error_interno ?? codigo

// Logo del negocio (marca blanca) en el bucket público `logos` de Storage.
// La ruta empieza por el id del negocio: las políticas de Storage la usan para dar permiso.
export const bucketLogos = 'logos'
export const tiposLogo = ['image/png', 'image/jpeg', 'image/webp'] as const
export const pesoMaximoLogo = 2 * 1024 * 1024
const extensionesLogo: Record<(typeof tiposLogo)[number], string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export const esquemaArchivoLogo = z.object({
  type: z.enum(tiposLogo, 'El logo debe ser PNG, JPG o WebP'),
  size: z.number().max(pesoMaximoLogo, 'El logo debe pesar menos de 2 MB'),
})

// Nombre nuevo en cada subida: la URL pública cambia y ningún caché muestra el logo viejo.
export const rutaLogo = (negocioId: string, tipo: (typeof tiposLogo)[number]): string =>
  `${negocioId}/logo-${Date.now()}.${extensionesLogo[tipo]}`

// Ruta dentro del bucket a partir de la URL pública guardada en negocios.logo_url.
export const rutaDeUrlLogo = (url: string): string | null => {
  const marca = `/object/public/${bucketLogos}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length).split('?')[0] ?? '')
}
