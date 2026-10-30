-- =====================================================================
-- Beely · 0009 campañas de promociones
-- El dueño o el administrador arma una promoción (descuento, producto
-- gratis o 2x1), elige a quién va (todos, sin volver, cumpleañeros del
-- mes o nuevos) y sus fechas. Al lanzarla, cada cliente del grupo que
-- acepta promociones recibe un cupón en su tarjeta del club, que se canjea
-- en caja con canjear_cupon() como cualquier otro.
--   · campana_guardar: crea o edita el borrador (y su oferta).
--   · campana_lanzar: la emite ya o la deja programada para su fecha.
--   · campana_cancelar: anula los cupones sin canjear.
--   · campana_eliminar: borra un borrador.
--   · campanas_negocio / campanas_alcance: lista con resultados y a
--     cuántos clientes llega cada grupo.
--   · pg_cron emite las programadas cada 10 minutos.
-- Push y Wallet llegan después (Sprint 5); hoy el canal es el club.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Columnas nuevas y reglas
-- ---------------------------------------------------------------------
alter table public.campanas
  add column termina_en   timestamptz,
  add column lanzada_en   timestamptz,
  add column cancelada_en timestamptz;

-- El club pasa a ser un canal: el cupón aparece en la tarjeta del cliente.
alter table public.campanas drop constraint campanas_canales_check;
alter table public.campanas add constraint campanas_canales_check
  check (canales <@ array['push', 'wallet', 'club']::text[] and cardinality(canales) > 0);

alter table public.campanas add constraint campanas_vigencia_check
  check (termina_en is null or programada_para is null or termina_en > programada_para);

alter table public.campanas add constraint campanas_segmento_check
  check (segmento = '{}'::jsonb
         or segmento ->> 'filtro' in ('todos', 'inactivos', 'cumple', 'nuevos'));

-- Un cupón por tarjeta y campaña: lanzar dos veces no duplica.
create unique index cupones_campana_tarjeta_unica
  on public.cupones (campana_id, tarjeta_id) where campana_id is not null;

-- Para el job de programadas.
create index campanas_programadas_idx
  on public.campanas (programada_para) where estado = 'activa' and lanzada_en is null;

-- Las campañas se escriben solo con las funciones de abajo (el panel lee
-- con RLS). Así nadie la pasa a activa sin emitir ni borra una lanzada.
revoke insert, update, delete on public.campanas from authenticated;

