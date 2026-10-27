import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert, CircleCheck, Info, Sparkles } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { cn } from '../utilidades'

const variantesInsignia = cva(
  'inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap tabular-nums ring-1 ring-inset',
  {
    variants: {
      tono: {
        neutro: 'bg-hundido text-texto-2 ring-borde',
        miel: 'bg-acento-suave text-acento-texto ring-acento-borde',
        exito: 'bg-exito-suave text-exito ring-exito-borde',
        peligro: 'bg-peligro-suave text-peligro ring-peligro-borde',
      },
    },
    defaultVariants: { tono: 'neutro' },
  },
)

export function Insignia({
  className,
  tono,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof variantesInsignia>) {
  return <span className={cn(variantesInsignia({ tono }), className)} {...props} />
}

const variantesAviso = cva('flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm motion-safe:animate-aparecer', {
  variants: {
    tono: {
      info: 'border-borde bg-hundido text-texto-2',
      exito: 'border-exito-borde bg-exito-suave text-texto',
      peligro: 'border-peligro-borde bg-peligro-suave text-texto',
      miel: 'border-acento-borde bg-acento-suave text-texto',
    },
  },
  defaultVariants: { tono: 'info' },
})

const iconos = {
  info: <Info className="text-texto-3" />,
  exito: <CircleCheck className="text-exito" />,
  peligro: <CircleAlert className="text-peligro" />,
  miel: <Sparkles className="text-acento-texto" />,
}

// Para estados que siguen vigentes. Lo pasajero ("guardado") va en un toast.
export function Aviso({ className, tono, children, ...props }: HTMLAttributes<HTMLDivElement> & VariantProps<typeof variantesAviso>) {
  return (
    <div role={tono === 'peligro' ? 'alert' : 'status'} className={cn(variantesAviso({ tono }), className)} {...props}>
      <span className="mt-0.5 flex [&_svg]:size-4" aria-hidden>
        {iconos[tono ?? 'info']}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
