import { nombresRol } from '@beely/tipos'
import {
  BarraFlotante,
  clasePestana,
  cn,
  LogoBeely,
  LogoNegocio,
  MenuContenido,
  MenuDisparador,
  MenuEtiqueta,
  MenuGrupoRadio,
  MenuItem,
  MenuItemRadio,
  MenuRaiz,
  MenuSeparador,
  PanelInferior,
  temas,
  useTemaStore,
} from '@beely/ui'
import {
  ArrowLeft,
  Building2,
  ChevronsUpDown,
  Ellipsis,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  ScanLine,
  Settings2,
  ShieldCheck,
  Stamp,
  Sun,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { puedeConfigurar, useNegocioActivo, useNegocioStore } from '../stores/useNegocioStore'
import { useSesionStore } from '../stores/useSesionStore'

// `fin`: solo activo en la ruta exacta (el tablero /superadmin no se marca dentro de /superadmin/negocios).
type Enlace = { a: string; texto: string; corto: string; icono: ReactNode; fin?: boolean }

// "plataforma": panel del superadmin, sin marca de ningún negocio. "negocio": panel de un negocio.
export type ModoPanel = 'plataforma' | 'negocio'

function useEnlaces(modo: ModoPanel): Enlace[] {
  const esSuperadmin = useSesionStore((e) => e.esSuperadmin)
  const activo = useNegocioActivo()
  const rol = activo?.rol
  if (modo === 'plataforma')
    return [
      { a: '/superadmin', texto: 'Tablero', corto: 'Tablero', icono: <LayoutDashboard />, fin: true },
      { a: '/superadmin/negocios', texto: 'Negocios', corto: 'Negocios', icono: <Building2 /> },
      { a: '/superadmin/equipo', texto: 'Superadmins', corto: 'Superadmins', icono: <ShieldCheck /> },
    ]
  const enlaces: (Enlace & { visible: boolean })[] = [
    { a: '/caja', texto: 'Caja', corto: 'Caja', icono: <ScanLine />, visible: Boolean(activo) },
    { a: '/programa', texto: 'Programa de sellos', corto: 'Programa', icono: <Stamp />, visible: Boolean(activo) },
    { a: '/sedes', texto: 'Sedes', corto: 'Sedes', icono: <MapPin />, visible: Boolean(activo) },
    { a: '/negocio', texto: 'Negocio', corto: 'Negocio', icono: <Settings2 />, visible: puedeConfigurar(rol) },
    { a: '/equipo', texto: 'Equipo', corto: 'Equipo', icono: <Users />, visible: puedeConfigurar(rol) },
    { a: '/superadmin', texto: 'Volver a la plataforma', corto: 'Plataforma', icono: <ArrowLeft />, visible: esSuperadmin },
  ]
  return enlaces.filter((e) => e.visible)
}

export function DisenoPanel({ modo, children }: { modo: ModoPanel; children?: ReactNode }) {
  const enlaces = useEnlaces(modo)
  const cabecera = modo === 'plataforma' ? <MarcaPlataforma /> : <MenuNegocio />

  return (
    <div className="min-h-dvh overflow-x-clip bg-fondo md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Escritorio: barra lateral del mismo tono que el fondo; el contenido va en un panel elevado. */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-4 md:px-3 md:py-3">
        {cabecera}
        <nav className="flex flex-col gap-0.5" aria-label="Secciones">
          {enlaces.map((e) => (
            <NavLink
              key={e.a}
              to={e.a}
              end={e.fin}
              className={({ isActive }) =>
                cn(
                  'flex h-8 items-center gap-2.5 rounded-control px-2 text-sm font-medium text-texto-2 transition-colors hover:bg-texto/5 hover:text-texto focus-visible:outline-2 focus-visible:outline-foco [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-texto-3',
                  isActive && 'bg-texto/7 text-texto hover:bg-texto/7 [&_svg]:text-acento-texto',
                )
              }
            >
              {e.icono}
              {e.texto}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <MenuCuenta />
        </div>
      </aside>

      {/* Móvil: barra superior con negocio y cuenta. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-borde bg-fondo/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-lg md:hidden">
        <div className="min-w-0 flex-1 py-1.5">
          {cabecera}
        </div>
        <MenuCuenta compacto />
      </header>

      <main className="min-w-0 md:py-2 md:pr-2">
        <div className="min-h-full px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-1rem)] md:rounded-tarjeta md:border md:border-borde md:bg-superficie md:px-10 md:pt-9 md:pb-12 md:shadow-tarjeta">
          <div className="mx-auto w-full max-w-4xl">
            {modo === 'negocio' ? <AvisoVistaSuperadmin /> : null}
            {children ?? <Outlet />}
          </div>
        </div>
      </main>

      <BarraInferior enlaces={enlaces} />
    </div>
  )
}

// Móvil: barra flotante con hasta 3 secciones a un toque y el resto en "Más".
function BarraInferior({ enlaces }: { enlaces: Enlace[] }) {
  const [masAbierto, setMasAbierto] = useState(false)
  const { pathname } = useLocation()
  const visibles = enlaces.length > 4 ? enlaces.slice(0, 3) : enlaces
  const resto = enlaces.length > 4 ? enlaces.slice(3) : []
  const restoActivo = resto.some((e) => pathname.startsWith(e.a))

  if (enlaces.length < 2) return null
  return (
    <BarraFlotante className="md:hidden">
      {visibles.map((e) => (
        <NavLink key={e.a} to={e.a} end={e.fin} className={({ isActive }) => clasePestana(isActive)}>
          {e.icono}
          <span className="max-w-full truncate">{e.corto}</span>
        </NavLink>
      ))}
      {resto.length > 0 ? (
        <>
          <button type="button" className={clasePestana(restoActivo)} onClick={() => setMasAbierto(true)}>
            <Ellipsis />
            Más
          </button>
          <PanelInferior abierto={masAbierto} onAbiertoCambia={setMasAbierto} titulo="Más secciones">
            <div className="flex flex-col gap-1 pb-2">
              {resto.map((e) => (
                <NavLink
                  key={e.a}
                  to={e.a}
                  onClick={() => setMasAbierto(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex h-12 items-center gap-3 rounded-control px-3 text-base font-medium text-texto-2 [&_svg]:size-5 [&_svg]:text-texto-3',
                      isActive && 'bg-texto/7 text-texto [&_svg]:text-acento-texto',
                    )
                  }
                >
                  {e.icono}
                  {e.texto}
                </NavLink>
              ))}
            </div>
          </PanelInferior>
        </>
      ) : null}
    </BarraFlotante>
  )
}

// Cabecera del panel de plataforma: marca de Beely, nunca la de un negocio.
function MarcaPlataforma() {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-1.5 py-1">
      <LogoBeely className="size-7 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
        <span className="truncate text-sm font-semibold text-texto">Beely</span>
        <span className="truncate text-xs text-texto-3">Superadmin</span>
      </span>
    </div>
  )
}

// El superadmin sin membresía real ve el panel de un negocio solo porque lo abrió; se le recuerda.
function AvisoVistaSuperadmin() {
  const activo = useNegocioActivo()
  if (activo?.rol !== 'superadmin') return null
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-control border border-borde bg-hundido px-3 py-2 text-sm text-texto-2">
      <span className="min-w-0">
        Estás viendo el panel de <span className="font-medium text-texto">{activo.negocio.nombre}</span> como superadmin.
      </span>
      <Link
        to="/superadmin"
        className="inline-flex items-center gap-1.5 font-medium text-acento-texto hover:underline focus-visible:outline-2 focus-visible:outline-foco [&_svg]:size-4"
      >
        <ArrowLeft />
        Volver a la plataforma
      </Link>
    </div>
  )
}

// Logo + negocio activo. Con varios negocios abre un menú con el nombre completo de cada uno.
function MenuNegocio() {
  const membresias = useNegocioStore((e) => e.membresias)
  const elegirNegocio = useNegocioStore((e) => e.elegirNegocio)
  const activo = useNegocioActivo()
  const nombre = activo?.negocio.nombre ?? 'Beely'
  const detalle = activo?.rol ? nombresRol[activo.rol] : 'Panel del negocio'
  const varios = membresias.length > 1

  const contenido = (
    <>
      <LogoNegocio url={activo?.negocio.logo_url} nombre={nombre} className="size-7 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
        <span className="truncate text-sm font-semibold text-texto">{nombre}</span>
        <span className="truncate text-xs text-texto-3">{detalle}</span>
      </span>
      {varios ? <ChevronsUpDown className="size-3.5 shrink-0 text-texto-3" /> : null}
    </>
  )

  if (!varios) return <div className="flex min-w-0 items-center gap-2.5 px-1.5 py-1">{contenido}</div>
  return (
    <MenuRaiz>
      <MenuDisparador
        className="flex w-full min-w-0 items-center gap-2.5 rounded-control px-1.5 py-1 transition-colors hover:bg-texto/5 focus-visible:outline-2 focus-visible:outline-foco data-[state=open]:bg-texto/7"
        title={nombre}
      >
        {contenido}
      </MenuDisparador>
      <MenuContenido align="start" className="w-72 max-w-[calc(100vw-1rem)]">
        <MenuEtiqueta>Negocios</MenuEtiqueta>
        <MenuGrupoRadio value={activo?.negocio.id ?? ''} onValueChange={(id) => void elegirNegocio(id)}>
          {membresias.map((m) => (
            <MenuItemRadio key={m.negocio.id} value={m.negocio.id} className="items-start">
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-2">{m.negocio.nombre}</span>
                <span className="text-xs text-texto-3">{nombresRol[m.rol]}</span>
              </span>
            </MenuItemRadio>
          ))}
        </MenuGrupoRadio>
      </MenuContenido>
    </MenuRaiz>
  )
}

// Cuenta: tema, modo y salir, en un solo menú.
function MenuCuenta({ compacto = false }: { compacto?: boolean }) {
  const email = useSesionStore((e) => e.sesion?.user.email ?? '')
  const salir = useSesionStore((e) => e.salir)
  const tema = useTemaStore((e) => e.tema)
  const elegirTema = useTemaStore((e) => e.elegirTema)
  const modo = useTemaStore((e) => e.modo)
  const alternarModo = useTemaStore((e) => e.alternarModo)
  const inicial = (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-acento-suave text-xs font-semibold text-acento-texto uppercase" aria-hidden>
      {email.slice(0, 1)}
    </span>
  )

  return (
    <MenuRaiz>
      <MenuDisparador
        aria-label="Cuenta y apariencia"
        className={cn(
          'flex min-w-0 items-center gap-2.5 rounded-control transition-colors hover:bg-texto/5 focus-visible:outline-2 focus-visible:outline-foco data-[state=open]:bg-texto/7',
          compacto ? 'size-11 shrink-0 justify-center' : 'w-full px-1.5 py-1.5',
        )}
      >
        {inicial}
        {compacto ? null : <span className="min-w-0 flex-1 truncate text-left text-etiqueta text-texto-2">{email}</span>}
      </MenuDisparador>
      <MenuContenido align={compacto ? 'end' : 'start'} side={compacto ? 'bottom' : 'top'} className="w-64">
        <MenuEtiqueta className="truncate">{email}</MenuEtiqueta>
        <MenuSeparador />
        <MenuEtiqueta>Color</MenuEtiqueta>
        <MenuGrupoRadio value={tema} onValueChange={(t) => elegirTema(t as (typeof temas)[number]['id'])}>
          {temas.map((t) => (
            <MenuItemRadio key={t.id} value={t.id} onSelect={(e) => e.preventDefault()}>
              <span className="size-3 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
              {t.nombre}
            </MenuItemRadio>
          ))}
        </MenuGrupoRadio>
        <MenuSeparador />
        <MenuItem onSelect={(e) => (e.preventDefault(), alternarModo())}>
          {modo === 'oscuro' ? <Sun /> : <Moon />}
          {modo === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
        </MenuItem>
        <MenuItem onSelect={() => void salir()}>
          <LogOut />
          Salir
        </MenuItem>
      </MenuContenido>
    </MenuRaiz>
  )
}

export function EncabezadoPagina({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-titulo text-texto">{titulo}</h1>
        {descripcion ? <p className="mt-1 max-w-2xl text-sm text-texto-3">{descripcion}</p> : null}
      </div>
      {accion}
    </header>
  )
}
