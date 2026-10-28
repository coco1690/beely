import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaAgregarSuperadmin, fechaHora } from '@beely/tipos'
import {
  Aviso,
  Boton,
  Campo,
  Entrada,
  Esqueleto,
  FilaLista,
  Insignia,
  Lista,
  Tarjeta,
  TarjetaContenido,
  TarjetaEncabezado,
  TarjetaTitulo,
  toast,
  useConfirmar,
} from '@beely/ui'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { EncabezadoPagina } from '../../componentes/DisenoPanel'
import { mensajeDe } from '../../lib/funciones'
import { supabase } from '../../lib/supabase'
import { useSesionStore } from '../../stores/useSesionStore'

type Superadmin = { usuario_id: string; email: string; creado_en: string; ultimo_ingreso_en: string | null }

export function PaginaSuperadmins() {
  const usuarioId = useSesionStore((e) => e.sesion?.user.id)
  const [lista, setLista] = useState<Superadmin[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirmar = useConfirmar()
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaAgregarSuperadmin),
    defaultValues: { email: '' },
  })

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('superadmin_equipo', {})
    if (error) setError(mensajeDe(error))
    setLista(data ?? [])
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const agregar = handleSubmit(async ({ email }) => {
    setError(null)
    const { error } = await supabase.rpc('superadmin_agregar', { p_email: email })
    if (error) {
      setError(mensajeDe(error))
      return
    }
    toast.success(`${email} ahora es superadmin`)
    reset({ email: '' })
    await cargar()
  })

  const quitar = async (s: Superadmin) => {
    const seguro = await confirmar({
      titulo: '¿Quitar superadmin?',
      descripcion: `${s.email} dejará de ver el panel de plataforma. Si es parte de algún negocio, conserva ese acceso.`,
      textoConfirmar: 'Quitar',
      peligro: true,
    })
    if (!seguro) return
    setError(null)
    const { error } = await supabase.rpc('superadmin_quitar', { p_usuario_id: s.usuario_id })
    if (error) setError(mensajeDe(error))
    else toast.success(`${s.email} ya no es superadmin`)
    await cargar()
  }

  return (
    <>
      <EncabezadoPagina titulo="Superadmins" descripcion="Quién administra Beely. Tienen control total sobre todos los negocios." />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>Agregar superadmin</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" onSubmit={agregar} noValidate>
              <Campo
                id="email"
                etiqueta="Correo"
                ayuda="Debe tener cuenta en Beely (haber ingresado alguna vez o tener una invitación)."
                error={formState.errors.email?.message}
              >
                <Entrada id="email" type="email" autoComplete="off" placeholder="nombre@hibeely.com" {...register('email')} />
              </Campo>
              <Boton type="submit" className="sm:mt-6" cargando={formState.isSubmitting}>
                Agregar
              </Boton>
            </form>
          </TarjetaContenido>
        </Tarjeta>

        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        <Tarjeta>
          {lista === null ? (
            <Lista aria-busy>
              {[0, 1].map((n) => (
                <FilaLista key={n}>
                  <Esqueleto className="h-9 w-56" />
                </FilaLista>
              ))}
            </Lista>
          ) : (
            <Lista>
              {lista.map((s) => (
                <FilaLista key={s.usuario_id}>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="flex min-w-0 items-center gap-2 font-medium text-texto">
                      <span className="min-w-0 truncate" title={s.email}>
                        {s.email}
                      </span>
                      {s.usuario_id === usuarioId ? <Insignia tono="miel">Tú</Insignia> : null}
                    </p>
                    <p className="text-xs text-texto-3 tabular-nums">Último ingreso: {fechaHora(s.ultimo_ingreso_en)}</p>
                  </div>
                  {s.usuario_id === usuarioId ? null : (
                    <Boton variante="fantasma" tamano="sm" onClick={() => void quitar(s)}>
                      Quitar
                    </Boton>
                  )}
                </FilaLista>
              ))}
            </Lista>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
