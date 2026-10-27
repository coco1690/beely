-- =====================================================================
-- Beely · Migración 0001 · Núcleo multi-negocio
-- Negocios, miembros, sedes, clientes, programa de sellos, tarjetas,
-- ledger de sellos, ofertas, cupones, campañas, push, wallet y llaves API.
--
-- Principios:
--  * Aislamiento por negocio_id con RLS en TODAS las tablas.
--  * El cliente final NO es usuario de Supabase Auth: la PWA y el POS
--    entran solo por Edge Functions (service_role). anon no tiene políticas.
--  * Los sellos y canjes solo se escriben con funciones (registrar_sello,
--    canjear_cupon): nunca INSERT/UPDATE directo desde el frontend.
--  * Montos en numeric(12,2), fechas en timestamptz, textos en text.
-- =====================================================================

create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function privado.fijar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- Token opaco de 64 hex (≈244 bits aleatorios) para QR y enlaces de la PWA.
create or replace function privado.generar_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- Código corto de cupón (10 caracteres hex en mayúscula). Único por negocio.
create or replace function privado.generar_codigo_cupon()
returns text
language sql
volatile
set search_path = ''
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

-- ---------------------------------------------------------------------
-- Plataforma y negocios
-- ---------------------------------------------------------------------
create table public.administradores_plataforma (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  creado_en  timestamptz not null default now()
);

