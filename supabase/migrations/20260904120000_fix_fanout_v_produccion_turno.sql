-- =============================================================
-- Fix: v_produccion_turno inflaba rendimiento_denominador (y
-- rendimiento_numerador) cuando una línea tenía MÁS DE UN parte en
-- el mismo turno.
--
-- CAUSA (detectada 04/09/2026, sesión de depuración con datos reales
-- del turno M del 2026-09-03):
--
-- La versión anterior calculaba `rendimiento_por_linea` como una CTE
-- agregada por (turno_id, linea_id) -- una fila por línea -- pero
-- luego la unía (JOIN) directamente contra las filas de `parte` SIN
-- agregar todavía. Si una línea tenía 2 partes en el turno, esa unión
-- generaba 2 filas con el MISMO valor de denominador/numerador de esa
-- línea (fan-out). Al agrupar después por turno con sum(rpl.numerador)
-- / sum(rpl.denominador), ese valor se contaba una vez por cada parte
-- de la línea, no una vez por línea.
--
-- Comprobado con datos reales: turno M 2026-09-03, línea 5 con 2
-- partes (los otros 5 partes eran de líneas con 1 parte cada una).
-- Denominador correcto (sumado a mano por línea): 2.881.
-- Denominador que devolvía el sistema: 3.361.
-- Diferencia: 480 -- exactamente el denominador de la línea 5 (la
-- única con 2 partes), contado una vez de más por el fan-out del JOIN.
--
-- SOLUCIÓN: agregar `rendimiento_por_linea` a nivel de TURNO en una
-- segunda CTE (`rendimiento_por_turno`, una fila por turno) ANTES de
-- unirla con `parte` -- así no hay fan-out posible, sea cual sea el
-- número de partes por línea.
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
),
-- NUEVO: agregado por TURNO (una sola fila por turno). Al unir esto
-- con `parte` más abajo, cada parte del turno se une contra la MISMA
-- fila (una por turno) -- no puede haber fan-out por número de partes
-- dentro de una línea, a diferencia de unir directamente contra
-- rendimiento_por_linea (una fila por línea, se duplicaba por parte).
rendimiento_por_turno as (
  select
    turno_id,
    sum(numerador)   as rendimiento_numerador,
    sum(denominador) as rendimiento_denominador
  from rendimiento_por_linea
  group by turno_id
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

  round(
    100.0 * rpt.rendimiento_numerador / nullif(rpt.rendimiento_denominador, 0)
  , 2)                                                   as pct_rendimiento,

  -- Crudos, para agregar correctamente entre varios turnos (semana,
  -- mes) sin promediar porcentajes ya redondeados -- ya vienen
  -- correctos desde rendimiento_por_turno, sin fan-out.
  rpt.rendimiento_numerador,
  rpt.rendimiento_denominador

from turno t
join parte p on p.turno_id = t.id
  and p.vigente = true
  and p.completado = true
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f on f.id = pr.formato_id
join rendimiento_por_turno rpt on rpt.turno_id = t.id
group by t.id, t.fecha, t.tipo, t.cerrado_at, rpt.rendimiento_numerador, rpt.rendimiento_denominador;

comment on view v_produccion_turno is
  'Producción agregada por turno completo. rendimiento_numerador/'
  'rendimiento_denominador se calculan en la CTE rendimiento_por_turno '
  '(agregada por TURNO, una fila por turno) antes de unirse con las '
  'filas de parte -- evita el bug de fan-out corregido 04/09/2026: '
  'antes se unía directamente contra rendimiento_por_linea (una fila '
  'por línea), y una línea con varios partes en el turno duplicaba su '
  'numerador/denominador una vez por cada parte extra. Eje de '
  'PRODUCCIÓN: no incluye calidad (1ª/comercial/etc) -- ver '
  'v_calidad_turno para eso, con fecha para poder cruzarlas.';
