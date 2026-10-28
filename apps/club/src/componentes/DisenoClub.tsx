import { BarraFlotante, Cargando, clasePestana, EstadoVacio, JalarParaRecargar, LogoNegocio, toast } from '@beely/ui'
import { CreditCard, SearchX, Ticket, UserRound } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useParams } from 'react-router'
import { tokenGuardado, urlClub } from '../lib/club'
import { cuponesVigentes, useClubStore } from '../stores/useClubStore'

// Cada cuánto se vuelve a pedir la tarjeta mientras está en pantalla: así el sello
// que suma la caja aparece solo, con el cliente todavía frente al mostrador.
const INTERVALO_MS = 6000

export function DisenoClub() {
  const { token = '' } = useParams()
  const negocio = useClubStore((e) => e.negocio)
  const tarjeta = useClubStore((e) => e.tarjeta)
  const estado = useClubStore((e) => e.estadoTarjeta)
  const abrirTarjeta = useClubStore((e) => e.abrirTarjeta)
  const refrescar = useClubStore((e) => e.refrescarTarjeta)

  useEffect(() => {
    void abrirTarjeta(token)
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refrescar()
    }, INTERVALO_MS)
    const alVolver = () => document.visibilityState === 'visible' && void refrescar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [token, abrirTarjeta, refrescar])

  useAvisosDeSellos()

  if (estado === 'no_encontrado') {
    return (
      <main className="mx-auto max-w-md px-4 pt-24">
        <EstadoVacio icono={<SearchX />} titulo="No encontramos esta tarjeta" descripcion="Revisa el enlace o pide en caja que te lo reenvíen." />
      </main>
    )
  }
  if (!tarjeta || !negocio) return estado === 'error' ? <ErrorCarga /> : <Cargando />

  // Tarjeta de otro negocio abierta en este subdominio: se lleva a su club.
  const slugTarjeta = tarjeta.negocios?.slug
  if (slugTarjeta && slugTarjeta !== negocio.slug) {
    const destino = urlClub(slugTarjeta, `/t/${token}`)
    if (destino) window.location.replace(destino)
    return <Cargando />
  }

  const cupones = cuponesVigentes(tarjeta).length
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-20 border-b border-borde bg-fondo/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4">
          <LogoNegocio url={negocio.logo_url} nombre={negocio.nombre} className="size-8" />
          <p className="truncate text-sm font-semibold text-texto">{negocio.nombre}</p>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BarraFlotante className="mx-auto max-w-md">
        <NavLink to="" end className={({ isActive }) => clasePestana(isActive)}>
          <CreditCard />
          Tarjeta
        </NavLink>
        <NavLink to="cupones" className={({ isActive }) => clasePestana(isActive)}>
          <span className="relative">
            <Ticket />
            {cupones > 0 ? (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-acento bg-degradado px-1 text-[10px] font-semibold text-sobre-acento tabular-nums">
                {cupones}
              </span>
            ) : null}
          </span>
          Cupones
        </NavLink>
        <NavLink to="perfil" className={({ isActive }) => clasePestana(isActive)}>
          <UserRound />
          Perfil
        </NavLink>
      </BarraFlotante>
      <JalarParaRecargar alRecargar={refrescar} />
    </div>
  )
}

function ErrorCarga() {
  const error = useClubStore((e) => e.error)
  return (
    <main className="mx-auto max-w-md px-4 pt-24">
      <EstadoVacio icono={<SearchX />} titulo="No pudimos cargar tu tarjeta" descripcion={error ?? 'Revisa tu conexión e intenta de nuevo.'} />
    </main>
  )
}

// Avisa cuando la caja suma sellos o se emite el premio mientras la tarjeta está abierta.
function useAvisosDeSellos() {
  const tarjeta = useClubStore((e) => e.tarjeta)
  const previo = useRef<{ id: string; historicos: number; premios: number } | null>(null)
  useEffect(() => {
    if (!tarjeta) return
    const antes = previo.current
    previo.current = { id: tarjeta.id, historicos: tarjeta.sellos_historicos, premios: tarjeta.premios_ganados }
    if (!antes || antes.id !== tarjeta.id) return
    if (tarjeta.premios_ganados > antes.premios) {
      toast.success('¡Completaste tu tarjeta!', { description: 'Tu premio ya está en Cupones.' })
    } else if (tarjeta.sellos_historicos > antes.historicos) {
      const sumados = tarjeta.sellos_historicos - antes.historicos
      toast.success(sumados === 1 ? '¡Sumaste un sello!' : `¡Sumaste ${sumados} sellos!`)
    }
  }, [tarjeta])
}

export function SinClub() {
  return (
    <main className="mx-auto max-w-md px-4 pt-24">
      <EstadoVacio icono={<SearchX />} titulo="No encontramos este club" descripcion="Revisa la dirección o pregunta en el negocio." />
    </main>
  )
}

// Raíz del club: con tarjeta guardada en este teléfono abre la tarjeta; si no, el registro.
export function Inicio({ children }: { children: ReactNode }) {
  const slug = useClubStore((e) => e.slug)
  const token = useClubStore((e) => e.token)
  const guardado = slug ? tokenGuardado(slug) : null
  const destino = token ?? guardado
  return destino ? <Navigate to={`/t/${destino}`} replace /> : <>{children}</>
}
