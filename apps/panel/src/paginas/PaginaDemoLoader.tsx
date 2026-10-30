import { BeelyLoader, BeelyLoaderB, BotonModo, Boton, useCargaSinParpadeo } from "@beely/ui";
import { useState, type ReactNode } from "react";

// Vitrina del loader de Beely (solo en desarrollo: /demo/loader).
export function PaginaDemoLoader() {
  const [pantalla, setPantalla] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [duracion, setDuracion] = useState(0);
  const mostrar = useCargaSinParpadeo(cargando);

  const simular = (ms: number) => {
    setDuracion(ms);
    setCargando(true);
    window.setTimeout(() => setCargando(false), ms);
  };
  const verPantalla = () => {
    setPantalla(true);
    window.setTimeout(() => setPantalla(false), 4000);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-titulo text-texto">Loader de Beely</h1>
          <p className="text-sm text-texto-3">Dos versiones lado a lado: tres tamaños y movimiento reducido. Cambia el modo arriba.</p>
        </div>
        <BotonModo />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["A", "B"] as const).map((v) => {
          const Loader = v === "A" ? BeelyLoader : BeelyLoaderB;
          return (
            <section key={v} className="flex flex-col gap-4" data-version={v}>
              <h2 className="text-seccion text-texto">
                {v === "A" ? "A · primera versión" : "B · hecha con las skills"}
              </h2>
              <Caja titulo="sm · botones e inline">
                <span className="inline-flex items-center gap-2 text-sm text-texto-2">
                  <Loader size="sm" retraso={0} /> Guardando…
                </span>
              </Caja>
              <Caja titulo="md · secciones">
                <Loader size="md" retraso={0} />
              </Caja>
              <Caja titulo="lg · pantalla completa">
                <Loader size="lg" retraso={0} />
              </Caja>
              <Caja titulo="Movimiento reducido (sm · md · lg)">
                <div className="flex flex-wrap items-center justify-center gap-6">
                  <Loader size="sm" retraso={0} movimiento="reducido" />
                  <Loader size="md" retraso={0} movimiento="reducido" />
                  <Loader size="lg" retraso={0} movimiento="reducido" />
                </div>
              </Caja>
            </section>
          );
        })}
        <Caja titulo="Sin parpadeo" ancho>
          <div className="flex w-full flex-col items-center gap-4">
            <div className="flex flex-wrap justify-center gap-2">
              <Boton variante="secundario" onClick={() => simular(200)} disabled={mostrar}>
                Carga de 200 ms
              </Boton>
              <Boton variante="secundario" onClick={() => simular(700)} disabled={mostrar}>
                Carga de 700 ms
              </Boton>
              <Boton variante="secundario" onClick={() => simular(3000)} disabled={mostrar}>
                Carga de 3 s
              </Boton>
              <Boton onClick={verPantalla}>Ver pantalla completa</Boton>
            </div>
            <div className="grid h-32 place-items-center">
              {mostrar ? (
                <BeelyLoader size="md" />
              ) : (
                <p className="text-sm text-texto-3">{duracion ? `Listo (${duracion} ms)` : "Elige una carga"}</p>
              )}
            </div>
            <p className="text-etiqueta text-texto-3">
              Menos de 300 ms no muestra nada; si alcanza a verse, se queda hasta terminar de escribir el logo.
            </p>
          </div>
        </Caja>
      </div>

      {pantalla ? <BeelyLoader size="lg" fullscreen /> : null}
    </main>
  );
}

function Caja({ titulo, ancho, children }: { titulo: string; ancho?: boolean; children: ReactNode }) {
  return (
    <section
      className={`flex min-h-44 flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta ${ancho ? "sm:col-span-2" : ""}`}
    >
      <h2 className="text-etiqueta font-medium text-texto-3">{titulo}</h2>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </section>
  );
}
