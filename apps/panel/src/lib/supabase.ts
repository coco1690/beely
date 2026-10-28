import { crearClienteBeely } from "@beely/tipos/supabase";

// Enlace de invitación o de recuperar clave: si Supabase lo devolvió a otra ruta (por ejemplo
// a la raíz, cuando el redirectTo no está en la lista de URLs permitidas), se lleva a
// /definir-clave antes de crear el cliente, que lee la sesión del hash y luego lo borra.
const tipoEnlace = new URLSearchParams(window.location.hash.slice(1)).get(
  "type",
);
if (
  (tipoEnlace === "invite" || tipoEnlace === "recovery") &&
  window.location.pathname !== "/definir-clave"
) {
  window.history.replaceState(
    null,
    "",
    `/definir-clave${window.location.hash}`,
  );
}

export const supabase = crearClienteBeely(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
