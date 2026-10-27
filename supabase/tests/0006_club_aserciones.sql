-- Aserciones de la migración 0005 (Sprint 2, PWA club).
-- Se corre dentro de una transacción con rollback: ./scripts/probar-sql.sh
-- Crea datos de prueba: NO correr en producción.

\set ON_ERROR_STOP 1
begin;

create function pg_temp.debe_fallar(p_sql text, p_esperado text, p_caso text)
returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception 'FALLO [%]: se esperaba error "%" y la sentencia pasó', p_caso, p_esperado;
exception
  when others then
    if sqlerrm like 'FALLO [%' then
      raise;
    end if;
    if position(p_esperado in sqlerrm) = 0 then
      raise exception 'FALLO [%]: se esperaba "%" y llegó "%"', p_caso, p_esperado, sqlerrm;
    end if;
    raise notice 'OK [%]: %', p_caso, sqlerrm;
end;
$$;
grant execute on function pg_temp.debe_fallar(text, text, text) to authenticated, anon;

create function pg_temp.igual(p_obtenido anyelement, p_esperado anyelement, p_caso text)
returns void
language plpgsql
as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'FALLO [%]: se esperaba % y llegó %', p_caso, p_esperado, p_obtenido;
  end if;
  raise notice 'OK [%]', p_caso;
end;
$$;
grant execute on function pg_temp.igual(anyelement, anyelement, text) to authenticated, anon;

-- Cabeceras que manda la PWA (PostgREST las expone en request.headers).
create function pg_temp.cabeceras(p_slug text, p_token text)
returns void
language sql
as $$
  select set_config('request.headers',
    json_build_object('x-negocio-slug', p_slug, 'x-tarjeta-token', p_token)::text, true);
$$;
grant execute on function pg_temp.cabeceras(text, text) to anon;

-- Dos negocios con programa, diseño, sede activa e inactiva, y una tarjeta cada uno.
insert into public.negocios (id, slug, nombre) values
 ('c0000000-0000-0000-0000-00000000000a', 'club-a', 'Club A'),
 ('c0000000-0000-0000-0000-00000000000b', 'club-b', 'Club B');
insert into public.programas (id, negocio_id, sellos_requeridos, premio_descripcion) values
 ('c1000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 8, 'Café gratis'),
 ('c1000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', 10, 'Helado gratis');
insert into public.disenos_tarjeta (programa_id, negocio_id) values
 ('c1000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a'),
 ('c1000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b');
insert into public.sedes (negocio_id, nombre, activa) values
 ('c0000000-0000-0000-0000-00000000000a', 'Centro A', true),
 ('c0000000-0000-0000-0000-00000000000a', 'Cerrada A', false),
 ('c0000000-0000-0000-0000-00000000000b', 'Centro B', true);
insert into public.clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, version_politica) values
 ('c2000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', '+573000000001', 'Ana A', '1990-01-01', true, 'v1'),
 ('c2000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', '+573000000002', 'Beto B', '1990-01-01', true, 'v1');
insert into public.tarjetas (id, negocio_id, programa_id, cliente_id, token_publico) values
 ('c3000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-00000000000a',
  'c2000000-0000-0000-0000-00000000000a', rpad('club-token-a-', 64, '0')),
 ('c3000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-00000000000b',
  'c2000000-0000-0000-0000-00000000000b', rpad('club-token-b-', 64, '0'));
select public.registrar_sello('c0000000-0000-0000-0000-00000000000a', rpad('club-token-a-', 64, '0'), 'club:1');
select public.registrar_sello('c0000000-0000-0000-0000-00000000000b', rpad('club-token-b-', 64, '0'), 'club:2');
insert into public.cupones (negocio_id, tarjeta_id, origen, descripcion, vence_en) values
 ('c0000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-00000000000a', 'manual', 'Cupón A', now() + interval '5 days'),
 ('c0000000-0000-0000-0000-00000000000b', 'c3000000-0000-0000-0000-00000000000b', 'manual', 'Cupón B', now() + interval '5 days');

-- ---------------------------------------------------------------------
-- 1. anon sin cabeceras no ve nada
-- ---------------------------------------------------------------------
set local role anon;
select pg_temp.igual(count(*), 0::bigint, 'anon sin cabeceras no ve negocios') from public.negocios;
select pg_temp.igual(count(*), 0::bigint, 'anon sin cabeceras no ve programas') from public.programas;
select pg_temp.igual(count(*), 0::bigint, 'anon sin cabeceras no ve tarjetas') from public.tarjetas;
select pg_temp.igual(count(*), 0::bigint, 'anon sin cabeceras no ve cupones') from public.cupones;

