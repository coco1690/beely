// Utilidades de presentación del panel.

export const zonasHorarias: string[] = Intl.supportedValuesOf('timeZone')

export function fechaHora(valor: string | null | undefined, zona?: string): string {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: zona }).format(new Date(valor))
}

export function fecha(valor: string | null | undefined, zona?: string): string {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: zona }).format(new Date(valor))
}

export function pesos(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

// +573001234567 → +57 300 ••• 4567 (el cajero confirma sin exponer el número completo).
export function celularOculto(celular: string): string {
  const final = celular.slice(-4)
  const inicio = celular.startsWith('+57') ? `+57 ${celular.slice(3, 6)}` : celular.slice(0, 6)
  return `${inicio} ••• ${final}`
}

// Lo que se escribe en caja: un celular colombiano de 10 dígitos o en E.164.
export function normalizarCelular(texto: string): string | null {
  const limpio = texto.replace(/[\s()-]/g, '')
  if (/^3\d{9}$/.test(limpio)) return `+57${limpio}`
  if (/^57\d{10}$/.test(limpio)) return `+${limpio}`
  if (/^\+[1-9]\d{7,14}$/.test(limpio)) return limpio
  return null
}

// El QR puede traer solo el token o la URL de la PWA (https://{slug}.hibeely.com/t/{token}).
export function extraerToken(texto: string): string {
  const limpio = texto.trim()
  try {
    const url = new URL(limpio)
    const partes = url.pathname.split('/').filter(Boolean)
    return url.searchParams.get('t') ?? partes.at(-1) ?? limpio
  } catch {
    return limpio
  }
}

export const nombresRol: Record<string, string> = {
  plataforma: 'Plataforma',
  dueno: 'Dueño',
  administrador: 'Administrador',
  cajero: 'Cajero',
}
