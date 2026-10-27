import { cn } from '@beely/ui'
import { useMemo } from 'react'
import { encode } from 'uqr'

// QR del token de la tarjeta. Siempre negro sobre blanco (también en modo oscuro):
// es lo que mejor lee la cámara de la caja.
export function CodigoQr({ valor, className }: { valor: string; className?: string }) {
  const { tamano, trazo } = useMemo(() => {
    const qr = encode(valor, { ecc: 'M', border: 2 })
    let d = ''
    qr.data.forEach((fila, y) =>
      fila.forEach((oscuro, x) => {
        if (oscuro) d += `M${x} ${y}h1v1h-1z`
      }),
    )
    return { tamano: qr.size, trazo: d }
  }, [valor])
  return (
    <svg
      viewBox={`0 0 ${tamano} ${tamano}`}
      shapeRendering="crispEdges"
      className={cn('aspect-square w-full rounded-control bg-white', className)}
      role="img"
      aria-label="Código QR de tu tarjeta"
    >
      <path d={trazo} fill="#111" />
    </svg>
  )
}