-- ---------------------------------------------------------------------
-- 2. Solo slug (pantalla de registro): marca y programa de ESE negocio
-- ---------------------------------------------------------------------
select pg_temp.cabeceras('club-a', null);
select pg_temp.igual(string_agg(slug, ','), 'club-a', 'el slug deja ver solo su negocio') from public.negocios;
select pg_temp.igual(string_agg(premio_descripcion, ','), 'Café gratis', 'el slug deja ver solo su programa activo') from public.programas;
select pg_temp.igual(count(*), 1::bigint, 'el slug deja ver solo su diseño') from public.disenos_tarjeta;
select pg_temp.igual(string_agg(nombre, ','), 'Centro A', 'el slug deja ver solo sus sedes activas') from public.sedes;
select pg_temp.igual(count(*), 0::bigint, 'el slug no deja ver tarjetas') from public.tarjetas;
select pg_temp.igual(count(*), 0::bigint, 'el slug no deja ver clientes') from public.clientes;
select pg_temp.debe_fallar($q$select plan from public.negocios$q$, 'permission denied', 'anon no ve el plan del negocio');
select pg_temp.debe_fallar($q$select nit from public.negocios$q$, 'permission denied', 'anon no ve el NIT');

-- Negocio suspendido: su club desaparece
reset role;
update public.negocios set estado = 'suspendido' where slug = 'club-b';
set local role anon;
select pg_temp.cabeceras('club-b', null);
select pg_temp.igual(count(*), 0::bigint, 'negocio suspendido no se ve en el club') from public.negocios;
reset role;
update public.negocios set estado = 'activo' where slug = 'club-b';
set local role anon;

-- ---------------------------------------------------------------------
-- 3. Token: solo esa tarjeta, su cliente, sus cupones y sus sellos
-- ---------------------------------------------------------------------
select pg_temp.cabeceras('club-a', rpad('club-token-a-', 64, '0'));
select pg_temp.igual(string_agg(id::text, ','), 'c3000000-0000-0000-0000-00000000000a', 'el token deja ver solo su tarjeta') from public.tarjetas;
select pg_temp.igual(string_agg(nombre, ','), 'Ana A', 'el token deja ver solo su cliente') from public.clientes;
select pg_temp.igual(string_agg(descripcion, ','), 'Cupón A', 'el token deja ver solo sus cupones') from public.cupones;
select pg_temp.igual(count(*), 1::bigint, 'el token deja ver solo sus sellos') from public.eventos_sello;
select pg_temp.igual(sellos_actuales, 1::smallint, 'la tarjeta muestra sus sellos') from public.tarjetas;
select pg_temp.debe_fallar($q$select celular from public.clientes$q$, 'permission denied', 'anon no ve el celular');
select pg_temp.debe_fallar($q$select fecha_nacimiento from public.clientes$q$, 'permission denied', 'anon no ve la fecha de nacimiento');
select pg_temp.debe_fallar($q$select monto_venta from public.eventos_sello$q$, 'permission denied', 'anon no ve montos de venta');
select pg_temp.debe_fallar($q$select venta_externa_id from public.eventos_sello$q$, 'permission denied', 'anon no ve ids de venta');

-- El token manda sobre el slug: con el token de A y el slug de B se ve el negocio de A, no el de B.
select pg_temp.cabeceras('club-b', rpad('club-token-a-', 64, '0'));
select pg_temp.igual(string_agg(slug, ','), 'club-a', 'token de A con slug de B muestra solo A') from public.negocios;
select pg_temp.igual(count(*), 0::bigint, 'token de A no deja ver cupones de B')
  from public.cupones where negocio_id = 'c0000000-0000-0000-0000-00000000000b';

-- Token inventado
select pg_temp.cabeceras('club-a', rpad('inventado', 64, '0'));
select pg_temp.igual(count(*), 0::bigint, 'token inexistente no ve tarjetas') from public.tarjetas;

-- ---------------------------------------------------------------------
-- 4. Opt-out en un toque: solo acepta_marketing, solo de su cliente
-- ---------------------------------------------------------------------
select pg_temp.cabeceras('club-a', rpad('club-token-a-', 64, '0'));
update public.clientes set acepta_marketing = true;
select pg_temp.debe_fallar($q$update public.clientes set nombre = 'Otro'$q$, 'permission denied', 'anon no cambia su nombre');
select pg_temp.debe_fallar($q$update public.clientes set fecha_nacimiento = '2000-01-01'$q$, 'permission denied', 'anon no cambia su fecha de nacimiento');
select pg_temp.debe_fallar($q$update public.tarjetas set sellos_actuales = 99$q$, 'permission denied', 'anon no se suma sellos');
select pg_temp.debe_fallar(
  $q$insert into public.eventos_sello (negocio_id, tarjeta_id, cantidad, origen) values ('c0000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-00000000000a', 5, 'ajuste')$q$,
  'permission denied', 'anon no inserta sellos');
