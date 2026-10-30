import { BeelyLoader } from './beely-loader'

// Carga dentro de una sección: el logo de Beely escribiéndose. Aparece solo si la carga
// pasa de ~300 ms (lo pone BeelyLoader), así las cargas rápidas no parpadean.
export function Cargando() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <BeelyLoader size="md" />
    </div>
  )
}

// Carga que tapa la pantalla (abrir la app, entrar a un club). Úsalo con
// useCargaSinParpadeo para que, si alcanza a verse, termine de escribir el logo.
export function CargandoPantalla() {
  return <BeelyLoader fullscreen size="lg" />
}
