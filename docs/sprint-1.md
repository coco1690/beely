# Sprint 1 — Panel del negocio

Entregable: el equipo de un negocio entra al panel (`app.hibeely.com`), configura su negocio, sedes y programa de sellos, y el cajero escanea el QR del cliente y le suma sellos.

## Qué incluye

| Pieza | Dónde |
|------|-------|
| Migración `0002_panel` | `supabase/migrations/20261027000002_panel.sql` |
| Pruebas SQL | `supabase/tests/0003_panel_aserciones.sql` |
| Datos de demostración | `supabase/seed.sql` (solo local) |
| Edge Functions | `supabase/functions/panel-sello`, `supabase/functions/panel-equipo`, utilidades en `_compartido/` |
| Esquemas zod compartidos | `packages/tipos/src/esquemas.ts` (panel y Edge Functions) |
| Componentes de UI | `packages/ui` (Boton, Campo, Entrada, Selector, Tarjeta, Aviso, Insignia, tema Tailwind v4) |
| Panel | `apps/panel` |

Modelo de datos, funciones SQL nuevas y checklist de pruebas: [modelo-datos.md](modelo-datos.md).

## Edge Functions

Ambas exigen la sesión del equipo (`Authorization: Bearer <jwt>`; `verify_jwt` activo), validan el cuerpo con zod y responden errores con el contrato `{ "error": { "codigo", "mensaje" } }`.

### `POST /functions/v1/panel-sello`

```json
{
  "negocio_id": "uuid",
  "token": "token_publico de la tarjeta (lo que trae el QR)",
  "sede_id": "uuid | null",
  "monto_venta": 25000,
  "unidades": 1,
  "clave_idempotencia": "uuid"
}
```

1. Valida el JWT y que quien llama vea el negocio por RLS (miembro de cualquier rol o plataforma). Si no → `403 sin_permiso`.
2. Llama `registrar_sello` con `service_role`, `origen = 'panel'`, `creado_por = usuario` y `venta_externa_id = 'panel:' + clave_idempotencia`. El panel genera una clave por intento: si la petición se repite (doble toque, reintento de red) responde `duplicado: true` sin sumar.
3. `monto_venta` se pide en caja cuando la regla es `por_monto` o `por_venta` con monto mínimo; `unidades` cuando es `por_unidad`.

Respuesta 200: el JSON de `registrar_sello` (`sellos_sumados`, `sellos_actuales`, `sellos_requeridos`, `premio_emitido`, `cupon`, o `motivo` + `detalle` si no sumó).

| Código | HTTP |
|-------|------|
| `no_autenticado` | 401 |
| `solicitud_invalida` | 400 |
| `sin_permiso` | 403 |
| `tarjeta_no_encontrada`, `sede_no_encontrada` | 404 |
| `tarjeta_bloqueada`, `programa_inactivo`, `negocio_inactivo` | 409 |

### `POST /functions/v1/panel-equipo`

```json
{ "negocio_id": "uuid", "email": "persona@negocio.com", "rol": "dueno | administrador | cajero" }
```

1. Permiso: el dueño invita administradores y cajeros; solo la plataforma asigna dueños. Si no → `403 sin_permiso`.
2. Si el correo no tiene cuenta, `auth.admin.inviteUserByEmail` envía la invitación con destino `{PANEL_URL}/definir-clave`. Si ya tiene cuenta (trabaja en otro negocio), solo se crea la membresía.
3. La membresía se inserta con el cliente del usuario, así RLS vuelve a validar el permiso.

Respuesta 201: `{ usuario_id, email, rol, invitado }`. Errores: `no_autenticado` 401, `solicitud_invalida` 400, `sin_permiso` 403, `ya_es_miembro` 409.

## Frontend (`apps/panel`)

React + Vite + TypeScript estricto + Zustand + Tailwind v4 + react-hook-form/zod + react-router. Lee todo con la anon key; RLS decide qué ve cada rol.

