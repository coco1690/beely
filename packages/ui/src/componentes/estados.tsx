import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utilidades'

// Bloque gris con la forma del contenido que viene. Late solo si se permite movimiento.
export function Esqueleto({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-control bg-hundido motion-safe:animate-pulse', className)} aria-hidden {...props} />
}

// Lista vacía: qué falta y, si aplica, cómo seguir.
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono?: ReactNode
  titulo: string
  descripcion?: ReactNode
  accion?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-1 px-4 py-8 text-center', className)}>
      {icono ? (
        <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-hundido text-texto-3 [&_svg]:size-5" aria-hidden>
          {icono}
        </span>
      ) : null}
      <p className="text-sm font-medium text-texto">{titulo}</p>
      {descripcion ? <p className="max-w-xs text-etiqueta text-texto-3">{descripcion}</p> : null}
      {accion ? <div className="mt-3">{accion}</div> : null}
    </div>
  )
}

// Lista con filas y divisores, en lugar de una tarjeta por elemento.
export function Lista({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('divide-y divide-borde', className)} {...props} />
}

export function FilaLista({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cn('flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5', className)} {...props} />
}
