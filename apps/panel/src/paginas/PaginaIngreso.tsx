import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaIngreso } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@beely/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Marca } from '../componentes/Marca'
import { BotonModo, SelectorTema } from '../componentes/SelectorTema'
import { supabase } from '../lib/supabase'

export function PantallaAcceso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-fondo p-4">
      {/* Halo del color del tema detrás de la tarjeta. */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-2/3 rounded-full bg-acento opacity-15 blur-3xl"
        aria-hidden
      />
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <SelectorTema />
        <BotonModo />
      </div>
      <div className="relative flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <Marca subtitulo="Panel del negocio" />
        </div>
        <Tarjeta>
          <TarjetaEncabezado className="pb-2">
            <TarjetaTitulo className="text-xl">{titulo}</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido className="pt-4">{children}</TarjetaContenido>
        </Tarjeta>
        <p className="text-center text-xs text-texto-3">Beely · Fidelización para tu negocio</p>
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
        <Link to="/recuperar" className="text-center text-sm text-texto-3 hover:text-texto">
          Olvidé mi clave
        </Link>
      </form>
    </PantallaAcceso>
  )
}
