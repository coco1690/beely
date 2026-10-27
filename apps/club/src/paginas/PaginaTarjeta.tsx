import { fecha } from '@beely/tipos'
import { Boton, cn, EstadoVacio, FilaLista, Lista, PanelInferior, Sello, SellosTarjeta } from '@beely/ui'
import { Gift, QrCode, Stamp } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CodigoQr } from '../componentes/CodigoQr'
import { MarcaNegocio } from '../componentes/MarcaNegocio'
import { cuponesVigentes, useClubStore, type TarjetaClub } from '../stores/useClubStore'

type Diseno = NonNullable<NonNullable<TarjetaClub['programas']>['disenos_tarjeta']>

// Dentro del pase los tokens del tema toman los colores del diseño de la tarjeta
// (los mismos que irán a Google/Apple Wallet), así Sello y SellosTarjeta se pintan solos.
function estiloPase(d: Diseno | null): CSSProperties {
  const fondo = d?.color_fondo ?? '#F5B301'
  const texto = d?.color_texto ?? '#1F1A17'
  return {
    backgroundColor: fondo,
    color: texto,
    ['--b-acento' as string]: texto,
    ['--b-sobre-acento' as string]: fondo,
    ['--b-hundido' as string]: `color-mix(in oklab, ${texto} 9%, transparent)`,
    ['--b-borde-fuerte' as string]: `color-mix(in oklab, ${texto} 38%, transparent)`,
  }
}

export function PaginaTarjeta() {
  const tarjeta = useClubStore((e) => e.tarjeta)
  const negocio = useClubStore((e) => e.negocio)
  const [parametros] = useSearchParams()
  if (!tarjeta || !negocio) return null

  const programa = tarjeta.programas
  const requeridos = programa?.sellos_requeridos ?? 10
  const faltan = Math.max(requeridos - tarjeta.sellos_actuales, 0)
  const premios = cuponesVigentes(tarjeta).filter((c) => c.origen === 'premio_sellos')
  const variante = parametros.get('variante') ?? 'pase'
  const datos = { tarjeta, negocio, requeridos, faltan, premio: programa?.premio_descripcion ?? '' }

  return (
    <div className="flex flex-col gap-4">
      {tarjeta.estado === 'bloqueada' ? (
        <p role="alert" className="rounded-control border border-peligro-borde bg-peligro-suave px-3.5 py-3 text-sm text-texto">
          Esta tarjeta está bloqueada. Pregunta en caja.
        </p>
      ) : null}
      {variante === 'qr' ? <VarianteQr {...datos} /> : variante === 'panal' ? <VariantePanal {...datos} /> : <VariantePase {...datos} />}

      {premios.length > 0 ? (
        <Link
          to="cupones"
          className="flex items-center gap-3 rounded-tarjeta border border-acento-borde bg-acento-suave p-3.5 transition-colors hover:bg-acento-suave/70 motion-safe:animate-estampar"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento text-sobre-acento" aria-hidden>
            <Gift className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-texto">
              {premios.length === 1 ? '¡Tienes un premio!' : `¡Tienes ${premios.length} premios!`}
            </span>
            <span className="block text-etiqueta text-texto-2">
              {premios[0]?.descripcion} · vence el {fecha(premios[0]?.vence_en)}
            </span>
          </span>
        </Link>
      ) : null}

      <UltimasVisitas tarjeta={tarjeta} />
    </div>
  )
}

type DatosVariante = {
  tarjeta: TarjetaClub
  negocio: { nombre: string; logo_url: string | null }
  requeridos: number
  faltan: number
  premio: string
}

const textoFaltan = (faltan: number, premio: string) =>
  faltan === 0 ? `¡Completaste la tarjeta! ${premio}` : `Te ${faltan === 1 ? 'falta 1 sello' : `faltan ${faltan} sellos`} para ${premio.toLowerCase()}`

// A · Pase: la tarjeta con los colores del negocio (como en Wallet) y el QR siempre a la vista.
function VariantePase({ tarjeta, negocio, requeridos, faltan, premio }: DatosVariante) {
  const diseno = tarjeta.programas?.disenos_tarjeta ?? null
  return (
    <>
      <section className="relative overflow-hidden rounded-[1.25rem] p-5 shadow-capa" style={estiloPase(diseno)} aria-label="Tu tarjeta de sellos">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <MarcaNegocio logoUrl={diseno?.logo_url ?? negocio.logo_url} nombre={negocio.nombre} className="size-9 ring-0" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold">{negocio.nombre}</p>
              <p className="truncate text-xs" style={{ color: diseno?.color_etiquetas }}>
                {diseno?.titulo ?? 'Tarjeta de sellos'}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-right leading-none">
            <span key={tarjeta.sellos_actuales} className="text-[2rem] font-semibold tracking-tight tabular-nums motion-safe:animate-aparecer">
              {tarjeta.sellos_actuales}
            </span>
            <span className="text-sm tabular-nums opacity-70">/{requeridos}</span>
          </p>
        </div>
        <SellosTarjeta
          actuales={tarjeta.sellos_actuales}
          requeridos={requeridos}
          columnas={requeridos <= 6 ? requeridos : Math.ceil(requeridos / 2)}
          className="mt-5 gap-2"
        />
        <div className="mt-5 flex items-end justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="text-xs" style={{ color: diseno?.color_etiquetas }}>
              Premio
            </p>
            <p className="line-clamp-2 font-medium">{premio}</p>
          </div>
          <p className="shrink-0 text-xs tabular-nums" style={{ color: diseno?.color_etiquetas }}>
            {faltan === 0 ? '¡Completa!' : `Faltan ${faltan}`}
          </p>
        </div>
      </section>

      <section className="flex items-center gap-4 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
        <CodigoQr valor={tarjeta.token_publico} className="w-32 shrink-0 p-1" />
        <div className="min-w-0">
          <p className="text-seccion text-texto">{tarjeta.clientes?.nombre}</p>
          <p className="mt-1 text-etiqueta text-texto-3">Muestra este código en caja para sumar tus sellos y canjear tus premios.</p>
        </div>
      </section>
    </>
  )
}

