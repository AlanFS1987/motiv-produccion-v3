create or replace view v_puntos_operario_ciclo as
select vp.operario_id, vp.cycle_id, vp.puntos_ciclo, u.username,
       vp.puntos_piezas, vp.puntos_rendimiento, vp.puntos_limpieza
from (
  select operario_id, cycle_id,
         sum(pr) + sum(pi) + sum(pl) as puntos_ciclo,
         sum(pi) as puntos_piezas,
         sum(pr) as puntos_rendimiento,
         sum(pl) as puntos_limpieza
  from (
    select operario_id, cycle_id, puntos_rendimiento_ciclo as pr, 0 as pi, 0 as pl
      from v_puntos_rendimiento_operario_ciclo
    union all
    select operario_id, cycle_id, 0, puntos_piezas_ciclo, 0
      from v_puntos_piezas_operario_ciclo
    union all
    select operario_id, cycle_id, 0, 0, puntos_limpieza_ciclo
      from v_puntos_limpieza_operario_ciclo
  ) x
  group by operario_id, cycle_id
) vp
join usuario u on u.id = vp.operario_id;

comment on view v_puntos_operario_ciclo is
  'Puntos totales del operario (rendimiento+piezas+limpieza) por ciclo, con desglose por categoria y username horneado (PostgREST no resuelve embeds sobre vistas con UNION). Repone las columnas de desglose que 20260824130000 dejo fuera.';
