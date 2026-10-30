import {
  CargandoPantalla,
  ErrorDeApp,
  instalarRecuperacion,
  JalarParaRecargar,
  LimiteErrores,
  PantallaError,
  ProveedorConfirmar,
  Toaster,
  useAlVolver,
  useCargaSinParpadeo,
} from "@beely/ui";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useRouteError,
} from "react-router";
import { DisenoPanel } from "./componentes/DisenoPanel";
import { PaginaCaja } from "./paginas/PaginaCaja";
import { PaginaDefinirClave } from "./paginas/PaginaDefinirClave";
import { PaginaEquipo } from "./paginas/PaginaEquipo";
import { PaginaIngreso } from "./paginas/PaginaIngreso";
import { PaginaNegocio } from "./paginas/PaginaNegocio";
import { PaginaPerfil } from "./paginas/PaginaPerfil";
import { PaginaDemoLoader } from "./paginas/PaginaDemoLoader";
import { PaginaPrograma } from "./paginas/PaginaPrograma";
import { PaginaRecuperar } from "./paginas/PaginaRecuperar";
import { PaginaSedes } from "./paginas/PaginaSedes";
import { SinNegocio } from "./paginas/SinNegocio";
import { PaginaFichaNegocio } from "./paginas/superadmin/PaginaFichaNegocio";
import { PaginaNegocios } from "./paginas/superadmin/PaginaNegocios";
import { PaginaPlanes } from "./paginas/superadmin/PaginaPlanes";
import { PaginaSuperadmins } from "./paginas/superadmin/PaginaSuperadmins";
import { PaginaTablero } from "./paginas/superadmin/PaginaTablero";
import {
  puedeConfigurar,
  useNegocioActivo,
  useNegocioStore,
} from "./stores/useNegocioStore";
import { useSesionStore } from "./stores/useSesionStore";
// Fuentes servidas con la app (sin depender de Google Fonts ni parpadeo de fuente).
import "@fontsource-variable/inter/opsz.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "./estilos.css";

// Solo con sesión; carga los negocios del usuario una vez por sesión.
function ConSesion() {
  const sesion = useSesionStore((e) => e.sesion);
  const cargandoSesion = useSesionStore((e) => e.cargando);
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin);
  const cargar = useNegocioStore((e) => e.cargar);
  const limpiar = useNegocioStore((e) => e.limpiar);
  const cargandoNegocios = useNegocioStore((e) => e.cargando);
  // Falló la carga y no hay nada en pantalla (p. ej. el navegador la recargó sin red).
  const sinNegocios = useNegocioStore(
    (e) => e.error !== null && e.membresias.length === 0,
  );
  const usuarioId = sesion?.user.id;

  useEffect(() => {
    if (cargandoSesion) return;
    if (usuarioId) void cargar(usuarioId, esSuperadmin);
    else limpiar();
  }, [usuarioId, esSuperadmin, cargandoSesion, cargar, limpiar]);

  const reintentar = () => {
    if (usuarioId) void cargar(usuarioId, esSuperadmin);
  };
  useAlVolver(reintentar, sinNegocios);
  const enCarga = useCargaSinParpadeo(cargandoSesion || cargandoNegocios);

  if (cargandoSesion || (sesion && enCarga)) return <CargandoPantalla />;
  if (!sesion) return <Navigate to="/ingresar" replace />;
  if (sinNegocios)
    return (
      <PantallaError
        titulo="No pudimos cargar tu negocio"
        alReintentar={reintentar}
      />
    );
  return <Outlet />;
}

function ErrorDeRuta() {
  return <ErrorDeApp error={useRouteError()} />;
}

function SinSesion() {
  const sesion = useSesionStore((e) => e.sesion);
  const enCarga = useCargaSinParpadeo(useSesionStore((e) => e.cargando));
  if (enCarga) return <CargandoPantalla />;
  return sesion ? <Navigate to="/" replace /> : <Outlet />;
}

