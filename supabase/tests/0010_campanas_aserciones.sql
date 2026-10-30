-- Aserciones de la migración 0009: campañas de promociones.
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

create function pg_temp.cabeceras(p_slug text, p_token text)
returns void
language sql
as $$
  select set_config('request.headers',
    json_build_object('x-negocio-slug', p_slug, 'x-tarjeta-token', p_token)::text, true);
$$;
grant execute on function pg_temp.cabeceras(text, text) to anon;

-- Hoy y mañana en la zona del negocio (America/Bogota por defecto).
select set_config('prueba.hoy', (now() at time zone 'America/Bogota')::date::text, true);

-- 1. Datos: superadmin, dueño, administrador y cajero de A; dueño de B
insert into auth.users (id, email) values
 ('ea000000-0000-0000-0000-000000000001', 'super@campanas.co'),
 ('ea000000-0000-0000-0000-000000000002', 'dueno-a@campanas.co'),
 ('ea000000-0000-0000-0000-000000000003', 'admin-a@campanas.co'),
 ('ea000000-0000-0000-0000-000000000004', 'cajero-a@campanas.co'),
 ('ea000000-0000-0000-0000-000000000005', 'dueno-b@campanas.co');
insert into public.superadmins (usuario_id) values ('ea000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000001';
select set_config('prueba.a', public.crear_negocio('campanas-a', 'Campañas A')::text, true);
select set_config('prueba.b', public.crear_negocio('campanas-b', 'Campañas B')::text, true);
reset role;

insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 (current_setting('prueba.a')::uuid, 'ea000000-0000-0000-0000-000000000002', 'dueno'),
 (current_setting('prueba.a')::uuid, 'ea000000-0000-0000-0000-000000000003', 'administrador'),
 (current_setting('prueba.a')::uuid, 'ea000000-0000-0000-0000-000000000004', 'cajero'),
 (current_setting('prueba.b')::uuid, 'ea000000-0000-0000-0000-000000000005', 'dueno');

-- A: Ana (nueva, cumple este mes, 1 sello), Beto (viejo, sin volver), Carla (vieja, volvió ayer,
-- cumple este mes pero sin sellos), Dino (no acepta promociones), Eva (tarjeta bloqueada). B: Fito.
insert into public.clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, acepta_marketing, version_politica, creado_en) values
 ('ea200000-0000-0000-0000-000000000001', current_setting('prueba.a')::uuid, '+573101110001', 'Ana',
  make_date(1990, extract(month from now() at time zone 'America/Bogota')::integer, 1), true, true, 'v1', now() - interval '2 days'),
 ('ea200000-0000-0000-0000-000000000002', current_setting('prueba.a')::uuid, '+573102220002', 'Beto',
  make_date(1991, (extract(month from now() at time zone 'America/Bogota')::integer % 12) + 1, 1), true, true, 'v1', now() - interval '90 days'),
 ('ea200000-0000-0000-0000-000000000003', current_setting('prueba.a')::uuid, '+573103330003', 'Carla',
  make_date(1992, extract(month from now() at time zone 'America/Bogota')::integer, 2), true, true, 'v1', now() - interval '60 days'),
 ('ea200000-0000-0000-0000-000000000004', current_setting('prueba.a')::uuid, '+573104440004', 'Dino',
  '1993-03-03', true, false, 'v1', now() - interval '5 days'),
 ('ea200000-0000-0000-0000-000000000005', current_setting('prueba.a')::uuid, '+573105550005', 'Eva',
  '1994-04-04', true, true, 'v1', now() - interval '5 days'),
 ('ea200000-0000-0000-0000-000000000006', current_setting('prueba.b')::uuid, '+573106660006', 'Fito',
  '1995-05-05', true, true, 'v1', now() - interval '1 day');
