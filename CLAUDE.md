# Beely 🐝 — Plataforma de fidelización multi-negocio

> Dominio: **hibeely.com** · Empresa: Novura · Idioma del proyecto: **español** (código, comentarios, variables, tablas, UI y commits).

## Qué es

Beely es un SaaS que le da a cualquier negocio (heladerías, cafés, restaurantes, barberías…) un programa de fidelización propio:

- **Tarjeta de sellos digital** (ej. 10 helados = 1 gratis), en la PWA y en **Google Wallet / Apple Wallet**.
- **Cupones y ofertas** con vigencia y límite de usos.
- **Campañas** por push y por Wallet: manuales, programadas, por inactividad, cumpleaños, clima, horas valle, premio listo.
- **Editor de tarjeta**: cada negocio cambia colores, logo, textos y ubicaciones de su pase.
- **API para POS**: cualquier POS suma sellos y canjea cupones. **Angelato** (nuestro POS) es el primer integrador y la usa como un cliente externo más, sin atajos.

Beely es independiente del POS. Nunca importar código de Angelato ni compartir base de datos con él.

## Monorepo

```
beely/
├── apps/
│   ├── panel/          # Panel web del negocio y del superadmin (app.hibeely.com)
│   └── club/           # PWA del cliente final, una por negocio ({slug}.hibeely.com)
├── packages/
│   ├── tipos/          # Tipos de Supabase, esquemas zod, formatos y cliente Supabase (`@beely/tipos/supabase`)
│   └── ui/             # Componentes shadcn/ui, tema (tokens, store, selector), PWA (`@beely/ui/vite`) y base.css
├── supabase/
│   ├── migrations/     # SQL versionado (nunca editar una migración ya aplicada)
│   ├── functions/      # Edge Functions (Deno)
│   └── tests/          # Pruebas SQL de reglas de negocio y RLS
├── servicios/
│   └── wallet-apple/   # Microservicio Node: firma .pkpass y APNs (sprint posterior)
├── docs/               # Arquitectura, modelo de datos, contrato de API
├── pnpm-workspace.yaml
└── CLAUDE.md
```

- Gestor: **pnpm workspaces**. Node LTS.
- `apps/*` importan de `packages/*` con `workspace:*`. Nunca importar entre apps.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + TypeScript estricto + Zustand + Tailwind  |
| PWA | `vite-plugin-pwa` (service worker con Workbox, manifest dinámico por negocio) |
| Backend | Supabase: Postgres, Auth (solo equipo del negocio), Storage, Edge Functions, pg_cron |
| Push | Web Push con VAPID (`web-push` / implementación Deno en Edge Function) |
| Wallet | Google Wallet API (JWT "Guardar en Google Wallet" + PATCH de LoyaltyObject); Apple Wallet en `servicios/wallet-apple` |
| Validación | zod en frontend y en Edge Functions (mismos esquemas desde `packages/tipos`) |
| Deploy | Vercel (dominio wildcard `*.hibeely.com`), Supabase Cloud |
| Cobros | Wompi (planes por negocio) |

## Roles

| Rol | Dónde vive | Puede |
|-----|-----------|-------|
| `superadmin` | tabla `superadmins` | Todo. Crea negocios y sedes, cambia plan y estado, asigna dueños. |
| `dueno` | `miembros_negocio.rol` | Configura programa, tarjeta, ofertas, campañas, equipo y llaves API. |
| `administrador` | `miembros_negocio.rol` | Igual que dueño, excepto equipo y llaves API. |
| `cajero` | `miembros_negocio.rol` | Escanea QR, suma sellos y canjea cupones desde el panel. Solo lectura del resto. |
| Cliente final | **No es usuario de Auth** | Usa la PWA con el token opaco de su tarjeta. |

## Reglas de negocio (no negociables)

1. **Aislamiento por `negocio_id`.** Toda tabla tiene `negocio_id` y RLS activo. Ninguna consulta del frontend filtra "a mano" como única protección.
2. **El cliente se registra con celular + nombre + fecha de nacimiento + autorización de datos.** Sin OTP en el MVP. El celular es único **por negocio** (`clientes.unique(negocio_id, celular)`), no global: cada negocio es responsable de sus datos (Ley 1581).
3. **Si el celular ya existe en ese negocio**, la PWA NO devuelve la tarjeta existente (evita robo de tarjeta). Muestra: "Este número ya tiene tarjeta; pide en caja que te la reenvíen o verifica tu número". Recuperación por OTP (WhatsApp) en un sprint posterior.
4. **La fecha de nacimiento no se edita desde la PWA.** El bono de cumpleaños exige al menos 1 sello previo.
5. **Los sellos nacen en una venta.** Solo `public.registrar_sello()` escribe sellos, llamada por Edge Function con `service_role`. Idempotente por `venta_externa_id`. Respeta `max_sellos_dia` en la zona horaria del negocio.
6. **Premio automático.** Al llegar a `sellos_requeridos` se emite un cupón `premio_sellos` y se descuentan los sellos, en la misma transacción.
7. **Canjes solo con `public.canjear_cupon()`**: un uso, vigente, idempotente por venta.
8. **Límites de envío** por negocio: `max_push_semana` por cliente y franja `hora_inicio_envios`–`hora_fin_envios`. Solo a clientes con `acepta_marketing = true`. Opt-out en un toque.
9. **Llaves API**: se muestran una sola vez al crearlas; en BD solo `prefijo` + `hash` SHA-256.
10. **Token de tarjeta** (`tarjetas.token_publico`): opaco, nunca el celular ni la cédula. Va en el QR y en la URL de la PWA.

