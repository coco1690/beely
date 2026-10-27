import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaMarcaNegocio } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Insignia, Selector, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo, toast } from '@beely/ui'
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
  const [error, setError] = useState<string | null>(null)
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
    setError(null)
    const { error } = await supabase.from('negocios').update(valores).eq('id', negocio.id)
    if (error) setError(mensajeDe(error))
    else {
      toast.success('Cambios guardados')
      await recargarNegocio()
    }
  })

  return (
    <>
      <EncabezadoPagina titulo="Negocio" descripcion="Marca, datos legales y zona horaria." />
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-tarjeta border border-borde bg-borde sm:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div className="flex min-w-0 flex-col gap-1 bg-superficie px-4 py-3">
            <dt className="text-xs text-texto-3">Club</dt>
            <dd className="truncate font-mono text-etiqueta text-texto" title={`${negocio.slug}.${dominioClub}`}>
              {negocio.slug}.{dominioClub}
            </dd>
          </div>
          <div className="flex flex-col items-start gap-1 bg-superficie px-4 py-3">
            <dt className="text-xs text-texto-3">Plan</dt>
            <dd>
              <Insignia tono="miel">{negocio.plan}</Insignia>
            </dd>
          </div>
          <div className="flex flex-col items-start gap-1 bg-superficie px-4 py-3">
            <dt className="text-xs text-texto-3">Estado</dt>
            <dd>
              <Insignia tono={negocio.estado === 'activo' ? 'exito' : 'peligro'}>{negocio.estado}</Insignia>
            </dd>
          </div>
        </dl>

        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Datos del negocio</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={guardar} noValidate>
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
                  <Entrada id="color_primario" type="color" className="cursor-pointer p-1" {...register('color_primario')} />
                </Campo>
                <Campo id="color_secundario" etiqueta="Color secundario" error={formState.errors.color_secundario?.message}>
                  <Entrada id="color_secundario" type="color" className="cursor-pointer p-1" {...register('color_secundario')} />
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
              {error ? <Aviso tono="peligro" className="sm:col-span-2">{error}</Aviso> : null}
              {editable ? (
                <Boton type="submit" className="sm:col-span-2 sm:justify-self-start" cargando={formState.isSubmitting}>
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
