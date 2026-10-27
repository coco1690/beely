import type { HTMLAttributes } from 'react'
import { cn } from '../utilidades'

export function Tarjeta({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-tarjeta border border-borde bg-superficie shadow-tarjeta', className)} {...props} />
}

export function TarjetaEncabezado({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 px-4 pt-4 pb-3 sm:px-5 sm:pt-5', className)} {...props} />
}

export function TarjetaTitulo({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-seccion text-texto', className)} {...props} />
}

export function TarjetaDescripcion({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-etiqueta text-texto-3', className)} {...props} />
}

// Sin encabezado, pasa `sinEncabezado` para que el contenido tenga su propio margen superior.
export function TarjetaContenido({ className, sinEncabezado = false, ...props }: HTMLAttributes<HTMLDivElement> & { sinEncabezado?: boolean }) {
  return <div className={cn('px-4 pb-4 sm:px-5 sm:pb-5', sinEncabezado && 'pt-4 sm:pt-5', className)} {...props} />
}
