import { zodResolver } from "@hookform/resolvers/zod";
import { esquemaPlan, numero, pesos, type Plan } from "@beely/tipos";
import {
  Aviso,
  Boton,
  Campo,
  Casilla,
  Dialogo,
  Entrada,
  Esqueleto,
  EstadoVacio,
  FilaLista,
  Insignia,
  Lista,
  Tarjeta,
  toast,
} from "@beely/ui";
import { Layers, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { EncabezadoPagina } from "../../componentes/DisenoPanel";
import { usePlanes } from "../../componentes/plataforma";
import { mensajeDe } from "../../lib/funciones";
import { supabase } from "../../lib/supabase";
import {
  usePlataformaStore,
  type PlanBeely,
} from "../../stores/usePlataformaStore";

const numeroONulo = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : Number(v);

const limite = (valor: number | null) =>
  valor === null ? "Sin límite" : numero(valor);

// "Plan Pro" → "plan_pro": sugerencia de código mientras se escribe el nombre.
const codigoDe = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

// null: diálogo cerrado; "nuevo": crear; un plan: editarlo.
type Edicion = null | "nuevo" | PlanBeely;

export function PaginaPlanes() {
  const planes = usePlanes();
  const negocios = usePlataformaStore((e) => e.negocios);
  const cargarNegocios = usePlataformaStore((e) => e.cargarNegocios);
  const error = usePlataformaStore((e) => e.error);
  const [edicion, setEdicion] = useState<Edicion>(null);

  useEffect(() => {
    if (negocios === null) void cargarNegocios();
  }, [negocios, cargarNegocios]);

  const negociosPorPlan = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const n of negocios ?? [])
      cuenta.set(n.plan, (cuenta.get(n.plan) ?? 0) + 1);
    return cuenta;
  }, [negocios]);

  const botonNuevo = (
    <Boton onClick={() => setEdicion("nuevo")}>
      <Plus />
      Nuevo plan
    </Boton>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Planes"
        descripcion="Los planes que se le asignan a cada negocio, con su precio mensual y sus límites."
        accion={botonNuevo}
      />
      <div className="flex flex-col gap-6">
        {error && planes === null ? (
          <Aviso tono="peligro">{error}</Aviso>
        ) : null}

        <Tarjeta>
          {planes === null ? (
            <Lista aria-busy>
              {[0, 1, 2].map((n) => (
                <FilaLista key={n}>
                  <Esqueleto className="h-9 w-64" />
                </FilaLista>
              ))}
            </Lista>
          ) : planes.length === 0 ? (
            <EstadoVacio
              icono={<Layers />}
              titulo="Aún no hay planes"
              descripcion="Crea el primero para asignarlo a los negocios."
              accion={botonNuevo}
            />
          ) : (
            <Lista>
              {planes.map((p) => (
                <FilaLista
                  key={p.codigo}
                  className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2 font-medium text-texto">
                      <span className="min-w-0 truncate">{p.nombre}</span>
                      {p.activo ? null : <Insignia>Inactivo</Insignia>}
                    </p>
                    <p className="truncate text-xs text-texto-3">
                      <span className="font-mono">{p.codigo}</span>
                      {p.descripcion ? ` · ${p.descripcion}` : null}
                    </p>
                  </div>
                  {/* Columnas de ancho fijo para que las cifras se alineen entre filas. */}
                  <dl className="col-span-2 grid grid-cols-4 gap-3 md:col-span-1 md:col-start-2 md:row-start-1 md:grid-cols-[6.5rem_5.5rem_5.5rem_4.5rem] md:text-right">
                    <Dato
                      etiqueta="Precio / mes"
                      valor={
                        p.precio_mensual === 0
                          ? "Gratis"
                          : pesos(p.precio_mensual)
                      }
                    />
                    <Dato etiqueta="Sedes" valor={limite(p.max_sedes)} />
                    <Dato etiqueta="Clientes" valor={limite(p.max_clientes)} />
                    <Dato
                      etiqueta="Negocios"
                      valor={
                        negocios === null
                          ? "—"
                          : numero(negociosPorPlan.get(p.codigo) ?? 0)
                      }
                    />
                  </dl>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    className="col-start-2 row-start-1 md:col-start-3"
                    onClick={() => setEdicion(p)}
                  >
                    Editar
                  </Boton>
                </FilaLista>
              ))}
            </Lista>
          )}
        </Tarjeta>
        <p className="text-xs text-texto-3">
          Un plan no se borra: desactívalo y deja de ofrecerse al asignar
          planes. Los negocios que ya lo tienen lo conservan.
        </p>
      </div>

      <Dialogo
        abierto={edicion !== null}
        onAbiertoCambia={(abierto) => {
          if (!abierto) setEdicion(null);
        }}
        titulo={edicion === "nuevo" ? "Nuevo plan" : "Editar plan"}
        descripcion="Deja los límites vacíos si el plan no tiene tope."
      >
        {edicion === null ? null : (
          <FormularioPlan
            key={edicion === "nuevo" ? "nuevo" : edicion.codigo}
            plan={edicion === "nuevo" ? null : edicion}
            ordenNuevo={Math.max(0, ...(planes ?? []).map((p) => p.orden)) + 1}
            onCerrar={() => setEdicion(null)}
          />
        )}
      </Dialogo>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[0.6875rem] text-texto-3">{etiqueta}</dt>
      <dd className="truncate text-sm text-texto tabular-nums">{valor}</dd>
    </div>
  );
}

