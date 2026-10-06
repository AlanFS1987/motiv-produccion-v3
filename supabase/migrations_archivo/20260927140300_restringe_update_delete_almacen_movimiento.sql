-- =============================================================
-- almacen_movimiento pasa a ser INMUTABLE para el mecánico (S5,
-- auditoría 27/09/2026) — coherente con su propio diseño documentado
-- ("histórico de stock, nunca se pisa un número", memorias/06-
-- esquema-bd.md). Hoy una única política `for all` da a mecánico Y
-- administrador el mismo permiso total (select/insert/update/delete)
-- sobre esta tabla — el mecánico puede, en la práctica, editar o
-- borrar un movimiento ya registrado, contradiciendo el propio
-- diseño: para corregir un error de stock existe el tipo de
-- movimiento 'ajuste' (un movimiento NUEVO que compensa, nunca tocar
-- el antiguo).
--
-- Esta es una RESTRICCIÓN, no una ampliación — igual que en la
-- migración de personaje_rpg, hay que sustituir la política vieja
-- (demasiado amplia) por varias más estrechas, porque añadir una
-- política adicional no habría quitado el permiso ya dado por la
-- vieja (RLS combina con OR). El administrador conserva acceso
-- completo (para corregir errores excepcionales); el mecánico se
-- queda con solo lectura + inserción de movimientos nuevos.
--
-- Nota: el trigger fn_almacen_pedido_linea_recibida (que inserta el
-- movimiento de entrada automático al marcar una línea de pedido
-- como recibida) sigue funcionando sin cambios — sigue siendo un
-- INSERT, que el mecánico conserva.
-- =============================================================

drop policy if exists almacen_movimiento_mecanico_admin_todo on almacen_movimiento;

create policy almacen_movimiento_select on almacen_movimiento
  for select using (fn_rol_actual() in ('mecanico', 'administrador'));

create policy almacen_movimiento_insert on almacen_movimiento
  for insert with check (fn_rol_actual() in ('mecanico', 'administrador'));

create policy almacen_movimiento_admin_update on almacen_movimiento
  for update using (fn_rol_actual() = 'administrador')
  with check (fn_rol_actual() = 'administrador');

create policy almacen_movimiento_admin_delete on almacen_movimiento
  for delete using (fn_rol_actual() = 'administrador');

comment on table almacen_movimiento is
  'Histórico de stock, nunca se pisa un número. Desde el 27/09/2026, '
  'el mecánico solo puede leer e insertar movimientos nuevos (entrada/'
  'salida/ajuste) — ya no puede editar ni borrar un movimiento ya '
  'registrado. El administrador conserva acceso completo para '
  'corregir errores excepcionales. Antes, una única política ''for '
  'all'' daba a ambos roles el mismo permiso total.';
