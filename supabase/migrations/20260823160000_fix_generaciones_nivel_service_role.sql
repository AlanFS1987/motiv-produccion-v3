-- =============================================================
-- FIX 23/08/2026 — fn_consumir_generacion_nivel/fn_devolver_
-- generacion_nivel usaban auth.uid(), pero se llaman desde DENTRO de
-- generar-personaje con el cliente supabaseAdmin (service_role) —
-- con service_role, auth.uid() siempre es null (no lleva el JWT del
-- usuario), así que la función lanzaba "No hay sesión activa" pese a
-- que el usuario sí tenía sesión válida.
--
-- Corrección: vuelven a recibir p_usuario_id como parámetro (como la
-- fn_consumir_generacion original), pero se RESTRINGE el permiso de
-- ejecución a service_role — así ningún cliente autenticado normal
-- puede llamarlas directamente con el usuario_id de otra persona
-- (que era justo el riesgo que auth.uid() evitaba). El resultado es
-- el mismo nivel de seguridad, solo que la barrera pasa de "la propia
-- función verifica auth.uid()" a "Postgres impide que nadie más la
-- ejecute" — necesario porque quien la llama (la Edge Function) YA
-- validó el JWT por su cuenta en el paso 1, con service_role.
--
-- fn_seleccionar_personaje NO cambia — esa sí la llama el cliente
-- directamente con su propia sesión, ahí auth.uid() es correcto.
-- =============================================================

drop function if exists fn_consumir_generacion_nivel(uuid);
drop function if exists fn_devolver_generacion_nivel(uuid);

create or replace function fn_consumir_generacion_nivel(p_usuario_id uuid, p_nivel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas_afectadas int;
begin
  update personaje_stats_nivel
  set generaciones_usadas = generaciones_usadas + 1
  where usuario_id = p_usuario_id
    and nivel_id = p_nivel_id
    and generaciones_usadas < 3;

  get diagnostics v_filas_afectadas = row_count;
  return v_filas_afectadas > 0;
end;
$$;

create or replace function fn_devolver_generacion_nivel(p_usuario_id uuid, p_nivel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update personaje_stats_nivel
  set generaciones_usadas = greatest(0, generaciones_usadas - 1)
  where usuario_id = p_usuario_id
    and nivel_id = p_nivel_id;
end;
$$;

-- Solo service_role puede ejecutarlas — ningún cliente autenticado
-- normal (anon/authenticated) puede llamarlas con un usuario_id
-- ajeno. Esta es la barrera de seguridad real ahora.
revoke execute on function fn_consumir_generacion_nivel(uuid, uuid) from public, authenticated, anon;
grant execute on function fn_consumir_generacion_nivel(uuid, uuid) to service_role;

revoke execute on function fn_devolver_generacion_nivel(uuid, uuid) from public, authenticated, anon;
grant execute on function fn_devolver_generacion_nivel(uuid, uuid) to service_role;

comment on function fn_consumir_generacion_nivel(uuid, uuid) is
  'Consume 1 generación del nivel p_nivel_id para p_usuario_id. Solo '
  'ejecutable por service_role (revocado a authenticated/anon) — se '
  'llama desde generar-personaje, que ya validó el JWT por su cuenta '
  'en el paso 1. No usa auth.uid(): con service_role siempre sería null.';
comment on function fn_devolver_generacion_nivel(uuid, uuid) is
  'Devuelve 1 generación del nivel p_nivel_id a p_usuario_id — mismo '
  'criterio que fn_consumir_generacion_nivel, ver su comentario.';
