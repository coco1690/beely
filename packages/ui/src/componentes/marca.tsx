import { cn } from '../utilidades'

// Celda de panal: la forma base de la marca y de cada sello.
const HEXAGONO = 'M12 1.6c.5 0 1 .13 1.45.39l7.1 4.1c.9.52 1.45 1.48 1.45 2.52v8.2c0 1.04-.55 2-1.45 2.52l-7.1 4.1a2.9 2.9 0 0 1-2.9 0l-7.1-4.1A2.9 2.9 0 0 1 2 16.81v-8.2c0-1.04.55-2 1.45-2.52l7.1-4.1c.45-.26.95-.39 1.45-.39Z'

// Logo de Beely: una celda de panal con las franjas de la abeja. Toma el color del tema.
export function LogoBeely({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-7', className)} aria-hidden>
      <path d={HEXAGONO} className="fill-acento" />
      <path d="M5.5 10.2h13M5.5 14.2h13" className="stroke-sobre-acento" strokeWidth="1.7" strokeLinecap="round" opacity="0.85" />
      <circle cx="12" cy="6.4" r="1.1" className="fill-sobre-acento" opacity="0.85" />
    </svg>
  )
}

// Un sello de la tarjeta: celda llena o vacía.
export function Sello({ lleno, className }: { lleno: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-8', className)} aria-hidden>
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
