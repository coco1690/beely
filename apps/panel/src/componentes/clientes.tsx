import { numero } from "@beely/tipos";
import { Boton, cn } from "@beely/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { mensajeDe } from "../lib/funciones";

// Lo que comparten las listas de clientes del negocio y de la plataforma.

export const TAMANO_PAGINA = 50;

// Iniciales sobre el mostrador: "Ana María Ruiz" → "AR".
export function AvatarCliente({
  nombre,
  className,
}: {
  nombre: string;
  className?: string;
}) {
  const partes = nombre.trim().split(/\s+/);
  const iniciales = (
    (partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-hundido text-xs font-semibold text-texto-2 ring-1 ring-borde ring-inset",
        className,
      )}
      aria-hidden
    >
      {iniciales}
    </span>
  );
}

const formatoCumple = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// "1990-11-12" → "12 nov". La fecha de nacimiento es solo fecha: se lee en UTC.
export function diaCumple(fechaNacimiento: string): string {
  return formatoCumple
    .format(new Date(`${fechaNacimiento}T00:00:00Z`))
    .replace(".", "");
}

// Años cumplidos hoy.
export function edad(fechaNacimiento: string): number {
  const [a, m, d] = fechaNacimiento.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const hoy = new Date();
  let anos = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d))
    anos -= 1;
  return anos;
}

// Mes actual (1–12) en la zona horaria del negocio.
export function mesActual(zona?: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: zona }).format(
      new Date(),
    ),
  );
}

export const cumpleEsteMes = (fechaNacimiento: string, zona?: string) =>
  Number(fechaNacimiento.slice(5, 7)) === mesActual(zona);

// Espera a que se deje de escribir antes de buscar.
export function useDiferido<T>(valor: T, ms = 250): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setDiferido(valor), ms);
    return () => window.clearTimeout(id);
  }, [valor, ms]);
  return diferido;
}

// Lista paginada por una RPC que repite `total` en cada fila. Cambiar `clave`
// (búsqueda, filtro, orden) vuelve a la primera página; las respuestas viejas se descartan.
export function usePaginado<T extends { total: number }>(
  cargarPagina: (desde: number) => Promise<T[]>,
  clave: string,
) {
  const [filas, setFilas] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);
  const cargar = useRef(cargarPagina);
  cargar.current = cargarPagina;

  const recargar = useCallback(async () => {
    const mio = ++turno.current;
    try {
      const pagina = await cargar.current(0);
      if (mio !== turno.current) return;
      setFilas(pagina);
      setTotal(pagina[0]?.total ?? 0);
      setError(null);
    } catch (e) {
      if (mio !== turno.current) return;
      setFilas((f) => f ?? []);
      setError(mensajeDe(e));
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [clave, recargar]);

  const cargarMas = async () => {
    if (!filas || cargandoMas) return;
    const mio = turno.current;
    setCargandoMas(true);
    try {
      const pagina = await cargar.current(filas.length);
      if (mio !== turno.current) return;
      setFilas([...filas, ...pagina]);
      if (pagina[0]) setTotal(pagina[0].total);
    } catch (e) {
      if (mio === turno.current) setError(mensajeDe(e));
    } finally {
      setCargandoMas(false);
    }
  };

  return { filas, total, error, cargandoMas, cargarMas, recargar };
}

// Pie de la lista: cuántos se ven y, si faltan, el botón para traer más.
export function PieLista({
  visibles,
  total,
  cargando,
  onMas,
}: {
  visibles: number;
  total: number;
  cargando: boolean;
  onMas: () => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-texto-3 tabular-nums" aria-live="polite">
        {visibles >= total
          ? `${numero(total)} ${total === 1 ? "cliente" : "clientes"}`
          : `${numero(visibles)} de ${numero(total)} clientes`}
      </p>
      {visibles < total ? (
        <Boton variante="contorno" cargando={cargando} onClick={onMas}>
          Mostrar {numero(Math.min(TAMANO_PAGINA, total - visibles))} más
        </Boton>
      ) : null}
    </div>
  );
}
