-- =====================================================================
-- Beely · Migración 0002 · Panel del negocio (Sprint 1)
-- Alta de negocios por plataforma, gestión del equipo, validaciones que
-- necesita el panel y endurecimiento de registrar_sello (sede y estado
-- del negocio).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Zona horaria válida: registrar_sello calcula el tope diario con
-- `at time zone`; una zona inválida rompería la suma de sellos.
-- ---------------------------------------------------------------------
create or replace function privado.validar_zona_horaria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.zona_horaria) then
    raise exception 'zona_horaria_invalida' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function privado.validar_zona_horaria() from public, anon, authenticated;

create trigger negocios_zona_horaria
  before insert or update of zona_horaria on public.negocios
  for each row execute function privado.validar_zona_horaria();

-- ---------------------------------------------------------------------
-- Equipo: el dueño gestiona administradores y cajeros; solo la
-- plataforma asigna o quita dueños (evita que un negocio quede sin dueño
-- o que un dueño se duplique a sí mismo en otro rol).
-- ---------------------------------------------------------------------
-- Una política por acción (insert/update/delete) en vez de `for all`: así
-- el SELECT solo evalúa miembros_ver (advisor multiple_permissive_policies).
drop policy miembros_gestionar on public.miembros_negocio;

create policy miembros_crear on public.miembros_negocio
  for insert to authenticated
  with check ((select privado.es_admin_plataforma())
         or (rol in ('administrador', 'cajero')
             and usuario_id <> (select auth.uid())
             and (select privado.tiene_rol(negocio_id, array['dueno']))));
create policy miembros_editar on public.miembros_negocio
  for update to authenticated
  using ((select privado.es_admin_plataforma())
         or (rol in ('administrador', 'cajero')
             and usuario_id <> (select auth.uid())
             and (select privado.tiene_rol(negocio_id, array['dueno']))))
  with check ((select privado.es_admin_plataforma())
         or (rol in ('administrador', 'cajero')
             and usuario_id <> (select auth.uid())
             and (select privado.tiene_rol(negocio_id, array['dueno']))));
create policy miembros_borrar on public.miembros_negocio
  for delete to authenticated
  using ((select privado.es_admin_plataforma())
         or (rol in ('administrador', 'cajero')
             and usuario_id <> (select auth.uid())
             and (select privado.tiene_rol(negocio_id, array['dueno']))));

-- Solo se cambia el rol; negocio y usuario son la llave.
revoke update on public.miembros_negocio from authenticated;
grant update (rol) on public.miembros_negocio to authenticated;

-- ---------------------------------------------------------------------
-- Advisor multiple_permissive_policies: las políticas `*_gestionar for all`
-- de 0001 se parten por acción para que el SELECT evalúe una sola política.
-- Mismas reglas: dueño/administrador escriben, todo el equipo lee.
-- ---------------------------------------------------------------------
drop policy programas_gestionar on public.programas;
create policy programas_crear on public.programas
  for insert to authenticated with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy programas_editar on public.programas
  for update to authenticated using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador']))) with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy programas_borrar on public.programas
  for delete to authenticated using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

drop policy disenos_gestionar on public.disenos_tarjeta;
create policy disenos_crear on public.disenos_tarjeta
  for insert to authenticated with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy disenos_editar on public.disenos_tarjeta
  for update to authenticated using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador']))) with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy disenos_borrar on public.disenos_tarjeta
  for delete to authenticated using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

drop policy ofertas_gestionar on public.ofertas;
create policy ofertas_crear on public.ofertas
  for insert to authenticated with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy ofertas_editar on public.ofertas
  for update to authenticated using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador']))) with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy ofertas_borrar on public.ofertas
  for delete to authenticated using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

drop policy campanas_gestionar on public.campanas;
create policy campanas_crear on public.campanas
  for insert to authenticated with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy campanas_editar on public.campanas
  for update to authenticated using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador']))) with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy campanas_borrar on public.campanas
  for delete to authenticated using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

