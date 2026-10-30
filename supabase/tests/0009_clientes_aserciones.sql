-- Aserciones de la migración 0008: listas de clientes del negocio y del superadmin.
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

-- 1. Datos: superadmin, dueño, administrador y cajero de A; dueño de B
insert into auth.users (id, email) values
 ('e9000000-0000-0000-0000-000000000001', 'super@clientes.co'),
 ('e9000000-0000-0000-0000-000000000002', 'dueno-a@clientes.co'),
 ('e9000000-0000-0000-0000-000000000003', 'admin-a@clientes.co'),
 ('e9000000-0000-0000-0000-000000000004', 'cajero-a@clientes.co'),
 ('e9000000-0000-0000-0000-000000000005', 'dueno-b@clientes.co');
insert into public.superadmins (usuario_id) values ('e9000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'e9000000-0000-0000-0000-000000000001';
select set_config('prueba.a', public.crear_negocio('clientes-a', 'Clientes A')::text, true);
select set_config('prueba.b', public.crear_negocio('clientes-b', 'Clientes B')::text, true);
reset role;

insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 (current_setting('prueba.a')::uuid, 'e9000000-0000-0000-0000-000000000002', 'dueno'),
 (current_setting('prueba.a')::uuid, 'e9000000-0000-0000-0000-000000000003', 'administrador'),
 (current_setting('prueba.a')::uuid, 'e9000000-0000-0000-0000-000000000004', 'cajero'),
 (current_setting('prueba.b')::uuid, 'e9000000-0000-0000-0000-000000000005', 'dueno');

-- A: Ana (nueva, con premio, cumple este mes), Beto (viejo, sin volver), Carla (vieja, volvió ayer). B: Dora.
insert into public.clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, acepta_marketing, version_politica, creado_en) values
 ('e9200000-0000-0000-0000-000000000001', current_setting('prueba.a')::uuid, '+573001110001', 'Ana Ruiz',
  make_date(1990, extract(month from now() at time zone 'America/Bogota')::integer, 1), true, true, 'v1', now() - interval '2 days'),
 ('e9200000-0000-0000-0000-000000000002', current_setting('prueba.a')::uuid, '+573002220002', 'Beto Gil',
  make_date(1991, (extract(month from now() at time zone 'America/Bogota')::integer % 12) + 1, 1), true, false, 'v1', now() - interval '90 days'),
 ('e9200000-0000-0000-0000-000000000003', current_setting('prueba.a')::uuid, '+573003330003', 'Carla Paz',
  make_date(1992, (extract(month from now() at time zone 'America/Bogota')::integer % 12) + 1, 2), true, false, 'v1', now() - interval '60 days'),
 ('e9200000-0000-0000-0000-000000000004', current_setting('prueba.b')::uuid, '+573004440004', 'Dora Luz',
  '1993-03-03', true, false, 'v1', now() - interval '1 day');
insert into public.tarjetas (id, negocio_id, programa_id, cliente_id, sellos_actuales, sellos_historicos, premios_ganados, ultima_visita_en)
select v.tarjeta, p.negocio_id, p.id, v.cliente, v.actuales, v.historicos, v.premios, v.visita
  from (values
    ('e9300000-0000-0000-0000-000000000001'::uuid, 'e9200000-0000-0000-0000-000000000001'::uuid, current_setting('prueba.a')::uuid, 2, 12, 1, now()),
    ('e9300000-0000-0000-0000-000000000002'::uuid, 'e9200000-0000-0000-0000-000000000002'::uuid, current_setting('prueba.a')::uuid, 4, 4, 0, now() - interval '80 days'),
    ('e9300000-0000-0000-0000-000000000003'::uuid, 'e9200000-0000-0000-0000-000000000003'::uuid, current_setting('prueba.a')::uuid, 7, 27, 2, now() - interval '1 day'),
    ('e9300000-0000-0000-0000-000000000004'::uuid, 'e9200000-0000-0000-0000-000000000004'::uuid, current_setting('prueba.b')::uuid, 1, 1, 0, now())
  ) as v (tarjeta, cliente, negocio, actuales, historicos, premios, visita)
  join public.programas p on p.negocio_id = v.negocio;
insert into public.cupones (negocio_id, tarjeta_id, origen, descripcion, estado, vence_en) values
 (current_setting('prueba.a')::uuid, 'e9300000-0000-0000-0000-000000000001', 'premio_sellos', 'Helado', 'emitido', now() + interval '10 days'),
 (current_setting('prueba.a')::uuid, 'e9300000-0000-0000-0000-000000000003', 'premio_sellos', 'Helado', 'emitido', now() - interval '1 day');

-- 2. Dueño de A: lista, filtros, búsqueda, orden y paginación
set local role authenticated;
set local request.jwt.claim.sub = 'e9000000-0000-0000-0000-000000000002';
select pg_temp.igual(count(*), 3::bigint, 'el dueño ve los 3 clientes de A')
  from public.clientes_negocio(current_setting('prueba.a')::uuid);
