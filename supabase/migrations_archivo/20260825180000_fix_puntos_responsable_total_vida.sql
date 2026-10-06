-- =============================================================
-- Fix 25/08/2026 — v_puntos_responsable_total_vida seguía sumando
-- sobre historial_ciclos (la tabla compartida vieja), que se vació
-- de filas de responsable al separar historial_ciclo_responsable
-- (20260825110000). Efecto observado: todos los responsables
-- aparecían con 0 puntos de vida -> nivel/generaciones/bonus
-- incorrectos en cascada (fn_nivel_actual y
-- v_admin_usuarios_gamificacion dependen de esta vista).
-- =============================================================

create or replace view v_puntos_responsable_total_vida as
select
  u.id as responsable_id,
  (
    coalesce((select sum(hcr.puntos_ciclo) from historial_ciclo_responsable hcr
              where hcr.usuario_id = u.id), 0)
    + coalesce((select vp.puntos_ciclo from v_puntos_responsable_ciclo vp
                where vp.responsable_id = u.id
                  and vp.cycle_id = fn_ciclo_id(current_date)), 0)
  )::bigint as puntos_totales
from usuario u
where u.rol = 'responsable';

comment on view v_puntos_responsable_total_vida is
  'Puntos totales de vida del responsable (metros+rendimiento), '
  'histórico (historial_ciclo_responsable, desde 25/08/2026 — antes '
  'historial_ciclos) + ciclo en vivo. Análoga a '
  'v_puntos_operario_total_vida.';