create table public.negocios (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  nombre          text not null check (length(nombre) between 2 and 80),
  razon_social    text,
  nit             text,
  logo_url        text,
  color_primario  text not null default '#F5B301' check (color_primario ~ '^#[0-9A-Fa-f]{6}$'),
  color_secundario text not null default '#1F1A17' check (color_secundario ~ '^#[0-9A-Fa-f]{6}$'),
  zona_horaria    text not null default 'America/Bogota',
  estado          text not null default 'activo' check (estado in ('activo', 'suspendido', 'cancelado')),
  plan            text not null default 'basico' check (plan in ('basico', 'pro', 'empresa')),
  -- Límites anti-spam del motor de campañas
  max_push_semana smallint not null default 3 check (max_push_semana between 0 and 14),
  hora_inicio_envios time not null default '08:00',
  hora_fin_envios    time not null default '20:00',
  -- Texto vigente de autorización de datos (Ley 1581) que ve el cliente
  version_politica_datos text not null default 'v1',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create table public.miembros_negocio (
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol        text not null check (rol in ('dueno', 'administrador', 'cajero')),
  creado_en  timestamptz not null default now(),
  primary key (negocio_id, usuario_id)
);
create index miembros_negocio_usuario_idx on public.miembros_negocio (usuario_id);

create table public.sedes (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios (id) on delete cascade,
  nombre      text not null,
  direccion   text,
  latitud     double precision check (latitud between -90 and 90),
  longitud    double precision check (longitud between -180 and 180),
  activa      boolean not null default true,
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index sedes_negocio_idx on public.sedes (negocio_id);

-- ---------------------------------------------------------------------
-- Clientes (por negocio: cada negocio es responsable de sus datos)
-- ---------------------------------------------------------------------
create table public.clientes (
  id                 uuid primary key default gen_random_uuid(),
  negocio_id         uuid not null references public.negocios (id) on delete cascade,
  celular            text not null check (celular ~ '^\+[1-9][0-9]{7,14}$'), -- E.164, ej. +573001234567
  nombre             text not null check (length(nombre) between 2 and 80),
  fecha_nacimiento   date not null check (fecha_nacimiento >= '1900-01-01'), -- el tope (no futura, edad mínima) se valida en la Edge Function
  acepta_datos       boolean not null check (acepta_datos),       -- obligatorio para registrarse
  acepta_marketing   boolean not null default false,              -- push y promociones, opcional
  version_politica   text not null,
  aceptado_en        timestamptz not null default now(),
  celular_verificado boolean not null default false,              -- se marca en caja o con OTP futuro
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  unique (negocio_id, celular)
);
-- La fecha de nacimiento no se edita desde la PWA (evita abusar del bono de cumpleaños).
create index clientes_negocio_cumple_idx
  on public.clientes (negocio_id, extract(month from fecha_nacimiento), extract(day from fecha_nacimiento));

-- ---------------------------------------------------------------------
-- Programa de sellos y diseño de la tarjeta
-- ---------------------------------------------------------------------
create table public.programas (
  id                  uuid primary key default gen_random_uuid(),
  negocio_id          uuid not null references public.negocios (id) on delete cascade,
  nombre              text not null default 'Tarjeta de sellos',
  sellos_requeridos   smallint not null default 10 check (sellos_requeridos between 2 and 30),
  regla_sello         text not null default 'por_venta'
                      check (regla_sello in ('por_venta', 'por_unidad', 'por_monto')),
  monto_minimo        numeric(12,2) check (monto_minimo is null or monto_minimo > 0),
  monto_por_sello     numeric(12,2) check (monto_por_sello is null or monto_por_sello > 0),
  max_sellos_dia      smallint not null default 3 check (max_sellos_dia between 1 and 50),
  vence_sellos_dias   smallint check (vence_sellos_dias is null or vence_sellos_dias > 0),
  premio_descripcion  text not null default '1 helado gratis',
  premio_vigencia_dias smallint not null default 30 check (premio_vigencia_dias between 1 and 365),
  activo              boolean not null default true,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  check (regla_sello <> 'por_monto' or monto_por_sello is not null)
);
create index programas_negocio_idx on public.programas (negocio_id);
-- Un solo programa activo por negocio (por ahora).
create unique index programas_un_activo_por_negocio
  on public.programas (negocio_id) where activo;

create table public.disenos_tarjeta (
  programa_id      uuid primary key references public.programas (id) on delete cascade,
  negocio_id       uuid not null references public.negocios (id) on delete cascade,
  color_fondo      text not null default '#F5B301' check (color_fondo ~ '^#[0-9A-Fa-f]{6}$'),
  color_texto      text not null default '#1F1A17' check (color_texto ~ '^#[0-9A-Fa-f]{6}$'),
  color_etiquetas  text not null default '#5A4A3F' check (color_etiquetas ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url         text,
  icono_url        text,
  imagen_banda_url text,
  titulo           text not null default 'Tarjeta de sellos',
  texto_cercania   text default '¡Estás cerca! Pasa por tu sello 🐝' check (length(texto_cercania) <= 80),
  google_clase_id  text,     -- LoyaltyClass en Google Wallet
  version          integer not null default 1,  -- sube con cada cambio → re-sincronizar pases
  actualizado_en   timestamptz not null default now()
);
create index disenos_tarjeta_negocio_idx on public.disenos_tarjeta (negocio_id);

-- ---------------------------------------------------------------------
-- Tarjetas y ledger de sellos
-- ---------------------------------------------------------------------
create table public.tarjetas (
  id               uuid primary key default gen_random_uuid(),
  negocio_id       uuid not null references public.negocios (id) on delete cascade,
  programa_id      uuid not null references public.programas (id) on delete restrict,
  cliente_id       uuid not null references public.clientes (id) on delete cascade,
  token_publico    text not null unique default privado.generar_token(), -- va en el QR y en la URL de la PWA
  sellos_actuales  smallint not null default 0 check (sellos_actuales >= 0),
  sellos_historicos integer not null default 0 check (sellos_historicos >= 0),
  premios_ganados  integer not null default 0 check (premios_ganados >= 0),
  ultima_visita_en timestamptz,
  estado           text not null default 'activa' check (estado in ('activa', 'bloqueada')),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (programa_id, cliente_id)
);
create index tarjetas_negocio_idx on public.tarjetas (negocio_id);
create index tarjetas_cliente_idx on public.tarjetas (cliente_id);
create index tarjetas_negocio_ultima_visita_idx on public.tarjetas (negocio_id, ultima_visita_en);

create table public.eventos_sello (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null references public.negocios (id) on delete cascade,
  tarjeta_id      uuid not null references public.tarjetas (id) on delete cascade,
  sede_id         uuid references public.sedes (id) on delete set null,
  cantidad        smallint not null check (cantidad <> 0),  -- negativo = ajuste
  origen          text not null check (origen in ('api_pos', 'panel', 'ajuste', 'canje_premio')),
  venta_externa_id text,          -- id de la venta en el POS: idempotencia
  monto_venta     numeric(12,2),
  creado_por      uuid references auth.users (id) on delete set null,
  nota            text,
  creado_en       timestamptz not null default now()
);
create unique index eventos_sello_idempotencia
  on public.eventos_sello (negocio_id, venta_externa_id) where venta_externa_id is not null;
create index eventos_sello_tarjeta_fecha_idx on public.eventos_sello (tarjeta_id, creado_en desc);
create index eventos_sello_negocio_fecha_idx on public.eventos_sello (negocio_id, creado_en desc);
create index eventos_sello_sede_idx on public.eventos_sello (sede_id);
create index eventos_sello_creado_por_idx on public.eventos_sello (creado_por);

-- ---------------------------------------------------------------------
-- Ofertas y cupones
-- ---------------------------------------------------------------------
create table public.ofertas (
  id                   uuid primary key default gen_random_uuid(),
  negocio_id           uuid not null references public.negocios (id) on delete cascade,
  nombre               text not null,
  tipo                 text not null check (tipo in ('porcentaje', 'monto_fijo', 'producto_gratis', 'dos_por_uno')),
  valor                numeric(12,2) check (valor is null or valor > 0),
  producto_ref         text,      -- código del producto en el POS, si aplica
  descripcion          text,
  vigencia_dias        smallint not null default 15 check (vigencia_dias between 1 and 365),
  usos_max_por_cliente smallint not null default 1 check (usos_max_por_cliente >= 1),
  activa               boolean not null default true,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  check (tipo not in ('porcentaje', 'monto_fijo') or valor is not null),
  check (tipo <> 'porcentaje' or valor <= 100)
);
create index ofertas_negocio_idx on public.ofertas (negocio_id);

create table public.cupones (
  id                   uuid primary key default gen_random_uuid(),
  negocio_id           uuid not null references public.negocios (id) on delete cascade,
  tarjeta_id           uuid not null references public.tarjetas (id) on delete cascade,
  oferta_id            uuid references public.ofertas (id) on delete set null,
  campana_id           uuid,  -- FK se agrega tras crear campanas
  origen               text not null check (origen in ('premio_sellos', 'campana', 'cumpleanos', 'manual')),
  descripcion          text not null,
  codigo               text not null default privado.generar_codigo_cupon(),
  estado               text not null default 'emitido' check (estado in ('emitido', 'canjeado', 'vencido', 'anulado')),
  vence_en             timestamptz not null,
  canjeado_en          timestamptz,
  canjeado_sede_id     uuid references public.sedes (id) on delete set null,
  canjeado_venta_externa_id text,
  canjeado_por         uuid references auth.users (id) on delete set null,
  creado_en            timestamptz not null default now(),
  unique (negocio_id, codigo),
  check ((estado = 'canjeado') = (canjeado_en is not null))
);
create index cupones_tarjeta_estado_idx on public.cupones (tarjeta_id, estado);
create index cupones_negocio_estado_vence_idx on public.cupones (negocio_id, estado, vence_en);
create index cupones_oferta_idx on public.cupones (oferta_id);
create index cupones_campana_idx on public.cupones (campana_id);
create index cupones_canjeado_sede_idx on public.cupones (canjeado_sede_id);
create index cupones_canjeado_por_idx on public.cupones (canjeado_por);

-- ---------------------------------------------------------------------
-- Campañas
-- ---------------------------------------------------------------------
create table public.campanas (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null references public.negocios (id) on delete cascade,
  nombre          text not null,
  disparador      text not null check (disparador in
                    ('manual', 'programada', 'inactividad', 'cumpleanos', 'clima', 'premio_listo', 'hora_valle')),
  config          jsonb not null default '{}'::jsonb,  -- ej. {"dias_inactivo":21} o {"temp_min":32}
  segmento        jsonb not null default '{}'::jsonb,  -- filtros sobre tarjetas/clientes
  oferta_id       uuid references public.ofertas (id) on delete set null,
  titulo          text not null check (length(titulo) <= 60),
  mensaje         text not null check (length(mensaje) <= 180),
  canales         text[] not null default array['push']
                  check (canales <@ array['push', 'wallet']::text[] and cardinality(canales) > 0),
  programada_para timestamptz,
  estado          text not null default 'borrador'
                  check (estado in ('borrador', 'activa', 'pausada', 'finalizada')),
  creado_por      uuid references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  check (disparador <> 'programada' or programada_para is not null)
);
create index campanas_negocio_estado_idx on public.campanas (negocio_id, estado);
create index campanas_oferta_idx on public.campanas (oferta_id);
create index campanas_creado_por_idx on public.campanas (creado_por);

alter table public.cupones
  add constraint cupones_campana_fk foreign key (campana_id)
  references public.campanas (id) on delete set null;

create table public.envios_campana (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios (id) on delete cascade,
  campana_id  uuid not null references public.campanas (id) on delete cascade,
  tarjeta_id  uuid not null references public.tarjetas (id) on delete cascade,
  canal       text not null check (canal in ('push', 'wallet')),
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'fallido', 'omitido')),
  error       text,
  enviado_en  timestamptz,
  creado_en   timestamptz not null default now()
);
create index envios_campana_campana_idx on public.envios_campana (campana_id);
-- Para el tope semanal de push por cliente.
create index envios_campana_tarjeta_fecha_idx on public.envios_campana (tarjeta_id, enviado_en desc);
create index envios_campana_negocio_idx on public.envios_campana (negocio_id);

-- ---------------------------------------------------------------------
-- Push, Wallet y API
-- ---------------------------------------------------------------------
create table public.suscripciones_push (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios (id) on delete cascade,
  tarjeta_id    uuid not null references public.tarjetas (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  agente_usuario text,
  revocada_en   timestamptz,
  ultimo_uso_en timestamptz,
  creado_en     timestamptz not null default now()
);
create index suscripciones_push_tarjeta_idx on public.suscripciones_push (tarjeta_id) where revocada_en is null;
create index suscripciones_push_negocio_idx on public.suscripciones_push (negocio_id);

create table public.pases_wallet (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios (id) on delete cascade,
  tarjeta_id     uuid not null references public.tarjetas (id) on delete cascade,
  plataforma     text not null check (plataforma in ('google', 'apple')),
  objeto_id      text not null,          -- LoyaltyObject id (Google) o serialNumber (Apple)
  token_auth     text,                   -- authenticationToken del pase Apple
  version_diseno integer not null default 1,
  sincronizado_en timestamptz,
  creado_en      timestamptz not null default now(),
  unique (tarjeta_id, plataforma),
  unique (plataforma, objeto_id)
);
create index pases_wallet_negocio_idx on public.pases_wallet (negocio_id);

create table public.llaves_api (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios (id) on delete cascade,
  nombre        text not null,
  prefijo       text not null unique,      -- primeros caracteres visibles, ej. "bly_live_ab12"
  hash          text not null,             -- sha-256 de la llave completa; la llave nunca se guarda
  permisos      text[] not null default array['sellos:escribir', 'cupones:canjear', 'clientes:leer'],
  ultimo_uso_en timestamptz,
  revocada_en   timestamptz,
  creado_por    uuid references auth.users (id) on delete set null,
  creado_en     timestamptz not null default now()
);
create index llaves_api_negocio_idx on public.llaves_api (negocio_id);
create index llaves_api_creado_por_idx on public.llaves_api (creado_por);

-- ---------------------------------------------------------------------
-- Triggers actualizado_en
-- ---------------------------------------------------------------------
create trigger negocios_actualizado before update on public.negocios
  for each row execute function privado.fijar_actualizado_en();
create trigger sedes_actualizado before update on public.sedes
  for each row execute function privado.fijar_actualizado_en();
create trigger clientes_actualizado before update on public.clientes
  for each row execute function privado.fijar_actualizado_en();
create trigger programas_actualizado before update on public.programas
  for each row execute function privado.fijar_actualizado_en();
create trigger disenos_tarjeta_actualizado before update on public.disenos_tarjeta
  for each row execute function privado.fijar_actualizado_en();
create trigger tarjetas_actualizado before update on public.tarjetas
  for each row execute function privado.fijar_actualizado_en();
create trigger ofertas_actualizado before update on public.ofertas
  for each row execute function privado.fijar_actualizado_en();
create trigger campanas_actualizado before update on public.campanas
  for each row execute function privado.fijar_actualizado_en();

-- ---------------------------------------------------------------------
-- Helpers de autorización (usados por las políticas RLS)
-- ---------------------------------------------------------------------
create or replace function privado.es_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores_plataforma
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
  ) or privado.es_admin_plataforma();
$$;

revoke execute on function privado.es_admin_plataforma() from public, anon;
revoke execute on function privado.tiene_rol(uuid, text[]) from public, anon;
grant execute on function privado.es_admin_plataforma() to authenticated;
grant execute on function privado.tiene_rol(uuid, text[]) to authenticated;
revoke execute on function privado.generar_token() from public, anon, authenticated;
revoke execute on function privado.generar_codigo_cupon() from public, anon, authenticated;
revoke execute on function privado.fijar_actualizado_en() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS: activa en todas las tablas. anon no tiene ninguna política.
-- Roles: dueno > administrador > cajero. El admin de plataforma ve todo.
-- ---------------------------------------------------------------------
alter table public.administradores_plataforma enable row level security;
alter table public.negocios            enable row level security;
alter table public.miembros_negocio    enable row level security;
alter table public.sedes               enable row level security;
alter table public.clientes            enable row level security;
alter table public.programas           enable row level security;
alter table public.disenos_tarjeta     enable row level security;
alter table public.tarjetas            enable row level security;
alter table public.eventos_sello       enable row level security;
alter table public.ofertas             enable row level security;
alter table public.cupones             enable row level security;
alter table public.campanas            enable row level security;
alter table public.envios_campana      enable row level security;
alter table public.suscripciones_push  enable row level security;
alter table public.pases_wallet        enable row level security;
alter table public.llaves_api          enable row level security;

-- Plataforma
create policy admin_plataforma_ver on public.administradores_plataforma
  for select to authenticated using ((select privado.es_admin_plataforma()));

-- Negocios: miembros leen; dueño/admin editan; solo plataforma crea o borra.
create policy negocios_ver on public.negocios
  for select to authenticated
  using ((select privado.tiene_rol(id, array['dueno', 'administrador', 'cajero'])));
create policy negocios_editar on public.negocios
  for update to authenticated
  using ((select privado.tiene_rol(id, array['dueno', 'administrador'])))
  with check ((select privado.tiene_rol(id, array['dueno', 'administrador'])));
create policy negocios_crear on public.negocios
  for insert to authenticated with check ((select privado.es_admin_plataforma()));
create policy negocios_borrar on public.negocios
  for delete to authenticated using ((select privado.es_admin_plataforma()));

-- Miembros: el usuario ve sus membresías; el dueño gestiona el equipo.
create policy miembros_ver on public.miembros_negocio
  for select to authenticated
  using (usuario_id = (select auth.uid())
         or (select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy miembros_gestionar on public.miembros_negocio
  for all to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno'])))
  with check ((select privado.tiene_rol(negocio_id, array['dueno'])));

-- Sedes: solo plataforma crea/borra (regla de negocio heredada de Angelato); dueño/admin editan.
create policy sedes_ver on public.sedes
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));
create policy sedes_editar on public.sedes
  for update to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])))
  with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy sedes_crear on public.sedes
  for insert to authenticated with check ((select privado.es_admin_plataforma()));