insert into public.tarjetas (id, negocio_id, programa_id, cliente_id, token_publico, sellos_actuales, sellos_historicos, ultima_visita_en, estado)
select v.tarjeta, p.negocio_id, p.id, v.cliente, v.token, v.historicos, v.historicos, v.visita, v.estado
  from (values
    ('ea300000-0000-0000-0000-000000000001'::uuid, 'ea200000-0000-0000-0000-000000000001'::uuid, current_setting('prueba.a')::uuid, 'token-campana-ana', 1, now(), 'activa'),
    ('ea300000-0000-0000-0000-000000000002'::uuid, 'ea200000-0000-0000-0000-000000000002'::uuid, current_setting('prueba.a')::uuid, 'token-campana-beto', 4, now() - interval '80 days', 'activa'),
    ('ea300000-0000-0000-0000-000000000003'::uuid, 'ea200000-0000-0000-0000-000000000003'::uuid, current_setting('prueba.a')::uuid, 'token-campana-carla', 0, now() - interval '1 day', 'activa'),
    ('ea300000-0000-0000-0000-000000000004'::uuid, 'ea200000-0000-0000-0000-000000000004'::uuid, current_setting('prueba.a')::uuid, 'token-campana-dino', 3, now(), 'activa'),
    ('ea300000-0000-0000-0000-000000000005'::uuid, 'ea200000-0000-0000-0000-000000000005'::uuid, current_setting('prueba.a')::uuid, 'token-campana-eva', 3, now(), 'bloqueada'),
    ('ea300000-0000-0000-0000-000000000006'::uuid, 'ea200000-0000-0000-0000-000000000006'::uuid, current_setting('prueba.b')::uuid, 'token-campana-fito', 1, now(), 'activa')
  ) as v (tarjeta, cliente, negocio, token, historicos, visita, estado)
  join public.programas p on p.negocio_id = v.negocio;

-- 2. Alcance: solo quien acepta promociones, con tarjeta activa
set local role authenticated;
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000002';
select pg_temp.igual(public.campanas_alcance(current_setting('prueba.a')::uuid) - 'push',
       '{"todos": 3, "inactivos": 1, "cumple": 1, "nuevos": 1, "clientes": 5}'::jsonb,
       'alcance: sin quien no acepta promociones ni tarjetas bloqueadas; cumple exige un sello');
select pg_temp.debe_fallar(format('select public.campanas_alcance(%L)', current_setting('prueba.b')),
       'sin_permiso', 'el dueño de A no ve el alcance de B');

-- 3. Guardar borradores y validar
select set_config('prueba.c1', public.campana_guardar(
  current_setting('prueba.a')::uuid, 'porcentaje', '20% en conos dobles', 'todos',
  current_setting('prueba.hoy')::date, current_setting('prueba.hoy')::date + 6,
  20, 'conos dobles', 'Solo esta semana')::text, true);
select pg_temp.igual(estado, 'borrador', 'la campaña nace en borrador'),
       pg_temp.igual(canales, array['club'], 'el canal es el club'),
       pg_temp.igual(segmento, '{"filtro": "todos"}'::jsonb, 'guarda el segmento'),
       pg_temp.igual(creado_por, 'ea000000-0000-0000-0000-000000000002'::uuid, 'guarda quién la creó'),
       pg_temp.igual(termina_en, ((current_setting('prueba.hoy')::date + 7)::timestamp at time zone 'America/Bogota'),
                     'vence al terminar el último día en la zona del negocio')
  from public.campanas where id = current_setting('prueba.c1')::uuid;
select pg_temp.igual(o.tipo || ':' || o.valor::text || ':' || o.descripcion || ':' || o.vigencia_dias, 'porcentaje:20.00:conos dobles:7',
       'crea su oferta')
  from public.campanas c join public.ofertas o on o.id = c.oferta_id
 where c.id = current_setting('prueba.c1')::uuid;

select pg_temp.debe_fallar(format($q$select public.campana_guardar(%L, 'porcentaje', 'Mucho', 'todos', %L, %L, 120)$q$,
         current_setting('prueba.a'), current_setting('prueba.hoy'), current_setting('prueba.hoy')),
       'solicitud_invalida', 'porcentaje mayor a 100');
select pg_temp.debe_fallar(format($q$select public.campana_guardar(%L, 'dos_por_uno', '2x1', 'todos', %L, %L)$q$,
         current_setting('prueba.a'), current_setting('prueba.hoy'), current_setting('prueba.hoy')),
       'solicitud_invalida', '2x1 sin producto');
select pg_temp.debe_fallar(format($q$select public.campana_guardar(%L, 'producto_gratis', 'Topping gratis', 'vip', %L, %L, null, 'topping')$q$,
         current_setting('prueba.a'), current_setting('prueba.hoy'), current_setting('prueba.hoy')),
       'solicitud_invalida', 'segmento desconocido');
