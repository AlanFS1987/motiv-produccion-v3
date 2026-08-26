-- =============================================================
-- Fix seguridad — funciones security definer expuestas a anon/
-- authenticated sin control de acceso (lint Supabase, 26/08/2026).
--
-- Cubre 5 de las 11 funciones señaladas por el linter. Las otras 6
-- se dejan fuera a propósito:
--   - fn_seleccionar_personaje: ya usa auth.uid() correctamente, no
--     tiene el problema (falso positivo del linter).
--   - fn_rol_actual: segura tal cual, solo expone el rol de quien
--     llama vía auth.uid().
--   - fn_notificar_telegram, fn_marcar_corregido_no_vigente,
--     fn_bloquear_ascenso_admin: son funciones de TRIGGER
--     (returns trigger) — Postgres no permite ejecutarlas fuera de
--     un trigger real, así que no son explotables vía RPC pese a
--     aparecer en el lint.
--   - fn_disparar_resumen_turno: NO se toca en esta migración. La
--     llama un trigger no-definer (fn_trigger_resumen_turno_cierre)
--     que corre con los permisos de quien cierra el turno realmente
--     (responsable/admin autenticado) — revocarle el permiso a
--     `authenticated` rompería el cierre manual de turno en
--     producción. Requiere un pequeño refactor aparte (hacer también
--     ese trigger security definer) antes de poder restringirla sin
--     riesgo.
-- =============================================================

-- -------------------------------------------------------------
-- 1) fn_guardar_personaje_generado — solo la llama generar-personaje
--    con el cliente service_role (verificado en el código de la
--    Edge Function). Sin auth.uid() ni comprobación de quién llama:
--    expuesta tal cual, cualquiera con la clave anon podría insertar
--    un personaje arbitrario para cualquier usuario_id. Mismo
--    patrón ya aplicado a fn_consumir_generacion_nivel (23/08/2026).
-- -------------------------------------------------------------
revoke execute on function fn_guardar_personaje_generado(uuid, uuid, text, text) from public, authenticated, anon;
grant execute on function fn_guardar_personaje_generado(uuid, uuid, text, text) to service_role;

comment on function fn_guardar_personaje_generado(uuid, uuid, text, text) is
  'El nuevo personaje generado pasa a ser automáticamente el '
  'seleccionado. Solo ejecutable por service_role (revocado a '
  'authenticated/anon, 26/08/2026) — la llama generar-personaje, que '
  'ya validó el JWT por su cuenta antes de invocarla con el cliente '
  'admin. Nunca recibía comprobación de auth.uid(), así que expuesta '
  'a anon/authenticated era un hueco real: cualquiera podía insertar '
  'un personaje arbitrario para cualquier usuario_id.';

-- -------------------------------------------------------------
-- 2) fn_nivel_actual — su propio comentario original ya decía "no
--    para exponerla como RPC libre al cliente". Hoy solo la usa
--    fn_otorgar_bonus_nivel internamente (llamada función-a-función,
--    que conserva los privilegios del owner, no los de quien invocó
--    fn_otorgar_bonus_nivel desde fuera) — revocar el acceso externo
--    no rompe esa llamada interna.
-- -------------------------------------------------------------
revoke execute on function fn_nivel_actual(uuid) from public, authenticated, anon;
grant execute on function fn_nivel_actual(uuid) to service_role;

-- -------------------------------------------------------------
-- 3) fn_cerrar_ciclos_pendientes — hoy solo la dispara el cron (rol
--    postgres, no le afecta ningún REVOKE). El botón de admin
--    "Recalcular ciclo anterior" que la llamaría desde el cliente
--    todavía no está construido (07-pendientes.md, "por construir")
--    — sin caller legítimo actual al que se le rompa nada. Cuando se
--    construya ese botón, habrá que decidir entre volver a dar
--    acceso a authenticated con un check de rol administrador (mismo
--    patrón que fn_otorgar_bonus_nivel más abajo) o llamarla desde
--    una Edge Function con service_role.
-- -------------------------------------------------------------
revoke execute on function fn_cerrar_ciclos_pendientes() from public, authenticated, anon;
grant execute on function fn_cerrar_ciclos_pendientes() to service_role;

-- -------------------------------------------------------------
-- 4) fn_disparar_resumen_calidad — solo la dispara el cron
--    (resumen-calidad-diario), sin ningún caller por trigger no-
--    definer de por medio. Segura de restringir.
-- -------------------------------------------------------------
revoke execute on function fn_disparar_resumen_calidad() from public, authenticated, anon;
grant execute on function fn_disparar_resumen_calidad() to service_role;

-- -------------------------------------------------------------
-- 5) fn_otorgar_bonus_nivel — SÍ la llama el cliente directamente
--    (supabase.rpc desde admin-gamificacion.ts, con la sesión propia
--    del administrador) — no se le puede quitar el acceso a
--    `authenticated` sin romper el botón real. La corrección es
--    añadir la comprobación de rol que faltaba: hasta ahora
--    cualquier usuario autenticado (o incluso anon) podía llamarla
--    con cualquier usuario_id y auto-otorgarse el snapshot/bonus de
--    nivel sin pasar por el admin. Cuerpo idéntico al de
--    20260825200000_fix_ambiguedad_nivel_id.sql, solo con el check
--    de administrador añadido al principio.
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
  if fn_rol_actual() <> 'administrador' then
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
  'parámetro de salida del mismo nombre. Check de administrador '
  'añadido 26/08/2026 (lint de seguridad): antes cualquier usuario '
  'autenticado, o incluso anon, podía llamarla con cualquier '
  'usuario_id y auto-otorgarse el bonus sin pasar por el admin — el '
  'botón del frontend ya solo la llama con sesión de administrador, '
  'esto añade la barrera real en el servidor.';