// Exige un negocio elegido; si el usuario no tiene, muestra cómo seguir.
function ConNegocio() {
  const activo = useNegocioActivo();
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin);
  if (!activo)
    return esSuperadmin ? (
      <Navigate to="/superadmin" replace />
    ) : (
      <DisenoPanel modo="negocio">
        <SinNegocio />
      </DisenoPanel>
    );
  return <Outlet />;
}

function SoloConfiguracion() {
  const activo = useNegocioActivo();
  return puedeConfigurar(activo?.rol) ? (
    <Outlet />
  ) : (
    <Navigate to="/caja" replace />
  );
}

// Entrada del panel: el superadmin aterriza en la plataforma; el equipo, en la caja de su negocio.
function Inicio() {
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin);
  return <Navigate to={esSuperadmin ? "/superadmin" : "/caja"} replace />;
}

// Perfil: cualquiera con sesión. El superadmin lo ve en la plataforma salvo que esté
// dentro de un negocio donde es miembro de verdad.
function DisenoPerfil() {
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin);
  const activo = useNegocioActivo();
  const plataforma = esSuperadmin && (!activo || activo.rol === "superadmin");
  return <DisenoPanel modo={plataforma ? "plataforma" : "negocio"} />;
}

function SoloSuperadmin() {
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin);
  return esSuperadmin ? <Outlet /> : <Navigate to="/" replace />;
}

const enrutador = createBrowserRouter([
  {
    element: <SinSesion />,
    errorElement: <ErrorDeRuta />,
    children: [
      { path: "/ingresar", element: <PaginaIngreso /> },
      { path: "/recuperar", element: <PaginaRecuperar /> },
    ],
  },
  {
    path: "/definir-clave",
    element: <PaginaDefinirClave />,
    errorElement: <ErrorDeRuta />,
  },
  {
    element: <ConSesion />,
    errorElement: <ErrorDeRuta />,
    children: [
      { index: true, element: <Inicio /> },
      {
        element: <DisenoPerfil />,
        children: [{ path: "/perfil", element: <PaginaPerfil /> }],
      },
      {
        element: <SoloSuperadmin />,
        children: [
          {
            element: <DisenoPanel modo="plataforma" />,
            children: [
              { path: "/superadmin", element: <PaginaTablero /> },
              { path: "/superadmin/negocios", element: <PaginaNegocios /> },
              {
                path: "/superadmin/negocios/:id",
                element: <PaginaFichaNegocio />,
              },
              { path: "/superadmin/planes", element: <PaginaPlanes /> },
              { path: "/superadmin/equipo", element: <PaginaSuperadmins /> },
            ],
          },
        ],
      },
      {
        element: <ConNegocio />,
        children: [
          {
            element: <DisenoPanel modo="negocio" />,
            children: [
              { path: "/caja", element: <PaginaCaja /> },
              { path: "/programa", element: <PaginaPrograma /> },
              { path: "/sedes", element: <PaginaSedes /> },
              {
                element: <SoloConfiguracion />,
                children: [
                  { path: "/negocio", element: <PaginaNegocio /> },
                  { path: "/equipo", element: <PaginaEquipo /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  // Vitrina del loader, solo en desarrollo.
  ...(import.meta.env.DEV
    ? [{ path: "/demo/loader", element: <PaginaDemoLoader /> }]
    : []),
  { path: "*", element: <Navigate to="/" replace /> },
]);

function App() {
  const iniciar = useSesionStore((e) => e.iniciar);
  useEffect(() => iniciar(), [iniciar]);
  return (
    <ProveedorConfirmar>
      <RouterProvider router={enrutador} />
      {/* En móvil los toasts quedan sobre la barra inferior de secciones. */}
      <Toaster margenInferiorMovil="4rem" />
      <JalarParaRecargar />
    </ProveedorConfirmar>
  );
}

instalarRecuperacion();

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("No existe #raiz");
createRoot(raiz).render(
  <StrictMode>
    <LimiteErrores>
      <App />
    </LimiteErrores>
  </StrictMode>,
);
