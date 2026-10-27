import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaIngreso } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@beely/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Marca } from '../componentes/Marca'
import { supabase } from '../lib/supabase'

export function PantallaAcceso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-colmena-50 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Marca subtitulo="Panel del negocio" />
        <Tarjeta>
          <TarjetaEncabezado>
            <TarjetaTitulo>{titulo}</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido>{children}</TarjetaContenido>
        </Tarjeta>
      </div>
    </main>
  )
}

export function PaginaIngreso() {
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(esquemaIngreso) })

  const ingresar = handleSubmit(async ({ email, clave }) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
    // Mensaje genérico: no revela si el correo existe.
    if (error) setError('Correo o clave incorrectos.')
  })

  return (
    <PantallaAcceso titulo="Ingresar">
      <form className="flex flex-col gap-4" onSubmit={ingresar} noValidate>
        <Campo id="email" etiqueta="Correo" error={formState.errors.email?.message}>
          <Entrada id="email" type="email" autoComplete="username" {...register('email')} />
        </Campo>
        <Campo id="clave" etiqueta="Clave" error={formState.errors.clave?.message}>
          <Entrada id="clave" type="password" autoComplete="current-password" {...register('clave')} />
        </Campo>
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
        <Boton type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </Boton>
        <Link to="/recuperar" className="text-center text-sm text-colmena-500 hover:text-colmena-900">
          Olvidé mi clave
        </Link>
      </form>
    </PantallaAcceso>
  )
}
