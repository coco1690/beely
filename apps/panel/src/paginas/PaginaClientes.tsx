import {
  celularLegible,
  fecha,
  fechaHora,
  numero,
  type Database,
} from "@beely/tipos";
import {
  Aviso,
  cn,
  Entrada,
  EstadoVacio,
  Esqueleto,
  FilaLista,
  Insignia,
  Lista,
  Selector,
  SellosTarjeta,
  Tarjeta,
} from "@beely/ui";
import {
  Cake,
  ChevronDown,
  Gift,
  MessageCircle,
  Phone,
  Search,
  UsersRound,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  AvatarCliente,
  cumpleEsteMes,
  diaCumple,
  edad,
  PieLista,
  TAMANO_PAGINA,
  useDiferido,
  usePaginado,
} from "../componentes/clientes";
import { EncabezadoPagina } from "../componentes/DisenoPanel";
import { dominioClub, haceCuanto } from "../componentes/plataforma";
import { mensajeDe } from "../lib/funciones";
import { supabase } from "../lib/supabase";
import { useNegocioActivo } from "../stores/useNegocioStore";

// Fila de public.clientes_negocio(). La RPC tipa como string lo que puede llegar null.
type ClienteNegocio = Omit<
  Database["public"]["Functions"]["clientes_negocio"]["Returns"][number],
  "ultima_visita_en" | "tarjeta_id"
> & { ultima_visita_en: string | null; tarjeta_id: string | null };

// Forma del jsonb de public.clientes_resumen().
type Resumen = {
  total: number;
  nuevos_30: number;
  marketing: number;
  premio: number;
  cumple: number;
  inactivos: number;
};

type Filtro = "todos" | "premio" | "cumple" | "inactivos";
type Orden = "reciente" | "visita" | "sellos" | "nombre";

const filtros: { id: Filtro; nombre: string; vacio: string }[] = [
  { id: "todos", nombre: "Todos", vacio: "" },
  {
    id: "premio",
    nombre: "Con premio",
    vacio: "Nadie tiene un premio sin canjear.",
  },
  {
    id: "cumple",
    nombre: "Cumplen este mes",
    vacio: "Nadie cumple años este mes.",
  },
  {
    id: "inactivos",
    nombre: "Sin volver",
    vacio: "Todos han vuelto en los últimos 30 días.",
  },
];

const ordenes: { id: Orden; nombre: string }[] = [
  { id: "reciente", nombre: "Recientes" },
  { id: "visita", nombre: "Última visita" },
  { id: "sellos", nombre: "Más sellos" },
  { id: "nombre", nombre: "Nombre A–Z" },
];

