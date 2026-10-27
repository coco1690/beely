import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge debe conocer los tokens propios de tema.css; si no, confunde
// `text-etiqueta` (tamaño) con un color y borra `text-texto-3` al combinarlas.
const unirClases = extendTailwindMerge({
  extend: {
    theme: {
      text: ['titulo', 'seccion', 'etiqueta'],
      radius: ['control', 'tarjeta', 'capa'],
      shadow: ['tarjeta', 'capa', 'boton'],
    },
  },
})

// Une clases de Tailwind resolviendo conflictos (igual que `cn` de shadcn/ui).
export function cn(...clases: ClassValue[]): string {
  return unirClases(clsx(clases))
}
