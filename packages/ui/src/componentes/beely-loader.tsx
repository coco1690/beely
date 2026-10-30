import { useEffect, useId, useRef, useState } from 'react'
import { useMedia } from '../useMedia'
import { cn } from '../utilidades'

// Loader de Beely: el logo se escribe a mano (palo de la B, bucle de la B y "eely" de
// corrido), se sostiene, se desvanece y vuelve a empezar. Fuente: docs/logo-beely.svg.
//
// Cada trazo es una línea central con pathLength=1: se dibuja moviendo stroke-dashoffset
// de 1 a 0. El tiempo de cada trazo sale de su longitud real (getTotalLength()), así la
// pluma va a velocidad constante y las uniones de "eely" se leen como una sola línea.
// Solo se animan stroke-dashoffset (pintura) y opacity/transform del <svg> (compositor).

// Longitudes medidas con getTotalLength() sobre docs/logo-beely.svg. Al montar se vuelven a
// medir; estas sirven para el primer cuadro y como respaldo.
const TRAZOS = [
  { id: 'B-stem', largo: 234.8, d: 'M376.83 360.4C335.37 435.41 307.34 509.18 273.53 571.21' },
  {
    id: 'B-loop',
    largo: 1506.2,
    d: 'M212.05 398.54C184.58 362.86 331.04 257.48 447.67 268.89C590.19 281.78 465.4 428.45 406.57 437.43C483 432.18 584.79 531.67 451.25 605.98C315.54 679.78 173.71 643.99 188.35 573.29C203.89 500.72 312.15 481.43 416.21 534.94C457 556 485 568 525 565',
  },
  {
    id: 'e-1',
    largo: 647.1,
    d: 'M525 565C577 572 668.5 543.5 693.34 505.25C727.42 454.27 650.38 431.12 603.31 485.07C557.71 535.31 561.7 593.4 618.28 613.98C676.29 634.11 726.85 578.08 759.3 563.04',
  },
  {
    id: 'e-2',
    largo: 626.0,
    d: 'M759.3 563.04C792.75 548.59 835.73 544.12 864.91 506.82C906.04 454.25 822.28 432.68 779.09 482.49C738.15 528.78 733.79 589.64 792.97 613.29C854.57 636.94 920.1 566.89 956.56 523.7',
  },
  {
    id: 'l',
    largo: 851.9,
    d: 'M956.56 523.7C993.72 483.81 1067.28 414.25 1073.65 321.29C1076.57 278.74 1027.58 287.65 998.66 323.67C950.31 383.94 930.73 504.38 952.82 570.59C975.64 653.96 1078.27 607.49 1101.58 476.35',
  },
  {
    id: 'y',
    largo: 1057.3,
    d: 'M1101.58 476.35C1091.55 542.09 1073.09 609.33 1130.76 593.84C1182.6 581.46 1218.4 508.23 1224.33 474.42C1220.88 535.41 1220.6 711.3 1126.25 745.11C1061.96 767.26 1038.17 686.5 1139.38 642.35C1231.17 603.84 1317.05 576.89 1337.44 485.15',
  },
] as const

// El SVG original va de 41 a 48 de grosor según el trazo y el salto se nota en las uniones
// (sobre todo B→e y e→l). Un solo grosor, el promedio, las deja limpias.
const GROSOR = 45
// Recorte del lienzo de 1536×1024 a la palabra más medio grosor de margen.
const CAJA = '160 240 1204 536'

// Ritmo del ciclo (ms). La escritura incluye el levantar la pluma entre el palo y el bucle de la B.
export const ESCRITURA_MS = 1400
const LEVANTAR_MS = 90
const PAUSA_MS = 450
const DESVANECER_MS = 320
const VACIO_MS = 140
const CICLO_MS = ESCRITURA_MS + PAUSA_MS + DESVANECER_MS + VACIO_MS

// Retraso antes de mostrarse: las cargas más cortas no muestran nada.
export const RETRASO_MS = 300