-- ---------------------------------------------------------------------
-- Tarjetas que reciben una campaña. Solo clientes que aceptan promociones
-- (regla 8, opt-out en el club), con tarjeta activa del programa activo.
--   todos     · todos ellos
--   inactivos · registrados y sin volver hace más de 30 días
--   cumple    · cumplen años este mes (zona del negocio) y ya tienen un sello
--   nuevos    · registrados en los últimos 30 días
-- ---------------------------------------------------------------------
create or replace function privado.tarjetas_campana(p_negocio_id uuid, p_filtro text)
returns table (tarjeta_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
    from public.tarjetas t
    join public.programas p on p.id = t.programa_id and p.activo
    join public.clientes c on c.id = t.cliente_id
    join public.negocios n on n.id = t.negocio_id
   where t.negocio_id = p_negocio_id
     and t.estado = 'activa'
     and c.acepta_marketing
     and case p_filtro
           when 'todos' then true
           when 'inactivos' then c.creado_en < now() - interval '30 days'
                             and coalesce(t.ultima_visita_en, '-infinity') < now() - interval '30 days'
           when 'cumple' then extract(month from c.fecha_nacimiento)
                              = extract(month from now() at time zone n.zona_horaria)
                          and t.sellos_historicos >= 1
           when 'nuevos' then c.creado_en >= now() - interval '30 days'
           else false
         end;
$$;

-- Emite los cupones de una campaña. Idempotente por (campaña, tarjeta).
create or replace function privado.emitir_campana(p_campana_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emitidos integer;
begin
  insert into public.cupones (negocio_id, tarjeta_id, oferta_id, campana_id, origen, descripcion, vence_en)
  select c.negocio_id, s.tarjeta_id, c.oferta_id, c.id, 'campana', c.titulo, c.termina_en
    from public.campanas c
    cross join lateral privado.tarjetas_campana(c.negocio_id, c.segmento ->> 'filtro') s
   where c.id = p_campana_id
  on conflict (campana_id, tarjeta_id) where campana_id is not null do nothing;
  get diagnostics v_emitidos = row_count;

  update public.campanas set lanzada_en = now() where id = p_campana_id;
  return v_emitidos;
end;
$$;

-- La corre pg_cron: emite las campañas programadas cuya fecha llegó y
-- cierra las que vencieron sin lanzarse (negocio suspendido entre tanto).
create or replace function privado.lanzar_campanas_programadas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campana record;
  v_lanzadas integer := 0;
begin
  for v_campana in
    select c.id, c.termina_en, n.estado as estado_negocio
      from public.campanas c
      join public.negocios n on n.id = c.negocio_id
     where c.estado = 'activa'
       and c.lanzada_en is null
       and c.programada_para <= now()
     for update of c skip locked
  loop
    if v_campana.termina_en <= now() then
      update public.campanas set estado = 'finalizada' where id = v_campana.id;
    elsif v_campana.estado_negocio = 'activo' then
      perform privado.emitir_campana(v_campana.id);
      v_lanzadas := v_lanzadas + 1;
    end if;
  end loop;
  return v_lanzadas;
end;
$$;

revoke execute on function privado.tarjetas_campana(uuid, text) from public, anon, authenticated;
revoke execute on function privado.emitir_campana(uuid) from public, anon, authenticated;
revoke execute on function privado.lanzar_campanas_programadas() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Crea o edita un borrador. Las fechas son días en la zona del negocio:
-- empieza a las 00:00 de p_inicia y los cupones vencen al terminar p_termina.
-- p_tipo: porcentaje | monto_fijo | producto_gratis | dos_por_uno
-- ---------------------------------------------------------------------
create or replace function public.campana_guardar(
  p_negocio_id uuid,
  p_tipo       text,
  p_titulo     text,
  p_filtro     text,
  p_inicia     date,
  p_termina    date,
  p_valor      numeric default null,
  p_producto   text    default null,
  p_mensaje    text    default null,
  p_campana_id uuid    default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zona     text;
  v_hoy      date;
  v_titulo   text := btrim(coalesce(p_titulo, ''));
  v_producto text := nullif(btrim(coalesce(p_producto, '')), '');
  v_mensaje  text := btrim(coalesce(p_mensaje, ''));
  v_campana  public.campanas%rowtype;
  v_oferta   uuid;
  v_id       uuid;
begin
  if not privado.tiene_rol(p_negocio_id, array['dueno', 'administrador']) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  select zona_horaria into v_zona from public.negocios where id = p_negocio_id;
  v_hoy := (now() at time zone v_zona)::date;

  if p_tipo is null or p_tipo not in ('porcentaje', 'monto_fijo', 'producto_gratis', 'dos_por_uno')
     or p_filtro is null or p_filtro not in ('todos', 'inactivos', 'cumple', 'nuevos')
     or length(v_titulo) not between 3 and 60
     or length(v_mensaje) > 180
     or length(v_producto) > 80
     or (p_tipo in ('porcentaje', 'monto_fijo') and (p_valor is null or p_valor <= 0))
     or (p_tipo = 'porcentaje' and p_valor > 100)
     or (p_tipo in ('producto_gratis', 'dos_por_uno') and v_producto is null) then
    raise exception 'solicitud_invalida' using errcode = '22023';
  end if;
  if p_inicia is null or p_termina is null or p_inicia < v_hoy
     or p_termina < p_inicia or p_termina - p_inicia >= 365 then
    raise exception 'fechas_invalidas' using errcode = '22023';
  end if;

  if p_campana_id is not null then
    select * into v_campana from public.campanas
     where id = p_campana_id and negocio_id = p_negocio_id
     for update;
    if not found then
      raise exception 'campana_no_encontrada' using errcode = 'P0002';
    end if;
    if v_campana.estado <> 'borrador' then
      raise exception 'campana_no_editable' using errcode = '22023';
    end if;
    v_oferta := v_campana.oferta_id;
  end if;

  if v_oferta is null then
    insert into public.ofertas (negocio_id, nombre, tipo, valor, descripcion, vigencia_dias)
    values (p_negocio_id, v_titulo, p_tipo,
            case when p_tipo in ('porcentaje', 'monto_fijo') then p_valor end,
            v_producto, p_termina - p_inicia + 1)
    returning id into v_oferta;
  else
    update public.ofertas
       set nombre = v_titulo, tipo = p_tipo,
           valor = case when p_tipo in ('porcentaje', 'monto_fijo') then p_valor end,
           descripcion = v_producto, vigencia_dias = p_termina - p_inicia + 1
     where id = v_oferta;
  end if;

  if p_campana_id is null then
    insert into public.campanas (negocio_id, nombre, disparador, segmento, oferta_id, titulo, mensaje,
                                 canales, programada_para, termina_en, creado_por)
    values (p_negocio_id, v_titulo,
            case when p_inicia > v_hoy then 'programada' else 'manual' end,
            jsonb_build_object('filtro', p_filtro), v_oferta, v_titulo, v_mensaje, array['club'],
            p_inicia::timestamp at time zone v_zona,
            (p_termina + 1)::timestamp at time zone v_zona,
            (select auth.uid()))
    returning id into v_id;
  else
    update public.campanas
       set nombre = v_titulo, titulo = v_titulo, mensaje = v_mensaje,
           disparador = case when p_inicia > v_hoy then 'programada' else 'manual' end,
           segmento = jsonb_build_object('filtro', p_filtro),
           programada_para = p_inicia::timestamp at time zone v_zona,
           termina_en = (p_termina + 1)::timestamp at time zone v_zona
     where id = p_campana_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Lanza un borrador: si su día ya llegó emite los cupones ahora; si no,
-- queda programada y la emite pg_cron.
-- → { programada, cupones, programada_para }
-- ---------------------------------------------------------------------
create or replace function public.campana_lanzar(p_campana_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campana public.campanas%rowtype;
  v_estado_negocio text;
  v_emitidos integer;
begin
  select * into v_campana from public.campanas where id = p_campana_id for update;
  if not found or not privado.tiene_rol(v_campana.negocio_id, array['dueno', 'administrador']) then
    raise exception 'campana_no_encontrada' using errcode = 'P0002';
  end if;
  if v_campana.estado <> 'borrador' then
    raise exception 'campana_no_editable' using errcode = '22023';
  end if;
  select estado into v_estado_negocio from public.negocios where id = v_campana.negocio_id;
  if v_estado_negocio <> 'activo' then
    raise exception 'negocio_inactivo' using errcode = '22023';
  end if;
  if v_campana.termina_en <= now() then
    raise exception 'campana_vencida' using errcode = '22023';
  end if;

  update public.campanas set estado = 'activa' where id = p_campana_id;

  if v_campana.programada_para > now() then
    return jsonb_build_object('programada', true, 'cupones', 0,
                              'programada_para', v_campana.programada_para);
  end if;
  v_emitidos := privado.emitir_campana(p_campana_id);
  return jsonb_build_object('programada', false, 'cupones', v_emitidos,
                            'programada_para', v_campana.programada_para);
end;
$$;

-- ---------------------------------------------------------------------
-- Cancela una campaña lanzada o programada: anula los cupones sin canjear
-- (los canjeados quedan). → { anulados }
-- ---------------------------------------------------------------------
create or replace function public.campana_cancelar(p_campana_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campana public.campanas%rowtype;
  v_anulados integer;
begin
  select * into v_campana from public.campanas where id = p_campana_id for update;
  if not found or not privado.tiene_rol(v_campana.negocio_id, array['dueno', 'administrador']) then
    raise exception 'campana_no_encontrada' using errcode = 'P0002';
  end if;
  if v_campana.estado <> 'activa' then
    raise exception 'campana_no_editable' using errcode = '22023';
  end if;

  update public.cupones set estado = 'anulado'
   where campana_id = p_campana_id and estado = 'emitido';
  get diagnostics v_anulados = row_count;

  update public.campanas set estado = 'finalizada', cancelada_en = now() where id = p_campana_id;
  return jsonb_build_object('anulados', v_anulados);
end;
$$;

-- Borra un borrador y su oferta. Una campaña lanzada no se borra: se cancela.
create or replace function public.campana_eliminar(p_campana_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campana public.campanas%rowtype;
begin
  select * into v_campana from public.campanas where id = p_campana_id for update;
  if not found or not privado.tiene_rol(v_campana.negocio_id, array['dueno', 'administrador']) then
    raise exception 'campana_no_encontrada' using errcode = 'P0002';
  end if;
  if v_campana.estado <> 'borrador' then
    raise exception 'campana_no_editable' using errcode = '22023';
  end if;
  delete from public.campanas where id = p_campana_id;
  delete from public.ofertas o
   where o.id = v_campana.oferta_id
     and not exists (select 1 from public.campanas c where c.oferta_id = o.id)
     and not exists (select 1 from public.cupones k where k.oferta_id = o.id);
end;
$$;

-- ---------------------------------------------------------------------
-- Campañas del negocio con sus resultados. `estado` es el que ve el panel:
-- borrador | programada | en_curso | terminada | cancelada. `inicia` y
-- `termina` son los días en la zona del negocio (para editar el borrador).
-- ---------------------------------------------------------------------
create or replace function public.campanas_negocio(p_negocio_id uuid)
returns table (
  id               uuid,
  titulo           text,
  mensaje          text,
  tipo             text,
  valor            numeric,
  producto         text,
  filtro           text,
  estado           text,
  inicia           date,
  termina          date,
  programada_para  timestamptz,
  termina_en       timestamptz,
  lanzada_en       timestamptz,
  cancelada_en     timestamptz,
  creado_en        timestamptz,
  cupones_emitidos integer,
  cupones_canjeados integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_zona text;
begin
  if not privado.tiene_rol(p_negocio_id, array['dueno', 'administrador']) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  select n.zona_horaria into v_zona from public.negocios n where n.id = p_negocio_id;

  return query
    select c.id, c.titulo, c.mensaje, o.tipo, o.valor, o.descripcion,
           coalesce(c.segmento ->> 'filtro', 'todos'),
           case
             when c.estado = 'borrador' then 'borrador'
             when c.cancelada_en is not null then 'cancelada'
             when c.estado = 'finalizada' or c.termina_en <= now() then 'terminada'
             when c.lanzada_en is null then 'programada'
             else 'en_curso'
           end,
           (c.programada_para at time zone v_zona)::date,
           ((c.termina_en at time zone v_zona) - interval '1 day')::date,
           c.programada_para, c.termina_en, c.lanzada_en, c.cancelada_en, c.creado_en,
           coalesce(k.emitidos, 0)::integer,
           coalesce(k.canjeados, 0)::integer
      from public.campanas c
      left join public.ofertas o on o.id = c.oferta_id
      left join lateral (
        select count(*) as emitidos,
               count(*) filter (where cu.estado = 'canjeado') as canjeados
          from public.cupones cu
         where cu.campana_id = c.id
      ) k on true
     where c.negocio_id = p_negocio_id
     order by
       case when c.estado = 'borrador' then 0
            when c.estado = 'activa' then 1
            else 2 end,
       c.programada_para desc nulls last,
       c.creado_en desc;
end;
$$;

-- A cuántos clientes llega cada grupo hoy, y cuántos tienen tarjeta en total
-- (la diferencia son los que no aceptan promociones o tienen la tarjeta bloqueada).
create or replace function public.campanas_alcance(p_negocio_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.tiene_rol(p_negocio_id, array['dueno', 'administrador']) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'todos', (select count(*) from privado.tarjetas_campana(p_negocio_id, 'todos')),
    'inactivos', (select count(*) from privado.tarjetas_campana(p_negocio_id, 'inactivos')),
    'cumple', (select count(*) from privado.tarjetas_campana(p_negocio_id, 'cumple')),
    'nuevos', (select count(*) from privado.tarjetas_campana(p_negocio_id, 'nuevos')),
    'clientes', (select count(*) from public.clientes where negocio_id = p_negocio_id)
  );
end;
$$;

revoke execute on function public.campana_guardar(uuid, text, text, text, date, date, numeric, text, text, uuid) from public, anon;
revoke execute on function public.campana_lanzar(uuid) from public, anon;
revoke execute on function public.campana_cancelar(uuid) from public, anon;
revoke execute on function public.campana_eliminar(uuid) from public, anon;
revoke execute on function public.campanas_negocio(uuid) from public, anon;
revoke execute on function public.campanas_alcance(uuid) from public, anon;
grant execute on function public.campana_guardar(uuid, text, text, text, date, date, numeric, text, text, uuid) to authenticated;
grant execute on function public.campana_lanzar(uuid) to authenticated;
grant execute on function public.campana_cancelar(uuid) to authenticated;
grant execute on function public.campana_eliminar(uuid) to authenticated;
grant execute on function public.campanas_negocio(uuid) to authenticated;
grant execute on function public.campanas_alcance(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Club: el cliente ve el título y el mensaje de las campañas de las que
-- tiene un cupón, nada más (ni el segmento ni quién la creó).
-- ---------------------------------------------------------------------
revoke select on public.campanas from anon;
grant select (id, negocio_id, titulo, mensaje) on public.campanas to anon;
grant select (campana_id) on public.cupones to anon;

create policy club_campanas_ver on public.campanas
  for select to anon
  using (exists (
    select 1 from public.cupones k
     where k.campana_id = campanas.id
       and k.tarjeta_id = (select privado.tarjeta_club())
  ));

-- ---------------------------------------------------------------------
-- pg_cron: emite las programadas cada 10 minutos. Supabase trae pg_cron;
-- en un Postgres sin la extensión la migración sigue sin el job.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('beely-campanas-programadas', '*/10 * * * *',
                          'select privado.lanzar_campanas_programadas()');
  end if;
end;
$$;
