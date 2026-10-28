import { zodResolver } from "@hookform/resolvers/zod";
import { esquemaSede } from "@beely/tipos";
import {
  Aviso,
  Boton,
  Campo,
  Entrada,
  EstadoVacio,
  FilaLista,
  Insignia,
  Lista,
  Tarjeta,
  TarjetaContenido,
  TarjetaEncabezado,
  TarjetaTitulo,
} from "@beely/ui";
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { EncabezadoPagina } from "../componentes/DisenoPanel";
import { mensajeDe } from "../lib/funciones";
import { supabase } from "../lib/supabase";
import {
  puedeConfigurar,
  type Sede,
  useNegocioActivo,
  useNegocioStore,
} from "../stores/useNegocioStore";
import { useSesionStore } from "../stores/useSesionStore";

const numeroONulo = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : Number(v);

export function PaginaSedes() {
  const activo = useNegocioActivo();
  const sedes = useNegocioStore((e) => e.sedes);
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin);
  const [editando, setEditando] = useState<Sede | "nueva" | null>(null);
  const editable = puedeConfigurar(activo?.rol);

  if (!activo) return null;

  return (
    <>
      <EncabezadoPagina
        titulo="Sedes"
        descripcion="Puntos de venta del negocio. Las coordenadas se usan luego en Google y Apple Wallet."
        accion={
          esSuperadmin && editando === null ? (
            <Boton onClick={() => setEditando("nueva")}>
              <Plus className="size-4" /> Nueva sede
            </Boton>
          ) : null
        }
      />
      {!esSuperadmin && editable ? (
        <p className="-mt-3 mb-5 text-etiqueta text-texto-3">
          Para abrir o cerrar sedes escribe a soporte de Beely; aquí puedes
          editar sus datos.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {editando === "nueva" ? (
          <FormularioSede
            negocioId={activo.negocio.id}
            onListo={() => setEditando(null)}
          />
        ) : null}
        {sedes.length === 0 && editando === null ? (
          <Tarjeta>
            <EstadoVacio
              icono={<MapPin />}
              titulo="Este negocio aún no tiene sedes"
              descripcion="Cada punto de venta del negocio aparecerá aquí."
            />
          </Tarjeta>
        ) : null}
        {sedes.length > 0 ? (
          <Tarjeta className="overflow-hidden">
            <Lista>
              {sedes.map((sede) =>
                editando !== null &&
                editando !== "nueva" &&
                editando.id === sede.id ? (
                  <li key={sede.id} className="bg-fondo/60">
                    <FormularioSede
                      negocioId={activo.negocio.id}
                      sede={sede}
                      onListo={() => setEditando(null)}
                      enLinea
                    />
                  </li>
                ) : (
                  <FilaLista key={sede.id} className="flex-nowrap py-3.5">
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 font-medium text-texto">
                        <span className="truncate" title={sede.nombre}>
                          {sede.nombre}
                        </span>
                        {!sede.activa ? (
                          <Insignia tono="peligro">Inactiva</Insignia>
                        ) : null}
                      </p>
                      <p className="truncate text-etiqueta text-texto-3">
                        {sede.direccion ?? "Sin dirección"}
                      </p>
                      {sede.latitud !== null && sede.longitud !== null ? (
                        <p className="truncate font-mono text-xs text-texto-3">
                          {sede.latitud}, {sede.longitud}
                        </p>
                      ) : null}
                    </div>
                    {editable && editando === null ? (
                      <Boton
                        variante="contorno"
                        tamano="sm"
                        onClick={() => setEditando(sede)}
                      >
                        Editar
                      </Boton>
                    ) : null}
                  </FilaLista>
                ),
              )}
            </Lista>
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}

// `enLinea`: se edita dentro de la fila de la lista, sin tarjeta propia.
function FormularioSede({
  negocioId,
  sede,
  onListo,
  enLinea = false,
}: {
  negocioId: string;
  sede?: Sede;
  onListo: () => void;
  enLinea?: boolean;
}) {
  const recargarSedes = useNegocioStore((e) => e.recargarSedes);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaSede),
    defaultValues: {
      nombre: sede?.nombre ?? "",
      direccion: sede?.direccion ?? "",
      latitud: sede?.latitud ?? null,
      longitud: sede?.longitud ?? null,
      activa: sede?.activa ?? true,
    },
  });

  const guardar = handleSubmit(async (valores) => {
    setError(null);
    const { error } = sede
      ? await supabase.from("sedes").update(valores).eq("id", sede.id)
      : await supabase
          .from("sedes")
          .insert({ ...valores, negocio_id: negocioId });
    if (error) {
      setError(mensajeDe(error));
      return;
    }
    await recargarSedes();
    onListo();
  });

  const formulario = (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={guardar}
      noValidate
    >
      <Campo
        id="nombre"
        etiqueta="Nombre"
        error={formState.errors.nombre?.message}
      >
        <Entrada id="nombre" {...register("nombre")} />
      </Campo>
      <Campo
        id="direccion"
        etiqueta="Dirección"
        error={formState.errors.direccion?.message}
      >
        <Entrada id="direccion" {...register("direccion")} />
      </Campo>
      <Campo
        id="latitud"
        etiqueta="Latitud"
        error={formState.errors.latitud?.message}
      >
        <Entrada
          id="latitud"
          type="number"
          step="any"
          {...register("latitud", { setValueAs: numeroONulo })}
        />
      </Campo>
      <Campo
        id="longitud"
        etiqueta="Longitud"
        error={formState.errors.longitud?.message}
      >
        <Entrada
          id="longitud"
          type="number"
          step="any"
          {...register("longitud", { setValueAs: numeroONulo })}
        />
      </Campo>
      <label className="flex items-center gap-2.5 text-sm text-texto-2 sm:col-span-2 pointer-coarse:min-h-11">
        <input
          type="checkbox"
          className="size-4 rounded accent-acento"
          {...register("activa")}
        />{" "}
        Sede activa (la caja puede elegirla)
      </label>
      {error ? (
        <Aviso tono="peligro" className="sm:col-span-2">
          {error}
        </Aviso>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Boton type="submit" cargando={formState.isSubmitting}>
          Guardar
        </Boton>
        <Boton variante="fantasma" onClick={onListo}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
  const titulo = sede ? `Editar ${sede.nombre}` : "Nueva sede";

  if (enLinea) {
    return (
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        <p className="truncate text-seccion text-texto">{titulo}</p>
        {formulario}
      </div>
    );
  }
  return (
    <Tarjeta className="motion-safe:animate-aparecer">
      <TarjetaEncabezado>
        <TarjetaTitulo className="truncate">{titulo}</TarjetaTitulo>
      </TarjetaEncabezado>
      <TarjetaContenido>{formulario}</TarjetaContenido>
    </Tarjeta>
  );
}
