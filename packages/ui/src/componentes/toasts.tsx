import { Toaster as ToasterSonner, toast } from 'sonner'

// Confirmaciones pasajeras ("guardado", "invitación enviada"). Sonner maneja la pila,
// las interrupciones y prefers-reduced-motion; aquí solo se le pone el tema de Beely.
// `margenInferiorMovil`: espacio extra si la app tiene barra inferior en móvil.
export function Toaster({ margenInferiorMovil = '0px' }: { margenInferiorMovil?: string }) {
  return (
    <ToasterSonner
      position="bottom-right"
      offset={16}
      mobileOffset={{ bottom: `calc(16px + ${margenInferiorMovil} + env(safe-area-inset-bottom))`, left: 16, right: 16 }}
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-2.5 rounded-capa bg-superficie px-4 py-3 text-sm text-texto shadow-capa sm:w-[22rem] [&_[data-icon]]:mt-0.5 [&_[data-icon]>svg]:size-4',
          title: 'font-medium',
          description: 'text-etiqueta text-texto-3',
          success: '[&_[data-icon]]:text-exito',
          error: '[&_[data-icon]]:text-peligro',
          actionButton: 'ml-auto rounded-control bg-hundido px-2 text-etiqueta font-medium',
        },
      }}
    />
  )
}

export { toast }
