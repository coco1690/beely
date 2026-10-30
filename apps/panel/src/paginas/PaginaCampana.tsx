import { zodResolver } from "@hookform/resolvers/zod";
import {
  esquemaCampana,
  numero,
  type Campana,
  type SegmentoCampana,
  type TipoPromocion,
} from "@beely/tipos";
import {
  Aviso,
  Boton,
  Cargando,
  Campo,
  cn,
  Entrada,
  Tarjeta,
  TarjetaContenido,
  TarjetaDescripcion,
  TarjetaEncabezado,
  TarjetaTitulo,
  toast,
  useCargaSinParpadeo,
  useConfirmar,
  variantesBoton,
} from "@beely/ui";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import {
  CuponVistaPrevia,
  dia,
  diaEnZona,
  diasEntre,
  NotificacionVistaPrevia,
  segmentos,
  tipos,
  tituloSugerido,
  type Alcance,
  type CampanaNegocio,
} from "../componentes/campanas";
import { EncabezadoPagina } from "../componentes/DisenoPanel";
import { enviarPushCampanas, mensajeDe } from "../lib/funciones";
import { supabase } from "../lib/supabase";
import { useNegocioActivo } from "../stores/useNegocioStore";

const numeroONulo = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : Number(v);

const duraciones = [
  { dias: 7, nombre: "1 semana" },
  { dias: 14, nombre: "2 semanas" },
  { dias: 30, nombre: "1 mes" },
];

const ayudaProducto: Record<TipoPromocion, string> = {
  porcentaje: "Déjalo vacío si aplica a toda la compra.",
  monto_fijo: "Déjalo vacío si aplica a toda la compra.",
  producto_gratis: "Lo que se lleva gratis.",
  dos_por_uno: "Lo que se lleva dos por uno.",
};

