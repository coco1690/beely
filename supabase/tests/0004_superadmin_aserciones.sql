-- Aserciones de la migración 0003: el rol "plataforma" ahora es "superadmin".
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

-- 1. Esquema: el rol se llama superadmin en todas partes
select pg_temp.igual(to_regclass('public.superadmins') is not null, true, 'existe public.superadmins');
select pg_temp.igual(to_regclass('public.administradores_plataforma'), null::regclass, 'ya no existe administradores_plataforma');
select pg_temp.igual(to_regprocedure('privado.es_superadmin()') is not null, true, 'existe privado.es_superadmin()');
select pg_temp.igual(to_regprocedure('privado.es_admin_plataforma()'), null::regprocedure, 'ya no existe es_admin_plataforma');
select pg_temp.igual(to_regprocedure('public.plataforma_actualizar_negocio(uuid,text,text)'), null::regprocedure,
                     'ya no existe plataforma_actualizar_negocio');
select pg_temp.igual(count(*), 0::bigint, 'ninguna política menciona plataforma')
  from pg_policies
 where schemaname = 'public'
   and (coalesce(qual, '') || coalesce(with_check, '') || policyname) like '%plataforma%';
select pg_temp.igual(count(*), 0::bigint, 'ninguna función de Beely menciona plataforma')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'privado') and (p.proname || p.prosrc) like '%plataforma%';

-- 2. Usuarios: un superadmin y un usuario común
insert into auth.users (id, email) values
 ('c0000000-0000-0000-0000-000000000001', 'super@prueba.co'),
 ('c0000000-0000-0000-0000-000000000002', 'comun@prueba.co');
insert into public.superadmins (usuario_id) values ('c0000000-0000-0000-0000-000000000001');

-- 3. El superadmin conserva todos los permisos
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.igual(privado.es_superadmin(), true, 'superadmin se reconoce');
select pg_temp.igual(count(*), 1::bigint, 'superadmin ve su fila')
  from public.superadmins where usuario_id = 'c0000000-0000-0000-0000-000000000001';
select set_config('prueba.negocio', public.crear_negocio('cafe-super', 'Café Super')::text, true);
select pg_temp.igual(privado.tiene_rol(current_setting('prueba.negocio')::uuid, array['dueno']), true,
                     'superadmin tiene cualquier rol en cualquier negocio');
insert into public.sedes (id, negocio_id, nombre) values
 ('c1000000-0000-0000-0000-000000000001', current_setting('prueba.negocio')::uuid, 'Centro');
select pg_temp.igual(count(*), 1::bigint, 'superadmin crea sedes')
  from public.sedes where id = 'c1000000-0000-0000-0000-000000000001';
insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 (current_setting('prueba.negocio')::uuid, 'c0000000-0000-0000-0000-000000000002', 'dueno');
select pg_temp.igual(count(*), 1::bigint, 'superadmin asigna dueños')
  from public.miembros_negocio where negocio_id = current_setting('prueba.negocio')::uuid and rol = 'dueno';
select public.superadmin_actualizar_negocio(current_setting('prueba.negocio')::uuid, 'pro', 'activo');
select pg_temp.igual(plan, 'pro', 'superadmin cambia plan')
  from public.negocios where id = current_setting('prueba.negocio')::uuid;

-- 4. Un usuario común (aunque sea dueño) no es superadmin
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000002';
select pg_temp.igual(privado.es_superadmin(), false, 'dueño no es superadmin');
select pg_temp.igual(count(*), 0::bigint, 'dueño no ve la tabla de superadmins') from public.superadmins;
select pg_temp.debe_fallar(
  $q$select public.crear_negocio('pirata-2', 'Pirata')$q$, 'sin_permiso', 'dueño no crea negocios');
select pg_temp.debe_fallar(
  format($q$select public.superadmin_actualizar_negocio(%L, 'empresa', 'activo')$q$, current_setting('prueba.negocio')),
  'sin_permiso', 'dueño no cambia su plan');
select pg_temp.debe_fallar(
  $q$insert into public.superadmins (usuario_id) values ('c0000000-0000-0000-0000-000000000002')$q$,
  'row-level security', 'dueño no se hace superadmin');

rollback;
\echo 'Todas las aserciones de superadmin pasaron.'
