import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { GestionEquipo } from '../componentes/GestionEquipo'
import { useNegocioActivo } from '../stores/useNegocioStore'

export function PaginaEquipo() {
  const activo = useNegocioActivo()
  return (
    <>
      <EncabezadoPagina titulo="Equipo" descripcion="Quién entra al panel de este negocio y con qué rol." />
      {activo ? <GestionEquipo negocioId={activo.negocio.id} rolPanel={activo.rol} /> : null}
    </>
  )
}
