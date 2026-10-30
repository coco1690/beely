-- =====================================================================
-- Beely · 0008 clientes
-- Pantallas de clientes del panel:
--   · clientes_negocio / clientes_resumen: la lista de clientes de un
--     negocio con su tarjeta, para el dueño y el administrador. El cajero
--     no la ve (en caja solo busca una tarjeta por QR o celular).
--   · superadmin_clientes: los clientes de todos los negocios, con su
--     negocio, para soporte de la plataforma (datos completos por decisión
--     de producto, 2026-10-30).
-- Sin tablas nuevas: solo funciones de lectura y un índice para ordenar
-- por fecha de registro.
-- =====================================================================

create index clientes_negocio_creado_idx on public.clientes (negocio_id, creado_en desc);

-- ---------------------------------------------------------------------
-- Clientes de un negocio con su tarjeta. security invoker: además del
-- chequeo de rol aplica la RLS de clientes, tarjetas, programas y cupones.
--   p_filtro: todos | premio (cupón vigente) | cumple (cumple este mes en la
--             zona del negocio) | inactivos (más de 30 días sin volver)
--   p_orden:  reciente | visita | sellos | nombre
-- `total` repite en cada fila cuántos clientes cumplen la búsqueda y el filtro.
-- ---------------------------------------------------------------------
create or replace function public.clientes_negocio(
  p_negocio_id uuid,
  p_busqueda   text    default null,
  p_filtro     text    default 'todos',
  p_orden      text    default 'reciente',
  p_limite     integer default 50,
  p_desde      integer default 0
)
returns table (
  id                 uuid,
  nombre             text,
  celular            text,
  fecha_nacimiento   date,
  acepta_marketing   boolean,
  celular_verificado boolean,
  aceptado_en        timestamptz,
  version_politica   text,
  creado_en          timestamptz,
  tarjeta_id         uuid,
  estado_tarjeta     text,
  sellos_actuales    integer,
  sellos_requeridos  integer,
  sellos_historicos  integer,
  premios_ganados    integer,
  cupones_vigentes   integer,
  ultima_visita_en   timestamptz,
  total              integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_texto   text := nullif(lower(btrim(coalesce(p_busqueda, ''))), '');
  v_digitos text := nullif(regexp_replace(coalesce(p_busqueda, ''), '\D', '', 'g'), '');
  v_mes     integer;
begin
  if not privado.tiene_rol(p_negocio_id, array['dueno', 'administrador']) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if p_filtro is null or p_filtro not in ('todos', 'premio', 'cumple', 'inactivos')
     or p_orden is null or p_orden not in ('reciente', 'visita', 'sellos', 'nombre')
     or p_limite is null or p_limite not between 1 and 200
     or p_desde is null or p_desde < 0 then
    raise exception 'solicitud_invalida' using errcode = '22023';
  end if;
  -- Dígitos sueltos (un "3" en un nombre) no buscan por celular.
  if length(v_digitos) < 3 then
    v_digitos := null;
  end if;
  select extract(month from now() at time zone n.zona_horaria)::integer
    into v_mes
    from public.negocios n
   where n.id = p_negocio_id;

  return query
    with base as (
      select c.id, c.nombre, c.celular, c.fecha_nacimiento, c.acepta_marketing,
             c.celular_verificado, c.aceptado_en, c.version_politica, c.creado_en,
             principal.id as tarjeta_id, principal.estado as estado_tarjeta,
             coalesce(principal.sellos_actuales, 0)::integer as sellos_actuales,
             coalesce(principal.sellos_requeridos, 0)::integer as sellos_requeridos,
             coalesce(suma.historicos, 0)::integer as sellos_historicos,
             coalesce(suma.premios, 0)::integer as premios_ganados,
             coalesce(suma.cupones, 0)::integer as cupones_vigentes,
             suma.visita as ultima_visita_en
        from public.clientes c
        -- La tarjeta del programa activo (hoy cada negocio tiene uno).
        left join lateral (
          select t.id, t.estado, t.sellos_actuales, p.sellos_requeridos
            from public.tarjetas t
            join public.programas p on p.id = t.programa_id
           where t.cliente_id = c.id
           order by p.activo desc, t.creado_en
           limit 1
        ) principal on true
        left join lateral (
          select sum(t.sellos_historicos) as historicos,
                 sum(t.premios_ganados) as premios,
                 max(t.ultima_visita_en) as visita,
                 (select count(*)
                    from public.cupones k
                    join public.tarjetas t2 on t2.id = k.tarjeta_id
                   where t2.cliente_id = c.id
                     and k.estado = 'emitido'
                     and k.vence_en > now()) as cupones
            from public.tarjetas t
           where t.cliente_id = c.id
        ) suma on true
       where c.negocio_id = p_negocio_id
         and (v_texto is null
              or position(v_texto in lower(c.nombre)) > 0
              or (v_digitos is not null and position(v_digitos in c.celular) > 0))
    ),
    filtrados as (
      select b.*
        from base b
       where case p_filtro
               when 'premio' then b.cupones_vigentes > 0
               when 'cumple' then extract(month from b.fecha_nacimiento) = v_mes
               when 'inactivos' then b.creado_en < now() - interval '30 days'
                                 and coalesce(b.ultima_visita_en, '-infinity') < now() - interval '30 days'
               else true
             end
    )
    select f.id, f.nombre, f.celular, f.fecha_nacimiento, f.acepta_marketing,
           f.celular_verificado, f.aceptado_en, f.version_politica, f.creado_en,
           f.tarjeta_id, f.estado_tarjeta, f.sellos_actuales, f.sellos_requeridos,
           f.sellos_historicos, f.premios_ganados, f.cupones_vigentes, f.ultima_visita_en,
           (count(*) over ())::integer
      from filtrados f
     order by
       case when p_orden = 'nombre' then lower(f.nombre) end asc,
       case when p_orden = 'visita' then f.ultima_visita_en end desc nulls last,
       case when p_orden = 'sellos' then f.sellos_historicos end desc,
       f.creado_en desc,
       f.id
     limit p_limite offset p_desde;
end;
$$;

-- Cuántos clientes caen en cada filtro de la lista (los chips con su cifra).
create or replace function public.clientes_resumen(p_negocio_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if not privado.tiene_rol(p_negocio_id, array['dueno', 'administrador']) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'total', count(c.id),
           'nuevos_30', count(c.id) filter (where c.creado_en >= now() - interval '30 days'),
           'marketing', count(c.id) filter (where c.acepta_marketing),
           'premio', count(c.id) filter (where exists (
              select 1
                from public.cupones k
                join public.tarjetas t on t.id = k.tarjeta_id
               where t.cliente_id = c.id and k.estado = 'emitido' and k.vence_en > now())),
           'cumple', count(c.id) filter (
              where extract(month from c.fecha_nacimiento)
                  = extract(month from now() at time zone n.zona_horaria)),
           'inactivos', count(c.id) filter (
              where c.creado_en < now() - interval '30 days'
                and coalesce((select max(t.ultima_visita_en)
                                from public.tarjetas t
                               where t.cliente_id = c.id), '-infinity') < now() - interval '30 days')
         )
    into v_resultado
    from public.negocios n
    left join public.clientes c on c.negocio_id = n.id
   where n.id = p_negocio_id;

  return v_resultado;
end;
$$;

-- ---------------------------------------------------------------------
-- Clientes de toda la plataforma, para el superadmin. Busca por nombre o
-- por celular (3 dígitos o más) y filtra por negocio.
-- ---------------------------------------------------------------------
create or replace function public.superadmin_clientes(
  p_negocio_id uuid    default null,
  p_busqueda   text    default null,
  p_limite     integer default 50,
  p_desde      integer default 0
)
returns table (
  id                uuid,
  nombre            text,
  celular           text,
  fecha_nacimiento  date,
  acepta_marketing  boolean,
  creado_en         timestamptz,
  negocio_id        uuid,
  negocio_nombre    text,
  negocio_slug      text,
  negocio_logo_url  text,
  negocio_estado    text,
  sellos_historicos integer,
  premios_ganados   integer,
  ultima_visita_en  timestamptz,
  total             integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_texto   text := nullif(lower(btrim(coalesce(p_busqueda, ''))), '');
  v_digitos text := nullif(regexp_replace(coalesce(p_busqueda, ''), '\D', '', 'g'), '');
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 200
     or p_desde is null or p_desde < 0 then
    raise exception 'solicitud_invalida' using errcode = '22023';
  end if;
  -- Dígitos sueltos (un "3" en un nombre) no buscan por celular.
  if length(v_digitos) < 3 then
    v_digitos := null;
  end if;

  return query
    select c.id, c.nombre, c.celular, c.fecha_nacimiento, c.acepta_marketing, c.creado_en,
           n.id, n.nombre, n.slug, n.logo_url, n.estado,
           coalesce(suma.historicos, 0)::integer,
           coalesce(suma.premios, 0)::integer,
           suma.visita,
           (count(*) over ())::integer
      from public.clientes c
      join public.negocios n on n.id = c.negocio_id
      left join lateral (
        select sum(t.sellos_historicos) as historicos,
               sum(t.premios_ganados) as premios,
               max(t.ultima_visita_en) as visita
          from public.tarjetas t
         where t.cliente_id = c.id
      ) suma on true
     where (p_negocio_id is null or c.negocio_id = p_negocio_id)
       and (v_texto is null
            or position(v_texto in lower(c.nombre)) > 0
            or (v_digitos is not null and position(v_digitos in c.celular) > 0))
     order by c.creado_en desc, c.id
     limit p_limite offset p_desde;
end;
$$;

revoke execute on function public.clientes_negocio(uuid, text, text, text, integer, integer) from public, anon;
revoke execute on function public.clientes_resumen(uuid) from public, anon;
revoke execute on function public.superadmin_clientes(uuid, text, integer, integer) from public, anon;
grant execute on function public.clientes_negocio(uuid, text, text, text, integer, integer) to authenticated;
grant execute on function public.clientes_resumen(uuid) to authenticated;
grant execute on function public.superadmin_clientes(uuid, text, integer, integer) to authenticated;
