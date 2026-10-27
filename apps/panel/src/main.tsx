import { ProveedorConfirmar, Toaster } from '@beely/ui'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { Cargando } from './componentes/Cargando'
import { DisenoPanel } from './componentes/DisenoPanel'
import { PaginaCaja } from './paginas/PaginaCaja'
import { PaginaDefinirClave } from './paginas/PaginaDefinirClave'
import { PaginaEquipo } from './paginas/PaginaEquipo'
import { PaginaIngreso } from './paginas/PaginaIngreso'
import { PaginaNegocio } from './paginas/PaginaNegocio'
import { PaginaSuperadmin } from './paginas/PaginaSuperadmin'
import { PaginaPrograma } from './paginas/PaginaPrograma'
import { PaginaRecuperar } from './paginas/PaginaRecuperar'
import { PaginaSedes } from './paginas/PaginaSedes'
import { SinNegocio } from './paginas/SinNegocio'
import { puedeConfigurar, useNegocioActivo, useNegocioStore } from './stores/useNegocioStore'
import { useSesionStore } from './stores/useSesionStore'
import './stores/useTemaStore'
// Fuentes servidas con la app (sin depender de Google Fonts ni parpadeo de fuente).
import '@fontsource-variable/inter/opsz.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import './estilos.css'

// Solo con sesión; carga los negocios del usuario una vez por sesión.
function ConSesion() {
  const sesion = useSesionStore((e) => e.sesion)
  const cargandoSesion = useSesionStore((e) => e.cargando)
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin)
  const cargar = useNegocioStore((e) => e.cargar)
  const limpiar = useNegocioStore((e) => e.limpiar)
  const cargandoNegocios = useNegocioStore((e) => e.cargando)
  const usuarioId = sesion?.user.id

  useEffect(() => {
    if (cargandoSesion) return
    if (usuarioId) void cargar(usuarioId, esSuperadmin)
    else limpiar()
  }, [usuarioId, esSuperadmin, cargandoSesion, cargar, limpiar])

  if (cargandoSesion) return <Cargando />
  if (!sesion) return <Navigate to="/ingresar" replace />
  if (cargandoNegocios) return <Cargando />
  return <Outlet />
}

function SinSesion() {
  const sesion = useSesionStore((e) => e.sesion)
  const cargando = useSesionStore((e) => e.cargando)
  if (cargando) return <Cargando />
  return sesion ? <Navigate to="/" replace /> : <Outlet />
}

// Exige un negocio elegido; si el usuario no tiene, muestra cómo seguir.
function ConNegocio() {
  const activo = useNegocioActivo()
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin)
  if (!activo) return esSuperadmin ? <Navigate to="/superadmin" replace /> : <SinNegocio />
  return <Outlet />
}

function SoloConfiguracion() {
  const activo = useNegocioActivo()
  return puedeConfigurar(activo?.rol) ? <Outlet /> : <Navigate to="/caja" replace />
}

function SoloSuperadmin() {
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin)
  return esSuperadmin ? <Outlet /> : <Navigate to="/" replace />
}

const enrutador = createBrowserRouter([
  {
    element: <SinSesion />,
    children: [
      { path: '/ingresar', element: <PaginaIngreso /> },
      { path: '/recuperar', element: <PaginaRecuperar /> },
    ],
  },
  { path: '/definir-clave', element: <PaginaDefinirClave /> },
  {
    element: <ConSesion />,
    children: [
      {
        element: <DisenoPanel />,
        children: [
          {
            element: <SoloSuperadmin />,
            children: [{ path: '/superadmin', element: <PaginaSuperadmin /> }],
          },
          {
            element: <ConNegocio />,
            children: [
              { index: true, element: <Navigate to="/caja" replace /> },
              { path: '/caja', element: <PaginaCaja /> },
              { path: '/programa', element: <PaginaPrograma /> },
              { path: '/sedes', element: <PaginaSedes /> },
              {
                element: <SoloConfiguracion />,
                children: [
                  { path: '/negocio', element: <PaginaNegocio /> },
                  { path: '/equipo', element: <PaginaEquipo /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

function App() {
  const iniciar = useSesionStore((e) => e.iniciar)
  useEffect(() => iniciar(), [iniciar])
  return (
    <ProveedorConfirmar>
      <RouterProvider router={enrutador} />
      {/* En móvil los toasts quedan sobre la barra inferior de secciones. */}
      <Toaster margenInferiorMovil="4rem" />
    </ProveedorConfirmar>
  )
}

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('No existe #raiz')
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
