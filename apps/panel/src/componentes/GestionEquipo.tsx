import { zodResolver } from "@hookform/resolvers/zod";
import {
  esquemaClaveInicial,
  esquemaInvitarMiembro,
  type RolEquipo,
} from "@beely/tipos";
import {
  Aviso,
  Boton,
  Campo,
  Entrada,
  EntradaClave,
  Esqueleto,
  FilaLista,
  Insignia,
  Lista,
  Selector,
  Tarjeta,
  TarjetaContenido,
  TarjetaEncabezado,
  TarjetaTitulo,
  toast,
  useConfirmar,
} from "@beely/ui";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { fechaHora, nombresRol } from "@beely/tipos";
import { llamarFuncion, mensajeDe } from "../lib/funciones";
import { supabase } from "../lib/supabase";
import { puedeGestionarEquipo, type RolPanel } from "../stores/useNegocioStore";
import { useSesionStore } from "../stores/useSesionStore";

type Integrante = {
  usuario_id: string;
  email: string;
  rol: string;
  creado_en: string;
  ultimo_ingreso_en: string | null;
  invitacion_pendiente: boolean;
};

const esquemaFormulario = esquemaInvitarMiembro
  .omit({ negocio_id: true })
  .extend({ clave: esquemaClaveInicial });

export type RespuestaEquipo = {
  usuario_id: string;
  cuenta: "creada" | "invitada" | "existente";
};

// Mensaje tras sumar a alguien al equipo, según cómo quedó su cuenta.
// `conClave`: se escribió una contraseña inicial. Si la cuenta ya existía no se usa, y se avisa.
export function avisarAlta(
  email: string,
  cuenta: RespuestaEquipo["cuenta"],
  conClave: boolean,
) {
  if (cuenta === "creada")
    toast.success(`Cuenta creada para ${email}`, {
      description: "Ya puede ingresar con la contraseña que le pusiste.",
    });
  else if (cuenta === "invitada")
    toast.success(`Invitación enviada a ${email}`, {
      description: "Debe abrir el correo para definir su clave.",
    });
  else if (conClave)
    toast.warning(`${email} ya tenía cuenta en Beely`, {
      description:
        "Se agregó al negocio, pero la contraseña que escribiste no se usó: entra con su clave de siempre o con «Olvidé mi clave».",
    });
  else
    toast.success(`${email} ya es parte del negocio`, {
      description: "Ya tenía cuenta en Beely; entra con su clave de siempre.",
    });
}