select pg_temp.debe_fallar(format($q$select public.campana_guardar(%L, 'producto_gratis', 'Topping gratis', 'todos', %L, %L, null, 'topping')$q$,
         current_setting('prueba.a'), current_setting('prueba.hoy')::date - 1, current_setting('prueba.hoy')),
       'fechas_invalidas', 'no empieza en el pasado');
select pg_temp.debe_fallar(format($q$select public.campana_guardar(%L, 'producto_gratis', 'Topping gratis', 'todos', %L, %L, null, 'topping')$q$,
         current_setting('prueba.a'), current_setting('prueba.hoy'), current_setting('prueba.hoy')::date - 1),
       'fechas_invalidas', 'no termina antes de empezar');
select pg_temp.debe_fallar(format($q$select public.campana_guardar(%L, 'producto_gratis', 'Topping gratis', 'todos', %L, %L, null, 'topping')$q$,
         current_setting('prueba.b'), current_setting('prueba.hoy'), current_setting('prueba.hoy')),
       'sin_permiso', 'el dueño de A no crea campañas en B');
select pg_temp.debe_fallar(format($q$insert into public.campanas (negocio_id, nombre, disparador, titulo, mensaje) values (%L, 'x', 'manual', 'x', '')$q$,
         current_setting('prueba.a')),
       'permission denied', 'no se insertan campañas directo');
select pg_temp.debe_fallar(format($q$update public.campanas set estado = 'activa' where id = %L$q$, current_setting('prueba.c1')),
       'permission denied', 'no se activa una campaña sin lanzarla');

-- Editar el borrador: cambia texto, tipo y fechas, conserva la oferta
select pg_temp.igual(public.campana_guardar(
  current_setting('prueba.a')::uuid, 'dos_por_uno', '2x1 en conos dobles', 'todos',
  current_setting('prueba.hoy')::date, current_setting('prueba.hoy')::date + 6,
  null, 'conos dobles', 'Solo esta semana', current_setting('prueba.c1')::uuid), current_setting('prueba.c1')::uuid,
  'editar devuelve la misma campaña');
select pg_temp.igual(c.titulo || ':' || o.tipo || ':' || coalesce(o.valor::text, 'sin valor'), '2x1 en conos dobles:dos_por_uno:sin valor',
       'editar actualiza la campaña y su oferta')
  from public.campanas c join public.ofertas o on o.id = c.oferta_id
 where c.id = current_setting('prueba.c1')::uuid;
select pg_temp.igual(count(*), 1::bigint, 'editar no crea otra oferta')
  from public.ofertas where negocio_id = current_setting('prueba.a')::uuid;

-- 4. Lanzar hoy: emite un cupón por tarjeta del segmento
select pg_temp.igual(public.campana_lanzar(current_setting('prueba.c1')::uuid) - 'programada_para',
       '{"programada": false, "cupones": 3}'::jsonb, 'lanzar hoy emite los cupones');
select pg_temp.igual(string_agg(t.token_publico, ',' order by t.token_publico),
       'token-campana-ana,token-campana-beto,token-campana-carla', 'cupones solo para quien acepta promociones y tiene tarjeta activa')
  from public.cupones k join public.tarjetas t on t.id = k.tarjeta_id
 where k.campana_id = current_setting('prueba.c1')::uuid;
select pg_temp.igual(bool_and(k.origen = 'campana' and k.descripcion = '2x1 en conos dobles' and k.vence_en = c.termina_en
                              and k.oferta_id = c.oferta_id), true, 'el cupón lleva origen, texto, vencimiento y oferta')
  from public.cupones k join public.campanas c on c.id = k.campana_id
 where k.campana_id = current_setting('prueba.c1')::uuid;
select pg_temp.debe_fallar(format('select public.campana_lanzar(%L)', current_setting('prueba.c1')),
       'campana_no_editable', 'no se lanza dos veces');
select pg_temp.debe_fallar(format($q$select public.campana_guardar(%L, 'producto_gratis', 'Topping', 'todos', %L, %L, null, 'topping', null, %L)$q$,
         current_setting('prueba.a'), current_setting('prueba.hoy'), current_setting('prueba.hoy'), current_setting('prueba.c1')),
       'campana_no_editable', 'una campaña lanzada no se edita');
select pg_temp.debe_fallar(format('select public.campana_eliminar(%L)', current_setting('prueba.c1')),
       'campana_no_editable', 'una campaña lanzada no se borra');
