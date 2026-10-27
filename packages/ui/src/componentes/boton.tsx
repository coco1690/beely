import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utilidades'

export const variantesBoton = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acento/25 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variante: {
        primario: 'bg-acento text-sobre-acento shadow-suave hover:bg-acento-hover',
        secundario: 'bg-hundido text-texto hover:bg-borde',
        contorno: 'border border-borde bg-superficie text-texto shadow-suave hover:border-borde-fuerte hover:bg-hundido',
        fantasma: 'text-texto-2 hover:bg-hundido hover:text-texto',
        peligro: 'bg-red-600 text-white shadow-suave hover:bg-red-700',
      },
      tamano: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-14 px-6 text-base',
        icono: 'size-9',
      },
    },
    defaultVariants: { variante: 'primario', tamano: 'md' },
  },
)

export type PropsBoton = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variantesBoton>

export function Boton({ className, variante, tamano, type = 'button', ...props }: PropsBoton) {
  return <button type={type} className={cn(variantesBoton({ variante, tamano }), className)} {...props} />
}
