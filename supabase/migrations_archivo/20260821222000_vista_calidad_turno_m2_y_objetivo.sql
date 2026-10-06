-- =============================================================
-- Dos añadidos para la pantalla de fábrica (rol 'pantalla', carrusel):
--
-- 1) v_calidad_turno gana m² por categoría (además de las piezas que
--    ya tenía). Hace falta multiplicar por area_m2 del formato de
--    cada parte antes de sumar — como un turno puede tener varias
--    líneas con productos/formatos distintos, no basta un único
--    area_m2 para todo el turno, se calcula parte a parte y se suma
--    (mismo patrón que v_calidad_modelo/v_calidad_lote).
--
-- 2) configuracion.objetivo_m2_dia — el objetivo diario de m² que
--    marca el 100% de la barra de "Producción del ciclo". Valor de
--    partida editable por el administrador más adelante; hoy solo
--    por SQL, igual que el resto de configuración.
-- =============================================================

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
  round(100.0 * sum(p.piezas_comercial) / nullif(sum(p.piezas_1a) + sum(p.piezas_comercial), 0), 2) as pct_comercial_oficial,

  -- NUEVO: m² por categoría, area_m2 aplicado parte a parte (no un
  -- único formato por turno, puede haber varias líneas con productos
  -- distintos). Van al FINAL a propósito: CREATE OR REPLACE VIEW
  -- solo admite añadir columnas nuevas al final, nunca insertarlas
  -- en medio de las que ya existían (error real visto al aplicar
  -- esta migración con las columnas en otro orden — corregido aquí).
  sum(p.piezas_entradas   * f.area_m2)                       as m2_entradas,
  sum(p.piezas_1a         * f.area_m2)                       as m2_1a,
  sum(p.piezas_comercial  * f.area_m2)                       as m2_comercial,
  sum(p.piezas_eco        * f.area_m2)                       as m2_eco,
  sum(p.piezas_contenedor * f.area_m2)                       as m2_contenedor

from turno t
join parte p on p.turno_id = t.id
  and p.vigente = true
  and p.completado = true
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f on f.id = pr.formato_id
group by t.id, t.fecha, t.tipo;

comment on view v_calidad_turno is
  'Calidad agregada por turno+fecha, con piezas Y m² por categoría. '
  'm² calculado parte a parte (join a formato) antes de sumar, porque '
  'un turno puede tener varias líneas con productos/formatos '
  'distintos. Eje CALIDAD independiente de producción.';

-- -------------------------------------------------------------
-- Objetivo diario de m² — usado por la barra de "Producción del
-- ciclo" en la pantalla de fábrica. Valor de partida: 35.000 (el
-- mismo que se veía en v2) — ajustable después desde el panel de
-- administrador cuando se construya esa pieza, hoy solo por SQL.
-- -------------------------------------------------------------
insert into configuracion (clave, valor, nota)
values ('objetivo_m2_dia', '35000', 'Objetivo diario de m² — marca el 100% de la barra de Producción del ciclo en la pantalla de fábrica.')
on conflict (clave) do nothing;