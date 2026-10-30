-- =====================================================================
-- Beely · 0010 notificaciones push de las campañas
-- Al emitir una campaña, cada tarjeta que recibe el cupón y tiene un
-- teléfono con notificaciones activas queda en la cola de envíos
-- (envios_campana, canal push). La Edge Function campanas-motor la vacía:
--   · push_tomar: aplica las reglas (regla 8) y entrega un lote listo.
--   · push_registrar: guarda el resultado y revoca las suscripciones vencidas.
-- La función se llama desde el panel al lanzar y desde pg_cron cada 5
-- minutos (programadas y envíos que esperaban la franja horaria).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cola de envíos
-- ---------------------------------------------------------------------
alter table public.envios_campana drop constraint envios_campana_estado_check;
alter table public.envios_campana add constraint envios_campana_estado_check
  check (estado in ('pendiente', 'enviando', 'enviado', 'fallido', 'omitido'));
alter table public.envios_campana add column tomado_en timestamptz;

-- Un envío por campaña, tarjeta y canal: emitir de nuevo no duplica.
create unique index envios_campana_unico on public.envios_campana (campana_id, tarjeta_id, canal);
create index envios_campana_pendientes_idx on public.envios_campana (creado_en)
  where estado in ('pendiente', 'enviando');

-- Emite los cupones de una campaña y encola su push. Idempotente por (campaña, tarjeta).
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

  insert into public.envios_campana (negocio_id, campana_id, tarjeta_id, canal)
  select k.negocio_id, k.campana_id, k.tarjeta_id, 'push'
    from public.cupones k
   where k.campana_id = p_campana_id
     and k.estado = 'emitido'
     and exists (select 1 from public.suscripciones_push s
                  where s.tarjeta_id = k.tarjeta_id and s.revocada_en is null)
  on conflict (campana_id, tarjeta_id, canal) do nothing;

  update public.campanas set lanzada_en = coalesce(lanzada_en, now()) where id = p_campana_id;
  return v_emitidos;
