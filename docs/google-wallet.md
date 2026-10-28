# Google Wallet — tarjeta de sellos en Android

El cliente toca **Agregar a Google Wallet** en su tarjeta del club (`{slug}.hibeely.com/t/{token}`) y el pase queda en la app Google Wallet con el QR de la tarjeta, sus sellos y sus premios listos. Cada vez que la caja suma un sello, el pase se actualiza solo. Apple Wallet queda para el Sprint 7 (el botón no aparece en iPhone).

## Piezas

| Pieza | Dónde |
|------|-------|
| Edge Function pública | `supabase/functions/wallet-google` (`verify_jwt = false`) |
| Cliente de la API de Google Wallet | `supabase/functions/_compartido/google-wallet.ts` (JWT RS256 con WebCrypto, sin dependencias) |
| Sincronización al sumar sellos | `supabase/functions/panel-sello` (en segundo plano, no demora la caja) |
| Botón en la PWA | `apps/club/src/componentes/BotonGoogleWallet.tsx` |
| Esquema zod | `esquemaWalletGoogle` en `packages/tipos/src/esquemas.ts` |

No hay migración: usa `pases_wallet` y `disenos_tarjeta.google_clase_id` del núcleo (solo `service_role` las escribe).

## Cómo funciona

```
PWA ──POST {slug, token}──▶ wallet-google ──▶ Google Wallet API
                              │  1. clase  {issuer}.programa-{programa_id}  (insert, o PATCH si existe)
                              │  2. objeto {issuer}.tarjeta-{tarjeta_id}    (insert, o PATCH si existe)
                              │  3. pases_wallet (tarjeta, 'google') + disenos_tarjeta.google_clase_id
                              ◀── { url: https://pay.google.com/gp/v/save/{jwt} }
PWA ──navega a url──▶ Google Wallet guarda el pase

panel-sello ──registrar_sello──▶ ok ──(si la tarjeta tiene pase)──▶ PATCH del objeto
```

- **Clase (una por programa):** nombre del negocio, título del diseño, logo (diseño → negocio → ícono de Beely), banda si hay, color de fondo (el del diseño propio o el color primario del negocio, igual que la PWA). País `CO`.
- **Objeto (uno por tarjeta):** nombre del cliente, `Sellos 7/10`, `Premios listos` (cupones emitidos vigentes), QR con `token_publico`, el premio, cuántos sellos faltan y un enlace a la tarjeta en el club. Tarjeta bloqueada → `INACTIVE`.
- **JWT de guardado:** solo referencia el objeto ya creado, así el enlace es corto. `origins` = el subdominio del club.
- **Seguridad:** el token de la tarjeta es la prueba de que es del cliente (igual que el resto de la PWA). La función busca la tarjeta por token **y** slug con `service_role`; nunca devuelve datos, solo el enlace.
- Si el negocio cambia el diseño (`disenos_tarjeta.version` sube), la siguiente sincronización también actualiza la clase.
- Si faltan los secretos, `wallet-google` responde `503 wallet_no_configurado` y `panel-sello` sigue igual.

### Contrato

```
POST /functions/v1/wallet-google
{ "slug": "angelato", "token": "…" }
200 { "url": "https://pay.google.com/gp/v/save/eyJ…" }
404 tarjeta_no_encontrada · 409 tarjeta_bloqueada · 503 wallet_no_configurado · 502 wallet_fallo
```

## Configuración (una sola vez, la hace el dueño de la cuenta)

1. **Google Cloud** (console.cloud.google.com): crea o elige un proyecto → *APIs y servicios* → habilita **Google Wallet API**.
2. **Cuenta de servicio:** *IAM → Cuentas de servicio → Crear* (sin roles) → *Claves → Agregar clave → JSON*. Guarda el archivo; no se sube al repo.
3. **Google Pay & Wallet Console** (pay.google.com/business/console): crea el perfil de negocio (Novura) → *Google Wallet API* → copia el **Issuer ID**.
4. En la misma consola, *Usuarios → Invitar*: el correo de la cuenta de servicio (`…@….iam.gserviceaccount.com`) con acceso **Desarrollador**. Mientras la cuenta esté en **modo demo**, solo los usuarios agregados ahí (agrega tu Gmail y el de quien pruebe) pueden guardar pases.
5. **Secretos en Supabase** (Dashboard → Edge Functions → Secrets, o CLI):
   - `GOOGLE_WALLET_ISSUER_ID` = el Issuer ID.
   - `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` = el contenido completo del `.json` de la cuenta de servicio.
   - `CLUB_DOMINIO_BASE=hibeely.com` (ya existe si `club-dominio` está configurada).
6. **Desplegar:** `supabase functions deploy wallet-google panel-sello --project-ref qamokfnxzmmsrlhowuqy` (el `config.toml` ya deja `wallet-google` sin verificación de JWT).
7. **Producción:** en la consola, *Solicitar acceso de publicación* con capturas del pase y del botón. Antes, cambia el botón por el recurso oficial "Agregar a Google Wallet" (es-419) de la guía de marca de Google; el actual lo imita.

## Checklist de pruebas

- [ ] Sin secretos: el botón muestra "Google Wallet aún no está disponible para este club."
- [ ] Con secretos, en Android con una cuenta de prueba: el botón abre Google Wallet y guarda el pase con nombre, logo, color, `Sellos n/N` y el QR.
- [ ] El QR del pase escaneado en la caja del panel encuentra la tarjeta.
- [ ] Sumar un sello desde la caja → el pase muestra el nuevo número en menos de un minuto.
- [ ] Completar la tarjeta → `Premios listos 1` y "¡Completa!"/"Reclama tu premio en caja".
- [ ] Tocar el botón otra vez no crea un segundo pase (mismo objeto).
- [ ] En iPhone el botón no aparece. Con la tarjeta bloqueada tampoco.
- [ ] Token de otro negocio con este slug → 404.

## Pendiente

- Canje de cupones (`pos-cupones-canjear`, Sprint 3) y `pos-sellos` deben llamar `sincronizarPaseGoogle` igual que `panel-sello`.
- Re-sincronizar todos los pases cuando el negocio edite la tarjeta (editor del Sprint 4): hoy la clase se actualiza en la siguiente sincronización de cada tarjeta o al volver a tocar el botón.
- Mensajes con notificación ("¡Ganaste tu premio!") y ubicaciones de las sedes en el pase.
