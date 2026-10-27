-- Datos de demostración para Supabase local (`pnpm db:reset` los carga).
-- NO correr en producción. Todos los usuarios tienen la clave: beely1234
--
--   plataforma@hibeely.test  admin de plataforma
--   dueno@hibeely.test       dueño de "Heladería Demo"
--   cajero@hibeely.test      cajero de "Heladería Demo"
--
-- Tarjetas de prueba (el token es lo que va en el QR):
--   demo-laura-0000…  Laura, 3 sellos
--   demo-pedro-0000…  Pedro, 9 sellos (el próximo sello emite el premio)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('beely1234', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  from (values
    ('d0000000-0000-0000-0000-000000000001'::uuid, 'plataforma@hibeely.test'),
    ('d0000000-0000-0000-0000-000000000002'::uuid, 'dueno@hibeely.test'),
    ('d0000000-0000-0000-0000-000000000003'::uuid, 'cajero@hibeely.test')
  ) as u (id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now()
  from auth.users where email like '%@hibeely.test';

insert into public.administradores_plataforma (usuario_id) values ('d0000000-0000-0000-0000-000000000001');

insert into public.negocios (id, slug, nombre) values
  ('e0000000-0000-0000-0000-000000000001', 'heladeria-demo', 'Heladería Demo');
insert into public.programas (id, negocio_id, sellos_requeridos, premio_descripcion) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 10, '1 helado gratis');
insert into public.disenos_tarjeta (programa_id, negocio_id) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001');
insert into public.sedes (negocio_id, nombre, direccion) values
  ('e0000000-0000-0000-0000-000000000001', 'Sede Centro', 'Calle 10 # 5-20'),
  ('e0000000-0000-0000-0000-000000000001', 'Sede Norte', 'Av. 30 # 80-15');
insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'dueno'),
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'cajero');

insert into public.clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, acepta_marketing, version_politica) values
  ('e2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '+573001234567', 'Laura Gómez', '1994-03-12', true, true, 'v1'),
  ('e2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '+573109876543', 'Pedro Ruiz', '1988-11-30', true, false, 'v1');
insert into public.tarjetas (negocio_id, programa_id, cliente_id, token_publico, sellos_actuales, sellos_historicos, ultima_visita_en) values
  ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001',
   rpad('demo-laura-', 64, '0'), 3, 3, now() - interval '2 days'),
  ('e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002',
   rpad('demo-pedro-', 64, '0'), 9, 9, now() - interval '5 days');
-- Ledger coherente con los contadores (de días anteriores, para no gastar el tope de hoy).
insert into public.eventos_sello (negocio_id, tarjeta_id, cantidad, origen, nota, creado_en)
select negocio_id, id, sellos_actuales, 'ajuste', 'Saldo inicial de demostración', now() - interval '7 days'
  from public.tarjetas where negocio_id = 'e0000000-0000-0000-0000-000000000001';
