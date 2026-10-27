export function Marca({ subtitulo }: { subtitulo?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-acento to-acento-hover text-xl shadow-suave"
        aria-hidden
      >
        🐝
      </span>
      <div className="leading-tight">
        <p className="text-base font-semibold tracking-tight text-texto">Beely</p>
        {subtitulo ? <p className="text-xs text-texto-3">{subtitulo}</p> : null}
      </div>
    </div>
  )
}
