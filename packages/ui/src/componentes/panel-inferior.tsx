import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { cn } from '../utilidades'

// Panel que sube desde abajo y se cierra arrastrando (Vaul). Para móvil: cámara, menú.
export function PanelInferior({
  abierto,
  onAbiertoCambia,
  titulo,
  descripcion,
  children,
  className,
}: {
  abierto: boolean
  onAbiertoCambia: (abierto: boolean) => void
  titulo: string
  descripcion?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Drawer.Root open={abierto} onOpenChange={onAbiertoCambia}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-capa bg-superficie pb-[max(1rem,env(safe-area-inset-bottom))] shadow-capa focus:outline-none',
            className,
          )}
        >
          <div className="mx-auto mt-2.5 mb-1 h-1 w-9 shrink-0 rounded-full bg-borde-fuerte" aria-hidden />
          <div className="px-4 pt-2 pb-3">
            <Drawer.Title className="text-seccion text-texto">{titulo}</Drawer.Title>
            {descripcion ? (
              <Drawer.Description className="text-etiqueta text-texto-3">{descripcion}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{titulo}</Drawer.Description>
            )}
          </div>
          <div className="min-h-0 overflow-y-auto px-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
