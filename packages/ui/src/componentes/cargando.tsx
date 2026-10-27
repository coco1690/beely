import { Spinner } from './spinner'

// Aparece solo si la carga pasa de ~200 ms: las cargas rápidas no parpadean.
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div
      className="flex min-h-40 items-center justify-center gap-2.5 text-etiqueta text-texto-3 animate-[desvanecer_180ms_ease-out_200ms_both]"
      role="status"
    >
      <Spinner />
      {texto}
    </div>
  )
}
