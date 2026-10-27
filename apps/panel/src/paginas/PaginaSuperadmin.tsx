import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaCrearNegocio } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Insignia, Selector, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo, toast } from '@beely/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { zonasHorarias } from '@beely/tipos'
import { llamarFuncion, mensajeDe } from '../lib/funciones'
import { supabase } from '../lib/supabase'
import { type Negocio, useNegocioStore } from '../stores/useNegocioStore'
import { useSesionStore } from '../stores/useSesionStore'

const planes = ['basico', 'pro', 'empresa'] as const
const estados = ['activo', 'suspendido', 'cancelado'] as const

export function PaginaSuperadmin() {
  const sesion = useSesionStore((e) => e.sesion)
  const membresias = useNegocioStore((e) => e.membresias)
  const cargar = useNegocioStore((e) => e.cargar)
  const elegirNegocio = useNegocioStore((e) => e.elegirNegocio)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaCrearNegocio),
    defaultValues: { slug: '', nombre: '', zona_horaria: 'America/Bogota' },
  })

  const recargar = async () => {
    if (sesion) await cargar(sesion.user.id, true)
  }

  const crear = handleSubmit(async ({ slug, nombre, zona_horaria }) => {
    setError(null)
    const { data, error } = await supabase.rpc('crear_negocio', { p_slug: slug, p_nombre: nombre, p_zona_horaria: zona_horaria })
    if (error) {
      setError(mensajeDe(error))
      return
    }
    reset()
    await recargar()
    await elegirNegocio(data)
    toast.success(`Negocio ${nombre} creado`, { description: 'Ya tiene su programa de sellos. Ahora crea sus sedes e invita al dueño.' })
  })

  return (
    <>
      <EncabezadoPagina titulo="Superadmin" descripcion="Alta de negocios, plan y estado. Solo superadmins de Beely." />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Nuevo negocio</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start" onSubmit={crear} noValidate>
              <Campo id="nombre" etiqueta="Nombre" error={formState.errors.nombre?.message}>
                <Entrada id="nombre" {...register('nombre')} />
              </Campo>
              <Campo id="slug" etiqueta="Subdominio" ayuda="{slug}.hibeely.com; no se puede cambiar." error={formState.errors.slug?.message}>
                <Entrada id="slug" placeholder="heladeria-luna" {...register('slug')} />
              </Campo>
              <Campo id="zona_horaria" etiqueta="Zona horaria">
                <Selector id="zona_horaria" {...register('zona_horaria')}>
                  {zonasHorarias.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Boton type="submit" className="sm:justify-self-start" cargando={formState.isSubmitting}>
                Crear negocio
              </Boton>
            </form>
          </TarjetaContenido>
        </Tarjeta>

        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        {membresias.map(({ negocio }) => (
          <FilaNegocio key={negocio.id} negocio={negocio} onCambio={recargar} />
        ))}
      </div>
    </>
  )
}

function FilaNegocio({ negocio, onCambio }: { negocio: Negocio; onCambio: () => Promise<void> }) {
  const [plan, setPlan] = useState(negocio.plan)
  const [estado, setEstado] = useState(negocio.estado)
  const [emailDueno, setEmailDueno] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<'plan' | 'dueno' | null>(null)

  const guardarPlan = async () => {
    setOcupado('plan')
    setError(null)
    const { error } = await supabase.rpc('superadmin_actualizar_negocio', { p_negocio_id: negocio.id, p_plan: plan, p_estado: estado })
    setOcupado(null)
    if (error) setError(mensajeDe(error))
    else {
      toast.success(`Plan y estado de ${negocio.nombre} guardados`)
      await onCambio()
    }
  }

  const invitarDueno = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setOcupado('dueno')
    setError(null)
    try {
      await llamarFuncion('panel-equipo', { negocio_id: negocio.id, email: emailDueno, rol: 'dueno' })
      toast.success(`${emailDueno} es ahora dueño de ${negocio.nombre}`)
      setEmailDueno('')
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <TarjetaTitulo className="line-clamp-2 break-words">{negocio.nombre}</TarjetaTitulo>
            <p className="truncate font-mono text-xs text-texto-3">{negocio.slug}</p>
          </div>
          <Insignia tono={negocio.estado === 'activo' ? 'exito' : 'peligro'}>{negocio.estado}</Insignia>
        </div>
      </TarjetaEncabezado>
      <TarjetaContenido className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <Campo id={`plan-${negocio.id}`} etiqueta="Plan">
            <Selector id={`plan-${negocio.id}`} value={plan} onChange={(e) => setPlan(e.target.value)} className="w-36">
              {planes.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Selector>
          </Campo>
          <Campo id={`estado-${negocio.id}`} etiqueta="Estado">
            <Selector id={`estado-${negocio.id}`} value={estado} onChange={(e) => setEstado(e.target.value)} className="w-36">
              {estados.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </Selector>
          </Campo>
          <Boton
            variante="contorno"
            onClick={() => void guardarPlan()}
            cargando={ocupado === 'plan'}
            disabled={ocupado !== null || (plan === negocio.plan && estado === negocio.estado)}
          >
            Guardar
          </Boton>
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void invitarDueno(e)}>
          <Campo id={`dueno-${negocio.id}`} etiqueta="Agregar dueño" className="min-w-60 flex-1">
            <Entrada
              id={`dueno-${negocio.id}`}
              type="email"
              placeholder="correo@negocio.com"
              value={emailDueno}
              onChange={(e) => setEmailDueno(e.target.value)}
            />
          </Campo>
          <Boton type="submit" variante="contorno" cargando={ocupado === 'dueno'} disabled={ocupado !== null || !emailDueno}>
            Invitar dueño
          </Boton>
        </form>
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      </TarjetaContenido>
    </Tarjeta>
  )
}
