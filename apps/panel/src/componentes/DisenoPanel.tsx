import { Boton, cn, Selector } from '@beely/ui'
import { Building2, LogOut, MapPin, ScanLine, Settings2, Stamp, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { nombresRol } from '../lib/formato'
import { puedeConfigurar, useNegocioActivo, useNegocioStore } from '../stores/useNegocioStore'
import { useSesionStore } from '../stores/useSesionStore'
import { Marca } from './Marca'
import { BotonModo, SelectorTema } from './SelectorTema'

type Enlace = { a: string; texto: string; icono: ReactNode; visible: boolean }

const claseIcono = 'size-[18px] shrink-0'

export function DisenoPanel() {
  const sesion = useSesionStore((e) => e.sesion)
  const esAdminPlataforma = useSesionStore((e) => e.esAdminPlataforma)
  const salir = useSesionStore((e) => e.salir)
  const membresias = useNegocioStore((e) => e.membresias)
  const elegirNegocio = useNegocioStore((e) => e.elegirNegocio)
  const activo = useNegocioActivo()
  const rol = activo?.rol
  const email = sesion?.user.email ?? ''

  const enlaces: Enlace[] = [
    { a: '/caja', texto: 'Caja', icono: <ScanLine className={claseIcono} />, visible: Boolean(activo) },
    { a: '/programa', texto: 'Programa de sellos', icono: <Stamp className={claseIcono} />, visible: Boolean(activo) },
    { a: '/negocio', texto: 'Negocio', icono: <Settings2 className={claseIcono} />, visible: puedeConfigurar(rol) },
    { a: '/sedes', texto: 'Sedes', icono: <MapPin className={claseIcono} />, visible: Boolean(activo) },
    { a: '/equipo', texto: 'Equipo', icono: <Users className={claseIcono} />, visible: puedeConfigurar(rol) },
    { a: '/plataforma', texto: 'Plataforma', icono: <Building2 className={claseIcono} />, visible: esAdminPlataforma },
  ]

  return (
    <div className="min-h-dvh bg-fondo md:grid md:grid-cols-[17rem_1fr]">
      <aside className="z-10 flex flex-col gap-5 border-b border-borde bg-superficie/85 p-4 backdrop-blur-xl md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <Marca subtitulo="Panel del negocio" />
          <BotonModo className="md:hidden" />
        </div>

        {membresias.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="px-1 text-[11px] font-semibold tracking-wider text-texto-3 uppercase">Negocio</p>
            <Selector
              aria-label="Negocio"
              value={activo?.negocio.id ?? ''}
              onChange={(e) => void elegirNegocio(e.target.value)}
              disabled={membresias.length === 1}
              className="font-medium"
            >
              {membresias.map((m) => (
                <option key={m.negocio.id} value={m.negocio.id}>
                  {m.negocio.nombre}
                </option>
              ))}
            </Selector>
            {rol ? (
              <p className="flex items-center gap-1.5 px-1 text-xs text-texto-3">
                <span className="size-1.5 rounded-full bg-acento" aria-hidden />
                Tu rol: {nombresRol[rol]}
              </p>
            ) : null}
          </div>
        ) : null}

        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col">
          {enlaces
            .filter((e) => e.visible)
            .map((e) => (
              <NavLink
                key={e.a}
                to={e.a}
                className={({ isActive }) =>
                  cn(
                    'group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-texto-2 transition-colors hover:bg-hundido hover:text-texto',
                    isActive && 'bg-acento-suave text-texto hover:bg-acento-suave',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'absolute top-1/2 left-0 hidden h-5 w-1 -translate-y-1/2 rounded-full bg-acento md:block',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className={cn('text-texto-3 transition-colors group-hover:text-texto', isActive && 'text-acento-texto')}>
                      {e.icono}
                    </span>
                    {e.texto}
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        <div className="mt-auto hidden flex-col gap-3 md:flex">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-borde bg-fondo px-3 py-2.5">
            <SelectorTema />
            <BotonModo className="-mr-1.5 size-8" />
          </div>
          <div className="flex items-center gap-3 rounded-xl px-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-acento-suave text-sm font-semibold text-acento-texto uppercase"
              aria-hidden
            >
              {email.slice(0, 1)}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm text-texto-2" title={email}>
              {email}
            </p>
            <Boton variante="fantasma" tamano="icono" className="size-8" onClick={() => void salir()} aria-label="Salir" title="Salir">
              <LogOut className="size-4" />
            </Boton>
          </div>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-10 md:py-10">
        <Outlet />
        <div className="mt-10 flex flex-col gap-3 border-t border-borde pt-6 md:hidden">
          <SelectorTema />
          <Boton variante="fantasma" tamano="sm" className="justify-start" onClick={() => void salir()}>
            <LogOut className="size-4" /> Salir ({email})
          </Boton>
        </div>
      </main>
    </div>
  )
}

export function EncabezadoPagina({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-texto md:text-3xl">{titulo}</h1>
        {descripcion ? <p className="mt-1.5 max-w-2xl text-sm text-texto-3">{descripcion}</p> : null}
      </div>
      {accion}
    </header>
  )
}
