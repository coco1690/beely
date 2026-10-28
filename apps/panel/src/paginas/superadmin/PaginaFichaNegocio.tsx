import { zodResolver } from "@hookform/resolvers/zod";
import {
  bucketLogos,
  esquemaMarcaNegocio,
  fecha,
  numero,
  zonasHorarias,
  type Tabla,
} from "@beely/tipos";
import {
  Aviso,
  Boton,
  Campo,
  Entrada,
  Esqueleto,
  EstadoVacio,
  LogoNegocio,
  Selector,
  Tarjeta,
  TarjetaContenido,
  TarjetaDescripcion,
  TarjetaEncabezado,
  TarjetaTitulo,
  toast,
} from "@beely/ui";
import { ArrowLeft, ArrowUpRight, Globe, SearchX, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { GestionEquipo } from "../../componentes/GestionEquipo";
import {
  Cifra,
  dominioClub,
  estados,
  GrupoCifras,
  haceCuanto,
  InsigniaEstado,
  InsigniaPlan,
  nombresEstado,
  nombresPlan,
  planes,
} from "../../componentes/plataforma";
import { conectarDominioClub, mensajeDe } from "../../lib/funciones";
import { supabase } from "../../lib/supabase";
import { useNegocioStore } from "../../stores/useNegocioStore";
import { usePlataformaStore } from "../../stores/usePlataformaStore";
import { useSesionStore } from "../../stores/useSesionStore";

const esquemaDatos = esquemaMarcaNegocio.pick({
  nombre: true,
  razon_social: true,
  nit: true,
  zona_horaria: true,
});

// Recarga todo lo que muestra datos de negocios: métricas de plataforma y el selector de negocios.
function useRecargarTodo() {
  const cargarNegocios = usePlataformaStore((e) => e.cargarNegocios);
  const cargarTablero = usePlataformaStore((e) => e.cargarTablero);
  const usuarioId = useSesionStore((e) => e.sesion?.user.id);
  const cargarMembresias = useNegocioStore((e) => e.cargar);
  return useCallback(
    () =>
      Promise.all([
        cargarNegocios(),
        cargarTablero(),
        usuarioId ? cargarMembresias(usuarioId, true) : null,
      ]),
    [cargarNegocios, cargarTablero, usuarioId, cargarMembresias],
  );
}

export function PaginaFichaNegocio() {
  const { id = "" } = useParams();
  const { dias, negocios, cargarNegocios } = usePlataformaStore();
  const elegirNegocio = useNegocioStore((e) => e.elegirNegocio);
  const navegar = useNavigate();
  const [negocio, setNegocio] = useState<Tabla<"negocios"> | null | undefined>(
    undefined,
  );
  const metricas = negocios?.find((n) => n.id === id);

  const cargarNegocio = useCallback(async () => {
    const { data } = await supabase
      .from("negocios")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setNegocio(data);
  }, [id]);

  useEffect(() => {
    void cargarNegocio();
    if (!negocios) void cargarNegocios();
  }, [cargarNegocio, negocios, cargarNegocios]);

  const abrirPanel = async (ruta: string) => {
    await elegirNegocio(id);
    void navegar(ruta);
  };

  const [conectando, setConectando] = useState(false);
  const conectarDominio = async () => {
    setConectando(true);
    try {
      const { dominio } = await conectarDominioClub(id);
      toast.success(`${dominio} conectado`, {
        description: "Puede tardar unos minutos en abrir mientras se emite el certificado.",
      });
    } catch (e) {
      toast.error("No se pudo conectar el subdominio", { description: mensajeDe(e) });
    } finally {
      setConectando(false);
    }
  };

  if (negocio === undefined) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <Esqueleto className="h-12 w-72" />
        <Esqueleto className="h-24 rounded-tarjeta" />
        <Esqueleto className="h-64 rounded-tarjeta" />
      </div>
    );
  }
  if (negocio === null) {
    return (
      <Tarjeta>
        <EstadoVacio
          icono={<SearchX />}
          titulo="Este negocio no existe"
          descripcion="Pudo haber sido eliminado."
          accion={
            <Link
              to="/superadmin/negocios"
              className="text-sm font-medium text-acento-texto hover:underline"
            >
              Ver todos los negocios
            </Link>
          }
        />
      </Tarjeta>
    );
  }

  return (
    <>
      <Link
        to="/superadmin/negocios"
        className="mb-4 inline-flex items-center gap-1.5 text-etiqueta font-medium text-texto-3 hover:text-texto focus-visible:outline-2 focus-visible:outline-foco [&_svg]:size-4"
      >
        <ArrowLeft />
        Negocios
      </Link>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 md:mb-8">
        <div className="flex min-w-0 items-center gap-3">
          <LogoNegocio
            url={negocio.logo_url}
            nombre={negocio.nombre}
            className="size-12"
          />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-titulo text-texto">
              <span className="min-w-0 break-words">{negocio.nombre}</span>
              <InsigniaPlan plan={negocio.plan} />
              <InsigniaEstado estado={negocio.estado} />
            </h1>
            <a
              href={`https://${negocio.slug}.${dominioClub}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-etiqueta text-texto-3 hover:text-texto hover:underline"
            >
              {negocio.slug}.{dominioClub}
            </a>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton
            variante="fantasma"
            disabled={conectando}
            title="Crea o repara el registro DNS y el dominio en Vercel"
            onClick={() => void conectarDominio()}
          >
            <Globe />
            {conectando ? "Conectando…" : "Conectar subdominio"}
          </Boton>
          <Boton variante="contorno" onClick={() => void abrirPanel("/caja")}>
            Abrir panel del negocio
            <ArrowUpRight />
          </Boton>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        {metricas ? (
          <GrupoCifras>
            <Cifra
              etiqueta="Clientes"
              valor={metricas.clientes}
              detalle={`+${numero(metricas.clientes_nuevos)} en ${dias} días`}
            />
            <Cifra
              etiqueta={`Sellos en ${dias} días`}
              valor={metricas.sellos_periodo}
              detalle={`Último: ${haceCuanto(metricas.ultimo_sello_en).toLowerCase()}`}
            />
            <Cifra
              etiqueta={`Canjes en ${dias} días`}
              valor={metricas.canjes_periodo}
            />
            <Cifra
              etiqueta="Sedes y equipo"
              valor={`${numero(metricas.sedes)} · ${numero(metricas.miembros)}`}
              detalle={`Creado el ${fecha(negocio.creado_en)}`}
            />
          </GrupoCifras>
        ) : (
          <Esqueleto className="h-[5.5rem] rounded-tarjeta" />
        )}

        <PlanEstado negocio={negocio} onGuardado={cargarNegocio} />
        <DatosNegocio negocio={negocio} onGuardado={cargarNegocio} />

        <section
          className="flex flex-col gap-3"
          aria-labelledby="titulo-equipo"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="titulo-equipo" className="text-seccion text-texto">
                Equipo
              </h2>
              <p className="text-etiqueta text-texto-3">
                Dueño, administradores y cajeros de este negocio.
              </p>
            </div>
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => void abrirPanel("/sedes")}
            >
              Gestionar sedes
              <ArrowUpRight />
            </Boton>
          </div>
          <GestionEquipo negocioId={negocio.id} rolPanel="superadmin" />
        </section>

        <ZonaPeligro negocio={negocio} />
      </div>
    </>
  );
}

function PlanEstado({
  negocio,
  onGuardado,
}: {
  negocio: Tabla<"negocios">;
  onGuardado: () => Promise<void>;
}) {
  const recargarTodo = useRecargarTodo();
  const [plan, setPlan] = useState(negocio.plan);
  const [estado, setEstado] = useState(negocio.estado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(negocio.plan);
    setEstado(negocio.estado);
  }, [negocio.plan, negocio.estado]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const { error } = await supabase.rpc("superadmin_actualizar_negocio", {
      p_negocio_id: negocio.id,
      p_plan: plan,
      p_estado: estado,
    });
    setGuardando(false);
    if (error) {
      setError(mensajeDe(error));
      return;
    }
    toast.success("Plan y estado guardados");
    await Promise.all([onGuardado(), recargarTodo()]);
  };

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>Plan y estado</TarjetaTitulo>
        <TarjetaDescripcion>
          Un negocio suspendido o cancelado no puede sumar sellos.
        </TarjetaDescripcion>
      </TarjetaEncabezado>
      <TarjetaContenido className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <Campo id="plan" etiqueta="Plan">
            <Selector
              id="plan"
              className="w-40"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              {planes.map((p) => (
                <option key={p} value={p}>
                  {nombresPlan[p]}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo id="estado" etiqueta="Estado">
            <Selector
              id="estado"
              className="w-40"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              {estados.map((e) => (
                <option key={e} value={e}>
                  {nombresEstado[e]}
                </option>
              ))}
            </Selector>
          </Campo>
          <Boton
            variante="contorno"
            onClick={() => void guardar()}
            cargando={guardando}
            disabled={plan === negocio.plan && estado === negocio.estado}
          >
            Guardar
          </Boton>
        </div>
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      </TarjetaContenido>
    </Tarjeta>
  );
}

function DatosNegocio({
  negocio,
  onGuardado,
}: {
  negocio: Tabla<"negocios">;
  onGuardado: () => Promise<void>;
}) {
  const recargarTodo = useRecargarTodo();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaDatos),
  });

  useEffect(() => {
    reset({
      nombre: negocio.nombre,
      razon_social: negocio.razon_social ?? "",
      nit: negocio.nit ?? "",
      zona_horaria: negocio.zona_horaria,
    });
  }, [negocio, reset]);

  const guardar = handleSubmit(async (valores) => {
    setError(null);
    const { error } = await supabase
      .from("negocios")
      .update(valores)
      .eq("id", negocio.id);
    if (error) {
      setError(mensajeDe(error));
      return;
    }
    toast.success("Datos guardados");
    await Promise.all([onGuardado(), recargarTodo()]);
  });

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>Datos del negocio</TarjetaTitulo>
        <TarjetaDescripcion>
          Logo y colores los cambia el negocio desde su panel.
        </TarjetaDescripcion>
      </TarjetaEncabezado>
      <TarjetaContenido>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={guardar}
          noValidate
        >
          <Campo
            id="datos-nombre"
            etiqueta="Nombre comercial"
            error={formState.errors.nombre?.message}
            className="sm:col-span-2"
          >
            <Entrada id="datos-nombre" {...register("nombre")} />
          </Campo>
          <Campo
            id="datos-razon"
            etiqueta="Razón social"
            error={formState.errors.razon_social?.message}
          >
            <Entrada id="datos-razon" {...register("razon_social")} />
          </Campo>
          <Campo
            id="datos-nit"
            etiqueta="NIT"
            error={formState.errors.nit?.message}
          >
            <Entrada id="datos-nit" {...register("nit")} />
          </Campo>
          <Campo
            id="datos-zona"
            etiqueta="Zona horaria"
            ayuda="Define el día para el tope de sellos diarios."
            className="sm:col-span-2"
          >
            <Selector id="datos-zona" {...register("zona_horaria")}>
              {zonasHorarias.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Selector>
          </Campo>
          {error ? (
            <Aviso tono="peligro" className="sm:col-span-2">
              {error}
            </Aviso>
          ) : null}
          <div>
            <Boton
              type="submit"
              cargando={formState.isSubmitting}
              disabled={!formState.isDirty}
            >
              Guardar cambios
            </Boton>
          </div>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}

// Eliminar no se puede deshacer: se escribe el subdominio para confirmar.
function ZonaPeligro({ negocio }: { negocio: Tabla<"negocios"> }) {
  const recargarTodo = useRecargarTodo();
  const navegar = useNavigate();
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coincide = confirmacion.trim().toLowerCase() === negocio.slug;

  const eliminar = async () => {
    setEliminando(true);
    setError(null);
    // Primero los logos de su carpeta en Storage; si falla, el negocio igual se elimina.
    const { data: archivos } = await supabase.storage
      .from(bucketLogos)
      .list(negocio.id);
    if (archivos?.length)
      await supabase.storage
        .from(bucketLogos)
        .remove(archivos.map((a) => `${negocio.id}/${a.name}`));
    const { error } = await supabase.rpc("superadmin_eliminar_negocio", {
      p_negocio_id: negocio.id,
      p_confirmacion: confirmacion,
    });
    setEliminando(false);
    if (error) {
      setError(mensajeDe(error));
      return;
    }
    toast.success(`${negocio.nombre} fue eliminado`);
    await recargarTodo();
    void navegar("/superadmin/negocios", { replace: true });
  };

  return (
    <Tarjeta className="border-peligro-borde">
      <TarjetaEncabezado>
        <TarjetaTitulo>Eliminar negocio</TarjetaTitulo>
        <TarjetaDescripcion>
          Borra para siempre el negocio con sus clientes, tarjetas, sellos,
          cupones, sedes y equipo. Si solo quieres pausarlo, cámbialo a
          suspendido.
        </TarjetaDescripcion>
      </TarjetaEncabezado>
      <TarjetaContenido className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <Campo
            id="confirmar-eliminar"
            etiqueta={`Escribe ${negocio.slug} para confirmar`}
            className="min-w-56 flex-1"
          >
            <Entrada
              id="confirmar-eliminar"
              autoComplete="off"
              spellCheck={false}
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </Campo>
          <Boton
            variante="peligro"
            disabled={!coincide}
            cargando={eliminando}
            onClick={() => void eliminar()}
          >
            <Trash2 />
            Eliminar negocio
          </Boton>
        </div>
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      </TarjetaContenido>
    </Tarjeta>
  );
}
