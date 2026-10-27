import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaInvitarMiembro, type RolEquipo } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Insignia, Selector, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@beely/ui'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Cargando } from '../componentes/Cargando'
import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { fechaHora, nombresRol } from '../lib/formato'
import { llamarFuncion, mensajeDe } from '../lib/funciones'
import { supabase } from '../lib/supabase'
import { puedeGestionarEquipo, useNegocioActivo } from '../stores/useNegocioStore'
import { useSesionStore } from '../stores/useSesionStore'

type Integrante = {
  usuario_id: string
  email: string
  rol: string
  creado_en: string
  ultimo_ingreso_en: string | null
  invitacion_pendiente: boolean
}

const esquemaFormulario = esquemaInvitarMiembro.omit({ negocio_id: true })

export function PaginaEquipo() {
  const activo = useNegocioActivo()
  const usuarioId = useSesionStore((e) => e.sesion?.user.id)
  const esPlataforma = activo?.rol === 'plataforma'
  const gestiona = puedeGestionarEquipo(activo?.rol)
  const negocioId = activo?.negocio.id
  const [equipo, setEquipo] = useState<Integrante[] | null>(null)
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null)
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: { email: '', rol: 'cajero' as RolEquipo },
  })

  const cargar = useCallback(async () => {
    if (!negocioId) return
    const { data, error } = await supabase.rpc('equipo_negocio', { p_negocio_id: negocioId })
    if (error) setAviso({ tono: 'peligro', texto: mensajeDe(error) })
    setEquipo(data ?? [])
  }, [negocioId])

  useEffect(() => {
    setEquipo(null)
    void cargar()
  }, [cargar])

  const invitar = handleSubmit(async ({ email, rol }) => {
    if (!negocioId) return
    setAviso(null)
    try {
      const r = await llamarFuncion<{ invitado: boolean }>('panel-equipo', { negocio_id: negocioId, email, rol })
      setAviso({
        tono: 'exito',
        texto: r.invitado
          ? `Enviamos la invitación a ${email}. Debe abrir el correo para definir su clave.`
          : `${email} ya tenía cuenta en Beely; ahora también es parte de este negocio.`,
      })
      reset({ email: '', rol })
      await cargar()
    } catch (e) {
      setAviso({ tono: 'peligro', texto: mensajeDe(e) })
    }
  })

  const cambiarRol = async (integrante: Integrante, rol: string) => {
    if (!negocioId) return
    const { error } = await supabase
      .from('miembros_negocio')
      .update({ rol })
      .eq('negocio_id', negocioId)
      .eq('usuario_id', integrante.usuario_id)
    if (error) setAviso({ tono: 'peligro', texto: mensajeDe(error) })
    await cargar()
  }

  const quitar = async (integrante: Integrante) => {
    if (!negocioId || !window.confirm(`¿Quitar a ${integrante.email} del equipo?`)) return
    const { error } = await supabase
      .from('miembros_negocio')
      .delete()
      .eq('negocio_id', negocioId)
      .eq('usuario_id', integrante.usuario_id)
    if (error) setAviso({ tono: 'peligro', texto: mensajeDe(error) })
    await cargar()
  }

  // El dueño gestiona administradores y cajeros; la plataforma, a todos.
  const puedeEditar = (i: Integrante) => gestiona && i.usuario_id !== usuarioId && (esPlataforma || i.rol !== 'dueno')
  const rolesAsignables: RolEquipo[] = esPlataforma ? ['dueno', 'administrador', 'cajero'] : ['administrador', 'cajero']

  return (
    <>
      <EncabezadoPagina titulo="Equipo" descripcion="Quién entra al panel de este negocio y con qué rol." />
      <div className="flex flex-col gap-6">
        {gestiona ? (
          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo className="text-base">Invitar a alguien</TarjetaTitulo>
            </TarjetaEncabezado>
            <TarjetaContenido>
              <form className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end" onSubmit={invitar} noValidate>
                <Campo id="email" etiqueta="Correo" error={formState.errors.email?.message}>
                  <Entrada id="email" type="email" {...register('email')} />
                </Campo>
                <Campo id="rol" etiqueta="Rol">
                  <Selector id="rol" {...register('rol')}>
                    {rolesAsignables.map((r) => (
                      <option key={r} value={r}>
                        {nombresRol[r]}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Boton type="submit" disabled={formState.isSubmitting}>
                  Invitar
                </Boton>
              </form>
              <p className="mt-3 text-xs text-texto-3">
                Cajero: escanea y suma sellos. Administrador: además configura negocio, sedes y programa. Solo el dueño gestiona el
                equipo.
              </p>
            </TarjetaContenido>
          </Tarjeta>
        ) : null}

        {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}

        {equipo === null ? (
          <Cargando />
        ) : (
          <Tarjeta>
            <ul className="divide-y divide-borde">
              {equipo.map((i) => (
                <li key={i.usuario_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium text-texto">
                      {i.email}
                      {i.invitacion_pendiente ? <Insignia>Invitación pendiente</Insignia> : null}
                    </p>
                    <p className="text-xs text-texto-3">Último ingreso: {fechaHora(i.ultimo_ingreso_en)}</p>
                  </div>
                  {puedeEditar(i) ? (
                    <div className="flex items-center gap-2">
                      <Selector
                        aria-label={`Rol de ${i.email}`}
                        className="w-40"
                        value={i.rol}
                        onChange={(e) => void cambiarRol(i, e.target.value)}
                      >
                        {rolesAsignables.map((r) => (
                          <option key={r} value={r}>
                            {nombresRol[r]}
                          </option>
                        ))}
                      </Selector>
                      <Boton variante="fantasma" tamano="sm" onClick={() => void quitar(i)}>
                        Quitar
                      </Boton>
                    </div>
                  ) : (
                    <Insignia tono={i.rol === 'dueno' ? 'miel' : 'neutro'}>{nombresRol[i.rol]}</Insignia>
                  )}
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    </>
  )
}
