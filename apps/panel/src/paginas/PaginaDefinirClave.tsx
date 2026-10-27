import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaNuevaClave } from '@beely/tipos'
import { Aviso, Boton, Campo, Cargando, EntradaClave } from '@beely/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useSesionStore } from '../stores/useSesionStore'
import { claseEnlace, PantallaAcceso } from './PaginaIngreso'

// Destino de la invitación al equipo y del enlace de recuperar clave:
// supabase-js toma la sesión del enlace y aquí se fija la clave.
export function PaginaDefinirClave() {
  const navegar = useNavigate()
  const sesion = useSesionStore((e) => e.sesion)
  const cargando = useSesionStore((e) => e.cargando)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(esquemaNuevaClave) })

  const guardar = handleSubmit(async ({ clave }) => {
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: clave })
    if (error) {
      setError('No pudimos guardar la clave. Pide un enlace nuevo.')
      return
    }
    void navegar('/', { replace: true })
  })

  if (cargando) return <Cargando />

  return (
    <PantallaAcceso titulo="Define tu clave">
      {!sesion ? (
        <div className="flex flex-col gap-4">
          <Aviso tono="peligro">El enlace venció o ya se usó. Pide uno nuevo.</Aviso>
          <Link to="/recuperar" className={claseEnlace}>
            Pedir enlace nuevo
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
          <p className="truncate text-sm text-texto-3">{sesion.user.email}</p>
          <Campo id="clave" etiqueta="Clave nueva" error={formState.errors.clave?.message}>
            <EntradaClave id="clave" autoComplete="new-password" {...register('clave')} />
          </Campo>
          <Campo id="confirmacion" etiqueta="Repite la clave" error={formState.errors.confirmacion?.message}>
            <EntradaClave id="confirmacion" autoComplete="new-password" {...register('confirmacion')} />
          </Campo>
          {error ? <Aviso tono="peligro">{error}</Aviso> : null}
          <Boton type="submit" cargando={formState.isSubmitting}>
            Guardar clave
          </Boton>
        </form>
      )}
    </PantallaAcceso>
  )
}
