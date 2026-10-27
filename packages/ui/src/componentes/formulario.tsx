import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from 'react'
import { cn } from '../utilidades'

const claseControl =
  'h-10 w-full rounded-lg border border-colmena-300 bg-white px-3 text-sm text-colmena-900 placeholder:text-colmena-500 focus:border-miel-500 focus:outline-2 focus:outline-miel-200 disabled:bg-colmena-50 aria-invalid:border-red-500'

export function Entrada({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(claseControl, className)} {...props} />
}

export function Selector({ className, ref, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select ref={ref} className={cn(claseControl, 'pr-8', className)} {...props} />
}

export function Etiqueta({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-colmena-700', className)} {...props} />
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
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-colmena-500">{ayuda}</p>
      ) : null}
    </div>
  )
}
