-- =============================================================
-- Vistas de CALIDAD — eje independiente de producción (nunca se
-- mezclan, decisión de sesión: una incidencia de calidad no afecta
-- a producción y viceversa). Jerarquía: modelo/producto -> lote ->
-- parte. Todo agregado en SQL (SUM), nunca en el cliente ni por un
-- modelo de IA — evita el error de que alguien (persona o LLM) sume
-- mal una tabla larga.
--
-- Dos métricas de calidad, ambas expuestas siempre juntas para que
-- Ceria y el dashboard nunca las confundan:
--   - COMPLETA: 1ª/comercial/eco/contenedor, cada una sobre el total
--     de piezas_entradas. Es la foto real de todo lo que entró.
--   - OFICIAL (métrica empresa): 1ª/comercial recalculadas SOLO
--     entre ellas dos (eco y contenedor fuera del cálculo, se tratan
--     como descarte). eco hoy siempre es 0 en la práctica pero se
--     excluye igual si algún día aparece.
--
-- Solo partes vigentes y completados cuentan (mismo filtro que
-- operario_ledger y el resto de vistas de cálculo del proyecto).
-- =============================================================

-- -------------------------------------------------------------
-- v_calidad_modelo — histórico COMPLETO agregado por producto
-- (modelo + marca + formato). Sin filtro de fecha: quien consulte
-- puede acotar por fecha uniéndose a turno si hace falta, pero el
-- uso principal ("¿cuánto BALI ROCK se ha producido en total y con
-- qué calidad?") es histórico por diseño.
-- -------------------------------------------------------------
create or replace view v_calidad_modelo as
select
  pr.id                                                    as producto_id,
  m.nombre                                                 as modelo_nombre,
  ma.nombre                                                 as marca_nombre,
  f.nombre                                                  as formato_nombre,

  count(distinct p.id)                                      as partes_analizados,
  count(distinct p.lote_id)                                 as lotes_distintos,

  sum(p.piezas_entradas)                                    as piezas_entradas,
  sum(p.piezas_1a)                                          as piezas_1a,
  sum(p.piezas_comercial)                                   as piezas_comercial,
  sum(p.piezas_eco)                                         as piezas_eco,
  sum(p.piezas_contenedor)                                  as piezas_contenedor,

  sum(p.piezas_1a)         * f.area_m2                      as m2_1a,
  sum(p.piezas_comercial)  * f.area_m2                      as m2_comercial,
  sum(p.piezas_eco)        * f.area_m2                      as m2_eco,
  sum(p.piezas_contenedor) * f.area_m2                      as m2_contenedor,
  sum(p.piezas_entradas)   * f.area_m2                      as m2_total,

  -- Calidad COMPLETA: cada categoría sobre el total de entradas
  round(100.0 * sum(p.piezas_1a)         / nullif(sum(p.piezas_entradas), 0), 2) as pct_1a_completa,
  round(100.0 * sum(p.piezas_comercial)  / nullif(sum(p.piezas_entradas), 0), 2) as pct_comercial_completa,
  round(100.0 * sum(p.piezas_eco)        / nullif(sum(p.piezas_entradas), 0), 2) as pct_eco_completa,
  round(100.0 * sum(p.piezas_contenedor) / nullif(sum(p.piezas_entradas), 0), 2) as pct_contenedor_completa,

  -- Calidad OFICIAL: solo 1ª y comercial, recalculadas entre sí
  -- (eco y contenedor excluidos del denominador)
  round(100.0 * sum(p.piezas_1a)        / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_1a_oficial,
  round(100.0 * sum(p.piezas_comercial) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_comercial_oficial,

  min(t.fecha) as primera_produccion,
  max(t.fecha) as ultima_produccion

from parte p
join turno t on t.id = p.turno_id
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join modelo m on m.id = pr.modelo_id
join marca ma on ma.id = pr.marca_id
join formato f on f.id = pr.formato_id
where p.vigente = true
  and p.completado = true
group by pr.id, m.nombre, ma.nombre, f.nombre, f.area_m2;

comment on view v_calidad_modelo is
  'Calidad histórica agregada por producto (modelo+marca+formato). '
  'Completa = sobre piezas_entradas; Oficial = solo 1ª+comercial '
  'entre sí (eco/contenedor excluidos). Solo partes vigentes y '
  'completados. Todo sumado en SQL — nunca sumar filas manualmente.';

-- -------------------------------------------------------------
-- v_calidad_lote — mismo cálculo, agregado por lote (numero_orden)
-- en vez de por producto. Para "¿cómo va la orden 12345?".
-- -------------------------------------------------------------
create or replace view v_calidad_lote as
select
  lo.id                                                     as lote_id,
  lo.numero_orden,
  lo.estado                                                 as lote_estado,
  m.nombre                                                  as modelo_nombre,
  ma.nombre                                                 as marca_nombre,
  f.nombre                                                  as formato_nombre,

  count(distinct p.id)                                      as partes_analizados,

  sum(p.piezas_entradas)                                    as piezas_entradas,
  sum(p.piezas_1a)                                          as piezas_1a,
  sum(p.piezas_comercial)                                   as piezas_comercial,
  sum(p.piezas_eco)                                         as piezas_eco,
  sum(p.piezas_contenedor)                                  as piezas_contenedor,

  sum(p.piezas_1a)         * f.area_m2                      as m2_1a,
  sum(p.piezas_comercial)  * f.area_m2                      as m2_comercial,
  sum(p.piezas_eco)        * f.area_m2                      as m2_eco,
  sum(p.piezas_contenedor) * f.area_m2                      as m2_contenedor,
  sum(p.piezas_entradas)   * f.area_m2                      as m2_total,

  round(100.0 * sum(p.piezas_1a)         / nullif(sum(p.piezas_entradas), 0), 2) as pct_1a_completa,
  round(100.0 * sum(p.piezas_comercial)  / nullif(sum(p.piezas_entradas), 0), 2) as pct_comercial_completa,
  round(100.0 * sum(p.piezas_eco)        / nullif(sum(p.piezas_entradas), 0), 2) as pct_eco_completa,
  round(100.0 * sum(p.piezas_contenedor) / nullif(sum(p.piezas_entradas), 0), 2) as pct_contenedor_completa,

  round(100.0 * sum(p.piezas_1a)        / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_1a_oficial,
  round(100.0 * sum(p.piezas_comercial) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_comercial_oficial,

  min(t.fecha) as primera_produccion,
  max(t.fecha) as ultima_produccion

from parte p
join turno t on t.id = p.turno_id
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join modelo m on m.id = pr.modelo_id
join marca ma on ma.id = pr.marca_id
join formato f on f.id = pr.formato_id
where p.vigente = true
  and p.completado = true
group by lo.id, lo.numero_orden, lo.estado, m.nombre, ma.nombre, f.nombre, f.area_m2;

comment on view v_calidad_lote is
  'Calidad agregada por lote (numero_orden). Mismas dos métricas '
  '(completa/oficial) que v_calidad_modelo, a nivel de una orden '
  'concreta en vez de todo el histórico del producto.';