create policy sedes_borrar on public.sedes
  for delete to authenticated using ((select privado.es_admin_plataforma()));

-- Clientes y tarjetas: todo el equipo lee; las escrituras van por Edge Functions.
create policy clientes_ver on public.clientes
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));
create policy clientes_marcar_verificado on public.clientes
  for update to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])))
  with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));

create policy tarjetas_ver on public.tarjetas
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));

create policy eventos_sello_ver on public.eventos_sello
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));

create policy cupones_ver on public.cupones
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));

-- Configuración comercial: dueño/admin gestionan, cajero lee.
create policy programas_ver on public.programas
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));
create policy programas_gestionar on public.programas
  for all to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])))
  with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

create policy disenos_ver on public.disenos_tarjeta
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));
create policy disenos_gestionar on public.disenos_tarjeta
  for all to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])))
  with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

create policy ofertas_ver on public.ofertas
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador', 'cajero'])));
create policy ofertas_gestionar on public.ofertas
  for all to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])))
  with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

create policy campanas_ver on public.campanas
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));
create policy campanas_gestionar on public.campanas
  for all to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])))
  with check ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

create policy envios_ver on public.envios_campana
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno', 'administrador'])));

create policy llaves_api_ver on public.llaves_api
  for select to authenticated
  using ((select privado.tiene_rol(negocio_id, array['dueno'])));
