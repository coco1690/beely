import { fechaHora, numero } from "@beely/tipos";
import {
  Aviso,
  Boton,
  cn,
  EstadoVacio,
  Esqueleto,
  FilaLista,
  Lista,
  Tarjeta,
  toast,
  useConfirmar,
  variantesBoton,
} from "@beely/ui";
import { ChevronDown, ChevronRight, Megaphone, Plus } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  CuponVistaPrevia,
  InsigniaEstado,
  nombreSegmento,
  rangoDias,
  type CampanaNegocio,
} from "../componentes/campanas";
import { EncabezadoPagina } from "../componentes/DisenoPanel";
import { mensajeDe } from "../lib/funciones";
import { supabase } from "../lib/supabase";
import { useNegocioActivo } from "../stores/useNegocioStore";

export function PaginaCampanas() {
  const activo = useNegocioActivo();
  const negocioId = activo?.negocio.id;
  const [campanas, setCampanas] = useState<CampanaNegocio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const navegar = useNavigate();

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    const { data, error } = await supabase.rpc("campanas_negocio", {
      p_negocio_id: negocioId,
    });
    if (error) setError(mensajeDe(error));
    else setError(null);
    setCampanas((data as CampanaNegocio[] | null) ?? []);
  }, [negocioId]);

  useEffect(() => {
    setCampanas(null);
    void cargar();
  }, [cargar]);

  const enCurso = campanas?.filter((c) => c.estado === "en_curso") ?? [];
  const nueva = (
    <Link to="/campanas/nueva" className={variantesBoton()}>
      <Plus className="size-4" aria-hidden />
      Nueva campaña
    </Link>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Campañas"
        descripcion={
          enCurso.length > 0
            ? `${enCurso.length === 1 ? "1 promoción en curso" : `${enCurso.length} promociones en curso`} · ${numero(enCurso.reduce((t, c) => t + c.cupones_canjeados, 0))} cupones canjeados.`
            : "Promociones que llegan como cupón a la tarjeta de tus clientes y se canjean en caja."
        }
        accion={campanas && campanas.length > 0 ? nueva : undefined}
      />
      <div className="flex flex-col gap-4">
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
        <Tarjeta>
          {campanas && campanas.length > 0 ? (
            <div
              className={cn(
                columnas,
                "hidden gap-4 border-b border-borde px-5 py-2.5 text-xs font-medium text-texto-3 md:grid",
              )}
            >
              <span>Campaña</span>
              <span>Estado</span>
              <span className="text-right">Cupones</span>
              <span className="text-right">Canjeados</span>
              <span className="sr-only">Detalle</span>
            </div>
          ) : null}
          {campanas === null ? (
            <Lista aria-busy>
              {[0, 1, 2].map((n) => (
                <FilaLista key={n}>
                  <Esqueleto className="h-9 w-64" />
                </FilaLista>
              ))}
            </Lista>
          ) : campanas.length === 0 ? (
            <EstadoVacio
              icono={<Megaphone />}
              titulo="Aún no tienes campañas"
              descripcion="Arma una promoción, elige a quién va y le llega como cupón a su tarjeta del club."
              accion={nueva}
            />
          ) : (
            <Lista>
              {campanas.map((c) => (
                <FilaCampana
                  key={c.id}
                  campana={c}
                  zona={activo?.negocio.zona_horaria}
                  abierta={abierta === c.id}
                  onAlternar={() =>
                    c.estado === "borrador"
                      ? navegar(`/campanas/${c.id}`)
                      : setAbierta((a) => (a === c.id ? null : c.id))
                  }
                  onCambio={() => void cargar()}
                />
              ))}
            </Lista>
          )}
        </Tarjeta>
      </div>
    </>
  );
}

// Móvil: campaña y estado. Escritorio: también cupones y canjes.
const columnas =
  "grid-cols-[minmax(0,1fr)_auto_1.25rem] md:grid-cols-[minmax(0,1fr)_7rem_5.5rem_7rem_1.25rem]";

function FilaCampana({
  campana: c,
  zona,
  abierta,
  onAlternar,
  onCambio,
}: {
  campana: CampanaNegocio;
  zona: string | undefined;
  abierta: boolean;
  onAlternar: () => void;
  onCambio: () => void;
}) {
  const idDetalle = useId();
  const borrador = c.estado === "borrador";
  const tasa =
    c.cupones_emitidos > 0 ? c.cupones_canjeados / c.cupones_emitidos : 0;

  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-expanded={borrador ? undefined : abierta}
        aria-controls={borrador ? undefined : idDetalle}
        onClick={onAlternar}
        className={cn(
          columnas,
          "grid w-full items-center gap-x-4 px-4 py-3 text-left transition-colors hover:bg-texto/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco sm:px-5",
          abierta && "bg-texto/3",
        )}
      >
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-sm font-medium text-texto md:truncate">
            {c.titulo}
          </span>
          <span className="text-xs text-texto-3 tabular-nums md:truncate">
            {nombreSegmento(c.filtro)} · {rangoDias(c.inicia, c.termina)}
          </span>
        </span>
        <span className="flex justify-end md:justify-start">
          <InsigniaEstado estado={c.estado} />
        </span>
        <span className="hidden text-right text-sm text-texto-2 tabular-nums md:block">
          {borrador || c.estado === "programada"
            ? "—"
            : numero(c.cupones_emitidos)}
        </span>
        <span className="hidden text-right text-sm text-texto-2 tabular-nums md:block">
          {c.cupones_emitidos > 0 ? (
            <>
              {numero(c.cupones_canjeados)}
              <span className="text-texto-3">
                {" "}
                · {Math.round(tasa * 100)}%
              </span>
            </>
          ) : (
            "—"
          )}
        </span>
        {borrador ? (
          <ChevronRight
            className="size-4 justify-self-end text-texto-3"
            aria-hidden
          />
        ) : (
          <ChevronDown
            className={cn(
              "size-4 justify-self-end text-texto-3 transition-transform duration-(--duracion-media) ease-(--ease-out)",
              abierta && "rotate-180",
            )}
            aria-hidden
          />
        )}
      </button>
      {abierta ? (
        <DetalleCampana
          id={idDetalle}
          campana={c}
          zona={zona}
          onCambio={onCambio}
        />
      ) : null}
    </li>
  );
}

