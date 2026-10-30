import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "../lib/supabase";

type EstadoSesion = {
  sesion: Session | null;
  esSuperadmin: boolean;
  cargando: boolean;
  // Escucha los cambios de Auth; devuelve la función para dejar de escuchar.
  iniciar: () => () => void;
  salir: () => Promise<void>;
};

async function consultarSuperadmin(usuarioId: string): Promise<boolean> {
  // RLS: la fila solo es visible para un superadmin.
  const { data, error } = await supabase
    .from("superadmins")
    .select("usuario_id")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  // Sin red no se sabe: mejor reintentar que tratar al superadmin como equipo.
  if (error) throw error;
  return data !== null;
}

// Cada cuánto se reintenta saber si es superadmin cuando no hubo red.
const REINTENTO_MS = 3000;

export const useSesionStore = create<EstadoSesion>()((set, get) => {
  const verificarSuperadmin = (usuarioId: string) => {
    consultarSuperadmin(usuarioId).then(
      (esSuperadmin) => set({ esSuperadmin, cargando: false }),
      () =>
        setTimeout(() => {
          if (get().sesion?.user.id === usuarioId)
            verificarSuperadmin(usuarioId);
        }, REINTENTO_MS),
    );
  };

  return {
    sesion: null,
    esSuperadmin: false,
    cargando: true,

    iniciar: () => {
      const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
        const anterior = get().sesion?.user.id;
        set({ sesion });
        if (!sesion) {
          set({ esSuperadmin: false, cargando: false });
          return;
        }
        if (anterior === sesion.user.id && !get().cargando) return;
        // Fuera del callback de Auth para no bloquearlo (recomendación de supabase-js).
        setTimeout(() => verificarSuperadmin(sesion.user.id), 0);
      });
      return () => data.subscription.unsubscribe();
    },

    salir: async () => {
      await supabase.auth.signOut();
    },
  };
});
