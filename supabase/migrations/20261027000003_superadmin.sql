-- =====================================================================
-- Beely · 0003 superadmin
-- Renombra el rol "admin de plataforma" a "superadmin" con los mismos
-- permisos (crea negocios y sedes, cambia plan y estado, asigna dueños).
--
-- Se renombra en sitio (alter ... rename) para no perder filas: los
-- superadmins existentes conservan su acceso. Las políticas guardan la
-- función por OID, así que siguen funcionando tras el rename; las
-- funciones que la llaman por nombre en su cuerpo se recrean aquí.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla y su política
-- ---------------------------------------------------------------------
alter table public.administradores_plataforma rename to superadmins;
alter table public.superadmins rename constraint administradores_plataforma_pkey to superadmins_pkey;
alter table public.superadmins rename constraint administradores_plataforma_usuario_id_fkey to superadmins_usuario_id_fkey;
alter policy admin_plataforma_ver on public.superadmins rename to superadmins_ver;
comment on table public.superadmins is 'Usuarios con control total de Beely (rol superadmin).';

-- ---------------------------------------------------------------------
-- Helper de RLS: privado.es_admin_plataforma() → privado.es_superadmin()
-- ---------------------------------------------------------------------
alter function privado.es_admin_plataforma() rename to es_superadmin;

create or replace function privado.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.superadmins
    where usuario_id = (select auth.uid())
  );
$$;

create or replace function privado.tiene_rol(p_negocio_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_negocio
    where negocio_id = p_negocio_id
      and usuario_id = (select auth.uid())
      and rol = any (p_roles)
  ) or privado.es_superadmin();
$$;

-- ---------------------------------------------------------------------
-- Políticas: se reescriben (mismas reglas) para que su texto nombre a
-- privado.es_superadmin() y no arrastre el alias viejo.
-- ---------------------------------------------------------------------
alter policy superadmins_ver on public.superadmins
  using ((select privado.es_superadmin()));

alter policy negocios_crear on public.negocios
  with check ((select privado.es_superadmin()));
alter policy negocios_borrar on public.negocios
  using ((select privado.es_superadmin()));

alter policy sedes_crear on public.sedes
  with check ((select privado.es_superadmin()));
alter policy sedes_borrar on public.sedes
  using ((select privado.es_superadmin()));

-- Equipo: el dueño gestiona administradores y cajeros; solo el superadmin
-- asigna o quita dueños.
alter policy miembros_crear on public.miembros_negocio
  with check ((select privado.es_superadmin())
         or (rol in ('administrador', 'cajero')
             and usuario_id <> (select auth.uid())
             and (select privado.tiene_rol(negocio_id, array['dueno']))));
alter policy miembros_editar on public.miembros_negocio
  using ((select privado.es_superadmin())
         or (rol in ('administrador', 'cajero')
             and usuario_id <> (select auth.uid())
             and (select privado.tiene_rol(negocio_id, array['dueno']))))
  with check ((select privado.es_superadmin())
         or (rol in ('administrador', 'cajero')
             and usuario_id <> (select auth.uid())
             and (select privado.tiene_rol(negocio_id, array['dueno']))));
alter policy miembros_borrar on public.miembros_negocio
  using ((select privado.es_superadmin())
         or (rol in ('administrador', 'cajero')
             and usuario_id <> (select auth.uid())
             and (select privado.tiene_rol(negocio_id, array['dueno']))));

-- ---------------------------------------------------------------------
-- RPC del panel
-- ---------------------------------------------------------------------
create or replace function public.crear_negocio(
  p_slug          text,
  p_nombre        text,
  p_zona_horaria  text default 'America/Bogota'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_id  uuid;
  v_programa_id uuid;
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if exists (select 1 from public.negocios where slug = lower(trim(p_slug))) then
    raise exception 'slug_en_uso' using errcode = '23505';
  end if;

  insert into public.negocios (slug, nombre, zona_horaria)
  values (lower(trim(p_slug)), trim(p_nombre), p_zona_horaria)
  returning id into v_negocio_id;

  insert into public.programas (negocio_id)
  values (v_negocio_id)
  returning id into v_programa_id;

  insert into public.disenos_tarjeta (programa_id, negocio_id)
  values (v_programa_id, v_negocio_id);

  return v_negocio_id;
end;
$$;

drop function public.plataforma_actualizar_negocio(uuid, text, text);

create or replace function public.superadmin_actualizar_negocio(
  p_negocio_id uuid,
  p_plan       text,
  p_estado     text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  update public.negocios
     set plan = p_plan, estado = p_estado
   where id = p_negocio_id;
  if not found then
    raise exception 'negocio_no_encontrado' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.superadmin_actualizar_negocio(uuid, text, text) from public, anon;
grant execute on function public.superadmin_actualizar_negocio(uuid, text, text) to authenticated;
