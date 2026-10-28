import { numero } from '@beely/tipos'
import { cn, Insignia } from '@beely/ui'
import { useState, type ReactNode } from 'react'
import { periodos, type Periodo, type PuntoSerie } from '../stores/usePlataformaStore'

export const dominioClub = import.meta.env.VITE_CLUB_DOMINIO_BASE ?? 'hibeely.com'

export const planes = ['basico', 'pro', 'empresa'] as const
export const estados = ['activo', 'suspendido', 'cancelado'] as const
export const nombresPlan: Record<string, string> = { basico: 'Básico', pro: 'Pro', empresa: 'Empresa' }
export const nombresEstado: Record<string, string> = { activo: 'Activo', suspendido: 'Suspendido', cancelado: 'Cancelado' }

export function InsigniaEstado({ estado }: { estado: string }) {
  const tono = estado === 'activo' ? 'exito' : estado === 'suspendido' ? 'miel' : 'peligro'
  return <Insignia tono={tono}>{nombresEstado[estado] ?? estado}</Insignia>
}

export function InsigniaPlan({ plan }: { plan: string }) {
  return <Insignia>{nombresPlan[plan] ?? plan}</Insignia>
}

// Una cifra con su etiqueta y, si aplica, un detalle debajo.
export function Cifra({ etiqueta, valor, detalle }: { etiqueta: string; valor: number | string; detalle?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-superficie px-4 py-3.5">
      <dt className="truncate text-xs text-texto-3">{etiqueta}</dt>
      <dd className="text-2xl font-semibold tracking-tight text-texto tabular-nums">{typeof valor === 'number' ? numero(valor) : valor}</dd>
      {detalle ? <dd className="truncate text-xs text-texto-3">{detalle}</dd> : null}
    </div>
  )
}

export function GrupoCifras({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-tarjeta border border-borde bg-borde lg:grid-cols-4', className)}>
      {children}
    </dl>
  )
}

// Selector segmentado de la ventana de días.
export function SelectorPeriodo({ valor, onCambio }: { valor: Periodo; onCambio: (dias: Periodo) => void }) {
  return (
    <div role="radiogroup" aria-label="Periodo" className="inline-flex rounded-control border border-borde bg-hundido p-0.5">
      {periodos.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={p === valor}
          onClick={() => onCambio(p)}
          className={cn(
            'h-7 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-etiqueta font-medium text-texto-2 transition-colors hover:text-texto focus-visible:outline-2 focus-visible:outline-foco pointer-coarse:h-9',
            p === valor && 'bg-superficie text-texto shadow-tarjeta',
          )}
        >
          {p} días
        </button>
      ))}
    </div>
  )
}

// "2026-10-19" → "19 oct".
const formatoDia = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const diaCorto = (dia: string) => formatoDia.format(new Date(`${dia}T00:00:00Z`)).replace('.', '')

// Barras de sellos por día. Una sola serie: el título la nombra, sin leyenda.
// Al pasar el cursor (o tocar) una columna se ve el día con sus sellos y clientes nuevos.
export function GraficaDiaria({ serie }: { serie: PuntoSerie[] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const maximo = Math.max(1, ...serie.map((p) => p.sellos))
  const punto = activo === null ? null : serie[activo]
  const total = serie.reduce((suma, p) => suma + p.sellos, 0)

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex min-h-10 items-end justify-between gap-3">
        <figcaption className="text-sm font-semibold text-texto">Sellos por día</figcaption>
        <p className="text-right text-xs text-texto-3 tabular-nums" aria-live="polite">
          {punto ? (
            <>
              <span className="font-medium text-texto">{diaCorto(punto.dia)}</span> · {numero(punto.sellos)} sellos · {numero(punto.clientes)}{' '}
              clientes nuevos
            </>
          ) : (
            <>{numero(total)} sellos en el periodo</>
          )}
        </p>
      </div>
      <div className="relative h-40" onMouseLeave={() => setActivo(null)}>
        {/* Guías recesivas: base y mitad. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-borde" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-borde/70" aria-hidden />
        <span className="pointer-events-none absolute top-0 left-0 text-[0.6875rem] text-texto-3 tabular-nums" aria-hidden>
          {numero(maximo)}
        </span>
        <div className="absolute inset-0 flex items-end gap-[2px] pl-8" aria-hidden>
          {serie.map((p, i) => (
            <div
              key={p.dia}
              className="flex h-full min-w-0 flex-1 items-end"
              onMouseEnter={() => setActivo(i)}
              onClick={() => setActivo(i)}
            >
              <div
                className={cn(
                  'w-full rounded-t-[4px] bg-acento transition-opacity',
                  activo !== null && activo !== i && 'opacity-40',
                  p.sellos === 0 && 'bg-borde',
                )}
                style={{ height: p.sellos === 0 ? 2 : `${Math.max(3, (p.sellos / maximo) * 100)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between pl-8 text-[0.6875rem] text-texto-3 tabular-nums" aria-hidden>
        <span>{serie[0] ? diaCorto(serie[0].dia) : ''}</span>
        <span>{serie.at(-1) ? diaCorto(serie.at(-1)!.dia) : ''}</span>
      </div>
      {/* Vista en tabla para lectores de pantalla. */}
      <table className="sr-only">
        <caption>Sellos y clientes nuevos por día</caption>
        <thead>
          <tr>
            <th>Día</th>
            <th>Sellos</th>
            <th>Clientes nuevos</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((p) => (
            <tr key={p.dia}>
              <td>{p.dia}</td>
              <td>{p.sellos}</td>
              <td>{p.clientes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// "hace 3 días" a partir de una fecha; null → "Nunca".
export function haceCuanto(valor: string | null): string {
  if (!valor) return 'Nunca'
  const dias = Math.floor((Date.now() - new Date(valor).getTime()) / 86_400_000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}