| Ruta | Quién | Qué hace |
|------|------|---------|
| `/ingresar` | Sin sesión | Correo + clave (`signInWithPassword`). Mensaje genérico si falla. |
| `/recuperar` | Sin sesión | Envía enlace para nueva clave; mismo mensaje exista o no el correo. |
| `/definir-clave` | Enlace de invitación o recuperación | Fija la clave y entra al panel. |
| `/caja` | Todo el equipo | Elegir sede (se recuerda por negocio), escanear QR con la cámara trasera (`qr-scanner`) o buscar por celular / código. Muestra nombre, celular oculto, sellos, cupones por canjear; pide monto o unidades según la regla; suma el sello y avisa si se emitió el premio o si llegó al tope del día. Lista de últimos movimientos. |
| `/programa` | Todo el equipo (edita dueño/admin) | Sellos requeridos, regla, monto mínimo o por sello, tope diario, premio y vigencia. |
| `/sedes` | Todo el equipo (edita dueño/admin; crea plataforma) | Nombre, dirección, coordenadas y si está activa. |
| `/negocio` | Dueño/admin | Nombre, razón social, NIT, colores, zona horaria. Plan y estado se ven pero no se editan. |
| `/equipo` | Dueño/admin (gestiona dueño) | Lista con correo, último ingreso e invitación pendiente; invitar, cambiar rol, quitar. |
| `/plataforma` | Admin de plataforma | Crear negocio, cambiar plan/estado, invitar dueño. |

Stores: `useSesionStore` (sesión de Auth y si es admin de plataforma) y `useNegocioStore` (negocios y rol del usuario, negocio activo, sedes, sede de la caja).

El QR puede traer el token solo o la URL de la PWA (`https://{slug}.hibeely.com/t/{token}`): la caja toma el último segmento.

## Probar en local

```bash
sudo dockerd &                 # solo en el contenedor cloud
pnpm install
pnpm db:iniciar                # o pnpm db:reset si ya estaba arriba (carga supabase/seed.sql)
pnpm exec supabase functions serve
cp apps/panel/.env.example apps/panel/.env.local   # pega la ANON_KEY de `pnpm exec supabase status`
pnpm dev:panel                 # http://127.0.0.1:5173
```

Usuarios de la semilla (clave `beely1234`):

| Correo | Rol |
|-------|-----|
| `plataforma@hibeely.test` | Admin de plataforma |
| `dueno@hibeely.test` | Dueño de Heladería Demo |
| `cajero@hibeely.test` | Cajero de Heladería Demo |

Clientes: Laura (`300 123 4567`, 3 sellos) y Pedro (`310 987 6543`, 9 sellos: el siguiente sello emite el premio). Los correos de invitación llegan a Mailpit: http://127.0.0.1:54324.

La cámara del navegador exige `https` o `localhost`; para probar con un celular en la red local usa un túnel https o escribe el celular en la caja.

## Configuración en Supabase Cloud

- Auth → desactivar registros (`enable_signup = false`, igual que `config.toml`): solo entra quien el negocio invita.
- Auth → Site URL `https://app.hibeely.com` y redirect `https://app.hibeely.com/**`.
- Secretos: `supabase secrets set PANEL_URL=https://app.hibeely.com`.
- Desplegar: `supabase functions deploy panel-sello panel-equipo`.
- Primer admin de plataforma: `insert into public.administradores_plataforma (usuario_id) values ('<uuid del usuario>');` desde el SQL editor.

## Checklist de pruebas manuales (hecho en local con Playwright y curl)

- [x] Cajero entra, ve solo Caja, Programa y Sedes; `/equipo` lo devuelve a la caja
- [x] Cajero elige sede, busca por celular y suma un sello; el evento queda con origen `panel`, sede y cajero
- [x] Con regla `por_monto` la caja pide el valor de la compra (botón inactivo sin monto) y 25.000 con 10.000 por sello suma 2
- [x] Pedir el mismo sello dos veces con la misma clave no suma doble; Pedro con 9 sellos recibe el premio
- [x] Dueño edita programa (valida monto por sello), negocio e invita a una cajera; el correo llega a Mailpit
- [x] La cajera invitada abre el enlace, define su clave y entra a la caja
- [x] Dueño no ve "Nueva sede"; la plataforma crea un negocio y una sede
- [x] Vista móvil de la caja
- [ ] Escaneo con cámara real en un celular (pendiente: requiere https)
