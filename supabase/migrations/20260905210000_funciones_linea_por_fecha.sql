-- =============================================================
-- produccion_linea_por_fecha / calidad_linea_por_fecha
--
-- Última pieza del mapa de huecos de sesión 04-05/09/2026: no existía
-- ninguna forma de comparar una línea consigo misma entre dos rangos
-- de fechas (p.ej. "línea 3 esta semana vs línea 3 semana pasada")
-- sin que el modelo tuviera que sumar get_partes a mano.
--
-- Devuelven UNA fila por línea, con TODO el rango de fechas ya sumado
-- (no una fila por turno) — para comparar dos periodos, se llama dos
-- veces con rangos distintos, no hace falta que la función compare.
--
-- produccion_linea_por_fecha respeta el mismo criterio de suelo que
-- v_produccion_turno: el suelo de 480 min se aplica POR TURNO+LÍNEA
-- (CTE por_turno_linea) ANTES de sumar entre turnos — si se sumaran
-- los minutos crudos de golpe sin este paso intermedio, una línea con
-- muchos turnos de poca actividad saldría con el suelo mal aplicado
-- (mismo tipo de fallo que el bug de v_produccion_turno de esta
-- mañana, evitado aquí desde el diseño).
-- =============================================================

create or replace function produccion_linea_por_fecha(
  p_fecha_desde date,
  p_fecha_hasta date default null,
  p_linea_nombre text default null
)
returns table (
  linea_id uuid,
  linea_nombre text,
  turnos_analizados bigint,
  partes_analizados bigint,
  piezas_total bigint,
  m2_total numeric,
  minutos_total bigint,
  minutos_plena bigint,
  minutos_no_alimentada bigint,
  minutos_saturacion bigint,
  minutos_banco bigint,
  minutos_maquina bigint,
  pct_rendimiento numeric,
  rendimiento_numerador bigint,
  rendimiento_denominador bigint,
  primera_fecha_en_rango date,
  ultima_fecha_en_rango date
)
language sql
stable
as $$
  with por_turno_linea as (
    select
      p.linea_id,
      p.turno_id,
      t.fecha,
      sum(p.minutos_total)                                as suma_reportada,
      greatest(480, sum(p.minutos_total))                 as denominador,
      sum(p.minutos_plena + p.minutos_no_alimentada)      as numerador,
      sum(p.piezas_entradas)                              as piezas,
      sum(p.piezas_entradas * f.area_m2)                  as m2,
      sum(p.minutos_plena)                                as minutos_plena,
      sum(p.minutos_no_alimentada)                        as minutos_no_alimentada,
      sum(p.minutos_saturacion)                           as minutos_saturacion,
      sum(p.minutos_banco)                                as minutos_banco,
      sum(p.minutos_maquina)                              as minutos_maquina,
      count(p.id)                                         as partes
    from parte p
    join turno t on t.id = p.turno_id
    join lote lo on lo.id = p.lote_id
    join producto pr on pr.id = lo.producto_id
    join formato f on f.id = pr.formato_id
    where p.vigente = true
      and p.completado = true
      and t.fecha >= p_fecha_desde
      and t.fecha <= coalesce(p_fecha_hasta, p_fecha_desde)
    group by p.linea_id, p.turno_id, t.fecha
  )
  select
    ptl.linea_id,
    l.nombre                                            as linea_nombre,
    count(distinct ptl.turno_id)                        as turnos_analizados,
    sum(ptl.partes)                                      as partes_analizados,
    sum(ptl.piezas)                                      as piezas_total,
    sum(ptl.m2)                                          as m2_total,
    sum(ptl.suma_reportada)                              as minutos_total,
    sum(ptl.minutos_plena)                               as minutos_plena,
    sum(ptl.minutos_no_alimentada)                       as minutos_no_alimentada,
    sum(ptl.minutos_saturacion)                          as minutos_saturacion,
    sum(ptl.minutos_banco)                               as minutos_banco,
    sum(ptl.minutos_maquina)                             as minutos_maquina,
    round(100.0 * sum(ptl.numerador) / nullif(sum(ptl.denominador), 0), 2) as pct_rendimiento,
    sum(ptl.numerador)                                   as rendimiento_numerador,
    sum(ptl.denominador)                                 as rendimiento_denominador,
    min(ptl.fecha)                                       as primera_fecha_en_rango,
    max(ptl.fecha)                                       as ultima_fecha_en_rango
  from por_turno_linea ptl
  join linea l on l.id = ptl.linea_id
  where p_linea_nombre is null or l.nombre ilike '%' || p_linea_nombre || '%'
  group by ptl.linea_id, l.nombre
  order by sum(ptl.piezas) desc nulls last;
