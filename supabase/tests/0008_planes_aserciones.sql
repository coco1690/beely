-- Aserciones de la migración 0007: planes administrados por el superadmin.
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


-- 1. Datos: un superadmin, un dueño con su negocio y un usuario sin rol
insert into auth.users (id, email) values
 ('e8000000-0000-0000-0000-000000000001', 'super@planes.co'),
 ('e8000000-0000-0000-0000-000000000002', 'dueno@planes.co'),
 ('e8000000-0000-0000-0000-000000000003', 'nadie@planes.co');
insert into public.superadmins (usuario_id) values ('e8000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'e8000000-0000-0000-0000-000000000001';
select set_config('prueba.negocio', public.crear_negocio('heladeria-planes', 'Heladería Planes')::text, true);
reset role;
insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 (current_setting('prueba.negocio')::uuid, 'e8000000-0000-0000-0000-000000000002', 'dueno');

-- 2. Los planes de antes siguen y el negocio nuevo arranca en básico
select pg_temp.igual((select count(*) from public.planes where codigo in ('basico', 'pro', 'empresa')), 3::bigint, 'planes iniciales sembrados');
select pg_temp.igual(plan, 'basico', 'negocio nuevo en plan básico') from public.negocios where id = current_setting('prueba.negocio')::uuid;

-- 3. El superadmin crea, edita y desactiva planes
set local role authenticated;
set local request.jwt.claim.sub = 'e8000000-0000-0000-0000-000000000001';
insert into public.planes (codigo, nombre, descripcion, precio_mensual, max_sedes, max_clientes, orden)
values ('premium', 'Premium', 'Para cadenas grandes', 250000, 20, null, 4);
select pg_temp.igual(precio_mensual, 250000.00::numeric, 'superadmin crea plan') from public.planes where codigo = 'premium';
update public.planes set precio_mensual = 199000, max_clientes = 5000 where codigo = 'premium';
select pg_temp.igual(max_clientes, 5000, 'superadmin edita plan') from public.planes where codigo = 'premium';
select pg_temp.debe_fallar($q$update public.planes set codigo = 'otro' where codigo = 'premium'$q$,
  'permission denied', 'el código del plan no se cambia');
select pg_temp.debe_fallar($q$delete from public.planes where codigo = 'premium'$q$,
  'permission denied', 'los planes no se borran');
select pg_temp.debe_fallar($q$insert into public.planes (codigo, nombre) values ('Mal Código', 'Malo')$q$,
  'planes_codigo_check', 'código con formato inválido');
select pg_temp.debe_fallar($q$insert into public.planes (codigo, nombre, precio_mensual) values ('negativo', 'Negativo', -1)$q$,
  'planes_precio_mensual_check', 'precio negativo');

-- 4. Asignar planes a un negocio
select public.superadmin_actualizar_negocio(current_setting('prueba.negocio')::uuid, 'premium', 'activo');
select pg_temp.igual(plan, 'premium', 'superadmin asigna plan nuevo') from public.negocios where id = current_setting('prueba.negocio')::uuid;
update public.planes set activo = false where codigo = 'premium';
select public.superadmin_actualizar_negocio(current_setting('prueba.negocio')::uuid, 'premium', 'suspendido');
select pg_temp.igual(estado, 'suspendido', 'conserva un plan desactivado al cambiar el estado') from public.negocios where id = current_setting('prueba.negocio')::uuid;
update public.planes set activo = false where codigo = 'pro';
select pg_temp.debe_fallar(format($q$select public.superadmin_actualizar_negocio(%L, 'pro', 'activo')$q$, current_setting('prueba.negocio')),
  'plan_no_disponible', 'no asigna un plan desactivado');
select pg_temp.debe_fallar(format($q$select public.superadmin_actualizar_negocio(%L, 'no-existe', 'activo')$q$, current_setting('prueba.negocio')),
  'plan_no_disponible', 'no asigna un plan que no existe');
reset role;

-- 5. Nadie más ve ni toca planes
set local role authenticated;
set local request.jwt.claim.sub = 'e8000000-0000-0000-0000-000000000002';
select pg_temp.igual((select count(*) from public.planes), 0::bigint, 'el dueño no ve planes');
select pg_temp.debe_fallar($q$insert into public.planes (codigo, nombre) values ('gratis', 'Gratis')$q$,
  'row-level security', 'el dueño no crea planes');
update public.planes set precio_mensual = 99 where codigo = 'empresa';
reset role;
select pg_temp.igual(precio_mensual, 0.00::numeric, 'el dueño no edita planes') from public.planes where codigo = 'empresa';

set local role authenticated;
set local request.jwt.claim.sub = 'e8000000-0000-0000-0000-000000000003';
select pg_temp.igual((select count(*) from public.planes), 0::bigint, 'un usuario sin rol no ve planes');
reset role;

set local role anon;
select pg_temp.debe_fallar($q$select * from public.planes$q$, 'permission denied', 'anon no ve planes');
reset role;

-- 6. Un plan en uso no se borra ni con service_role
select pg_temp.debe_fallar($q$delete from public.planes where codigo = 'premium'$q$,
  'negocios_plan_fkey', 'un plan en uso no se borra');

rollback;
