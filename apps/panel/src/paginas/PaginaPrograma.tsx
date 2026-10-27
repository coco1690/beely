import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaPrograma, type reglasSello, type Tabla } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Selector, Tarjeta, TarjetaContenido, toast } from '@beely/ui'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Cargando } from '../componentes/Cargando'
import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { mensajeDe } from '../lib/funciones'
import { supabase } from '../lib/supabase'
import { puedeConfigurar, useNegocioActivo } from '../stores/useNegocioStore'

const numeroONulo = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))

const textosRegla = {
  por_venta: 'Un sello por compra (opcional: desde un monto mínimo)',
  por_unidad: 'Un sello por cada unidad comprada',
  por_monto: 'Un sello por cada X pesos de la compra',
} as const

export function PaginaPrograma() {
  const activo = useNegocioActivo()
  const editable = puedeConfigurar(activo?.rol)
  const [programa, setPrograma] = useState<Tabla<'programas'> | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset, watch, formState } = useForm({ resolver: zodResolver(esquemaPrograma) })
  const regla = watch('regla_sello')
  const negocioId = activo?.negocio.id

  useEffect(() => {
    if (!negocioId) return
    setPrograma(undefined)
    void supabase
      .from('programas')
      .select('*')
      .eq('negocio_id', negocioId)
      .eq('activo', true)
      .maybeSingle()
      .then(({ data }) => {
        setPrograma(data)
        if (data) {
          reset({
            nombre: data.nombre,
            sellos_requeridos: data.sellos_requeridos,
            regla_sello: data.regla_sello as (typeof reglasSello)[number],
            monto_minimo: data.monto_minimo,
            monto_por_sello: data.monto_por_sello,
            max_sellos_dia: data.max_sellos_dia,
            premio_descripcion: data.premio_descripcion,
            premio_vigencia_dias: data.premio_vigencia_dias,
          })
        }
      })
  }, [negocioId, reset])

  if (programa === undefined) return <Cargando />

  const guardar = handleSubmit(async (valores) => {
    if (!programa) return
    setError(null)
    const { error } = await supabase
      .from('programas')
      .update({
        ...valores,
        monto_minimo: valores.regla_sello === 'por_venta' ? valores.monto_minimo : null,
        monto_por_sello: valores.regla_sello === 'por_monto' ? valores.monto_por_sello : null,
      })
      .eq('id', programa.id)
    if (error) setError(mensajeDe(error))
    else toast.success('Programa guardado')
  })

  return (
    <>
      <EncabezadoPagina titulo="Programa de sellos" descripcion="Cuántos sellos se necesitan, cómo se ganan y cuál es el premio." />
      {!programa ? (
        <Aviso tono="peligro">Este negocio no tiene un programa activo. Pide a soporte de Beely que lo active.</Aviso>
      ) : (
        <Tarjeta>
          <TarjetaContenido sinEncabezado>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={guardar} noValidate>
              <fieldset disabled={!editable} className="contents">
                <Campo id="nombre" etiqueta="Nombre del programa" error={formState.errors.nombre?.message} className="sm:col-span-2">
                  <Entrada id="nombre" {...register('nombre')} />
                </Campo>
                <Campo id="sellos_requeridos" etiqueta="Sellos para el premio" error={formState.errors.sellos_requeridos?.message}>
                  <Entrada id="sellos_requeridos" type="number" min={2} max={30} {...register('sellos_requeridos', { valueAsNumber: true })} />
                </Campo>
                <Campo
                  id="max_sellos_dia"
                  etiqueta="Máximo de sellos por día"
                  ayuda="Por cliente, en la zona horaria del negocio."
                  error={formState.errors.max_sellos_dia?.message}
                >
                  <Entrada id="max_sellos_dia" type="number" min={1} max={50} {...register('max_sellos_dia', { valueAsNumber: true })} />
                </Campo>
                <Campo id="regla_sello" etiqueta="Regla para ganar sellos" className="sm:col-span-2">
                  <Selector id="regla_sello" {...register('regla_sello')}>
                    {Object.entries(textosRegla).map(([valor, texto]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                {regla === 'por_venta' ? (
                  <Campo id="monto_minimo" etiqueta="Monto mínimo de compra (opcional)" error={formState.errors.monto_minimo?.message}>
                    <Entrada id="monto_minimo" type="number" min={0} step="100" {...register('monto_minimo', { setValueAs: numeroONulo })} />
                  </Campo>
                ) : null}
                {regla === 'por_monto' ? (
                  <Campo id="monto_por_sello" etiqueta="Pesos por cada sello" error={formState.errors.monto_por_sello?.message}>
                    <Entrada id="monto_por_sello" type="number" min={0} step="100" {...register('monto_por_sello', { setValueAs: numeroONulo })} />
                  </Campo>
                ) : null}
                <Campo id="premio_descripcion" etiqueta="Premio" error={formState.errors.premio_descripcion?.message} className="sm:col-span-2">
                  <Entrada id="premio_descripcion" placeholder="1 helado gratis" {...register('premio_descripcion')} />
                </Campo>
                <Campo
                  id="premio_vigencia_dias"
                  etiqueta="Días para canjear el premio"
                  error={formState.errors.premio_vigencia_dias?.message}
                >
                  <Entrada id="premio_vigencia_dias" type="number" min={1} max={365} {...register('premio_vigencia_dias', { valueAsNumber: true })} />
                </Campo>
              </fieldset>
              {regla === 'por_unidad' ? (
                <Aviso className="sm:col-span-2">Desde la caja del panel se suma un sello por toque; las unidades llegan desde el POS.</Aviso>
              ) : null}
              {error ? <Aviso tono="peligro" className="sm:col-span-2">{error}</Aviso> : null}
              {editable ? (
                <Boton type="submit" className="sm:col-span-2 sm:justify-self-start" cargando={formState.isSubmitting}>
                  Guardar programa
                </Boton>
              ) : (
                <p className="text-etiqueta text-texto-3 sm:col-span-2">Solo el dueño o un administrador pueden cambiar el programa.</p>
              )}
            </form>
          </TarjetaContenido>
        </Tarjeta>
      )}
    </>
  )
}
