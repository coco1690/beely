// Analiza el logo que sube cada negocio para mostrarlo sin marco blanco.
// Los logos llegan de todo tipo: un sello de color sobre fondo blanco, un PNG
// transparente, una foto a sangre… Aquí se decide cómo pintarlo:
//   * 'forma':  el logo es una figura (cuadro, círculo, hexágono) sobre un fondo
//               liso. Se quita ese fondo, se recorta al contenido y se muestra la
//               figura sola. `baldosa` = la figura llena su cuadro (va con esquinas).
//   * 'lleno':  el logo ocupa todo el cuadro (foto, color de marca de borde a borde).
//               Se muestra a sangre con esquinas redondeadas.
//   * 'claro':  texto o trazos sobre fondo transparente. Necesita una base clara
//               para leerse en tema oscuro.

export type AnalisisLogo =
  | { modo: 'forma'; src: string; baldosa: boolean }
  | { modo: 'lleno' }
  | { modo: 'claro' }

const LADO_MAX = 384
const ALFA_TRANSPARENTE = 24
const TOLERANCIA_FONDO = 40
const BORDE_UNIFORME = 0.9
const COBERTURA_FORMA = 0.68
const COBERTURA_BALDOSA = 0.94

const cache = new Map<string, Promise<AnalisisLogo>>()

export function analizarLogo(url: string): Promise<AnalisisLogo> {
  let analisis = cache.get(url)
  if (!analisis) {
    analisis = cargar(url)
      .then(analizar)
      // Sin CORS o sin canvas no se puede leer: se muestra a sangre, que es lo más seguro.
      .catch((): AnalisisLogo => ({ modo: 'lleno' }))
    cache.set(url, analisis)
  }
  return analisis
}

function cargar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image()
    imagen.crossOrigin = 'anonymous'
    imagen.decoding = 'async'
    imagen.onload = () => resolver(imagen)
    imagen.onerror = rechazar
    imagen.src = url
  })
}

function distancia(d: Uint8ClampedArray, i: number, r: number, g: number, b: number): number {
  return Math.hypot(d[i]! - r, d[i + 1]! - g, d[i + 2]! - b)
}

function analizar(imagen: HTMLImageElement): AnalisisLogo {
  const escala = Math.min(1, LADO_MAX / Math.max(imagen.naturalWidth, imagen.naturalHeight))
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala))
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala))
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { modo: 'lleno' }
  ctx.drawImage(imagen, 0, 0, ancho, alto)
  const datos = ctx.getImageData(0, 0, ancho, alto)
  const d = datos.data

  // 1. ¿El borde es liso? Transparente o de un solo color.
  const borde: number[] = []
  for (let x = 0; x < ancho; x++) borde.push(x, (alto - 1) * ancho + x)
  for (let y = 1; y < alto - 1; y++) borde.push(y * ancho, y * ancho + ancho - 1)
  const transparentes = borde.filter((p) => d[p * 4 + 3]! < ALFA_TRANSPARENTE).length
  const fondoTransparente = transparentes >= borde.length * BORDE_UNIFORME
  let fondo: [number, number, number] = [0, 0, 0]
  if (!fondoTransparente) {
    const opacos = borde.filter((p) => d[p * 4 + 3]! >= ALFA_TRANSPARENTE)
    const mediana = (c: number) => opacos.map((p) => d[p * 4 + c]!).sort((a, b) => a - b)[opacos.length >> 1] ?? 0
    fondo = [mediana(0), mediana(1), mediana(2)]
    const parecidos = opacos.filter((p) => distancia(d, p * 4, ...fondo) <= TOLERANCIA_FONDO).length
    if (parecidos < borde.length * BORDE_UNIFORME) return { modo: 'lleno' }
  }
  const esFondo = (p: number) =>
    fondoTransparente ? d[p * 4 + 3]! < ALFA_TRANSPARENTE : d[p * 4 + 3]! < ALFA_TRANSPARENTE || distancia(d, p * 4, ...fondo) <= TOLERANCIA_FONDO

  // 2. Inundación desde el borde: solo es fondo lo que toca el borde
  //    (el blanco dentro del logo se queda).
  const marca = new Uint8Array(ancho * alto)
  const pila: number[] = []
  for (const p of borde) if (!marca[p] && esFondo(p)) (marca[p] = 1), pila.push(p)
  while (pila.length) {
    const p = pila.pop()!
    const x = p % ancho
    const vecinos = [x > 0 ? p - 1 : -1, x < ancho - 1 ? p + 1 : -1, p - ancho, p + ancho]
    for (const v of vecinos) {
      if (v >= 0 && v < marca.length && !marca[v] && esFondo(v)) (marca[v] = 1), pila.push(v)
    }
  }

  // 3. Caja del contenido y qué tanto la llena.
  let x0 = ancho, y0 = alto, x1 = -1, y1 = -1, contenido = 0
  for (let p = 0; p < marca.length; p++) {
    if (marca[p]) continue
    const x = p % ancho, y = (p - x) / ancho
    contenido++
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  if (x1 < 0) return { modo: 'lleno' }
  const cajaAncho = x1 - x0 + 1
  const cajaAlto = y1 - y0 + 1
  const cobertura = contenido / (cajaAncho * cajaAlto)
  const proporcion = Math.min(cajaAncho, cajaAlto) / Math.max(cajaAncho, cajaAlto)

  // Texto o trazos sueltos: no es una figura.
  if (cobertura < COBERTURA_FORMA || proporcion < 0.8) return fondoTransparente ? { modo: 'claro' } : { modo: 'lleno' }

  // 4. Quita el fondo. En el filo, "color a alfa": separa el fondo del
  //    antialias para que no quede un halo blanco alrededor de la figura.
  if (!fondoTransparente) {
    for (let p = 0; p < marca.length; p++) {
      const i = p * 4
      if (marca[p]) {
        d[i + 3] = 0
        continue
      }
      const x = p % ancho
      const enFilo = (x > 0 && marca[p - 1]) || (x < ancho - 1 && marca[p + 1]) || marca[p - ancho] || marca[p + ancho]
      if (!enFilo) continue
      let alfa = 0
      for (let c = 0; c < 3; c++) {
        const v = d[i + c]!, f = fondo[c]!
        const a = v > f ? (v - f) / (255 - f || 1) : v < f ? (f - v) / (f || 1) : 0
        if (a > alfa) alfa = a
      }
      if (alfa <= 0) {
        d[i + 3] = 0
        continue
      }
      for (let c = 0; c < 3; c++) d[i + c] = Math.round((d[i + c]! - fondo[c]!) / alfa + fondo[c]!)
      d[i + 3] = Math.round(d[i + 3]! * alfa)
    }
    ctx.putImageData(datos, 0, 0)
  }

  // 5. Recorta a un cuadrado centrado en el contenido.
  const lado = Math.max(cajaAncho, cajaAlto)
  const recorte = document.createElement('canvas')
  recorte.width = lado
  recorte.height = lado
  recorte.getContext('2d')!.drawImage(lienzo, x0, y0, cajaAncho, cajaAlto, (lado - cajaAncho) / 2, (lado - cajaAlto) / 2, cajaAncho, cajaAlto)
  return { modo: 'forma', src: recorte.toDataURL('image/png'), baldosa: cobertura >= COBERTURA_BALDOSA && proporcion > 0.95 }
}
