import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../utilidades'
import { useMedia } from '../useMedia'

// Loader de Beely: el logo se escribe a mano, se sostiene completo un instante,
// se desvanece y vuelve a empezar.
//
// - Cada trazo dura lo que mide (getTotalLength) a una velocidad de pluma constante,
//   así "eely" sale como una sola línea sin pausas en las uniones.
// - Entre el palo y el bucle de la B la pluma "viaja por el aire": esa pausa dura
//   lo que mide el salto entre el final de un trazo y el inicio del siguiente.
// - Solo se anima stroke-dashoffset y opacity (nada que dispare layout), con WAAPI.
// - Con movimiento reducido (o movimiento="reducido") el logo queda quieto y late en opacidad.

type Tamano = 'sm' | 'md' | 'lg'

export interface PropsBeelyLoader {
  /** sm: botones y en línea · md: secciones · lg: pantalla completa. */
  size?: Tamano
  /** Ocupa toda la pantalla con el fondo de la app. */
  fullscreen?: boolean
  /** Fuerza la variante de movimiento reducido (para comparar en la demo). */
  movimiento?: 'auto' | 'reducido'
  /** Milisegundos antes de mostrarse (0 = de inmediato, p. ej. en un botón). */
  retraso?: number
  className?: string
}

// Trazos del logo (docs/logo-beely.svg) en orden de escritura.
const TRAZOS = [
  'M376.83 360.4C335.37 435.41 307.34 509.18 273.53 571.21',
  'M212.05 398.54C184.58 362.86 331.04 257.48 447.67 268.89C590.19 281.78 465.4 428.45 406.57 437.43C483 432.18 584.79 531.67 451.25 605.98C315.54 679.78 173.71 643.99 188.35 573.29C203.89 500.72 312.15 481.43 416.21 534.94C457 556 485 568 525 565',
  'M525 565C577 572 668.5 543.5 693.34 505.25C727.42 454.27 650.38 431.12 603.31 485.07C557.71 535.31 561.7 593.4 618.28 613.98C676.29 634.11 726.85 578.08 759.3 563.04',
  'M759.3 563.04C792.75 548.59 835.73 544.12 864.91 506.82C906.04 454.25 822.28 432.68 779.09 482.49C738.15 528.78 733.79 589.64 792.97 613.29C854.57 636.94 920.1 566.89 956.56 523.7',
  'M956.56 523.7C993.72 483.81 1067.28 414.25 1073.65 321.29C1076.57 278.74 1027.58 287.65 998.66 323.67C950.31 383.94 930.73 504.38 952.82 570.59C975.64 653.96 1078.27 607.49 1101.58 476.35',
  'M1101.58 476.35C1091.55 542.09 1073.09 609.33 1130.76 593.84C1182.6 581.46 1218.4 508.23 1224.33 474.42C1220.88 535.41 1220.6 711.3 1126.25 745.11C1061.96 767.26 1038.17 686.5 1139.38 642.35C1231.17 603.84 1317.05 576.89 1337.44 485.15',
] as const

// El original va de 41 a 48 de grosor por letra; en las uniones B→e, e→l y l→y el
// salto (5–7 unidades) se ve como un escalón con el remate redondo encima. Se iguala
// al promedio para que la línea continua no cambie de grosor.
const GROSOR = 45

// Unidades del viewBox por milisegundo: ~1.4 s para escribir el logo completo.
const VELOCIDAD = 3.6
// Largo real medido de tinta (4923) más el salto de pluma entre palo y bucle (184).
const RECORRIDO_TOTAL = 5107
const ESCRITURA_MS = Math.round(RECORRIDO_TOTAL / VELOCIDAD)
// Logo completo en pantalla antes de desvanecerse, y respiro en blanco antes de reiniciar.
const PAUSA_MS = 450
const BLANCO_MS = 120

const TAMANOS: Record<Tamano, string> = {
  sm: 'h-4 w-9',
  md: 'h-11 w-24',
  lg: 'h-22 w-48',
}

// Lee un token de tema.css (p. ej. --ease-out) para no duplicar sus valores aquí.
function token(el: Element, nombre: string): string {
  return getComputedStyle(el).getPropertyValue(nombre).trim()
}

