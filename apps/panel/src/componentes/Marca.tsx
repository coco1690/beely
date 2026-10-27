export function Marca({ subtitulo }: { subtitulo?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-9 items-center justify-center rounded-xl bg-miel-500 text-lg" aria-hidden>
        🐝
      </span>
      <div className="leading-tight">
        <p className="font-semibold text-colmena-900">Beely</p>
        {subtitulo ? <p className="text-xs text-colmena-500">{subtitulo}</p> : null}
      </div>
    </div>
  )
}
