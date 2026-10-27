import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaCrearNegocio } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Insignia, Selector, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@beely/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { zonasHorarias } from '../lib/formato'
import { llamarFuncion, mensajeDe } from '../lib/funciones'
import { supabase } from '../lib/supabase'
import { type Negocio, useNegocioStore } from '../stores/useNegocioStore'
import { useSesionStore } from '../stores/useSesionStore'

const planes = ['basico', 'pro', 'empresa'] as const
const estados = ['activo', 'suspendido', 'cancelado'] as const

export function PaginaPlataforma() {
  const sesion = useSesionStore((e) => e.sesion)
  const membresias = useNegocioStore((e) => e.membresias)
  const cargar = useNegocioStore((e) => e.cargar)
  const elegirNegocio = useNegocioStore((e) => e.elegirNegocio)
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null)
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaCrearNegocio),
    defaultValues: { slug: '', nombre: '', zona_horaria: 'America/Bogota' },
  })

  const recargar = async () => {
    if (sesion) await cargar(sesion.user.id, true)
  }

  const crear = handleSubmit(async ({ slug, nombre, zona_horaria }) => {
    setAviso(null)
    const { data, error } = await supabase.rpc('crear_negocio', { p_slug: slug, p_nombre: nombre, p_zona_horaria: zona_horaria })
    if (error) {
      setAviso({ tono: 'peligro', texto: mensajeDe(error) })
      return
    }
    reset()
    await recargar()
    await elegirNegocio(data)
    setAviso({ tono: 'exito', texto: `Negocio ${nombre} creado con su programa de sellos. Ahora crea sus sedes e invita al dueño.` })
  })

  return (
    <>
      <EncabezadoPagina titulo="Plataforma" descripcion="Alta de negocios, plan y estado. Solo administradores de Beely." />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo className="text-base">Nuevo negocio</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido>
            <form className="grid gap-4 sm:grid-cols-3" onSubmit={crear} noValidate>
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
              <Boton type="submit" className="sm:justify-self-start" disabled={formState.isSubmitting}>
                Crear negocio
              </Boton>
            </form>
          </TarjetaContenido>
        </Tarjeta>

        {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}

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
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const guardarPlan = async () => {
    setOcupado(true)
    setAviso(null)
    const { error } = await supabase.rpc('plataforma_actualizar_negocio', { p_negocio_id: negocio.id, p_plan: plan, p_estado: estado })
    setOcupado(false)
    if (error) setAviso({ tono: 'peligro', texto: mensajeDe(error) })
    else {
      setAviso({ tono: 'exito', texto: 'Plan y estado guardados.' })
      await onCambio()
    }
  }

  const invitarDueno = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setOcupado(true)
    setAviso(null)
    try {
      await llamarFuncion('panel-equipo', { negocio_id: negocio.id, email: emailDueno, rol: 'dueno' })
      setAviso({ tono: 'exito', texto: `${emailDueno} es ahora dueño de ${negocio.nombre}.` })
      setEmailDueno('')
    } catch (e) {
      setAviso({ tono: 'peligro', texto: mensajeDe(e) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TarjetaTitulo className="text-base">{negocio.nombre}</TarjetaTitulo>
          <span className="flex items-center gap-2 font-mono text-xs text-colmena-500">
            {negocio.slug}
            <Insignia tono={negocio.estado === 'activo' ? 'exito' : 'peligro'}>{negocio.estado}</Insignia>
          </span>
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
          <Boton variante="contorno" onClick={() => void guardarPlan()} disabled={ocupado || (plan === negocio.plan && estado === negocio.estado)}>
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
          <Boton type="submit" variante="contorno" disabled={ocupado || !emailDueno}>
            Invitar dueño
          </Boton>
        </form>
        {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
      </TarjetaContenido>
    </Tarjeta>
  )
}