-- Crear/revocar llaves: Edge Function (genera la llave y guarda solo el hash).

-- suscripciones_push y pases_wallet: sin políticas → solo service_role.

-- ---------------------------------------------------------------------
-- Lógica de negocio atómica (la llaman las Edge Functions con service_role)
-- ---------------------------------------------------------------------

-- Registra sellos para una venta. Idempotente por (negocio, venta_externa_id).
-- Si se completa la tarjeta emite el cupón de premio y reinicia los sellos.
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
  v_cantidad  integer;
  v_hoy       integer;
  v_zona      text;
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
  v_cantidad := case v_programa.regla_sello
    when 'por_venta'  then case when p_monto_venta is null or v_programa.monto_minimo is null
                                  or p_monto_venta >= v_programa.monto_minimo then 1 else 0 end
    when 'por_unidad' then greatest(coalesce(p_unidades, 1), 0)
    when 'por_monto'  then floor(coalesce(p_monto_venta, 0) / v_programa.monto_por_sello)::integer
  end;

  -- Tope diario (en la zona horaria del negocio).
  select zona_horaria into v_zona from public.negocios where id = p_negocio_id;
  select coalesce(sum(cantidad), 0) into v_hoy from public.eventos_sello
   where tarjeta_id = v_tarjeta.id
     and cantidad > 0
     and (creado_en at time zone v_zona)::date = (now() at time zone v_zona)::date;
  v_cantidad := least(v_cantidad, greatest(v_programa.max_sellos_dia - v_hoy, 0));

  if v_cantidad = 0 then
    return jsonb_build_object('duplicado', false, 'tarjeta_id', v_tarjeta.id,
                              'sellos_sumados', 0, 'sellos_actuales', v_tarjeta.sellos_actuales,
                              'premio_emitido', false, 'motivo', 'sin_sellos_aplicables');
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