// La pluma arranca y llega un poco más lenta (±15 %), sin perder la velocidad casi constante.
const pluma = (t: number) => 0.8 * t + 0.1 * (1 - Math.cos(Math.PI * t))
// Inversa de `pluma` por bisección: en qué momento de la escritura se llega a cierto avance.
function momento(avance: number) {
  let a = 0
  let b = 1
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2
    if (pluma(m) < avance) a = m
    else b = m
  }
  return (a + b) / 2
}

// Fuera del trazo: el guion queda entero antes del inicio del camino, sin punto de remate.
const OCULTO = 1.001
const MUESTRAS = 90

// Cuadros clave de cada trazo y del <svg>, todos con la misma duración para que no se desfasen.
function cuadrosClave(largos: readonly number[]) {
  const levantar = LEVANTAR_MS / ESCRITURA_MS
  const tinta = largos.reduce((s, l) => s + l, 0)
  // Tramos en "avance de pluma" (0-1): el levantar entre el trazo 1 y el 2 cuenta como distancia.
  const total = tinta / (1 - levantar)
  let cursor = 0
  const tramos = largos.map((largo, i) => {
    if (i === 1) cursor += levantar * total
    const inicio = cursor / total
    cursor += largo
    return { inicio, fin: cursor / total }
  })

  const enCiclo = ESCRITURA_MS / CICLO_MS
  const trazos = tramos.map(({ inicio, fin }) => {
    const t0 = momento(inicio)
    const t1 = momento(fin)
    const cuadros: Keyframe[] = [{ offset: 0, strokeDashoffset: OCULTO }]
    if (t0 > 0) cuadros.push({ offset: t0 * enCiclo, strokeDashoffset: OCULTO })
    for (let k = 1; k < MUESTRAS; k++) {
      const t = k / MUESTRAS
      if (t <= t0 || t >= t1) continue
      const f = (pluma(t) - inicio) / (fin - inicio)
      cuadros.push({ offset: t * enCiclo, strokeDashoffset: 1 - f })
    }
    cuadros.push({ offset: t1 * enCiclo, strokeDashoffset: 0 }, { offset: 1, strokeDashoffset: 0 })
    return cuadros
  })

  const salir = (ESCRITURA_MS + PAUSA_MS) / CICLO_MS
  const vacio = (ESCRITURA_MS + PAUSA_MS + DESVANECER_MS) / CICLO_MS
  const lienzo: Keyframe[] = [
    { offset: 0, opacity: 1, transform: 'scale(1)' },
    { offset: salir, opacity: 1, transform: 'scale(1)', easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    { offset: vacio, opacity: 0, transform: 'scale(0.97)' },
    { offset: 1, opacity: 0, transform: 'scale(0.97)' },
  ]
  return { trazos, lienzo }
}

const TAMANOS = {
  sm: 'w-12', // botones e inline (48 px)
  md: 'w-28', // secciones (112 px)
  lg: 'w-52', // pantalla completa (208 px)
} as const

export type PropsBeelyLoader = {
  size?: keyof typeof TAMANOS
  // Cubre la pantalla con el fondo de la app y centra el loader.
  fullscreen?: boolean
  // 'reducido' fuerza la versión sin trazado (para vistas de prueba); 'auto' sigue al sistema.
  movimiento?: 'auto' | 'reducido'
  // Cuánto esperar antes de aparecer. 0 para mostrarlo de una vez (p. ej. en un botón).
  retraso?: number
  etiqueta?: string
  className?: string
}

export function BeelyLoader({
  size = 'md',
  fullscreen = false,
  movimiento = 'auto',
  retraso = RETRASO_MS,
  etiqueta = 'Cargando',
  className,
}: PropsBeelyLoader) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const prefiereReducido = useMedia('(prefers-reduced-motion: reduce)')
  const reducido = movimiento === 'reducido' || prefiereReducido
  const [visible, setVisible] = useState(retraso <= 0)

  useEffect(() => {
    if (retraso <= 0) return
    const t = window.setTimeout(() => setVisible(true), retraso)
    return () => window.clearTimeout(t)
  }, [retraso])

  // La animación arranca cuando el loader se ve: siempre empieza por el palo de la B.
  useEffect(() => {
    const lienzo = svg.current
    if (!visible || reducido || !lienzo || typeof lienzo.animate !== 'function') return
    const caminos = [...lienzo.querySelectorAll('path')]
    const largos = caminos.map((c, i) => c.getTotalLength() || TRAZOS[i]!.largo)
    const { trazos, lienzo: cuadrosLienzo } = cuadrosClave(largos)
    const opciones = { duration: CICLO_MS, iterations: Infinity, easing: 'linear' }
    const animaciones = [lienzo.animate(cuadrosLienzo, opciones), ...caminos.map((c, i) => c.animate(trazos[i]!, opciones))]
    return () => animaciones.forEach((a) => a.cancel())
  }, [visible, reducido])

  const degradado = `${id}-degradado`
  const loader = (
    <div
      role="status"
      aria-label={etiqueta}
      className={cn('inline-flex shrink-0', TAMANOS[size], !fullscreen && className)}
    >
      <svg
        ref={svg}
        viewBox={CAJA}
        aria-hidden
        className={cn(
          'block h-auto w-full',
          !visible && 'invisible',
          visible && reducido && 'animate-[latir-loader_1.8s_ease-in-out_infinite]',
        )}
      >
        <defs>
          {/* En coordenadas del dibujo: el color corre a lo largo de la palabra, no se reinicia en cada trazo. */}
          <linearGradient id={degradado} gradientUnits="userSpaceOnUse" x1="160" y1="0" x2="1360" y2="0">
            <stop offset="0" stopColor="#F77369" />
            <stop offset="0.5" stopColor="#F1687E" />
            <stop offset="1" stopColor="#ED5687" />
          </linearGradient>
        </defs>
        <g fill="none" stroke={`url(#${degradado})`} strokeWidth={GROSOR} strokeLinecap="round" strokeLinejoin="round">
          {TRAZOS.map((t) => (
            <path
              key={t.id}
              d={t.d}
              pathLength={1}
              strokeDasharray={reducido ? undefined : '1 2'}
              strokeDashoffset={reducido ? undefined : OCULTO}
            />
          ))}
        </g>
      </svg>
    </div>
  )

  if (!fullscreen) return loader
  return <div className={cn('fixed inset-0 z-50 grid place-items-center bg-fondo pb-[8vh]', className)}>{loader}</div>
}

