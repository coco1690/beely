import { zodResolver } from "@hookform/resolvers/zod";
import {
  esquemaClaveInicial,
  esquemaCrearNegocio,
  numero,
  zonasHorarias,
} from "@beely/tipos";
import {
  Aviso,
  Boton,
  Campo,
  cn,
  Entrada,
  EntradaClave,
  EstadoVacio,
  Esqueleto,
  FilaLista,
  Interruptor,
  Lista,
  LogoNegocio,
  Selector,
  Tarjeta,
  TarjetaContenido,
  TarjetaEncabezado,
  TarjetaTitulo,
  toast,
  useConfirmar,
} from "@beely/ui";
import { Plus, Search, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { EncabezadoPagina } from "../../componentes/DisenoPanel";
import {
  avisarAlta,
  type RespuestaEquipo,
} from "../../componentes/GestionEquipo";
import {
  dominioClub,
  estados,
  haceCuanto,
  InsigniaEstado,
  InsigniaPlan,
  nombresEstado,
  SelectorPeriodo,
  usePlanes,
} from "../../componentes/plataforma";
import {
  conectarDominioClub,
  llamarFuncion,
  mensajeDe,
} from "../../lib/funciones";
import { supabase } from "../../lib/supabase";
import { useNegocioStore } from "../../stores/useNegocioStore";
import {
  usePlataformaStore,
  type NegocioPlataforma,
} from "../../stores/usePlataformaStore";
import { useSesionStore } from "../../stores/useSesionStore";

export function PaginaNegocios() {
  const { dias, negocios, error, elegirDias, cargarNegocios } =
    usePlataformaStore();
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [plan, setPlan] = useState("");
  const planes = usePlanes();

  useEffect(() => {
    void cargarNegocios();
  }, [cargarNegocios]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (negocios ?? []).filter(
      (n) =>
        (!estado || n.estado === estado) &&
        (!plan || n.plan === plan) &&
        (!texto ||
          [n.nombre, n.slug, n.dueno_email ?? ""].some((campo) =>
            campo.toLowerCase().includes(texto),
          )),
    );
  }, [negocios, busqueda, estado, plan]);

  return (
    <>
      <EncabezadoPagina
        titulo="Negocios"
        descripcion="Todos los negocios de Beely: alta, plan, estado, equipo y baja."
        accion={
          creando ? null : (
            <Boton onClick={() => setCreando(true)}>
              <Plus />
              Nuevo negocio
            </Boton>
          )
        }
      />
      <div className="flex flex-col gap-6">
        {creando ? (
          <FormularioNuevo onCerrar={() => setCreando(false)} />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-3"
              aria-hidden
            />
            <Entrada
              aria-label="Buscar negocio"
              placeholder="Buscar por nombre, subdominio o dueño"
              className="pl-9"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Selector
            aria-label="Estado"
            className="w-40"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Estado: todos</option>
            {estados.map((e) => (
              <option key={e} value={e}>
                {nombresEstado[e]}
              </option>
            ))}
          </Selector>
          <Selector
            aria-label="Plan"
            className="w-36"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="">Plan: todos</option>
            {(planes ?? []).map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </Selector>
          <SelectorPeriodo valor={dias} onCambio={(d) => void elegirDias(d)} />
        </div>

        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        <Tarjeta>
          {/* Encabezado de columnas solo en escritorio; en móvil cada fila apila sus datos. */}
          <div
            className={cn(
              columnas,
              "hidden gap-4 border-b border-borde px-5 py-2.5 text-xs font-medium text-texto-3 md:grid",
            )}
          >
            <span>Negocio</span>
            <span className="text-right">Clientes</span>
            <span className="text-right">Sellos {dias} d</span>
            <span className="text-right">Canjes {dias} d</span>
            <span className="text-right">Último sello</span>
            <span className="text-right">Activo</span>
          </div>
          {negocios === null ? (
            <Lista aria-busy>
              {[0, 1, 2].map((n) => (
                <FilaLista key={n}>
                  <Esqueleto className="h-9 w-64" />
                </FilaLista>
              ))}
            </Lista>
          ) : filtrados.length === 0 ? (
            <EstadoVacio
              icono={<Store />}
              titulo={
                negocios.length === 0
                  ? "Aún no hay negocios"
                  : "Ningún negocio coincide"
              }
              descripcion={
                negocios.length === 0
                  ? 'Crea el primero con "Nuevo negocio".'
                  : "Prueba con otra búsqueda o quita los filtros."
              }
            />
          ) : (
            <Lista>
              {filtrados.map((n) => (
                <FilaNegocio key={n.id} negocio={n} dias={dias} />
              ))}
            </Lista>
          )}
        </Tarjeta>
        {negocios && negocios.length > 0 ? (
          <p className="text-xs text-texto-3">
            {filtrados.length === negocios.length
              ? `${numero(negocios.length)} negocios`
              : `${numero(filtrados.length)} de ${numero(negocios.length)} negocios`}
          </p>
        ) : null}
      </div>
    </>
  );
}

// Móvil: negocio, clientes e interruptor. Escritorio: todas las métricas.
const columnas =
  "grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_7rem_3.5rem]";

// La fila entera abre la ficha (enlace estirado con ::after); el interruptor queda
// por encima para cambiar el estado sin salir de la lista.
function FilaNegocio({
  negocio: n,
  dias,
}: {
  negocio: NegocioPlataforma;
  dias: number;
}) {
  const cambiarEstado = usePlataformaStore((e) => e.cambiarEstado);
  const usuarioId = useSesionStore((e) => e.sesion?.user.id);
  const cargarMembresias = useNegocioStore((e) => e.cargar);
  const confirmar = useConfirmar();
  const [guardando, setGuardando] = useState(false);
  const activo = n.estado === "activo";

  const alternar = async (encender: boolean) => {
    const ok = await confirmar(
      encender
        ? {
            titulo: `¿Activar ${n.nombre}?`,
            descripcion: `Vuelve a sumar sellos, su club en ${n.slug}.${dominioClub} acepta registros y el equipo trabaja normal.`,
            textoConfirmar: "Activar",
          }
        : {
            titulo: `¿Suspender ${n.nombre}?`,
            descripcion: `Mientras esté suspendido no se suman sellos ni se registran clientes en ${n.slug}.${dominioClub}. Sus datos se conservan y lo puedes reactivar cuando quieras.`,
            textoConfirmar: "Suspender",
            peligro: true,
          },
    );
    if (!ok) return;
    setGuardando(true);
    const error = await cambiarEstado(n.id, encender ? "activo" : "suspendido");
    setGuardando(false);
    if (error) {
      toast.error(
        `No se pudo ${encender ? "activar" : "suspender"} ${n.nombre}`,
        {
          description: error,
        },
      );
      return;
    }
    toast.success(
      encender ? `${n.nombre} está activo` : `${n.nombre} quedó suspendido`,
    );
    if (usuarioId) void cargarMembresias(usuarioId, true);
  };

  return (
    <li
      className={cn(
        columnas,
        "relative grid items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-texto/3 sm:px-5",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <LogoNegocio
          url={n.logo_url}
          nombre={n.nombre}
          className={cn(
            "size-9 transition-[opacity,filter] duration-(--duracion-lenta)",
            !activo && "opacity-50 grayscale",
          )}
        />
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <Link
              to={`/superadmin/negocios/${n.id}`}
              className="truncate text-sm font-medium text-texto after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-foco"
            >
              {n.nombre}
            </Link>
            {/* En móvil el plan se ve en la ficha: el nombre tiene prioridad. */}
            <span className="hidden shrink-0 sm:inline-flex">
              <InsigniaPlan plan={n.plan} />
            </span>
            {!activo ? (
              <span className="shrink-0 transition-[opacity,scale] duration-(--duracion-media) starting:scale-95 starting:opacity-0">
                <InsigniaEstado estado={n.estado} />
              </span>
            ) : null}
          </span>
          <span className="truncate text-xs text-texto-3">
            <span className="font-mono">
              {n.slug}.{dominioClub}
            </span>
            {n.dueno_email ? ` · ${n.dueno_email}` : " · sin dueño"}
          </span>
        </span>
      </span>
      <Columna etiqueta="Clientes" valor={numero(n.clientes)} />
      <Columna etiqueta={`Sellos ${dias} d`} valor={numero(n.sellos_periodo)} />
      <Columna etiqueta={`Canjes ${dias} d`} valor={numero(n.canjes_periodo)} />
      <Columna etiqueta="Último sello" valor={haceCuanto(n.ultimo_sello_en)} />
      <span className="relative z-10 flex justify-end">
        <Interruptor
          activo={activo}
          onCambiar={(v) => void alternar(v)}
          etiqueta={`${activo ? "Suspender" : "Activar"} ${n.nombre}`}
          disabled={guardando}
          ocupado={guardando}
        />
      </span>
    </li>
  );
}

// En móvil solo se ve la primera métrica (clientes) a la derecha; el resto, en la ficha.
function Columna({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const esClientes = etiqueta === "Clientes";
  return (
    <span className={esClientes ? "text-right" : "hidden text-right md:block"}>
      <span className="block text-sm text-texto tabular-nums">{valor}</span>
      <span className="block text-[0.6875rem] text-texto-3 md:sr-only">
        {etiqueta}
      </span>
    </span>
  );
}

// Alta del negocio con su dueño opcional: con contraseña la cuenta queda lista; sin ella, le llega una invitación.
const esquemaNuevoNegocio = esquemaCrearNegocio
  .extend({
    email_dueno: z.union([
      z.literal(""),
      z.email("Correo inválido").trim().toLowerCase(),
    ]),
    clave_dueno: esquemaClaveInicial,
  })
  .refine((v) => v.clave_dueno === "" || v.email_dueno !== "", {
    message: "Escribe el correo del dueño",
    path: ["email_dueno"],
  });

function FormularioNuevo({ onCerrar }: { onCerrar: () => void }) {
  const navegar = useNavigate();
  const cargarNegocios = usePlataformaStore((e) => e.cargarNegocios);
  const cargarTablero = usePlataformaStore((e) => e.cargarTablero);
  const usuarioId = useSesionStore((e) => e.sesion?.user.id);
  const cargarMembresias = useNegocioStore((e) => e.cargar);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaNuevoNegocio),
    defaultValues: {
      slug: "",
      nombre: "",
      zona_horaria: "America/Bogota",
      email_dueno: "",
      clave_dueno: "",
    },
  });

  const crear = handleSubmit(
    async ({ slug, nombre, zona_horaria, email_dueno, clave_dueno }) => {
      setError(null);
      const { data, error } = await supabase.rpc("crear_negocio", {
        p_slug: slug,
        p_nombre: nombre,
        p_zona_horaria: zona_horaria,
      });
      if (error) {
        setError(mensajeDe(error));
        return;
      }
      toast.success(`Negocio ${nombre} creado`, {
        description: email_dueno
          ? "Ya tiene su programa de sellos."
          : "Ya tiene su programa de sellos. Ahora agrega al dueño.",
      });
      try {
        await conectarDominioClub(data);
      } catch (e) {
        // El negocio ya existe: el subdominio se reintenta desde su ficha.
        toast.error(`${slug}.${dominioClub} quedó sin conectar`, {
          description: mensajeDe(e),
        });
      }
      if (email_dueno) {
        try {
          const r = await llamarFuncion<RespuestaEquipo>("panel-equipo", {
            negocio_id: data,
            email: email_dueno,
            rol: "dueno",
            clave: clave_dueno || undefined,
          });
          avisarAlta(email_dueno, r.cuenta, Boolean(clave_dueno));
        } catch (e) {
          // El negocio ya existe: el dueño se puede agregar luego desde su ficha.
          toast.error("No se pudo agregar al dueño", {
            description: mensajeDe(e),
          });
        }
      }
      await Promise.all([
        cargarNegocios(),
        cargarTablero(),
        usuarioId ? cargarMembresias(usuarioId, true) : null,
      ]);
      void navegar(`/superadmin/negocios/${data}`);
    },
  );

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>Nuevo negocio</TarjetaTitulo>
      </TarjetaEncabezado>
      <TarjetaContenido className="flex flex-col gap-4">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start"
          onSubmit={crear}
          noValidate
        >
          <Campo
            id="nombre"
            etiqueta="Nombre"
            error={formState.errors.nombre?.message}
          >
            <Entrada id="nombre" autoFocus {...register("nombre")} />
          </Campo>
          <Campo
            id="slug"
            etiqueta="Subdominio"
            ayuda={`{slug}.${dominioClub}; no se puede cambiar.`}
            error={formState.errors.slug?.message}
          >
            <Entrada
              id="slug"
              placeholder="heladeria-luna"
              {...register("slug")}
            />
          </Campo>
          <Campo id="zona_horaria" etiqueta="Zona horaria">
            <Selector id="zona_horaria" {...register("zona_horaria")}>
              {zonasHorarias.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo
            id="email_dueno"
            etiqueta="Correo del dueño"
            ayuda="Opcional; también puedes agregarlo luego."
            error={formState.errors.email_dueno?.message}
            className="sm:col-span-2"
          >
            <Entrada
              id="email_dueno"
              type="email"
              autoComplete="off"
              placeholder="dueno@negocio.com"
              {...register("email_dueno")}
            />
          </Campo>
          <Campo
            id="clave_dueno"
            etiqueta="Contraseña del dueño"
            ayuda="Opcional. Sin contraseña le llega una invitación por correo."
            error={formState.errors.clave_dueno?.message}
          >
            <EntradaClave
              id="clave_dueno"
              autoComplete="new-password"
              {...register("clave_dueno")}
            />
          </Campo>
          <div className="flex gap-2 sm:col-span-3">
            <Boton type="submit" cargando={formState.isSubmitting}>
              Crear negocio
            </Boton>
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
          </div>
        </form>
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      </TarjetaContenido>
    </Tarjeta>
  );
}