-- Canjea un cupón emitido y vigente. Idempotente si se repite la misma venta.
create or replace function public.canjear_cupon(
  p_negocio_id       uuid,
  p_codigo           text,
  p_venta_externa_id text default null,
  p_sede_id          uuid default null,
  p_canjeado_por     uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cupon public.cupones%rowtype;
begin
  select * into v_cupon from public.cupones
   where negocio_id = p_negocio_id and codigo = upper(p_codigo)
   for update;
  if not found then
    raise exception 'cupon_no_encontrado' using errcode = 'P0002';
  end if;

  if v_cupon.estado = 'canjeado' then
    if p_venta_externa_id is not null and v_cupon.canjeado_venta_externa_id = p_venta_externa_id then
      return jsonb_build_object('duplicado', true, 'cupon_id', v_cupon.id, 'estado', v_cupon.estado);
    end if;
    raise exception 'cupon_ya_canjeado' using errcode = '22023';
  end if;
  if v_cupon.estado <> 'emitido' then
    raise exception 'cupon_no_disponible' using errcode = '22023';
  end if;
  if v_cupon.vence_en < now() then
    update public.cupones set estado = 'vencido' where id = v_cupon.id;
    raise exception 'cupon_vencido' using errcode = '22023';
  end if;

  update public.cupones
     set estado = 'canjeado', canjeado_en = now(), canjeado_sede_id = p_sede_id,
         canjeado_venta_externa_id = p_venta_externa_id, canjeado_por = p_canjeado_por
   where id = v_cupon.id;

  return jsonb_build_object('duplicado', false, 'cupon_id', v_cupon.id, 'estado', 'canjeado',
                            'descripcion', v_cupon.descripcion, 'oferta_id', v_cupon.oferta_id);
end;
$$;

-- Solo las Edge Functions (service_role) pueden llamar la lógica de negocio.
revoke execute on function public.registrar_sello(uuid, text, text, uuid, numeric, integer, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.canjear_cupon(uuid, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.registrar_sello(uuid, text, text, uuid, numeric, integer, text, uuid) to service_role;
grant execute on function public.canjear_cupon(uuid, text, text, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- Permisos por columna: RLS decide QUÉ filas, esto decide QUÉ columnas.
-- ---------------------------------------------------------------------
-- El equipo solo puede marcar el celular como verificado (no tocar nombre ni cumpleaños).
revoke update on public.clientes from authenticated;
grant update (celular_verificado) on public.clientes to authenticated;

-- El negocio edita su marca y límites, pero no su plan ni su estado (eso es de plataforma).
revoke update on public.negocios from authenticated;
grant update (nombre, razon_social, nit, logo_url, color_primario, color_secundario, zona_horaria,
              max_push_semana, hora_inicio_envios, hora_fin_envios, version_politica_datos)
  on public.negocios to authenticated;

-- Nadie del frontend escribe tarjetas, sellos, cupones, envíos, push, pases ni llaves.
revoke insert, update, delete on public.tarjetas, public.eventos_sello, public.cupones,
  public.envios_campana, public.suscripciones_push, public.pases_wallet, public.llaves_api
  from anon, authenticated;