## Seguridad y Supabase

- Funciones auxiliares de RLS en el esquema `privado` (no expuesto): `privado.tiene_rol(negocio_id, roles[])`, `privado.es_superadmin()`.
- En políticas envolver funciones en `select` para que se evalúen una vez: `using ((select privado.tiene_rol(...)))`.
- RLS decide filas; `grant update (columnas)` decide columnas. No dar `update` de tabla completa a `authenticated`.
- Toda FK lleva índice. Fechas en `timestamptz`, dinero en `numeric(12,2)`, textos en `text` con `check`.
- `security definer` siempre con `set search_path = ''` y nombres calificados (`public.tabla`).
- La `service_role` key **solo** en Edge Functions y servicios. Nunca en `apps/*`.
- Antes de cerrar una migración: aplicar en local (`pnpm db:reset`), correr `pnpm db:probar`, regenerar tipos (`pnpm db:tipos`) y revisar `get_advisors` (seguridad y rendimiento). CI repite migraciones, lint, pruebas y tipos en cada PR.

## Edge Functions previstas

| Función | Quién la llama | Hace |
|--------|---------------|------|
| `club-registro` | PWA (anon) | Valida zod, crea cliente + tarjeta, devuelve token. Rate limit por IP y por celular. ✅ Sprint 2 |
| ~~`club-tarjeta`~~ | PWA (anon + token) | Reemplazada por RLS con la cabecera `x-tarjeta-token` (Sprint 2): la PWA lee su tarjeta directo. Los links de Wallet llegan con `wallet-google` (Sprint 4). |
| ~~`club-push-suscribir`~~ | PWA | Reemplazada por RLS: la PWA guarda/revoca su fila de `suscripciones_push` con la cabecera del token. |
| `pos-sellos` | POS (llave API) | `POST /v1/sellos` → `registrar_sello`. |
| `pos-cupones-canjear` | POS (llave API) | `POST /v1/cupones/canjear` → `canjear_cupon`. |
| `pos-clientes` | POS (llave API) | Buscar tarjeta por token o celular. |
| `panel-sello` | Panel (cajero autenticado) | Igual que `pos-sellos` pero con sesión del cajero. ✅ Sprint 1 |
| `panel-equipo` | Panel (dueño o superadmin) | Invita al equipo por correo y crea la membresía. ✅ Sprint 1 |
| `wallet-google` | Interno | Crea/actualiza LoyaltyClass y LoyaltyObject, genera JWT de guardado. |
| `campanas-motor` | pg_cron | Evalúa disparadores, aplica topes y envía push/Wallet. |
| `llaves-api` | Panel (dueño) | Genera llave, guarda hash, la muestra una vez. |

Contrato de errores de la API: `{ "error": { "codigo": "tarjeta_no_encontrada", "mensaje": "..." } }` con HTTP 4xx. Los códigos salen de las excepciones de las funciones SQL.

## Convenciones de código

- Español en todo: `registrarSello`, `useTarjetaStore`, `PantallaRegistro.tsx`. Tablas y columnas en snake_case sin tildes ni ñ (`campanas`, `dueno`).
- TypeScript `strict`. Sin `any`. Tipos de BD con `supabase gen types` → `packages/tipos`.
- Estado global con Zustand, un store por dominio (`useSesionStore`, `useNegocioStore`).
- Formularios con react-hook-form + zod.
- Componentes de UI desde `packages/ui`; no duplicar shadcn en cada app. Lo que usen panel y club (tema, barra flotante, jalar para recargar, sellos, PWA, cliente Supabase, formatos) vive en `packages/*`, nunca copiado en una app.
- La PWA del club no tiene sesión: lee con la anon key y las cabeceras `x-negocio-slug` / `x-tarjeta-token`, que RLS valida (ver `docs/sprint-2.md`).
- Commits en español, imperativo: `agrega editor de colores de la tarjeta`.

## Definición de terminado (cada sprint)

Ningún sprint se cierra sin: SQL completo con migración, especificación de Edge Functions, especificación de frontend, diagrama ER actualizado (`docs/modelo-datos.md`), checklist de pruebas y variables de entorno documentadas.

## Variables de entorno

```bash
# apps/panel y apps/club
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_CLUB_DOMINIO_BASE=hibeely.com   # panel: muestra {slug}.hibeely.com · club: saca el slug del subdominio

# Edge Functions (supabase secrets set ...)
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:soporte@hibeely.com
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_SERVICE_ACCOUNT_JSON=
CLUB_DOMINIO_BASE=hibeely.com
PANEL_URL=https://app.hibeely.com   # destino de las invitaciones al equipo
```

## Roadmap

| Sprint | Entregable |
|--------|-----------|
| 0 | Monorepo, Supabase local, migración `0001_nucleo` (hecha), CI con pruebas SQL |
| 1 | Panel: login del equipo, negocio, sedes, programa de sellos, cajero escanea QR y suma sellos (ver `docs/sprint-1.md`) |
| 2 | PWA club: registro, tarjeta con QR, cupones, instalación, manifest por negocio (ver `docs/sprint-2.md`) |
| 3 | API POS con llaves + integración Angelato |
| 4 | Google Wallet + editor de tarjeta con vista previa |
| 5 | Ofertas, cupones manuales y Web Push con campañas manuales/programadas |
| 6 | Motor de campañas automáticas (inactividad, cumpleaños, clima, hora valle) + analítica |
| 7 | Apple Wallet (`servicios/wallet-apple`) + recuperación de tarjeta por OTP |
| 8 | Planes y cobro con Wompi, onboarding de negocios |
