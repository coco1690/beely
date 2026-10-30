import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Component, useEffect, useRef, type ReactNode } from 'react'
import { Boton } from './boton'
import { EstadoVacio } from './estados'

// Recuperación de la app cuando vuelve tras un rato sin uso: el teléfono o el navegador
// la congelan o la recargan sin red, o mientras tanto se publicó una versión nueva y los
// archivos de la vieja ya no existen. En vez de quedar en blanco, se recarga o reintenta.

const LLAVE_RECARGA = 'beely-recarga'
const ESPERA_ENTRE_RECARGAS_MS = 15_000

// Recarga la página, pero no dos veces seguidas: si el error persiste tras recargar,
// se muestra la pantalla de error en lugar de entrar en un ciclo.
export function recargarUnaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(LLAVE_RECARGA) ?? 0)
    if (Date.now() - ultima < ESPERA_ENTRE_RECARGAS_MS) return false
    sessionStorage.setItem(LLAVE_RECARGA, String(Date.now()))
  } catch {
    // Sin almacenamiento: se recarga igual (lo peor es un ciclo que el error de red corta).
  }
  window.location.reload()
  return true
}

// Error típico de una pestaña abierta con una versión ya reemplazada en el servidor.
export function esErrorDeVersion(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error ?? '')
  return /dynamically imported module|Importing a module script failed|Failed to fetch module|Unable to preload CSS|module script.*MIME/i.test(mensaje)
}

// Una vez al arrancar: si Vite no logra bajar un archivo de la versión vieja, recarga.
export function instalarRecuperacion() {
  window.addEventListener('vite:preloadError', (evento: Event) => {
    if (recargarUnaVez()) evento.preventDefault()
  })
}

// Llama `alVolver` cuando la app regresa: vuelve la red, la pestaña vuelve a verse
// o el navegador la restaura de su caché de páginas.
export function useAlVolver(alVolver: () => void, activo = true) {
  const funcion = useRef(alVolver)
  funcion.current = alVolver
  useEffect(() => {
    if (!activo) return
    const llamar = () => funcion.current()
    const alCambiarVisibilidad = () => document.visibilityState === 'visible' && llamar()
    const alMostrar = (evento: PageTransitionEvent) => evento.persisted && llamar()
    window.addEventListener('online', llamar)
    window.addEventListener('pageshow', alMostrar)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      window.removeEventListener('online', llamar)
      window.removeEventListener('pageshow', alMostrar)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [activo])
}

const sinRed = () => typeof navigator !== 'undefined' && navigator.onLine === false

// Pantalla completa cuando algo falló: dice qué pasó y deja reintentar o recargar.
export function PantallaError({
  titulo = 'Algo salió mal',
  descripcion,
  alReintentar,
}: {
  titulo?: string
  descripcion?: ReactNode
  // Sin esto, el botón recarga la página.
  alReintentar?: () => void
}) {
  return (
    <main className="mx-auto max-w-md px-4 pt-24">
      <EstadoVacio
        icono={<TriangleAlert />}
        titulo={sinRed() ? 'Sin conexión' : titulo}
        descripcion={
          sinRed() ? 'Revisa tu internet. Volvemos a intentar apenas regrese la conexión.' : (descripcion ?? 'Vuelve a cargar para seguir.')
        }
        accion={
          <Boton variante="contorno" onClick={alReintentar ?? (() => window.location.reload())}>
            <RefreshCw />
            {alReintentar ? 'Reintentar' : 'Recargar'}
          </Boton>
        }
      />
    </main>
  )
}

// Pantalla de error de la ruta (o del límite): si es una versión vieja, recarga sola.
export function ErrorDeApp({ error }: { error: unknown }) {
  const deVersion = esErrorDeVersion(error)
  useEffect(() => {
    if (deVersion) recargarUnaVez()
  }, [deVersion])
  return <PantallaError descripcion="La app tuvo un problema. Recarga para seguir donde ibas." />
}

// Último recurso: un error al pintar fuera de las rutas no deja la pantalla vacía.
export class LimiteErrores extends Component<{ children: ReactNode }, { error: unknown }> {
  override state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  override componentDidCatch(error: unknown) {
    console.error(error)
  }

  override render() {
    return this.state.error ? <ErrorDeApp error={this.state.error} /> : this.props.children
  }
}
