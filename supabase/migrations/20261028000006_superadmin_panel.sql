-- =====================================================================
-- Beely · 0006 panel del superadmin
-- Lo que el superadmin necesita para administrar la plataforma desde el
-- panel: tablero con cifras globales, lista de negocios con métricas,
-- eliminar un negocio y gestionar a los demás superadmins.
--
-- Todo son RPC security definer que empiezan por exigir
-- privado.es_superadmin(); el panel no lee auth.users ni suma tablas de
-- todos los negocios por su cuenta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Negocios con sus métricas, para la lista y la ficha del superadmin.
-- p_dias define la ventana de "recientes" (sellos, canjes y clientes nuevos).
-- ---------------------------------------------------------------------
create or replace function public.superadmin_negocios(p_dias integer default 30)
returns table (
  id                 uuid,
  slug               text,
  nombre             text,
  plan               text,
  estado             text,
  logo_url           text,
  zona_horaria       text,
  creado_en          timestamptz,
  sedes              integer,
  miembros           integer,
  dueno_email        text,
  clientes           integer,
  clientes_nuevos    integer,
  sellos_periodo     integer,
  canjes_periodo     integer,
  ultimo_sello_en    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz;
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if p_dias is null or p_dias not between 1 and 365 then
    raise exception 'solicitud_invalida' using errcode = '22023';
  end if;
  v_desde := now() - make_interval(days => p_dias);

  return query
    select n.id, n.slug, n.nombre, n.plan, n.estado, n.logo_url, n.zona_horaria, n.creado_en,
           (select count(*)::integer from public.sedes s where s.negocio_id = n.id),
           (select count(*)::integer from public.miembros_negocio m where m.negocio_id = n.id),
           (select u.email::text
              from public.miembros_negocio m
              join auth.users u on u.id = m.usuario_id
             where m.negocio_id = n.id and m.rol = 'dueno'
             order by m.creado_en
             limit 1),
           (select count(*)::integer from public.clientes c where c.negocio_id = n.id),
           (select count(*)::integer from public.clientes c where c.negocio_id = n.id and c.creado_en >= v_desde),
           (select coalesce(sum(e.cantidad), 0)::integer
              from public.eventos_sello e
             where e.negocio_id = n.id and e.cantidad > 0 and e.origen in ('api_pos', 'panel')
               and e.creado_en >= v_desde),
           (select count(*)::integer
              from public.cupones k
             where k.negocio_id = n.id and k.estado = 'canjeado' and k.canjeado_en >= v_desde),
           (select max(e.creado_en)
              from public.eventos_sello e
             where e.negocio_id = n.id and e.cantidad > 0 and e.origen in ('api_pos', 'panel'))
      from public.negocios n
     order by n.nombre;
end;
$$;
revoke execute on function public.superadmin_negocios(integer) from public, anon;
grant execute on function public.superadmin_negocios(integer) to authenticated;

-- ---------------------------------------------------------------------
-- Tablero: totales de la plataforma y serie diaria de los últimos p_dias.
-- Los días se cortan en hora de Colombia, donde están hoy los negocios.
-- ---------------------------------------------------------------------
create or replace function public.superadmin_tablero(p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde_dia date;
  v_desde     timestamptz;
  v_resultado jsonb;
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if p_dias is null or p_dias not between 1 and 365 then
    raise exception 'solicitud_invalida' using errcode = '22023';
  end if;
  v_desde_dia := (now() at time zone 'America/Bogota')::date - (p_dias - 1);
  v_desde     := v_desde_dia::timestamp at time zone 'America/Bogota';

  select jsonb_build_object(
    'dias', p_dias,
    'negocios', jsonb_build_object(
      'total',       (select count(*) from public.negocios),
      'activos',     (select count(*) from public.negocios where estado = 'activo'),
      'suspendidos', (select count(*) from public.negocios where estado = 'suspendido'),
      'cancelados',  (select count(*) from public.negocios where estado = 'cancelado'),
      'nuevos',      (select count(*) from public.negocios where creado_en >= v_desde),
      'por_plan',    (select coalesce(jsonb_object_agg(plan, total), '{}'::jsonb)
                        from (select plan, count(*) as total from public.negocios group by plan) p)
    ),
    'clientes', jsonb_build_object(
      'total',  (select count(*) from public.clientes),
      'nuevos', (select count(*) from public.clientes where creado_en >= v_desde)
    ),
    'sellos', jsonb_build_object(
      'periodo', (select coalesce(sum(cantidad), 0) from public.eventos_sello
                   where cantidad > 0 and origen in ('api_pos', 'panel') and creado_en >= v_desde)
    ),
    'cupones', jsonb_build_object(
      'emitidos_periodo',  (select count(*) from public.cupones where creado_en >= v_desde),
      'canjeados_periodo', (select count(*) from public.cupones where estado = 'canjeado' and canjeado_en >= v_desde)
    ),
    'equipo', jsonb_build_object(
      'miembros', (select count(distinct usuario_id) from public.miembros_negocio)
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'sellos', d.sellos, 'clientes', d.clientes) order by d.dia), '[]'::jsonb)
        from (
          select g.dia::date as dia,
                 coalesce((select sum(e.cantidad) from public.eventos_sello e
                            where e.cantidad > 0 and e.origen in ('api_pos', 'panel')
                              and (e.creado_en at time zone 'America/Bogota')::date = g.dia::date), 0) as sellos,
                 (select count(*) from public.clientes c
                   where (c.creado_en at time zone 'America/Bogota')::date = g.dia::date) as clientes
            from generate_series(v_desde_dia, v_desde_dia + (p_dias - 1), interval '1 day') as g(dia)
        ) d
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;
revoke execute on function public.superadmin_tablero(integer) from public, anon;
grant execute on function public.superadmin_tablero(integer) to authenticated;

-- ---------------------------------------------------------------------
-- Eliminar un negocio con todos sus datos (clientes, tarjetas, sellos,
-- cupones, equipo). No se puede deshacer: exige escribir el subdominio.
-- Las tarjetas se borran primero porque su FK a programas es restrict.
-- Los archivos del logo en Storage los borra el panel antes de llamar.
-- ---------------------------------------------------------------------
create or replace function public.superadmin_eliminar_negocio(
  p_negocio_id   uuid,
  p_confirmacion text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  select slug into v_slug from public.negocios where id = p_negocio_id for update;
  if v_slug is null then
    raise exception 'negocio_no_encontrado' using errcode = 'P0002';
  end if;
  if lower(trim(coalesce(p_confirmacion, ''))) <> v_slug then
    raise exception 'confirmacion_incorrecta' using errcode = '22023';
  end if;

  delete from public.tarjetas where negocio_id = p_negocio_id;
  delete from public.negocios where id = p_negocio_id;
end;
$$;
revoke execute on function public.superadmin_eliminar_negocio(uuid, text) from public, anon;
grant execute on function public.superadmin_eliminar_negocio(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Equipo de la plataforma: listar, agregar y quitar superadmins.
-- Solo se agrega a quien ya tiene cuenta en Beely.
-- ---------------------------------------------------------------------
create or replace function public.superadmin_equipo(p_busqueda text default null)
returns table (
  usuario_id        uuid,
  email             text,
  creado_en         timestamptz,
  ultimo_ingreso_en timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  return query
    select s.usuario_id, u.email::text, s.creado_en, u.last_sign_in_at
      from public.superadmins s
      join auth.users u on u.id = s.usuario_id
     where p_busqueda is null or u.email ilike '%' || p_busqueda || '%'
     order by u.email;
end;
$$;
revoke execute on function public.superadmin_equipo(text) from public, anon;
grant execute on function public.superadmin_equipo(text) to authenticated;

create or replace function public.superadmin_agregar(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  select id into v_usuario_id from auth.users where lower(email) = lower(trim(p_email));
  if v_usuario_id is null then
    raise exception 'usuario_no_encontrado' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.superadmins where usuario_id = v_usuario_id) then
    raise exception 'ya_es_superadmin' using errcode = '23505';
  end if;

  insert into public.superadmins (usuario_id) values (v_usuario_id);
  return v_usuario_id;
end;
$$;
revoke execute on function public.superadmin_agregar(text) from public, anon;
grant execute on function public.superadmin_agregar(text) to authenticated;

create or replace function public.superadmin_quitar(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  -- Nadie se quita a sí mismo: así siempre queda al menos un superadmin.
  if p_usuario_id = (select auth.uid()) then
    raise exception 'no_puedes_quitarte' using errcode = '22023';
  end if;

  delete from public.superadmins where usuario_id = p_usuario_id;
  if not found then
    raise exception 'usuario_no_encontrado' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.superadmin_quitar(uuid) from public, anon;
grant execute on function public.superadmin_quitar(uuid) to authenticated;
