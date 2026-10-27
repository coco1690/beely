import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaSede } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Insignia, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@beely/ui'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { mensajeDe } from '../lib/funciones'
import { supabase } from '../lib/supabase'
import { puedeConfigurar, type Sede, useNegocioActivo, useNegocioStore } from '../stores/useNegocioStore'
import { useSesionStore } from '../stores/useSesionStore'

const numeroONulo = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))

export function PaginaSedes() {
  const activo = useNegocioActivo()
  const sedes = useNegocioStore((e) => e.sedes)
  const esAdminPlataforma = useSesionStore((e) => e.esAdminPlataforma)
  const [editando, setEditando] = useState<Sede | 'nueva' | null>(null)
  const editable = puedeConfigurar(activo?.rol)

  if (!activo) return null

  return (
    <>
      <EncabezadoPagina
        titulo="Sedes"
        descripcion="Puntos de venta del negocio. Las coordenadas se usan luego en Google y Apple Wallet."
        accion={
          esAdminPlataforma && editando === null ? (
            <Boton onClick={() => setEditando('nueva')}>
              <Plus className="size-4" /> Nueva sede
            </Boton>
          ) : null
        }
      />
      {!esAdminPlataforma && editable ? (
        <p className="mb-4 text-sm text-texto-3">Para abrir o cerrar sedes escribe a soporte de Beely; aquí puedes editar sus datos.</p>
      ) : null}

      <div className="flex flex-col gap-4">
        {editando === 'nueva' ? <FormularioSede negocioId={activo.negocio.id} onListo={() => setEditando(null)} /> : null}
        {sedes.length === 0 && editando === null ? <Aviso>Este negocio aún no tiene sedes.</Aviso> : null}
        {sedes.map((sede) =>
          editando !== null && editando !== 'nueva' && editando.id === sede.id ? (
            <FormularioSede key={sede.id} negocioId={activo.negocio.id} sede={sede} onListo={() => setEditando(null)} />
          ) : (
            <Tarjeta key={sede.id}>
              <TarjetaContenido className="flex flex-wrap items-center justify-between gap-3 pt-5">
                <div>
                  <p className="flex items-center gap-2 font-medium text-texto">
                    {sede.nombre}
                    {!sede.activa ? <Insignia tono="peligro">Inactiva</Insignia> : null}
                  </p>
                  <p className="text-sm text-texto-3">{sede.direccion ?? 'Sin dirección'}</p>
                  {sede.latitud !== null && sede.longitud !== null ? (
                    <p className="font-mono text-xs text-texto-3">
                      {sede.latitud}, {sede.longitud}
                    </p>
                  ) : null}
                </div>
                {editable && editando === null ? (
                  <Boton variante="contorno" tamano="sm" onClick={() => setEditando(sede)}>
                    Editar
                  </Boton>
                ) : null}
              </TarjetaContenido>
            </Tarjeta>
          ),
        )}
      </div>
    </>
  )
}

function FormularioSede({ negocioId, sede, onListo }: { negocioId: string; sede?: Sede; onListo: () => void }) {
  const recargarSedes = useNegocioStore((e) => e.recargarSedes)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaSede),
    defaultValues: {
      nombre: sede?.nombre ?? '',
      direccion: sede?.direccion ?? '',
      latitud: sede?.latitud ?? null,
      longitud: sede?.longitud ?? null,
      activa: sede?.activa ?? true,
    },
  })

  const guardar = handleSubmit(async (valores) => {
    setError(null)
    const { error } = sede
      ? await supabase.from('sedes').update(valores).eq('id', sede.id)
      : await supabase.from('sedes').insert({ ...valores, negocio_id: negocioId })
    if (error) {
      setError(mensajeDe(error))
      return
    }
    await recargarSedes()
    onListo()
  })

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo className="text-base">{sede ? `Editar ${sede.nombre}` : 'Nueva sede'}</TarjetaTitulo>
      </TarjetaEncabezado>
      <TarjetaContenido>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={guardar} noValidate>
          <Campo id="nombre" etiqueta="Nombre" error={formState.errors.nombre?.message}>
            <Entrada id="nombre" {...register('nombre')} />
          </Campo>
          <Campo id="direccion" etiqueta="Dirección" error={formState.errors.direccion?.message}>
            <Entrada id="direccion" {...register('direccion')} />
          </Campo>
          <Campo id="latitud" etiqueta="Latitud" error={formState.errors.latitud?.message}>
            <Entrada id="latitud" type="number" step="any" {...register('latitud', { setValueAs: numeroONulo })} />
          </Campo>
          <Campo id="longitud" etiqueta="Longitud" error={formState.errors.longitud?.message}>
            <Entrada id="longitud" type="number" step="any" {...register('longitud', { setValueAs: numeroONulo })} />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-texto-2 sm:col-span-2">
            <input type="checkbox" className="size-4 accent-acento" {...register('activa')} /> Sede activa (la caja puede elegirla)
          </label>
          {error ? <Aviso tono="peligro" className="sm:col-span-2">{error}</Aviso> : null}
          <div className="flex gap-2 sm:col-span-2">
            <Boton type="submit" disabled={formState.isSubmitting}>
              Guardar
            </Boton>
            <Boton variante="fantasma" onClick={onListo}>
              Cancelar
            </Boton>
          </div>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  )
}
