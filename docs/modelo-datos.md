# Modelo de datos — Beely

Migraciones: `supabase/migrations/20261027000001_nucleo.sql` (núcleo), `20261030000009_campanas.sql` (campañas), `20261027000002_panel.sql` (Sprint 1, panel) y `20261027000005_club.sql` (Sprint 2, club) · Pruebas: `supabase/tests/0001_nucleo.sql` (recorrido), `0002_nucleo_aserciones.sql` y `0003_panel_aserciones.sql` (aserciones, corren en CI)

El Sprint 1 no agrega tablas: agrega funciones, políticas y validaciones sobre las del núcleo.

## Diagrama ER

```mermaid
erDiagram
    planes ||--o{ negocios : "plan asignado"
    negocios ||--o{ miembros_negocio : "equipo"
    auth_users ||--o{ miembros_negocio : "usuario del panel"
    auth_users ||--o| superadmins : "superadmin Beely"
    negocios ||--o{ sedes : "tiene"
    negocios ||--o{ clientes : "registra"
    negocios ||--o{ programas : "define"
    programas ||--|| disenos_tarjeta : "se ve como"
    programas ||--o{ tarjetas : "emite"
    clientes ||--o{ tarjetas : "posee"
    tarjetas ||--o{ eventos_sello : "ledger"
    sedes ||--o{ eventos_sello : "donde"
    tarjetas ||--o{ cupones : "recibe"
    ofertas ||--o{ cupones : "plantilla"
    campanas ||--o{ cupones : "origina"
    negocios ||--o{ ofertas : "crea"
    negocios ||--o{ campanas : "lanza"
    campanas ||--o{ envios_campana : "envía"
    tarjetas ||--o{ envios_campana : "a"
    tarjetas ||--o{ suscripciones_push : "dispositivos"
    tarjetas ||--o{ pases_wallet : "google/apple"
    negocios ||--o{ llaves_api : "integra POS"
    negocios ||--o{ intentos_registro : "límite de registro"

    negocios {
        uuid id PK
        text slug UK "subdominio"
        text nombre
        text plan FK "planes.codigo"
        smallint max_push_semana
        time hora_inicio_envios
    }
    planes {
        text codigo PK
        text nombre UK
        numeric precio_mensual
        integer max_sedes "null = sin límite"
        integer max_clientes "null = sin límite"
        boolean activo
    }
    clientes {
        uuid id PK
        uuid negocio_id FK
        text celular "E.164, único por negocio"
        text nombre
        date fecha_nacimiento
        bool acepta_datos
        bool acepta_marketing
    }
    programas {
        uuid id PK
        uuid negocio_id FK
        smallint sellos_requeridos
        text regla_sello "por_venta | por_unidad | por_monto"
        smallint max_sellos_dia
        text premio_descripcion
    }
    tarjetas {
        uuid id PK
        uuid cliente_id FK
        uuid programa_id FK
        text token_publico UK "QR"
        smallint sellos_actuales
        int sellos_historicos
        timestamptz ultima_visita_en
    }
    eventos_sello {
        uuid id PK
        uuid tarjeta_id FK
        smallint cantidad "negativo = canje/ajuste"
        text origen
        text venta_externa_id "idempotencia"
    }
    cupones {
        uuid id PK
        uuid tarjeta_id FK
        text codigo "único por negocio"
        text origen
        text estado
        timestamptz vence_en
    }
    campanas {
        uuid id PK
        text disparador
        jsonb config
        jsonb segmento "filtro: todos | inactivos | cumple | nuevos"
        text_arr canales "push | wallet | club"
        text estado
        timestamptz programada_para "empieza"
        timestamptz termina_en "vencen sus cupones"
        timestamptz lanzada_en
        timestamptz cancelada_en
    }
```

## Tablas