reset role;
-- Repetir la emisión no duplica.
select pg_temp.igual(privado.emitir_campana(current_setting('prueba.c1')::uuid), 0, 'emitir de nuevo no duplica cupones');

-- 5. Lista con resultados; el cajero no la ve
select pg_temp.igual(public.canjear_cupon(current_setting('prueba.a')::uuid, k.codigo, 'venta-campana-1') ->> 'estado', 'canjeado',
       'el cupón de campaña se canjea como cualquiera')
  from public.cupones k
 where k.campana_id = current_setting('prueba.c1')::uuid and k.tarjeta_id = 'ea300000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000003';
select pg_temp.igual(estado || ':' || cupones_emitidos || ':' || cupones_canjeados || ':' || filtro || ':' || tipo || ':' || producto,
       'en_curso:3:1:todos:dos_por_uno:conos dobles', 'el administrador ve la campaña en curso con sus resultados'),
       pg_temp.igual(inicia, current_setting('prueba.hoy')::date, 'inicia en días del negocio'),
       pg_temp.igual(termina, current_setting('prueba.hoy')::date + 6, 'termina en días del negocio')
  from public.campanas_negocio(current_setting('prueba.a')::uuid);
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000004';
select pg_temp.debe_fallar(format('select * from public.campanas_negocio(%L)', current_setting('prueba.a')),
       'sin_permiso', 'el cajero no lista campañas');
select pg_temp.debe_fallar(format($q$select public.campana_guardar(%L, 'producto_gratis', 'Topping', 'todos', %L, %L, null, 'topping')$q$,
         current_setting('prueba.a'), current_setting('prueba.hoy'), current_setting('prueba.hoy')),
       'sin_permiso', 'el cajero no crea campañas');
select pg_temp.debe_fallar(format('select public.campana_cancelar(%L)', current_setting('prueba.c1')),
       'campana_no_encontrada', 'el cajero no cancela campañas');
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000005';
select pg_temp.igual(count(*), 0::bigint, 'el dueño de B no ve campañas de A')
  from public.campanas;
select pg_temp.debe_fallar(format('select public.campana_cancelar(%L)', current_setting('prueba.c1')),
       'campana_no_encontrada', 'el dueño de B no cancela campañas de A');
reset role;

-- 6. El club ve el cupón y el mensaje de su campaña, nada más
set local role anon;
select pg_temp.cabeceras('campanas-a', 'token-campana-beto');
select pg_temp.igual(count(*), 1::bigint, 'el cliente ve su cupón de campaña')
  from public.cupones where campana_id is not null;
select pg_temp.igual(titulo || ' · ' || mensaje, '2x1 en conos dobles · Solo esta semana', 'el cliente ve título y mensaje de la campaña')
  from public.campanas;
select pg_temp.debe_fallar('select segmento from public.campanas', 'permission denied', 'el cliente no ve el segmento');
select pg_temp.cabeceras('campanas-a', 'token-campana-dino');
select pg_temp.igual(count(*), 0::bigint, 'quien no recibió la campaña no la ve')
  from public.campanas;
select pg_temp.cabeceras('campanas-a', null);
select pg_temp.igual(count(*), 0::bigint, 'sin token no se ven campañas')
  from public.campanas;
reset role;

-- 7. Cancelar: anula los cupones sin canjear y deja el canjeado
set local role authenticated;
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000002';
select pg_temp.igual(public.campana_cancelar(current_setting('prueba.c1')::uuid), '{"anulados": 2}'::jsonb,
       'cancelar anula los cupones sin canjear');
select pg_temp.igual(string_agg(estado, ',' order by estado), 'anulado,anulado,canjeado', 'el canjeado se conserva')
  from public.cupones where campana_id = current_setting('prueba.c1')::uuid;
select pg_temp.igual(estado, 'cancelada', 'la lista la muestra cancelada')
  from public.campanas_negocio(current_setting('prueba.a')::uuid) where id = current_setting('prueba.c1')::uuid;
select pg_temp.debe_fallar(format('select public.campana_cancelar(%L)', current_setting('prueba.c1')),
       'campana_no_editable', 'no se cancela dos veces');

-- 8. Programada: queda activa sin cupones hasta su día; pg_cron la emite
select set_config('prueba.c2', public.campana_guardar(
  current_setting('prueba.a')::uuid, 'producto_gratis', 'Topping gratis de cumpleaños', 'cumple',
  current_setting('prueba.hoy')::date + 3, current_setting('prueba.hoy')::date + 10,
  null, 'topping')::text, true);
