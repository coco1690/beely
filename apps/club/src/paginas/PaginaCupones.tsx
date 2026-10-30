import { fecha } from '@beely/tipos'
import { EstadoVacio, FilaLista, Insignia, Lista } from '@beely/ui'
import { Gift, Ticket } from 'lucide-react'
import { cuponesVigentes, useClubStore, type CuponClub } from '../stores/useClubStore'

const estados: Record<string, { texto: string; tono: 'neutro' | 'exito' | 'peligro' }> = {
  canjeado: { texto: 'Canjeado', tono: 'exito' },
  vencido: { texto: 'Vencido', tono: 'neutro' },
  anulado: { texto: 'Anulado', tono: 'neutro' },
  emitido: { texto: 'Vencido', tono: 'neutro' },
}

export function PaginaCupones() {
  const tarjeta = useClubStore((e) => e.tarjeta)
  if (!tarjeta) return null
  const vigentes = cuponesVigentes(tarjeta)
  const usados = tarjeta.cupones.filter((c) => !vigentes.includes(c))

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-titulo text-texto">Tus cupones</h1>
        {vigentes.length === 0 ? (
          <div className="rounded-tarjeta border border-borde bg-superficie shadow-tarjeta">
            <EstadoVacio
              icono={<Ticket />}
              titulo="No tienes cupones por ahora"
              descripcion="Cuando completes tu tarjeta o recibas una promoción, aparecerá aquí."
            />
          </div>
        ) : (
          vigentes.map((c) => <CuponVigente key={c.id} cupon={c} />)
        )}
      </section>

      {usados.length > 0 ? (
        <section className="rounded-tarjeta border border-borde bg-superficie shadow-tarjeta">
          <h2 className="px-4 pt-3.5 pb-1 text-seccion text-texto">Historial</h2>
          <Lista>
            {usados.map((c) => {
              const estado = estados[c.estado] ?? estados.vencido
              return (
                <FilaLista key={c.id} className="py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-texto">{c.descripcion}</span>
                    <span className="block text-xs text-texto-3">
                      {c.canjeado_en ? `Canjeado el ${fecha(c.canjeado_en)}` : `Venció el ${fecha(c.vence_en)}`}
                    </span>
                  </span>
                  <Insignia tono={estado?.tono}>{estado?.texto}</Insignia>
                </FilaLista>
              )
            })}
          </Lista>
        </section>
      ) : null}
    </div>
  )
}

// Cupón con un borde troquelado; el código va en mono para leerlo en caja.
function CuponVigente({ cupon }: { cupon: CuponClub }) {
  const esPremio = cupon.origen === 'premio_sellos'
  return (
    <article className="flex overflow-hidden rounded-tarjeta border border-acento-borde bg-superficie shadow-tarjeta">
      <div className="flex w-16 shrink-0 items-center justify-center border-r border-dashed border-acento-borde bg-acento-suave text-acento-texto">
        {esPremio ? <Gift className="size-6" aria-hidden /> : <Ticket className="size-6" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1 p-3.5">
        <p className="text-xs text-texto-3">{esPremio ? 'Premio de tu tarjeta' : cupon.origen === 'campana' ? 'Promoción' : 'Cupón'}</p>
        <p className="text-sm font-semibold text-pretty break-words text-texto">{cupon.descripcion}</p>
        {cupon.campanas?.mensaje ? <p className="mt-0.5 text-etiqueta text-pretty break-words text-texto-2">{cupon.campanas.mensaje}</p> : null}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-sm bg-hundido px-1.5 py-0.5 font-mono text-etiqueta tracking-wider text-texto">{cupon.codigo}</span>
          <span className="text-xs text-texto-3">Vence el {fecha(cupon.vence_en)}</span>
        </div>
      </div>
    </article>
  )
}
