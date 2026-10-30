import { celularLegible, fecha, numero, type Database } from "@beely/tipos";
import {
  Aviso,
  cn,
  Entrada,
  EstadoVacio,
  Esqueleto,
  FilaLista,
  Lista,
  LogoNegocio,
  Selector,
  Tarjeta,
} from "@beely/ui";
import { Search, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  AvatarCliente,
  diaCumple,
  edad,
  PieLista,
  TAMANO_PAGINA,
  useDiferido,
  usePaginado,
} from "../../componentes/clientes";
import { EncabezadoPagina } from "../../componentes/DisenoPanel";
import { haceCuanto, InsigniaEstado } from "../../componentes/plataforma";
import { supabase } from "../../lib/supabase";
import { usePlataformaStore } from "../../stores/usePlataformaStore";

// Fila de public.superadmin_clientes(). La RPC tipa como string lo que puede llegar null.
type ClientePlataforma = Omit<
  Database["public"]["Functions"]["superadmin_clientes"]["Returns"][number],
  "ultima_visita_en" | "negocio_logo_url"
> & { ultima_visita_en: string | null; negocio_logo_url: string | null };

export function PaginaClientesPlataforma() {
  const { negocios, cargarNegocios } = usePlataformaStore();
  // ?negocio=… llega desde la ficha del negocio.
  const [parametros, setParametros] = useSearchParams();
  const negocioId = parametros.get("negocio") ?? "";
  const [busqueda, setBusqueda] = useState("");
  const texto = useDiferido(busqueda.trim());

  useEffect(() => {
    if (negocios === null) void cargarNegocios();
  }, [negocios, cargarNegocios]);

  const { filas, total, error, cargandoMas, cargarMas } =
    usePaginado<ClientePlataforma>(
      async (desde) => {
        const { data, error } = await supabase.rpc("superadmin_clientes", {
          p_negocio_id: negocioId || undefined,
          p_busqueda: texto || undefined,
          p_limite: TAMANO_PAGINA,
          p_desde: desde,
        });
        if (error) throw error;
        return data as ClientePlataforma[];
      },
      `${negocioId}|${texto}`,
    );

  const elegirNegocio = (id: string) =>
    setParametros(id ? { negocio: id } : {}, { replace: true });
  const negocio = negocios?.find((n) => n.id === negocioId);
  const totalPlataforma = (negocios ?? []).reduce((s, n) => s + n.clientes, 0);
  const filtrando = Boolean(texto || negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={
          negocios
            ? `${numero(totalPlataforma)} clientes en ${numero(negocios.length)} ${negocios.length === 1 ? "negocio" : "negocios"}. Úsalos solo para dar soporte: cada negocio es dueño de sus datos.`
            : "Los clientes de todos los negocios de Beely."
        }
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-3"
              aria-hidden
            />
            <Entrada
              type="search"
              aria-label="Buscar cliente"
              placeholder="Nombre o celular"
              className="pl-9"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Selector
            aria-label="Negocio"
            className="w-40 shrink-0 sm:w-56"
            value={negocioId}
            onChange={(e) => elegirNegocio(e.target.value)}
          >
            <option value="">Todos los negocios</option>
            {(negocios ?? []).map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre} ({numero(n.clientes)})
              </option>
            ))}
          </Selector>
        </div>

        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        <Tarjeta>
          <div
            className={cn(
              columnas,
              "hidden gap-4 border-b border-borde px-5 py-2.5 text-xs font-medium text-texto-3 md:grid",
            )}
          >
            <span>Cliente</span>
            <span>Negocio</span>
            <span className="text-right">Sellos</span>
            <span className="text-right">Última visita</span>
            <span className="text-right">Registro</span>
          </div>
          {filas === null ? (
            <Lista aria-busy>
              {[0, 1, 2, 3].map((n) => (
                <FilaLista key={n}>
                  <span className="flex items-center gap-3">
                    <Esqueleto className="size-9 rounded-full" />
                    <Esqueleto className="h-9 w-52" />
                  </span>
                </FilaLista>
              ))}
            </Lista>
          ) : filas.length === 0 ? (
            <EstadoVacio
              icono={<UsersRound />}
              titulo={
                filtrando
                  ? "Ningún cliente coincide"
                  : "Aún no hay clientes en Beely"
              }
              descripcion={
                texto
                  ? "Prueba con otro nombre o con más dígitos del celular."
                  : negocio
                    ? `${negocio.nombre} todavía no tiene clientes registrados.`
                    : "Aparecen cuando alguien se registra en el club de un negocio."
              }
            />
          ) : (
            <Lista>
              {filas.map((c) => (
                <FilaCliente key={c.id} cliente={c} conNegocio={!negocioId} />
              ))}
            </Lista>
          )}
        </Tarjeta>
        {filas ? (
          <PieLista
            visibles={filas.length}
            total={total}
            cargando={cargandoMas}
            onMas={() => void cargarMas()}
          />
        ) : null}
      </div>
    </>
  );
}

const columnas =
  "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_minmax(0,13rem)_5rem_7rem_6.5rem]";

function FilaCliente({
  cliente: c,
  conNegocio,
}: {
  cliente: ClientePlataforma;
  // Con un negocio elegido en el filtro, en móvil no se repite su nombre en cada fila.
  conNegocio: boolean;
}) {
  const suspendido = c.negocio_estado !== "activo";
  return (
    <li
      className={cn(
        columnas,
        "grid items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-texto/3 sm:px-5",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <AvatarCliente nombre={c.nombre} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-texto">
            {c.nombre}
          </span>
          <span className="truncate text-xs text-texto-3 tabular-nums">
            {celularLegible(c.celular)}
            <span className="hidden sm:inline">
              {" · "}
              {diaCumple(c.fecha_nacimiento)} ({edad(c.fecha_nacimiento)} años)
            </span>
          </span>
          {conNegocio ? (
            <span className="truncate text-xs text-texto-2 md:hidden">
              {c.negocio_nombre}
            </span>
          ) : null}
        </span>
      </span>
      <Link
        to={`/superadmin/negocios/${c.negocio_id}`}
        className="hidden min-w-0 items-center gap-2 rounded-control text-sm text-texto-2 hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco md:flex"
      >
        <LogoNegocio
          url={c.negocio_logo_url}
          nombre={c.negocio_nombre}
          className={cn("size-6", suspendido && "opacity-50 grayscale")}
        />
        <span className="truncate">{c.negocio_nombre}</span>
        {suspendido ? (
          <span className="shrink-0">
            <InsigniaEstado estado={c.negocio_estado} />
          </span>
        ) : null}
      </Link>
      <span className="text-right">
        <span className="block text-sm text-texto tabular-nums">
          {numero(c.sellos_historicos)}
        </span>
        <span className="block text-xs text-texto-3 md:sr-only">
          sellos
        </span>
      </span>
      <span className="hidden truncate text-right text-sm text-texto-2 tabular-nums md:block">
        {haceCuanto(c.ultima_visita_en)}
      </span>
      <span className="hidden truncate text-right text-sm text-texto-2 tabular-nums md:block">
        {fecha(c.creado_en)}
      </span>
    </li>
  );
}
