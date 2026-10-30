-- Aserciones de la migración 0010: push de las campañas.
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
grant execute on function pg_temp.debe_fallar(text, text, text) to authenticated, anon, service_role;

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
grant execute on function pg_temp.igual(anyelement, anyelement, text) to authenticated, anon, service_role;

-- Lanza una campaña de hoy para todos y devuelve su id.
create function pg_temp.lanzar(p_titulo text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := public.campana_guardar(current_setting('prueba.a')::uuid, 'producto_gratis', p_titulo, 'todos',
            (now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date + 6,
            null, 'topping', 'Pasa por el tuyo');
  perform public.campana_lanzar(v_id);
  return v_id;
end;
$$;
grant execute on function pg_temp.lanzar(text) to authenticated;

-- Estado y motivo de un envío push de (campaña, tarjeta).
create function pg_temp.envio(p_campana uuid, p_tarjeta uuid)
returns text
language sql
as $$
  select estado || coalesce(':' || error, '') from public.envios_campana
   where campana_id = p_campana and tarjeta_id = p_tarjeta and canal = 'push';
$$;

-- 1. Datos: dueño de A. Ana (dos teléfonos), Beto (uno), Carla (sin notificaciones),
-- Dino (no acepta promociones, con teléfono).
insert into auth.users (id, email) values
 ('eb000000-0000-0000-0000-000000000001', 'super@push.co'),
 ('eb000000-0000-0000-0000-000000000002', 'dueno-a@push.co');
insert into public.superadmins (usuario_id) values ('eb000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'eb000000-0000-0000-0000-000000000001';
select set_config('prueba.a', public.crear_negocio('push-a', 'Heladería Push')::text, true);
reset role;

insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 (current_setting('prueba.a')::uuid, 'eb000000-0000-0000-0000-000000000002', 'dueno');
update public.negocios
   set logo_url = 'https://logos.example/push-a.png', max_push_semana = 2,
       hora_inicio_envios = '00:00', hora_fin_envios = '00:00'
 where id = current_setting('prueba.a')::uuid;

insert into public.clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, acepta_marketing, version_politica) values
 ('eb200000-0000-0000-0000-000000000001', current_setting('prueba.a')::uuid, '+573201110001', 'Ana', '1990-01-01', true, true, 'v1'),
 ('eb200000-0000-0000-0000-000000000002', current_setting('prueba.a')::uuid, '+573202220002', 'Beto', '1991-01-01', true, true, 'v1'),
 ('eb200000-0000-0000-0000-000000000003', current_setting('prueba.a')::uuid, '+573203330003', 'Carla', '1992-01-01', true, true, 'v1'),
 ('eb200000-0000-0000-0000-000000000004', current_setting('prueba.a')::uuid, '+573204440004', 'Dino', '1993-01-01', true, false, 'v1');
insert into public.tarjetas (id, negocio_id, programa_id, cliente_id, token_publico)
select v.tarjeta, p.negocio_id, p.id, v.cliente, v.token
  from (values
    ('eb300000-0000-0000-0000-000000000001'::uuid, 'eb200000-0000-0000-0000-000000000001'::uuid, 'token-push-ana'),
    ('eb300000-0000-0000-0000-000000000002'::uuid, 'eb200000-0000-0000-0000-000000000002'::uuid, 'token-push-beto'),
    ('eb300000-0000-0000-0000-000000000003'::uuid, 'eb200000-0000-0000-0000-000000000003'::uuid, 'token-push-carla'),
    ('eb300000-0000-0000-0000-000000000004'::uuid, 'eb200000-0000-0000-0000-000000000004'::uuid, 'token-push-dino')
  ) as v (tarjeta, cliente, token)
  join public.programas p on p.negocio_id = current_setting('prueba.a')::uuid;
insert into public.suscripciones_push (id, negocio_id, tarjeta_id, endpoint, p256dh, auth) values
 ('eb400000-0000-0000-0000-000000000001', current_setting('prueba.a')::uuid, 'eb300000-0000-0000-0000-000000000001', 'https://push.example/ana-1', 'p-ana-1', 'a-ana-1'),
 ('eb400000-0000-0000-0000-000000000002', current_setting('prueba.a')::uuid, 'eb300000-0000-0000-0000-000000000001', 'https://push.example/ana-2', 'p-ana-2', 'a-ana-2'),
 ('eb400000-0000-0000-0000-000000000003', current_setting('prueba.a')::uuid, 'eb300000-0000-0000-0000-000000000002', 'https://push.example/beto', 'p-beto', 'a-beto'),
 ('eb400000-0000-0000-0000-000000000004', current_setting('prueba.a')::uuid, 'eb300000-0000-0000-0000-000000000004', 'https://push.example/dino', 'p-dino', 'a-dino');

-- 2. El alcance cuenta quién recibe también la notificación
set local role authenticated;
set local request.jwt.claim.sub = 'eb000000-0000-0000-0000-000000000002';
select pg_temp.igual(public.campanas_alcance(current_setting('prueba.a')::uuid) -> 'push',
       '{"todos": 2, "inactivos": 0, "cumple": 0, "nuevos": 2}'::jsonb,
       'alcance push: solo quien acepta promociones y tiene notificaciones activas');

-- 3. Lanzar encola un push por tarjeta con notificaciones
select set_config('prueba.c0', pg_temp.lanzar('Topping gratis')::text, true);
reset role;
select pg_temp.igual(count(*), 2::bigint, 'lanzar encola un push por tarjeta con teléfono suscrito')
  from public.envios_campana where campana_id = current_setting('prueba.c0')::uuid;
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c0')::uuid, 'eb300000-0000-0000-0000-000000000003'), null::text,
       'sin notificaciones no se encola (el cupón sí llega)');
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c0')::uuid, 'eb300000-0000-0000-0000-000000000004'), null::text,
       'quien no acepta promociones no recibe push');
