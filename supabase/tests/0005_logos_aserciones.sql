-- Aserciones de la migración 0004: logo propio de cada negocio en Storage.
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

-- Las versiones nuevas de Storage bloquean DELETE directo salvo con esta opción.
select set_config('storage.allow_delete_query', 'true', true);

-- 1. Esquema: bucket público con tipos y peso acotados
select pg_temp.igual(public, true, 'bucket logos es público') from storage.buckets where id = 'logos';
select pg_temp.igual(file_size_limit, 2097152::bigint, 'bucket logos limita a 2 MB') from storage.buckets where id = 'logos';
select pg_temp.igual('image/svg+xml' = any (allowed_mime_types), false, 'bucket logos no acepta SVG') from storage.buckets where id = 'logos';
select pg_temp.igual(privado.negocio_de_ruta('d1000000-0000-0000-0000-000000000001/logo-1.png'),
                     'd1000000-0000-0000-0000-000000000001'::uuid, 'negocio_de_ruta lee la carpeta');
select pg_temp.igual(privado.negocio_de_ruta('no-es-uuid/logo.png'), null::uuid, 'negocio_de_ruta niega carpetas que no son uuid');

-- 2. Datos: dos negocios, un dueño, un cajero y el dueño de otro negocio
insert into auth.users (id, email) values
 ('d0000000-0000-0000-0000-000000000001', 'dueno-logo@prueba.co'),
 ('d0000000-0000-0000-0000-000000000002', 'cajero-logo@prueba.co'),
 ('d0000000-0000-0000-0000-000000000003', 'otro-logo@prueba.co');
insert into public.negocios (id, slug, nombre) values
 ('d1000000-0000-0000-0000-000000000001', 'logo-uno', 'Logo Uno'),
 ('d1000000-0000-0000-0000-000000000002', 'logo-dos', 'Logo Dos');
insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'dueno'),
 ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'cajero'),
 ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'dueno');

-- 3. El dueño sube, ve y borra el logo de su negocio, y guarda la URL
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
insert into storage.objects (bucket_id, name) values ('logos', 'd1000000-0000-0000-0000-000000000001/logo-1.png');
select pg_temp.igual(count(*), 1::bigint, 'dueño ve el logo de su negocio')
  from storage.objects where bucket_id = 'logos' and name like 'd1000000-0000-0000-0000-000000000001/%';
update public.negocios set logo_url = 'https://ejemplo.supabase.co/storage/v1/object/public/logos/d1000000-0000-0000-0000-000000000001/logo-1.png'
 where id = 'd1000000-0000-0000-0000-000000000001';
select pg_temp.igual(logo_url like 'https://%', true, 'dueño guarda logo_url')
  from public.negocios where id = 'd1000000-0000-0000-0000-000000000001';
select pg_temp.debe_fallar(
  $q$update public.negocios set logo_url = 'javascript:alert(1)' where id = 'd1000000-0000-0000-0000-000000000001'$q$,
  'negocios_logo_url_https', 'logo_url debe ser una URL http(s)');
select pg_temp.debe_fallar(
  $q$insert into storage.objects (bucket_id, name) values ('logos', 'd1000000-0000-0000-0000-000000000002/logo-1.png')$q$,
  'row-level security', 'dueño no sube logos en la carpeta de otro negocio');
select pg_temp.debe_fallar(
  $q$insert into storage.objects (bucket_id, name) values ('logos', 'sin-carpeta.png')$q$,
  'row-level security', 'dueño no sube logos fuera de una carpeta de negocio');
delete from storage.objects where bucket_id = 'logos' and name = 'd1000000-0000-0000-0000-000000000001/logo-1.png';
select pg_temp.igual(count(*), 0::bigint, 'dueño borra el logo de su negocio')
  from storage.objects where bucket_id = 'logos' and name = 'd1000000-0000-0000-0000-000000000001/logo-1.png';
insert into storage.objects (bucket_id, name) values ('logos', 'd1000000-0000-0000-0000-000000000001/logo-2.png');

-- 4. El cajero no sube ni borra logos
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.debe_fallar(
  $q$insert into storage.objects (bucket_id, name) values ('logos', 'd1000000-0000-0000-0000-000000000001/logo-3.png')$q$,
  'row-level security', 'cajero no sube logos');
delete from storage.objects where bucket_id = 'logos' and name = 'd1000000-0000-0000-0000-000000000001/logo-2.png';
reset role;
select pg_temp.igual(count(*), 1::bigint, 'cajero no borra logos')
  from storage.objects where bucket_id = 'logos' and name = 'd1000000-0000-0000-0000-000000000001/logo-2.png';

-- 5. El dueño de otro negocio no ve ni borra el logo ajeno
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';
select pg_temp.igual(count(*), 0::bigint, 'otro dueño no lista logos ajenos')
  from storage.objects where bucket_id = 'logos' and name like 'd1000000-0000-0000-0000-000000000001/%';
delete from storage.objects where bucket_id = 'logos' and name = 'd1000000-0000-0000-0000-000000000001/logo-2.png';
reset role;
select pg_temp.igual(count(*), 1::bigint, 'otro dueño no borra logos ajenos')
  from storage.objects where bucket_id = 'logos' and name = 'd1000000-0000-0000-0000-000000000001/logo-2.png';

rollback;
\echo 'Todas las aserciones de logos pasaron.'