function FormularioPlan({
  plan,
  ordenNuevo,
  onCerrar,
}: {
  plan: PlanBeely | null;
  ordenNuevo: number;
  onCerrar: () => void;
}) {
  const cargarPlanes = usePlataformaStore((e) => e.cargarPlanes);
  const [error, setError] = useState<string | null>(null);
  const [codigoTocado, setCodigoTocado] = useState(plan !== null);
  const { register, handleSubmit, setValue, formState } = useForm({
    resolver: zodResolver(esquemaPlan),
    defaultValues: {
      codigo: plan?.codigo ?? "",
      nombre: plan?.nombre ?? "",
      descripcion: plan?.descripcion ?? "",
      precio_mensual: plan?.precio_mensual ?? 0,
      max_sedes: plan?.max_sedes ?? null,
      max_clientes: plan?.max_clientes ?? null,
      activo: plan?.activo ?? true,
    },
  });

  const guardar = handleSubmit(async (valores: Plan) => {
    setError(null);
    const { codigo, ...cambios } = valores;
    const { error } = plan
      ? await supabase.from("planes").update(cambios).eq("codigo", plan.codigo)
      : await supabase
          .from("planes")
          .insert({ codigo, ...cambios, orden: ordenNuevo });
    if (error) {
      setError(
        error.code === "23505"
          ? "Ya existe un plan con ese código o ese nombre."
          : mensajeDe(error),
      );
      return;
    }
    toast.success(plan ? "Plan guardado" : "Plan creado", {
      description: valores.nombre,
    });
    await cargarPlanes();
    onCerrar();
  });

  const nombre = register("nombre");

  return (
    <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
      <Campo
        id="plan-nombre"
        etiqueta="Nombre"
        error={formState.errors.nombre?.message}
      >
        <Entrada
          id="plan-nombre"
          autoComplete="off"
          placeholder="Pro"
          {...nombre}
          onChange={(e) => {
            void nombre.onChange(e);
            if (!codigoTocado) setValue("codigo", codigoDe(e.target.value));
          }}
        />
      </Campo>
      <Campo
        id="plan-codigo"
        etiqueta="Código"
        ayuda={
          plan
            ? "El código no se cambia una vez creado."
            : "Identificador interno; no se puede cambiar después."
        }
        error={formState.errors.codigo?.message}
      >
        <Entrada
          id="plan-codigo"
          autoComplete="off"
          className="font-mono"
          placeholder="pro"
          disabled={plan !== null}
          {...register("codigo", { onChange: () => setCodigoTocado(true) })}
        />
      </Campo>
      <Campo
        id="plan-descripcion"
        etiqueta="Descripción (opcional)"
        error={formState.errors.descripcion?.message}
      >
        <Entrada
          id="plan-descripcion"
          autoComplete="off"
          placeholder="Para quién es y qué incluye"
          {...register("descripcion")}
        />
      </Campo>
      <Campo
        id="plan-precio"
        etiqueta="Precio mensual (COP)"
        error={formState.errors.precio_mensual?.message}
      >
        <Entrada
          id="plan-precio"
          type="number"
          inputMode="numeric"
          min={0}
          step="1000"
          {...register("precio_mensual", { valueAsNumber: true })}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo
          id="plan-sedes"
          etiqueta="Máximo de sedes"
          error={formState.errors.max_sedes?.message}
        >
          <Entrada
            id="plan-sedes"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Sin límite"
            {...register("max_sedes", { setValueAs: numeroONulo })}
          />
        </Campo>
        <Campo
          id="plan-clientes"
          etiqueta="Máximo de clientes"
          error={formState.errors.max_clientes?.message}
        >
          <Entrada
            id="plan-clientes"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Sin límite"
            {...register("max_clientes", { setValueAs: numeroONulo })}
          />
        </Campo>
      </div>
      <Casilla {...register("activo")}>
        Activo: se puede asignar a negocios
      </Casilla>
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="fantasma" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={formState.isSubmitting}>
          {plan ? "Guardar" : "Crear plan"}
        </Boton>
      </div>
    </form>
  );
}