select privado.emitir_campana(current_setting('prueba.c0')::uuid);
select pg_temp.igual(count(*), 2::bigint, 'emitir de nuevo no duplica la cola')
  from public.envios_campana where campana_id = current_setting('prueba.c0')::uuid;

-- 4. Solo la service_role toma y registra envíos
set local role authenticated;
set local request.jwt.claim.sub = 'eb000000-0000-0000-0000-000000000002';
select pg_temp.debe_fallar('select * from public.push_tomar()', 'permission denied', 'el equipo no toma envíos');
select pg_temp.debe_fallar($q$select public.push_registrar('[]')$q$, 'permission denied', 'el equipo no registra envíos');
reset role;
set local role anon;
select pg_temp.debe_fallar('select * from public.push_tomar()', 'permission denied', 'anon no toma envíos');
reset role;

-- 5. Fuera de la franja horaria no sale nada
set local role service_role;
select pg_temp.igual(count(*), 0::bigint, 'fuera de la franja no se toma nada') from public.push_tomar();
reset role;
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c0')::uuid, 'eb300000-0000-0000-0000-000000000001'), 'pendiente',
       'fuera de la franja el envío espera');
update public.negocios set hora_inicio_envios = '00:00', hora_fin_envios = '23:59:59.999999'
 where id = current_setting('prueba.a')::uuid;

-- 6. Dentro de la franja: lote con todo lo que necesita la notificación
set local role service_role;
create temp table lote on commit drop as select * from public.push_tomar(current_setting('prueba.a')::uuid);
select pg_temp.igual(count(*), 2::bigint, 'toma los dos envíos') from lote;
select pg_temp.igual(titulo || '|' || mensaje || '|' || negocio_nombre || '|' || logo_url || '|' || token_publico || '|' || jsonb_array_length(suscripciones),
       'Topping gratis|Pasa por el tuyo|Heladería Push|https://logos.example/push-a.png|token-push-ana|2',
       'el lote trae título, mensaje, negocio, logo, token y los dos teléfonos de Ana')
  from lote where token_publico = 'token-push-ana';
select pg_temp.igual(count(*), 0::bigint, 'lo tomado no se vuelve a tomar') from public.push_tomar();
reset role;
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c0')::uuid, 'eb300000-0000-0000-0000-000000000001'), 'enviando',
       'el envío tomado queda enviando');

-- 7. Registrar: Ana llegó a un teléfono y el otro venció; a Beto le falló
set local role service_role;
select public.push_registrar(jsonb_build_array(
  jsonb_build_object('envio_id', (select envio_id from lote where token_publico = 'token-push-ana'), 'enviado', true,
                     'entregadas', jsonb_build_array('eb400000-0000-0000-0000-000000000001'),
                     'vencidas', jsonb_build_array('eb400000-0000-0000-0000-000000000002')),
  jsonb_build_object('envio_id', (select envio_id from lote where token_publico = 'token-push-beto'), 'enviado', false,
                     'error', 'http_500', 'entregadas', '[]'::jsonb, 'vencidas', '[]'::jsonb)));
reset role;
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c0')::uuid, 'eb300000-0000-0000-0000-000000000001'), 'enviado',
       'Ana: enviado');
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c0')::uuid, 'eb300000-0000-0000-0000-000000000002'), 'fallido:http_500',
       'Beto: fallido con su error');
select pg_temp.igual(revocada_en is not null, true, 'el teléfono vencido se revoca')
  from public.suscripciones_push where id = 'eb400000-0000-0000-0000-000000000002';
select pg_temp.igual(ultimo_uso_en is not null and revocada_en is null, true, 'el teléfono que recibió queda activo con su último uso')
  from public.suscripciones_push where id = 'eb400000-0000-0000-0000-000000000001';

-- Si todos los teléfonos vencieron, el envío se omite (no es una falla)
set local role authenticated;
set local request.jwt.claim.sub = 'eb000000-0000-0000-0000-000000000002';
select set_config('prueba.cv', pg_temp.lanzar('Campaña vencida')::text, true);
reset role;
insert into public.suscripciones_push (id, negocio_id, tarjeta_id, endpoint, p256dh, auth) values
 ('eb400000-0000-0000-0000-000000000005', current_setting('prueba.a')::uuid, 'eb300000-0000-0000-0000-000000000003', 'https://push.example/carla', 'p-carla', 'a-carla');
