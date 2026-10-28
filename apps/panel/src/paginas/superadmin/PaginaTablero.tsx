import { numero } from '@beely/tipos'
import { Aviso, EstadoVacio, Esqueleto, FilaLista, Lista, LogoNegocio, Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '@beely/ui'
import { Moon, TrendingUp } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { EncabezadoPagina } from '../../componentes/DisenoPanel'
import { Cifra, GraficaDiaria, GrupoCifras, haceCuanto, InsigniaPlan, planes, SelectorPeriodo } from '../../componentes/plataforma'
import { usePlataformaStore } from '../../stores/usePlataformaStore'

export function PaginaTablero() {
  const { dias, tablero, negocios, error, elegirDias, cargarNegocios, cargarTablero } = usePlataformaStore()

  useEffect(() => {
    void cargarTablero()
    void cargarNegocios()
  }, [cargarTablero, cargarNegocios])

  const activos = (negocios ?? []).filter((n) => n.estado === 'activo')
  const masActivos = [...activos].filter((n) => n.sellos_periodo > 0).sort((a, b) => b.sellos_periodo - a.sellos_periodo).slice(0, 5)
  const sinActividad = activos.filter((n) => n.sellos_periodo === 0)

  return (
    <>
      <EncabezadoPagina
        titulo="Tablero"
        descripcion="Cómo va Beely: negocios, clientes y actividad de toda la plataforma."
        accion={<SelectorPeriodo valor={dias} onCambio={(d) => void elegirDias(d)} />}
      />
      <div className="flex flex-col gap-6">
        {error ? <Aviso tono="peligro">{error}</Aviso> : null}

        {tablero ? (
          <GrupoCifras>
            <Cifra
              etiqueta="Negocios activos"
              valor={tablero.negocios.activos}
              detalle={`de ${numero(tablero.negocios.total)} · ${numero(tablero.negocios.nuevos)} nuevos`}
            />
            <Cifra etiqueta="Clientes" valor={tablero.clientes.total} detalle={`+${numero(tablero.clientes.nuevos)} en ${dias} días`} />
            <Cifra etiqueta="Sellos" valor={tablero.sellos.periodo} detalle={`en ${dias} días`} />
            <Cifra
              etiqueta="Premios canjeados"
              valor={tablero.cupones.canjeados_periodo}
              detalle={`${numero(tablero.cupones.emitidos_periodo)} cupones emitidos`}
            />
          </GrupoCifras>
        ) : (
          <Esqueleto className="h-[5.5rem] rounded-tarjeta" />
        )}

        <Tarjeta>
          <TarjetaContenido className="pt-5">
            {tablero ? <GraficaDiaria serie={tablero.serie} /> : <Esqueleto className="h-52" />}
          </TarjetaContenido>
        </Tarjeta>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo>Más activos</TarjetaTitulo>
            </TarjetaEncabezado>
            {negocios === null ? (
              <TarjetaContenido>
                <Esqueleto className="h-24" />
              </TarjetaContenido>
            ) : masActivos.length === 0 ? (
              <EstadoVacio icono={<TrendingUp />} titulo="Sin sellos en el periodo" descripcion="Cuando los negocios sumen sellos, aparecen aquí." />
            ) : (
              <Lista>
                {masActivos.map((n) => (
                  <FilaNegocioCorta key={n.id} id={n.id} nombre={n.nombre} logo={n.logo_url} derecha={`${numero(n.sellos_periodo)} sellos`} />
                ))}
              </Lista>
            )}
          </Tarjeta>

          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo>Activos sin sellos en {dias} días</TarjetaTitulo>
            </TarjetaEncabezado>
            {negocios === null ? (
              <TarjetaContenido>
                <Esqueleto className="h-24" />
              </TarjetaContenido>
            ) : sinActividad.length === 0 ? (
              <EstadoVacio icono={<Moon />} titulo="Todos tuvieron actividad" descripcion="Ningún negocio activo está quieto." />
            ) : (
              <Lista>
                {sinActividad.slice(0, 5).map((n) => (
                  <FilaNegocioCorta key={n.id} id={n.id} nombre={n.nombre} logo={n.logo_url} derecha={`Último sello: ${haceCuanto(n.ultimo_sello_en).toLowerCase()}`} />
                ))}
              </Lista>
            )}
          </Tarjeta>
        </div>

        {tablero ? (
          <Tarjeta>
            <TarjetaEncabezado>
              <TarjetaTitulo>Negocios por plan y estado</TarjetaTitulo>
            </TarjetaEncabezado>
            <TarjetaContenido>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                {planes.map((p) => (
                  <div key={p} className="flex flex-col gap-1">
                    <dt>
                      <InsigniaPlan plan={p} />
                    </dt>
                    <dd className="text-lg font-semibold text-texto tabular-nums">
                      {numero(tablero.negocios.por_plan[p] ?? 0)}
                    </dd>
                  </div>
                ))}
                <EstadoCifra etiqueta="Activos" valor={tablero.negocios.activos} />
                <EstadoCifra etiqueta="Suspendidos" valor={tablero.negocios.suspendidos} />
                <EstadoCifra etiqueta="Cancelados" valor={tablero.negocios.cancelados} />
              </dl>
            </TarjetaContenido>
          </Tarjeta>
        ) : null}
      </div>
    </>
  )
}

function EstadoCifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs leading-5 text-texto-3">{etiqueta}</dt>
      <dd className="text-lg font-semibold text-texto tabular-nums">{numero(valor)}</dd>
    </div>
  )
}

function FilaNegocioCorta({ id, nombre, logo, derecha }: { id: string; nombre: string; logo: string | null; derecha: string }) {
  return (
    <FilaLista className="p-0 sm:p-0">
      <Link
        to={`/superadmin/negocios/${id}`}
        className="flex w-full min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-texto/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco sm:px-5"
      >
        <LogoNegocio url={logo} nombre={nombre} className="size-7" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-texto">{nombre}</span>
        <span className="shrink-0 text-xs text-texto-3 tabular-nums">{derecha}</span>
      </Link>
    </FilaLista>
  )
}
