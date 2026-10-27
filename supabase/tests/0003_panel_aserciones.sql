-- Aserciones de la migración 0002 (Sprint 1, panel del negocio).
-- Se corre dentro de una transacción con rollback: ./scripts/probar-sql.sh
-- Crea datos de prueba: NO correr en producción.

\set ON_ERROR_STOP 1
begin;

create function pg_temp.debe_fallar(p_sql text, p_esperado text, p_caso text)
returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception 'FALLO [%]: se esperaba error "%" y la sentencia pasó', p_caso, p_esperado;
exception
  when others then
    if sqlerrm like 'FALLO [%' then
      raise;
    end if;
    if position(p_esperado in sqlerrm) = 0 then
      raise exception 'FALLO [%]: se esperaba "%" y llegó "%"', p_caso, p_esperado, sqlerrm;
    end if;
    raise notice 'OK [%]: %', p_caso, sqlerrm;
end;
$$;
grant execute on function pg_temp.debe_fallar(text, text, text) to authenticated, anon;

create function pg_temp.igual(p_obtenido anyelement, p_esperado anyelement, p_caso text)
returns void
language plpgsql
as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'FALLO [%]: se esperaba % y llegó %', p_caso, p_esperado, p_obtenido;
  end if;
  raise notice 'OK [%]', p_caso;
end;
$$;
grant execute on function pg_temp.igual(anyelement, anyelement, text) to authenticated, anon;

-- Usuarios: plataforma, dueño, administrador y cajero de A; dueño de B; nuevo sin negocio
insert into auth.users (id, email) values
 ('a0000000-0000-0000-0000-000000000001', 'plataforma@prueba.co'),
 ('a0000000-0000-0000-0000-000000000002', 'dueno@prueba.co'),
 ('a0000000-0000-0000-0000-000000000003', 'admin@prueba.co'),
 ('a0000000-0000-0000-0000-000000000004', 'cajero@prueba.co'),
 ('a0000000-0000-0000-0000-000000000005', 'duenob@prueba.co'),
 ('a0000000-0000-0000-0000-000000000006', 'nuevo@prueba.co');
insert into public.administradores_plataforma (usuario_id) values ('a0000000-0000-0000-0000-000000000001');

-- 1. Plataforma crea negocio con programa y diseño por defecto
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select set_config('prueba.negocio_a', public.crear_negocio('heladeria-a', 'Heladería A')::text, true);
select set_config('prueba.negocio_b', public.crear_negocio('cafe-b', 'Café B', 'America/Mexico_City')::text, true);
select pg_temp.igual(count(*), 1::bigint, 'crear_negocio crea un programa activo')
  from public.programas where negocio_id = current_setting('prueba.negocio_a')::uuid and activo;
select pg_temp.igual(count(*), 1::bigint, 'crear_negocio crea el diseño de la tarjeta')
  from public.disenos_tarjeta where negocio_id = current_setting('prueba.negocio_a')::uuid;
select pg_temp.debe_fallar(
  $q$select public.crear_negocio('heladeria-a', 'Copia')$q$, 'slug_en_uso', 'slug repetido');
select pg_temp.debe_fallar(
  $q$select public.crear_negocio('zona-mala', 'Zona mala', 'Marte/Olympus')$q$, 'zona_horaria_invalida', 'zona horaria inválida al crear');

-- Plataforma crea sedes y asigna dueños
insert into public.sedes (id, negocio_id, nombre) values
 ('b0000000-0000-0000-0000-000000000001', current_setting('prueba.negocio_a')::uuid, 'Centro'),
 ('b0000000-0000-0000-0000-000000000002', current_setting('prueba.negocio_b')::uuid, 'Norte');
insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 (current_setting('prueba.negocio_a')::uuid, 'a0000000-0000-0000-0000-000000000002', 'dueno'),
 (current_setting('prueba.negocio_b')::uuid, 'a0000000-0000-0000-0000-000000000005', 'dueno');
select pg_temp.igual(count(*), 2::bigint, 'plataforma asigna dueños') from public.miembros_negocio
  where rol = 'dueno' and negocio_id in (current_setting('prueba.negocio_a')::uuid, current_setting('prueba.negocio_b')::uuid);

-- Plataforma cambia plan y estado
select public.plataforma_actualizar_negocio(current_setting('prueba.negocio_b')::uuid, 'pro', 'activo');
select pg_temp.igual(plan, 'pro', 'plataforma cambia plan') from public.negocios where slug = 'cafe-b';

-- 2. Dueño gestiona su equipo (solo administradores y cajeros)
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
insert into public.miembros_negocio (negocio_id, usuario_id, rol) values
 (current_setting('prueba.negocio_a')::uuid, 'a0000000-0000-0000-0000-000000000003', 'administrador'),
 (current_setting('prueba.negocio_a')::uuid, 'a0000000-0000-0000-0000-000000000004', 'administrador');
