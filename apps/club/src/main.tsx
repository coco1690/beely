import { CargandoPantalla, ErrorDeApp, instalarRecuperacion, LimiteErrores, PantallaError, ProveedorConfirmar, Toaster, useAlVolver, useCargaSinParpadeo, useTemaStore } from '@beely/ui'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useRouteError } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import { DisenoClub, Inicio, SinClub } from './componentes/DisenoClub'
import { PaginaCupones } from './paginas/PaginaCupones'
import { PaginaPerfil } from './paginas/PaginaPerfil'
import { PaginaRegistro } from './paginas/PaginaRegistro'
import { PaginaTarjeta } from './paginas/PaginaTarjeta'
import { useClubStore } from './stores/useClubStore'
// Fuentes servidas con la app (sin depender de Google Fonts ni parpadeo de fuente).
import '@fontsource-variable/inter/opsz.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import './estilos.css'

// Base del club: el tema de Beely (reemplaza cualquier tema elegido antes). Encima van los
// colores del negocio (useClubStore); sin colores válidos queda el degradado de Beely.
if (useTemaStore.getState().tema !== 'beely') useTemaStore.getState().elegirTema('beely')

// Todo el club cuelga del negocio del subdominio: sin él no hay nada que mostrar.
function ConNegocio() {
  const estado = useClubStore((e) => e.estadoNegocio)
  const error = useClubStore((e) => e.error)
  const cargarNegocio = useClubStore((e) => e.cargarNegocio)
  useEffect(() => void cargarNegocio(), [cargarNegocio])
  // Si abrió sin red (el teléfono la recargó al desbloquear), reintenta al volver la conexión.
  useAlVolver(() => void cargarNegocio(), estado === 'error')
  const enCarga = useCargaSinParpadeo(estado === 'cargando')

  if (enCarga) return <CargandoPantalla />
  if (estado === 'no_encontrado') return <SinClub />
  if (estado === 'error') {
    return <PantallaError titulo="No pudimos abrir el club" descripcion={error} alReintentar={() => void cargarNegocio()} />
  }
  return <Outlet />
}

function ErrorDeRuta() {
  return <ErrorDeApp error={useRouteError()} />
}

const enrutador = createBrowserRouter([
  {
    element: <ConNegocio />,
    errorElement: <ErrorDeRuta />,
    children: [
      {
        index: true,
        element: (
          <Inicio>
            <PaginaRegistro />
          </Inicio>
        ),
      },
      {
        path: '/t/:token',
        element: <DisenoClub />,
        children: [
          { index: true, element: <PaginaTarjeta /> },
          { path: 'cupones', element: <PaginaCupones /> },
          { path: 'perfil', element: <PaginaPerfil /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

// Service worker: precarga la app (abre sin red) y recibe los Web Push.
registerSW({ immediate: true })
instalarRecuperacion()

// Si se publica una versión nueva con el club abierto, su service worker toma el control y
// borra los archivos de la vieja: la pestaña se recarga en cuanto deja de verse, para que
// al volver abra la versión nueva completa en vez de quedar a medias.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (document.visibilityState === 'hidden') return window.location.reload()
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && window.location.reload())
  })
}

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('No existe #raiz')
createRoot(raiz).render(
  <StrictMode>
    <LimiteErrores>
      <ProveedorConfirmar>
        <RouterProvider router={enrutador} />
        {/* En móvil los toasts quedan sobre la barra inferior de secciones. */}
        <Toaster margenInferiorMovil="4.5rem" />
      </ProveedorConfirmar>
    </LimiteErrores>
  </StrictMode>,
)
