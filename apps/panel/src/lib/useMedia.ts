import { useSyncExternalStore } from 'react'

// true mientras la media query se cumpla (p. ej. '(max-width: 767px)').
export function useMedia(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const lista = window.matchMedia(consulta)
      lista.addEventListener('change', avisar)
      return () => lista.removeEventListener('change', avisar)
    },
    () => window.matchMedia(consulta).matches,
  )
}