end;
$$;
revoke execute on function privado.emitir_campana(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Toma un lote de push listos para enviar (solo service_role).
-- Antes descarta lo que ya no debe salir:
--   campana_terminada · la campaña se canceló o venció
--   cupon_usado       · el cupón ya se canjeó o se anuló
--   sin_marketing     · el cliente dejó de aceptar promociones
--   sin_suscripcion   · ya no hay teléfonos con notificaciones activas
--   tope_semanal      · el cliente llegó a max_push_semana en 7 días
-- Lo que está fuera de la franja horaria del negocio espera al siguiente
-- turno. Un push por tarjeta en cada lote, para que el tope se cuente bien.
-- ---------------------------------------------------------------------
create or replace function public.push_tomar(p_negocio_id uuid default null, p_limite integer default 100)
returns table (
  envio_id       uuid,
  campana_id     uuid,
  titulo         text,
  mensaje        text,
  termina_en     timestamptz,
  negocio_nombre text,
  logo_url       text,
  token_publico  text,
  suscripciones  jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Un envío que quedó "enviando" más de 10 minutos (la función se cortó) vuelve a la cola.
  update public.envios_campana e
     set estado = 'pendiente', tomado_en = null
   where e.estado = 'enviando' and e.tomado_en < now() - interval '10 minutes'
     and (p_negocio_id is null or e.negocio_id = p_negocio_id);

  with motivos as (
    select e.id,
           case
             when c.estado <> 'activa' or c.cancelada_en is not null or c.termina_en <= now() then 'campana_terminada'
             when k.estado is distinct from 'emitido' then 'cupon_usado'
             when not cl.acepta_marketing then 'sin_marketing'
             when not exists (select 1 from public.suscripciones_push s
                               where s.tarjeta_id = e.tarjeta_id and s.revocada_en is null) then 'sin_suscripcion'
             when (select count(*) from public.envios_campana p
                    where p.tarjeta_id = e.tarjeta_id and p.canal = 'push'
                      and p.estado in ('enviado', 'enviando')
                      and coalesce(p.enviado_en, p.tomado_en) > now() - interval '7 days') >= n.max_push_semana
               then 'tope_semanal'
           end as motivo
      from public.envios_campana e
      join public.campanas c on c.id = e.campana_id
      join public.tarjetas t on t.id = e.tarjeta_id
      join public.clientes cl on cl.id = t.cliente_id
      join public.negocios n on n.id = e.negocio_id
      left join public.cupones k on k.campana_id = e.campana_id and k.tarjeta_id = e.tarjeta_id
     where e.estado = 'pendiente'
       and e.canal = 'push'
       and (p_negocio_id is null or e.negocio_id = p_negocio_id)
  )
  update public.envios_campana e
     set estado = 'omitido', error = m.motivo
    from motivos m
   where e.id = m.id and m.motivo is not null;

  return query
  with candidatos as (
    select e.id,
           row_number() over (partition by e.tarjeta_id order by e.creado_en) as turno
      from public.envios_campana e
      join public.negocios n on n.id = e.negocio_id
     where e.estado = 'pendiente'
       and e.canal = 'push'
       and (p_negocio_id is null or e.negocio_id = p_negocio_id)
       and n.estado = 'activo'
       and (now() at time zone n.zona_horaria)::time >= n.hora_inicio_envios
       and (now() at time zone n.zona_horaria)::time < n.hora_fin_envios
  ),
  tomados as (
    update public.envios_campana e
       set estado = 'enviando', tomado_en = now()
     where e.id in (select ca.id from candidatos ca where ca.turno = 1
                     order by ca.id limit greatest(1, least(coalesce(p_limite, 100), 500)))
       and e.estado = 'pendiente'
    returning e.id, e.campana_id, e.tarjeta_id, e.negocio_id
  )
  select tm.id, c.id, c.titulo, c.mensaje, c.termina_en, n.nombre, n.logo_url, t.token_publico,
         (select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
            from public.suscripciones_push s
           where s.tarjeta_id = tm.tarjeta_id and s.revocada_en is null)
    from tomados tm
    join public.campanas c on c.id = tm.campana_id
    join public.negocios n on n.id = tm.negocio_id
    join public.tarjetas t on t.id = tm.tarjeta_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Guarda el resultado de un lote (solo service_role).
-- p_resultados: [{ envio_id, enviado, error?, entregadas: [suscripcion_id], vencidas: [suscripcion_id] }]
-- Las vencidas (el navegador respondió 404/410) se revocan.
-- ---------------------------------------------------------------------
create or replace function public.push_registrar(p_resultados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.envios_campana e
     set estado = case when (r ->> 'enviado')::boolean then 'enviado'
                       when jsonb_array_length(coalesce(r -> 'vencidas', '[]')) > 0
                        and not exists (select 1 from public.suscripciones_push s
                                         where s.tarjeta_id = e.tarjeta_id and s.revocada_en is null
                                           and not (r -> 'vencidas') ? s.id::text) then 'omitido'
                       else 'fallido' end,
         error = case when (r ->> 'enviado')::boolean then null
                      when jsonb_array_length(coalesce(r -> 'vencidas', '[]')) > 0
                       and not exists (select 1 from public.suscripciones_push s
                                        where s.tarjeta_id = e.tarjeta_id and s.revocada_en is null
                                          and not (r -> 'vencidas') ? s.id::text) then 'sin_suscripcion'
                      else left(coalesce(r ->> 'error', 'error_envio'), 300) end,
         enviado_en = case when (r ->> 'enviado')::boolean then now() end
    from jsonb_array_elements(coalesce(p_resultados, '[]')) r
   where e.id = (r ->> 'envio_id')::uuid
     and e.estado = 'enviando';

  update public.suscripciones_push s
     set revocada_en = now()
    from jsonb_array_elements(coalesce(p_resultados, '[]')) r,
         jsonb_array_elements_text(coalesce(r -> 'vencidas', '[]')) v
   where s.id = v::uuid and s.revocada_en is null;

  update public.suscripciones_push s
     set ultimo_uso_en = now()
    from jsonb_array_elements(coalesce(p_resultados, '[]')) r,
         jsonb_array_elements_text(coalesce(r -> 'entregadas', '[]')) v
   where s.id = v::uuid;
end;
$$;

revoke execute on function public.push_tomar(uuid, integer) from public, anon, authenticated;
revoke execute on function public.push_registrar(jsonb) from public, anon, authenticated;
grant execute on function public.push_tomar(uuid, integer) to service_role;
grant execute on function public.push_registrar(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- Lista de campañas: suma los push enviados y los que siguen en cola.
-- ---------------------------------------------------------------------
drop function public.campanas_negocio(uuid);
create function public.campanas_negocio(p_negocio_id uuid)
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
  cupones_canjeados integer,
  push_enviados    integer,
  push_pendientes  integer
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
           coalesce(k.canjeados, 0)::integer,
           coalesce(p.enviados, 0)::integer,
           coalesce(p.pendientes, 0)::integer
      from public.campanas c
      left join public.ofertas o on o.id = c.oferta_id
      left join lateral (
        select count(*) as emitidos,
               count(*) filter (where cu.estado = 'canjeado') as canjeados
          from public.cupones cu
         where cu.campana_id = c.id
      ) k on true
      left join lateral (
        select count(*) filter (where en.estado = 'enviado') as enviados,
               count(*) filter (where en.estado in ('pendiente', 'enviando')) as pendientes
          from public.envios_campana en
         where en.campana_id = c.id and en.canal = 'push'
      ) p on true
     where c.negocio_id = p_negocio_id
     order by
       case when c.estado = 'borrador' then 0
            when c.estado = 'activa' then 1
            else 2 end,
       c.programada_para desc nulls last,
       c.creado_en desc;
end;
$$;
revoke execute on function public.campanas_negocio(uuid) from public, anon;
grant execute on function public.campanas_negocio(uuid) to authenticated;

-- Cuántas tarjetas de cada grupo reciben también el push (tienen notificaciones activas).
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
    'clientes', (select count(*) from public.clientes where negocio_id = p_negocio_id),
    'push', (select jsonb_object_agg(f, (
               select count(*) from privado.tarjetas_campana(p_negocio_id, f) s
                where exists (select 1 from public.suscripciones_push p
                               where p.tarjeta_id = s.tarjeta_id and p.revocada_en is null)))
               from unnest(array['todos', 'inactivos', 'cumple', 'nuevos']) f)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- pg_cron + pg_net: cada 5 minutos, si hay push en cola, llama a
-- campanas-motor. La URL y la clave viven en Vault:
--   select vault.create_secret('https://<proyecto>.supabase.co/functions/v1', 'beely_funciones_url');
--   select vault.create_secret('<clave larga al azar>', 'beely_motor_clave');
-- La misma clave va en el secreto CAMPANAS_MOTOR_CLAVE de la función.
-- ---------------------------------------------------------------------
create or replace function privado.disparar_motor_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url   text;
  v_clave text;
begin
  if not exists (select 1 from public.envios_campana where estado = 'pendiente' and canal = 'push') then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'beely_funciones_url';
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'beely_motor_clave';
  if v_url is null or v_clave is null then
    raise warning 'campanas-motor: faltan los secretos beely_funciones_url o beely_motor_clave en Vault';
    return;
  end if;
  perform net.http_post(
    url := v_url || '/campanas-motor',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-motor-clave', v_clave),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;
revoke execute on function privado.disparar_motor_push() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension if not exists pg_net;
    perform cron.schedule('beely-campanas-push', '*/5 * * * *', 'select privado.disparar_motor_push()');
  end if;
end;
$$;
