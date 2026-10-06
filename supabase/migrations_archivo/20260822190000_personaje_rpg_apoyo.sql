-- =============================================================
-- Gamificación — apoyo SQL para la Edge Function `generar-personaje`
-- (sesión 22/08/2026). Todo lo demás (generaciones_disponibles,
-- fn_consumir_generacion, fn_otorgar_generaciones_por_nivel, el
-- índice único de "seleccionada") ya existía desde antes — aquí solo
-- se añade lo que faltaba: saber el nivel actual de un responsable
-- (solo existía para operario) y el guardado atómico del resultado.
-- =============================================================

-- -------------------------------------------------------------
-- v_puntos_responsable_total_vida — análoga a v_puntos_operario_
-- total_vida (histórico + ciclo en vivo), pero para responsable.
-- -------------------------------------------------------------
create or replace view v_puntos_responsable_total_vida as
select
  u.id as responsable_id,
  coalesce((select sum(hc.puntos_ciclo) from historial_ciclos hc
            where hc.usuario_id = u.id and hc.rol = 'responsable'), 0)
  + coalesce((select vp.puntos_ciclo from v_puntos_responsable_ciclo vp
              where vp.responsable_id = u.id
                and vp.cycle_id = fn_ciclo_id(current_date)), 0)
  as puntos_totales
from usuario u
where u.rol = 'responsable';

comment on view v_puntos_responsable_total_vida is
  'Puntos totales de vida del responsable (metros+rendimiento), '
  'histórico + ciclo en vivo. Análoga a v_puntos_operario_total_vida.';

-- -------------------------------------------------------------
-- fn_nivel_actual — dado cualquier usuario (operario o responsable),
-- devuelve el id de su nivel actual en `niveles`, usando el umbral
-- que corresponda a su rol (operario: umbral_min/max; responsable:
-- umbral_min_responsable/max_responsable, la columna generada ×1,5).
-- security definer porque consulta v_puntos_*_total_vida y `usuario`
-- para CUALQUIER usuario, no solo el que llama — pensada para que la
-- use la Edge Function (con el usuario_id ya validado por el JWT),
-- no para exponerla como RPC libre al cliente.
-- -------------------------------------------------------------
create or replace function fn_nivel_actual(p_usuario_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol      rol_usuario;
  v_puntos   numeric;
  v_nivel_id uuid;
begin
  select rol into v_rol from usuario where id = p_usuario_id;

  if v_rol = 'operario' then
    select puntos_totales into v_puntos
    from v_puntos_operario_total_vida where operario_id = p_usuario_id;

    select id into v_nivel_id from niveles
    where coalesce(v_puntos, 0) >= umbral_min
      and (umbral_max is null or coalesce(v_puntos, 0) <= umbral_max)
    order by orden desc
    limit 1;

  elsif v_rol = 'responsable' then
    select puntos_totales into v_puntos
    from v_puntos_responsable_total_vida where responsable_id = p_usuario_id;

    select id into v_nivel_id from niveles
    where coalesce(v_puntos, 0) >= umbral_min_responsable
      and (umbral_max_responsable is null or coalesce(v_puntos, 0) <= umbral_max_responsable)
    order by orden desc
    limit 1;

  else
    raise exception 'El rol % no tiene niveles de gamificación (solo operario/responsable)', v_rol;
  end if;

  return v_nivel_id;
end;
$$;

comment on function fn_nivel_actual(uuid) is
  'Nivel actual (id de niveles) de un operario o responsable, según '
  'sus puntos totales de vida y el umbral de su rol. Usada por la '
  'Edge Function generar-personaje para saber qué prompt_imagen '
  'tocaba en el momento de generar.';

-- -------------------------------------------------------------
-- fn_guardar_personaje_generado — la parte que SÍ necesita ser
-- atómica del flujo de generar-personaje: desmarcar el personaje
-- previamente seleccionado (si había) e insertar el nuevo como
-- seleccionado, en una sola transacción (evita el choque con el
-- índice único uq_personaje_rpg_seleccionada si dos pasos separados
-- se intercalaran mal). Todo lo que NO es atómico por naturaleza
-- (llamar a la API de imágenes, subir a Cloudinary) ocurre ANTES,
-- en la Edge Function — aquí solo se persiste el resultado ya listo.
-- -------------------------------------------------------------
create or replace function fn_guardar_personaje_generado(
  p_usuario_id uuid,
  p_nivel_id   uuid,
  p_imagen_url text,
  p_historia   text
)
returns personaje_rpg
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila personaje_rpg;
begin
  update personaje_rpg
  set seleccionada = false
  where usuario_id = p_usuario_id and seleccionada = true;

  insert into personaje_rpg (usuario_id, nivel_en_generacion, imagen_url, historia, seleccionada)
  values (p_usuario_id, p_nivel_id, p_imagen_url, p_historia, true)
  returning * into v_fila;

  return v_fila;
end;
$$;

comment on function fn_guardar_personaje_generado(uuid, uuid, text, text) is
  'El nuevo personaje generado pasa a ser automáticamente el '
  'seleccionado (decisión de sesión 22/08/2026: no tenía sentido '
  'generar uno nuevo y seguir mostrando el viejo). "Elegir personaje" '
  'entre los ya generados sigue siendo un UPDATE aparte (RLS '
  'personaje_rpg_update_propia, ya existente) — esta función es solo '
  'para el momento de la generación.';
