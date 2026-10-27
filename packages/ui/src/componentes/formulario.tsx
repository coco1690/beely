import { createContext, useContext, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react'
import { cn } from '../utilidades'

// 16px en pantallas táctiles: con menos, iOS hace zoom al enfocar el campo.
const claseControl =
  'h-10 w-full rounded-xl border border-borde bg-superficie px-3 text-sm text-texto shadow-suave transition-colors placeholder:text-texto-3 hover:border-borde-fuerte focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento/20 disabled:bg-hundido disabled:shadow-none aria-invalid:border-peligro aria-invalid:ring-peligro/15 pointer-coarse:text-base'

// Campo comparte con su control si hay error y qué texto lo describe.
type ContextoCampo = { invalido: boolean; idDescripcion: string | undefined }
const Contexto = createContext<ContextoCampo | null>(null)

type AtributosAria = Pick<InputHTMLAttributes<HTMLInputElement>, 'aria-invalid' | 'aria-describedby'>

function useAtributosCampo(props: AtributosAria): AtributosAria {
  const campo = useContext(Contexto)
  if (!campo) return {}
  return {
    'aria-invalid': props['aria-invalid'] ?? (campo.invalido || undefined),
    'aria-describedby': props['aria-describedby'] ?? campo.idDescripcion,
  }
}

export function Entrada({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const atributos = useAtributosCampo(props)
  return <input ref={ref} className={cn(claseControl, className)} {...props} {...atributos} />
}

export function Selector({ className, ref, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  const atributos = useAtributosCampo(props)
  return <select ref={ref} className={cn(claseControl, 'pr-8', className)} {...props} {...atributos} />
}

export function Etiqueta({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-texto-2', className)} {...props} />
}

// Etiqueta + control + ayuda o error, con el id y la descripción enlazados.
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
  const idDescripcion = error || ayuda ? `${id}-descripcion` : undefined
  return (
    <Contexto value={{ invalido: Boolean(error), idDescripcion }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
        {children}
        {error ? (
          <p id={idDescripcion} className="text-xs text-peligro" role="alert">
            {error}
          </p>
        ) : ayuda ? (
          <p id={idDescripcion} className="text-xs text-texto-3">
            {ayuda}
          </p>
        ) : null}
      </div>
    </Contexto>
  )
}
