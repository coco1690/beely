import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utilidades'

export const variantesBoton = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-miel-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variante: {
        primario: 'bg-miel-500 text-colmena-900 hover:bg-miel-400',
        secundario: 'bg-colmena-100 text-colmena-900 hover:bg-colmena-300/60',
        contorno: 'border border-colmena-300 bg-white text-colmena-900 hover:bg-colmena-50',
        fantasma: 'text-colmena-700 hover:bg-colmena-100',
        peligro: 'bg-red-600 text-white hover:bg-red-700',
      },
      tamano: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-14 px-6 text-lg',
      },
    },
    defaultVariants: { variante: 'primario', tamano: 'md' },
  },
)

export type PropsBoton = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variantesBoton>

export function Boton({ className, variante, tamano, type = 'button', ...props }: PropsBoton) {
  return <button type={type} className={cn(variantesBoton({ variante, tamano }), className)} {...props} />
}
