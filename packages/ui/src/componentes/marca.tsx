import type { CSSProperties } from 'react'
import { cn } from '../utilidades'

// Celda de panal: la forma base de la marca y de cada sello.
const HEXAGONO = 'M12 1.6c.5 0 1 .13 1.45.39l7.1 4.1c.9.52 1.45 1.48 1.45 2.52v8.2c0 1.04-.55 2-1.45 2.52l-7.1 4.1a2.9 2.9 0 0 1-2.9 0l-7.1-4.1A2.9 2.9 0 0 1 2 16.81v-8.2c0-1.04.55-2 1.45-2.52l7.1-4.1c.45-.26.95-.39 1.45-.39Z'

// Logo de Beely: una abeja dentro de una celda de panal. Toma el color del tema.
export function LogoBeely({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-7', className)} aria-hidden>
      <path d={HEXAGONO} className="fill-acento" />
      <g className="fill-sobre-acento">
        <ellipse cx="9.1" cy="8.6" rx="2.3" ry="1.7" transform="rotate(-25 9.1 8.6)" opacity="0.45" />
        <ellipse cx="14.9" cy="8.6" rx="2.3" ry="1.7" transform="rotate(25 14.9 8.6)" opacity="0.45" />
        <ellipse cx="12" cy="13.4" rx="3.4" ry="4.6" />
      </g>
      <path d="M8.9 12.4h6.2M9.2 15.2h5.6" className="stroke-acento" strokeWidth="1.3" strokeLinecap="round" />
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