| Tabla | Para qué | Escribe |
|-------|---------|---------|
| `superadmins` | Usuarios con control total de Beely | Superadmin desde el panel (`superadmin_agregar` / `superadmin_quitar`) o SQL para el primero |
| `planes` | Planes de Beely: código, nombre, precio mensual (COP), máximo de sedes y de clientes (null = sin límite), activo. Sin `negocio_id`: es de plataforma. Migración `0007_planes` | Solo superadmin (RLS), desde `/superadmin/planes`. No se borran: se desactivan |
| `negocios` | Cada empresa cliente de Beely (marca, plan, límites de envío) | Superadmin crea; dueño/admin editan columnas de marca |
| `miembros_negocio` | Equipo del negocio con rol | Dueño (administradores y cajeros) · Superadmin (dueños) · Edge Function `panel-equipo` |
| `sedes` | Puntos de venta con coordenadas (para Wallet) | Superadmin crea; dueño/admin editan |
| `clientes` | Cliente final de un negocio + autorizaciones Ley 1581 | Edge Function `club-registro`; equipo solo marca `celular_verificado` |
| `programas` | Reglas de sellos y premio (uno activo por negocio) | `crear_negocio()` crea el primero; dueño/admin editan |
| `disenos_tarjeta` | Apariencia del pase y de la PWA; `version` sube → re-sincronizar Wallet | Dueño/admin |
| `tarjetas` | Tarjeta del cliente en un programa; contadores denormalizados | Solo funciones SQL |
| `eventos_sello` | Ledger inmutable de sellos (+venta, −premio, ±ajuste) | Solo `registrar_sello()` |
| `ofertas` | Plantillas de descuento | Dueño/admin |
| `cupones` | Cupones emitidos a una tarjeta | Funciones SQL / Edge Functions |
| `campanas` | Configuración de campañas y disparadores. Desde la 0009, promociones que emiten un cupón por tarjeta | Solo funciones (`campana_guardar`, `campana_lanzar`, `campana_cancelar`, `campana_eliminar`) y pg_cron |
| `envios_campana` | Cola y registro de cada push (`pendiente → enviando → enviado/fallido/omitido`, un envío por campaña, tarjeta y canal); base del tope semanal | `emitir_campana` encola, `campanas-motor` envía con `push_tomar` / `push_registrar` |
| `suscripciones_push` | Endpoints Web Push por dispositivo | `club-push-suscribir` |
| `pases_wallet` | Pase emitido en Google/Apple por tarjeta | `wallet-google` / `wallet-apple` |
| `llaves_api` | Llaves del POS (solo hash) | `llaves-api` |
| `intentos_registro` | Intentos de registro de la última hora (huellas SHA-256 de IP y celular) | Solo `club_registrar()` |

## Funciones de negocio

### `registrar_sello(negocio_id, token_tarjeta, venta_externa_id, sede_id?, monto_venta?, unidades?, origen?, creado_por?) → jsonb`

1. Si `venta_externa_id` ya existe para el negocio → `{ duplicado: true }` sin sumar.
2. Bloquea la tarjeta (`for update`) para evitar carreras entre cajas.
3. Calcula sellos según `regla_sello` y recorta por `max_sellos_dia` (zona del negocio).
4. Inserta en `eventos_sello`; si completa la tarjeta emite cupón `premio_sellos` y registra el descuento de sellos.
5. Devuelve `sellos_sumados`, `sellos_actuales`, `premio_emitido` y el cupón si aplica.

Desde la migración 0002 también valida que el negocio esté `activo` y que la sede (si viene) sea del negocio y esté activa. Si no suma nada devuelve `motivo: sin_sellos_aplicables` y `detalle`: `tope_diario` (ya llegó a `max_sellos_dia`) o `compra_no_aplica` (monto bajo el mínimo).

Errores: `tarjeta_no_encontrada`, `tarjeta_bloqueada`, `programa_inactivo`, `origen_invalido`, `negocio_inactivo`, `sede_no_encontrada`.

### `canjear_cupon(negocio_id, codigo, venta_externa_id?, sede_id?, canjeado_por?) → jsonb`

Canjea un cupón emitido y vigente. Repetir con la misma venta devuelve `{ duplicado: true }`.

Errores: `cupon_no_encontrado`, `cupon_ya_canjeado`, `cupon_no_disponible`, `cupon_vencido`.

Ambas solo se pueden ejecutar con `service_role`.

### Funciones del panel (migración 0002)

| Función | Quién | Hace | Errores |
|--------|-------|------|---------|
| `crear_negocio(slug, nombre, zona_horaria?) → uuid` | Superadmin | Crea el negocio con su programa de sellos y diseño de tarjeta por defecto | `sin_permiso`, `slug_en_uso`, `zona_horaria_invalida` |
| `superadmin_actualizar_negocio(negocio_id, plan, estado)` | Superadmin | Cambia plan y estado (columnas que el negocio no puede tocar). Desde la 0007 el plan nuevo debe existir y estar activo; conservar uno desactivado sí se permite | `sin_permiso`, `negocio_no_encontrado`, `plan_no_disponible` |
| `equipo_negocio(negocio_id) → table` | Dueño / administrador | Equipo con correo, rol, último ingreso e invitación pendiente | `sin_permiso` |
| `usuario_por_email(email) → uuid` | Solo `service_role` | La usa `panel-equipo` para no reinvitar a quien ya tiene cuenta | — |

