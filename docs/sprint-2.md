# Sprint 2 — Club del cliente (PWA)

Entregable: cada negocio tiene su club en `{slug}.hibeely.com`. El cliente se registra sin cuenta, recibe una tarjeta con QR, ve sus sellos, cupones y premios, la instala como app y puede activar o apagar las promociones en un toque.

## Qué incluye

| Pieza | Dónde |
|------|-------|
| Migración `0005_club` | `supabase/migrations/20261027000005_club.sql` |
| Pruebas SQL (55 aserciones) | `supabase/tests/0006_club_aserciones.sql` |
| Edge Function | `supabase/functions/club-registro` |
| Esquemas zod | `packages/tipos/src/esquemas.ts` (`esquemaClubRegistro`, `esquemaFechaNacimiento`, `edadMinimaClub`) |
| PWA | `apps/club` (+ `api/manifest.ts`, función de Vercel) |
| Compartido con el panel | `packages/ui` y `packages/tipos` (ver abajo) |

## Cómo entra el cliente sin cuenta: RLS por cabeceras

El cliente final no es usuario de Auth. La PWA usa la anon key y manda dos cabeceras que PostgREST deja en `request.headers` y que RLS lee con funciones del esquema `privado`:

| Cabecera | Deja ver |
|---------|---------|
| `x-negocio-slug` | La marca (columnas públicas), el programa activo, el diseño y las sedes activas de **ese** negocio, si está activo. |
| `x-tarjeta-token` | **Solo** esa tarjeta, el nombre de su cliente, sus cupones y sus sellos. El token manda sobre el slug. |

- Sin cabeceras, `anon` no ve nada (igual que antes). No hay listados: hay que nombrar el slug o tener el token.
- Grants por columna: `anon` nunca ve celular, fecha de nacimiento, NIT, plan, montos de venta, cajero ni ids de venta.
- `anon` solo puede escribir `clientes.acepta_marketing` de su cliente (opt-out en un toque) y su fila de `suscripciones_push` (guardar o revocar la suscripción del dispositivo).
- Las políticas son `to anon`: el panel (`authenticated`) no cambia aunque alguien mande las cabeceras.

Esto reemplaza las Edge Functions `club-tarjeta` y `club-push-suscribir` que preveía CLAUDE.md: misma garantía, menos piezas que desplegar y sin arranque en frío.

## `POST /functions/v1/club-registro` (pública, `verify_jwt = false`)

```json
{ "slug": "heladeria-demo", "nombre": "Ana", "celular": "+573001234567", "fecha_nacimiento": "1995-05-05", "acepta_datos": true, "acepta_marketing": true }
```

1. Valida con `esquemaClubRegistro` (celular E.164, fecha no futura y edad mínima de 14 años, autorización obligatoria).
2. Llama `club_registrar` con `service_role` y la IP **hasheada** (SHA-256).
3. `club_registrar` (SQL, una transacción): negocio activo y programa activo; límite de **30 intentos por IP y 5 por celular por hora** en el mismo negocio (una tienda comparte wifi); crea cliente con la versión vigente de la política y la tarjeta del programa.
4. Si el celular ya existe en ese negocio **no** devuelve la tarjeta (regla 3).

| Respuesta | HTTP |
|----------|------|
| `{ token }` | 201 |
| `solicitud_invalida` | 400 |
| `negocio_no_encontrado` | 404 |
| `celular_ya_registrado`, `negocio_inactivo`, `programa_inactivo` | 409 |
| `demasiados_intentos` | 429 |

Los intentos se guardan en `intentos_registro` como `ip:<sha256>` / `celular:<sha256>` y se purgan a las 24 h.

## PWA (`apps/club`)

| Ruta | Qué hace |
|------|---------|
| `/` | Si este teléfono ya tiene la tarjeta, la abre. Si no: marca del negocio, el programa ("junta 10 sellos y gana…", cómo se gana) y el registro (nombre, celular, nacimiento, autorización de datos con su política, promociones opcional). |
| `/t/{token}` | Tarjeta: el pase con los colores del diseño del negocio y el QR (solo el token, negro sobre blanco), aviso de premio listo y últimos sellos. Se refresca cada 6 s mientras está a la vista: el sello que suma la caja aparece solo con un aviso. |
| `/t/{token}/cupones` | Cupones vigentes con su código y vencimiento; historial de canjeados y vencidos. |
| `/t/{token}/perfil` | Promociones y avisos (un interruptor: `acepta_marketing` + Web Push), color y modo, instalar la app (Android: diálogo; iOS: pasos) y quitar la tarjeta de este teléfono. |

- **Negocio**: en producción sale del subdominio. Fuera de `*.hibeely.com` (local o vista previa de Vercel) se usa `?negocio={slug}` y se recuerda.
- **Token**: se guarda en `localStorage` por negocio. El manifest no fija `start_url`, así la app instalada abre en `/t/{token}` (en iOS la app instalada no comparte el almacenamiento de Safari).
- **Manifest por negocio**: el build publica `manifest-base.webmanifest` (hecho con `crearManifest`); `api/manifest.ts` (Vercel) le pone el nombre del negocio y se sirve en `/manifest.webmanifest`.
- **Service worker** (`src/sw.ts`, `vite-plugin-pwa` con `injectManifest`): precarga la app con Workbox (abre sin red) y muestra los Web Push (`{ titulo, mensaje, url, etiqueta }`); al tocar el aviso enfoca o abre la app.
- **Tema**: los 5 temas y claro/oscuro del panel. Arranca con el tema más parecido al color del negocio (`temaMasCercano`) y la persona puede cambiarlo.
- Jalar para recargar (app instalada) vuelve a pedir la tarjeta en vez de recargar la página.

