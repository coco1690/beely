-- =====================================================================
-- Beely · 0005 club (Sprint 2, PWA del cliente en {slug}.hibeely.com)
--
-- El cliente final no es usuario de Auth: la PWA usa la anon key y manda
-- dos cabeceras que RLS lee de request.headers:
--   x-negocio-slug   el subdominio; deja ver la marca y el programa de ESE negocio.
--   x-tarjeta-token  el token opaco de la tarjeta; deja ver SOLO esa tarjeta,
--                    su cliente (nombre), sus cupones y sus sellos.
-- Sin cabeceras, anon no ve nada (igual que antes). No hay listados: para ver
-- un negocio hay que nombrar su slug y para ver una tarjeta hay que tener su token.
--
-- RLS decide filas; los grant por columna deciden qué columnas ve anon
-- (nunca celular, fecha de nacimiento, montos, cajero ni ids de venta).
--
-- El registro (club_registrar) solo lo llama la Edge Function club-registro
-- con service_role, con límite de intentos por IP y por celular.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de RLS para anon (esquema privado, no expuesto por la API)
-- ---------------------------------------------------------------------
create or replace function privado.cabecera(p_nombre text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.headers', true), '')::json ->> p_nombre;
$$;

-- Tarjeta del token de la cabecera (null si no hay o no existe).
create or replace function privado.tarjeta_club()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.tarjetas t
  where t.token_publico = privado.cabecera('x-tarjeta-token');
$$;

create or replace function privado.cliente_club()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.cliente_id from public.tarjetas t
  where t.token_publico = privado.cabecera('x-tarjeta-token');
$$;

-- Negocio activo que pide la PWA: el de la tarjeta si viene token; si no, el del slug.
create or replace function privado.negocio_club()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select n.id from public.negocios n
  where n.estado = 'activo'
    and n.id = coalesce(
      (select t.negocio_id from public.tarjetas t where t.token_publico = privado.cabecera('x-tarjeta-token')),
      (select n2.id from public.negocios n2 where n2.slug = privado.cabecera('x-negocio-slug'))
    );
$$;

revoke execute on function privado.cabecera(text), privado.tarjeta_club(), privado.cliente_club(), privado.negocio_club()
  from public, authenticated;
grant usage on schema privado to anon;
grant execute on function privado.cabecera(text), privado.tarjeta_club(), privado.cliente_club(), privado.negocio_club()
  to anon;

-- ---------------------------------------------------------------------
-- Columnas que ve anon. Se quita el select de tabla completa que Supabase
-- da por defecto y se otorga solo lo público de cada tabla.
-- ---------------------------------------------------------------------
revoke select on public.negocios, public.programas, public.disenos_tarjeta, public.sedes,
  public.tarjetas, public.clientes, public.cupones, public.eventos_sello, public.suscripciones_push
  from anon;
revoke update on public.clientes from anon;

grant select (id, slug, nombre, logo_url, color_primario, color_secundario, zona_horaria, version_politica_datos)
  on public.negocios to anon;
grant select (id, negocio_id, nombre, sellos_requeridos, regla_sello, monto_minimo, monto_por_sello,
              max_sellos_dia, premio_descripcion, premio_vigencia_dias, activo)
  on public.programas to anon;
grant select (programa_id, negocio_id, color_fondo, color_texto, color_etiquetas, logo_url, icono_url,
              imagen_banda_url, titulo, texto_cercania, version)
  on public.disenos_tarjeta to anon;
grant select (id, negocio_id, nombre, direccion, latitud, longitud, activa) on public.sedes to anon;
grant select (id, negocio_id, programa_id, cliente_id, token_publico, sellos_actuales, sellos_historicos,
              premios_ganados, ultima_visita_en, estado, creado_en)
  on public.tarjetas to anon;
grant select (id, negocio_id, nombre, acepta_marketing) on public.clientes to anon;
-- Opt-out en un toque: el cliente solo cambia si acepta mensajes de marketing.
grant update (acepta_marketing) on public.clientes to anon;
grant select (id, negocio_id, tarjeta_id, origen, descripcion, codigo, estado, vence_en, canjeado_en, creado_en)
  on public.cupones to anon;
grant select (id, negocio_id, tarjeta_id, sede_id, cantidad, origen, creado_en) on public.eventos_sello to anon;
grant select (id, negocio_id, tarjeta_id, endpoint, revocada_en) on public.suscripciones_push to anon;
grant insert (negocio_id, tarjeta_id, endpoint, p256dh, auth, agente_usuario) on public.suscripciones_push to anon;
grant update (negocio_id, tarjeta_id, p256dh, auth, agente_usuario, revocada_en) on public.suscripciones_push to anon;

-- ---------------------------------------------------------------------
-- Políticas para anon (la PWA)
-- ---------------------------------------------------------------------
create policy club_negocios_ver on public.negocios
  for select to anon using (id = (select privado.negocio_club()));

create policy club_programas_ver on public.programas
  for select to anon using (activo and negocio_id = (select privado.negocio_club()));

create policy club_disenos_ver on public.disenos_tarjeta
  for select to anon using (negocio_id = (select privado.negocio_club()));

create policy club_sedes_ver on public.sedes
  for select to anon using (activa and negocio_id = (select privado.negocio_club()));

create policy club_tarjetas_ver on public.tarjetas
  for select to anon using (id = (select privado.tarjeta_club()));

create policy club_clientes_ver on public.clientes
  for select to anon using (id = (select privado.cliente_club()));
create policy club_clientes_marketing on public.clientes
  for update to anon
  using (id = (select privado.cliente_club()))
  with check (id = (select privado.cliente_club()));

create policy club_cupones_ver on public.cupones
  for select to anon using (tarjeta_id = (select privado.tarjeta_club()));

create policy club_eventos_ver on public.eventos_sello
  for select to anon using (tarjeta_id = (select privado.tarjeta_club()));

-- Web Push: el dispositivo guarda o revoca su suscripción, siempre de su propia tarjeta.
create policy club_push_ver on public.suscripciones_push
  for select to anon using (tarjeta_id = (select privado.tarjeta_club()));
create policy club_push_crear on public.suscripciones_push
  for insert to anon
  with check (tarjeta_id = (select privado.tarjeta_club()) and negocio_id = (select privado.negocio_club()));
create policy club_push_editar on public.suscripciones_push
  for update to anon
  using (tarjeta_id = (select privado.tarjeta_club()))
  with check (tarjeta_id = (select privado.tarjeta_club()) and negocio_id = (select privado.negocio_club()));

-- ---------------------------------------------------------------------
-- Límite de intentos de registro (por IP y por celular, por negocio)
-- ---------------------------------------------------------------------
create table public.intentos_registro (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  -- 'ip:<sha256>' o 'celular:<sha256>': nunca la IP ni el celular en claro.
  huella     text not null check (huella ~ '^(ip|celular):[0-9a-f]{64}$'),
  creado_en  timestamptz not null default now()
);
create index intentos_registro_negocio_huella_idx on public.intentos_registro (negocio_id, huella, creado_en);
create index intentos_registro_creado_idx on public.intentos_registro (creado_en);
alter table public.intentos_registro enable row level security;
-- Sin políticas: solo service_role (la Edge Function).
revoke all on public.intentos_registro from anon, authenticated;
comment on table public.intentos_registro is 'Intentos de registro en la PWA (última hora) para limitar abuso. Se purga solo.';

-- ---------------------------------------------------------------------
-- Registro del cliente: crea cliente + tarjeta del programa activo.
-- Responde { registrado: true, token } o { registrado: false, motivo } con
-- motivo = celular_ya_registrado | demasiados_intentos (sin lanzar error,
-- para que el intento quede contado). Si el celular ya existe NO devuelve
-- la tarjeta existente (evita robo de tarjeta).
-- ---------------------------------------------------------------------
create or replace function public.club_registrar(
  p_slug             text,
  p_celular          text,
  p_nombre           text,
  p_fecha_nacimiento date,
  p_acepta_marketing boolean,
  p_huella_ip        text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio   public.negocios%rowtype;
  v_programa  uuid;
  v_cliente   uuid;
  v_token     text;
  v_huella_cel text := 'celular:' || encode(extensions.digest(p_celular, 'sha256'), 'hex');
  v_huella_ip  text := 'ip:' || p_huella_ip;
begin
  select * into v_negocio from public.negocios where slug = p_slug;
  if not found then
    raise exception 'negocio_no_encontrado';
  end if;
  if v_negocio.estado <> 'activo' then
    raise exception 'negocio_inactivo';
  end if;

  select id into v_programa from public.programas where negocio_id = v_negocio.id and activo;
  if v_programa is null then
    raise exception 'programa_inactivo';
  end if;

  -- Purga lo viejo y cuenta la última hora. Una tienda comparte la IP del wifi:
  -- por eso el tope por IP es amplio y el del celular, corto.
  delete from public.intentos_registro where creado_en < now() - interval '1 day';
  if (select count(*) from public.intentos_registro
       where negocio_id = v_negocio.id and huella = v_huella_ip and creado_en > now() - interval '1 hour') >= 30
     or (select count(*) from public.intentos_registro
       where negocio_id = v_negocio.id and huella = v_huella_cel and creado_en > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('registrado', false, 'motivo', 'demasiados_intentos');
  end if;
  insert into public.intentos_registro (negocio_id, huella)
  values (v_negocio.id, v_huella_ip), (v_negocio.id, v_huella_cel);

  begin
    insert into public.clientes (negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, acepta_marketing, version_politica)
    values (v_negocio.id, p_celular, p_nombre, p_fecha_nacimiento, true, coalesce(p_acepta_marketing, false),
            v_negocio.version_politica_datos)
    returning id into v_cliente;
  exception
    when unique_violation then
      return jsonb_build_object('registrado', false, 'motivo', 'celular_ya_registrado');
  end;

  insert into public.tarjetas (negocio_id, programa_id, cliente_id)
  values (v_negocio.id, v_programa, v_cliente)
  returning token_publico into v_token;

  return jsonb_build_object('registrado', true, 'token', v_token);
end;
$$;

revoke execute on function public.club_registrar(text, text, text, date, boolean, text) from public, anon, authenticated;
grant execute on function public.club_registrar(text, text, text, date, boolean, text) to service_role;
