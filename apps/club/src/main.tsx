import { Cargando, EstadoVacio, ProveedorConfirmar, Toaster, useTemaStore } from '@beely/ui'
import { SearchX } from 'lucide-react'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
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

  if (estado === 'cargando') return <Cargando />
  if (estado === 'no_encontrado') return <SinClub />
  if (estado === 'error') {
    return (
      <main className="mx-auto max-w-md px-4 pt-24">
        <EstadoVacio icono={<SearchX />} titulo="No pudimos abrir el club" descripcion={error ?? 'Revisa tu conexión.'} />
      </main>
    )
  }
  return <Outlet />
}

const enrutador = createBrowserRouter([
  {
    element: <ConNegocio />,
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

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('No existe #raiz')
createRoot(raiz).render(
  <StrictMode>
    <ProveedorConfirmar>
      <RouterProvider router={enrutador} />
      {/* En móvil los toasts quedan sobre la barra inferior de secciones. */}
      <Toaster margenInferiorMovil="4.5rem" />
    </ProveedorConfirmar>
  </StrictMode>,
)