select pg_temp.debe_fallar(
  $q$update public.cupones set estado = 'canjeado', canjeado_en = now()$q$, 'permission denied', 'anon no canjea cupones');
reset role;
select pg_temp.igual(acepta_marketing, true, 'el cliente activa marketing') from public.clientes where id = 'c2000000-0000-0000-0000-00000000000a';
select pg_temp.igual(acepta_marketing, false, 'no toca el marketing de otro cliente') from public.clientes where id = 'c2000000-0000-0000-0000-00000000000b';
set local role anon;
select pg_temp.cabeceras('club-a', rpad('club-token-a-', 64, '0'));
update public.clientes set acepta_marketing = false where id = 'c2000000-0000-0000-0000-00000000000b';
reset role;
select pg_temp.igual(acepta_marketing, false, 'el token de A no cambia el cliente de B') from public.clientes where id = 'c2000000-0000-0000-0000-00000000000b';

-- ---------------------------------------------------------------------
-- 5. Web Push: guarda y revoca la suscripción de su propia tarjeta
-- ---------------------------------------------------------------------
set local role anon;
select pg_temp.cabeceras('club-a', rpad('club-token-a-', 64, '0'));
insert into public.suscripciones_push (negocio_id, tarjeta_id, endpoint, p256dh, auth)
values ('c0000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-00000000000a', 'https://push.prueba/a', 'p', 'k');
select pg_temp.debe_fallar(
  $q$insert into public.suscripciones_push (negocio_id, tarjeta_id, endpoint, p256dh, auth)
     values ('c0000000-0000-0000-0000-00000000000b', 'c3000000-0000-0000-0000-00000000000b', 'https://push.prueba/b', 'p', 'k')$q$,
  'row-level security', 'no suscribe push para otra tarjeta');
select pg_temp.debe_fallar(
  $q$insert into public.suscripciones_push (negocio_id, tarjeta_id, endpoint, p256dh, auth)
     values ('c0000000-0000-0000-0000-00000000000b', 'c3000000-0000-0000-0000-00000000000a', 'https://push.prueba/c', 'p', 'k')$q$,
  'row-level security', 'no suscribe push con otro negocio');
update public.suscripciones_push set revocada_en = now() where endpoint = 'https://push.prueba/a';
select pg_temp.igual(count(*), 1::bigint, 'el cliente revoca su suscripción')
  from public.suscripciones_push where revocada_en is not null;
select pg_temp.debe_fallar($q$select p256dh from public.suscripciones_push$q$, 'permission denied', 'anon no lee las llaves push');

-- ---------------------------------------------------------------------
-- 6. Registro (club_registrar): solo service_role
-- ---------------------------------------------------------------------
select pg_temp.debe_fallar(
  $q$select public.club_registrar('club-a', '+573000000009', 'Pirata', '1990-01-01', false, repeat('a', 64))$q$,
  'permission denied', 'anon no llama club_registrar');
reset role;
set local role authenticated;
select pg_temp.debe_fallar(
  $q$select public.club_registrar('club-a', '+573000000009', 'Pirata', '1990-01-01', false, repeat('a', 64))$q$,
  'permission denied', 'authenticated no llama club_registrar');
reset role;
set local role service_role;

select set_config('prueba.registro',
  public.club_registrar('club-a', '+573000000010', 'Carla', '1995-05-05', true, repeat('a', 64))::text, true);
select pg_temp.igual((current_setting('prueba.registro')::jsonb ->> 'registrado')::bool, true, 'registro crea la tarjeta');
select pg_temp.igual(length(current_setting('prueba.registro')::jsonb ->> 'token'), 64, 'registro devuelve el token opaco');
select pg_temp.igual(c.nombre || '|' || c.version_politica || '|' || c.acepta_marketing || '|' || t.sellos_actuales,
  'Carla|v1|true|0', 'registro guarda cliente, política vigente y tarjeta en cero')
  from public.tarjetas t join public.clientes c on c.id = t.cliente_id
  where t.token_publico = current_setting('prueba.registro')::jsonb ->> 'token';

