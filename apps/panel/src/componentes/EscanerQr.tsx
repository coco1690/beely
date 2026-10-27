import { Boton } from '@beely/ui'
import QrScanner from 'qr-scanner'
import { useEffect, useRef, useState } from 'react'

// Cámara trasera leyendo QR. Llama onLeido una sola vez por código y se detiene.
export function EscanerQr({ onLeido, onCerrar }: { onLeido: (texto: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const leido = useRef(onLeido)
  leido.current = onLeido

  useEffect(() => {
    if (!video.current) return
    const escaner = new QrScanner(
      video.current,
      (resultado) => {
        escaner.stop()
        leido.current(resultado.data)
      },
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 8 },
    )
    escaner.start().catch(() => setError('No pudimos abrir la cámara. Revisa el permiso del navegador o escribe el código.'))
    return () => escaner.destroy()
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={video} className="aspect-square w-full object-cover" muted playsInline />
      </div>
      {error ? <p className="text-sm text-peligro">{error}</p> : <p className="text-sm text-texto-3">Apunta al QR de la tarjeta del cliente.</p>}
      <Boton variante="contorno" onClick={onCerrar}>
        Cerrar cámara
      </Boton>
    </div>
  )
}