update public.miembros_negocio set rol = 'cajero' where usuario_id = 'a0000000-0000-0000-0000-000000000004';
select pg_temp.igual(rol, 'cajero', 'dueño cambia rol a cajero')
  from public.miembros_negocio where usuario_id = 'a0000000-0000-0000-0000-000000000004';
select pg_temp.debe_fallar(
  format($q$insert into public.miembros_negocio (negocio_id, usuario_id, rol) values (%L, 'a0000000-0000-0000-0000-000000000006', 'dueno')$q$,
         current_setting('prueba.negocio_a')),
  'row-level security', 'dueño no crea otro dueño');
select pg_temp.debe_fallar(
  $q$update public.miembros_negocio set rol = 'dueno' where usuario_id = 'a0000000-0000-0000-0000-000000000003'$q$,
  'row-level security', 'dueño no asciende a dueño');
select pg_temp.debe_fallar(
  format($q$insert into public.miembros_negocio (negocio_id, usuario_id, rol) values (%L, 'a0000000-0000-0000-0000-000000000006', 'cajero')$q$,
         current_setting('prueba.negocio_b')),
  'row-level security', 'dueño no agrega equipo en otro negocio');
select pg_temp.debe_fallar(
  $q$update public.miembros_negocio set negocio_id = negocio_id where usuario_id = 'a0000000-0000-0000-0000-000000000003'$q$,
  'permission denied', 'no se cambia el negocio de un miembro');
-- El dueño no puede borrarse a sí mismo (la fila es de rol dueño)
delete from public.miembros_negocio where usuario_id = 'a0000000-0000-0000-0000-000000000002';
select pg_temp.igual(count(*), 1::bigint, 'dueño no se borra a sí mismo')
  from public.miembros_negocio where usuario_id = 'a0000000-0000-0000-0000-000000000002';

select pg_temp.igual(count(*), 3::bigint, 'dueño ve el equipo con correo')
  from public.equipo_negocio(current_setting('prueba.negocio_a')::uuid);
select pg_temp.igual(email, 'dueno@prueba.co', 'el dueño va primero en el equipo')
  from public.equipo_negocio(current_setting('prueba.negocio_a')::uuid) limit 1;
select pg_temp.debe_fallar(
  format($q$select * from public.equipo_negocio(%L)$q$, current_setting('prueba.negocio_b')),
  'sin_permiso', 'dueño no ve el equipo de otro negocio');
select pg_temp.debe_fallar(
  $q$select public.crear_negocio('pirata', 'Pirata')$q$, 'sin_permiso', 'dueño no crea negocios');
select pg_temp.debe_fallar(
  format($q$select public.plataforma_actualizar_negocio(%L, 'empresa', 'activo')$q$, current_setting('prueba.negocio_a')),
  'sin_permiso', 'dueño no cambia su plan');
select pg_temp.debe_fallar(
  $q$select public.usuario_por_email('cajero@prueba.co')$q$, 'permission denied', 'usuario_por_email solo service_role');

-- Dueño edita su negocio y su programa, no la zona horaria inválida
update public.negocios set nombre = 'Heladería A+', color_primario = '#112233' where slug = 'heladeria-a';
select pg_temp.igual(nombre, 'Heladería A+', 'dueño edita su marca') from public.negocios where slug = 'heladeria-a';
select pg_temp.debe_fallar(
  $q$update public.negocios set zona_horaria = 'America/Bogata' where slug = 'heladeria-a'$q$,
  'zona_horaria_invalida', 'zona horaria inválida al editar');
update public.programas set sellos_requeridos = 5, premio_descripcion = 'Cono doble' where negocio_id = current_setting('prueba.negocio_a')::uuid;
select pg_temp.igual(sellos_requeridos::int, 5, 'dueño edita el programa') from public.programas where negocio_id = current_setting('prueba.negocio_a')::uuid;

-- 3. Cajero: no gestiona equipo, no ve la lista, no edita programa ni sedes
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
select pg_temp.debe_fallar(
  format($q$insert into public.miembros_negocio (negocio_id, usuario_id, rol) values (%L, 'a0000000-0000-0000-0000-000000000006', 'cajero')$q$,
         current_setting('prueba.negocio_a')),
  'row-level security', 'cajero no agrega equipo');
select pg_temp.debe_fallar(
  format($q$select * from public.equipo_negocio(%L)$q$, current_setting('prueba.negocio_a')),
  'sin_permiso', 'cajero no ve la lista del equipo');
