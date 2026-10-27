import type { HTMLAttributes } from 'react'
import { cn } from '../utilidades'

// Móvil: barra de secciones flotante sobre el contenido. Usa la superficie del tema
// (clara u oscura) y la sección activa va en una píldora del acento.
// Las pestañas las pone cada app (NavLink del router) con `clasePestana`.
export function BarraFlotante({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <nav
      aria-label="Secciones"
      className={cn(
        'fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex gap-1 rounded-capa border border-borde bg-superficie/90 p-1.5 shadow-capa backdrop-blur-lg',
        className,
      )}
      {...props}
    />
  )
}

export function clasePestana(activa: boolean): string {
  return cn(
    'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-tarjeta border border-transparent text-[11px] font-medium text-texto-3 transition-colors hover:text-texto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco [&_svg]:size-5',
    activa && 'border-acento-borde bg-acento-suave text-texto [&_svg]:text-acento-texto',
  )
}
