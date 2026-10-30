import {
  fecha,
  textoPromocion,
  type Database,
  type SegmentoCampana,
  type TipoPromocion,
} from "@beely/tipos";
import { cn, Insignia } from "@beely/ui";
import { Banknote, Clock, Copy, Gift, Percent, Ticket } from "lucide-react";
import type { ReactNode } from "react";

// Lo que comparten la lista de campañas y su editor.

// Fila de public.campanas_negocio(). La RPC tipa como string lo que puede llegar null.
export type CampanaNegocio = Omit<
  Database["public"]["Functions"]["campanas_negocio"]["Returns"][number],
  "valor" | "producto" | "lanzada_en" | "cancelada_en" | "tipo"
> & {
  valor: number | null;
  producto: string | null;
  lanzada_en: string | null;
  cancelada_en: string | null;
  tipo: TipoPromocion;
  filtro: SegmentoCampana;
  estado: EstadoCampana;
};

export type EstadoCampana =
  | "borrador"
  | "programada"
  | "en_curso"
  | "terminada"
  | "cancelada";

// Forma del jsonb de public.campanas_alcance().
export type Alcance = Record<SegmentoCampana, number> & { clientes: number };

export const tipos: {
  id: TipoPromocion;
  nombre: string;
  icono: ReactNode;
}[] = [
  { id: "porcentaje", nombre: "% de descuento", icono: <Percent /> },
  { id: "monto_fijo", nombre: "$ de descuento", icono: <Banknote /> },
  { id: "producto_gratis", nombre: "Producto gratis", icono: <Gift /> },
  { id: "dos_por_uno", nombre: "2x1", icono: <Copy /> },
];

export const segmentos: {
  id: SegmentoCampana;
  nombre: string;
  detalle: string;
}[] = [
  {
    id: "todos",
    nombre: "Todos tus clientes",
    detalle: "Todos los que aceptan promociones.",
  },
  {
    id: "inactivos",
    nombre: "Los que no han vuelto",
    detalle: "Más de 30 días sin sumar un sello.",
  },
  {
    id: "cumple",
    nombre: "Cumpleañeros del mes",
    detalle: "Cumplen años este mes y ya tienen un sello.",
  },
  {
    id: "nuevos",
    nombre: "Clientes nuevos",
    detalle: "Se registraron en los últimos 30 días.",
  },
];

export const nombreSegmento = (id: string) =>
  segmentos.find((s) => s.id === id)?.nombre ?? "Todos tus clientes";

const estados: Record<
  EstadoCampana,
  { texto: string; tono: "neutro" | "exito" }
> = {
  borrador: { texto: "Borrador", tono: "neutro" },
  programada: { texto: "Programada", tono: "neutro" },
  en_curso: { texto: "En curso", tono: "exito" },
  terminada: { texto: "Terminada", tono: "neutro" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
};

export function InsigniaEstado({
  estado,
  className,
}: {
  estado: EstadoCampana;
  className?: string;
}) {
  const e = estados[estado];
  return (
    <Insignia tono={e.tono} className={className}>
      {estado === "en_curso" ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : estado === "programada" ? (
        <Clock className="size-3" aria-hidden />
      ) : null}
      {e.texto}
    </Insignia>
  );
}

// Día de hoy (+n) en la zona del negocio, como AAAA-MM-DD.
export function diaEnZona(zona: string | undefined, sumar = 0): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(
    new Date(),
  );
  if (!sumar) return hoy;
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + sumar);
  return d.toISOString().slice(0, 10);
}

// Días entre dos AAAA-MM-DD.
export const diasEntre = (desde: string, hasta: string) =>
  Math.round(
    (new Date(`${hasta}T00:00:00Z`).getTime() -
      new Date(`${desde}T00:00:00Z`).getTime()) /
      86_400_000,
  );

const formatoDia = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const formatoSoloDia = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  timeZone: "UTC",
});

// "2026-11-03" → "3 nov".
export const dia = (d: string) =>
  formatoDia.format(new Date(`${d}T00:00:00Z`)).replace(".", "");

// "3 – 9 nov", "28 nov – 4 dic" o "3 nov" si es un solo día.
export function rangoDias(inicia: string, termina: string): string {
  if (inicia === termina) return dia(inicia);
  if (inicia.slice(0, 7) === termina.slice(0, 7))
    return `${formatoSoloDia.format(new Date(`${inicia}T00:00:00Z`))} – ${dia(termina)}`;
  return `${dia(inicia)} – ${dia(termina)}`;
}

// El cupón tal como lo ve el cliente en el club (PaginaCupones): borde troquelado y código en mono.
export function CuponVistaPrevia({
  titulo,
  mensaje,
  termina,
  className,
}: {
  titulo: string;
  mensaje: string;
  termina: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex overflow-hidden rounded-tarjeta border border-acento-borde bg-superficie shadow-tarjeta",
        className,
      )}
    >
      <div className="flex w-16 shrink-0 items-center justify-center border-r border-dashed border-acento-borde bg-acento-suave text-acento-texto">
        <Ticket className="size-6" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 p-3.5">
        <p className="text-xs text-texto-3">Promoción</p>
        <p className="text-sm font-semibold text-pretty break-words text-texto">
          {titulo.trim() || "Tu promoción"}
        </p>
        {mensaje.trim() ? (
          <p className="mt-0.5 text-etiqueta text-pretty break-words text-texto-2">
            {mensaje.trim()}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-sm bg-hundido px-1.5 py-0.5 font-mono text-etiqueta tracking-wider text-texto-3">
            BEE-XXXX
          </span>
          <span className="text-xs text-texto-3">
            Vence el {fecha(`${termina}T12:00:00Z`, "UTC")}
          </span>
        </div>
      </div>
    </article>
  );
}

export const tituloSugerido = (
  tipo: TipoPromocion,
  valor: number | null,
  producto: string,
) => textoPromocion(tipo, valor, producto);
