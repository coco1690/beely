import { EstadoVacio, Tarjeta } from "@beely/ui";
import { Store } from "lucide-react";

export function SinNegocio() {
  return (
    <Tarjeta>
      <EstadoVacio
        icono={<Store />}
        titulo="Tu cuenta aún no tiene negocio"
        descripcion="Pide al dueño de tu negocio que te invite desde la sección Equipo."
      />
    </Tarjeta>
  );
}