-- Lista del equipo con correo (auth.users no está expuesto al panel).
create or replace function public.equipo_negocio(p_negocio_id uuid)
returns table (
  usuario_id       uuid,
  email            text,
  rol              text,
  creado_en        timestamptz,
  ultimo_ingreso_en timestamptz,
  invitacion_pendiente boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.tiene_rol(p_negocio_id, array['dueno', 'administrador']) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  return query
    select m.usuario_id, u.email::text, m.rol, m.creado_en, u.last_sign_in_at,
           (u.last_sign_in_at is null)
      from public.miembros_negocio m
      join auth.users u on u.id = m.usuario_id
     where m.negocio_id = p_negocio_id
     order by case m.rol when 'dueno' then 0 when 'administrador' then 1 else 2 end, u.email;
end;
$$;
revoke execute on function public.equipo_negocio(uuid) from public, anon;
grant execute on function public.equipo_negocio(uuid) to authenticated;

-- Para la Edge Function panel-equipo: ¿ya existe un usuario con ese correo?
create or replace function public.usuario_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke execute on function public.usuario_por_email(text) from public, anon, authenticated;
grant execute on function public.usuario_por_email(text) to service_role;

-- ---------------------------------------------------------------------
-- Plataforma: alta de negocio con su programa y diseño por defecto, y
-- cambio de plan/estado (columnas que el negocio no puede tocar).
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
  if not privado.es_admin_plataforma() then
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
revoke execute on function public.crear_negocio(text, text, text) from public, anon;
grant execute on function public.crear_negocio(text, text, text) to authenticated;

create or replace function public.plataforma_actualizar_negocio(
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
  if not privado.es_admin_plataforma() then
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
revoke execute on function public.plataforma_actualizar_negocio(uuid, text, text) from public, anon;
grant execute on function public.plataforma_actualizar_negocio(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- registrar_sello v2: igual que 0001, más dos validaciones que el panel
-- y el POS necesitan:
--   * negocio_inactivo: un negocio suspendido o cancelado no suma sellos.
--   * sede_no_encontrada: la sede debe ser del mismo negocio y estar activa.
-- Y cuando no suma nada explica por qué en `detalle`:
--   * tope_diario: la compra daba sellos pero el cliente ya llegó a max_sellos_dia.
--   * compra_no_aplica: la compra no da sellos (monto bajo el mínimo o 0 unidades).
-- ---------------------------------------------------------------------
create or replace function public.registrar_sello(
  p_negocio_id       uuid,
  p_token_tarjeta    text,
  p_venta_externa_id text,
  p_sede_id          uuid default null,
  p_monto_venta      numeric default null,
  p_unidades         integer default 1,
  p_origen           text default 'api_pos',
  p_creado_por       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tarjeta   public.tarjetas%rowtype;
  v_programa  public.programas%rowtype;
  v_existente public.eventos_sello%rowtype;
  v_negocio   public.negocios%rowtype;
  v_cantidad  integer;
  v_base      integer;
  v_hoy       integer;
  v_cupon     public.cupones%rowtype;
  v_premio    boolean := false;
begin
  if p_origen not in ('api_pos', 'panel') then
    raise exception 'origen_invalido' using errcode = '22023';
  end if;

  -- Idempotencia: si la venta ya sumó sellos, devolver el estado actual.
  if p_venta_externa_id is not null then
    select * into v_existente from public.eventos_sello
     where negocio_id = p_negocio_id and venta_externa_id = p_venta_externa_id;
    if found then
      select * into v_tarjeta from public.tarjetas where id = v_existente.tarjeta_id;
      return jsonb_build_object('duplicado', true, 'tarjeta_id', v_tarjeta.id,
                                'sellos_actuales', v_tarjeta.sellos_actuales, 'premio_emitido', false);
    end if;
  end if;

  select * into v_negocio from public.negocios where id = p_negocio_id;
  if not found or v_negocio.estado <> 'activo' then
    raise exception 'negocio_inactivo' using errcode = '22023';
  end if;

  if p_sede_id is not null and not exists (
    select 1 from public.sedes where id = p_sede_id and negocio_id = p_negocio_id and activa
  ) then
    raise exception 'sede_no_encontrada' using errcode = 'P0002';
  end if;

  -- Bloquea la tarjeta para evitar carreras entre cajas.
  select * into v_tarjeta from public.tarjetas
   where token_publico = p_token_tarjeta and negocio_id = p_negocio_id
   for update;
  if not found then
    raise exception 'tarjeta_no_encontrada' using errcode = 'P0002';
  end if;
  if v_tarjeta.estado <> 'activa' then
    raise exception 'tarjeta_bloqueada' using errcode = '22023';
  end if;

  select * into v_programa from public.programas where id = v_tarjeta.programa_id;
  if not v_programa.activo then
    raise exception 'programa_inactivo' using errcode = '22023';
  end if;

  -- Cantidad según la regla del programa.
  v_base := case v_programa.regla_sello
    when 'por_venta'  then case when p_monto_venta is null or v_programa.monto_minimo is null
                                  or p_monto_venta >= v_programa.monto_minimo then 1 else 0 end
    when 'por_unidad' then greatest(coalesce(p_unidades, 1), 0)
    when 'por_monto'  then floor(coalesce(p_monto_venta, 0) / v_programa.monto_por_sello)::integer
  end;

  -- Tope diario (en la zona horaria del negocio).
  select coalesce(sum(cantidad), 0) into v_hoy from public.eventos_sello
   where tarjeta_id = v_tarjeta.id
     and cantidad > 0
     and (creado_en at time zone v_negocio.zona_horaria)::date = (now() at time zone v_negocio.zona_horaria)::date;
  v_cantidad := least(v_base, greatest(v_programa.max_sellos_dia - v_hoy, 0));

  if v_cantidad = 0 then
    return jsonb_build_object('duplicado', false, 'tarjeta_id', v_tarjeta.id,
                              'sellos_sumados', 0, 'sellos_actuales', v_tarjeta.sellos_actuales,
                              'sellos_requeridos', v_programa.sellos_requeridos,
                              'premio_emitido', false, 'motivo', 'sin_sellos_aplicables',
                              'detalle', case when v_base > 0 then 'tope_diario' else 'compra_no_aplica' end);
  end if;

  insert into public.eventos_sello
    (negocio_id, tarjeta_id, sede_id, cantidad, origen, venta_externa_id, monto_venta, creado_por)
  values
    (p_negocio_id, v_tarjeta.id, p_sede_id, v_cantidad, p_origen, p_venta_externa_id, p_monto_venta, p_creado_por);

  v_tarjeta.sellos_actuales := v_tarjeta.sellos_actuales + v_cantidad;

  -- ¿Completó la tarjeta? Emite el premio y descuenta los sellos usados.
  if v_tarjeta.sellos_actuales >= v_programa.sellos_requeridos then
    v_premio := true;
    insert into public.cupones (negocio_id, tarjeta_id, origen, descripcion, vence_en)
    values (p_negocio_id, v_tarjeta.id, 'premio_sellos', v_programa.premio_descripcion,
            now() + make_interval(days => v_programa.premio_vigencia_dias))
    returning * into v_cupon;

    insert into public.eventos_sello (negocio_id, tarjeta_id, sede_id, cantidad, origen, nota)
    values (p_negocio_id, v_tarjeta.id, p_sede_id, -v_programa.sellos_requeridos,
            'canje_premio', 'Tarjeta completa → cupón ' || v_cupon.codigo);

    v_tarjeta.sellos_actuales := v_tarjeta.sellos_actuales - v_programa.sellos_requeridos;
  end if;

  update public.tarjetas
     set sellos_actuales   = v_tarjeta.sellos_actuales,
         sellos_historicos = sellos_historicos + v_cantidad,
         premios_ganados   = premios_ganados + case when v_premio then 1 else 0 end,
         ultima_visita_en  = now()
   where id = v_tarjeta.id;

  return jsonb_build_object(
    'duplicado', false,
    'tarjeta_id', v_tarjeta.id,
    'sellos_sumados', v_cantidad,
    'sellos_actuales', v_tarjeta.sellos_actuales,
    'sellos_requeridos', v_programa.sellos_requeridos,
    'premio_emitido', v_premio,
    'cupon', case when v_premio then jsonb_build_object(
                'id', v_cupon.id, 'codigo', v_cupon.codigo,
                'descripcion', v_cupon.descripcion, 'vence_en', v_cupon.vence_en) end
  );
end;
$$;

-- create or replace conserva los permisos, pero se repiten por claridad.
revoke execute on function public.registrar_sello(uuid, text, text, uuid, numeric, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.registrar_sello(uuid, text, text, uuid, numeric, integer, text, uuid) to service_role;
