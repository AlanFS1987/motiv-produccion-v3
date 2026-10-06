-- =============================================================
-- calidad_lote_por_fecha: agrega calidad por lote, filtrando con
-- PRECISIÓN por fecha (turno.fecha de cada parte), a diferencia de
-- v_calidad_lote que solo tiene primera_produccion/ultima_produccion
-- (rango aproximado de vida del lote, ya señalado como limitación
-- conocida en memorias/14-calidad.md).
--
-- Se hace como FUNCIÓN, no como vista, porque una vista no admite
-- parámetros — y este filtro de fecha necesita ser un parámetro real
-- (fecha_desde/fecha_hasta), no una columna fija.
--
-- Motivo (sesión 05/09/2026): al pedirle a Ceria "calidad por lote
-- del martes", como no existía ningún tool/vista que ya sumara por
-- lote+fecha, el propio modelo tenía que sumar las filas de
-- get_partes a mano -- y en un experimento con 7 modelos distintos,
-- solo 1 de 5 que intentaron agrupar acertó las piezas de los 10
-- lotes; los demás fallaron por hasta 13.000 piezas en un solo lote.
-- Esta función cierra ese hueco: Postgres suma, nunca el modelo.
--
-- security invoker (por defecto) -- respeta el RLS de quien llama,
-- igual que si consultara las tablas directamente. No es
-- security definer.
-- =============================================================

create or replace function calidad_lote_por_fecha(
  p_fecha_desde date,
  p_fecha_hasta date default null,
  p_numero_orden text default null,
  p_orden_calidad text default 'mejor_primero'
)
returns table (
  lote_id uuid,
  numero_orden text,
  lote_estado text,
  modelo_nombre text,
  marca_nombre text,
  formato_nombre text,
  partes_analizados bigint,
  piezas_entradas bigint,
  piezas_1a bigint,
  piezas_comercial bigint,
  piezas_eco bigint,
  piezas_contenedor bigint,
  m2_1a numeric,
  m2_comercial numeric,
  m2_eco numeric,
  m2_contenedor numeric,
  m2_total numeric,
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
    lo.id                                                      as lote_id,
    lo.numero_orden,
    lo.estado                                                  as lote_estado,
    m.nombre                                                   as modelo_nombre,
    ma.nombre                                                  as marca_nombre,
    f.nombre                                                   as formato_nombre,

    count(distinct p.id)                                       as partes_analizados,

    sum(p.piezas_entradas)                                     as piezas_entradas,
    sum(p.piezas_1a)                                           as piezas_1a,
    sum(p.piezas_comercial)                                    as piezas_comercial,
    sum(p.piezas_eco)                                          as piezas_eco,
    sum(p.piezas_contenedor)                                   as piezas_contenedor,

    sum(p.piezas_1a)         * f.area_m2                       as m2_1a,
    sum(p.piezas_comercial)  * f.area_m2                       as m2_comercial,
    sum(p.piezas_eco)        * f.area_m2                       as m2_eco,
    sum(p.piezas_contenedor) * f.area_m2                       as m2_contenedor,
    sum(p.piezas_entradas)   * f.area_m2                       as m2_total,

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
  join lote lo on lo.id = p.lote_id
  join producto pr on pr.id = lo.producto_id
  join modelo m on m.id = pr.modelo_id
  join marca ma on ma.id = pr.marca_id
  join formato f on f.id = pr.formato_id
  where p.vigente = true
    and p.completado = true
    and t.fecha >= p_fecha_desde
    and t.fecha <= coalesce(p_fecha_hasta, p_fecha_desde)
    and (p_numero_orden is null or lo.numero_orden ilike '%' || p_numero_orden || '%')
  group by lo.id, lo.numero_orden, lo.estado, m.nombre, ma.nombre, f.nombre, f.area_m2
  order by
    case when p_orden_calidad = 'peor_primero'
      then round(100.0 * sum(p.piezas_1a) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2)
    end asc nulls last,
    case when p_orden_calidad = 'peor_primero' then null
      else round(100.0 * sum(p.piezas_1a) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2)
    end desc nulls last;
$$;

comment on function calidad_lote_por_fecha is
  'Calidad por lote filtrando con precisión por turno.fecha (no por '
  'primera_produccion/ultima_produccion aproximadas de v_calidad_lote). '
  'Usar cuando la pregunta incluye un rango de fechas; para consultas '
  'históricas sin fecha, seguir usando v_calidad_lote tal cual.';
