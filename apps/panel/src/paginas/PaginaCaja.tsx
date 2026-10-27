import type { ResultadoSello } from '@beely/tipos'
import { Aviso, Boton, Campo, cn, Entrada, Insignia, Selector, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@beely/ui'
import { Camera, Gift, Search, Stamp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { EscanerQr } from '../componentes/EscanerQr'
import { celularOculto, extraerToken, fecha, fechaHora, normalizarCelular, pesos } from '../lib/formato'
import { llamarFuncion, mensajeDe } from '../lib/funciones'
import { supabase } from '../lib/supabase'
import { useNegocioActivo, useNegocioStore } from '../stores/useNegocioStore'

const consultaTarjeta = `id, token_publico, sellos_actuales, sellos_historicos, premios_ganados, ultima_visita_en, estado,
  clientes ( nombre, celular ),
  programas ( sellos_requeridos, premio_descripcion, regla_sello, monto_minimo, monto_por_sello ),
  cupones ( id, codigo, descripcion, vence_en, estado )`

async function buscarTarjeta(negocioId: string, token: string) {
  const { data, error } = await supabase
    .from('tarjetas')
    .select(consultaTarjeta)
    .eq('negocio_id', negocioId)
    .eq('token_publico', token)
    .eq('cupones.estado', 'emitido')
    .maybeSingle()
  if (error) throw error
  return data
}

type TarjetaCaja = NonNullable<Awaited<ReturnType<typeof buscarTarjeta>>>

type Movimiento = {
  id: string
  cantidad: number
  origen: string
  creado_en: string
  tarjetas: { clientes: { nombre: string } | null } | null
}

export function PaginaCaja() {
  const activo = useNegocioActivo()
  const sedes = useNegocioStore((e) => e.sedes)
  const sedeCajaId = useNegocioStore((e) => e.sedeCajaId)
  const elegirSedeCaja = useNegocioStore((e) => e.elegirSedeCaja)

  const [escaneando, setEscaneando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [tarjeta, setTarjeta] = useState<TarjetaCaja | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Una clave por intento: si la red reintenta o se toca dos veces, no se suma doble.
  const [clave, setClave] = useState(() => crypto.randomUUID())
  const [sumando, setSumando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoSello | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const negocioId = activo?.negocio.id
  const zona = activo?.negocio.zona_horaria
  const sedesActivas = sedes.filter((s) => s.activa)
  const faltaSede = sedesActivas.length > 0 && !sedeCajaId

  const cargarMovimientos = useCallback(async () => {
    if (!negocioId) return
    const { data } = await supabase
      .from('eventos_sello')
      .select('id, cantidad, origen, creado_en, tarjetas ( clientes ( nombre ) )')
      .eq('negocio_id', negocioId)
      .in('origen', ['panel', 'api_pos', 'canje_premio'])
      .order('creado_en', { ascending: false })
      .limit(8)
    setMovimientos((data ?? []) as Movimiento[])
  }, [negocioId])

  useEffect(() => {
    setTarjeta(null)
    setResultado(null)
    void cargarMovimientos()
  }, [cargarMovimientos])

  const abrirTarjeta = async (token: string) => {
    if (!negocioId) return
    setBuscando(true)
    setError(null)
    setResultado(null)
    try {
      const encontrada = await buscarTarjeta(negocioId, token)
      if (!encontrada) setError('No encontramos esa tarjeta en este negocio.')
      setTarjeta(encontrada)
      setClave(crypto.randomUUID())
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setBuscando(false)
    }
  }

  const buscar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!negocioId || !busqueda.trim()) return
    const celular = normalizarCelular(busqueda)
    if (!celular) {
      await abrirTarjeta(extraerToken(busqueda))
      return
    }
    setBuscando(true)
    setError(null)
    const { data, error } = await supabase
      .from('clientes')
      .select('tarjetas ( token_publico )')
      .eq('negocio_id', negocioId)
      .eq('celular', celular)
      .maybeSingle()
    setBuscando(false)
    const token = data?.tarjetas[0]?.token_publico
    if (error) setError(mensajeDe(error))
    else if (!token) {
      setTarjeta(null)
      setError('No hay un cliente con ese celular en este negocio.')
    } else await abrirTarjeta(token)
  }

  const sumarSello = async (compra: { monto_venta?: number; unidades?: number }) => {
    if (!negocioId || !tarjeta) return
    setSumando(true)
    setError(null)
    try {
      const r = await llamarFuncion<ResultadoSello>('panel-sello', {
        negocio_id: negocioId,
        token: tarjeta.token_publico,
        sede_id: sedeCajaId,
        ...compra,
        clave_idempotencia: clave,
      })
      setResultado(r)
      setClave(crypto.randomUUID())
      const actualizada = await buscarTarjeta(negocioId, tarjeta.token_publico)
      if (actualizada) setTarjeta(actualizada)
      void cargarMovimientos()
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setSumando(false)
    }
  }

  const limpiar = () => {
    setTarjeta(null)
    setResultado(null)
    setError(null)
    setBusqueda('')
  }

  if (!activo) return null

  return (
    <>
      <EncabezadoPagina titulo="Caja" descripcion="Escanea el QR del cliente y suma su sello." />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-4">
          {sedesActivas.length > 0 ? (
            <Campo id="sede" etiqueta="Sede donde estás" error={faltaSede ? 'Elige la sede antes de sumar sellos.' : undefined}>
              <Selector id="sede" value={sedeCajaId ?? ''} onChange={(e) => elegirSedeCaja(e.target.value || null)}>
                <option value="">Elige una sede…</option>
                {sedesActivas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          ) : null}

          {activo.negocio.estado !== 'activo' ? (
            <Aviso tono="peligro">El negocio está {activo.negocio.estado}; no se pueden sumar sellos.</Aviso>
          ) : null}

          {escaneando ? (
            <Tarjeta>
              <TarjetaContenido className="pt-5">
                <EscanerQr
                  onLeido={(texto) => {
                    setEscaneando(false)
                    void abrirTarjeta(extraerToken(texto))
                  }}
                  onCerrar={() => setEscaneando(false)}
                />
              </TarjetaContenido>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <TarjetaContenido className="flex flex-col gap-4 pt-5">
                <Boton tamano="lg" onClick={() => setEscaneando(true)}>
                  <Camera className="size-5" /> Escanear QR
                </Boton>
                <form className="flex gap-2" onSubmit={(e) => void buscar(e)}>
                  <Entrada
                    aria-label="Celular o código de la tarjeta"
                    placeholder="Celular (300 123 4567) o código"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    inputMode="search"
                  />
                  <Boton type="submit" variante="contorno" disabled={buscando} aria-label="Buscar">
                    <Search className="size-4" />
                  </Boton>
                </form>
              </TarjetaContenido>
            </Tarjeta>
          )}

          {error ? <Aviso tono="peligro">{error}</Aviso> : null}

          {tarjeta ? (
            <VistaTarjeta
              key={tarjeta.id}
              tarjeta={tarjeta}
              zona={zona}
              resultado={resultado}
              sumando={sumando}
              puedeSumar={!faltaSede && activo.negocio.estado === 'activo' && tarjeta.estado === 'activa'}
              onSumar={(compra) => void sumarSello(compra)}
              onOtro={limpiar}
            />
          ) : null}
        </div>

        <Tarjeta className="h-fit">
          <TarjetaEncabezado>
            <TarjetaTitulo className="text-base">Últimos movimientos</TarjetaTitulo>
          </TarjetaEncabezado>
          <TarjetaContenido>
            {movimientos.length === 0 ? (
              <p className="text-sm text-texto-3">Aún no hay sellos.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {movimientos.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-texto">{m.tarjetas?.clientes?.nombre ?? 'Cliente'}</p>
                      <p className="text-xs text-texto-3">{fechaHora(m.creado_en, zona)}</p>
                    </div>
                    {m.origen === 'canje_premio' ? (
                      <Insignia tono="miel">Premio</Insignia>
                    ) : (
                      <Insignia tono="exito">+{m.cantidad}</Insignia>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TarjetaContenido>
        </Tarjeta>
      </div>
    </>
  )
}

function VistaTarjeta({
  tarjeta,
  zona,
  resultado,
  sumando,
  puedeSumar,
  onSumar,
  onOtro,
}: {
  tarjeta: TarjetaCaja
  zona: string | undefined
  resultado: ResultadoSello | null
  sumando: boolean
  puedeSumar: boolean
  onSumar: (compra: { monto_venta?: number; unidades?: number }) => void
  onOtro: () => void
}) {
  const requeridos = tarjeta.programas?.sellos_requeridos ?? 10
  const regla = tarjeta.programas?.regla_sello
  // Lo que la caja debe preguntar según la regla del programa.
  const pideMonto = regla === 'por_monto' || (regla === 'por_venta' && tarjeta.programas?.monto_minimo != null)
  const pideUnidades = regla === 'por_unidad'
  const [monto, setMonto] = useState('')
  const [unidades, setUnidades] = useState('1')
  const montoNumero = Number(monto)
  const unidadesNumero = Number(unidades)
  const compraValida =
    (!pideMonto || (monto !== '' && montoNumero > 0)) && (!pideUnidades || (Number.isInteger(unidadesNumero) && unidadesNumero >= 1))

  const sumar = () => {
    onSumar({
      ...(pideMonto ? { monto_venta: montoNumero } : {}),
      ...(pideUnidades ? { unidades: unidadesNumero } : {}),
    })
    setMonto('')
    setUnidades('1')
  }
  const vigentes = tarjeta.cupones.filter((c) => new Date(c.vence_en) > new Date())

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <div className="flex items-start justify-between gap-2">
          <div>
            <TarjetaTitulo>{tarjeta.clientes?.nombre}</TarjetaTitulo>
            <p className="text-sm text-texto-3">{tarjeta.clientes ? celularOculto(tarjeta.clientes.celular) : null}</p>
          </div>
          {tarjeta.estado !== 'activa' ? <Insignia tono="peligro">Bloqueada</Insignia> : null}
        </div>
      </TarjetaEncabezado>
      <TarjetaContenido className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm text-texto-2">
            <span className="text-2xl font-semibold text-texto">{tarjeta.sellos_actuales}</span> de {requeridos} sellos ·
            premio: {tarjeta.programas?.premio_descripcion}
          </p>
          <div className="flex flex-wrap gap-2" aria-hidden>
            {Array.from({ length: requeridos }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border-2 text-sm transition-colors',
                  i < tarjeta.sellos_actuales ? 'border-acento bg-acento' : 'border-dashed border-borde-fuerte bg-hundido',
                )}
              >
                {i < tarjeta.sellos_actuales ? '🐝' : ''}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-texto-3">
            Última visita: {fechaHora(tarjeta.ultima_visita_en, zona)} · {tarjeta.sellos_historicos} sellos en total ·{' '}
            {tarjeta.premios_ganados} premios
          </p>
        </div>

        {resultado ? <AvisoResultado resultado={resultado} /> : null}

        {vigentes.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-texto-2">Cupones por canjear</p>
            {vigentes.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-acento-suave px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Gift className="size-4 text-acento-texto" /> {c.descripcion}
                </span>
                <span className="font-mono text-xs text-texto-2">
                  {c.codigo} · vence {fecha(c.vence_en, zona)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {pideMonto ? (
          <Campo
            id="monto"
            etiqueta="Valor de la compra"
            ayuda={
              regla === 'por_monto'
                ? `1 sello por cada ${pesos(tarjeta.programas?.monto_por_sello)}`
                : `Compra mínima ${pesos(tarjeta.programas?.monto_minimo)}`
            }
          >
            <Entrada id="monto" type="number" inputMode="numeric" min={0} step="100" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </Campo>
        ) : null}
        {pideUnidades ? (
          <Campo id="unidades" etiqueta="Unidades compradas">
            <Entrada id="unidades" type="number" inputMode="numeric" min={1} max={100} value={unidades} onChange={(e) => setUnidades(e.target.value)} />
          </Campo>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Boton tamano="lg" className="flex-1" onClick={sumar} disabled={!puedeSumar || sumando || !compraValida}>
            <Stamp className="size-5" /> {sumando ? 'Sumando…' : 'Sumar sello'}
          </Boton>
          <Boton tamano="lg" variante="contorno" onClick={onOtro}>
            Otro cliente
          </Boton>
        </div>
      </TarjetaContenido>
    </Tarjeta>
  )
}

function AvisoResultado({ resultado }: { resultado: ResultadoSello }) {
  if (resultado.duplicado) return <Aviso>Ese sello ya estaba registrado.</Aviso>
  if (resultado.motivo === 'sin_sellos_aplicables') {
    return (
      <Aviso tono="miel">
        {resultado.detalle === 'tope_diario'
          ? 'El cliente ya alcanzó el máximo de sellos de hoy.'
          : 'Esta compra no alcanza para un sello.'}
      </Aviso>
    )
  }
  if (resultado.premio_emitido && resultado.cupon) {
    return (
      <Aviso tono="exito">
        🎉 ¡Tarjeta completa! Se emitió el premio <strong>{resultado.cupon.descripcion}</strong> (código{' '}
        <span className="font-mono">{resultado.cupon.codigo}</span>).
      </Aviso>
    )
  }
  const sumados = resultado.sellos_sumados ?? 1
  return (
    <Aviso tono="exito">
      Listo: +{sumados} {sumados === 1 ? 'sello' : 'sellos'}.
    </Aviso>
  )
}