Logo propio (marca blanca, migración `0004_logos`): bucket público de Storage `logos`, ruta `{negocio_id}/logo-{marca de tiempo}.{png|jpg|webp}`, hasta 2 MB y sin SVG. Solo dueño, administrador o superadmin del negocio escriben en su carpeta (`privado.negocio_de_ruta(name)` + `privado.tiene_rol`). La URL pública queda en `negocios.logo_url` (check `negocios_logo_url_https`). Panel y club lo muestran con `LogoNegocio` de `packages/ui`.

Trigger `negocios_zona_horaria`: rechaza zonas horarias que Postgres no conoce (`zona_horaria_invalida`), porque el tope diario de sellos se calcula con ellas.

### Reglas de equipo (RLS de `miembros_negocio`)

- El dueño invita, cambia de rol y quita **administradores y cajeros**; no puede crear dueños, ascender a dueño ni tocar su propia fila.
- Solo el superadmin asigna o quita dueños.
- El administrador ve el equipo pero no lo gestiona; el cajero no lo ve.
- Del equipo solo se puede actualizar la columna `rol`.

### Club (migración 0005)

| Función | Quién | Hace |
|--------|-------|------|
| `club_registrar(slug, celular, nombre, fecha_nacimiento, acepta_marketing, huella_ip) → jsonb` | Solo `service_role` (`club-registro`) | Crea cliente + tarjeta con límite de intentos; `{registrado, token}` o `{registrado:false, motivo}` |
| `privado.tarjeta_club()`, `cliente_club()`, `negocio_club()` | Políticas de `anon` | Resuelven las cabeceras `x-tarjeta-token` / `x-negocio-slug` |

RLS de `anon` (la PWA): ve el negocio del slug o del token, su programa activo, diseño y sedes activas; con token, solo su tarjeta, cliente (nombre), cupones y sellos; escribe `clientes.acepta_marketing` y su `suscripciones_push`. Detalle en [sprint-2.md](sprint-2.md).

### Panel del superadmin (migración 0006)

| Función | Quién | Hace | Errores |
|--------|-------|------|---------|
| `superadmin_tablero(dias = 30) → jsonb` | Superadmin | Totales de la plataforma (negocios por estado y plan, clientes, sellos, cupones) y serie diaria de sellos y clientes nuevos, con días cortados en hora de Colombia | `sin_permiso`, `solicitud_invalida` |
| `superadmin_negocios(dias = 30) → setof` | Superadmin | Cada negocio con sedes, miembros, correo del dueño, clientes, sellos y canjes de la ventana y último sello | `sin_permiso`, `solicitud_invalida` |
| `superadmin_eliminar_negocio(negocio_id, confirmacion)` | Superadmin | Borra el negocio y todo lo suyo; exige el subdominio exacto. El panel borra antes su carpeta de `logos` | `sin_permiso`, `negocio_no_encontrado`, `confirmacion_incorrecta` |
| `superadmin_equipo(busqueda?) → setof` | Superadmin | Lista superadmins con correo y último ingreso | `sin_permiso` |
| `superadmin_agregar(email) → uuid` | Superadmin | Hace superadmin a una cuenta existente | `sin_permiso`, `usuario_no_encontrado`, `ya_es_superadmin` |
| `superadmin_quitar(usuario_id)` | Superadmin | Quita a otro superadmin; nadie se quita a sí mismo, así siempre queda uno | `sin_permiso`, `no_puedes_quitarte`, `usuario_no_encontrado` |

### Clientes (migración 0008)

| Función | Quién | Hace | Errores |
|--------|-------|------|---------|
| `clientes_negocio(negocio_id, busqueda?, filtro = 'todos', orden = 'reciente', limite = 50, desde = 0) → setof` | Dueño / administrador / superadmin (`security invoker`: aplica además la RLS) | Clientes del negocio con su tarjeta (sellos actuales y requeridos, históricos, premios, cupones vigentes, última visita) y `total` del filtro en cada fila. Filtros: `todos`, `premio`, `cumple` (mes actual en la zona del negocio), `inactivos` (registrados y sin volver hace más de 30 días). Orden: `reciente`, `visita`, `sellos`, `nombre`. Busca por nombre o por 3+ dígitos del celular, sin comodines | `sin_permiso`, `solicitud_invalida` |
| `clientes_resumen(negocio_id) → jsonb` | Dueño / administrador / superadmin | Cuántos clientes hay en total, nuevos en 30 días, con marketing y en cada filtro | `sin_permiso` |
| `superadmin_clientes(negocio_id?, busqueda?, limite = 50, desde = 0) → setof` | Superadmin | Clientes de toda la plataforma con su negocio, celular y fecha de nacimiento (datos completos por decisión de producto, 2026-10-30), sellos, premios y última visita | `sin_permiso`, `solicitud_invalida` |

