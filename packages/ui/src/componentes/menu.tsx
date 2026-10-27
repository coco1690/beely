import * as Menu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../utilidades'

// Menú desplegable. Crece desde el punto donde se abrió (transform-origin de Radix).
export const MenuRaiz = Menu.Root
export const MenuDisparador = Menu.Trigger
export const MenuGrupoRadio = Menu.RadioGroup

export function MenuContenido({ className, sideOffset = 6, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-(--radix-dropdown-menu-trigger-width) origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto rounded-control bg-superficie p-1 shadow-capa focus:outline-none data-[state=closed]:animate-[salir-capa_100ms_ease-out_both] data-[state=open]:animate-[entrar-capa_160ms_var(--ease-out)_both]',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  )
}

const claseItem =
  'relative flex cursor-default items-center gap-2 rounded-[calc(var(--radius-control)-2px)] px-2 py-1.5 text-sm text-texto outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-hundido pointer-coarse:py-2.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-texto-3'

export function MenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={cn(claseItem, className)} {...props} />
}

export function MenuItemRadio({ className, children, ...props }: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(claseItem, 'pr-8', className)} {...props}>
      {children}
      <Menu.ItemIndicator className="absolute right-2 flex">
        <Check className="text-texto!" />
      </Menu.ItemIndicator>
    </Menu.RadioItem>
  )
}

export function MenuEtiqueta({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2 pt-1.5 pb-1 text-xs font-medium text-texto-3', className)} {...props} />
}

export function MenuSeparador({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-borde', className)} {...props} />
}
