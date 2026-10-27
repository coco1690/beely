import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaInvitarMiembro, type RolEquipo } from '@beely/tipos'
import {
  Aviso,
  Boton,
  Campo,
  Entrada,
  Esqueleto,
  FilaLista,
  Insignia,
  Lista,
  Selector,
  Tarjeta,
  TarjetaContenido,
  TarjetaEncabezado,
  TarjetaTitulo,
  toast,
  useConfirmar,
} from '@beely/ui'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
  const esSuperadmin = activo?.rol === 'superadmin'
  const gestiona = puedeGestionarEquipo(activo?.rol)
  const negocioId = activo?.negocio.id
  const [equipo, setEquipo] = useState<Integrante[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirmar = useConfirmar()
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: { email: '', rol: 'cajero' as RolEquipo },
  })

  const cargar = useCallback(async () => {
    if (!negocioId) return
    const { data, error } = await supabase.rpc('equipo_negocio', { p_negocio_id: negocioId })
    if (error) setError(mensajeDe(error))
    setEquipo(data ?? [])
  }, [negocioId])

  useEffect(() => {
    setEquipo(null)
    void cargar()
  }, [cargar])

  const invitar = handleSubmit(async ({ email, rol }) => {
    if (!negocioId) return
    setError(null)
    try {
      const r = await llamarFuncion<{ invitado: boolean }>('panel-equipo', { negocio_id: negocioId, email, rol })
      if (r.invitado) toast.success(`Invitación enviada a ${email}`, { description: 'Debe abrir el correo para definir su clave.' })
      else toast.success(`${email} ya es parte del negocio`, { description: 'Ya tenía cuenta en Beely.' })
      reset({ email: '', rol })
      await cargar()
    } catch (e) {
      setError(mensajeDe(e))
    }
  })

  const cambiarRol = async (integrante: Integrante, rol: string) => {
    if (!negocioId) return
    const { error } = await supabase
      .from('miembros_negocio')
      .update({ rol })
      .eq('negocio_id', negocioId)
      .eq('usuario_id', integrante.usuario_id)
    if (error) setError(mensajeDe(error))
    await cargar()
  }

  const quitar = async (integrante: Integrante) => {
    if (!negocioId) return
    const seguro = await confirmar({
      titulo: '¿Quitar del equipo?',
      descripcion: `${integrante.email} ya no podrá entrar al panel de este negocio.`,
      textoConfirmar: 'Quitar',
      peligro: true,
    })
    if (!seguro) return
    const { error } = await supabase
      .from('miembros_negocio')
      .delete()
      .eq('negocio_id', negocioId)
      .eq('usuario_id', integrante.usuario_id)
    if (error) setError(mensajeDe(error))
    await cargar()
  }

  // El dueño gestiona administradores y cajeros; el superadmin, a todos.
  const puedeEditar = (i: Integrante) => gestiona && i.usuario_id !== usuarioId && (esSuperadmin || i.rol !== 'dueno')
  const rolesAsignables: RolEquipo[] = esSuperadmin ? ['dueno', 'administrador', 'cajero'] : ['administrador', 'cajero']

  return (
    <>
      <EncabezadoPagina titulo="Equipo" descripcion="Quién entra al panel de este negocio y con qué rol." />
      <div className="flex flex-col gap-6">
        {gestiona ? (
          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo>Invitar a alguien</TarjetaTitulo>
            </TarjetaEncabezado>
            <TarjetaContenido>
              <form className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-start" onSubmit={invitar} noValidate>
                <Campo id="email" etiqueta="Correo" error={formState.errors.email?.message}>
                  <Entrada id="email" type="email" autoComplete="off" placeholder="nombre@negocio.com" {...register('email')} />
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
                <Boton type="submit" className="sm:mt-6" cargando={formState.isSubmitting}>
                  Invitar
                </Boton>
              </form>
              <p className="mt-3 text-etiqueta text-texto-3">
                Cajero: escanea y suma sellos. Administrador: además configura negocio, sedes y programa. Solo el dueño gestiona el
                equipo.
              </p>
            </TarjetaContenido>
          </Tarjeta>
        ) : null}

        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        {equipo === null ? (
          <Tarjeta aria-busy>
            <Lista>
              {[0, 1].map((n) => (
                <FilaLista key={n}>
                  <div className="flex flex-col gap-2">
                    <Esqueleto className="h-4 w-48" />
                    <Esqueleto className="h-3 w-32" />
                  </div>
                  <Esqueleto className="h-8 w-36" />
                </FilaLista>
              ))}
            </Lista>
          </Tarjeta>
        ) : (
          <Tarjeta>
            <Lista>
              {equipo.map((i) => (
                <FilaLista key={i.usuario_id}>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium text-texto">
                      <span className="min-w-0 truncate" title={i.email}>
                        {i.email}
                      </span>
                      {i.invitacion_pendiente ? <Insignia>Invitación pendiente</Insignia> : null}
                    </p>
                    <p className="text-xs text-texto-3 tabular-nums">Último ingreso: {fechaHora(i.ultimo_ingreso_en)}</p>
                  </div>
                  {puedeEditar(i) ? (
                    <div className="flex items-center gap-1">
                      <Selector
                        aria-label={`Rol de ${i.email}`}
                        className="w-36"
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
                </FilaLista>
              ))}
            </Lista>
          </Tarjeta>
        )}
      </div>
    </>
  )
}
