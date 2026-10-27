export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-sm text-colmena-500" role="status">
      <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-miel-500 border-t-transparent" />
      {texto}
    </div>
  )
}