// B · QR primero: lo que se usa en caja, grande; el progreso en una barra debajo.
function VarianteQr({ tarjeta, requeridos, faltan, premio }: DatosVariante) {
  return (
    <>
      <section className="flex flex-col items-center gap-3 rounded-capa border border-borde bg-superficie p-5 text-center shadow-tarjeta">
        <p className="text-seccion text-texto">Hola, {tarjeta.clientes?.nombre.split(' ')[0]}</p>
        <CodigoQr valor={tarjeta.token_publico} className="w-full max-w-64 p-2" />
        <p className="text-etiqueta text-texto-3">Muestra este código en caja</p>
      </section>
      <section className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-baseline gap-1.5">
            <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-texto tabular-nums">{tarjeta.sellos_actuales}</span>
            <span className="text-sm text-texto-3 tabular-nums">de {requeridos} sellos</span>
          </p>
          <Stamp className="size-5 text-acento-texto" aria-hidden />
        </div>
        <div className="mt-3 flex h-2.5 gap-[3px]" aria-hidden>
          {Array.from({ length: requeridos }, (_, i) => (
            <span key={i} className={cn('flex-1 rounded-full', i < tarjeta.sellos_actuales ? 'bg-acento' : 'bg-hundido')} />
          ))}
        </div>
        <p className="mt-3 text-etiqueta text-texto-2">{textoFaltan(faltan, premio)}</p>
      </section>
    </>
  )
}

// C · Panal: los sellos como protagonistas; el QR se abre en un panel desde abajo.
function VariantePanal({ tarjeta, requeridos, faltan, premio }: DatosVariante) {
  const [qrAbierto, setQrAbierto] = useState(false)
  return (
    <>
      <section className="flex flex-col items-center gap-5 rounded-capa border border-borde bg-superficie px-5 pt-7 pb-5 text-center shadow-tarjeta">
        <p className="flex items-baseline gap-1.5">
          <span key={tarjeta.sellos_actuales} className="text-[3.5rem] leading-none font-semibold tracking-tight text-texto tabular-nums motion-safe:animate-aparecer">
            {tarjeta.sellos_actuales}
          </span>
          <span className="text-base text-texto-3 tabular-nums">de {requeridos}</span>
        </p>
        <div className="flex max-w-80 flex-wrap justify-center gap-1.5" role="img" aria-label={`${tarjeta.sellos_actuales} de ${requeridos} sellos`}>
          {Array.from({ length: requeridos }, (_, i) => (
            <Sello key={i} lleno={i < tarjeta.sellos_actuales} className="size-[clamp(2.25rem,13vw,3rem)]" />
          ))}
        </div>
        <p className="text-sm text-texto-2">{textoFaltan(faltan, premio)}</p>
        <Boton className="w-full" onClick={() => setQrAbierto(true)}>
          <QrCode />
          Mostrar mi código
        </Boton>
      </section>
      <PanelInferior abierto={qrAbierto} onAbiertoCambia={setQrAbierto} titulo="Tu código" descripcion="Muéstralo en caja">
        <div className="mx-auto w-full max-w-72 pb-4">
          <CodigoQr valor={tarjeta.token_publico} className="p-2" />
        </div>
      </PanelInferior>
    </>
  )
}

const nombresOrigen: Record<string, string> = {
  api_pos: 'Compra',
  panel: 'Compra',
  ajuste: 'Ajuste',
  canje_premio: 'Premio canjeado',
}

function UltimasVisitas({ tarjeta }: { tarjeta: TarjetaClub }) {
  const eventos = tarjeta.eventos_sello.slice(0, 5)
  return (
    <section className="rounded-tarjeta border border-borde bg-superficie shadow-tarjeta">
      <h2 className="px-4 pt-3.5 pb-1 text-seccion text-texto">Últimos sellos</h2>
      {eventos.length === 0 ? (
        <EstadoVacio icono={<Stamp />} titulo="Aún no tienes sellos" descripcion="Muestra tu código en caja en tu próxima compra." />
      ) : (
        <Lista>
          {eventos.map((e) => (
            <FilaLista key={e.id} className="py-2.5">
              <span className="min-w-0">
                <span className="block text-sm text-texto">{nombresOrigen[e.origen] ?? 'Sello'}</span>
                <span className="block text-xs text-texto-3">
                  {fecha(e.creado_en)}
                  {e.sedes ? ` · ${e.sedes.nombre}` : ''}
                </span>
              </span>
              <span className={cn('text-sm font-medium tabular-nums', e.cantidad > 0 ? 'text-texto' : 'text-texto-3')}>
                {e.cantidad > 0 ? `+${e.cantidad}` : e.cantidad}
              </span>
            </FilaLista>
          ))}
        </Lista>
      )}
    </section>
  )
}