### Campañas de promociones (migración 0009)

Una campaña es una promoción (`ofertas.tipo`: `porcentaje`, `monto_fijo`, `producto_gratis`, `dos_por_uno`) para un grupo de clientes y unas fechas. Al lanzarla, cada tarjeta del grupo recibe un cupón `origen = 'campana'` (único por campaña y tarjeta) que vence al terminar el último día en la zona del negocio y se canjea en caja con `canjear_cupon()` como cualquier otro. Solo reciben quienes aceptan promociones (`acepta_marketing`, regla 8) y tienen la tarjeta activa del programa activo. Hoy el canal es el club (`canales = {club}`); push y Wallet llegan en el Sprint 5.

| Función | Quién | Hace | Errores |
|--------|-------|------|---------|
| `campana_guardar(negocio_id, tipo, titulo, filtro, inicia, termina, valor?, producto?, mensaje?, campana_id?) → uuid` | Dueño / administrador / superadmin | Crea o edita un borrador y su oferta. `inicia` y `termina` son días del negocio; empieza a las 00:00 de `inicia` | `sin_permiso`, `solicitud_invalida`, `fechas_invalidas`, `campana_no_encontrada`, `campana_no_editable` |
| `campana_lanzar(campana_id) → jsonb` | Ídem | Si su día llegó emite los cupones ya (`{programada:false, cupones}`); si no, la deja `activa` y la emite pg_cron | `campana_no_encontrada`, `campana_no_editable`, `negocio_inactivo`, `campana_vencida` |
| `campana_cancelar(campana_id) → jsonb` | Ídem | Anula los cupones sin canjear (`{anulados}`) y la finaliza | `campana_no_encontrada`, `campana_no_editable` |
| `campana_eliminar(campana_id)` | Ídem | Borra un borrador y su oferta | `campana_no_encontrada`, `campana_no_editable` |
| `campanas_negocio(negocio_id) → setof` | Ídem (`security invoker`) | Campañas con su oferta, estado visible (`borrador`, `programada`, `en_curso`, `terminada`, `cancelada`), días y cupones emitidos/canjeados | `sin_permiso` |
| `campanas_alcance(negocio_id) → jsonb` | Ídem | Cuántas tarjetas hay hoy en cada grupo y cuántos clientes en total | `sin_permiso` |
| `privado.lanzar_campanas_programadas()` | pg_cron cada 10 min (`beely-campanas-programadas`) | Emite las programadas cuyo día llegó y cierra las que vencieron sin lanzarse | — |

Grupos (`segmento.filtro`): `todos`; `inactivos` (registrados y sin volver hace más de 30 días); `cumple` (cumplen este mes en la zona del negocio y ya tienen un sello, como el bono de cumpleaños); `nuevos` (registrados en los últimos 30 días). El grupo se evalúa el día del lanzamiento.

`authenticated` ya no inserta, actualiza ni borra `campanas` directo. El club (anon) ve `titulo` y `mensaje` solo de las campañas de las que su tarjeta tiene un cupón, y `cupones.campana_id`. Pantallas: `/campanas`, `/campanas/nueva` y `/campanas/:id` (borrador), para dueño y administrador.

El cajero no lista clientes: en caja solo abre una tarjeta por QR o celular. Pantallas: `/clientes` (dueño y administrador) y `/superadmin/clientes` (acepta `?negocio=` desde la ficha).

"Sellos" en las métricas son los de venta (`origen in ('api_pos', 'panel')`, cantidad positiva); no cuentan ajustes ni el descuento al emitir premio. El panel de plataforma vive en `/superadmin` (tablero), `/superadmin/negocios`, `/superadmin/negocios/:id`, `/superadmin/clientes` y `/superadmin/equipo`.

## Checklist de pruebas (Supabase local con Postgres 17)

### Núcleo (`0002_nucleo_aserciones.sql`)

- [x] Sello normal suma 1
- [x] Misma `venta_externa_id` no suma dos veces
- [x] Tope diario de 3 sellos se respeta
- [x] Token de otro negocio es rechazado
- [x] Al completar 10 sellos se emite el premio y la tarjeta vuelve a 0
- [x] Canje funciona; repetir con la misma venta es idempotente; otra venta es rechazada
- [x] Cajero de A solo ve datos de A
- [x] Cajero no puede crear sedes, insertar sellos directo ni llamar `registrar_sello`
- [x] Cajero no puede editar fecha de nacimiento; sí puede marcar celular verificado
- [x] Administrador no puede cambiar el plan del negocio
- [x] Usuario sin negocio y `anon` no ven nada

