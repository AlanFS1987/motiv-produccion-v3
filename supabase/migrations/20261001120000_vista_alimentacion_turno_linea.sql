-- =============================================================
-- v_alimentacion_turno_linea — datos para la vista "Alimentación"
-- (rendimiento vs velocidad de alimentación), sesión 01/10/2026.
--
-- Una fila por turno + línea (todos los partes vigentes y
-- completados de esa línea en ese turno, sumados). Eje de PRODUCCIÓN:
-- no incluye calidad (1ª/comercial/eco/contenedor) — misma regla que
-- v_produccion_turno.
--
-- Métricas (todas con MINUTOS REALES, sin el suelo de 480 min que usa
-- el % de rendimiento oficial: aquí un turno corto no debe salir
-- penalizado, lo que se estudia es la relación velocidad / tiempo a
-- plena, no el cumplimiento del turno):
--   piezas_min_plena = piezas_entradas / minutos_plena
--       (velocidad a la que trabaja la línea cuando está a plena;
--        se usa como "consigna efectiva" — es lo que la máquina
--        CONSIGUE, no lo que se le pidió: la consigna real no se
--        captura, decisión de sesión)
--   piezas_min_turno = piezas_entradas / minutos_total
--   pct_plena        = 100 * minutos_plena / minutos_total
--       (OJO: NO es pct_rendimiento — aquel suma también
--        minutos_no_alimentada y aplica el suelo de 480)
--
-- Para agregar varios turnos (día, semana) hay que SUMAR piezas y
-- minutos y dividir al final — nunca promediar los cocientes de esta
-- vista. Por eso se exponen también las sumas crudas.
--
-- Formato: un turno+línea puede tener partes de formatos distintos
-- (poco habitual). `formatos` lista los distintos y
-- `formatos_distintos` los cuenta: la pantalla solo usa los turnos
-- con formatos_distintos = 1 (si no, no se sabe a qué formato
-- atribuir los minutos) y cuenta aparte los excluidos por mezcla.
--
-- Sin RLS propia, mismo patrón que v_produccion_turno (hereda de las
-- tablas base / acceso por rol en el frontend).
-- =============================================================

create or replace view v_alimentacion_turno_linea as
select
  t.id                                                      as turno_id,
  t.fecha,
  t.tipo                                                    as tipo_turno,
  p.linea_id,
  l.nombre                                                  as linea_nombre,

  array_agg(distinct f.nombre order by f.nombre)            as formatos,
  count(distinct f.id)                                      as formatos_distintos,
  count(p.id)                                               as partes_analizados,

  sum(p.piezas_entradas)                                    as piezas_total,

  sum(p.minutos_total)                                      as minutos_total,
  sum(p.minutos_plena)                                      as minutos_plena,
  sum(p.minutos_no_alimentada)                              as minutos_no_alimentada,
  sum(p.minutos_saturacion)                                 as minutos_saturacion,
  sum(p.minutos_banco)                                      as minutos_banco,
  sum(p.minutos_maquina)                                    as minutos_maquina,

  round(sum(p.piezas_entradas)::numeric
        / nullif(sum(p.minutos_plena), 0), 2)               as piezas_min_plena,
  round(sum(p.piezas_entradas)::numeric
        / nullif(sum(p.minutos_total), 0), 2)               as piezas_min_turno,
  round(100.0 * sum(p.minutos_plena)
        / nullif(sum(p.minutos_total), 0), 2)               as pct_plena

from turno t
join parte p on p.turno_id = t.id
  and p.vigente = true
  and p.completado = true
join linea l on l.id = p.linea_id
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f on f.id = pr.formato_id
group by t.id, t.fecha, t.tipo, p.linea_id, l.nombre;

comment on view v_alimentacion_turno_linea is
  'Por turno+línea: piezas, minutos y tres cocientes (piezas_min_plena, '
  'piezas_min_turno, pct_plena) con MINUTOS REALES, sin suelo de 480. '
  'formatos/formatos_distintos permiten filtrar los turnos de un solo '
  'formato. Para agregar varios turnos: SUM(piezas)/SUM(minutos), nunca '
  'promediar los cocientes. Eje de PRODUCCIÓN, sin calidad.';
