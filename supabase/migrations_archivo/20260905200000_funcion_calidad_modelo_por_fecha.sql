-- =============================================================
-- calidad_modelo_por_fecha: mismo patrón que calidad_lote_por_fecha
-- (sesión 05/09/2026), pero agregando por producto (modelo+marca+
-- formato) en vez de por lote. v_calidad_modelo es histórico
-- completo sin fecha por diseño; esta función cubre el caso de
-- "calidad de BALI ROCK esta semana" sin que el modelo tenga que
-- sumar filas de get_partes a mano.
-- =============================================================

create or replace function calidad_modelo_por_fecha(
  p_fecha_desde date,
  p_fecha_hasta date default null,
  p_nombre_modelo text default null,
  p_formato text default null
)
returns table (
  producto_id uuid,
  modelo_nombre text,
  marca_nombre text,
  formato_nombre text,
  partes_analizados bigint,
  lotes_distintos bigint,
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
    pr.id                                                       as producto_id,
    m.nombre                                                    as modelo_nombre,
    ma.nombre                                                   as marca_nombre,
    f.nombre                                                    as formato_nombre,

    count(distinct p.id)                                        as partes_analizados,
    count(distinct p.lote_id)                                   as lotes_distintos,

    sum(p.piezas_entradas)                                      as piezas_entradas,
    sum(p.piezas_1a)                                            as piezas_1a,
    sum(p.piezas_comercial)                                     as piezas_comercial,
    sum(p.piezas_eco)                                           as piezas_eco,
    sum(p.piezas_contenedor)                                    as piezas_contenedor,

    sum(p.piezas_1a)         * f.area_m2                        as m2_1a,
    sum(p.piezas_comercial)  * f.area_m2                        as m2_comercial,
    sum(p.piezas_eco)        * f.area_m2                        as m2_eco,
    sum(p.piezas_contenedor) * f.area_m2                        as m2_contenedor,
    sum(p.piezas_entradas)   * f.area_m2                        as m2_total,

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
    and (p_nombre_modelo is null or m.nombre ilike '%' || p_nombre_modelo || '%')
    and (p_formato is null or f.nombre = p_formato)
  group by pr.id, m.nombre, ma.nombre, f.nombre, f.area_m2
  order by sum(p.piezas_entradas) desc nulls last;
$$;

comment on function calidad_modelo_por_fecha is
  'Calidad por modelo/producto filtrando con precisión por '
  'turno.fecha. Para consultas históricas sin fecha, seguir usando '
  'v_calidad_modelo tal cual.';
