import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Boton } from './boton'

type OpcionesConfirmar = {
  titulo: string
  descripcion?: ReactNode
  textoConfirmar?: string
  textoCancelar?: string
  peligro?: boolean
}

type Confirmar = (opciones: OpcionesConfirmar) => Promise<boolean>

const Contexto = createContext<Confirmar | null>(null)

// Diálogo de confirmación en lugar de window.confirm:
//   const confirmar = useConfirmar()
//   if (!(await confirmar({ titulo: '¿Quitar a Ana?', peligro: true }))) return
export function ProveedorConfirmar({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null)
  const resolver = useRef<(valor: boolean) => void>(undefined)

  const confirmar = useCallback<Confirmar>((nuevas) => {
    setOpciones(nuevas)
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const cerrar = (valor: boolean) => {
    resolver.current?.(valor)
    resolver.current = undefined
    setOpciones(null)
  }

  return (
    <Contexto value={confirmar}>
      {children}
      <AlertDialog.Root open={opciones !== null} onOpenChange={(abierto) => !abierto && cerrar(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-[desvanecer_120ms_ease-out_both_reverse] data-[state=open]:animate-[desvanecer_180ms_ease-out_both]" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-capa bg-superficie p-5 shadow-capa focus:outline-none data-[state=closed]:animate-[salir-capa_120ms_ease-out_both] data-[state=open]:animate-[entrar-capa_180ms_var(--ease-out)_both]">
            <div className="flex flex-col gap-1.5">
              <AlertDialog.Title className="text-seccion text-texto">{opciones?.titulo}</AlertDialog.Title>
              {opciones?.descripcion ? (
                <AlertDialog.Description className="text-sm text-texto-3">{opciones.descripcion}</AlertDialog.Description>
              ) : (
                <AlertDialog.Description className="sr-only">{opciones?.titulo}</AlertDialog.Description>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel asChild>
                <Boton variante="contorno">{opciones?.textoCancelar ?? 'Cancelar'}</Boton>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Boton variante={opciones?.peligro ? 'peligro' : 'primario'} onClick={() => cerrar(true)}>
                  {opciones?.textoConfirmar ?? 'Confirmar'}
                </Boton>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Contexto>
  )
}

export function useConfirmar(): Confirmar {
  const confirmar = useContext(Contexto)
  if (!confirmar) throw new Error('useConfirmar necesita <ProveedorConfirmar>')
  return confirmar
}

// Diálogo con contenido propio (formularios cortos). Para preguntar sí/no, usar useConfirmar.
export function Dialogo({
  abierto,
  onAbiertoCambia,
  titulo,
  descripcion,
  children,
}: {
  abierto: boolean
  onAbiertoCambia: (abierto: boolean) => void
  titulo: string
  descripcion?: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog.Root open={abierto} onOpenChange={onAbiertoCambia}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-[desvanecer_120ms_ease-out_both_reverse] data-[state=open]:animate-[desvanecer_180ms_ease-out_both]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-capa bg-superficie p-5 shadow-capa focus:outline-none data-[state=closed]:animate-[salir-capa_120ms_ease-out_both] data-[state=open]:animate-[entrar-capa_180ms_var(--ease-out)_both]">
          <div className="flex flex-col gap-1.5">
            <Dialog.Title className="text-seccion text-texto">{titulo}</Dialog.Title>
            {descripcion ? (
              <Dialog.Description className="text-sm text-texto-3">{descripcion}</Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
            )}
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
