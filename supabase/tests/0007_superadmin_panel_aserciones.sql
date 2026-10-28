-- Aserciones de la migración 0006: panel del superadmin (tablero, métricas, eliminar negocio, equipo de plataforma).
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

-- 1. Datos: un superadmin, un dueño y un negocio con actividad
insert into auth.users (id, email, last_sign_in_at) values
 ('d0000000-0000-0000-0000-000000000001', 'super@prueba.co', now()),
 ('d0000000-0000-0000-0000-000000000002', 'dueno@prueba.co', null),
 ('d0000000-0000-0000-0000-000000000003', 'otro-super@prueba.co', now());
insert into public.superadmins (usuario_id) values ('d0000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
select set_config('prueba.negocio', public.crear_negocio('heladeria-panel', 'Heladería Panel')::text, true);
select set_config('prueba.vacio', public.crear_negocio('negocio-vacio', 'Negocio Vacío')::text, true);
insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 (current_setting('prueba.negocio')::uuid, 'd0000000-0000-0000-0000-000000000002', 'dueno');
insert into public.sedes (negocio_id, nombre) values (current_setting('prueba.negocio')::uuid, 'Centro');
reset role;

insert into public.clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, version_politica) values
 ('d2000000-0000-0000-0000-000000000001', current_setting('prueba.negocio')::uuid, '+573000000001', 'Ana', '1990-01-01', true, 'v1'),
 ('d2000000-0000-0000-0000-000000000002', current_setting('prueba.negocio')::uuid, '+573000000002', 'Beto', '1991-02-02', true, 'v1');
insert into public.tarjetas (id, negocio_id, programa_id, cliente_id)
select 'd3000000-0000-0000-0000-000000000001', negocio_id, id, 'd2000000-0000-0000-0000-000000000001'
  from public.programas where negocio_id = current_setting('prueba.negocio')::uuid;
insert into public.eventos_sello (negocio_id, tarjeta_id, cantidad, origen, creado_en) values
 (current_setting('prueba.negocio')::uuid, 'd3000000-0000-0000-0000-000000000001', 2, 'panel', now()),
 (current_setting('prueba.negocio')::uuid, 'd3000000-0000-0000-0000-000000000001', 3, 'api_pos', now() - interval '1 day'),
 (current_setting('prueba.negocio')::uuid, 'd3000000-0000-0000-0000-000000000001', -10, 'canje_premio', now()),
 (current_setting('prueba.negocio')::uuid, 'd3000000-0000-0000-0000-000000000001', 4, 'panel', now() - interval '90 days');
insert into public.cupones (negocio_id, tarjeta_id, origen, descripcion, estado, vence_en, canjeado_en) values
 (current_setting('prueba.negocio')::uuid, 'd3000000-0000-0000-0000-000000000001', 'premio_sellos', 'Helado', 'canjeado', now() + interval '30 days', now()),
 (current_setting('prueba.negocio')::uuid, 'd3000000-0000-0000-0000-000000000001', 'premio_sellos', 'Helado', 'emitido', now() + interval '30 days', null);

-- 2. Métricas por negocio
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.igual(count(*), 2::bigint, 'superadmin_negocios lista todos los negocios') from public.superadmin_negocios(30);
select pg_temp.igual(clientes, 2, 'cuenta clientes'),
       pg_temp.igual(sellos_periodo, 5, 'sellos del periodo: solo ventas, sin canjes ni fuera de la ventana'),
       pg_temp.igual(canjes_periodo, 1, 'cuenta canjes del periodo'),
       pg_temp.igual(sedes, 1, 'cuenta sedes'),
       pg_temp.igual(miembros, 1, 'cuenta miembros'),
       pg_temp.igual(dueno_email, 'dueno@prueba.co', 'trae el correo del dueño')
  from public.superadmin_negocios(30) where slug = 'heladeria-panel';
select pg_temp.igual(sellos_periodo, 9, 'la ventana de 120 días incluye el sello viejo')
  from public.superadmin_negocios(120) where slug = 'heladeria-panel';
select pg_temp.igual(clientes, 0, 'negocio sin actividad en cero'),
       pg_temp.igual(ultimo_sello_en, null::timestamptz, 'negocio sin sellos no tiene último sello')
  from public.superadmin_negocios(30) where slug = 'negocio-vacio';
select pg_temp.debe_fallar($q$select * from public.superadmin_negocios(0)$q$, 'solicitud_invalida', 'ventana fuera de rango');

