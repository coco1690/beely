# Product

<!-- impeccable:product-schema 1 -->

> Contexto de producto para el skill de diseño impeccable (`/impeccable init`, 2026-10-30). Lo comparten `apps/panel` y `apps/club`. Las reglas técnicas y de negocio completas viven en `CLAUDE.md`.

## Platform

web

## Users

- **Dueño y administrador del negocio** (heladerías, cafés, restaurantes, barberías): configuran el programa de sellos, la tarjeta, las ofertas, las campañas y el equipo desde el panel (app.hibeely.com), en computador o en el celular.
- **Cajero**: usa el panel en caja, con prisa y con clientes esperando, para escanear el QR de la tarjeta, sumar sellos y canjear cupones. Solo lectura del resto.
- **Cliente final**: usa el club del negocio en su celular (`{slug}.hibeely.com`, PWA instalable) sin crear cuenta; ve su tarjeta con QR, sus sellos y sus cupones, y puede guardarla en Google Wallet.
- **Superadmin de Beely** (equipo de Novura): da de alta negocios y sedes, cambia plan y estado, y ve las métricas de toda la plataforma.

## Product Purpose

Beely le da a cualquier negocio pequeño un programa de fidelización propio: tarjeta de sellos digital (ej. 10 helados = 1 gratis) en la PWA y en Wallet, cupones y ofertas, y campañas por push y por Wallet. El éxito es que el cliente vuelva: que el negocio sume sellos en cada venta sin fricción en caja y que el cliente canjee su premio.

## Positioning

Cada negocio tiene su propia fidelización, no una app de puntos compartida: su marca, su subdominio, su pase de Wallet y sus datos (el celular es único por negocio). Además, Beely es independiente del POS: cualquier POS suma sellos y canjea cupones con una API abierta; Angelato, el POS de la casa, la usa como un integrador externo más.

## Operating Context

- En caja: escaneo de QR desde el celular o el computador del negocio; cada sello nace de una venta, con tope diario por cliente.
- El cliente se registra con celular, nombre, fecha de nacimiento y autorización de datos, sin OTP.
- Premio automático al completar los sellos: se emite un cupón y se descuentan los sellos.
- Campañas con límites de envío por semana y franja horaria, solo a quien acepta marketing.
- Panel y club se usan mucho como PWA instalada en el celular.

## Capabilities and Constraints

- Hecho: panel del negocio y del superadmin, club (PWA) con registro, tarjeta con QR, cupones y Google Wallet, temas claro/oscuro y logo por negocio.
- En roadmap: API para POS con llaves, editor de tarjeta con vista previa, ofertas y Web Push, campañas automáticas, Apple Wallet, recuperación por OTP y cobros con Wompi.
- Idioma del producto: español (Colombia). Zona horaria por negocio.
- Términos: negocio, sede, programa de sellos, tarjeta, sello, cupón, canje, campaña, club, panel, dueño, administrador, cajero.
- Un negocio suspendido no suma sellos ni registra clientes.

## Brand Commitments

- Nombre **Beely** (abeja 🐝), dominio hibeely.com, empresa Novura. Logo en `docs/logo-beely.svg`.
- El club muestra la marca del negocio (su nombre y su logo), no la de Beely.
- Voz cercana y directa en español, tuteando.

## Evidence on Hand

- Primer negocio real: Angelato (heladería), en producción.
- Capturas de pantallas en `docs/capturas/`.
- No hay testimonios, casos de éxito, cifras públicas ni precios publicados: no inventarlos.

## Product Principles

1. La caja no espera: sumar un sello o canjear un cupón tiene que tomar segundos.
2. El negocio es dueño de su programa y de sus datos (Ley 1581 de 2012); Beely no se pone por delante de su marca.
3. El cliente final no necesita cuenta: su tarjeta es un enlace y un QR.
4. Ninguna acción irreversible sin confirmación (eliminar, suspender).
5. Funciona igual de bien en el celular que en el computador.