## Compartido con el panel (sin duplicar)

| Qué | Dónde |
|----|------|
| Tema: tokens, `useTemaStore`, `SelectorTema`, `BotonModo`, script anti-destello | `packages/ui/src/tema.ts`, `tema-inicial.ts`, `componentes/selector-tema.tsx` |
| Estilos base del `body` | `packages/ui/src/base.css` |
| Íconos, manifest, metas de iOS en `<head>` | Plugin de Vite `pwaBeely` en `packages/ui/vite.ts` (+ `iconos/`), `crearManifest` en `src/pwa.ts` |
| Barra inferior flotante | `BarraFlotante` + `clasePestana` |
| Jalar para recargar | `JalarParaRecargar` (con `alRecargar` opcional) |
| Sellos en panal / barra | `SellosTarjeta` (la caja y el pase) |
| Casilla e interruptor | `Casilla`, `Interruptor` |
| `Cargando`, `useMedia` | `packages/ui` |
| Cliente Supabase, `invocarFuncion`, `mensajeDe`, `ErrorBeely` | `@beely/tipos/supabase` |
| Formatos (fecha, pesos, celular, token) | `packages/tipos/src/formato.ts` |
| Variables de entorno de Vite | `packages/ui/entorno.d.ts` |

## Probar en local

```bash
sudo dockerd &                         # solo en el contenedor cloud
pnpm install && pnpm db:reset          # carga la semilla
pnpm exec supabase functions serve
cp apps/club/.env.example apps/club/.env.local   # pega la ANON_KEY de `pnpm exec supabase status`
pnpm dev:club                          # http://127.0.0.1:5174/?negocio=heladeria-demo
```

Tarjetas de la semilla: `http://127.0.0.1:5174/t/demo-laura-0000000000000000000000000000000000000000000000000000000` (rellena con ceros hasta 64 caracteres).

## Despliegue

1. **Supabase Cloud**: aplicar `20261027000005_club.sql`; `supabase functions deploy club-registro --no-verify-jwt`.
2. **Vercel**: proyecto nuevo `beely-club` con raíz `apps/club`, variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLUB_DOMINIO_BASE=hibeely.com` y `VITE_VAPID_PUBLIC_KEY` (cuando haya llaves VAPID).
3. **Dominio por negocio** (decisión 2026-10-28: los DNS siguen en Hostinger, sin comodín). La Edge Function `club-dominio` (solo superadmin) agrega `{slug}.hibeely.com` al proyecto `beely-club` en Vercel y luego crea el CNAME `{slug}` en Hostinger. El panel la llama al crear el negocio, y la ficha del negocio tiene **Conectar subdominio** para reintentar. Es idempotente. Secretos: `VERCEL_TOKEN`, `VERCEL_EQUIPO_ID`, `VERCEL_PROYECTO_CLUB`, `HOSTINGER_API_TOKEN`, `CLUB_CNAME_DESTINO`. Los slugs reservados (`app`, `www`, `api`…) no se pueden usar (`slugsReservados`).
4. Sin subdominio se puede probar en `beely-club.vercel.app/?negocio={slug}`.

## Checklist de pruebas

- [x] SQL: anon sin cabeceras no ve nada; el slug muestra solo su negocio, programa, diseño y sedes activas; negocio suspendido desaparece
- [x] SQL: el token muestra solo su tarjeta, cliente, cupones y sellos; token de A con slug de B muestra solo A; token inventado no ve nada
- [x] SQL: anon no ve celular, nacimiento, NIT, plan, montos ni ids de venta; no se suma sellos, no canjea, no cambia nombre ni nacimiento
- [x] SQL: opt-out de marketing solo del propio cliente; push solo para la propia tarjeta y negocio; revoca su suscripción
- [x] SQL: `club_registrar` solo con `service_role`; celular repetido no entrega la tarjeta; único por negocio; slug inexistente, negocio suspendido y sin programa fallan; topes por celular y por IP; huellas sin datos en claro
- [x] SQL: el cajero sigue viendo solo su negocio aunque mande cabeceras
- [x] Edge Function: 201 con token, 409 celular repetido, 400 menor de edad, 404 slug inexistente
- [x] Playwright (iPhone 13): registro (exige la autorización), sello sumado desde `panel-sello` aparece solo en la tarjeta con aviso, apagar promociones guarda `acepta_marketing = false`, quitar la tarjeta y registrar el mismo celular muestra el mensaje de la regla 3
- [x] Panel: ingreso, caja y manifest siguen funcionando tras mover lo compartido
- [x] `api/manifest.ts`: nombre del negocio por subdominio y por `?negocio=`; slug inexistente devuelve la base
- [ ] Web Push real en Android e iOS instalada (faltan llaves VAPID y el motor de envío del Sprint 5)
- [x] `angelato.hibeely.com` conectado a mano (CNAME + dominio en Vercel)
- [ ] `club-dominio` en producción (faltan los tokens de Vercel y Hostinger como secretos)
