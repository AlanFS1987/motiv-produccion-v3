-- =============================================================
-- Dos añadidos para el dashboard del jefe (Vista Rápida):
--
-- 1) v_produccion_turno gana dos columnas crudas (numerador y
--    denominador del % de rendimiento, ya con el suelo de 480 min
--    aplicado por línea). Sin esto, para calcular el % de una semana
--    completa habría que promediar los % ya redondeados de cada
--    turno — el mismo tipo de error que el suelo de 480 min evita a
--    nivel de línea. Con numerador/denominador crudos, cualquier
--    agregación posterior (semana, mes) sigue siendo un SUM/SUM
--    correcto, nunca un promedio de porcentajes.
--
-- 2) v_calidad_turno — NUEVA. Las vistas de calidad que ya existían
--    (v_calidad_modelo, v_calidad_lote) agregan por producto/lote sin
--    fecha — pensadas para Ceria ("¿cuánto se ha producido en total
--    de X?"). El dashboard necesita lo contrario: calidad agregada
--    POR TURNO/FECHA, para poder cruzarla en el tiempo con
--    v_produccion_turno (misma clave fecha+tipo_turno en ambas).
--    Sigue siendo un eje separado de producción — se cruza solo por
--    fecha para pintarlos en el mismo periodo, nunca se mezclan sus
--    columnas ni se implica causalidad entre ellas.
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
  sum(p.minutos_no_alimentada)                           as minutos_no_alimentada,
  sum(p.minutos_saturacion)                             as minutos_saturacion,
  sum(p.minutos_banco)                                  as minutos_banco,
  sum(p.minutos_maquina)                                as minutos_maquina,

  round(
    100.0 * sum(rpl.numerador) / nullif(sum(rpl.denominador), 0)
  , 2)                                                   as pct_rendimiento,

  -- NUEVO: crudos, para agregar correctamente entre varios turnos
  -- (semana/mes) sin promediar porcentajes ya redondeados.
  sum(rpl.numerador)                                    as rendimiento_numerador,
  sum(rpl.denominador)                                  as rendimiento_denominador

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
  'Producción agregada por turno completo. pct_rendimiento ya viene '
  'resuelto; rendimiento_numerador/rendimiento_denominador se exponen '
  'crudos para que quien agregue varios turnos (semana, mes) haga '
  'SUM(numerador)/SUM(denominador) en vez de promediar porcentajes ya '
  'redondeados. Eje de PRODUCCIÓN: no incluye calidad (1ª/comercial/'
  'etc) — ver v_calidad_turno para eso, con fecha para poder cruzarlas.';

-- -------------------------------------------------------------
-- v_calidad_turno — calidad agregada por turno+fecha (mismo par de
-- claves que v_produccion_turno: fecha, tipo_turno), para el
-- dashboard. Mismas dos métricas que las otras vistas de calidad
-- (completa/oficial).
-- -------------------------------------------------------------
create or replace view v_calidad_turno as
select
  t.id                                                       as turno_id,
  t.fecha,
  t.tipo                                                     as tipo_turno,

  sum(p.piezas_entradas)                                     as piezas_entradas,
  sum(p.piezas_1a)                                           as piezas_1a,
  sum(p.piezas_comercial)                                    as piezas_comercial,
  sum(p.piezas_eco)                                          as piezas_eco,
  sum(p.piezas_contenedor)                                   as piezas_contenedor,

  round(100.0 * sum(p.piezas_1a)         / nullif(sum(p.piezas_entradas), 0), 2) as pct_1a_completa,
  round(100.0 * sum(p.piezas_comercial)  / nullif(sum(p.piezas_entradas), 0), 2) as pct_comercial_completa,
  round(100.0 * sum(p.piezas_eco)        / nullif(sum(p.piezas_entradas), 0), 2) as pct_eco_completa,
  round(100.0 * sum(p.piezas_contenedor) / nullif(sum(p.piezas_entradas), 0), 2) as pct_contenedor_completa,

  round(100.0 * sum(p.piezas_1a)        / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_1a_oficial,
  round(100.0 * sum(p.piezas_comercial) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_comercial_oficial

from turno t
join parte p on p.turno_id = t.id
  and p.vigente = true
  and p.completado = true
group by t.id, t.fecha, t.tipo;

comment on view v_calidad_turno is
  'Calidad agregada por turno+fecha (mismas claves que '
  'v_produccion_turno, para cruzarlas en el dashboard por periodo). '
  'Eje CALIDAD independiente — se cruza con producción solo por '
  'fecha/turno para pintarlas juntas, nunca se mezclan sus columnas '
  'ni se implica causalidad entre ellas.';