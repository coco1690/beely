import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaMarcaNegocio } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Insignia, Selector, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@beely/ui'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { zonasHorarias } from '../lib/formato'
import { mensajeDe } from '../lib/funciones'
import { supabase } from '../lib/supabase'
import { puedeConfigurar, useNegocioActivo, useNegocioStore } from '../stores/useNegocioStore'

const dominioClub = import.meta.env.VITE_CLUB_DOMINIO_BASE ?? 'hibeely.com'

export function PaginaNegocio() {
  const activo = useNegocioActivo()
  const recargarNegocio = useNegocioStore((e) => e.recargarNegocio)
  const [estado, setEstado] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null)
  const negocio = activo?.negocio
  const editable = puedeConfigurar(activo?.rol)

  const { register, handleSubmit, reset, formState } = useForm({ resolver: zodResolver(esquemaMarcaNegocio) })

  useEffect(() => {
    if (negocio) {
      reset({
        nombre: negocio.nombre,
        razon_social: negocio.razon_social ?? '',
        nit: negocio.nit ?? '',
        color_primario: negocio.color_primario,
        color_secundario: negocio.color_secundario,
        zona_horaria: negocio.zona_horaria,
      })
    }
  }, [negocio, reset])

  if (!negocio) return null

  const guardar = handleSubmit(async (valores) => {
    setEstado(null)
    const { error } = await supabase.from('negocios').update(valores).eq('id', negocio.id)
    if (error) setEstado({ tono: 'peligro', texto: mensajeDe(error) })
    else {
      setEstado({ tono: 'exito', texto: 'Cambios guardados.' })
      await recargarNegocio()
    }
  })

  return (
    <>
      <EncabezadoPagina titulo="Negocio" descripcion="Marca, datos legales y zona horaria." />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <TarjetaContenido className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-5 text-sm">
            <span>
              Club: <span className="font-mono">{negocio.slug}.{dominioClub}</span>
            </span>
            <span className="flex items-center gap-2">
              Plan <Insignia tono="miel">{negocio.plan}</Insignia>
            </span>
            <span className="flex items-center gap-2">
              Estado <Insignia tono={negocio.estado === 'activo' ? 'exito' : 'peligro'}>{negocio.estado}</Insignia>
            </span>
          </TarjetaContenido>
        </Tarjeta>

        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Datos del negocio</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={guardar} noValidate>
              <fieldset disabled={!editable} className="contents">
                <Campo id="nombre" etiqueta="Nombre comercial" error={formState.errors.nombre?.message} className="sm:col-span-2">
                  <Entrada id="nombre" {...register('nombre')} />
                </Campo>
                <Campo id="razon_social" etiqueta="Razón social" error={formState.errors.razon_social?.message}>
                  <Entrada id="razon_social" {...register('razon_social')} />
                </Campo>
                <Campo id="nit" etiqueta="NIT" error={formState.errors.nit?.message}>
                  <Entrada id="nit" {...register('nit')} />
                </Campo>
                <Campo id="color_primario" etiqueta="Color primario" error={formState.errors.color_primario?.message}>
                  <Entrada id="color_primario" type="color" className="p-1" {...register('color_primario')} />
                </Campo>
                <Campo id="color_secundario" etiqueta="Color secundario" error={formState.errors.color_secundario?.message}>
                  <Entrada id="color_secundario" type="color" className="p-1" {...register('color_secundario')} />
                </Campo>
                <Campo
                  id="zona_horaria"
                  etiqueta="Zona horaria"
                  ayuda="Define el día para el tope de sellos diarios."
                  error={formState.errors.zona_horaria?.message}
                  className="sm:col-span-2"
                >
                  <Selector id="zona_horaria" {...register('zona_horaria')}>
                    {zonasHorarias.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              </fieldset>
              {estado ? <Aviso tono={estado.tono} className="sm:col-span-2">{estado.texto}</Aviso> : null}
              {editable ? (
                <Boton type="submit" className="sm:col-span-2 sm:justify-self-start" disabled={formState.isSubmitting}>
                  Guardar cambios
                </Boton>
              ) : null}
            </form>
          </TarjetaContenido>
        </Tarjeta>
      </div>
    </>
  )
}