// Decide si mostrar la carga sin parpadeos: el loader aparece tras RETRASO_MS y, una vez a la
// vista, se queda hasta terminar de escribir el logo aunque los datos lleguen antes.
//   const mostrarCarga = useCargaSinParpadeo(cargando)
//   if (mostrarCarga) return <BeelyLoader fullscreen size="lg" />
export function useCargaSinParpadeo(cargando: boolean, { retraso = RETRASO_MS, minimo = ESCRITURA_MS } = {}) {
  // oculto: aún no se ve · minimo: visible sin cumplir el mínimo · libre: ya puede irse.
  const [fase, setFase] = useState<'oculto' | 'minimo' | 'libre'>('oculto')

  useEffect(() => {
    if (cargando && fase === 'oculto') {
      const t = window.setTimeout(() => setFase('minimo'), retraso)
      return () => window.clearTimeout(t)
    }
    if (!cargando && fase === 'libre') setFase('oculto')
  }, [cargando, fase, retraso])

  // Aparte, para que el mínimo no se reinicie si `cargando` cambia mientras corre.
  useEffect(() => {
    if (fase !== 'minimo') return
    const t = window.setTimeout(() => setFase('libre'), minimo)
    return () => window.clearTimeout(t)
  }, [fase, minimo])

  return cargando || fase === 'minimo'
}
