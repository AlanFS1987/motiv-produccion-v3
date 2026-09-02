-- =============================================================
-- Fix 02/09/2026 — v_stats_vida (fuerza/resistencia/velocidad de
-- "toda la vida") seguía leyendo el histórico SOLO de historial_ciclos,
-- que se vació de filas de responsable al separar
-- historial_ciclo_responsable (20260825110000/20260825140000).
--
-- Mismo bug, mismo motivo, que el ya corregido en
-- v_puntos_responsable_total_vida (20260825180000_fix_puntos_
-- responsable_total_vida.sql) — este quedó pendiente porque
-- v_stats_vida no depende de puntos, así que no lo tocó aquel fix.
--
-- Efecto observado: para un responsable, la parte "histórico" de
-- fuerza/resistencia siempre daba 0 (sus ciclos cerrados viven en
-- historial_ciclo_responsable, no en historial_ciclos). "Vida" acababa
-- reflejando SOLO el ciclo en vivo actual — como fuerza y resistencia
-- dentro de un único ciclo se mueven en proporciones parecidas, las
-- dos barras se veían casi iguales entre sí, como si se hubieran
-- promediado, en vez de reflejar el acumulado real de toda la vida.
--
-- Corrección: el CTE `historico` ahora une los dos orígenes —
-- historial_ciclos (operario) e historial_ciclo_responsable
-- (responsable), este último con su propio vocabulario de columnas
-- (minutos_plena/minutos_no_alimentada en vez de tiempo_plena/
-- tiempo_no_alimentada, ya documentado en 04/06). El resto de la
-- vista (vivo_operario, vivo_responsable, total, columnas finales)
-- queda IDÉNTICO a la versión de 20260823110000 — no se toca nada
-- más.
-- =============================================================

create or replace view v_stats_vida as
with historico_operario as (
  select
    usuario_id,
    rol,
    sum(m2_total)                                                        as m2_total,
    sum(coalesce(tiempo_plena, 0))                                       as tiempo_plena,
    sum(coalesce(tiempo_plena, 0) + coalesce(tiempo_no_alimentada, 0))   as minutos_rendimiento
  from historial_ciclos
  where rol = 'operario'
  group by usuario_id, rol
),
historico_responsable as (
  select
    usuario_id,
    'responsable'::text                                                   as rol,
    sum(m2_total)                                                         as m2_total,
    sum(coalesce(minutos_plena, 0))                                       as tiempo_plena,
    sum(coalesce(minutos_plena, 0) + coalesce(minutos_no_alimentada, 0))  as minutos_rendimiento
  from historial_ciclo_responsable
  group by usuario_id
),
historico as (
  select * from historico_operario
  union all
  select * from historico_responsable
),
vivo_operario as (
  select
    operario_id as usuario_id,
    'operario'  as rol,
    m2_total,
    coalesce(tiempo_plena, 0) as tiempo_plena,
    coalesce(tiempo_plena, 0) + coalesce(tiempo_no_alimentada, 0) as minutos_rendimiento
  from v_produccion_operario_ciclo
  where cycle_id = fn_ciclo_id(current_date)
),
vivo_responsable as (
  select
    m.responsable_id as usuario_id,
    'responsable'     as rol,
    m.m2_total,
    coalesce(tr.tiempo_plena, 0) as tiempo_plena,
    coalesce(tr.minutos_rendimiento, 0) as minutos_rendimiento
  from v_metros_responsable_ciclo m
  left join v_tiempo_responsable_ciclo tr
    on tr.responsable_id = m.responsable_id and tr.cycle_id = m.cycle_id
  where m.cycle_id = fn_ciclo_id(current_date)
),
vivo as (
  select * from vivo_operario
  union all
  select * from vivo_responsable
),
total as (
  select
    coalesce(h.usuario_id, v.usuario_id) as usuario_id,
    coalesce(h.rol, v.rol)               as rol,
    coalesce(h.m2_total, 0) + coalesce(v.m2_total, 0)                         as m2_total_vida,
    coalesce(h.tiempo_plena, 0) + coalesce(v.tiempo_plena, 0)                 as tiempo_plena_vida,
    coalesce(h.minutos_rendimiento, 0) + coalesce(v.minutos_rendimiento, 0)   as minutos_rendimiento_vida
  from historico h
  full outer join vivo v on v.usuario_id = h.usuario_id and v.rol = h.rol
)
select
  usuario_id,
  rol,
  round(m2_total_vida / 1000.0, 2) as fuerza,
  round(minutos_rendimiento_vida / 100.0, 2) as resistencia,
  case
    when tiempo_plena_vida > 0
      then round(m2_total_vida / tiempo_plena_vida, 4)
    else null
  end as velocidad,
  round(m2_total_vida, 2)          as m2_total_vida,
  round(tiempo_plena_vida / 60.0, 2) as horas_plena_vida
from total;

comment on view v_stats_vida is
  'Fuerza/resistencia/velocidad de toda la vida (histórico + ciclo en '
  'vivo), MÁS m2_total_vida y horas_plena_vida en crudo. Para '
  'cualquier usuario y rol. FIX 02/09/2026: el histórico de '
  'responsable ahora se lee de historial_ciclo_responsable (antes '
  'siempre daba 0 para ese rol, igual que el bug ya corregido en '
  'v_puntos_responsable_total_vida — ver 20260825180000).';
