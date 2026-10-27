import { useEffect, useRef } from 'react'
import { cn } from '../utilidades'
import { Sello } from './marca'

// Los sellos de una tarjeta: hasta 12 se dibujan como celdas de panal; con más, una
// barra segmentada que no ocupa media pantalla. Los recién sumados se "estampan";
// los que ya estaban no se animan. Lo usan la caja del panel y la tarjeta del club.
export function SellosTarjeta({
  actuales,
  requeridos,
  claseSello = 'size-8',
  columnas,
  className,
}: {
  actuales: number
  requeridos: number
  claseSello?: string
  // Con columnas, los sellos se reparten en una cuadrícula que llena el ancho (el pase del club).
  columnas?: number
  className?: string
}) {
  const previos = useRef(actuales)
  const desde = Math.min(previos.current, actuales)
  useEffect(() => {
    previos.current = actuales
  }, [actuales])
  const esNuevo = (i: number) => i >= desde && i < actuales
  const retraso = (i: number) => ({ animationDelay: `${Math.min((i - desde) * 30, 300)}ms` })
  const etiqueta = `${actuales} de ${requeridos} sellos`

  if (requeridos <= 12) {
    return (
      <div
        className={cn('flex flex-wrap gap-1', columnas && 'grid', className)}
        style={columnas ? { gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` } : undefined}
        role="img"
        aria-label={etiqueta}
      >
        {Array.from({ length: requeridos }, (_, i) => (
          <Sello key={i} lleno={i < actuales} className={cn(columnas ? 'size-auto w-full' : claseSello, esNuevo(i) && 'animate-estampar')} style={esNuevo(i) ? retraso(i) : undefined} />
        ))}
      </div>
    )
  }
  return (
    <div className={cn('flex h-2.5 gap-[3px]', className)} role="img" aria-label={etiqueta}>
      {Array.from({ length: requeridos }, (_, i) => (
        <span
          key={i}
          className={cn('flex-1 rounded-full', i < actuales ? 'bg-acento' : 'bg-hundido', esNuevo(i) && 'animate-estampar')}
          style={esNuevo(i) ? retraso(i) : undefined}
        />
      ))}
    </div>
  )
}
