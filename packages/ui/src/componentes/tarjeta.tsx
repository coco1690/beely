import type { HTMLAttributes } from 'react'
import { cn } from '../utilidades'

export function Tarjeta({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-colmena-100 bg-white shadow-sm', className)} {...props} />
}

export function TarjetaEncabezado({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />
}

export function TarjetaTitulo({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-colmena-900', className)} {...props} />
}

export function TarjetaDescripcion({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-colmena-500', className)} {...props} />
}

export function TarjetaContenido({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}