export function BeelyLoader({ size, fullscreen = false, movimiento = 'auto', retraso = 300, className }: PropsBeelyLoader) {
  const prefiereReducido = useMedia('(prefers-reduced-motion: reduce)')
  const reducido = movimiento === 'reducido' || prefiereReducido
  const idDegradado = `beely-loader-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const refSvg = useRef<SVGSVGElement>(null)
  const refTrazos = useRef<(SVGPathElement | null)[]>([])
  const [listo, setListo] = useState(retraso <= 0)

  useEffect(() => {
    if (retraso <= 0) return
    const t = window.setTimeout(() => setListo(true), retraso)
    return () => window.clearTimeout(t)
  }, [retraso])

  // Layout effect: las animaciones quedan creadas antes del primer pintado.
  useLayoutEffect(() => {
    const svg = refSvg.current
    const trazos = refTrazos.current.filter((t): t is SVGPathElement => t !== null)
    if (!listo || reducido || !svg || trazos.length !== TRAZOS.length) return

    // Inicio y duración de cada trazo según su largo real, con la pluma a velocidad constante.
    let reloj = 0
    let anterior: DOMPoint | null = null
    const tramos = trazos.map((trazo) => {
      const largo = trazo.getTotalLength()
      const inicio = trazo.getPointAtLength(0)
      if (anterior) reloj += Math.hypot(inicio.x - anterior.x, inicio.y - anterior.y) / VELOCIDAD
      const tramo = { desde: reloj, dura: largo / VELOCIDAD }
      reloj += tramo.dura
      anterior = trazo.getPointAtLength(largo)
      return tramo
    })

    const curvaSalida = token(svg, '--ease-out') || 'ease-out'
    const salidaMs = Number.parseFloat(token(svg, '--duracion-lenta')) || 240
    const finEscritura = reloj
    const inicioSalida = finEscritura + PAUSA_MS
    const ciclo = inicioSalida + salidaMs + BLANCO_MS
    const opciones: KeyframeAnimationOptions = { duration: ciclo, iterations: Infinity }

    const animaciones = trazos.map((trazo, i) => {
      const { desde, dura } = tramos[i] ?? { desde: 0, dura: 0 }
      const a = desde / ciclo
      const b = (desde + dura) / ciclo
      // Oculto (opacity 0) hasta que la pluma llega: evita el punto del remate redondo
      // que algunos navegadores pintan con un guion de largo cero.
      return trazo.animate(
        [
          { offset: 0, strokeDashoffset: '1', opacity: 0 },
          { offset: a, strokeDashoffset: '1', opacity: 0 },
          { offset: a, strokeDashoffset: '1', opacity: 1, easing: 'linear' },
          { offset: b, strokeDashoffset: '0', opacity: 1 },
          { offset: 1, strokeDashoffset: '0', opacity: 1 },
        ],
        opciones,
      )
    })

    // El desvanecido va en el <svg> (no en un <g>) para que el compositor lo pueda llevar.
    animaciones.push(
      svg.animate(
        [
          { offset: 0, opacity: 1 },
          { offset: inicioSalida / ciclo, opacity: 1, easing: curvaSalida },
          { offset: (inicioSalida + salidaMs) / ciclo, opacity: 0 },
          { offset: 1, opacity: 0 },
        ],
        opciones,
      ),
    )

    // Todas arrancan en el mismo instante para que no se desfasen entre ciclos.
    const ahora = document.timeline.currentTime
    if (ahora !== null) for (const animacion of animaciones) animacion.startTime = ahora

    return () => {
      for (const animacion of animaciones) animacion.cancel()
    }
  }, [listo, reducido])

  if (!listo) return null

  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn(
        // A pantalla completa el fondo tapa el contenido: entra con un fundido corto, no de golpe.
        fullscreen
          ? 'fixed inset-0 z-50 grid place-items-center bg-fondo animate-[desvanecer_var(--duracion-media)_var(--ease-out)_both]'
          : 'inline-grid place-items-center',
        className,
      )}
    >
      <svg
        ref={refSvg}
        viewBox="150 230 1224 556"
        fill="none"
        aria-hidden
        className={cn(
          TAMANOS[size ?? (fullscreen ? 'lg' : 'md')],
          reducido && 'animate-[latir-loader_1800ms_var(--ease-in-out)_infinite]',
        )}
      >
        <defs>
          <linearGradient id={idDegradado} gradientUnits="userSpaceOnUse" x1="160" y1="0" x2="1360" y2="0">
            <stop offset="0" stopColor="#F77369" />
            <stop offset="0.5" stopColor="#F1687E" />
            <stop offset="1" stopColor="#ED5687" />
          </linearGradient>
        </defs>
        <g stroke={`url(#${idDegradado})`} strokeWidth={GROSOR} strokeLinecap="round" strokeLinejoin="round">
          {TRAZOS.map((d, i) => (
            <path
              key={d}
              ref={(el) => {
                refTrazos.current[i] = el
              }}
              d={d}
              pathLength={1}
              strokeDasharray={reducido ? undefined : 1}
              strokeDashoffset={reducido ? undefined : 1}
              opacity={reducido ? undefined : 0}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}

// Lo mínimo que se queda visible: una escritura completa del logo y un respiro para verlo entero.
const MINIMO_VISIBLE_MS = ESCRITURA_MS + 150

/**
 * Dice cuándo mostrar <BeelyLoader /> sin parpadeos: true mientras se carga (el loader mismo
 * espera `retraso` antes de verse) y, si alcanzó a verse, hasta cumplir `minimo` para que la
 * escritura no se corte a la mitad.
 *   if (useCargaSinParpadeo(cargando)) return <BeelyLoader fullscreen />
 */
export function useCargaSinParpadeo(
  cargando: boolean,
  { retraso = 300, minimo = MINIMO_VISIBLE_MS }: { retraso?: number; minimo?: number } = {},
): boolean {
  const [visible, setVisible] = useState(false)
  const visibleDesde = useRef(0)

  useEffect(() => {
    if (cargando && !visible) {
      const t = window.setTimeout(() => {
        visibleDesde.current = performance.now()
        setVisible(true)
      }, retraso)
      return () => window.clearTimeout(t)
    }
    if (!cargando && visible) {
      const resta = Math.max(0, minimo - (performance.now() - visibleDesde.current))
      const t = window.setTimeout(() => setVisible(false), resta)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [cargando, visible, retraso, minimo])

  return cargando || visible
}
