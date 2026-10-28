import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaCambiarClave, mensajeDeError } from '@beely/tipos'
import { Aviso, Boton, Campo, Dialogo, EntradaClave, toast } from '@beely/ui'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { useSesionStore } from '../stores/useSesionStore'

// Cambiar la propia clave desde el menú de la cuenta (dueño, administrador, cajero o superadmin).
// Se confirma la clave actual volviendo a ingresar antes de guardar la nueva.
export function DialogoClave({ abierto, onAbiertoCambia }: { abierto: boolean; onAbiertoCambia: (abierto: boolean) => void }) {
  const email = useSesionStore((e) => e.sesion?.user.email ?? '')
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(esquemaCambiarClave),
    defaultValues: { actual: '', clave: '', confirmacion: '' },
  })

  useEffect(() => {
    if (!abierto) {
      reset()
      setError(null)
    }
  }, [abierto, reset])

  const guardar = handleSubmit(async ({ actual, clave }) => {
    setError(null)
    const { error: errorActual } = await supabase.auth.signInWithPassword({ email, password: actual })
    if (errorActual) {
      setError(mensajeDeError('clave_actual_incorrecta'))
      return
    }
    const { error } = await supabase.auth.updateUser({ password: clave })
    if (error) {
      setError('No pudimos guardar la clave nueva. Intenta de nuevo.')
      return
    }
    toast.success('Contraseña actualizada', { description: 'Úsala la próxima vez que ingreses.' })
    onAbiertoCambia(false)
  })

  return (
    <Dialogo abierto={abierto} onAbiertoCambia={onAbiertoCambia} titulo="Cambiar contraseña" descripcion={email}>
      <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
        {/* Campo oculto con el correo para que el gestor de contraseñas sepa de qué cuenta es. */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <Campo id="clave-actual" etiqueta="Contraseña actual" error={formState.errors.actual?.message}>
          <EntradaClave id="clave-actual" autoComplete="current-password" autoFocus {...register('actual')} />
        </Campo>
        <Campo id="clave-nueva" etiqueta="Contraseña nueva" error={formState.errors.clave?.message}>
          <EntradaClave id="clave-nueva" autoComplete="new-password" {...register('clave')} />
        </Campo>
        <Campo id="clave-confirmacion" etiqueta="Repite la contraseña nueva" error={formState.errors.confirmacion?.message}>
          <EntradaClave id="clave-confirmacion" autoComplete="new-password" {...register('confirmacion')} />
        </Campo>
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="contorno" onClick={() => onAbiertoCambia(false)}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={formState.isSubmitting}>
            Guardar
          </Boton>
        </div>
      </form>
    </Dialogo>
  )
}