-- Celular repetido en el mismo negocio: no devuelve la tarjeta existente
select pg_temp.igual(
  public.club_registrar('club-a', '+573000000010', 'Impostor', '1990-01-01', false, repeat('b', 64)),
  '{"registrado": false, "motivo": "celular_ya_registrado"}'::jsonb, 'celular repetido no entrega la tarjeta');
-- El mismo celular sí puede registrarse en otro negocio
select pg_temp.igual(
  (public.club_registrar('club-b', '+573000000010', 'Carla', '1995-05-05', false, repeat('a', 64)) ->> 'registrado')::bool,
  true, 'el celular es único por negocio, no global');

select pg_temp.debe_fallar(
  $q$select public.club_registrar('no-existe', '+573000000011', 'Nadie', '1990-01-01', false, repeat('a', 64))$q$,
  'negocio_no_encontrado', 'slug inexistente');
reset role;
update public.negocios set estado = 'suspendido' where slug = 'club-b';
set local role service_role;
select pg_temp.debe_fallar(
  $q$select public.club_registrar('club-b', '+573000000012', 'Nadie', '1990-01-01', false, repeat('a', 64))$q$,
  'negocio_inactivo', 'negocio suspendido no registra');
reset role;
update public.negocios set estado = 'activo' where slug = 'club-b';
update public.programas set activo = false where negocio_id = 'c0000000-0000-0000-0000-00000000000b';
set local role service_role;
select pg_temp.debe_fallar(
  $q$select public.club_registrar('club-b', '+573000000012', 'Nadie', '1990-01-01', false, repeat('a', 64))$q$,
  'programa_inactivo', 'sin programa activo no registra');
select pg_temp.debe_fallar(
  $q$select public.club_registrar('club-a', '3000000013', 'Mal', '1990-01-01', false, repeat('a', 64))$q$,
  'clientes_celular_check', 'celular fuera de E.164');

-- Límite por celular: 5 intentos por hora (el repetido de arriba ya contó 2)
select public.club_registrar('club-a', '+573000000010', 'Impostor', '1990-01-01', false, repeat('c', 64)) from generate_series(1, 3);
select pg_temp.igual(
  public.club_registrar('club-a', '+573000000010', 'Impostor', '1990-01-01', false, repeat('d', 64)) ->> 'motivo',
  'demasiados_intentos', 'tope de intentos por celular');

-- Límite por IP: 30 por hora en el mismo negocio (una tienda comparte wifi)
select public.club_registrar('club-a', '+5731100000' || lpad(i::text, 2, '0'), 'Cliente', '1990-01-01', false, repeat('e', 64))
  from generate_series(1, 30) as i;
select pg_temp.igual(
  public.club_registrar('club-a', '+573119999999', 'Uno más', '1990-01-01', false, repeat('e', 64)) ->> 'motivo',
  'demasiados_intentos', 'tope de intentos por IP');
select pg_temp.igual(
  (public.club_registrar('club-a', '+573119999999', 'Uno más', '1990-01-01', false, repeat('f', 64)) ->> 'registrado')::bool,
  true, 'otra IP sí registra');

-- Las huellas guardan hashes, nunca el celular ni la IP
reset role;
select pg_temp.igual(count(*), 0::bigint, 'intentos_registro no guarda celulares en claro')
  from public.intentos_registro where huella like '%+57%';
set local role anon;
select pg_temp.debe_fallar($q$select * from public.intentos_registro$q$, 'permission denied', 'anon no ve intentos de registro');

-- ---------------------------------------------------------------------
-- 7. El panel sigue igual: el equipo no depende de las cabeceras
-- ---------------------------------------------------------------------
reset role;
insert into auth.users (id, email) values ('c4000000-0000-0000-0000-00000000000a', 'cajero-club@prueba.co');
insert into public.miembros_negocio (negocio_id, usuario_id, rol)
values ('c0000000-0000-0000-0000-00000000000a', 'c4000000-0000-0000-0000-00000000000a', 'cajero');
set local role authenticated;
set local request.jwt.claim.sub = 'c4000000-0000-0000-0000-00000000000a';
select pg_temp.cabeceras('club-b', rpad('club-token-b-', 64, '0'));
select pg_temp.igual(string_agg(distinct negocio_id::text, ','), 'c0000000-0000-0000-0000-00000000000a',
  'cajero ve solo las tarjetas de su negocio aunque mande cabeceras')
  from public.tarjetas;
select pg_temp.igual(count(*) > 0, true, 'cajero sigue viendo el celular') from public.clientes where celular is not null;

rollback;
\echo 'Todas las aserciones del club pasaron.'
