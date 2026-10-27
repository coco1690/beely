// Componentes de UI compartidos (estilo shadcn/ui sobre Tailwind v4) y tema de Beely.
// Los estilos y tokens del tema están en `@beely/ui/tema.css`.
export const temaBeely = {
  colorPrimario: '#F5B301',
  colorSecundario: '#1F1A17',
} as const

export type TemaBeely = typeof temaBeely

export { cn } from './utilidades'
export { Boton, variantesBoton, type PropsBoton } from './componentes/boton'
export { Spinner } from './componentes/spinner'
export { Campo, Entrada, EntradaClave, Etiqueta, Selector } from './componentes/formulario'
export { Tarjeta, TarjetaContenido, TarjetaDescripcion, TarjetaEncabezado, TarjetaTitulo } from './componentes/tarjeta'
export { Aviso, Insignia } from './componentes/avisos'
export { Esqueleto, EstadoVacio, FilaLista, Lista } from './componentes/estados'
export { Toaster, toast } from './componentes/toasts'
export { ProveedorConfirmar, useConfirmar } from './componentes/dialogos'
export {
  MenuContenido,
  MenuDisparador,
  MenuEtiqueta,
  MenuGrupoRadio,
  MenuItem,
  MenuItemRadio,
  MenuRaiz,
  MenuSeparador,
} from './componentes/menu'
export { PanelInferior } from './componentes/panel-inferior'
export { LogoBeely, Sello } from './componentes/marca'
