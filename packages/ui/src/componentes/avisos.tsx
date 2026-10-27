import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../utilidades'

const variantesInsignia = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    tono: {
      neutro: 'bg-colmena-100 text-colmena-700',
      miel: 'bg-miel-100 text-miel-700',
      exito: 'bg-green-100 text-green-800',
      peligro: 'bg-red-100 text-red-700',
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

const variantesAviso = cva('rounded-lg border px-4 py-3 text-sm', {
  variants: {
    tono: {
      info: 'border-colmena-100 bg-colmena-50 text-colmena-700',
      exito: 'border-green-200 bg-green-50 text-green-800',
      peligro: 'border-red-200 bg-red-50 text-red-700',
      miel: 'border-miel-200 bg-miel-50 text-colmena-900',
    },
  },
  defaultVariants: { tono: 'info' },
})

export function Aviso({ className, tono, ...props }: HTMLAttributes<HTMLDivElement> & VariantProps<typeof variantesAviso>) {
  return <div role="status" className={cn(variantesAviso({ tono }), className)} {...props} />
}
