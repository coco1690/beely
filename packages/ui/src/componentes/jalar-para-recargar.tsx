import { Spinner } from './spinner'
import { ArrowDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { esAppInstalada } from '../pwa'

// Distancia (px) que hay que jalar para recargar y tope del recorrido del indicador.
const UMBRAL = 72
const MAXIMO = 120

// Estilo Facebook: con la página arriba del todo, jalar hacia abajo baja un círculo que gira;
// al soltar pasado el umbral, recarga (y así también toma la versión nueva publicada).
// La app instalada no tiene el "jalar para recargar" del navegador: lo hacemos nosotros.
// `alRecargar`: en vez de recargar la página, vuelve a pedir los datos (el club refresca la tarjeta).
export function JalarParaRecargar({ alRecargar }: { alRecargar?: () => Promise<unknown> } = {}) {
  const [activo] = useState(esAppInstalada)
  const [recargando, setRecargando] = useState(false)
  const indicador = useRef<HTMLDivElement>(null)
  const flecha = useRef<HTMLDivElement>(null)
  const recargar = useRef(alRecargar)
  recargar.current = alRecargar

  useEffect(() => {
    if (!activo) return
    const raiz = document.documentElement
    // Sin el rebote de iOS arriba, el gesto es solo nuestro.
    raiz.style.overscrollBehaviorY = 'none'

    let inicioY: number | null = null
    let distancia = 0

    const pintar = (d: number, animar: boolean) => {
      const el = indicador.current
      if (!el) return
      const progreso = Math.min(d / UMBRAL, 1)
      el.style.transition = animar ? 'transform 220ms var(--ease-out), opacity 220ms var(--ease-out)' : 'none'
      el.style.transform = `translate(-50%, ${d - 48}px)`
      el.style.opacity = String(progreso)
      if (flecha.current) flecha.current.style.transform = `rotate(${d >= UMBRAL ? 180 : progreso * 180}deg)`
    }

    const alTocar = (e: TouchEvent) => {
      const objetivo = e.target as Element | null
      // No dentro de diálogos, paneles o menús abiertos, ni con la página bajada.
      if (window.scrollY > 0 || e.touches.length > 1 || objetivo?.closest('[role="dialog"],[role="menu"],[data-vaul-drawer]')) {
        inicioY = null
        return
      }
      inicioY = e.touches[0]?.clientY ?? null
      distancia = 0
    }

    const alMover = (e: TouchEvent) => {
      if (inicioY === null) return
      const dy = (e.touches[0]?.clientY ?? inicioY) - inicioY
      if (dy <= 0 || window.scrollY > 0) {
        if (distancia > 0) pintar(0, false)
        distancia = 0
        return
      }
      // Resistencia: cuesta más a medida que baja.
      distancia = Math.min(MAXIMO, dy * 0.5)
      e.preventDefault()
      pintar(distancia, false)
    }

    const alSoltar = () => {
      if (inicioY === null) return
      inicioY = null
      if (distancia >= UMBRAL) {
        setRecargando(true)
        pintar(UMBRAL, true)
        const propio = recargar.current
        if (propio) {
          // Al menos un instante de giro, aunque los datos lleguen enseguida.
          void Promise.allSettled([propio(), new Promise((r) => window.setTimeout(r, 450))]).then(() => {
            setRecargando(false)
            pintar(0, true)
          })
        } else {
          // Un instante para que se vea el giro antes de recargar.
          window.setTimeout(() => window.location.reload(), 350)
        }
      } else {
        pintar(0, true)
      }
      distancia = 0
    }

    window.addEventListener('touchstart', alTocar, { passive: true })
    window.addEventListener('touchmove', alMover, { passive: false })
    window.addEventListener('touchend', alSoltar)
    window.addEventListener('touchcancel', alSoltar)
    return () => {
      raiz.style.overscrollBehaviorY = ''
      window.removeEventListener('touchstart', alTocar)
      window.removeEventListener('touchmove', alMover)
      window.removeEventListener('touchend', alSoltar)
      window.removeEventListener('touchcancel', alSoltar)
    }
  }, [activo])

  if (!activo) return null
  return (
    <div
      ref={indicador}
      role="status"
      aria-label={recargando ? 'Recargando' : undefined}
      className="pointer-events-none fixed top-[env(safe-area-inset-top)] left-1/2 z-40 flex size-10 items-center justify-center rounded-full border border-borde bg-superficie text-acento-texto opacity-0 shadow-capa"
      style={{ transform: 'translate(-50%, -48px)' }}
    >
      {recargando ? (
        <Spinner className="size-5" />
      ) : (
        <div ref={flecha} className="transition-transform duration-150">
          <ArrowDown className="size-5" aria-hidden />
        </div>
      )}
    </div>
  )
}
