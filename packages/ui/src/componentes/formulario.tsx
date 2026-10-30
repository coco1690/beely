import { ChevronsUpDown, Eye, EyeOff } from 'lucide-react'
import { createContext, useContext, useState, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react'
import { cn } from '../utilidades'

// 16px en pantallas táctiles: con menos, iOS hace zoom al enfocar el campo.
const claseControl =
  'h-9 w-full min-w-0 rounded-control border border-borde bg-superficie px-3 text-sm text-texto transition-[border-color,box-shadow] placeholder:text-texto-3 hover:border-borde-fuerte focus:border-foco focus:ring-3 focus:ring-foco/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-hundido disabled:text-texto-3 aria-invalid:border-peligro aria-invalid:focus:ring-peligro/20 pointer-coarse:h-11 pointer-coarse:text-base'

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
  // En iOS el campo de fecha trae ancho propio y se sale del contenedor; se fuerza al ancho del campo.
  const fecha = props.type === 'date' && 'min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left'
  return <input ref={ref} className={cn(claseControl, fecha, className)} {...props} {...atributos} />
}

// Campo de clave con botón para mostrarla u ocultarla. `className` va al contenedor.
export function EntradaClave({
  className,
  ref,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { ref?: Ref<HTMLInputElement> }) {
  const atributos = useAtributosCampo(props)
  const [visible, setVisible] = useState(false)
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <input ref={ref} type={visible ? 'text' : 'password'} className={cn(claseControl, 'pr-10 pointer-coarse:pr-12')} {...props} {...atributos} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-control text-texto-3 transition-colors hover:text-texto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco pointer-coarse:w-11 [&_svg]:size-4 pointer-coarse:[&_svg]:size-5"
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  )
}

// `className` va al contenedor (ancho, márgenes); el select ocupa todo y lleva su flecha.
export function Selector({ className, ref, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  const atributos = useAtributosCampo(props)
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <select ref={ref} className={cn(claseControl, 'appearance-none truncate pr-9')} {...props} {...atributos} />
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-texto-3" aria-hidden />
    </div>
  )
}

export function Etiqueta({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-etiqueta font-medium text-texto-2', className)} {...props} />
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
      <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
        {children}
        {error ? (
          <p id={idDescripcion} className="text-xs text-peligro motion-safe:animate-aparecer" role="alert">
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

// Casilla con su texto al lado; toda la fila es tocable. `children` es la etiqueta.
export function Casilla({
  className,
  children,
  ref,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { ref?: Ref<HTMLInputElement>; children: ReactNode }) {
  const atributos = useAtributosCampo(props)
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 text-sm text-texto-2', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm accent-acento focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco pointer-coarse:size-5"
        {...props}
        {...atributos}
      />
      <span className="min-w-0">{children}</span>
    </label>
  )
}

// Interruptor de encendido/apagado (role="switch").
// Transiciones (no keyframes) para que un doble toque retome desde donde va; la
// perilla se encoge un poco al presionar y, con movimiento reducido, solo cambia el color.
// `ocupado`: guardando el cambio; queda deshabilitado sin atenuarse para no parpadear.
export function Interruptor({
  activo,
  onCambiar,
  etiqueta,
  disabled,
  ocupado,
  className,
}: {
  activo: boolean
  onCambiar: (activo: boolean) => void
  etiqueta: string
  disabled?: boolean
  ocupado?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      aria-busy={ocupado || undefined}
      disabled={disabled || ocupado}
      onClick={() => onCambiar(!activo)}
      className={cn(
        'group/interruptor relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent transition-colors duration-(--duracion-media) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco disabled:cursor-not-allowed pointer-coarse:after:absolute pointer-coarse:after:-inset-2',
        activo ? 'bg-acento bg-degradado' : 'bg-borde-fuerte',
        ocupado ? 'cursor-progress' : 'disabled:opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'size-5 rounded-full bg-white shadow-boton transition-[translate,scale] duration-(--duracion-media) group-active/interruptor:scale-95 motion-reduce:transition-none',
          activo ? 'translate-x-[1.0625rem]' : 'translate-x-0.5',
        )}
        aria-hidden
      />
    </button>
  )
}