-- Carla se suscribió después de lanzar: emitir de nuevo la encola sin duplicar a los demás.
select privado.emitir_campana(current_setting('prueba.cv')::uuid);
set local role service_role;
select public.push_registrar(coalesce((
  select jsonb_agg(jsonb_build_object('envio_id', envio_id, 'enviado', false, 'error', 'http_410',
                                      'vencidas', jsonb_build_array('eb400000-0000-0000-0000-000000000005')))
    from public.push_tomar() where token_publico = 'token-push-carla'), '[]'));
reset role;
select pg_temp.igual(pg_temp.envio(current_setting('prueba.cv')::uuid, 'eb300000-0000-0000-0000-000000000003'), 'omitido:sin_suscripcion',
       'si todos sus teléfonos vencieron se omite');
-- Los demás envíos de esa campaña se toman en el lote de arriba: se dan por enviados para seguir.
update public.envios_campana set estado = 'omitido', error = 'prueba'
 where campana_id = current_setting('prueba.cv')::uuid and estado = 'enviando';

-- 8. Tope semanal: un push por tarjeta en cada lote y máximo 2 en 7 días
set local role authenticated;
set local request.jwt.claim.sub = 'eb000000-0000-0000-0000-000000000002';
select set_config('prueba.c1', pg_temp.lanzar('Segunda campaña')::text, true);
select set_config('prueba.c2', pg_temp.lanzar('Tercera campaña')::text, true);
reset role;
set local role service_role;
select pg_temp.igual(count(*), 2::bigint, 'un push por tarjeta en cada lote')
  from (select public.push_registrar(jsonb_build_array(jsonb_build_object('envio_id', envio_id, 'enviado', true,
                                     'entregadas', jsonb_build_array(suscripciones -> 0 -> 'id'))))
          from public.push_tomar()) x;
reset role;
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c1')::uuid, 'eb300000-0000-0000-0000-000000000001') || ',' ||
                     pg_temp.envio(current_setting('prueba.c2')::uuid, 'eb300000-0000-0000-0000-000000000001'),
       'enviado,pendiente', 'la segunda campaña sale y la tercera espera al siguiente lote');
set local role service_role;
select pg_temp.igual(string_agg(token_publico, ','), 'token-push-beto', 'Beto aún tiene cupo (su primer push falló)')
  from public.push_tomar();
reset role;
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c2')::uuid, 'eb300000-0000-0000-0000-000000000001'), 'omitido:tope_semanal',
       'Ana llegó a 2 push en la semana: se omite');

-- Un envío que quedó tomado más de 10 minutos vuelve a la cola
update public.envios_campana set tomado_en = now() - interval '11 minutes'
 where campana_id = current_setting('prueba.c2')::uuid and tarjeta_id = 'eb300000-0000-0000-0000-000000000002';
set local role service_role;
select pg_temp.igual(count(*), 1::bigint, 'lo tomado y abandonado se vuelve a tomar') from public.push_tomar();
reset role;

-- 9. Lo que ya no debe salir se omite con su motivo
update public.negocios set max_push_semana = 14 where id = current_setting('prueba.a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = 'eb000000-0000-0000-0000-000000000002';
select set_config('prueba.c3', pg_temp.lanzar('Cancelada')::text, true);
select public.campana_cancelar(current_setting('prueba.c3')::uuid);
select set_config('prueba.c4', pg_temp.lanzar('Canjeada')::text, true);
reset role;
select public.canjear_cupon(current_setting('prueba.a')::uuid, k.codigo, 'venta-push-1')
  from public.cupones k
 where k.campana_id = current_setting('prueba.c4')::uuid and k.tarjeta_id = 'eb300000-0000-0000-0000-000000000001';
update public.clientes set acepta_marketing = false where id = 'eb200000-0000-0000-0000-000000000002';
set local role service_role;
select pg_temp.igual(count(*), 0::bigint, 'nada que enviar') from public.push_tomar();
reset role;
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c3')::uuid, 'eb300000-0000-0000-0000-000000000001'), 'omitido:campana_terminada',
       'campaña cancelada: se omite');
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c4')::uuid, 'eb300000-0000-0000-0000-000000000001'), 'omitido:cupon_usado',
       'cupón ya canjeado: se omite');
select pg_temp.igual(pg_temp.envio(current_setting('prueba.c4')::uuid, 'eb300000-0000-0000-0000-000000000002'), 'omitido:sin_marketing',
       'dejó de aceptar promociones: se omite');

-- 10. La lista del panel cuenta los push
set local role authenticated;
set local request.jwt.claim.sub = 'eb000000-0000-0000-0000-000000000002';
select pg_temp.igual(push_enviados || ':' || push_pendientes, '1:0', 'la lista cuenta los push enviados y en cola')
  from public.campanas_negocio(current_setting('prueba.a')::uuid) where id = current_setting('prueba.c0')::uuid;
reset role;

rollback;
