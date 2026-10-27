import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaIngreso } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada } from '@beely/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { PantallaAcceso } from './PaginaIngreso'

const esquemaRecuperar = esquemaIngreso.pick({ email: true })

export function PaginaRecuperar() {
  const [enviado, setEnviado] = useState(false)
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(esquemaRecuperar) })

  const enviar = handleSubmit(async ({ email }) => {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/definir-clave` })
    // Siempre el mismo mensaje: no revela si el correo tiene cuenta.
    setEnviado(true)
  })

  return (
    <PantallaAcceso titulo="Recuperar clave">
      {enviado ? (
        <div className="flex flex-col gap-4">
          <Aviso tono="exito">Si el correo es del equipo, te llegó un enlace para definir una clave nueva.</Aviso>
          <Link to="/ingresar" className="text-center text-sm text-texto-3 hover:text-texto">
            Volver a ingresar
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          <Campo id="email" etiqueta="Correo" error={formState.errors.email?.message}>
            <Entrada id="email" type="email" autoComplete="username" {...register('email')} />
          </Campo>
          <Boton type="submit" disabled={formState.isSubmitting}>
            Enviar enlace
          </Boton>
          <Link to="/ingresar" className="text-center text-sm text-texto-3 hover:text-texto">
            Volver a ingresar
          </Link>
        </form>
      )}
    </PantallaAcceso>
  )
}
