// Componentes de UI compartidos (estilo shadcn/ui sobre Tailwind v4) y tema de Beely.
// Los estilos del tema están en `@beely/ui/tema.css`.
export const temaBeely = {
  colorPrimario: '#F5B301',
  colorSecundario: '#1F1A17',
} as const

export type TemaBeely = typeof temaBeely

export { cn } from './utilidades'
export { Boton, variantesBoton, type PropsBoton } from './componentes/boton'
export { Campo, Entrada, Etiqueta, Selector } from './componentes/formulario'
export { Tarjeta, TarjetaContenido, TarjetaDescripcion, TarjetaEncabezado, TarjetaTitulo } from './componentes/tarjeta'
export { Aviso, Insignia } from './componentes/avisos'
