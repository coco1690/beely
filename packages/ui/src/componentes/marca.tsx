import { useEffect, useId, useState, type CSSProperties } from 'react'
import { analizarLogo, type AnalisisLogo } from './analizar-logo'
import { cn } from '../utilidades'
import { LETRA_B, PALABRA } from './trazos-logo'

// Celda de panal: la forma de cada sello.
const HEXAGONO = 'M12 1.6c.5 0 1 .13 1.45.39l7.1 4.1c.9.52 1.45 1.48 1.45 2.52v8.2c0 1.04-.55 2-1.45 2.52l-7.1 4.1a2.9 2.9 0 0 1-2.9 0l-7.1-4.1A2.9 2.9 0 0 1 2 16.81v-8.2c0-1.04.55-2 1.45-2.52l7.1-4.1c.45-.26.95-.39 1.45-.39Z'

// Degradado de la marca Beely: coral a rosa. Es fijo, no sigue el color del tema, y
// se lee igual sobre fondo claro y oscuro.
function DegradadoBeely({ id, ancho, alto }: { id: string; ancho: number; alto: number }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={alto} x2={ancho} y2="0">
      <stop offset="0" stopColor="#F47B5E" />
      <stop offset="1" stopColor="#E7577F" />
    </linearGradient>
  )
}

// Logo de Beely: la palabra en cursiva. Para el ingreso y cabeceras con espacio a lo ancho.
export function LogoBeely({ className }: { className?: string }) {
  const id = useId()
  const { ancho, alto, d } = PALABRA
  return (
    <svg viewBox={`-4 -4 ${ancho + 8} ${alto + 8}`} className={cn('h-8 w-auto', className)} role="img" aria-label="Beely">
      <defs>
        <DegradadoBeely id={id} ancho={ancho} alto={alto} />
      </defs>
      <path d={d} fill={`url(#${id})`} />
    </svg>
  )
}

// Marca cuadrada de Beely: la "B" del logo. Para espacios donde no cabe la palabra.
export function MarcaBeely({ className }: { className?: string }) {
  const id = useId()
  const { ancho, alto, d } = LETRA_B
  const lado = Math.max(ancho, alto) + 16
  return (
    <svg viewBox={`${(ancho - lado) / 2} ${(alto - lado) / 2} ${lado} ${lado}`} className={cn('size-7', className)} aria-hidden>
      <defs>
        <DegradadoBeely id={id} ancho={ancho} alto={alto} />
      </defs>
      <path d={d} fill={`url(#${id})`} />
    </svg>
  )
}

// Un sello de la tarjeta: celda llena o vacía.
export function Sello({ lleno, className, style }: { lleno: boolean; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-8', className)} style={style} aria-hidden>
      <path
        d={HEXAGONO}
        className={lleno ? 'fill-acento' : 'fill-hundido stroke-borde-fuerte'}
        strokeWidth={lleno ? 0 : 1.2}
        strokeDasharray={lleno ? undefined : '2.4 2.2'}
      />
      {lleno ? <path d="m8.3 12.3 2.4 2.4 5-5" fill="none" className="stroke-sobre-acento" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  )
}

// Logo del negocio (marca blanca), sin marco blanco: si el logo es una figura sobre
// fondo liso se recorta y se muestra la figura sola; si llena el cuadro, va a sangre.
// Solo los logos de trazos sobre fondo transparente llevan base clara, para leerse en
// tema oscuro. Sin logo, muestra la marca de Beely.
export function LogoNegocio({ url, nombre, className }: { url: string | null | undefined; nombre: string; className?: string }) {
  const [analisis, setAnalisis] = useState<{ url: string; resultado: AnalisisLogo } | null>(null)

  useEffect(() => {
    if (!url) return
    let vigente = true
    void analizarLogo(url).then((resultado) => vigente && setAnalisis({ url, resultado }))
    return () => {
      vigente = false
    }
  }, [url])

  if (!url) return <MarcaBeely className={className} />
  const resultado = analisis?.url === url ? analisis.resultado : null
  const base = 'relative inline-flex size-7 shrink-0 items-center justify-center rounded-[24%]'
  // Filo fino por encima de la imagen: separa el logo del fondo en claro y en oscuro.
  const filo =
    'overflow-hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-black/8 dark:after:ring-white/10'
  const alt = `Logo de ${nombre}`

  if (!resultado) return <span className={cn(base, 'animate-pulse bg-hundido', className)} aria-label={alt} role="img" />

  if (resultado.modo === 'forma')
    return (
      <span className={cn(base, resultado.baldosa && filo, className)}>
        <img src={resultado.src} alt={alt} className={cn('size-full', resultado.baldosa ? 'object-cover' : 'object-contain')} />
      </span>
    )

  if (resultado.modo === 'claro')
    return (
      <span className={cn(base, filo, 'bg-white', className)}>
        <img src={url} alt={alt} className="size-full object-contain p-[14%]" />
      </span>
    )

  return (
    <span className={cn(base, filo, 'bg-hundido', className)}>
      <img src={url} alt={alt} className="size-full object-cover" decoding="async" />
    </span>
  )
}
