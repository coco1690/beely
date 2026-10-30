-- =====================================================================
-- Beely · 0007 planes
-- Los planes dejan de ser una lista fija en un check (basico, pro, empresa)
-- y pasan a la tabla public.planes, que el superadmin administra desde el
-- panel: nombre, precio mensual y límites de cada plan.
--
-- negocios.plan sigue siendo el código del plan (text), ahora con FK a
-- planes.codigo; el código no se cambia una vez creado. Un plan no se
-- borra: se desactiva, y deja de ofrecerse a negocios nuevos o que cambian
-- de plan (los que ya lo tienen lo conservan).
--
-- Los límites (sedes, clientes) quedan guardados; hacerlos cumplir y
-- cobrar el precio llega con Wompi (sprint 8).
-- =====================================================================

create table public.planes (
  codigo          text primary key
                  check (codigo ~ '^[a-z0-9]([a-z0-9_]{0,28}[a-z0-9])?$'),
  nombre          text not null unique check (length(nombre) between 2 and 40),
  descripcion     text check (length(descripcion) <= 200),
  precio_mensual  numeric(12,2) not null default 0 check (precio_mensual >= 0),
  -- null = sin límite
  max_sedes       integer check (max_sedes between 1 and 1000),
  max_clientes    integer check (max_clientes between 1 and 10000000),
  activo          boolean not null default true,
  orden           smallint not null default 0,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
comment on table public.planes is 'Planes de Beely que el superadmin asigna a cada negocio.';

create trigger planes_actualizado before update on public.planes
  for each row execute function privado.fijar_actualizado_en();

insert into public.planes (codigo, nombre, descripcion, orden) values
  ('basico',  'Básico',  'Tarjeta de sellos y club para un negocio pequeño.', 1),
  ('pro',     'Pro',     'Más sedes, campañas y Wallet.',                     2),
  ('empresa', 'Empresa', 'Cadenas con varias sedes y API para POS.',          3);

-- negocios.plan: de check fijo a FK contra la tabla.
alter table public.negocios drop constraint negocios_plan_check;
alter table public.negocios
  add constraint negocios_plan_fkey foreign key (plan) references public.planes (codigo)
  on update restrict on delete restrict;
create index negocios_plan_idx on public.negocios (plan);

-- ---------------------------------------------------------------------
-- RLS: solo el superadmin ve, crea y edita planes. Nadie los borra.
-- ---------------------------------------------------------------------
alter table public.planes enable row level security;

create policy planes_superadmin_ver on public.planes
  for select to authenticated
  using ((select privado.es_superadmin()));

create policy planes_superadmin_crear on public.planes
  for insert to authenticated
  with check ((select privado.es_superadmin()));

create policy planes_superadmin_editar on public.planes
  for update to authenticated
  using ((select privado.es_superadmin()))
  with check ((select privado.es_superadmin()));

revoke all on public.planes from anon, authenticated;
grant select on public.planes to authenticated;
grant insert (codigo, nombre, descripcion, precio_mensual, max_sedes, max_clientes, activo, orden)
  on public.planes to authenticated;
grant update (nombre, descripcion, precio_mensual, max_sedes, max_clientes, activo, orden)
  on public.planes to authenticated;

-- ---------------------------------------------------------------------
-- Cambiar plan y estado: el plan nuevo debe existir y estar activo.
-- Conservar un plan ya desactivado (solo cambiar el estado) sí se permite.
-- ---------------------------------------------------------------------
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
declare
  v_plan_actual text;
begin
  if not privado.es_superadmin() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  select plan into v_plan_actual from public.negocios where id = p_negocio_id for update;
  if v_plan_actual is null then
    raise exception 'negocio_no_encontrado' using errcode = 'P0002';
  end if;
  if p_plan is distinct from v_plan_actual
     and not exists (select 1 from public.planes where codigo = p_plan and activo) then
    raise exception 'plan_no_disponible' using errcode = '22023';
  end if;

  update public.negocios
     set plan = p_plan, estado = p_estado
   where id = p_negocio_id;
end;
$$;
