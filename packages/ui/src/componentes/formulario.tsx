import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from 'react'
import { cn } from '../utilidades'

const claseControl =
  'h-10 w-full rounded-xl border border-borde bg-superficie px-3 text-sm text-texto shadow-suave transition-colors placeholder:text-texto-3 hover:border-borde-fuerte focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento/20 disabled:bg-hundido disabled:shadow-none aria-invalid:border-peligro aria-invalid:ring-peligro/15'

export function Entrada({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(claseControl, className)} {...props} />
}

export function Selector({ className, ref, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select ref={ref} className={cn(claseControl, 'pr-8', className)} {...props} />
}

export function Etiqueta({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-texto-2', className)} {...props} />
}

// Etiqueta + control + ayuda o error, con el id enlazado.
export function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
  className,
}: {
  id: string
  etiqueta: string
  error?: string | undefined
  ayuda?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
      {children}
      {error ? (
        <p className="text-xs text-peligro" role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-texto-3">{ayuda}</p>
      ) : null}
    </div>
  )
}
