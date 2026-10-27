import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Une clases de Tailwind resolviendo conflictos (igual que `cn` de shadcn/ui).
export function cn(...clases: ClassValue[]): string {
  return twMerge(clsx(clases))
}
