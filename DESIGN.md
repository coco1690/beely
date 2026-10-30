---
name: Beely
description: Fidelización propia para negocios pequeños; panel del negocio y club del cliente.
colors:
  acento-beely: "#dd4f3a"
  acento-beely-2: "#d03568"
  acento-beely-oscuro: "#f47b5e"
  acento-beely-2-oscuro: "#e7577f"
  sobre-acento: "#ffffff"
  fondo: "#f7f6f4"
  superficie: "#ffffff"
  hundido: "#f1efec"
  borde: "#e7e3de"
  borde-fuerte: "#d4cdc6"
  texto: "#1c1917"
  texto-2: "#44403c"
  texto-3: "#6f6862"
  fondo-oscuro: "#0e0d0c"
  superficie-oscuro: "#171513"
  hundido-oscuro: "#211e1c"
  borde-oscuro: "#2a2725"
  texto-oscuro: "#f5f3f1"
  texto-3-oscuro: "#a29b95"
  exito: "#15803d"
  peligro: "#b91c1c"
typography:
  titulo:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.022em"
  seccion:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: "1.375rem"
    letterSpacing: "-0.011em"
  cuerpo:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "-0.006em"
    fontFeature: "'cv11', 'ss01'"
  etiqueta:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: "1.125rem"
  pequeno:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
rounded:
  control: "0.5rem"
  tarjeta: "0.75rem"
  capa: "0.875rem"
  pildora: "9999px"
spacing:
  fila-x: "1.25rem"
  fila-y: "0.75rem"
  control: "2.25rem"
  control-tactil: "2.75rem"
components:
  boton-primario:
    backgroundColor: "{colors.acento-beely}"
    textColor: "{colors.sobre-acento}"
    rounded: "{rounded.control}"
    height: "{spacing.control}"
    padding: "0 14px"
  boton-contorno:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.control}"
    height: "{spacing.control}"
  boton-fantasma:
    textColor: "{colors.texto-2}"
    rounded: "{rounded.control}"
    height: "{spacing.control}"
  boton-peligro:
    backgroundColor: "{colors.peligro}"
    textColor: "{colors.sobre-acento}"
    rounded: "{rounded.control}"
    height: "{spacing.control}"
  entrada:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.control}"
    height: "{spacing.control}"
    padding: "0 12px"
  tarjeta:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.tarjeta}"
  insignia:
    backgroundColor: "{colors.hundido}"
    textColor: "{colors.texto-2}"
    rounded: "{rounded.pildora}"
  interruptor:
    rounded: "{rounded.pildora}"
    height: "1.5rem"
    width: "2.5rem"
---

# Design System: Beely

## Overview

**Creative North Star: "El mostrador ordenado"**

Beely se usa de pie, en caja, con una fila esperando, y luego con calma en la oficina para revisar números. El sistema responde a esa escena: una herramienta cálida y precisa, en la línea de Linear y Vercel, donde la interfaz se aparta y el negocio (su logo, sus sellos, sus clientes) ocupa el centro. Neutros piedra tibios en vez de grises fríos, un solo acento con el degradado coral a rosa del logo y densidad de herramienta de trabajo, no de página de marketing.

La personalidad está en los detalles y no en la decoración: los sellos como celdas de panal que se "estampan" al sumarse, el degradado del acento solo en lo que se toca, la barra flotante en móvil y transiciones cortas que confirman sin hacer esperar. Todo existe en claro y oscuro, y el acento se puede cambiar por tema (Beely, Miel, Océano, Bosque, Uva, Coral) sin tocar ningún componente.

**Key Characteristics:**
- Neutros tibios (familia piedra) con un único acento por pantalla.
- Densidad media de herramienta: controles de 36px que crecen a 44px en pantallas táctiles.
- Profundidad casi plana: bordes finos y sombras mínimas; las capas flotantes son lo único que se eleva.
- Claro y oscuro de primera clase; ningún color se escribe fuera de los tokens.
- Movimiento corto (120–240 ms) con curva de salida fuerte; nada de ease-in.

## Colors

Una paleta de piedra tibia sostiene un solo acento que cambia por tema; el éxito y el peligro solo aparecen cuando significan algo.

### Primary
- **Coral Beely** (`acento-beely` → `acento-beely-2`): el degradado de 135° del logo, del coral al rosa. Rellena el botón primario, el interruptor encendido, los sellos ganados y el ítem activo de la navegación. En claro va un poco más hondo para que el texto blanco se lea (≥ 4:1); en oscuro se aclara (`acento-beely-oscuro`) y el texto encima pasa a casi negro.

### Neutral
- **Papel tibio** (`fondo`): el fondo de la aplicación, detrás de tarjetas y paneles.
- **Hoja** (`superficie`): tarjetas, diálogos, campos y la barra flotante.
- **Mostrador** (`hundido`): zonas hundidas, botón secundario, esqueletos de carga, insignias neutras y fondos hover.
- **Línea de piedra** (`borde`, `borde-fuerte`): divisores de listas y bordes de tarjeta; el fuerte para hover de campos y el interruptor apagado.
- **Tinta** (`texto`, `texto-2`, `texto-3`): texto principal, secundario y de apoyo (metadatos, encabezados de columna, ayudas).

### Named Rules
**La regla de la voz única.** Un solo acento por tema y por pantalla. Los derivados (suave, borde, texto, foco) salen del mismo color con `color-mix`; nunca se agrega un segundo tono de marca.

**La regla del semáforo honesto.** Verde (`exito`) y rojo (`peligro`) solo comunican estado: guardado, suspendido, error, acción destructiva. Nunca como decoración.

## Typography

**Body Font:** Inter Variable (con system-ui)
**Label/Mono Font:** Geist Mono, solo para subdominios, códigos y llaves.