// Equipo de un negocio: invitar, cambiar rol y quitar. Lo usan la página Equipo del negocio
// y la ficha del negocio en el panel del superadmin.
export function GestionEquipo({
  negocioId,
  rolPanel,
}: {
  negocioId: string;
  rolPanel: RolPanel | undefined;
}) {
  const usuarioId = useSesionStore((e) => e.sesion?.user.id);
  const esSuperadmin = rolPanel === "superadmin";
  const gestiona = puedeGestionarEquipo(rolPanel);
  const [equipo, setEquipo] = useState<Integrante[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmar = useConfirmar();
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: { email: "", rol: "cajero" as RolEquipo, clave: "" },
  });

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("equipo_negocio", {
      p_negocio_id: negocioId,
    });
    if (error) setError(mensajeDe(error));
    setEquipo(data ?? []);
  }, [negocioId]);

  useEffect(() => {
    setEquipo(null);
    void cargar();
  }, [cargar]);

  const invitar = handleSubmit(async ({ email, rol, clave }) => {
    setError(null);
    try {
      const r = await llamarFuncion<RespuestaEquipo>("panel-equipo", {
        negocio_id: negocioId,
        email,
        rol,
        clave: clave || undefined,
      });
      avisarAlta(email, r.cuenta, Boolean(clave));
      reset({ email: "", rol, clave: "" });
      await cargar();
    } catch (e) {
      setError(mensajeDe(e));
    }
  });

  const cambiarRol = async (integrante: Integrante, rol: string) => {
    const { error } = await supabase
      .from("miembros_negocio")
      .update({ rol })
      .eq("negocio_id", negocioId)
      .eq("usuario_id", integrante.usuario_id);
    if (error) setError(mensajeDe(error));
    await cargar();
  };

  const quitar = async (integrante: Integrante) => {
    const seguro = await confirmar({
      titulo: "¿Quitar del equipo?",
      descripcion: `${integrante.email} ya no podrá entrar al panel de este negocio.`,
      textoConfirmar: "Quitar",
      peligro: true,
    });
    if (!seguro) return;
    const { error } = await supabase
      .from("miembros_negocio")
      .delete()
      .eq("negocio_id", negocioId)
      .eq("usuario_id", integrante.usuario_id);
    if (error) setError(mensajeDe(error));
    await cargar();
  };

  // El dueño gestiona administradores y cajeros; el superadmin, a todos.
  const puedeEditar = (i: Integrante) =>
    gestiona &&
    i.usuario_id !== usuarioId &&
    (esSuperadmin || i.rol !== "dueno");
  const rolesAsignables: RolEquipo[] = esSuperadmin
    ? ["dueno", "administrador", "cajero"]
    : ["administrador", "cajero"];

  return (
    <div className="flex flex-col gap-6">
      {gestiona ? (
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Agregar a alguien</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto]"
              onSubmit={invitar}
              noValidate
            >
              <Campo
                id="email"
                etiqueta="Correo"
                error={formState.errors.email?.message}
              >
                <Entrada
                  id="email"
                  type="email"
                  autoComplete="off"
                  placeholder="nombre@negocio.com"
                  {...register("email")}
                />
              </Campo>
              <Campo
                id="clave"
                etiqueta="Contraseña inicial"
                ayuda="Opcional. Sin contraseña le llega una invitación por correo."
                error={formState.errors.clave?.message}
              >
                <EntradaClave
                  id="clave"
                  autoComplete="new-password"
                  {...register("clave")}
                />
              </Campo>
              <Campo id="rol" etiqueta="Rol">
                <Selector id="rol" {...register("rol")}>
                  {rolesAsignables.map((r) => (
                    <option key={r} value={r}>
                      {nombresRol[r]}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Boton
                type="submit"
                className="sm:mt-6"
                cargando={formState.isSubmitting}
              >
                Agregar
              </Boton>
            </form>
            <p className="mt-3 text-etiqueta text-texto-3">
              Cajero: escanea y suma sellos. Administrador: además configura
              negocio, sedes y programa. Solo el dueño gestiona el equipo.
            </p>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}

      {error ? <Aviso tono="peligro">{error}</Aviso> : null}

      {equipo === null ? (
        <Tarjeta aria-busy>
          <Lista>
            {[0, 1].map((n) => (
              <FilaLista key={n}>
                <div className="flex flex-col gap-2">
                  <Esqueleto className="h-4 w-48" />
                  <Esqueleto className="h-3 w-32" />
                </div>
                <Esqueleto className="h-8 w-36" />
              </FilaLista>
            ))}
          </Lista>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <Lista>
            {equipo.map((i) => (
              <FilaLista key={i.usuario_id}>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium text-texto">
                    <span className="min-w-0 truncate" title={i.email}>
                      {i.email}
                    </span>
                    {i.invitacion_pendiente ? (
                      <Insignia>Invitación pendiente</Insignia>
                    ) : null}
                  </p>
                  <p className="text-xs text-texto-3 tabular-nums">
                    Último ingreso: {fechaHora(i.ultimo_ingreso_en)}
                  </p>
                </div>
                {puedeEditar(i) ? (
                  <div className="flex items-center gap-1">
                    <Selector
                      aria-label={`Rol de ${i.email}`}
                      className="w-36"
                      value={i.rol}
                      onChange={(e) => void cambiarRol(i, e.target.value)}
                    >
                      {rolesAsignables.map((r) => (
                        <option key={r} value={r}>
                          {nombresRol[r]}
                        </option>
                      ))}
                    </Selector>
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => void quitar(i)}
                    >
                      Quitar
                    </Boton>
                  </div>
                ) : (
                  <Insignia tono={i.rol === "dueno" ? "miel" : "neutro"}>
                    {nombresRol[i.rol]}
                  </Insignia>
                )}
              </FilaLista>
            ))}
          </Lista>
        </Tarjeta>
      )}
    </div>
  );
}
