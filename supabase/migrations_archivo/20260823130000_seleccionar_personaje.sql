-- =============================================================
-- fn_seleccionar_personaje — "Elegir avatar" entre los ya generados
-- (pestaña Stats/Avatar, sesión de diseño 23/08/2026). Mismo motivo
-- de atomicidad que fn_guardar_personaje_generado: desmarcar el
-- seleccionado anterior e insertar... aquí no se inserta, se marca
-- otro ya existente, pero el mismo choque con
-- uq_personaje_rpg_seleccionada es posible si se hiciera en dos
-- UPDATE sueltos desde el cliente — se resuelve en una función.
-- =============================================================

-- IMPORTANTE: NO recibe usuario_id como parámetro. Al ser security
-- definer, la función se salta RLS — si confiara en un p_usuario_id
-- que le pasa el cliente, cualquiera podría pasar el id de otra
-- persona y robarle la selección de personaje. En vez de eso usa
-- auth.uid() (quién ha iniciado sesión de verdad, según el JWT de la
-- llamada), igual que hacen las políticas RLS del resto de la app.
create or replace function fn_seleccionar_personaje(p_personaje_id uuid)
returns personaje_rpg
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_fila personaje_rpg;
begin
  if v_usuario_id is null then
    raise exception 'No hay sesión activa';
  end if;

  if not exists (
    select 1 from personaje_rpg
    where id = p_personaje_id and usuario_id = v_usuario_id
  ) then
    raise exception 'Ese personaje no existe o no pertenece a este usuario';
  end if;

  update personaje_rpg
  set seleccionada = false
  where usuario_id = v_usuario_id and seleccionada = true;

  update personaje_rpg
  set seleccionada = true
  where id = p_personaje_id
  returning * into v_fila;

  return v_fila;
end;
$$;

comment on function fn_seleccionar_personaje(uuid) is
  'Elegir avatar entre los ya generados (pestaña Stats/Avatar). '
  'Usa auth.uid() para saber de quién es la sesión — NUNCA recibe el '
  'usuario_id como parámetro del cliente, porque al ser security '
  'definer se saltaría RLS y sería explotable. Atómica por el mismo '
  'motivo que fn_guardar_personaje_generado: evita el choque con '
  'uq_personaje_rpg_seleccionada si el cliente hiciera esto en dos '
  'UPDATE sueltos.';