**Character:** una sola familia neutra y muy legible, con las alternativas `cv11` y `ss01` y tracking ligeramente negativo en los tamaños grandes. La jerarquía sale del peso y el tamaño, no de cambiar de fuente.

### Hierarchy
- **Título** (600, 1.5rem/2rem, -0.022em): el encabezado de cada página del panel.
- **Sección** (600, 0.9375rem/1.375rem): títulos de tarjeta y de diálogo; el botón grande.
- **Cuerpo** (400, 0.875rem/1.25rem): texto base, filas y campos. En pantallas táctiles los campos suben a 16px para que iOS no haga zoom.
- **Etiqueta** (500, 0.8125rem/1.125rem): etiquetas de campo, botones pequeños, selectores segmentados.
- **Pequeño** (400, 0.75rem/1rem): metadatos, encabezados de columna, ayudas y conteos.

### Named Rules
**La regla de las cifras alineadas.** Todo número que se compara (sellos, clientes, canjes, dinero) lleva `tabular-nums` y se alinea a la derecha.

## Layout

Panel: barra lateral fija en escritorio y barra flotante abajo en móvil; el contenido va en una columna centrada con encabezado de página (título, descripción y una acción a la derecha). Las listas son tarjetas con filas separadas por líneas (px 20 / py 12 en escritorio, px 16 en móvil); en escritorio una cuadrícula alinea columnas de métricas y en móvil cada fila apila sus datos y muestra solo la métrica principal. Formularios en una columna en móvil y hasta tres en escritorio. Separación vertical entre bloques de 24px.

Club: una sola columna pensada para el celular, con la tarjeta del cliente (logo, sellos en panal y QR) como protagonista. Tanto el club como el panel se instalan como PWA y respetan las zonas seguras.

### Named Rules
**La regla del dedo.** Todo control táctil mide al menos 44px (`pointer-coarse`), aunque en escritorio se vea más compacto.

## Elevation & Depth

Casi plano. Las tarjetas se separan del fondo por un borde de 1px y una sombra mínima; los botones rellenos llevan un brillo superior interno. Solo las capas flotantes (diálogos, menús, panel inferior y avisos) se elevan con una sombra difusa. En oscuro las sombras no se ven: la profundidad sale de un brillo superior sutil y un anillo de 1px.

### Named Rules
**La regla de la capa única.** Solo lo que flota sobre la página tiene sombra marcada. Una tarjeta nunca "flota".

## Shapes

Esquinas suavemente redondeadas en tres escalones: controles a 8px, tarjetas a 12px y capas flotantes a 14px. Insignias, interruptores y avatares son píldoras o círculos. El sello es la forma propia de la marca: celdas hexagonales de panal (hasta 12; con más, una barra segmentada).

## Components

### Buttons
- **Forma:** esquinas de control (8px), alto 36px (44px en táctil).
- **Primario:** relleno con el degradado del acento, texto `sobre-acento`, brillo superior interno; al pasar el cursor se oscurece un 12% hacia la tinta.
- **Contorno / Secundario / Fantasma:** superficie con borde, mostrador o solo texto, para acciones de menor peso.
- **Peligro:** rojo sólido, solo para eliminar o suspender, y siempre detrás de una confirmación.
- **Estados:** se encoge a 0.97 al presionar; deshabilitado pasa a gris neutro (no a un acento lavado); cargando muestra un spinner sin cambiar el ancho.

### Chips (Insignias)
- **Estilo:** píldora pequeña; neutra (plan) o con tono de estado (activo, suspendido, cancelado) sobre fondo suave del mismo color.

### Cards / Containers
- **Esquinas:** 12px. **Fondo:** superficie. **Borde:** 1px `borde`. **Sombra:** mínima (ver Elevation). Las listas viven dentro de tarjetas, con filas que se resaltan levemente al pasar el cursor.

### Inputs / Fields
- **Estilo:** borde de 1px, fondo superficie, esquinas de 8px, 36px de alto.
- **Foco:** el borde pasa al color de foco con un halo de 3px al 20%. **Error:** borde rojo y mensaje debajo enlazado por `aria-describedby`.

### Navigation
- **Escritorio:** barra lateral con logo, secciones con icono y el ítem activo resaltado.
- **Móvil:** barra flotante abajo, con la sección activa en una píldora del acento y "Más" para el resto.

### Interruptor
- Píldora de 40×24 con perilla blanca; encendido con el degradado del acento. La perilla se desliza en 180 ms con la curva de salida y se encoge a 0.95 al presionar. Un cambio con consecuencias (suspender un negocio) pide confirmación antes de aplicarse.

### Sellos (componente de firma)
- Celdas de panal con el logo del negocio; el sello recién ganado se "estampa" (escala 0.8 → 1 en 240 ms) y los anteriores no se animan.

## Do's and Don'ts

### Do:
- **Do** usar solo los tokens del tema (`bg-superficie`, `text-texto-3`, `rounded-tarjeta`…); así claro, oscuro y los seis temas funcionan sin tocar el componente.
- **Do** animar solo `transform`, `opacity` y colores, con `--ease-out` y las duraciones `--duracion-*` (120/180/240 ms), y respetar `prefers-reduced-motion`.
- **Do** mostrar la marca del negocio (nombre y logo) por encima de la de Beely en el club.
- **Do** confirmar con un diálogo toda acción irreversible o con consecuencias para el negocio.

### Don't:
- **Don't** escribir colores, radios o sombras fijos fuera de `tema.css`.
- **Don't** usar `transition-all`, `ease-in` ni entradas desde `scale(0)`.
- **Don't** usar el verde o el rojo como decoración.
- **Don't** duplicar componentes de `packages/ui` dentro de una app.
