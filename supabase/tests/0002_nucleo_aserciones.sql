-- Aserciones de la migración 0001: las mismas reglas que 0001_nucleo.sql, pero
-- cada comprobación falla (ERROR) si el resultado no es el esperado, para que CI
-- se ponga en rojo. Se corre dentro de una transacción con rollback.
--   ./scripts/probar-sql.sh
-- Crea datos de prueba: NO correr en producción.

\set ON_ERROR_STOP 1
begin;

-- Espera que la sentencia falle con un mensaje que contenga p_esperado.
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

-- Semilla: dos negocios, un cajero y un administrador en A, un usuario sin negocio
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a', 'cajero@prueba.co'),
 ('00000000-0000-0000-0000-00000000000b', 'otro@prueba.co'),
 ('00000000-0000-0000-0000-00000000000c', 'admin@prueba.co');
insert into public.negocios (id, slug, nombre) values
 ('10000000-0000-0000-0000-000000000001', 'angelato', 'Angelato'),
 ('20000000-0000-0000-0000-000000000002', 'otro-cafe', 'Otro Café');
insert into public.miembros_negocio values
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'cajero'),
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'administrador');
insert into public.programas (id, negocio_id, sellos_requeridos, max_sellos_dia) values
 ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 10, 3),
 ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 5, 3);
insert into public.clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, version_politica) values
 ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '+573001112233', 'Laura', '1995-04-10', true, 'v1'),
 ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '+573001112233', 'Laura', '1995-04-10', true, 'v1');
insert into public.tarjetas (id, negocio_id, programa_id, cliente_id, token_publico) values
 ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'tokA'),
 ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'tokB');

-- El celular es único por negocio, no global
select pg_temp.debe_fallar(
  $q$insert into public.clientes (negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, version_politica)
     values ('10000000-0000-0000-0000-000000000001', '+573001112233', 'Copia', '1990-01-01', true, 'v1')$q$,
  'duplicate key', 'celular único por negocio');

-- 1. Sello normal
select pg_temp.igual((public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokA', 'venta-1') ->> 'sellos_sumados')::int, 1, 'sello normal suma 1');

-- 2. Idempotencia por venta_externa_id
select pg_temp.igual((public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokA', 'venta-1') ->> 'duplicado')::bool, true, 'misma venta es duplicado');
select pg_temp.igual(sellos_actuales::int, 1, 'misma venta no suma') from public.tarjetas where token_publico = 'tokA';

-- 3. Tope diario de 3
select pg_temp.igual((public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokA', 'venta-2') ->> 'sellos_actuales')::int, 2, 'venta 2 suma');
select pg_temp.igual((public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokA', 'venta-3') ->> 'sellos_actuales')::int, 3, 'venta 3 suma');
select pg_temp.igual(public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokA', 'venta-4') ->> 'motivo', 'sin_sellos_aplicables', 'venta 4 topada');
select pg_temp.igual(sellos_actuales::int, 3, 'tope diario respetado') from public.tarjetas where token_publico = 'tokA';

-- 4. Token de otro negocio
select pg_temp.debe_fallar(
  $q$select public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokB', 'x')$q$,
  'tarjeta_no_encontrada', 'token de otro negocio');

-- 5. Completar tarjeta → premio y la tarjeta vuelve a 0
update public.eventos_sello set creado_en = now() - interval '3 days';
update public.programas set max_sellos_dia = 20 where id = '30000000-0000-0000-0000-000000000001';
select public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokA', 'v' || g) from generate_series(5, 10) g;
select pg_temp.igual((public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokA', 'v11') ->> 'premio_emitido')::bool, true, 'sello 10 emite premio');
select pg_temp.igual(format('%s/%s/%s', sellos_actuales, sellos_historicos, premios_ganados), '0/10/1', 'contadores tras premio')
  from public.tarjetas where token_publico = 'tokA';
select pg_temp.igual(format('%s/%s', origen, estado), 'premio_sellos/emitido', 'cupón de premio emitido')
  from public.cupones where tarjeta_id = '50000000-0000-0000-0000-000000000001';
select pg_temp.igual(sum(cantidad)::int, 0, 'ledger cuadra con sellos_actuales')
  from public.eventos_sello where tarjeta_id = '50000000-0000-0000-0000-000000000001';

-- 6. Canje
select pg_temp.igual(public.canjear_cupon('10000000-0000-0000-0000-000000000001', (select codigo from public.cupones limit 1), 'venta-canje') ->> 'estado', 'canjeado', 'canje');
select pg_temp.igual((public.canjear_cupon('10000000-0000-0000-0000-000000000001', (select codigo from public.cupones limit 1), 'venta-canje') ->> 'duplicado')::bool, true, 'canje idempotente');
select pg_temp.debe_fallar(
  $q$select public.canjear_cupon('10000000-0000-0000-0000-000000000001', (select codigo from public.cupones limit 1), 'otra-venta')$q$,
  'cupon_ya_canjeado', 'doble canje con otra venta');
select pg_temp.debe_fallar(
  $q$select public.canjear_cupon('20000000-0000-0000-0000-000000000002', (select codigo from public.cupones limit 1), 'x')$q$,
  'cupon_no_encontrado', 'cupón de otro negocio');

-- 7. RLS: cajero de A solo ve A
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.igual(count(*), 1::bigint, 'cajero ve 1 negocio') from public.negocios;
select pg_temp.igual(count(*), 1::bigint, 'cajero ve 1 tarjeta') from public.tarjetas;
select pg_temp.igual(count(*), 1::bigint, 'cajero ve 1 cliente') from public.clientes;

-- 8. Cajero no escribe fuera de lo permitido
select pg_temp.debe_fallar(
  $q$insert into public.sedes (negocio_id, nombre) values ('10000000-0000-0000-0000-000000000001', 'X')$q$,
  'row-level security', 'cajero no crea sedes');
select pg_temp.debe_fallar(
  $q$insert into public.eventos_sello (negocio_id, tarjeta_id, cantidad, origen) values ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 5, 'panel')$q$,
  'permission denied', 'cajero no inserta sellos');
select pg_temp.debe_fallar(
  $q$select public.registrar_sello('10000000-0000-0000-0000-000000000001', 'tokA', 'hack')$q$,
  'permission denied', 'cajero no llama registrar_sello');
select pg_temp.debe_fallar(
  $q$select public.canjear_cupon('10000000-0000-0000-0000-000000000001', 'X', 'hack')$q$,
  'permission denied', 'cajero no llama canjear_cupon');
select pg_temp.debe_fallar(
  $q$update public.clientes set fecha_nacimiento = '2000-01-01'$q$,
  'permission denied', 'cajero no edita cumpleaños');
update public.clientes set celular_verificado = true;
select pg_temp.igual(count(*) filter (where celular_verificado), 1::bigint, 'cajero marca celular verificado') from public.clientes;

-- 9. Administrador no cambia el plan
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.debe_fallar(
  $q$update public.negocios set plan = 'empresa'$q$,
  'permission denied', 'administrador no cambia plan');

-- 10. Usuario sin negocio no ve nada
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.igual((select count(*) from public.negocios) + (select count(*) from public.clientes) + (select count(*) from public.cupones), 0::bigint, 'usuario sin negocio no ve nada');

-- 11. anon no ve nada
reset request.jwt.claim.sub;
set local role anon;
select pg_temp.igual((select count(*) from public.negocios) + (select count(*) from public.tarjetas), 0::bigint, 'anon no ve nada');

rollback;
\echo 'Todas las aserciones pasaron.'
