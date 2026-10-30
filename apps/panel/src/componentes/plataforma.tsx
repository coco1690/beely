import { numero } from "@beely/tipos";
import { cn, Insignia } from "@beely/ui";
import { useEffect, useState, type ReactNode } from "react";
import {
  periodos,
  usePlataformaStore,
  type Periodo,
  type PlanBeely,
  type PuntoSerie,
} from "../stores/usePlataformaStore";

export const dominioClub =
  import.meta.env.VITE_CLUB_DOMINIO_BASE ?? "hibeely.com";

export const estados = ["activo", "suspendido", "cancelado"] as const;
export const nombresEstado: Record<string, string> = {
  activo: "Activo",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

export function InsigniaEstado({ estado }: { estado: string }) {
  const tono =
    estado === "activo"
      ? "exito"
      : estado === "suspendido"
        ? "miel"
        : "peligro";
  return <Insignia tono={tono}>{nombresEstado[estado] ?? estado}</Insignia>;
}

// Planes de la tabla public.planes (los gestiona el superadmin en /superadmin/planes).
// Se cargan una vez y se comparten entre pantallas; null mientras llegan.
export function usePlanes(): PlanBeely[] | null {
  const planes = usePlataformaStore((e) => e.planes);
  const cargarPlanes = usePlataformaStore((e) => e.cargarPlanes);
  useEffect(() => {
    if (planes === null) void cargarPlanes();
  }, [planes, cargarPlanes]);
  return planes;
}

export function nombrePlan(planes: PlanBeely[] | null, codigo: string): string {
  return planes?.find((p) => p.codigo === codigo)?.nombre ?? codigo;
}

export function InsigniaPlan({ plan }: { plan: string }) {
  const planes = usePlanes();
  return <Insignia>{nombrePlan(planes, plan)}</Insignia>;
}

// Una cifra con su etiqueta y, si aplica, un detalle debajo.
export function Cifra({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: number | string;
  detalle?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-superficie px-4 py-3.5">
      <dt className="truncate text-xs text-texto-3">{etiqueta}</dt>
      <dd className="text-2xl font-semibold tracking-tight text-texto tabular-nums">
        {typeof valor === "number" ? numero(valor) : valor}
      </dd>
      {detalle ? (
        <dd className="truncate text-xs text-texto-3">{detalle}</dd>
      ) : null}
    </div>
  );
}

export function GrupoCifras({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-tarjeta border border-borde bg-borde lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

// Selector segmentado de la ventana de días.
export function SelectorPeriodo({
  valor,
  onCambio,
}: {
  valor: Periodo;
  onCambio: (dias: Periodo) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Periodo"
      className="inline-flex rounded-control border border-borde bg-hundido p-0.5"
    >
      {periodos.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={p === valor}
          onClick={() => onCambio(p)}
          className={cn(
            "h-7 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-etiqueta font-medium text-texto-2 transition-colors hover:text-texto focus-visible:outline-2 focus-visible:outline-foco pointer-coarse:h-9",
            p === valor && "bg-superficie text-texto shadow-tarjeta",
          )}
        >
          {p} días
        </button>
      ))}
    </div>
  );
}

// "2026-10-19" → "19 oct".
const formatoDia = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const diaCorto = (dia: string) =>
  formatoDia.format(new Date(`${dia}T00:00:00Z`)).replace(".", "");

// Escala limpia para el eje: 1, 2 o 5 por potencia de 10 (4 → 4, 56 → 60, 1.284 → 1.500).
function techoLimpio(valor: number): number {
  if (valor <= 4) return Math.max(1, Math.ceil(valor));
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const paso = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(
    (m) => m * potencia >= valor,
  )!;
  return paso * potencia;
}

// Columnas de una medida por día (una sola serie: el título la nombra, sin leyenda).
// Pasar el cursor, tocar o moverse con las flechas muestra el día en una etiqueta flotante.
export function GraficaDiaria({
  serie,
  medida,
  nombre,
}: {
  serie: PuntoSerie[];
  medida: "sellos" | "clientes";
  // En plural y en minúscula: "sellos", "clientes nuevos".
  nombre: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const valores = serie.map((p) => p[medida]);
  const techo = techoLimpio(Math.max(0, ...valores));
  const marcas = [techo, techo / 2, 0];
  const punto = activo === null ? null : serie[activo];
  // Cinco fechas repartidas en el eje, sin repetir el mismo día.
  const fechas = [
    ...new Set(
      [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (serie.length - 1))),
    ),
  ];
  const mover = (evento: React.KeyboardEvent) => {
    if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
    evento.preventDefault();
    const paso = evento.key === "ArrowLeft" ? -1 : 1;
    setActivo((a) =>
      Math.min(serie.length - 1, Math.max(0, (a ?? serie.length) + paso)),
    );
  };

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">{nombre} por día</figcaption>
      <div className="relative h-48 pl-9 sm:h-56">
        {/* Guías: finas, sólidas y recesivas, con su cifra a la izquierda. */}
        {marcas.map((m, i) => (
          <div
            key={m}
            className={cn(
              "pointer-events-none absolute inset-x-0 border-t",
              i === marcas.length - 1
                ? "border-borde-fuerte"
                : "border-borde/70",
            )}
            style={{ bottom: `${(m / techo) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -top-2 left-0 text-xs leading-none text-texto-3 tabular-nums">
              {numero(m)}
            </span>
          </div>
        ))}
        <div
          role="group"
          aria-label={`${nombre} por día. Usa las flechas para recorrer los días.`}
          tabIndex={0}
          onKeyDown={mover}
          onBlur={() => setActivo(null)}
          onMouseLeave={() => setActivo(null)}
          className="absolute inset-y-0 right-0 left-9 flex items-end gap-0.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foco"
        >
          {serie.map((p, i) => (
            <div
              key={p.dia}
              className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setActivo(i)}
              onClick={() => setActivo(i)}
            >
              <div
                className={cn(
                  "w-full max-w-6 rounded-t-[4px] transition-[opacity,background-color] duration-150",
                  p[medida] === 0 ? "bg-borde" : "bg-acento",
                  activo !== null && activo !== i && "opacity-35",
                )}
                style={{
                  height:
                    p[medida] === 0
                      ? 2
                      : `${Math.max(2, (p[medida] / techo) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
        {punto && activo !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-control border border-borde bg-superficie px-2.5 py-1.5 text-xs whitespace-nowrap shadow-capa"
            style={{
              left: `calc(2.25rem + (100% - 2.25rem) * ${(activo + 0.5) / serie.length})`,
              transform: `translate(${activo < serie.length / 2 ? "-10%" : "-90%"}, -50%)`,
            }}
            aria-live="polite"
          >
            <span className="text-texto-3">{diaCorto(punto.dia)} · </span>
            <span className="font-semibold text-texto tabular-nums">
              {numero(punto[medida])}
            </span>{" "}
            <span className="text-texto-2">
              {punto[medida] === 1 ? nombre.replace(/s\b/g, "") : nombre}
            </span>
          </div>
        ) : null}
      </div>
      <div
        className="relative ml-9 h-4 text-xs text-texto-3 tabular-nums"
        aria-hidden
      >
        {fechas.map((i) => (
          <span
            key={i}
            className={cn(
              "absolute top-0 whitespace-nowrap",
              i === 0
                ? "left-0"
                : i === serie.length - 1
                  ? "right-0"
                  : "-translate-x-1/2",
            )}
            style={
              i === 0 || i === serie.length - 1
                ? undefined
                : { left: `${((i + 0.5) / serie.length) * 100}%` }
            }
          >
            {serie[i] ? diaCorto(serie[i].dia) : ""}
          </span>
        ))}
      </div>
      {/* Vista en tabla para lectores de pantalla. */}
      <table className="sr-only">
        <caption>Sellos y clientes nuevos por día</caption>
        <thead>
          <tr>
            <th>Día</th>
            <th>Sellos</th>
            <th>Clientes nuevos</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((p) => (
            <tr key={p.dia}>
              <td>{p.dia}</td>
              <td>{p.sellos}</td>
              <td>{p.clientes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// Una barra delgada partida en partes proporcionales (un todo: estados o planes).
// Los nombres y cifras van en la lista de abajo; la barra no lleva texto.
export function BarraPartes({
  partes,
  etiqueta,
}: {
  partes: { nombre: string; valor: number; color: string }[];
  etiqueta: string;
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`${etiqueta}: ${partes.map((p) => `${p.nombre} ${p.valor}`).join(", ")}`}
        className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-hundido"
      >
        {total > 0
          ? partes
              .filter((p) => p.valor > 0)
              .map((p) => (
                <div
                  key={p.nombre}
                  className="h-full rounded-full"
                  style={{
                    flexGrow: p.valor,
                    flexBasis: 0,
                    background: p.color,
                  }}
                />
              ))
          : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {partes.map((p) => (
          <li key={p.nombre} className="flex items-center gap-2 text-sm">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: p.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-texto-2">
              {p.nombre}
            </span>
            <span className="font-medium text-texto tabular-nums">
              {numero(p.valor)}
            </span>
            <span className="w-10 text-right text-xs text-texto-3 tabular-nums">
              {total > 0 ? `${Math.round((p.valor / total) * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "hace 3 días" a partir de una fecha; null → "Nunca".
export function haceCuanto(valor: string | null): string {
  if (!valor) return "Nunca";
  const dias = Math.floor(
    (Date.now() - new Date(valor).getTime()) / 86_400_000,
  );
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
}
