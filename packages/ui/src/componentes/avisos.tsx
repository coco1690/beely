import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../utilidades'

const variantesInsignia = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', {
  variants: {
    tono: {
      neutro: 'bg-hundido text-texto-2 ring-borde',
      miel: 'bg-acento-suave text-acento-texto ring-acento-borde',
      exito: 'bg-exito-suave text-exito ring-exito-borde',
      peligro: 'bg-peligro-suave text-peligro ring-peligro-borde',
    },
  },
  defaultVariants: { tono: 'neutro' },
})

export function Insignia({
  className,
  tono,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof variantesInsignia>) {
  return <span className={cn(variantesInsignia({ tono }), className)} {...props} />
}

const variantesAviso = cva('rounded-xl border px-4 py-3 text-sm', {
  variants: {
    tono: {
      info: 'border-borde bg-hundido text-texto-2',
      exito: 'border-exito-borde bg-exito-suave text-exito',
      peligro: 'border-peligro-borde bg-peligro-suave text-peligro',
      miel: 'border-acento-borde bg-acento-suave text-texto',
    },
  },
  defaultVariants: { tono: 'info' },
})

export function Aviso({ className, tono, ...props }: HTMLAttributes<HTMLDivElement> & VariantProps<typeof variantesAviso>) {
  return <div role="status" className={cn(variantesAviso({ tono }), className)} {...props} />
}
