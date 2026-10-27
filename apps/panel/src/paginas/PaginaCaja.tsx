import {
  Aviso,
  Boton,
  Campo,
  cn,
  Entrada,
  EstadoVacio,
  FilaLista,
  Insignia,
  Lista,
  PanelInferior,
  Sello,
  Selector,
  Tarjeta,
  TarjetaContenido,
  TarjetaEncabezado,
  TarjetaTitulo,
  useMedia,
} from '@beely/ui'
import { Camera, Gift, Info, Search, Stamp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EncabezadoPagina } from '../componentes/DisenoPanel'
import { EscanerQr } from '../componentes/EscanerQr'
import { celularOculto, extraerToken, fecha, fechaHora, normalizarCelular, numero, pesos, type ResultadoSello } from '@beely/tipos'
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
  // En móvil la cámara se abre en un panel inferior; en escritorio, dentro de la página.
  const esMovil = useMedia('(max-width: 767px)')
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

  const escaner = (
    <EscanerQr
      onLeido={(texto) => {
        setEscaneando(false)
        void abrirTarjeta(extraerToken(texto))
      }}
      onCerrar={() => setEscaneando(false)}
    />
  )

  return (
    <>
      <EncabezadoPagina titulo="Caja" descripcion="Escanea el QR del cliente y suma su sello." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {sedesActivas.length > 0 ? (
            <Campo id="sede" etiqueta="Sede donde estás" ayuda={faltaSede ? 'Elígela antes de sumar sellos.' : undefined}>
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

          {escaneando && !esMovil ? (
            <Tarjeta className="motion-safe:animate-aparecer">
              <TarjetaContenido sinEncabezado>{escaner}</TarjetaContenido>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <TarjetaContenido sinEncabezado className="flex flex-col gap-3">
                <Boton tamano="lg" onClick={() => setEscaneando(true)}>
                  <Camera className="size-5" /> Escanear QR
                </Boton>
                <form className="flex gap-2" onSubmit={(e) => void buscar(e)}>
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-3" aria-hidden />
                    <Entrada
                      aria-label="Celular o código de la tarjeta"
                      placeholder="Celular o código de la tarjeta"
                      className="pl-9"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      inputMode="search"
                      enterKeyHint="search"
                      autoComplete="off"
                    />
                  </div>
                  <Boton type="submit" variante="contorno" cargando={buscando} disabled={!busqueda.trim()}>
                    Buscar
                  </Boton>
                </form>
              </TarjetaContenido>
            </Tarjeta>
          )}

          {esMovil ? (
            <PanelInferior abierto={escaneando} onAbiertoCambia={setEscaneando} titulo="Escanear QR" descripcion="Apunta al QR de la tarjeta del cliente.">
              {escaneando ? escaner : null}
            </PanelInferior>
          ) : null}

          {error ? <Aviso tono="peligro">{error}</Aviso> : null}

          {tarjeta ? (
            <VistaTarjeta
              key={tarjeta.id}
              tarjeta={tarjeta}
              zona={zona}
              resultado={resultado}
              sumando={sumando}
              motivoBloqueo={
                activo.negocio.estado !== 'activo'
                  ? 'El negocio no está activo.'
                  : tarjeta.estado !== 'activa'
                    ? 'La tarjeta está bloqueada.'
                    : faltaSede
                      ? 'Elige la sede donde estás para sumar sellos.'
                      : null
              }
              onSumar={(compra) => void sumarSello(compra)}
              onOtro={limpiar}
            />
          ) : null}
        </div>

        <Tarjeta className="h-fit min-w-0">
          <TarjetaEncabezado className="pb-1">
            <TarjetaTitulo>Últimos movimientos</TarjetaTitulo>
          </TarjetaEncabezado>
          {movimientos.length === 0 ? (
            <EstadoVacio icono={<Stamp />} titulo="Aún no hay sellos" descripcion="Los sellos que sumes aparecerán aquí." />
          ) : (
            <Lista className="pb-2">
              {movimientos.map((m) => (
                <FilaLista key={m.id} className="flex-nowrap py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-texto">{m.tarjetas?.clientes?.nombre ?? 'Cliente'}</p>
                    <p className="text-xs text-texto-3 tabular-nums">{fechaHora(m.creado_en, zona)}</p>
                  </div>
                  {m.origen === 'canje_premio' ? (
                    <Insignia tono="miel">Premio</Insignia>
                  ) : (
                    <Insignia tono="exito">+{m.cantidad}</Insignia>
                  )}
                </FilaLista>
              ))}
            </Lista>
          )}
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
  motivoBloqueo,
  onSumar,
  onOtro,
}: {
  tarjeta: TarjetaCaja
  zona: string | undefined
  resultado: ResultadoSello | null
  sumando: boolean
  // Si no se puede sumar, por qué (se muestra junto al botón).
  motivoBloqueo: string | null
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
  const motivo = motivoBloqueo ?? (compraValida ? null : pideMonto ? 'Escribe el valor de la compra.' : 'Escribe las unidades compradas.')

  return (
    <Tarjeta className="motion-safe:animate-aparecer">
      <TarjetaEncabezado className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <TarjetaTitulo className="line-clamp-2 break-words">{tarjeta.clientes?.nombre}</TarjetaTitulo>
          <p className="font-mono text-etiqueta text-texto-3">{tarjeta.clientes ? celularOculto(tarjeta.clientes.celular) : null}</p>
        </div>
        {tarjeta.estado !== 'activa' ? <Insignia tono="peligro">Bloqueada</Insignia> : null}
      </TarjetaEncabezado>
      <TarjetaContenido className="flex flex-col gap-5">
        <ProgresoSellos actuales={tarjeta.sellos_actuales} requeridos={requeridos} premio={tarjeta.programas?.premio_descripcion} />

        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-control border border-borde bg-borde text-center">
          {[
            ['Última visita', fechaHora(tarjeta.ultima_visita_en, zona)],
            ['Sellos en total', numero(tarjeta.sellos_historicos)],
            ['Premios', numero(tarjeta.premios_ganados)],
          ].map(([titulo, valor]) => (
            <div key={titulo} className="flex min-w-0 flex-col gap-0.5 bg-superficie px-2 py-2.5">
              <dt className="truncate text-xs text-texto-3">{titulo}</dt>
              <dd className="text-etiqueta font-medium text-texto tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>

        {resultado ? <AvisoResultado resultado={resultado} /> : null}

        {vigentes.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-etiqueta font-medium text-texto-2">Cupones por canjear</p>
            <Lista className="rounded-control border border-acento-borde bg-acento-suave">
              {vigentes.map((c) => (
                <FilaLista key={c.id} className="gap-y-1 px-3 py-2.5 sm:px-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-texto">
                    <Gift className="size-4 shrink-0 text-acento-texto" aria-hidden />
                    <span className="min-w-0">{c.descripcion}</span>
                  </span>
                  <span className="font-mono text-xs text-texto-2">
                    {c.codigo} · vence {fecha(c.vence_en, zona)}
                  </span>
                </FilaLista>
              ))}
            </Lista>
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

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Boton tamano="lg" className="flex-1" onClick={sumar} cargando={sumando} disabled={motivo !== null}>
              <Stamp className="size-5" /> Sumar sello
            </Boton>
            <Boton tamano="lg" variante="contorno" onClick={onOtro}>
              Otro cliente
            </Boton>
          </div>
          {motivo && !sumando ? (
            <p className="flex items-center gap-1.5 text-etiqueta text-texto-3">
              <Info className="size-3.5 shrink-0" aria-hidden /> {motivo}
            </p>
          ) : null}
        </div>
      </TarjetaContenido>
    </Tarjeta>
  )
}

// Contador grande y la tarjeta de sellos. Hasta 12 sellos se dibujan como celdas de panal;
// con más, una barra segmentada que no ocupa media pantalla.
function ProgresoSellos({ actuales, requeridos, premio }: { actuales: number; requeridos: number; premio: string | undefined }) {
  // Los sellos recién sumados se "estampan"; los que ya estaban no se animan.
  const previos = useRef(actuales)
  const desde = Math.min(previos.current, actuales)
  useEffect(() => {
    previos.current = actuales
  }, [actuales])
  const esNuevo = (i: number) => i >= desde && i < actuales
  const retraso = (i: number) => ({ animationDelay: `${Math.min((i - desde) * 30, 300)}ms` })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="flex items-baseline gap-1.5">
          <span key={actuales} className="text-[2rem] leading-none font-semibold tracking-tight text-texto tabular-nums motion-safe:animate-aparecer">
            {actuales}
          </span>
          <span className="text-sm text-texto-3 tabular-nums">de {requeridos} sellos</span>
        </p>
        {premio ? (
          <p className="line-clamp-2 min-w-0 text-etiqueta text-texto-2 sm:max-w-[60%] sm:text-right">
            <span className="text-texto-3">Premio: </span>
            {premio}
          </p>
        ) : null}
      </div>
      {requeridos <= 12 ? (
        <div className="flex flex-wrap gap-1" role="img" aria-label={`${actuales} de ${requeridos} sellos`}>
          {Array.from({ length: requeridos }, (_, i) => (
            <Sello key={i} lleno={i < actuales} className={cn('size-7 sm:size-9', esNuevo(i) && 'animate-estampar')} style={esNuevo(i) ? retraso(i) : undefined} />
          ))}
        </div>
      ) : (
        <div className="flex h-2.5 gap-[3px]" role="img" aria-label={`${actuales} de ${requeridos} sellos`}>
          {Array.from({ length: requeridos }, (_, i) => (
            <span
              key={i}
              className={cn('flex-1 rounded-full', i < actuales ? 'bg-acento' : 'bg-hundido', esNuevo(i) && 'animate-estampar')}
              style={esNuevo(i) ? retraso(i) : undefined}
            />
          ))}
        </div>
      )}
    </div>
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
      <div role="status" className="flex items-center gap-3 rounded-control border border-acento-borde bg-acento-suave p-3 motion-safe:animate-estampar">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento text-sobre-acento" aria-hidden>
          <Gift className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-texto">¡Tarjeta completa! Premio emitido</p>
          <p className="text-etiqueta text-texto-2">
            {resultado.cupon.descripcion} · <span className="font-mono">{resultado.cupon.codigo}</span>
          </p>
        </div>
      </div>
    )
  }
  const sumados = resultado.sellos_sumados ?? 1
  return (
    <Aviso tono="exito">
      Listo: +{sumados} {sumados === 1 ? 'sello' : 'sellos'}.
    </Aviso>
  )
}
