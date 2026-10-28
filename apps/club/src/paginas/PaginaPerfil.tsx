import { mensajeDe } from '@beely/tipos/supabase'
import { Boton, BotonModo, Interruptor, toast, useConfirmar } from '@beely/ui'
import { LogOut, Share, SquarePlus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useInstalacion } from '../lib/instalacion'
import { activarPush, desactivarPush, pushDisponible } from '../lib/push'
import { clienteClub } from '../lib/supabase'
import { useClubStore } from '../stores/useClubStore'

function Fila({ titulo, descripcion, children }: { titulo: string; descripcion?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-texto">{titulo}</p>
        {descripcion ? <p className="mt-0.5 text-etiqueta text-texto-3">{descripcion}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function PaginaPerfil() {
  const tarjeta = useClubStore((e) => e.tarjeta)
  const negocio = useClubStore((e) => e.negocio)
  const slug = useClubStore((e) => e.slug)
  const token = useClubStore((e) => e.token)
  const cambiarMarketing = useClubStore((e) => e.cambiarMarketing)
  const salir = useClubStore((e) => e.salir)
  const confirmar = useConfirmar()
  const navegar = useNavigate()
  const { forma, instalar } = useInstalacion()
  const [guardando, setGuardando] = useState(false)
  if (!tarjeta || !negocio || !slug) return null
  const acepta = tarjeta.clientes?.acepta_marketing ?? false

  // Un solo interruptor para promociones y avisos: apagarlo es el opt-out en un toque.
  const alternarMensajes = async (activar: boolean) => {
    setGuardando(true)
    try {
      const cliente = clienteClub(slug, token)
      await cambiarMarketing(activar)
      if (activar && pushDisponible()) {
        const conPermiso = await activarPush(cliente, tarjeta).catch(() => false)
        if (!conPermiso) toast('Activaste las promociones', { description: 'Para recibir avisos en este teléfono, permite las notificaciones.' })
      }
      if (!activar) await desactivarPush(cliente).catch(() => undefined)
      if (activar === false) toast.success('Listo, no te enviaremos promociones')
    } catch (error) {
      toast.error(mensajeDe(error))
    } finally {
      setGuardando(false)
    }
  }

  const olvidar = async () => {
    const ok = await confirmar({
      titulo: '¿Quitar la tarjeta de este teléfono?',
      descripcion: 'Tus sellos no se pierden. Para volver a verla necesitas el enlace de tu tarjeta o pedirlo en caja.',
      textoConfirmar: 'Quitar',
      peligro: true,
    })
    if (!ok) return
    salir()
    navegar('/', { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-titulo text-texto">{tarjeta.clientes?.nombre}</h1>
        <p className="mt-1 text-sm text-texto-3">Club de {negocio.nombre}</p>
      </header>

      <section className="divide-y divide-borde rounded-tarjeta border border-borde bg-superficie shadow-tarjeta">
        <Fila
          titulo="Promociones y avisos"
          descripcion={
            pushDisponible() || acepta
              ? 'Ofertas, tu premio listo y tu regalo de cumpleaños. Máximo unas pocas por semana.'
              : 'Ofertas y tu premio listo.'
          }
        >
          <Interruptor activo={acepta} disabled={guardando} etiqueta="Promociones y avisos" onCambiar={(v) => void alternarMensajes(v)} />
        </Fila>
        <Fila titulo="Apariencia" descripcion="Modo claro u oscuro en este teléfono.">
          <div className="flex items-center">
            <BotonModo />
          </div>
        </Fila>
      </section>

      {forma === 'dialogo' || forma === 'ios' ? <Instalar forma={forma} instalar={instalar} /> : null}

      <Boton variante="fantasma" className="self-start text-texto-3" onClick={() => void olvidar()}>
        <LogOut />
        Quitar la tarjeta de este teléfono
      </Boton>
    </div>
  )
}

function Instalar({ forma, instalar }: { forma: 'dialogo' | 'ios'; instalar: () => Promise<void> }) {
  return (
    <section className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
      <p className="text-sm font-medium text-texto">Tenla a un toque</p>
      {forma === 'dialogo' ? (
        <>
          <p className="mt-0.5 text-etiqueta text-texto-3">Instala tu tarjeta como app en la pantalla de inicio.</p>
          <Boton className="mt-3 w-full" variante="contorno" onClick={() => void instalar()}>
            <SquarePlus />
            Instalar
          </Boton>
        </>
      ) : (
        <ol className="mt-2 flex flex-col gap-2 text-etiqueta text-texto-2">
          <li className="flex items-center gap-2">
            <span className="text-texto-3">1.</span> Toca <Share className="size-4 text-acento-texto" aria-label="Compartir" /> abajo en Safari.
          </li>
          <li className="flex items-center gap-2">
            <span className="text-texto-3">2.</span> Elige <span className="font-medium text-texto">Agregar a inicio</span>.
          </li>
        </ol>
      )}
    </section>
  )
}
