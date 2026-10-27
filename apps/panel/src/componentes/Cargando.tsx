export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-texto-3" role="status">
      <span className="inline-block size-5 animate-spin rounded-full border-2 border-acento border-t-transparent" />
      {texto}
    </div>
  )
}
