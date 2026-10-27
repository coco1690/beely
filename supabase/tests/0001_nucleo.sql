-- Pruebas de la migración 0001 (sellos, idempotencia, tope diario, premio, canje, RLS).
-- Correr sobre una base local con 'supabase start' + 'supabase db reset', como superusuario:
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/tests/0001_nucleo.sql
-- Crea datos de prueba: NO correr en producción.

begin;
\set ON_ERROR_STOP 1
-- Semilla: dos negocios, un cajero en A
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a','cajero@prueba.co'), ('00000000-0000-0000-0000-00000000000b','otro@prueba.co');
insert into negocios (id, slug, nombre) values
 ('10000000-0000-0000-0000-000000000001','angelato','Angelato'),
 ('20000000-0000-0000-0000-000000000002','otro-cafe','Otro Café');
insert into miembros_negocio values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','cajero');
insert into programas (id, negocio_id, sellos_requeridos, max_sellos_dia) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',10,3),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',5,3);
insert into clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, version_politica) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','+573001112233','Laura','1995-04-10',true,'v1'),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','+573001112233','Laura','1995-04-10',true,'v1');
insert into tarjetas (id, negocio_id, programa_id, cliente_id, token_publico) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','tokA'),
 ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','tokB');

\echo '--- 1. Sello normal'
select registrar_sello('10000000-0000-0000-0000-000000000001','tokA','venta-1');
\echo '--- 2. Misma venta (idempotencia: duplicado=true, no suma)'
select registrar_sello('10000000-0000-0000-0000-000000000001','tokA','venta-1');
\echo '--- 3. Tope diario 3: ventas 2,3 suman; venta 4 no suma'
select registrar_sello('10000000-0000-0000-0000-000000000001','tokA','venta-2')->>'sellos_actuales' as tras_v2;
select registrar_sello('10000000-0000-0000-0000-000000000001','tokA','venta-3')->>'sellos_actuales' as tras_v3;
select registrar_sello('10000000-0000-0000-0000-000000000001','tokA','venta-4')->>'motivo' as v4;
\echo '--- 4. Token de otro negocio rechazado'
do $$ begin perform registrar_sello('10000000-0000-0000-0000-000000000001','tokB','x'); raise notice 'FALLO: aceptó token ajeno';
exception when others then raise notice 'OK rechazado: %', sqlerrm; end $$;
\echo '--- 5. Completar tarjeta → premio (simulando sellos de días previos)'
update eventos_sello set creado_en = now() - interval '3 days';
update programas set max_sellos_dia = 20 where id='30000000-0000-0000-0000-000000000001';
select registrar_sello('10000000-0000-0000-0000-000000000001','tokA','venta-5', p_unidades=>1);
select registrar_sello('10000000-0000-0000-0000-000000000001','tokA','v'||g) ->> 'premio_emitido' from generate_series(6,11) g;
select sellos_actuales, sellos_historicos, premios_ganados from tarjetas where token_publico='tokA';
select origen, estado, descripcion from cupones;
\echo '--- 6. Canje y doble canje'
select canjear_cupon('10000000-0000-0000-0000-000000000001',(select codigo from cupones limit 1),'venta-canje');
select canjear_cupon('10000000-0000-0000-0000-000000000001',(select codigo from cupones limit 1),'venta-canje')->>'duplicado' as mismo_canje;
do $$ begin perform canjear_cupon('10000000-0000-0000-0000-000000000001',(select codigo from cupones limit 1),'otra-venta'); raise notice 'FALLO';
exception when others then raise notice 'OK rechazado: %', sqlerrm; end $$;

\echo '--- 7. RLS: cajero de A solo ve A'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) as negocios_visibles from negocios;
select count(*) as tarjetas_visibles from tarjetas;
\echo '--- 8. Cajero no puede crear sedes ni sumar sellos directo'
do $$ begin insert into sedes (negocio_id,nombre) values ('10000000-0000-0000-0000-000000000001','X'); raise notice 'FALLO';
exception when others then raise notice 'OK: %', sqlerrm; end $$;
do $$ begin insert into eventos_sello (negocio_id,tarjeta_id,cantidad,origen) values ('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',5,'panel'); raise notice 'FALLO';
exception when others then raise notice 'OK: %', sqlerrm; end $$;
do $$ begin perform registrar_sello('10000000-0000-0000-0000-000000000001','tokA','hack'); raise notice 'FALLO';
exception when others then raise notice 'OK: %', sqlerrm; end $$;
\echo '--- 9. Usuario B (sin negocio) no ve nada'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select (select count(*) from negocios) n, (select count(*) from clientes) c, (select count(*) from cupones) cu;
\echo '--- 10. anon no ve nada'
reset request.jwt.claim.sub; set role anon;
select (select count(*) from negocios) n, (select count(*) from tarjetas) t;

reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin update clientes set fecha_nacimiento='2000-01-01'; raise notice 'FALLO'; exception when others then raise notice 'OK cumple bloqueado: %', sqlerrm; end $$;
update clientes set celular_verificado = true;
do $$ begin update negocios set plan='empresa'; raise notice 'FALLO'; exception when others then raise notice 'OK plan bloqueado: %', sqlerrm; end $$;

rollback;
