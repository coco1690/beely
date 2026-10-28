import { invocarFuncion, mensajeDe } from '@beely/tipos/supabase'
import { Spinner, toast } from '@beely/ui'
import { useState } from 'react'
import { esIos } from '../lib/instalacion'
import { clienteClub } from '../lib/supabase'

// "Agregar a Google Wallet": la Edge Function wallet-google crea (o pone al día) el pase
// y devuelve el enlace firmado de Google; el teléfono abre Wallet desde ahí.
// En iPhone no se muestra: allí irá Apple Wallet (Sprint 7).
export function BotonGoogleWallet({ slug, token }: { slug: string; token: string }) {
  const [cargando, setCargando] = useState(false)
  if (esIos) return null

  const agregar = async () => {
    setCargando(true)
    try {
      const { url } = await invocarFuncion<{ url: string }>(clienteClub(slug, token), 'wallet-google', { slug, token })
      location.href = url
    } catch (e) {
      toast.error(mensajeDe(e))
      setCargando(false)
    }
  }

  // Colores y forma de la guía de marca de Google Wallet: fondo negro, borde gris, píldora.
  return (
    <button
      type="button"
      onClick={agregar}
      disabled={cargando}
      className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2.5 rounded-full border border-[#747775] bg-[#1f1f1f] px-5 text-[0.9375rem] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-70"
    >
      {cargando ? <Spinner className="size-5" /> : <LogoGoogleWallet />}
      Agregar a Google Wallet
    </button>
  )
}

function LogoGoogleWallet() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <rect x="3" y="4" width="18" height="11" rx="2.5" fill="#4285F4" />
      <rect x="3" y="7" width="18" height="11" rx="2.5" fill="#34A853" />
      <rect x="3" y="10" width="18" height="11" rx="2.5" fill="#FBBC04" />
      <path d="M3 14.5c0-1.4 1.1-2.5 2.5-2.5H9a3 3 0 0 0 6 0h3.5c1.4 0 2.5 1.1 2.5 2.5v4c0 1.4-1.1 2.5-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5z" fill="#EA4335" />
    </svg>
  )
}
