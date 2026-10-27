import { Boton, cn, Selector } from '@beely/ui'
import { Building2, LogOut, MapPin, ScanLine, Settings2, Stamp, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { nombresRol } from '../lib/formato'
import { puedeConfigurar, useNegocioActivo, useNegocioStore } from '../stores/useNegocioStore'
import { useSesionStore } from '../stores/useSesionStore'
import { Marca } from './Marca'

type Enlace = { a: string; texto: string; icono: ReactNode; visible: boolean }

export function DisenoPanel() {
  const sesion = useSesionStore((e) => e.sesion)
  const esAdminPlataforma = useSesionStore((e) => e.esAdminPlataforma)
  const salir = useSesionStore((e) => e.salir)
  const membresias = useNegocioStore((e) => e.membresias)
  const elegirNegocio = useNegocioStore((e) => e.elegirNegocio)
  const activo = useNegocioActivo()
  const rol = activo?.rol

  const enlaces: Enlace[] = [
    { a: '/caja', texto: 'Caja', icono: <ScanLine className="size-4" />, visible: Boolean(activo) },
    { a: '/programa', texto: 'Programa de sellos', icono: <Stamp className="size-4" />, visible: Boolean(activo) },
    { a: '/negocio', texto: 'Negocio', icono: <Settings2 className="size-4" />, visible: puedeConfigurar(rol) },
    { a: '/sedes', texto: 'Sedes', icono: <MapPin className="size-4" />, visible: Boolean(activo) },
    { a: '/equipo', texto: 'Equipo', icono: <Users className="size-4" />, visible: puedeConfigurar(rol) },
    { a: '/plataforma', texto: 'Plataforma', icono: <Building2 className="size-4" />, visible: esAdminPlataforma },
  ]

  return (
    <div className="min-h-dvh bg-colmena-50 md:grid md:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-4 border-b border-colmena-100 bg-white p-4 md:min-h-dvh md:border-r md:border-b-0">
        <Marca subtitulo="Panel del negocio" />

        {membresias.length > 0 ? (
          <div className="flex flex-col gap-1">
            <Selector
              aria-label="Negocio"
              value={activo?.negocio.id ?? ''}
              onChange={(e) => void elegirNegocio(e.target.value)}
              disabled={membresias.length === 1}
            >
              {membresias.map((m) => (
                <option key={m.negocio.id} value={m.negocio.id}>
                  {m.negocio.nombre}
                </option>
              ))}
            </Selector>
            {rol ? <p className="px-1 text-xs text-colmena-500">Tu rol: {nombresRol[rol]}</p> : null}
          </div>
        ) : null}

        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {enlaces
            .filter((e) => e.visible)
            .map((e) => (
              <NavLink
                key={e.a}
                to={e.a}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-colmena-700 hover:bg-colmena-100',
                    isActive && 'bg-miel-100 text-colmena-900',
                  )
                }
              >
                {e.icono}
                {e.texto}
              </NavLink>
            ))}
        </nav>

        <div className="mt-auto hidden flex-col gap-2 md:flex">
          <p className="truncate px-1 text-xs text-colmena-500" title={sesion?.user.email}>
            {sesion?.user.email}
          </p>
          <Boton variante="fantasma" tamano="sm" className="justify-start" onClick={() => void salir()}>
            <LogOut className="size-4" /> Salir
          </Boton>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <Outlet />
        <Boton variante="fantasma" tamano="sm" className="mt-8 md:hidden" onClick={() => void salir()}>
          <LogOut className="size-4" /> Salir ({sesion?.user.email})
        </Boton>
      </main>
    </div>
  )
}

export function EncabezadoPagina({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-colmena-900">{titulo}</h1>
        {descripcion ? <p className="mt-1 text-sm text-colmena-500">{descripcion}</p> : null}
      </div>
      {accion}
    </header>
  )
}