### Sprint 1 (`0003_panel_aserciones.sql`)

- [x] Superadmin crea negocio con programa activo y diseño; slug repetido y zona horaria inválida fallan
- [x] Superadmin crea sedes, asigna dueños y cambia plan
- [x] Dueño agrega administradores y cajeros y cambia su rol; no crea ni asciende dueños, no toca otro negocio, no cambia la llave de un miembro, no se borra a sí mismo
- [x] Dueño y administrador ven el equipo con correo; cajero y otros negocios reciben `sin_permiso`
- [x] Dueño no crea negocios ni cambia su plan; `usuario_por_email` es solo de `service_role`
- [x] Dueño edita marca y programa; zona horaria inválida falla al editar
- [x] Cajero no gestiona equipo, no edita programa ni sedes y solo ve las sedes de su negocio
- [x] Administrador edita sedes pero no quita cajeros
- [x] Sello desde el panel guarda origen `panel`, sede y cajero
- [x] Sede de otro negocio o inactiva → `sede_no_encontrada`; negocio suspendido → `negocio_inactivo`; la venta repetida sigue siendo idempotente
- [x] `detalle` distingue `compra_no_aplica` (monto bajo el mínimo) de `tope_diario`

### Logos (`0005_logos_aserciones.sql`)

- [x] Bucket `logos` público, de 2 MB y sin SVG; `negocio_de_ruta` solo acepta carpetas con uuid
- [x] Dueño sube, lista y borra el logo de su negocio y guarda `logo_url`; `logo_url` que no sea http(s) falla
- [x] Dueño no sube en la carpeta de otro negocio ni fuera de una carpeta de negocio
- [x] Cajero no sube ni borra logos; el dueño de otro negocio no lista ni borra logos ajenos

### Sprint 2 (`0006_club_aserciones.sql`)

- [x] anon sin cabeceras no ve nada; el slug muestra solo su negocio, programa activo, diseño y sedes activas
- [x] El token muestra solo su tarjeta, cliente, cupones y sellos; nunca celular, nacimiento, montos ni ids de venta
- [x] anon solo cambia `acepta_marketing` de su cliente y su suscripción push
- [x] `club_registrar`: solo service_role, celular repetido no entrega tarjeta, único por negocio, topes por IP y celular
- [x] El panel no cambia con las cabeceras

### Panel del superadmin (`0007_superadmin_panel_aserciones.sql`)

- [x] `superadmin_negocios` cuenta clientes, sedes, equipo y dueño; los sellos del periodo excluyen canjes, ajustes y lo que queda fuera de la ventana
- [x] `superadmin_tablero` suma lo mismo que la serie diaria y trae un punto por día
- [x] Agregar superadmin exige cuenta existente y no duplica; nadie se quita a sí mismo
- [x] Dueño y anon no llaman ninguna de estas funciones
- [x] Eliminar exige el subdominio y borra clientes, tarjetas y equipo del negocio sin tocar los demás

### Clientes (`0009_clientes_aserciones.sql`)

- [x] Dueño y administrador listan los clientes de su negocio; el cajero, otro negocio y anon reciben `sin_permiso` / permiso denegado
- [x] Filtros `premio` (solo cupones emitidos y vigentes), `cumple` e `inactivos`, búsqueda por nombre o parte del celular sin comodines, orden y paginación
- [x] `clientes_resumen` cuenta lo mismo que cada filtro
- [x] `superadmin_clientes` ve todos los negocios, filtra por negocio, busca por celular y trae el celular completo

### Campañas (`0010_campanas_aserciones.sql`)

- [x] Alcance solo con quien acepta promociones y tiene tarjeta activa; `cumple` exige un sello
- [x] Guardar valida tipo, valor, producto, grupo y fechas; editar conserva la oferta; nadie escribe `campanas` directo
- [x] Lanzar hoy emite un cupón por tarjeta, con texto, vencimiento y oferta; no se lanza, edita ni borra dos veces; emitir de nuevo no duplica
- [x] El cupón de campaña se canjea con `canjear_cupon`; la lista trae estado, días y resultados
- [x] Cajero y otro negocio no listan, crean ni cancelan; anon no llama las funciones
- [x] El club ve título y mensaje solo de sus campañas, nunca el segmento
- [x] Cancelar anula los cupones sin canjear y conserva el canjeado
- [x] Programada: el job la emite cuando llega su día, una sola vez, y cierra las vencidas
- [x] Borrar un borrador borra su oferta; un negocio suspendido no lanza