-- 3. Tablero global
select pg_temp.igual((public.superadmin_tablero(30) -> 'negocios' ->> 'total')::int, 2, 'tablero cuenta negocios');
select pg_temp.igual((public.superadmin_tablero(30) -> 'clientes' ->> 'total')::int, 2, 'tablero cuenta clientes');
select pg_temp.igual((public.superadmin_tablero(30) -> 'sellos' ->> 'periodo')::int, 5, 'tablero suma sellos del periodo');
select pg_temp.igual((public.superadmin_tablero(30) -> 'cupones' ->> 'canjeados_periodo')::int, 1, 'tablero cuenta canjes');
select pg_temp.igual(jsonb_array_length(public.superadmin_tablero(7) -> 'serie'), 7, 'la serie trae un punto por día');
select pg_temp.igual(
  (select sum((p ->> 'sellos')::int) from jsonb_array_elements(public.superadmin_tablero(30) -> 'serie') p), 5::bigint,
  'la serie suma lo mismo que el total');

-- 4. Equipo de la plataforma
select pg_temp.igual(count(*), 1::bigint, 'superadmin_equipo lista superadmins') from public.superadmin_equipo();
select pg_temp.debe_fallar($q$select public.superadmin_agregar('nadie@prueba.co')$q$, 'usuario_no_encontrado', 'no agrega correos sin cuenta');
select public.superadmin_agregar(' Otro-Super@prueba.co ');
select pg_temp.igual(count(*), 2::bigint, 'agrega un superadmin por correo') from public.superadmin_equipo();
select pg_temp.debe_fallar($q$select public.superadmin_agregar('otro-super@prueba.co')$q$, 'ya_es_superadmin', 'no lo agrega dos veces');
select pg_temp.debe_fallar($q$select public.superadmin_quitar('d0000000-0000-0000-0000-000000000001')$q$, 'no_puedes_quitarte', 'no se quita a sí mismo');
select public.superadmin_quitar('d0000000-0000-0000-0000-000000000003');
select pg_temp.igual(count(*), 1::bigint, 'quita a otro superadmin') from public.superadmin_equipo();

-- 5. Un dueño no usa nada de esto
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.debe_fallar($q$select * from public.superadmin_negocios(30)$q$, 'sin_permiso', 'dueño no lista negocios');
select pg_temp.debe_fallar($q$select public.superadmin_tablero(30)$q$, 'sin_permiso', 'dueño no ve el tablero');
select pg_temp.debe_fallar($q$select * from public.superadmin_equipo()$q$, 'sin_permiso', 'dueño no ve superadmins');
select pg_temp.debe_fallar($q$select public.superadmin_agregar('dueno@prueba.co')$q$, 'sin_permiso', 'dueño no se hace superadmin');
select pg_temp.debe_fallar(
  format($q$select public.superadmin_eliminar_negocio(%L, 'heladeria-panel')$q$, current_setting('prueba.negocio')),
  'sin_permiso', 'dueño no elimina su negocio');
set local role anon;
select pg_temp.debe_fallar($q$select public.superadmin_tablero(30)$q$, 'permission denied', 'anon no llama el tablero');
set local role authenticated;

-- 6. Eliminar un negocio con todos sus datos
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.debe_fallar(
  format($q$select public.superadmin_eliminar_negocio(%L, 'otro-slug')$q$, current_setting('prueba.negocio')),
  'confirmacion_incorrecta', 'exige escribir el subdominio');
select public.superadmin_eliminar_negocio(current_setting('prueba.negocio')::uuid, ' Heladeria-Panel ');
reset role;
select pg_temp.igual(count(*), 0::bigint, 'el negocio ya no existe') from public.negocios where slug = 'heladeria-panel';
select pg_temp.igual(count(*), 0::bigint, 'se borran sus clientes') from public.clientes where negocio_id = current_setting('prueba.negocio')::uuid;
select pg_temp.igual(count(*), 0::bigint, 'se borran sus tarjetas') from public.tarjetas where negocio_id = current_setting('prueba.negocio')::uuid;
select pg_temp.igual(count(*), 0::bigint, 'se borra su equipo') from public.miembros_negocio where negocio_id = current_setting('prueba.negocio')::uuid;
select pg_temp.igual(count(*), 1::bigint, 'el otro negocio sigue') from public.negocios where slug = 'negocio-vacio';
set local role authenticated;
select pg_temp.debe_fallar(
  format($q$select public.superadmin_eliminar_negocio(%L, 'heladeria-panel')$q$, current_setting('prueba.negocio')),
  'negocio_no_encontrado', 'eliminar dos veces da negocio_no_encontrado');

rollback;
\echo 'Todas las aserciones del panel del superadmin pasaron.'
