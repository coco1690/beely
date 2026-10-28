import { zodResolver } from "@hookform/resolvers/zod";
import {
  esquemaCambiarClave,
  esquemaNuevaClave,
  mensajeDeError,
  nombresRol,
} from "@beely/tipos";
import {
  Aviso,
  Boton,
  Campo,
  EntradaClave,
  FilaLista,
  Insignia,
  Lista,
  LogoNegocio,
  Tarjeta,
  TarjetaContenido,
  TarjetaDescripcion,
  TarjetaEncabezado,
  TarjetaTitulo,
  toast,
} from "@beely/ui";
import type { Session } from "@supabase/supabase-js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { EncabezadoPagina } from "../componentes/DisenoPanel";
import { supabase } from "../lib/supabase";
import { useNegocioStore } from "../stores/useNegocioStore";
import { useSesionStore } from "../stores/useSesionStore";

// ¿La cuenta ya tiene clave? Sí si se guardó desde el panel (marca en los metadatos) o si
// esta sesión se abrió con clave (método `password` en el `amr` del JWT). Quien entró
// por un enlace de invitación y nunca la definió no tiene clave que confirmar.
function tieneClave(sesion: Session): boolean {
  if (sesion.user.user_metadata.clave_definida === true) return true;
  try {
    const carga = sesion.access_token.split(".")[1] ?? "";
    const json = atob(carga.replace(/-/g, "+").replace(/_/g, "/"));
    const { amr } = JSON.parse(json) as { amr?: { method: string }[] };
    return amr?.some((m) => m.method === "password") ?? false;
  } catch {
    return false;
  }
}

export function PaginaPerfil() {
  const sesion = useSesionStore((e) => e.sesion);
  const membresias = useNegocioStore((e) => e.membresias).filter(
    (m) => m.rol !== "superadmin",
  );
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin);
  if (!sesion) return null;

  return (
    <>
      <EncabezadoPagina
        titulo="Perfil"
        descripcion="Tu cuenta en Beely y la contraseña con la que ingresas."
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Cuenta</TarjetaTitulo>
            <TarjetaDescripcion>{sesion.user.email}</TarjetaDescripcion>
          </TarjetaEncabezado>
          {membresias.length > 0 || esSuperadmin ? (
            <Lista>
              {esSuperadmin ? (
                <FilaLista className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-texto">
                    Plataforma Beely
                  </span>
                  <Insignia tono="miel">{nombresRol.superadmin}</Insignia>
                </FilaLista>
              ) : null}
              {membresias.map((m) => (
                <FilaLista
                  key={m.negocio.id}
                  className="flex items-center gap-3"
                >
                  <LogoNegocio
                    url={m.negocio.logo_url}
                    nombre={m.negocio.nombre}
                    className="size-7"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-texto">
                    {m.negocio.nombre}
                  </span>
                  <Insignia tono={m.rol === "dueno" ? "miel" : "neutro"}>
                    {nombresRol[m.rol]}
                  </Insignia>
                </FilaLista>
              ))}
            </Lista>
          ) : null}
        </Tarjeta>

        {/* key: al guardar una clave nueva se pasa de "definir" a "cambiar" con el formulario limpio. */}
        <TarjetaClave
          key={String(tieneClave(sesion))}
          sesion={sesion}
          conClave={tieneClave(sesion)}
        />
      </div>
    </>
  );
}

function TarjetaClave({
  sesion,
  conClave,
}: {
  sesion: Session;
  conClave: boolean;
}) {
  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>
          {conClave ? "Cambiar contraseña" : "Define tu contraseña"}
        </TarjetaTitulo>
        <TarjetaDescripcion>
          {conClave
            ? "Confirma la actual y escribe la nueva."
            : "Entraste con un enlace y tu cuenta aún no tiene contraseña. Defínela para volver a ingresar con tu correo."}
        </TarjetaDescripcion>
      </TarjetaEncabezado>
      <TarjetaContenido>
        {conClave ? (
          <FormularioCambiar email={sesion.user.email ?? ""} />
        ) : (
          <FormularioDefinir email={sesion.user.email ?? ""} />
        )}
      </TarjetaContenido>
    </Tarjeta>
  );
}

// Guarda la clave y deja la marca que usa `tieneClave`.
async function guardarClave(clave: string): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({
    password: clave,
    data: { clave_definida: true },
  });
  if (error) return false;
  toast.success("Contraseña guardada", {
    description: "Úsala la próxima vez que ingreses.",
  });
  return true;
}

function FormularioDefinir({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaNuevaClave),
    defaultValues: { clave: "", confirmacion: "" },
  });

  const guardar = handleSubmit(async ({ clave }) => {
    setError(null);
    if (!(await guardarClave(clave)))
      setError("No pudimos guardar la contraseña. Intenta de nuevo.");
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
      {/* Correo oculto para que el gestor de contraseñas sepa de qué cuenta es. */}
      <input
        type="email"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <Campo
        id="clave-nueva"
        etiqueta="Contraseña"
        error={formState.errors.clave?.message}
        ayuda="Mínimo 8 caracteres."
      >
        <EntradaClave
          id="clave-nueva"
          autoComplete="new-password"
          {...register("clave")}
        />
      </Campo>
      <Campo
        id="clave-confirmacion"
        etiqueta="Repite la contraseña"
        error={formState.errors.confirmacion?.message}
      >
        <EntradaClave
          id="clave-confirmacion"
          autoComplete="new-password"
          {...register("confirmacion")}
        />
      </Campo>
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      <div className="flex justify-end">
        <Boton type="submit" cargando={formState.isSubmitting}>
          Guardar contraseña
        </Boton>
      </div>
    </form>
  );
}

function FormularioCambiar({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaCambiarClave),
    defaultValues: { actual: "", clave: "", confirmacion: "" },
  });

  const guardar = handleSubmit(async ({ actual, clave }) => {
    setError(null);
    // Se confirma la clave actual volviendo a ingresar antes de guardar la nueva.
    const { error: errorActual } = await supabase.auth.signInWithPassword({
      email,
      password: actual,
    });
    if (errorActual) {
      setError(mensajeDeError("clave_actual_incorrecta"));
      return;
    }
    if (await guardarClave(clave)) reset();
    else setError("No pudimos guardar la contraseña nueva. Intenta de nuevo.");
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
      <input
        type="email"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <Campo
        id="clave-actual"
        etiqueta="Contraseña actual"
        error={formState.errors.actual?.message}
      >
        <EntradaClave
          id="clave-actual"
          autoComplete="current-password"
          {...register("actual")}
        />
      </Campo>
      <Campo
        id="clave-nueva"
        etiqueta="Contraseña nueva"
        error={formState.errors.clave?.message}
        ayuda="Mínimo 8 caracteres."
      >
        <EntradaClave
          id="clave-nueva"
          autoComplete="new-password"
          {...register("clave")}
        />
      </Campo>
      <Campo
        id="clave-confirmacion"
        etiqueta="Repite la contraseña nueva"
        error={formState.errors.confirmacion?.message}
      >
        <EntradaClave
          id="clave-confirmacion"
          autoComplete="new-password"
          {...register("confirmacion")}
        />
      </Campo>
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      <div className="flex justify-end">
        <Boton type="submit" cargando={formState.isSubmitting}>
          Guardar contraseña
        </Boton>
      </div>
    </form>
  );
}