update public.programas set sellos_requeridos = 2;
select pg_temp.igual(sellos_requeridos::int, 5, 'cajero no edita el programa') from public.programas where negocio_id = current_setting('prueba.negocio_a')::uuid;
update public.sedes set nombre = 'Hackeada';
select pg_temp.igual(nombre, 'Centro', 'cajero no edita sedes') from public.sedes where id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.igual(count(*), 1::bigint, 'cajero ve solo la sede de su negocio') from public.sedes;

-- 4. Administrador: edita negocio y programa, no gestiona equipo
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
select pg_temp.igual(count(*), 3::bigint, 'administrador ve el equipo')
  from public.equipo_negocio(current_setting('prueba.negocio_a')::uuid);
delete from public.miembros_negocio where usuario_id = 'a0000000-0000-0000-0000-000000000004';
select pg_temp.igual(count(*), 1::bigint, 'administrador no quita cajeros')
  from public.miembros_negocio where usuario_id = 'a0000000-0000-0000-0000-000000000004';
update public.sedes set direccion = 'Cra 1 # 2-3' where id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.igual(direccion, 'Cra 1 # 2-3', 'administrador edita la sede') from public.sedes where id = 'b0000000-0000-0000-0000-000000000001';

-- 5. registrar_sello v2 (como service_role / dueño de la tabla)
reset role;
reset request.jwt.claim.sub;
insert into public.clientes (id, negocio_id, celular, nombre, fecha_nacimiento, acepta_datos, version_politica) values
 ('c0000000-0000-0000-0000-000000000001', current_setting('prueba.negocio_a')::uuid, '+573005556677', 'Ana', '1990-02-02', true, 'v1');
insert into public.tarjetas (negocio_id, programa_id, cliente_id, token_publico)
select current_setting('prueba.negocio_a')::uuid, id, 'c0000000-0000-0000-0000-000000000001', 'tokPanelA'
  from public.programas where negocio_id = current_setting('prueba.negocio_a')::uuid;

select pg_temp.igual(
  (public.registrar_sello(current_setting('prueba.negocio_a')::uuid, 'tokPanelA', 'panel:1', 'b0000000-0000-0000-0000-000000000001',
                          null, 1, 'panel', 'a0000000-0000-0000-0000-000000000004') ->> 'sellos_sumados')::int,
  1, 'cajero suma sello desde el panel en su sede');
select pg_temp.igual(format('%s/%s', origen, creado_por), 'panel/a0000000-0000-0000-0000-000000000004', 'evento guarda origen y cajero')
  from public.eventos_sello where venta_externa_id = 'panel:1';
-- detalle cuando no suma: monto bajo el mínimo vs tope diario
update public.programas set monto_minimo = 5000 where negocio_id = current_setting('prueba.negocio_a')::uuid;
select pg_temp.igual(
  public.registrar_sello(current_setting('prueba.negocio_a')::uuid, 'tokPanelA', 'panel:bajo', null, 3000, 1, 'panel') ->> 'detalle',
  'compra_no_aplica', 'compra bajo el monto mínimo');
update public.programas set monto_minimo = null, max_sellos_dia = 1 where negocio_id = current_setting('prueba.negocio_a')::uuid;
select pg_temp.igual(
  public.registrar_sello(current_setting('prueba.negocio_a')::uuid, 'tokPanelA', 'panel:tope', null, null, 1, 'panel') ->> 'detalle',
  'tope_diario', 'tope diario explica el motivo');
update public.programas set max_sellos_dia = 3 where negocio_id = current_setting('prueba.negocio_a')::uuid;
select pg_temp.debe_fallar(
  format($q$select public.registrar_sello(%L, 'tokPanelA', 'panel:2', 'b0000000-0000-0000-0000-000000000002', null, 1, 'panel')$q$,
         current_setting('prueba.negocio_a')),
  'sede_no_encontrada', 'sede de otro negocio');
update public.sedes set activa = false where id = 'b0000000-0000-0000-0000-000000000001';
select pg_temp.debe_fallar(
  format($q$select public.registrar_sello(%L, 'tokPanelA', 'panel:3', 'b0000000-0000-0000-0000-000000000001', null, 1, 'panel')$q$,
         current_setting('prueba.negocio_a')),
  'sede_no_encontrada', 'sede inactiva');
update public.negocios set estado = 'suspendido' where slug = 'heladeria-a';
select pg_temp.debe_fallar(
  format($q$select public.registrar_sello(%L, 'tokPanelA', 'panel:4', null, null, 1, 'panel')$q$,
         current_setting('prueba.negocio_a')),
  'negocio_inactivo', 'negocio suspendido no suma sellos');
-- La idempotencia sigue respondiendo aunque el negocio esté suspendido
select pg_temp.igual(
  (public.registrar_sello(current_setting('prueba.negocio_a')::uuid, 'tokPanelA', 'panel:1') ->> 'duplicado')::bool,
  true, 'venta repetida sigue siendo duplicado');

rollback;
\echo 'Todas las aserciones del panel pasaron.'
