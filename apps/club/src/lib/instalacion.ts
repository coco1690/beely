import { esAppInstalada } from '@beely/ui'
import { useSyncExternalStore } from 'react'

// "Agregar a la pantalla de inicio". Android/Chrome avisa con beforeinstallprompt y
// deja abrir su diálogo; iOS no: allí se muestran los pasos (Compartir → Agregar a inicio).
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let pendiente: EventoInstalar | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((o) => o())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  pendiente = e as EventoInstalar
  avisar()
})
window.addEventListener('appinstalled', () => {
  pendiente = null
  avisar()
})

export const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export type FormaInstalar = 'instalada' | 'dialogo' | 'ios' | 'no_disponible'

function forma(): FormaInstalar {
  if (esAppInstalada()) return 'instalada'
  if (pendiente) return 'dialogo'
  if (esIos) return 'ios'
  return 'no_disponible'
}

export function useInstalacion(): { forma: FormaInstalar; instalar: () => Promise<void> } {
  const actual = useSyncExternalStore((o) => {
    oyentes.add(o)
    return () => oyentes.delete(o)
  }, forma)
  return {
    forma: actual,
    instalar: async () => {
      if (!pendiente) return
      await pendiente.prompt()
      await pendiente.userChoice
      pendiente = null
      avisar()
    },
  }
}