export function PaginaClientes() {
  const activo = useNegocioActivo();
  const negocioId = activo?.negocio.id;
  const zona = activo?.negocio.zona_horaria;
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<Orden>("reciente");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const texto = useDiferido(busqueda.trim());

  const { filas, total, error, cargandoMas, cargarMas } =
    usePaginado<ClienteNegocio>(
      async (desde) => {
        if (!negocioId) return [];
        const { data, error } = await supabase.rpc("clientes_negocio", {
          p_negocio_id: negocioId,
          p_busqueda: texto || undefined,
          p_filtro: filtro,
          p_orden: orden,
          p_limite: TAMANO_PAGINA,
          p_desde: desde,
        });
        if (error) throw error;
        return data as ClienteNegocio[];
      },
      `${negocioId}|${texto}|${filtro}|${orden}`,
    );

  useEffect(() => {
    if (!negocioId) return;
    setResumen(null);
    void supabase
      .rpc("clientes_resumen", { p_negocio_id: negocioId })
      .then(({ data }) => setResumen((data as Resumen | null) ?? null));
  }, [negocioId]);

  const sinClientes = resumen?.total === 0;
  const actual = filtros.find((f) => f.id === filtro)!;

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={
          resumen && resumen.total > 0
            ? `${numero(resumen.total)} con tarjeta · ${numero(resumen.nuevos_30)} nuevos en 30 días · ${numero(resumen.marketing)} aceptan promociones.`
            : "Quién tiene tarjeta en tu negocio, cuántos sellos lleva y cuándo volvió."
        }
      />
      <div className="flex flex-col gap-4">
        {sinClientes ? null : (
          <>
            <Filtros valor={filtro} resumen={resumen} onCambio={setFiltro} />
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
                aria-label="Ordenar por"
                className="w-36 shrink-0 sm:w-44"
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
              >
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </Selector>
            </div>
          </>
        )}

        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        <Tarjeta>
          {sinClientes ? null : (
            <div
              className={cn(
                columnas,
                "hidden gap-4 border-b border-borde px-5 py-2.5 text-xs font-medium text-texto-3 md:grid",
              )}
            >
              <span>Cliente</span>
              <span>Tarjeta</span>
              <span className="text-right">Premios</span>
              <span className="text-right">Última visita</span>
              <span className="text-right">Registro</span>
              <span className="sr-only">Detalle</span>
            </div>
          )}
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
                sinClientes
                  ? "Aún no tienes clientes"
                  : texto
                    ? "Ningún cliente coincide"
                    : actual.vacio || "Ningún cliente coincide"
              }
              descripcion={
                sinClientes
                  ? `Se registran solos en ${activo?.negocio.slug}.${dominioClub}; aquí verás sus datos, sus sellos y cuándo vuelven.`
                  : texto
                    ? "Prueba con otro nombre o con los últimos dígitos del celular."
                    : undefined
              }
            />
          ) : (
            <Lista>
              {filas.map((c) => (
                <FilaCliente
                  key={c.id}
                  cliente={c}
                  zona={zona}
                  abierto={abierto === c.id}
                  onAlternar={() =>
                    setAbierto((a) => (a === c.id ? null : c.id))
                  }
                />
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
        <p className="text-xs text-texto-3">
          Estos datos son de tu negocio y tus clientes los autorizaron para tu
          programa de fidelización (Ley 1581). No los compartas fuera de él.
        </p>
      </div>
    </>
  );
}

// Los filtros llevan su cifra: dicen cuántos hay antes de tocarlos.
function Filtros({
  valor,
  resumen,
  onCambio,
}: {
  valor: Filtro;
  resumen: Resumen | null;
  onCambio: (f: Filtro) => void;
}) {
  const cifra: Record<Filtro, number | undefined> = {
    todos: resumen?.total,
    premio: resumen?.premio,
    cumple: resumen?.cumple,
    inactivos: resumen?.inactivos,
  };
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <div
        role="radiogroup"
        aria-label="Mostrar"
        className="inline-flex gap-1.5"
      >
        {filtros.map((f) => {
          const elegido = f.id === valor;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={elegido}
              onClick={() => onCambio(f.id)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-etiqueta font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco pointer-coarse:h-10",
                elegido
                  ? "border-texto bg-texto text-fondo"
                  : "border-borde bg-superficie text-texto-2 hover:border-borde-fuerte hover:text-texto",
              )}
            >
              {f.nombre}
              <span
                className={cn(
                  "min-w-4 text-xs tabular-nums",
                  elegido ? "text-fondo/70" : "text-texto-3",
                )}
              >
                {cifra[f.id] === undefined ? "·" : numero(cifra[f.id]!)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Móvil: cliente y sellos. Escritorio: todas las columnas.
const columnas =
  "grid-cols-[minmax(0,1fr)_auto_1.25rem] md:grid-cols-[minmax(0,1fr)_8.5rem_4.5rem_7rem_6.5rem_1.25rem]";

// La fila se despliega (sin modal) con los datos, la tarjeta y los últimos movimientos.
function FilaCliente({
  cliente: c,
  zona,
  abierto,
  onAlternar,
}: {
  cliente: ClienteNegocio;
  zona: string | undefined;
  abierto: boolean;
  onAlternar: () => void;
}) {
  const idDetalle = useId();
  const cumple = cumpleEsteMes(c.fecha_nacimiento, zona);
  const progreso =
    c.sellos_requeridos > 0 ? c.sellos_actuales / c.sellos_requeridos : 0;

  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={idDetalle}
        onClick={onAlternar}
        className={cn(
          columnas,
          "grid w-full items-center gap-x-4 px-4 py-3 text-left transition-colors hover:bg-texto/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco sm:px-5",
          abierto && "bg-texto/3",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <AvatarCliente nombre={c.nombre} />
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-texto">
                {c.nombre}
              </span>
              {c.cupones_vigentes > 0 ? (
                <Insignia tono="miel" className="shrink-0">
                  <Gift className="size-3" aria-hidden />
                  {c.cupones_vigentes > 1
                    ? `${c.cupones_vigentes} premios`
                    : "Premio"}
                </Insignia>
              ) : null}
              {cumple ? (
                <Insignia className="hidden shrink-0 sm:inline-flex">
                  <Cake className="size-3" aria-hidden />
                  {diaCumple(c.fecha_nacimiento)}
                </Insignia>
              ) : null}
            </span>
            <span className="truncate text-xs text-texto-3 tabular-nums">
              {celularLegible(c.celular)}
              <span className="md:hidden">
                {" · "}
                {haceCuanto(c.ultima_visita_en).toLowerCase() === "nunca"
                  ? "sin visitas"
                  : haceCuanto(c.ultima_visita_en).toLowerCase()}
              </span>
            </span>
          </span>
        </span>
        <span className="flex flex-col items-end gap-1.5 md:items-stretch">
          <span className="text-sm text-texto tabular-nums">
            {numero(c.sellos_actuales)}
            <span className="text-texto-3">
              {" "}
              / {numero(c.sellos_requeridos)}
            </span>
          </span>
          <span
            className="hidden h-1 w-full overflow-hidden rounded-full bg-hundido md:block"
            aria-hidden
          >
            <span
              className="block h-full rounded-full bg-acento"
              style={{ width: `${Math.min(1, progreso) * 100}%` }}
            />
          </span>
        </span>
        <Celda valor={numero(c.premios_ganados)} />
        <Celda valor={haceCuanto(c.ultima_visita_en)} />
        <Celda valor={fecha(c.creado_en, zona)} />
        <ChevronDown
          className={cn(
            "size-4 justify-self-end text-texto-3 transition-transform duration-(--duracion-media) ease-(--ease-out)",
            abierto && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {abierto ? (
        <DetalleCliente id={idDetalle} cliente={c} zona={zona} />
      ) : null}
    </li>
  );
}

function Celda({ valor }: { valor: string }) {
  return (
    <span className="hidden truncate text-right text-sm text-texto-2 tabular-nums md:block">
      {valor}
    </span>
  );
}

type Movimiento = {
  id: string;
  cantidad: number;
  origen: string;
  creado_en: string;
  sedes: { nombre: string } | null;
};

type Cupon = {
  id: string;
  codigo: string;
  descripcion: string;
  vence_en: string;
};

const nombresOrigen: Record<string, string> = {
  panel: "En caja",
  api_pos: "Desde el POS",
  ajuste: "Ajuste",
  canje_premio: "Premio ganado",
};

function DetalleCliente({
  id,
  cliente: c,
  zona,
}: {
  id: string;
  cliente: ClienteNegocio;
  zona: string | undefined;
}) {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [cupones, setCupones] = useState<Cupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tarjetaId = c.tarjeta_id;

  useEffect(() => {
    if (!tarjetaId) {
      setMovimientos([]);
      setCupones([]);
      return;
    }
    void Promise.all([
      supabase
        .from("eventos_sello")
        .select("id, cantidad, origen, creado_en, sedes ( nombre )")
        .eq("tarjeta_id", tarjetaId)
        .order("creado_en", { ascending: false })
        .limit(5),
      supabase
        .from("cupones")
        .select("id, codigo, descripcion, vence_en")
        .eq("tarjeta_id", tarjetaId)
        .eq("estado", "emitido")
        .gt("vence_en", new Date().toISOString())
        .order("vence_en"),
    ]).then(([m, k]) => {
      if (m.error || k.error) setError(mensajeDe(m.error ?? k.error));
      setMovimientos((m.data as Movimiento[] | null) ?? []);
      setCupones(k.data ?? []);
    });
  }, [tarjetaId]);

  const digitos = c.celular.replace(/\D/g, "");

  return (
    <div
      id={id}
      className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-borde bg-texto/2 px-4 py-5 motion-safe:animate-aparecer sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:pl-[4.25rem]"
    >
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-medium text-texto-2">Datos</h3>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-texto-3">Celular</dt>
          <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-texto tabular-nums">
              {celularLegible(c.celular)}
            </span>
            {c.celular_verificado ? (
              <Insignia tono="exito">Verificado</Insignia>
            ) : null}
          </dd>
          <dt className="text-texto-3">Cumpleaños</dt>
          <dd className="text-texto">
            {diaCumple(c.fecha_nacimiento)}{" "}
            <span className="text-texto-3">· {edad(c.fecha_nacimiento)} años</span>
          </dd>
          <dt className="text-texto-3">Promociones</dt>
          <dd className="text-texto">
            {c.acepta_marketing ? "Acepta recibirlas" : "No las acepta"}
          </dd>
          <dt className="text-texto-3">Registro</dt>
          <dd className="text-texto">{fecha(c.creado_en, zona)}</dd>
          <dt className="text-texto-3">Autorización</dt>
          <dd className="text-texto-2">
            {fecha(c.aceptado_en, zona)} · política {c.version_politica}
          </dd>
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={`tel:${c.celular}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-borde bg-superficie px-3 text-etiqueta font-medium text-texto shadow-tarjeta transition-colors hover:border-borde-fuerte hover:bg-hundido focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco pointer-coarse:h-10 [&_svg]:size-3.5 [&_svg]:text-texto-3"
          >
            <Phone aria-hidden />
            Llamar
          </a>
          <a
            href={`https://wa.me/${digitos}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-borde bg-superficie px-3 text-etiqueta font-medium text-texto shadow-tarjeta transition-colors hover:border-borde-fuerte hover:bg-hundido focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco pointer-coarse:h-10 [&_svg]:size-3.5 [&_svg]:text-texto-3"
          >
            <MessageCircle aria-hidden />
            WhatsApp
          </a>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <h3 className="flex items-center justify-between gap-2 text-xs font-medium text-texto-2">
          Tarjeta
          {c.estado_tarjeta === "bloqueada" ? (
            <Insignia tono="peligro">Bloqueada</Insignia>
          ) : null}
        </h3>
        {c.tarjeta_id ? (
          <>
            <SellosTarjeta
              actuales={c.sellos_actuales}
              requeridos={c.sellos_requeridos}
              claseSello="size-7"
            />
            <p className="text-xs text-texto-3 tabular-nums">
              {numero(c.sellos_actuales)} de {numero(c.sellos_requeridos)} para
              el próximo premio · {numero(c.sellos_historicos)}{" "}
              {c.sellos_historicos === 1 ? "sello" : "sellos"} en total ·{" "}
              {numero(c.premios_ganados)}{" "}
              {c.premios_ganados === 1 ? "premio ganado" : "premios ganados"}
            </p>
          </>
        ) : (
          <p className="text-sm text-texto-3">Sin tarjeta.</p>
        )}

        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        {cupones && cupones.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {cupones.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-3 rounded-control border border-acento-borde bg-acento-suave px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 text-texto">
                  <Gift className="size-4 shrink-0 text-acento-texto" aria-hidden />
                  <span className="truncate">{k.descripcion}</span>
                </span>
                <span className="shrink-0 text-xs text-texto-2 tabular-nums">
                  vence {fecha(k.vence_en, zona)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-1">
          <h4 className="text-xs text-texto-3">Últimos movimientos</h4>
          {movimientos === null ? (
            <Esqueleto className="h-24" />
          ) : movimientos.length === 0 ? (
            <p className="text-sm text-texto-3">Aún no suma sellos.</p>
          ) : (
            <ol className="divide-y divide-borde">
              {movimientos.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-texto">
                      {nombresOrigen[m.origen] ?? m.origen}
                      {m.sedes ? (
                        <span className="text-texto-3"> · {m.sedes.nombre}</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-texto-3 tabular-nums">
                      {fechaHora(m.creado_en, zona)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      m.cantidad > 0 ? "text-texto" : "text-texto-3",
                    )}
                  >
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
