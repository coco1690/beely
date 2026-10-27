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
import { PaginaPlataforma } from './paginas/PaginaPlataforma'
import { PaginaPrograma } from './paginas/PaginaPrograma'
import { PaginaRecuperar } from './paginas/PaginaRecuperar'
import { PaginaSedes } from './paginas/PaginaSedes'
import { SinNegocio } from './paginas/SinNegocio'
import { puedeConfigurar, useNegocioActivo, useNegocioStore } from './stores/useNegocioStore'
import { useSesionStore } from './stores/useSesionStore'
import './stores/useTemaStore'
import './estilos.css'

// Solo con sesión; carga los negocios del usuario una vez por sesión.
function ConSesion() {
  const sesion = useSesionStore((e) => e.sesion)
  const cargandoSesion = useSesionStore((e) => e.cargando)
  const esAdminPlataforma = useSesionStore((e) => e.esAdminPlataforma)
  const cargar = useNegocioStore((e) => e.cargar)
  const limpiar = useNegocioStore((e) => e.limpiar)
  const cargandoNegocios = useNegocioStore((e) => e.cargando)
  const usuarioId = sesion?.user.id

  useEffect(() => {
    if (cargandoSesion) return
    if (usuarioId) void cargar(usuarioId, esAdminPlataforma)
    else limpiar()
  }, [usuarioId, esAdminPlataforma, cargandoSesion, cargar, limpiar])

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
  const esAdminPlataforma = useSesionStore((e) => e.esAdminPlataforma)
  if (!activo) return esAdminPlataforma ? <Navigate to="/plataforma" replace /> : <SinNegocio />
  return <Outlet />
}

function SoloConfiguracion() {
  const activo = useNegocioActivo()
  return puedeConfigurar(activo?.rol) ? <Outlet /> : <Navigate to="/caja" replace />
}

function SoloPlataforma() {
  const esAdminPlataforma = useSesionStore((e) => e.esAdminPlataforma)
  return esAdminPlataforma ? <Outlet /> : <Navigate to="/" replace />
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
            element: <SoloPlataforma />,
            children: [{ path: '/plataforma', element: <PaginaPlataforma /> }],
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
  return <RouterProvider router={enrutador} />
}

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('No existe #raiz')
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