select pg_temp.igual(disparador, 'programada', 'empezar otro día la programa')
  from public.campanas where id = current_setting('prueba.c2')::uuid;
select pg_temp.igual((public.campana_lanzar(current_setting('prueba.c2')::uuid) ->> 'programada')::boolean, true,
       'lanzar una futura la deja programada');
select pg_temp.igual(estado, 'programada', 'la lista la muestra programada')
  from public.campanas_negocio(current_setting('prueba.a')::uuid) where id = current_setting('prueba.c2')::uuid;
reset role;
select pg_temp.igual(privado.lanzar_campanas_programadas(), 0, 'el job no emite antes de su día');
-- Llega su día.
update public.campanas set programada_para = now() - interval '1 minute' where id = current_setting('prueba.c2')::uuid;
select pg_temp.igual(privado.lanzar_campanas_programadas(), 1, 'el job emite la programada cuando llega su día');
select pg_temp.igual(string_agg(t.token_publico, ','), 'token-campana-ana', 'segmento cumple: cumple este mes y ya tiene un sello')
  from public.cupones k join public.tarjetas t on t.id = k.tarjeta_id
 where k.campana_id = current_setting('prueba.c2')::uuid;
select pg_temp.igual(privado.lanzar_campanas_programadas(), 0, 'el job no la emite dos veces');

-- Programada que vence sin lanzarse (negocio suspendido): el job la cierra.
set local role authenticated;
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000002';
select set_config('prueba.c3', public.campana_guardar(
  current_setting('prueba.a')::uuid, 'monto_fijo', '$5.000 de descuento', 'inactivos',
  current_setting('prueba.hoy')::date + 1, current_setting('prueba.hoy')::date + 2, 5000)::text, true);
select public.campana_lanzar(current_setting('prueba.c3')::uuid);
reset role;
update public.campanas set programada_para = now() - interval '3 days', termina_en = now() - interval '1 day'
 where id = current_setting('prueba.c3')::uuid;
select pg_temp.igual(privado.lanzar_campanas_programadas(), 0, 'una vencida no se emite');
select pg_temp.igual(estado, 'finalizada', 'el job cierra la vencida')
  from public.campanas where id = current_setting('prueba.c3')::uuid;

-- 9. Borrar un borrador borra su oferta; negocio suspendido no lanza
set local role authenticated;
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000002';
select set_config('prueba.c4', public.campana_guardar(
  current_setting('prueba.a')::uuid, 'porcentaje', '10% para nuevos', 'nuevos',
  current_setting('prueba.hoy')::date, current_setting('prueba.hoy')::date, 10)::text, true);
select set_config('prueba.o4', (select oferta_id::text from public.campanas where id = current_setting('prueba.c4')::uuid), true);
select pg_temp.debe_fallar(format('delete from public.campanas where id = %L', current_setting('prueba.c4')),
       'permission denied', 'no se borran campañas directo');
select public.campana_eliminar(current_setting('prueba.c4')::uuid);
select pg_temp.igual(count(*), 0::bigint, 'borrar el borrador borra su oferta')
  from public.ofertas where id = current_setting('prueba.o4')::uuid;
select set_config('prueba.c5', public.campana_guardar(
  current_setting('prueba.a')::uuid, 'porcentaje', '10% para nuevos', 'nuevos',
  current_setting('prueba.hoy')::date, current_setting('prueba.hoy')::date, 10)::text, true);
reset role;
update public.negocios set estado = 'suspendido' where id = current_setting('prueba.a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = 'ea000000-0000-0000-0000-000000000002';
select pg_temp.debe_fallar(format('select public.campana_lanzar(%L)', current_setting('prueba.c5')),
       'negocio_inactivo', 'un negocio suspendido no lanza campañas');
reset role;

-- 10. anon no llama las funciones del panel
set local role anon;
select pg_temp.debe_fallar(format('select public.campanas_alcance(%L)', current_setting('prueba.a')),
       'permission denied', 'anon no ve el alcance');
select pg_temp.debe_fallar(format('select public.campana_lanzar(%L)', current_setting('prueba.c5')),
       'permission denied', 'anon no lanza campañas');
reset role;

rollback;
