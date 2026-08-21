-- =============================================================
-- v_produccion_turno — eje PRODUCCIÓN, nunca mezclado con calidad
-- (decisión de sesión: incidencia de producción no afecta calidad y
-- viceversa; por eso esta vista no toca piezas_1a/comercial/etc.,
-- solo piezas_entradas como magnitud de cantidad total).
--
-- Agregado por turno COMPLETO (todas las líneas juntas). El % de
-- rendimiento respeta el mismo criterio que v_rendimiento_linea_
-- turno: el suelo de 480 min se aplica POR LÍNEA, nunca al turno
-- entero de golpe — si no, un turno con varias líneas casi paradas
-- podría salir con un % inflado al compartir denominador. Por eso
-- se agrega primero por línea (CTE rendimiento_por_linea) y luego se
-- suman numeradores y denominadores ya calculados, no los minutos
-- crudos.
--
-- Solo partes vigentes y completados (mismo criterio que el resto
-- del proyecto — operario_ledger, v_rendimiento_linea_turno, etc.).
-- =============================================================

create or replace view v_produccion_turno as
with rendimiento_por_linea as (
  select
    p.turno_id,
    p.linea_id,
    sum(p.minutos_total)                                as suma_reportada,
    greatest(480, sum(p.minutos_total))                 as denominador,
    sum(p.minutos_plena + p.minutos_no_alimentada)      as numerador
  from parte p
  where p.vigente = true
    and p.completado = true
  group by p.turno_id, p.linea_id
)
select
  t.id                                                  as turno_id,
  t.fecha,
  t.tipo                                                as tipo_turno,
  t.cerrado_at is not null                              as cerrado,

  count(distinct p.linea_id)                            as lineas_activas,
  count(distinct p.lote_id)                             as lotes_distintos,
  count(p.id)                                            as partes_analizados,

  sum(p.piezas_entradas)                                as piezas_total,
  sum(p.piezas_entradas * f.area_m2)                    as m2_total,

  sum(p.minutos_total)                                  as minutos_total,
  sum(p.minutos_plena)                                  as minutos_plena,
  sum(p.minutos_no_alimentada)                          as minutos_no_alimentada,
  sum(p.minutos_saturacion)                             as minutos_saturacion,
  sum(p.minutos_banco)                                  as minutos_banco,
  sum(p.minutos_maquina)                                as minutos_maquina,

  -- % rendimiento del turno = suma de numeradores/denominadores YA
  -- calculados por línea (cada uno con su suelo de 480 propio), no
  -- un suelo único sobre la suma cruda de minutos del turno entero.
  round(
    100.0 * sum(rpl.numerador) / nullif(sum(rpl.denominador), 0)
  , 2)                                                   as pct_rendimiento

from turno t
join parte p on p.turno_id = t.id
  and p.vigente = true
  and p.completado = true
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f on f.id = pr.formato_id
join rendimiento_por_linea rpl
  on rpl.turno_id = t.id and rpl.linea_id = p.linea_id
group by t.id, t.fecha, t.tipo, t.cerrado_at;

comment on view v_produccion_turno is
  'Producción agregada por turno completo: m² (vía formato.area_m2), '
  'piezas, tiempos de máquina y % de rendimiento. El % respeta el '
  'suelo de 480 min POR LÍNEA (igual que v_rendimiento_linea_turno) '
  'antes de sumar entre líneas — nunca un suelo único al turno. Solo '
  'partes vigentes y completados. Eje de PRODUCCIÓN: no incluye '
  'piezas_1a/comercial/eco/contenedor (eso es calidad, ver '
  'v_calidad_modelo/v_calidad_lote) — los dos ejes nunca se mezclan.';