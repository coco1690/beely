-- =====================================================================
-- Beely · 0004 logos
-- Logo propio de cada negocio (marca blanca) en Storage.
--
-- Bucket público `logos`: la PWA del club y el panel muestran el logo
-- sin sesión. Ruta: {negocio_id}/logo-{marca de tiempo}.{png|jpg|webp}.
-- Solo dueño, administrador o superadmin del negocio suben, cambian o
-- borran archivos en su carpeta. La URL pública queda en negocios.logo_url
-- (columna ya editable por esos roles desde 0001).
-- =====================================================================

-- Sin SVG: puede llevar scripts. 2 MB alcanza para un logo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Negocio dueño de un archivo según la primera carpeta de su ruta.
-- Devuelve null si no es un uuid (así la política niega en vez de fallar).
create or replace function privado.negocio_de_ruta(p_nombre text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_carpeta text := split_part(p_nombre, '/', 1);
begin
  if v_carpeta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_carpeta::uuid;
  end if;
  return null;
end;
$$;

revoke execute on function privado.negocio_de_ruta(text) from public, anon;
grant execute on function privado.negocio_de_ruta(text) to authenticated;

-- Lectura: el bucket es público, la URL pública no pasa por RLS. Esta
-- política solo deja listar al equipo que gestiona el logo (para limpiar
-- archivos viejos y para que upsert/remove encuentren el objeto).
create policy logos_ver on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and (select privado.tiene_rol(privado.negocio_de_ruta(name), array['dueno', 'administrador']))
  );

create policy logos_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (select privado.tiene_rol(privado.negocio_de_ruta(name), array['dueno', 'administrador']))
  );

create policy logos_cambiar on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (select privado.tiene_rol(privado.negocio_de_ruta(name), array['dueno', 'administrador']))
  )
  with check (
    bucket_id = 'logos'
    and (select privado.tiene_rol(privado.negocio_de_ruta(name), array['dueno', 'administrador']))
  );

create policy logos_borrar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (select privado.tiene_rol(privado.negocio_de_ruta(name), array['dueno', 'administrador']))
  );

-- El logo del negocio es la URL pública de Storage (http en local, https en la nube).
alter table public.negocios
  add constraint negocios_logo_url_https check (logo_url is null or logo_url ~ '^https?://');