select pg_temp.igual(nombre, 'Ana Ruiz', 'orden por defecto: el más reciente primero'),
       pg_temp.igual(total, 3, 'total en cada fila'),
       pg_temp.igual(sellos_requeridos, 10, 'trae los sellos requeridos del programa'),
       pg_temp.igual(cupones_vigentes, 1, 'cuenta el cupón vigente')
  from public.clientes_negocio(current_setting('prueba.a')::uuid) limit 1;
select pg_temp.igual(string_agg(nombre, ',' order by nombre), 'Ana Ruiz', 'filtro premio: solo cupones emitidos y vigentes')
  from public.clientes_negocio(current_setting('prueba.a')::uuid, null, 'premio');
select pg_temp.igual(string_agg(nombre, ','), 'Ana Ruiz', 'filtro cumple: cumple este mes')
  from public.clientes_negocio(current_setting('prueba.a')::uuid, null, 'cumple');
select pg_temp.igual(string_agg(nombre, ','), 'Beto Gil', 'filtro inactivos: más de 30 días sin volver')
  from public.clientes_negocio(current_setting('prueba.a')::uuid, null, 'inactivos');
select pg_temp.igual(string_agg(nombre, ','), 'Carla Paz', 'busca por nombre sin distinguir mayúsculas')
  from public.clientes_negocio(current_setting('prueba.a')::uuid, 'CARLA');
select pg_temp.igual(string_agg(nombre, ','), 'Beto Gil', 'busca por parte del celular')
  from public.clientes_negocio(current_setting('prueba.a')::uuid, '300 222');
select pg_temp.igual(count(*), 0::bigint, 'los comodines de LIKE no se interpretan')
  from public.clientes_negocio(current_setting('prueba.a')::uuid, '%');
select pg_temp.igual(nombre, 'Carla Paz', 'orden por sellos históricos')
  from public.clientes_negocio(current_setting('prueba.a')::uuid, null, 'todos', 'sellos') limit 1;
select pg_temp.igual(nombre, 'Beto Gil', 'paginación: segunda página')
  from public.clientes_negocio(current_setting('prueba.a')::uuid, null, 'todos', 'nombre', 1, 1);
select pg_temp.igual(public.clientes_resumen(current_setting('prueba.a')::uuid),
       '{"total": 3, "nuevos_30": 1, "marketing": 1, "premio": 1, "cumple": 1, "inactivos": 1}'::jsonb,
       'resumen de A');
select pg_temp.debe_fallar(format('select * from public.clientes_negocio(%L)', current_setting('prueba.b')),
       'sin_permiso', 'el dueño de A no lista los clientes de B');
select pg_temp.debe_fallar(format('select * from public.clientes_negocio(%L, null, %L)', current_setting('prueba.a'), 'todo'),
       'solicitud_invalida', 'filtro desconocido');
select pg_temp.debe_fallar(format('select * from public.clientes_negocio(%L, null, %L, %L, 500)', current_setting('prueba.a'), 'todos', 'reciente'),
       'solicitud_invalida', 'límite fuera de rango');
select pg_temp.debe_fallar('select * from public.superadmin_clientes()', 'sin_permiso', 'el dueño no ve la lista global');

-- 3. Administrador sí; cajero no
set local request.jwt.claim.sub = 'e9000000-0000-0000-0000-000000000003';
select pg_temp.igual(count(*), 3::bigint, 'el administrador lista los clientes')
  from public.clientes_negocio(current_setting('prueba.a')::uuid);
set local request.jwt.claim.sub = 'e9000000-0000-0000-0000-000000000004';
select pg_temp.debe_fallar(format('select * from public.clientes_negocio(%L)', current_setting('prueba.a')),
       'sin_permiso', 'el cajero no lista los clientes');
select pg_temp.debe_fallar(format('select public.clientes_resumen(%L)', current_setting('prueba.a')),
       'sin_permiso', 'el cajero no ve el resumen');
reset role;

-- 4. Superadmin: todos los negocios, filtro y búsqueda
set local role authenticated;
set local request.jwt.claim.sub = 'e9000000-0000-0000-0000-000000000001';
select pg_temp.igual(count(*), (select count(*) from public.clientes), 'el superadmin ve los clientes de todos los negocios')
  from public.superadmin_clientes(null, null, 200);
select pg_temp.igual(string_agg(nombre, ','), 'Dora Luz', 'filtra por negocio'),
       pg_temp.igual(max(negocio_nombre), 'Clientes B', 'trae el nombre del negocio'),
       pg_temp.igual(max(celular), '+573004440004', 'trae el celular completo')
  from public.superadmin_clientes(current_setting('prueba.b')::uuid);
select pg_temp.igual(string_agg(nombre, ','), 'Ana Ruiz', 'busca por celular en toda la plataforma')
  from public.superadmin_clientes(null, '3001110001');
select pg_temp.igual(count(*), 3::bigint, 'el superadmin también usa la lista del negocio')
  from public.clientes_negocio(current_setting('prueba.a')::uuid);
reset role;

-- 5. anon no ejecuta nada
set local role anon;
select pg_temp.debe_fallar(format('select * from public.clientes_negocio(%L)', current_setting('prueba.a')),
       'permission denied', 'anon no lista clientes');
select pg_temp.debe_fallar('select * from public.superadmin_clientes()', 'permission denied', 'anon no ve la lista global');
reset role;

rollback;
