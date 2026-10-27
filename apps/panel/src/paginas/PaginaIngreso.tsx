import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaIngreso } from '@beely/tipos'
import { Aviso, Boton, Campo, Entrada, EntradaClave, LogoBeely, Tarjeta, TarjetaContenido } from '@beely/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { BotonModo, SelectorTema } from '../componentes/SelectorTema'
import { supabase } from '../lib/supabase'

export const claseEnlace =
  'self-center rounded-sm text-etiqueta text-texto-3 transition-colors hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco'

export function PantallaAcceso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-fondo px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Un resplandor tenue del color del tema detrás del formulario. */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[28rem] w-[44rem] max-w-[160vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acento opacity-[0.12] blur-[100px]"
        aria-hidden
      />
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex items-center gap-1">
        <SelectorTema />
        <BotonModo />
      </div>
      <div className="relative flex w-full max-w-[22rem] flex-col items-center gap-6 motion-safe:animate-aparecer">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBeely className="size-11" />
          <div>
            <h1 className="text-titulo text-texto">{titulo}</h1>
            <p className="mt-1 text-sm text-texto-3">Panel de fidelización de tu negocio</p>
          </div>
        </div>
        <Tarjeta className="w-full">
          <TarjetaContenido sinEncabezado>{children}</TarjetaContenido>
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
    <PantallaAcceso titulo="Ingresa a Beely">
      <form className="flex flex-col gap-4" onSubmit={ingresar} noValidate>
        <Campo id="email" etiqueta="Correo" error={formState.errors.email?.message}>
          <Entrada id="email" type="email" autoComplete="username" {...register('email')} />
        </Campo>
        <Campo id="clave" etiqueta="Clave" error={formState.errors.clave?.message}>
          <EntradaClave id="clave" autoComplete="current-password" {...register('clave')} />
        </Campo>
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
        <Boton type="submit" cargando={formState.isSubmitting}>
          Ingresar
        </Boton>
        <Link to="/recuperar" className={claseEnlace}>
          Olvidé mi clave
        </Link>
      </form>
    </PantallaAcceso>
  )
}
