-- =============================================================
-- 0009 — Vistas: operario_ledger, cálculo de puntos del ciclo actual
-- Ref. spec: glosario README.md, 03-rol-operario.md 5.6,
--            02-rol-jefe-planta.md 4.6, 07-arquitectura.md 9.3
--
-- NOTA IMPORTANTE: la spec habla de "m²" en muchos sitios (Vista
-- Rápida, puntos_metros, etc.) pero la tabla `parte` (11-esquema-
-- supabase.md 13.2) no incluye una columna de m² explícita — solo
-- piezas. No hay en la spec una fórmula piezas→m² (probablemente
-- depende del formato: superficie de la pieza × piezas). Las vistas
-- de abajo dejan `m2_total` como placeholder (null) hasta que se
-- cierre esa conversión; todo lo demás (piezas, tiempos, %) está
-- completo. Marcar como pendiente a resolver con el cliente.
-- =============================================================

-- -------------------------------------------------------------
-- operario_ledger — detalle por parte vigente, con los campos
-- crudos, agregable por línea+turno. Los puntos NO se guardan
-- resueltos por parte — se calculan al consultar (glosario README).
-- -------------------------------------------------------------
create or replace view operario_ledger as
select
  p.id                     as parte_id,
  p.turno_id,
  t.fecha,
  t.tipo                   as tipo_turno,
  p.linea_id,
  ao.operario_id,
  p.responsable_id,
  p.lote_id,
  fn_ciclo_id(t.fecha)     as cycle_id,
  p.piezas_1a,
  p.piezas_comercial,
  p.piezas_eco,
  p.piezas_contenedor,
  p.piezas_entradas,
  p.minutos_total,
  p.minutos_plena,
  p.minutos_no_alimentada,
  p.minutos_saturacion,
  p.minutos_banco,
  p.minutos_maquina,
  p.created_at
from parte p
join turno t on t.id = p.turno_id
join asignacion_operario_linea ao
  on ao.turno_id = p.turno_id and ao.linea_id = p.linea_id
where p.vigente = true;

comment on view operario_ledger is
  'Vista sobre partes vigentes, ya resuelto el operario vía '
  'asignacion_operario_linea. Base para todo cálculo de puntos del '
  'operario. Los puntos de rendimiento/piezas se calculan agregando '
  'esta vista, nunca se guardan resueltos por parte (evita el bug de '
  'v2 — 07-arquitectura.md 9.3).';

-- -------------------------------------------------------------
-- Rendimiento del OPERARIO, agregado por operario+ciclo actual.
-- % rendimiento = (plena + no_alimentada) / max(480, suma_reportada)
-- por cada turno individual del operario — NO se agrega el
-- denominador entre turnos, cada turno tiene su propio suelo de 480.
-- Aquí se agregan los PUNTOS ya resueltos tramo a tramo por turno,
-- sumados para el ciclo — coherente con "porcentaje con suelo" por
-- tramo, no una media global (03-rol-operario.md 5.6).
-- -------------------------------------------------------------
create or replace view v_rendimiento_operario_por_turno as
select
  ol.operario_id,
  ol.cycle_id,
  ol.turno_id,
  ol.linea_id,
  sum(ol.minutos_total)                                  as suma_reportada,
  greatest(480, sum(ol.minutos_total))                   as denominador,
  sum(ol.minutos_plena + ol.minutos_no_alimentada)        as numerador,
  round(
    100.0 * sum(ol.minutos_plena + ol.minutos_no_alimentada)
    / greatest(480, sum(ol.minutos_total))
  , 2)                                                     as pct_rendimiento
from operario_ledger ol
group by ol.operario_id, ol.cycle_id, ol.turno_id, ol.linea_id;

create or replace view v_puntos_rendimiento_operario_ciclo as
select
  v.operario_id,
  v.cycle_id,
  sum(pr.puntos) as puntos_rendimiento_ciclo
from v_rendimiento_operario_por_turno v
join puntos_rendimiento pr
  on v.pct_rendimiento between pr.pct_min and pr.pct_max
group by v.operario_id, v.cycle_id;

-- -------------------------------------------------------------
-- Rendimiento del RESPONSABLE — agregado por turno completo (6
-- líneas), no por línea individual (02-rol-jefe-planta.md 4.6).
-- denominador = max(2880, suma_reportada) -- 6 líneas × 480 min
-- -------------------------------------------------------------
create or replace view v_rendimiento_responsable_por_turno as
select
  p.responsable_id,
  fn_ciclo_id(t.fecha) as cycle_id,
  p.turno_id,
  sum(p.minutos_total)                                    as suma_reportada,
  greatest(2880, sum(p.minutos_total))                    as denominador,
  sum(p.minutos_plena + p.minutos_no_alimentada)          as numerador,
  round(
    100.0 * sum(p.minutos_plena + p.minutos_no_alimentada)
    / greatest(2880, sum(p.minutos_total))
  , 2)                                                     as pct_rendimiento
from parte p
join turno t on t.id = p.turno_id
where p.vigente = true
group by p.responsable_id, fn_ciclo_id(t.fecha), p.turno_id;

create or replace view v_puntos_rendimiento_responsable_ciclo as
select
  v.responsable_id,
  v.cycle_id,
  sum(prr.puntos) as puntos_rendimiento_ciclo
from v_rendimiento_responsable_por_turno v
join puntos_rendimiento_responsable prr
  on v.pct_rendimiento between prr.pct_min and prr.pct_max
group by v.responsable_id, v.cycle_id;

-- -------------------------------------------------------------
-- Totales de por vida (operario) = histórico guardado + ciclo actual
-- -------------------------------------------------------------
create or replace view v_puntos_operario_total_vida as
select
  u.id as operario_id,
  coalesce((select sum(hc.puntos_ciclo) from historial_ciclos hc
            where hc.usuario_id = u.id and hc.rol = 'operario'), 0)
  + coalesce((select vp.puntos_rendimiento_ciclo from v_puntos_rendimiento_operario_ciclo vp
              where vp.operario_id = u.id
                and vp.cycle_id = fn_ciclo_id(current_date)), 0)
  as puntos_totales
from usuario u
where u.rol = 'operario';

comment on view v_puntos_operario_total_vida is
  'Suma histórico (historial_ciclos) + ciclo actual en vivo. No suma '
  'puntos de piezas/limpieza/logros en esta versión inicial — ampliar '
  'con las mismas vistas de agregación cuando se cierren esas tablas '
  'con datos reales (03-rol-operario.md 5.6).';
