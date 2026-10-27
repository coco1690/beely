import { cn, LogoBeely } from '@beely/ui'

// Logo del negocio sobre un recuadro blanco; sin logo, la marca de Beely.
export function MarcaNegocio({ logoUrl, nombre, className }: { logoUrl: string | null; nombre: string; className?: string }) {
  if (!logoUrl) return <LogoBeely className={cn('size-8', className)} />
  return <img src={logoUrl} alt={nombre} className={cn('size-8 rounded-control bg-white object-contain p-0.5 ring-1 ring-borde', className)} />
}
