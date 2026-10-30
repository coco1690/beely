import { numero } from "@beely/tipos";
import {
  Aviso,
  cn,
  EstadoVacio,
  Esqueleto,
  Insignia,
  LogoNegocio,
  Tarjeta,
  TarjetaContenido,
  TarjetaEncabezado,
  TarjetaTitulo,
} from "@beely/ui";
import { ArrowRight, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { EncabezadoPagina } from "../../componentes/DisenoPanel";
import {
  BarraPartes,
  GraficaDiaria,
  haceCuanto,
  nombrePlan,
  SelectorPeriodo,
  usePlanes,
} from "../../componentes/plataforma";
import {
  usePlataformaStore,
  type NegocioPlataforma,
  type Tablero,
} from "../../stores/usePlataformaStore";

type Medida = "sellos" | "clientes";

const medidas: { id: Medida; nombre: string; titulo: string }[] = [
  { id: "sellos", nombre: "sellos", titulo: "Sellos sumados" },
  { id: "clientes", nombre: "clientes nuevos", titulo: "Clientes nuevos" },
];

// "2026-10-19" → "19 oct".
const formatoDia = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const diaCorto = (dia: string) =>
  formatoDia.format(new Date(`${dia}T00:00:00Z`)).replace(".", "");

// Cuántos negocios caben en el ranking del tablero; el resto está en Negocios.
const TOPE_RANKING = 8;

export function PaginaTablero() {
  const {
    dias,
    tablero,
    negocios,
    error,
    elegirDias,
    cargarNegocios,
    cargarTablero,
  } = usePlataformaStore();
  const [medida, setMedida] = useState<Medida>("sellos");

  useEffect(() => {
    void cargarTablero();
    void cargarNegocios();
  }, [cargarTablero, cargarNegocios]);

  return (
    <>
      <EncabezadoPagina
        titulo="Tablero"
        descripcion="Cómo va Beely: negocios, clientes y actividad de toda la plataforma."
        accion={
          <SelectorPeriodo valor={dias} onCambio={(d) => void elegirDias(d)} />
        }
      />
      <div className="flex flex-col gap-6">
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        {tablero ? (
          <Actividad tablero={tablero} medida={medida} onMedida={setMedida} />
        ) : (
          <Esqueleto className="h-[29rem] rounded-tarjeta" />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Ranking negocios={negocios} dias={dias} />
          {tablero ? (
            <Composicion tablero={tablero} />
          ) : (
            <Esqueleto className="h-80 rounded-tarjeta" />
          )}
        </div>
      </div>
    </>
  );
}

// La tarjeta principal: la cifra del periodo, sus columnas por día y, debajo, el resto
// de la plataforma en una sola línea.
function Actividad({
  tablero,
  medida,
  onMedida,
}: {
  tablero: Tablero;
  medida: Medida;
  onMedida: (m: Medida) => void;
}) {
  const actual = medidas.find((m) => m.id === medida)!;
  const valores = tablero.serie.map((p) => p[medida]);
  const total = valores.reduce((s, v) => s + v, 0);
  const promedio = valores.length ? total / valores.length : 0;
  const mejor = tablero.serie.reduce<(typeof tablero.serie)[number] | null>(
    (m, p) => (p[medida] > (m?.[medida] ?? 0) ? p : m),
    null,
  );
  const canjeados = tablero.cupones.canjeados_periodo;
  const emitidos = tablero.cupones.emitidos_periodo;

  return (
    <Tarjeta>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-etiqueta font-medium text-texto-2">
              {actual.titulo} en {tablero.dias} días
            </h2>
            <p
              key={medida}
              className="text-5xl leading-none font-semibold tracking-[-0.03em] text-texto motion-safe:animate-aparecer"
            >
              {numero(total)}
            </p>
            <p className="mt-1 text-sm text-texto-3">
              {total === 0 ? (
                "Sin movimiento en el periodo."
              ) : (
                <>
                  {numero(Math.round(promedio * 10) / 10)} por día
                  {mejor ? (
                    <>
                      {" · mejor día "}
                      <span className="text-texto-2">
                        {diaCorto(mejor.dia)} ({numero(mejor[medida])})
                      </span>
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>
          <Segmentado
            etiqueta="Qué mostrar"
            opciones={medidas.map((m) => ({ id: m.id, nombre: m.titulo }))}
            valor={medida}
            onCambio={onMedida}
          />
        </div>

        <GraficaDiaria
          serie={tablero.serie}
          medida={medida}
          nombre={actual.nombre}
        />

        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-borde pt-5 sm:grid-cols-3">
          <Dato
            etiqueta="Clientes"
            valor={numero(tablero.clientes.total)}
            detalle={`+${numero(tablero.clientes.nuevos)} en ${tablero.dias} días`}
          />
          <Dato
            etiqueta="Negocios activos"
            valor={numero(tablero.negocios.activos)}
            detalle={`de ${numero(tablero.negocios.total)} · ${numero(tablero.negocios.nuevos)} ${tablero.negocios.nuevos === 1 ? "nuevo" : "nuevos"}`}
          />
          <Dato
            etiqueta="Premios canjeados"
            valor={numero(canjeados)}
            detalle={
              emitidos > 0
                ? `de ${numero(emitidos)} emitidos · ${Math.round((canjeados / emitidos) * 100)}%`
                : "Aún no se emiten premios"
            }
            progreso={emitidos > 0 ? canjeados / emitidos : undefined}
          />
        </dl>
      </div>
    </Tarjeta>
  );
}

function Dato({
  etiqueta,
  valor,
  detalle,
  progreso,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  // 0 a 1: una barra fina debajo (qué parte de lo emitido ya se canjeó).
  progreso?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-texto-3">{etiqueta}</dt>
      <dd className="text-2xl leading-8 font-semibold tracking-tight text-texto">
        {valor}
      </dd>
      <dd className="truncate text-xs text-texto-3 tabular-nums">{detalle}</dd>
      {progreso !== undefined ? (
        <dd
          className="mt-1 h-1 overflow-hidden rounded-full bg-hundido"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-acento"
            style={{ width: `${Math.min(1, progreso) * 100}%` }}
          />
        </dd>
      ) : null}
    </div>
  );
}

// Selector segmentado (igual al del periodo) para cambiar la medida de la gráfica.
function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
}: {
  etiqueta: string;
  opciones: { id: T; nombre: string }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex rounded-control border border-borde bg-hundido p-0.5"
    >
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === valor}
          onClick={() => onCambio(o.id)}
          className={cn(
            "h-7 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-etiqueta font-medium text-texto-2 transition-colors hover:text-texto focus-visible:outline-2 focus-visible:outline-foco pointer-coarse:h-9",
            o.id === valor && "bg-superficie text-texto shadow-tarjeta",
          )}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

// Los negocios activos ordenados por sellos del periodo, con su parte del total;
// los que no sumaron nada quedan al final marcados como quietos.
function Ranking({
  negocios,
  dias,
}: {
  negocios: NegocioPlataforma[] | null;
  dias: number;
}) {
  const planes = usePlanes();
  const activos = (negocios ?? [])
    .filter((n) => n.estado === "activo")
    .sort((a, b) => b.sellos_periodo - a.sellos_periodo);
  const maximo = Math.max(1, ...activos.map((n) => n.sellos_periodo));
  const quietos = activos.filter((n) => n.sellos_periodo === 0).length;
  const visibles = activos.slice(0, TOPE_RANKING);

  return (
    <Tarjeta className="min-w-0">
      <TarjetaEncabezado className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <TarjetaTitulo>Negocios por sellos</TarjetaTitulo>
          <p className="text-xs text-texto-3">
            {negocios === null
              ? "Cargando…"
              : quietos > 0
                ? `${numero(quietos)} ${quietos === 1 ? "negocio activo sin sellos" : "negocios activos sin sellos"} en ${dias} días`
                : `Todos los negocios activos sumaron sellos en ${dias} días`}
          </p>
        </div>
        <Link
          to="/superadmin/negocios"
          className="inline-flex shrink-0 items-center gap-1 rounded-control text-etiqueta font-medium text-texto-2 hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco pointer-coarse:min-h-11"
        >
          Ver todos <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </TarjetaEncabezado>
      {negocios === null ? (
        <TarjetaContenido>
          <Esqueleto className="h-48" />
        </TarjetaContenido>
      ) : activos.length === 0 ? (
        <EstadoVacio
          icono={<Store />}
          titulo="Sin negocios activos"
          descripcion="Cuando actives un negocio, aparece aquí con sus sellos."
        />
      ) : (
        <ol className="pb-2">
          {visibles.map((n, i) => (
            <li key={n.id}>
              <Link
                to={`/superadmin/negocios/${n.id}`}
                className="grid grid-cols-[1.25rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-texto/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco sm:grid-cols-[1.25rem_auto_minmax(0,14rem)_minmax(0,1fr)_auto] sm:px-5"
              >
                <span className="text-xs text-texto-3 tabular-nums">
                  {i + 1}
                </span>
                <LogoNegocio
                  url={n.logo_url}
                  nombre={n.nombre}
                  className="size-7"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-texto">
                    {n.nombre}
                  </span>
                  <span className="truncate text-xs text-texto-3">
                    {nombrePlan(planes, n.plan)} · {numero(n.clientes)}{" "}
                    {n.clientes === 1 ? "cliente" : "clientes"}
                  </span>
                </span>
                {/* La barra: en escritorio en su columna; en móvil bajo el nombre. */}
                <span className="col-span-2 col-start-2 row-start-2 flex items-center sm:col-span-1 sm:col-start-4 sm:row-start-1">
                  {n.sellos_periodo > 0 ? (
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-hundido">
                      <span
                        className="block h-full rounded-full bg-acento"
                        style={{
                          width: `${Math.max(2, (n.sellos_periodo / maximo) * 100)}%`,
                        }}
                      />
                    </span>
                  ) : (
                    <Insignia>
                      Sin sellos · {haceCuanto(n.ultimo_sello_en).toLowerCase()}
                    </Insignia>
                  )}
                </span>
                <span className="text-right text-sm font-medium text-texto tabular-nums sm:min-w-16">
                  {numero(n.sellos_periodo)}
                  <span className="block text-xs font-normal text-texto-3">
                    sellos
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {activos.length > TOPE_RANKING ? (
        <p className="border-t border-borde px-4 py-3 text-xs text-texto-3 sm:px-5">
          y {numero(activos.length - TOPE_RANKING)} más en Negocios.
        </p>
      ) : null}
    </Tarjeta>
  );
}

// Cómo se reparten los negocios: por estado (semáforo) y por plan (un solo tono).
function Composicion({ tablero }: { tablero: Tablero }) {
  const planes = usePlanes();
  const visibles = (planes ?? []).filter(
    (p) => p.activo || (tablero.negocios.por_plan[p.codigo] ?? 0) > 0,
  );
  // Los planes van en orden y en pasos del acento: del más claro al más hondo.
  const tono = (i: number) =>
    `color-mix(in oklab, var(--color-acento) ${Math.round(40 + (i * 60) / Math.max(1, visibles.length - 1))}%, var(--color-superficie))`;

  return (
    <Tarjeta className="min-w-0">
      <TarjetaEncabezado>
        <TarjetaTitulo>Negocios</TarjetaTitulo>
        <p className="text-xs text-texto-3">
          {numero(tablero.negocios.total)} en total ·{" "}
          {numero(tablero.equipo.miembros)} personas en sus equipos
        </p>
      </TarjetaEncabezado>
      <TarjetaContenido className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-texto-2">Por estado</h3>
          <BarraPartes
            etiqueta="Negocios por estado"
            partes={[
              {
                nombre: "Activos",
                valor: tablero.negocios.activos,
                color: "var(--color-exito)",
              },
              {
                nombre: "Suspendidos",
                valor: tablero.negocios.suspendidos,
                color: "var(--color-borde-fuerte)",
              },
              {
                nombre: "Cancelados",
                valor: tablero.negocios.cancelados,
                color: "var(--color-peligro)",
              },
            ]}
          />
        </section>
        {visibles.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-texto-2">Por plan</h3>
            <BarraPartes
              etiqueta="Negocios por plan"
              partes={visibles.map((p, i) => ({
                nombre: p.nombre,
                valor: tablero.negocios.por_plan[p.codigo] ?? 0,
                color: tono(i),
              }))}
            />
          </section>
        ) : null}
      </TarjetaContenido>
    </Tarjeta>
  );
}