$$;

comment on function produccion_linea_por_fecha is
  'Producción agregada por línea, sumando TODO el rango de fechas '
  'en una sola fila (no por turno). Para comparar dos periodos de '
  'la misma línea, llamar dos veces con rangos distintos. Eje '
  'PRODUCCIÓN — sin columnas de calidad, ver calidad_linea_por_fecha.';

-- -------------------------------------------------------------
-- calidad_linea_por_fecha — mismo planteamiento, eje calidad. No
-- necesita CTE intermedia (sin suelo/greatest que aplicar antes de
-- sumar), solo sumas directas.
-- -------------------------------------------------------------
create or replace function calidad_linea_por_fecha(
  p_fecha_desde date,
  p_fecha_hasta date default null,
  p_linea_nombre text default null
)
returns table (
  linea_id uuid,
  linea_nombre text,
  partes_analizados bigint,
  piezas_entradas bigint,
  piezas_1a bigint,
  piezas_comercial bigint,
  piezas_eco bigint,
  piezas_contenedor bigint,
  pct_1a_completa numeric,
  pct_comercial_completa numeric,
  pct_eco_completa numeric,
  pct_contenedor_completa numeric,
  pct_1a_oficial numeric,
  pct_comercial_oficial numeric,
  primera_fecha_en_rango date,
  ultima_fecha_en_rango date
)
language sql
stable
as $$
  select
    p.linea_id,
    l.nombre                                                    as linea_nombre,
    count(p.id)                                                 as partes_analizados,
    sum(p.piezas_entradas)                                      as piezas_entradas,
    sum(p.piezas_1a)                                            as piezas_1a,
    sum(p.piezas_comercial)                                     as piezas_comercial,
    sum(p.piezas_eco)                                           as piezas_eco,
    sum(p.piezas_contenedor)                                    as piezas_contenedor,
    round(100.0 * sum(p.piezas_1a)         / nullif(sum(p.piezas_entradas), 0), 2) as pct_1a_completa,
    round(100.0 * sum(p.piezas_comercial)  / nullif(sum(p.piezas_entradas), 0), 2) as pct_comercial_completa,
    round(100.0 * sum(p.piezas_eco)        / nullif(sum(p.piezas_entradas), 0), 2) as pct_eco_completa,
    round(100.0 * sum(p.piezas_contenedor) / nullif(sum(p.piezas_entradas), 0), 2) as pct_contenedor_completa,
    round(100.0 * sum(p.piezas_1a)        / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_1a_oficial,
    round(100.0 * sum(p.piezas_comercial) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_comercial_oficial,
    min(t.fecha) as primera_fecha_en_rango,
    max(t.fecha) as ultima_fecha_en_rango
  from parte p
  join turno t on t.id = p.turno_id
  join linea l on l.id = p.linea_id
  where p.vigente = true
    and p.completado = true
    and t.fecha >= p_fecha_desde
    and t.fecha <= coalesce(p_fecha_hasta, p_fecha_desde)
    and (p_linea_nombre is null or l.nombre ilike '%' || p_linea_nombre || '%')
  group by p.linea_id, l.nombre
  order by sum(p.piezas_entradas) desc nulls last;
$$;

comment on function calidad_linea_por_fecha is
  'Calidad agregada por línea, sumando TODO el rango de fechas en '
  'una sola fila (no por turno). Eje CALIDAD — sin tiempos ni '
  'rendimiento, ver produccion_linea_por_fecha.';
