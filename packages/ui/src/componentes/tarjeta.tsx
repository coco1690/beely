import type { HTMLAttributes } from 'react'
import { cn } from '../utilidades'

export function Tarjeta({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-borde bg-superficie shadow-suave', className)} {...props} />
}

export function TarjetaEncabezado({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-6 pb-4', className)} {...props} />
}

export function TarjetaTitulo({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold tracking-tight text-texto', className)} {...props} />
}

export function TarjetaDescripcion({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-texto-3', className)} {...props} />
}

export function TarjetaContenido({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}
