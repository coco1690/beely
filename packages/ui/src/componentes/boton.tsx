import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utilidades'
import { Spinner } from './spinner'

// Solo se animan color, borde, sombra y transform: nunca `transition-all`.
// Al presionar se encoge apenas (0,97), sin movimiento si el sistema lo pide.
export const variantesBoton = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out motion-safe:active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variante: {
        primario: 'bg-acento text-sobre-acento shadow-boton hover:bg-acento-hover',
        secundario: 'bg-hundido text-texto hover:bg-borde',
        contorno: 'border border-borde bg-superficie text-texto shadow-tarjeta hover:border-borde-fuerte hover:bg-hundido',
        fantasma: 'text-texto-2 hover:bg-hundido hover:text-texto',
        peligro: 'bg-peligro text-sobre-peligro shadow-boton hover:bg-peligro-hover',
      },
      // En pantallas táctiles cada tamaño crece hasta una zona cómoda para el dedo.
      tamano: {
        sm: 'h-8 px-3 text-etiqueta pointer-coarse:h-10',
        md: 'h-9 px-3.5 text-sm pointer-coarse:h-11',
        lg: 'h-11 px-5 text-seccion font-semibold pointer-coarse:h-12',
        icono: 'size-9 pointer-coarse:size-11',
      },
    },
    defaultVariants: { variante: 'primario', tamano: 'md' },
  },
)

export type PropsBoton = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof variantesBoton> & {
    // Muestra un spinner sin cambiar el ancho del botón y lo deshabilita.
    cargando?: boolean
  }

export function Boton({ className, variante, tamano, cargando = false, disabled, children, type = 'button', ...props }: PropsBoton) {
  return (
    <button
      type={type}
      className={cn(variantesBoton({ variante, tamano }), cargando && 'disabled:opacity-100', className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
