import { fecha } from '@beely/tipos'
import { cn, coloresDeNegocio, EstadoVacio, FilaLista, Lista, LogoNegocio, SellosTarjeta, type ColoresMarca } from '@beely/ui'
import { Gift, Stamp } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { BotonGoogleWallet } from '../componentes/BotonGoogleWallet'
import { CodigoQr } from '../componentes/CodigoQr'
import { cuponesVigentes, useClubStore, type NegocioClub, type TarjetaClub } from '../stores/useClubStore'

type Diseno = NonNullable<NonNullable<TarjetaClub['programas']>['disenos_tarjeta']>

// El diseño que trae la tarjeta por defecto (migración núcleo): mientras el negocio no lo
// cambie en el editor de tarjeta, el pase se pinta con los colores del negocio.
const FONDO_INICIAL = '#f5b301'
const TEXTO_INICIAL = '#1f1a17'
// Sin colores de negocio válidos: el degradado de Beely (el de modo claro).
const COLORES_BEELY: ColoresMarca = { acento: '#dd4f3a', acento2: '#d03568', sobre: '#ffffff' }

const disenoPropio = (d: Diseno | null): d is Diseno =>
  !!d && (d.color_fondo.toLowerCase() !== FONDO_INICIAL || d.color_texto.toLowerCase() !== TEXTO_INICIAL)

// Dentro del pase los tokens del tema toman los colores de la tarjeta, así Sello y
// SellosTarjeta se pintan solos: el fondo es el degradado del negocio (o el diseño propio
// de la tarjeta, el mismo que irá a Google/Apple Wallet) y los sellos van en el color del texto.
function estiloPase(d: Diseno | null, negocio: NegocioClub): CSSProperties {
  const propio = disenoPropio(d)
  const marca = coloresDeNegocio(negocio.color_primario, negocio.color_secundario) ?? COLORES_BEELY
  const texto = propio ? d.color_texto : marca.sobre
  return {
    background: propio ? d.color_fondo : `linear-gradient(135deg, ${marca.acento}, ${marca.acento2})`,
    color: texto,
    ['--b-acento' as string]: texto,
    ['--b-acento-2' as string]: texto,
    ['--b-sobre-acento' as string]: propio ? d.color_fondo : marca.acento,
    ['--b-hundido' as string]: `color-mix(in oklab, ${texto} 9%, transparent)`,
    ['--b-borde-fuerte' as string]: `color-mix(in oklab, ${texto} 38%, transparent)`,
  }
}

// Etiquetas del pase: las del diseño propio o el texto un poco más tenue.
const colorEtiquetas = (d: Diseno | null) => (disenoPropio(d) ? d.color_etiquetas : 'color-mix(in oklab, currentColor 78%, transparent)')

export function PaginaTarjeta() {
  const tarjeta = useClubStore((e) => e.tarjeta)
  const negocio = useClubStore((e) => e.negocio)
  if (!tarjeta || !negocio) return null

  const programa = tarjeta.programas
  const requeridos = programa?.sellos_requeridos ?? 10
  const faltan = Math.max(requeridos - tarjeta.sellos_actuales, 0)
  const premios = cuponesVigentes(tarjeta).filter((c) => c.origen === 'premio_sellos')
  const datos = { tarjeta, negocio, requeridos, faltan, premio: programa?.premio_descripcion ?? '' }

  return (
    <div className="flex flex-col gap-4">
      {tarjeta.estado === 'bloqueada' ? (
        <p role="alert" className="rounded-control border border-peligro-borde bg-peligro-suave px-3.5 py-3 text-sm text-texto">
          Esta tarjeta está bloqueada. Pregunta en caja.
        </p>
      ) : null}
      <Pase {...datos} />

      {premios.length > 0 ? (
        <Link
          to="cupones"
          className="flex items-center gap-3 rounded-tarjeta border border-acento-borde bg-acento-suave p-3.5 transition-colors hover:bg-acento-suave/70 motion-safe:animate-estampar"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento bg-degradado text-sobre-acento" aria-hidden>
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

type DatosPase = {
  tarjeta: TarjetaClub
  negocio: NegocioClub
  requeridos: number
  faltan: number
  premio: string
}

// El pase: la tarjeta con los colores del negocio (como en Wallet) y el QR siempre a la vista.
function Pase({ tarjeta, negocio, requeridos, faltan, premio }: DatosPase) {
  const diseno = tarjeta.programas?.disenos_tarjeta ?? null
  return (
    <>
      <section className="relative overflow-hidden rounded-[1.25rem] p-5 shadow-capa" style={estiloPase(diseno, negocio)} aria-label="Tu tarjeta de sellos">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoNegocio url={diseno?.logo_url ?? negocio.logo_url} nombre={negocio.nombre} className="size-9" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold">{negocio.nombre}</p>
              <p className="truncate text-xs" style={{ color: colorEtiquetas(diseno) }}>
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
          logo={diseno?.logo_url ?? negocio.logo_url}
          className="mt-5 gap-2"
        />
        <div className="mt-5 flex items-end justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="text-xs" style={{ color: colorEtiquetas(diseno) }}>
              Premio
            </p>
            <p className="line-clamp-2 font-medium">{premio}</p>
          </div>
          <p className="shrink-0 text-xs tabular-nums" style={{ color: colorEtiquetas(diseno) }}>
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

      {tarjeta.estado === 'activa' ? <BotonGoogleWallet slug={negocio.slug} token={tarjeta.token_publico} /> : null}
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
