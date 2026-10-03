-- 02/10/2026 — Cierre de funciones expuestas a anon/PUBLIC y guardas de rol a prueba de nulos.
--
-- Contexto (inventario del 02/10/2026): las funciones de public nacían ejecutables por
-- anon y PUBLIC (privilegios por defecto de Supabase). Con fn_rol_actual() = NULL,
-- `NULL <> 'x'` y `NULL NOT IN (...)` son NULL y el `if ... raise` no saltaba, así que
-- fn_otorgar_bonus_nivel (ejecutable por anon) dejaba pasar a cualquiera sin sesión.
--
-- No cambia el comportamiento para `authenticated` (todas las funciones afectadas
-- tienen ya su permiso explícito, comprobado antes de revocar PUBLIC).

-- -------------------------------------------------------------
-- 1) Guardas a prueba de nulos (cuerpo idéntico al vigente, solo cambia el `if`)
-- -------------------------------------------------------------
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
  if coalesce(fn_rol_actual()::text, '') <> 'administrador' then
    raise exception 'Solo un administrador puede otorgar el bonus de nivel';
  end if;

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

create or replace function guardar_muestra_excel(p_titulo text, p_contenido text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if coalesce(trim(p_titulo), '') = '' or coalesce(trim(p_contenido), '') = '' then
    raise exception 'La muestra está vacía';
  end if;

  if length(p_contenido) > 2000000 then
    raise exception 'La muestra es demasiado grande (máx. 2 MB de texto)';
  end if;

  insert into admin_notas (tipo, titulo, contenido, creado_por)
  values ('nota', 'muestra_excel: ' || trim(p_titulo), p_contenido, auth.uid());
end;
$$;

-- -------------------------------------------------------------
-- 2) Revocar anon y PUBLIC en todas las funciones propias de public
--    (se excluyen las de extensiones, p. ej. pg_trgm). authenticated,
--    service_role y postgres conservan su permiso explícito.
-- -------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as f
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', r.f);
  end loop;
end $$;

-- -------------------------------------------------------------
-- 3) Solo service_role (mismo patrón que fn_cerrar_ciclos_pendientes, 26/08/2026):
--    - fn_encolar_resumenes_turno_pendientes: solo la dispara el cron (rol postgres).
--    - fn_consumir_generacion / fn_otorgar_generaciones_por_nivel: sin ningún llamador
--      (la vigente es fn_consumir_generacion_nivel); no son security definer, así que
--      hoy solo las limitaba la RLS de usuario.
--    fn_disparar_resumen_turno SIGUE ejecutable por authenticated: la llama un trigger
--      no-definer (fn_trigger_resumen_turno_cierre) con los permisos de quien cierra el
--      turno. Cerrarla del todo requiere hacer security definer ese trigger (pendiente).
-- -------------------------------------------------------------
revoke execute on function fn_encolar_resumenes_turno_pendientes() from authenticated;
revoke execute on function fn_consumir_generacion(uuid) from authenticated;
revoke execute on function fn_otorgar_generaciones_por_nivel(uuid, integer) from authenticated;
grant execute on function fn_encolar_resumenes_turno_pendientes() to service_role;
grant execute on function fn_consumir_generacion(uuid) to service_role;
grant execute on function fn_otorgar_generaciones_por_nivel(uuid, integer) to service_role;

-- -------------------------------------------------------------
-- 4) search_path fijo en el trigger de updated_at de programacion_orden
-- -------------------------------------------------------------
alter function set_updated_at_programacion_orden() set search_path = public;

-- -------------------------------------------------------------
-- 5) Las funciones futuras no nacen abiertas a anon/PUBLIC. Hacen falta las dos
--    sentencias: los privilegios por defecto de Supabase están a nivel global Y a
--    nivel del esquema public, y una sola no basta (comprobado el 02/10/2026).
--    Las funciones nuevas siguen siendo ejecutables por authenticated y service_role.
-- -------------------------------------------------------------
alter default privileges for role postgres revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
