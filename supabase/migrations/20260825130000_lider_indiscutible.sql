-- =============================================================
-- 25/08/2026 — Apoyo para "Líder indiscutible" (responsable),
-- mismo patrón que v_ganador_por_ciclo / v_veces_rey_de_reyes del
-- operario (20260823140000_rey_de_reyes.sql), pero sobre
-- historial_ciclo_responsable + v_puntos_responsable_ciclo en vez de
-- historial_ciclos + v_puntos_operario_ciclo.
-- =============================================================

create or replace view v_ganador_por_ciclo_responsable as
select
  cycle_id,
  usuario_id as responsable_id,
  puntos_ciclo,
  row_number() over (partition by cycle_id order by puntos_ciclo desc) as posicion
from (
  select cycle_id, usuario_id, puntos_ciclo
  from historial_ciclo_responsable
  union all
  select cycle_id, responsable_id as usuario_id, puntos_ciclo
  from v_puntos_responsable_ciclo
) x;

comment on view v_ganador_por_ciclo_responsable is
  'Ranking de CADA ciclo de responsable (cerrados en '
  'historial_ciclo_responsable + el actual en vivo vía '
  'v_puntos_responsable_ciclo), con posicion=1 el ganador. Base del '
  'logro "Líder indiscutible".';

create or replace view v_veces_lider_indiscutible as
select responsable_id, count(*) as veces
from v_ganador_por_ciclo_responsable
where posicion = 1
group by responsable_id;

comment on view v_veces_lider_indiscutible is
  'Cuántos ciclos ha ganado (1º del ranking de responsables) cada '
  'responsable — para "Líder indiscutible" (sin condicion_valor '
  'numérico, se compara contra los demás 3, no contra un umbral).';