function DetalleCampana({
  id,
  campana: c,
  zona,
  onCambio,
}: {
  id: string;
  campana: CampanaNegocio;
  zona: string | undefined;
  onCambio: () => void;
}) {
  const confirmar = useConfirmar();
  const [cancelando, setCancelando] = useState(false);
  const cancelable = c.estado === "en_curso" || c.estado === "programada";
  const tasa =
    c.cupones_emitidos > 0 ? c.cupones_canjeados / c.cupones_emitidos : 0;
  const sinCanjear = c.cupones_emitidos - c.cupones_canjeados;

  const cancelar = async () => {
    const ok = await confirmar({
      titulo: `¿Cancelar “${c.titulo}”?`,
      descripcion:
        c.estado === "programada"
          ? "No se emitirá ningún cupón. Esto no se puede deshacer."
          : `Los ${numero(sinCanjear)} cupones sin canjear dejan de servir en caja y desaparecen del club. Los canjeados se quedan. Esto no se puede deshacer.`,
      textoConfirmar: "Cancelar campaña",
      textoCancelar: "Volver",
      peligro: true,
    });
    if (!ok) return;
    setCancelando(true);
    const { error } = await supabase.rpc("campana_cancelar", {
      p_campana_id: c.id,
    });
    setCancelando(false);
    if (error) {
      toast.error(mensajeDe(error));
      return;
    }
    toast.success("Campaña cancelada");
    onCambio();
  };

  return (
    <div
      id={id}
      className="grid grid-cols-1 gap-x-8 gap-y-5 border-t border-borde bg-texto/2 px-4 py-5 motion-safe:animate-aparecer sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]"
    >
      <section className="flex min-w-0 flex-col gap-4">
        {c.estado === "programada" ? (
          <p className="text-sm text-texto-2">
            Los cupones salen el {fechaHora(c.programada_para, zona)}.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-texto-2">Canjeados</span>
              <span className="text-texto tabular-nums">
                {numero(c.cupones_canjeados)}
                <span className="text-texto-3">
                  {" "}
                  de {numero(c.cupones_emitidos)} ·{" "}
                  {Math.round(tasa * 100)}%
                </span>
              </span>
            </p>
            <span
              className="block h-1.5 w-full overflow-hidden rounded-full bg-hundido"
              aria-hidden
            >
              <span
                className="block h-full rounded-full bg-acento"
                style={{ width: `${tasa * 100}%` }}
              />
            </span>
          </div>
        )}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-texto-3">Para</dt>
          <dd className="text-texto">{nombreSegmento(c.filtro)}</dd>
          {c.push_enviados > 0 || c.push_pendientes > 0 ? (
            <>
              <dt className="text-texto-3">Notificaciones</dt>
              <dd className="text-texto tabular-nums">
                {c.push_enviados === 1
                  ? "1 enviada"
                  : `${numero(c.push_enviados)} enviadas`}
                {c.push_pendientes > 0 ? (
                  <span className="text-texto-3">
                    {" "}
                    · {numero(c.push_pendientes)} en espera
                  </span>
                ) : null}
              </dd>
            </>
          ) : null}
          <dt className="text-texto-3">Vigencia</dt>
          <dd className="text-texto tabular-nums">
            {rangoDias(c.inicia, c.termina)}
          </dd>
          {c.lanzada_en ? (
            <>
              <dt className="text-texto-3">Lanzada</dt>
              <dd className="text-texto-2 tabular-nums">
                {fechaHora(c.lanzada_en, zona)}
              </dd>
            </>
          ) : null}
          {c.cancelada_en ? (
            <>
              <dt className="text-texto-3">Cancelada</dt>
              <dd className="text-texto-2 tabular-nums">
                {fechaHora(c.cancelada_en, zona)}
              </dd>
            </>
          ) : null}
        </dl>
        {cancelable ? (
          <div>
            <Boton
              variante="contorno"
              tamano="sm"
              cargando={cancelando}
              onClick={() => void cancelar()}
            >
              Cancelar campaña
            </Boton>
          </div>
        ) : null}
      </section>
      <CuponVistaPrevia
        titulo={c.titulo}
        mensaje={c.mensaje}
        termina={c.termina}
        className={cn(
          "self-start",
          (c.estado === "terminada" || c.estado === "cancelada") &&
            "opacity-60",
        )}
      />
    </div>
  );
}
