import { zodResolver } from '@hookform/resolvers/zod'
import { edadMinimaClub, esquemaFechaNacimiento, esquemaNombreCliente, normalizarCelular, pesos } from '@beely/tipos'
import { ErrorBeely, invocarFuncion, mensajeDe } from '@beely/tipos/supabase'
import { Aviso, Boton, Campo, Casilla, Entrada, LogoNegocio, PanelInferior, SellosTarjeta } from '@beely/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { clienteClub } from '../lib/supabase'
import { useClubStore, type NegocioClub } from '../stores/useClubStore'

const esquemaFormulario = z.object({
  nombre: esquemaNombreCliente,
  // Se escribe como en Colombia (300 123 4567) y se envía en E.164.
  celular: z.string().transform((valor, ctx) => {
    const normalizado = normalizarCelular(valor)
    if (!normalizado) {
      ctx.addIssue({ code: 'custom', message: 'Escribe tu celular de 10 dígitos' })
      return z.NEVER
    }
    return normalizado
  }),
  fecha_nacimiento: esquemaFechaNacimiento,
  acepta_datos: z.boolean().refine((v) => v, 'Necesitamos tu autorización para crear la tarjeta'),
  acepta_marketing: z.boolean(),
})

// Fecha máxima del selector: hoy menos la edad mínima.
const fechaMaxima = () => {
  const hoy = new Date()
  return new Date(Date.UTC(hoy.getFullYear() - edadMinimaClub, hoy.getMonth(), hoy.getDate())).toISOString().slice(0, 10)
}

function comoSeGana(programa: NonNullable<NegocioClub['programas'][number]>): string {
  if (programa.regla_sello === 'por_monto' && programa.monto_por_sello) return `1 sello por cada ${pesos(programa.monto_por_sello)} de compra`
  if (programa.regla_sello === 'por_unidad') return '1 sello por cada producto'
  if (programa.monto_minimo) return `1 sello por cada compra desde ${pesos(programa.monto_minimo)}`
  return '1 sello por cada compra'
}

export function PaginaRegistro() {
  const negocio = useClubStore((e) => e.negocio)
  const slug = useClubStore((e) => e.slug)
  const navegar = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [politicaAbierta, setPoliticaAbierta] = useState(false)
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaFormulario),
    // Los errores se muestran al salir de cada campo y al tocar "Crear mi tarjeta".
    mode: 'onTouched',
    defaultValues: { nombre: '', celular: '', fecha_nacimiento: '', acepta_datos: false, acepta_marketing: false },
  })
  if (!negocio || !slug) return null
  const programa = negocio.programas[0]

  const registrar = handleSubmit(async (datos) => {
    setError(null)
    try {
      const { token } = await invocarFuncion<{ token: string }>(clienteClub(slug), 'club-registro', { slug, ...datos })
      navegar(`/t/${token}`, { replace: true })
    } catch (e) {
      setError(e instanceof ErrorBeely ? e.message : mensajeDe(e))
    }
  })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] motion-safe:animate-aparecer">
      <header className="flex flex-col items-center gap-3 pt-4 text-center">
        <LogoNegocio url={negocio.logo_url} nombre={negocio.nombre} className="size-14" />
        <div>
          <h1 className="text-titulo text-texto">{negocio.nombre}</h1>
          <p className="mt-1 text-sm text-texto-3">Únete al club y gana premios con tus compras</p>
        </div>
      </header>

      {programa ? (
        <section className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
          <p className="text-sm text-texto">
            Junta <strong className="font-semibold">{programa.sellos_requeridos} sellos</strong> y gana{' '}
            <strong className="font-semibold">{programa.premio_descripcion.toLowerCase()}</strong>.
          </p>
          <SellosTarjeta actuales={0} requeridos={programa.sellos_requeridos} claseSello="size-7" logo={negocio.logo_url} />
          <p className="text-etiqueta text-texto-3">{comoSeGana(programa)}.</p>
        </section>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={registrar} noValidate>
        <Campo id="nombre" etiqueta="Tu nombre" error={formState.errors.nombre?.message}>
          <Entrada id="nombre" autoComplete="name" {...register('nombre')} />
        </Campo>
        <Campo id="celular" etiqueta="Celular" error={formState.errors.celular?.message}>
          <Entrada id="celular" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="300 123 4567" {...register('celular')} />
        </Campo>
        <Campo
          id="fecha_nacimiento"
          etiqueta="Fecha de nacimiento"
          ayuda="Para tu regalo de cumpleaños. No se puede cambiar después."
          error={formState.errors.fecha_nacimiento?.message}
        >
          <Entrada id="fecha_nacimiento" type="date" min="1900-01-01" max={fechaMaxima()} {...register('fecha_nacimiento')} />
        </Campo>

        <div className="flex flex-col gap-3 pt-1">
          <Casilla {...register('acepta_datos')} aria-invalid={formState.errors.acepta_datos ? true : undefined}>
            Autorizo a {negocio.nombre} a tratar mis datos según la{' '}
            <button
              type="button"
              className="font-medium text-texto underline underline-offset-2"
              onClick={() => setPoliticaAbierta(true)}
            >
              política de datos
            </button>
            .
          </Casilla>
          {formState.errors.acepta_datos ? (
            <p className="-mt-1 pl-7 text-xs text-peligro" role="alert">
              {formState.errors.acepta_datos.message}
            </p>
          ) : null}
          <Casilla {...register('acepta_marketing')}>Quiero recibir promociones y avisos de mis premios.</Casilla>
        </div>

        {error ? <Aviso tono="peligro">{error}</Aviso> : null}
        <Boton type="submit" tamano="lg" cargando={formState.isSubmitting}>
          Crear mi tarjeta
        </Boton>
      </form>

      <PanelInferior abierto={politicaAbierta} onAbiertoCambia={setPoliticaAbierta} titulo="Política de tratamiento de datos">
        <PoliticaDatos negocio={negocio.nombre} version={negocio.version_politica_datos} />
      </PanelInferior>
    </main>
  )
}

// Texto base (Ley 1581 de 2012). Cada negocio es el responsable de sus datos.
function PoliticaDatos({ negocio, version }: { negocio: string; version: string }) {
  return (
    <div className="flex flex-col gap-3 pb-4 text-sm text-texto-2">
      <p>
        <strong className="text-texto">{negocio}</strong> es el responsable del tratamiento de los datos que registras en su club
        (nombre, celular y fecha de nacimiento). Beely los procesa por encargo de {negocio}.
      </p>
      <p>
        Los usamos para identificar tu tarjeta, sumar tus sellos, entregarte tus premios y, si lo autorizas, enviarte promociones y
        avisos. No los vendemos ni los compartimos con otros negocios.
      </p>
      <p>
        Puedes conocer, actualizar o pedir que se eliminen tus datos, y retirar la autorización de mensajes en cualquier momento desde
        tu tarjeta o en caja.
      </p>
      <p className="text-xs text-texto-3">Versión {version}</p>
    </div>
  )
}
