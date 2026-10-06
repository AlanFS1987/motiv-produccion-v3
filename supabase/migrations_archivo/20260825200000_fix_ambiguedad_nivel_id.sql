-- =============================================================
-- Fix 25/08/2026 — fn_otorgar_bonus_nivel: "column reference
-- nivel_id is ambiguous" (SQLSTATE 42702) al pulsar el botón para un
-- responsable. Causa: RETURNS TABLE(..., nivel_id uuid, ...) declara
-- un parámetro de salida con el mismo nombre que
-- personaje_stats_nivel.nivel_id, usada en el INSERT y en el ON
-- CONFLICT de esta misma función — PL/pgSQL no puede decidir solo
-- cuál de los dos quieres ahí. Nunca se usa el parámetro de salida
-- por su nombre pelado dentro del cuerpo (siempre v_nivel_id), así
-- que decirle que prefiera la columna de la tabla es 100% seguro,
-- sin cambiar ningún comportamiento.
--
-- Bug preexistente desde 20260823100000 — no es un efecto de la
-- separación de historial_ciclo_responsable, solo que nadie había
-- pulsado el botón para un responsable hasta hoy.
-- =============================================================

create or replace function fn_otorgar_bonus_nivel(p_usuario_id uuid)
returns table (otorgado boolean, nivel_id uuid, nivel_nombre text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_rol         rol_usuario;
  v_nivel_id    uuid;
  v_nivel_nombre text;
  v_fuerza      numeric;
  v_resistencia numeric;
  v_velocidad   numeric;
  v_vida        numeric;
  v_insertadas  int;
begin
  select rol into v_rol from usuario where id = p_usuario_id;
  if v_rol not in ('operario', 'responsable') then
    raise exception 'El rol % no tiene gamificación (solo operario/responsable)', v_rol;
  end if;

  v_nivel_id := fn_nivel_actual(p_usuario_id);
  select nombre into v_nivel_nombre from niveles where id = v_nivel_id;

  select fuerza, resistencia, velocidad
    into v_fuerza, v_resistencia, v_velocidad
  from v_stats_vida
  where usuario_id = p_usuario_id and rol = v_rol::text;

  if v_rol = 'operario' then
    select puntos_totales into v_vida
    from v_puntos_operario_total_vida where operario_id = p_usuario_id;
  else
    select puntos_totales into v_vida
    from v_puntos_responsable_total_vida where responsable_id = p_usuario_id;
  end if;

  insert into personaje_stats_nivel (usuario_id, nivel_id, fuerza, resistencia, velocidad, vida)
  values (
    p_usuario_id, v_nivel_id,
    coalesce(v_fuerza, 0), coalesce(v_resistencia, 0), coalesce(v_velocidad, 0), coalesce(v_vida, 0)
  )
  on conflict (usuario_id, nivel_id) do nothing;

  get diagnostics v_insertadas = row_count;

  return query select (v_insertadas > 0), v_nivel_id, v_nivel_nombre;
end;
$$;

comment on function fn_otorgar_bonus_nivel(uuid) is
  'Botón "otorgar generaciones" de la vista de usuarios del admin. '
  'Guarda el snapshot de stats del nivel actual (fuerza/resistencia/'
  'velocidad/vida, las 4 con coalesce a 0). Sin llamada a '
  'fn_otorgar_generaciones_por_nivel (contador plano muerto, ver '
  '20260823150000) — las 3 generaciones ya están implícitas al crear '
  'la fila en personaje_stats_nivel. Idempotente: repetir la llamada '
  'para un nivel ya otorgado no hace nada (otorgado=false). '
  '#variable_conflict use_column (25/08/2026): evita el "nivel_id is '
  'ambiguous" entre la columna de personaje_stats_nivel y el '
  'parámetro de salida del mismo nombre.';