// Crear (/campanas/nueva) o editar un borrador (/campanas/:id).
export function PaginaCampana() {
  const { id } = useParams();
  const activo = useNegocioActivo();
  const negocioId = activo?.negocio.id;
  const zona = activo?.negocio.zona_horaria;
  const hoy = diaEnZona(zona);
  const navegar = useNavigate();
  const confirmar = useConfirmar();
  // undefined: cargando · null: nueva o no existe.
  const [borrador, setBorrador] = useState<CampanaNegocio | null | undefined>(
    id ? undefined : null,
  );
  const [alcance, setAlcance] = useState<Alcance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lanzando, setLanzando] = useState(false);
  // El texto del cupón se escribe solo hasta que la persona lo cambia.
  const [tituloPropio, setTituloPropio] = useState(Boolean(id));

  const { register, handleSubmit, reset, watch, setValue, formState } =
    useForm<Campana>({
      resolver: zodResolver(esquemaCampana),
      defaultValues: {
        tipo: "porcentaje",
        valor: 20,
        producto: "",
        titulo: tituloSugerido("porcentaje", 20, ""),
        mensaje: "",
        filtro: "todos",
        inicia: hoy,
        termina: diaEnZona(zona, 6),
      },
    });
  const [tipo, valor, producto, titulo, mensaje, filtro, inicia, termina] =
    watch([
      "tipo",
      "valor",
      "producto",
      "titulo",
      "mensaje",
      "filtro",
      "inicia",
      "termina",
    ]);

  useEffect(() => {
    if (!negocioId) return;
    void supabase
      .rpc("campanas_alcance", { p_negocio_id: negocioId })
      .then(({ data }) => setAlcance((data as Alcance | null) ?? null));
  }, [negocioId]);

  useEffect(() => {
    if (!negocioId || !id) return;
    void supabase
      .rpc("campanas_negocio", { p_negocio_id: negocioId })
      .then(({ data, error }) => {
        if (error) setError(mensajeDe(error));
        const c =
          ((data as CampanaNegocio[] | null) ?? []).find((f) => f.id === id) ??
          null;
        setBorrador(c);
        if (c && c.estado === "borrador")
          reset({
            tipo: c.tipo,
            valor: c.valor,
            producto: c.producto ?? "",
            titulo: c.titulo,
            mensaje: c.mensaje,
            filtro: c.filtro,
            // Un borrador viejo no puede empezar en el pasado.
            inicia: c.inicia < hoy ? hoy : c.inicia,
            termina: c.termina < hoy ? hoy : c.termina,
          });
      });
    // `hoy` cambia solo a medianoche; no hace falta recargar por eso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId, id, reset]);

  useEffect(() => {
    if (!tituloPropio)
      setValue("titulo", tituloSugerido(tipo, valor, producto).slice(0, 60), {
        shouldValidate: formState.isSubmitted,
      });
  }, [tipo, valor, producto, tituloPropio, setValue, formState.isSubmitted]);

  const enCarga = useCargaSinParpadeo(borrador === undefined);
  if (enCarga) return <Cargando />;
  if (id && (!borrador || borrador.estado !== "borrador"))
    return <Navigate to="/campanas" replace />;

  const conValor = tipo === "porcentaje" || tipo === "monto_fijo";
  const llegaA = alcance?.[filtro];
  const llegaPush = alcance?.push?.[filtro] ?? 0;
  const franja = activo
    ? `${activo.negocio.hora_inicio_envios.slice(0, 5)} y ${activo.negocio.hora_fin_envios.slice(0, 5)}`
    : "";
  const empiezaHoy = inicia <= hoy;
  const dias = inicia && termina ? diasEntre(inicia, termina) + 1 : 0;

  const guardar = async (v: Campana): Promise<string | null> => {
    if (!negocioId) return null;
    setError(null);
    const { data, error } = await supabase.rpc("campana_guardar", {
      p_negocio_id: negocioId,
      p_campana_id: id,
      p_tipo: v.tipo,
      p_valor:
        v.tipo === "porcentaje" || v.tipo === "monto_fijo"
          ? (v.valor ?? undefined)
          : undefined,
      p_producto: v.producto || undefined,
      p_titulo: v.titulo,
      p_mensaje: v.mensaje || undefined,
      p_filtro: v.filtro,
      p_inicia: v.inicia,
      p_termina: v.termina,
    });
    if (error) {
      setError(mensajeDe(error));
      return null;
    }
    return data;
  };

  const guardarBorrador = handleSubmit(async (v) => {
    if (await guardar(v)) {
      toast.success("Borrador guardado");
      navegar("/campanas");
    }
  });

  const lanzar = handleSubmit(async (v) => {
    const cuantos = alcance?.[v.filtro] ?? 0;
    const conPush = alcance?.push?.[v.filtro] ?? 0;
    const avisoPush =
      conPush > 0
        ? ` ${conPush === 1 ? "A 1 le llega" : `A ${numero(conPush)} les llega`} además una notificación.`
        : "";
    const hoyMismo = v.inicia <= hoy;
    const ok = await confirmar({
      titulo: hoyMismo
        ? `¿Lanzar “${v.titulo}”?`
        : `¿Programar “${v.titulo}” para el ${dia(v.inicia)}?`,
      descripcion: hoyMismo
        ? `${numero(cuantos)} ${cuantos === 1 ? "cliente recibe" : "clientes reciben"} el cupón en su tarjeta ahora mismo.${avisoPush} Después puedes cancelarla, pero ya no editarla.`
        : `El ${dia(v.inicia)} a primera hora le llega el cupón a quien esté en el grupo ese día (hoy ${cuantos === 1 ? "es 1 cliente" : `son ${numero(cuantos)} clientes`}).${avisoPush} Puedes cancelarla antes.`,
      textoConfirmar: hoyMismo ? "Lanzar ahora" : "Programar",
    });
    if (!ok) return;
    setLanzando(true);
    const campanaId = await guardar(v);
    if (!campanaId) {
      setLanzando(false);
      return;
    }
    const { data, error } = await supabase.rpc("campana_lanzar", {
      p_campana_id: campanaId,
    });
    setLanzando(false);
    if (error) {
      setError(mensajeDe(error));
      // Ya quedó guardada como borrador: seguir editándola por su id.
      if (!id) navegar(`/campanas/${campanaId}`, { replace: true });
      return;
    }
    const r = data as { programada: boolean; cupones: number };
    // Los push salen en segundo plano; lo que no salga ahora lo manda pg_cron.
    if (!r.programada && negocioId)
      void enviarPushCampanas(negocioId).catch(() => undefined);
    toast.success(
      r.programada
        ? `Programada para el ${dia(v.inicia)}`
        : `Lanzada: ${numero(r.cupones)} ${r.cupones === 1 ? "cupón emitido" : "cupones emitidos"}`,
    );
    navegar("/campanas");
  });

  const eliminar = async () => {
    if (!id) return;
    const ok = await confirmar({
      titulo: "¿Eliminar este borrador?",
      descripcion: "No se emitió ningún cupón. Esto no se puede deshacer.",
      textoConfirmar: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc("campana_eliminar", {
      p_campana_id: id,
    });
    if (error) {
      setError(mensajeDe(error));
      return;
    }
    toast.success("Borrador eliminado");
    navegar("/campanas");
  };

  const ocupado = formState.isSubmitting || lanzando;
  const e = formState.errors;

  return (
    <>
      <EncabezadoPagina
        titulo={id ? "Editar campaña" : "Nueva campaña"}
        descripcion="Le llega como cupón a la tarjeta de tus clientes y se canjea en caja."
        accion={
          <Link
            to="/campanas"
            className={variantesBoton({ variante: "fantasma", tamano: "sm" })}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Campañas
          </Link>
        }
      />
      <form
        noValidate
        onSubmit={lanzar}
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo>La promoción</TarjetaTitulo>
              <TarjetaDescripcion>
                Qué gana tu cliente al mostrar el cupón en caja.
              </TarjetaDescripcion>
            </TarjetaEncabezado>
            <TarjetaContenido className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="mb-1.5 text-etiqueta font-medium text-texto-2">
                  Tipo
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {tipos.map((t) => (
                    <Opcion
                      key={t.id}
                      registro={register("tipo")}
                      valor={t.id}
                      elegida={tipo === t.id}
                      className="flex-row items-center gap-2.5"
                    >
                      <span
                        className={cn(
                          "[&_svg]:size-4",
                          tipo === t.id ? "text-acento-texto" : "text-texto-3",
                        )}
                        aria-hidden
                      >
                        {t.icono}
                      </span>
                      <span className="text-sm font-medium text-texto">
                        {t.nombre}
                      </span>
                    </Opcion>
                  ))}
                </div>
              </fieldset>
              {conValor ? (
                <Campo
                  id="valor"
                  etiqueta={
                    tipo === "porcentaje" ? "Descuento (%)" : "Descuento ($)"
                  }
                  error={e.valor?.message}
                >
                  <Entrada
                    id="valor"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={tipo === "porcentaje" ? 100 : undefined}
                    step={tipo === "porcentaje" ? 1 : 500}
                    {...register("valor", { setValueAs: numeroONulo })}
                  />
                </Campo>
              ) : null}
              <Campo
                id="producto"
                etiqueta={conValor ? "En qué (opcional)" : "Producto"}
                ayuda={ayudaProducto[tipo]}
                error={e.producto?.message}
                className={conValor ? undefined : "sm:col-span-2"}
              >
                <Entrada
                  id="producto"
                  placeholder={conValor ? "conos dobles" : "malteada pequeña"}
                  maxLength={80}
                  {...register("producto")}
                />
              </Campo>
              <Campo
                id="titulo"
                etiqueta="Texto del cupón"
                ayuda="Lo ve tu cliente y lo lee el cajero al canjear."
                error={e.titulo?.message}
                className="sm:col-span-2"
              >
                <Entrada
                  id="titulo"
                  maxLength={60}
                  {...register("titulo", {
                    onChange: () => setTituloPropio(true),
                  })}
                />
              </Campo>
              <Campo
                id="mensaje"
                etiqueta="Mensaje (opcional)"
                ayuda={`${mensaje.length}/180 · Va debajo del cupón en el club.`}
                error={e.mensaje?.message}
                className="sm:col-span-2"
              >
                <Entrada
                  id="mensaje"
                  maxLength={180}
                  placeholder="Te extrañamos: vuelve esta semana por tu cono."
                  {...register("mensaje")}
                />
              </Campo>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo>Para quién</TarjetaTitulo>
              <TarjetaDescripcion>
                Solo clientes que aceptan promociones en su club
                {alcance
                  ? ` (${numero(alcance.todos)} de ${numero(alcance.clientes)}).`
                  : "."}
              </TarjetaDescripcion>
            </TarjetaEncabezado>
            <TarjetaContenido>
              <fieldset>
                <legend className="sr-only">Grupo de clientes</legend>
                <div className="flex flex-col gap-2">
                  {segmentos.map((s) => (
                    <Opcion
                      key={s.id}
                      registro={register("filtro")}
                      valor={s.id}
                      elegida={filtro === s.id}
                      className="flex-row items-center justify-between gap-4 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-texto">
                          {s.nombre}
                        </span>
                        <span className="block text-xs text-texto-3">
                          {s.detalle}
                        </span>
                      </span>
                      <Cifra valor={alcance?.[s.id as SegmentoCampana]} />
                    </Opcion>
                  ))}
                </div>
              </fieldset>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo>Cuándo</TarjetaTitulo>
              <TarjetaDescripcion>
                Si empieza otro día, los cupones salen ese día a primera hora.
                Vencen al terminar el último día, en la hora de tu negocio.
              </TarjetaDescripcion>
            </TarjetaEncabezado>
            <TarjetaContenido className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo id="inicia" etiqueta="Empieza" error={e.inicia?.message}>
                <Entrada
                  id="inicia"
                  type="date"
                  min={hoy}
                  {...register("inicia")}
                />
              </Campo>
              <Campo
                id="termina"
                etiqueta="Termina"
                error={e.termina?.message}
              >
                <Entrada
                  id="termina"
                  type="date"
                  min={inicia || hoy}
                  {...register("termina")}
                />
              </Campo>
              <div
                className="flex flex-wrap items-center gap-1.5 sm:col-span-2"
                role="group"
                aria-label="Duración"
              >
                {duraciones.map((d) => {
                  const elegida = dias === d.dias;
                  return (
                    <button
                      key={d.dias}
                      type="button"
                      aria-pressed={elegida}
                      onClick={() => {
                        const desde = new Date(`${inicia || hoy}T00:00:00Z`);
                        desde.setUTCDate(desde.getUTCDate() + d.dias - 1);
                        setValue("termina", desde.toISOString().slice(0, 10), {
                          shouldValidate: formState.isSubmitted,
                        });
                      }}
                      className={cn(
                        "inline-flex h-8 items-center rounded-full border px-3 text-etiqueta font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco pointer-coarse:h-10",
                        elegida
                          ? "border-texto bg-texto text-fondo"
                          : "border-borde bg-superficie text-texto-2 hover:border-borde-fuerte hover:text-texto",
                      )}
                    >
                      {d.nombre}
                    </button>
                  );
                })}
                {dias > 0 && !duraciones.some((d) => d.dias === dias) ? (
                  <span className="px-1 text-xs text-texto-3 tabular-nums">
                    {dias === 1 ? "1 día" : `${numero(dias)} días`}
                  </span>
                ) : null}
              </div>
            </TarjetaContenido>
          </Tarjeta>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <section className="flex flex-col gap-2.5" aria-label="Vista previa">
            <h2 className="text-xs font-medium text-texto-3">
              Así lo ve tu cliente
            </h2>
            <NotificacionVistaPrevia
              negocio={activo?.negocio.nombre ?? "Tu negocio"}
              logo={activo?.negocio.logo_url}
              titulo={titulo}
              mensaje={mensaje}
            />
            <CuponVistaPrevia
              titulo={titulo}
              mensaje={mensaje}
              termina={termina || hoy}
            />
          </section>
          <p className="text-sm text-pretty text-texto-2">
            {llegaA === undefined ? (
              "Calculando a cuántos clientes llega…"
            ) : llegaA === 0 ? (
              <>Hoy nadie está en este grupo.</>
            ) : (
              <>
                Llega a{" "}
                <strong className="font-semibold text-texto tabular-nums">
                  {numero(llegaA)} {llegaA === 1 ? "cliente" : "clientes"}
                </strong>{" "}
                {empiezaHoy ? "hoy mismo" : `el ${dia(inicia)}`}, en su tarjeta
                del club.
                {llegaPush > 0 ? (
                  <>
                    {" "}
                    {llegaPush === llegaA ? (
                      "Todos"
                    ) : (
                      <span className="tabular-nums">{numero(llegaPush)}</span>
                    )}{" "}
                    {llegaPush === 1 && llegaPush !== llegaA
                      ? "recibe"
                      : "reciben"}{" "}
                    además la notificación.
                  </>
                ) : null}
              </>
            )}
          </p>
          {error ? <Aviso tono="peligro">{error}</Aviso> : null}
          <div className="flex flex-col gap-2">
            <Boton type="submit" tamano="lg" cargando={lanzando} disabled={ocupado}>
              {empiezaHoy ? "Lanzar ahora" : `Programar para el ${dia(inicia)}`}
            </Boton>
            <Boton
              variante="contorno"
              cargando={formState.isSubmitting && !lanzando}
              disabled={ocupado}
              onClick={() => void guardarBorrador()}
            >
              Guardar borrador
            </Boton>
            {id ? (
              <Boton
                variante="fantasma"
                tamano="sm"
                className="self-center text-texto-3 hover:text-peligro"
                disabled={ocupado}
                onClick={() => void eliminar()}
              >
                Eliminar borrador
              </Boton>
            ) : null}
          </div>
          <p className="text-xs text-pretty text-texto-3">
            La notificación llega solo a quien la activó en el club y sale
            entre las {franja}, con un máximo de{" "}
            {activo?.negocio.max_push_semana ?? 3} por cliente a la semana. El
            cupón llega siempre.
          </p>
        </aside>
      </form>
    </>
  );
}

// Opción de radio con aspecto de tarjeta; toda la caja es tocable.
function Opcion({
  registro,
  valor,
  elegida,
  className,
  children,
}: {
  registro: UseFormRegisterReturn;
  valor: string;
  elegida: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-1.5 rounded-control border px-3 py-2.5 transition-[border-color,background-color,box-shadow] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco pointer-coarse:min-h-11",
        elegida
          ? "border-acento-borde bg-acento-suave ring-1 ring-acento-borde ring-inset"
          : "border-borde bg-superficie hover:border-borde-fuerte",
        className,
      )}
    >
      <input type="radio" value={valor} className="sr-only" {...registro} />
      {children}
    </label>
  );
}

function Cifra({ valor }: { valor: number | undefined }) {
  return (
    <span className="shrink-0 text-sm font-medium text-texto tabular-nums">
      {valor === undefined ? (
        <span className="text-texto-3">·</span>
      ) : (
        numero(valor)
      )}
    </span>
  );
}
