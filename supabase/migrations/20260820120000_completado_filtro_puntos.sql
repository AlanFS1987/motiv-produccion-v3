-- =============================================================
-- Filtro completado=true en las vistas de rendimiento del operario
-- (07-pendientes.md #2) — sesión 20/08/2026.
--
-- v_rendimiento_linea_turno y v_operarios_linea_turno (migración
-- 20260819150000) miraban los partes solo por vigente=true, sin
-- comprobar completado=true. Efecto real: un parte recién creado
-- (piezas/minutos todavía a 0, mientras el responsable hace las
-- fotos) contaba como un tramo de rendimiento 0% y como si el
-- operario ya hubiera "trabajado" esa línea+turno a efectos de
-- reparto — antes incluso de que hubiera producción real.
--
-- Las vistas que cuelgan de estas dos (v_puntos_rendimiento_linea_
-- turno, v_puntos_rendimiento_operario_por_turno, v_puntos_
-- rendimiento_operario_ciclo) heredan el filtro automáticamente, no
-- hace falta tocarlas.
--
-- Se aprovecha para poner el mismo filtro en operario_ledger (sin
-- pantalla que la consuma todavía, pero es la base documentada para
-- el futuro dashboard del jefe — mejor que nazca correcta).
-- =============================================================

create or replace view operario_ledger as
select
  p.id                     as parte_id,
  p.turno_id,
  t.fecha,
  t.tipo                   as tipo_turno,
  p.linea_id,
  p.operario_id,
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
where p.vigente = true
  and p.completado = true;

comment on view operario_ledger is
  'Vista sobre partes vigentes y COMPLETADOS. El operario sale '
  'SIEMPRE de parte.operario_id (fuente única, sesión 19/08/2026). '
  'Filtro completado=true añadido 20/08/2026 (07-pendientes.md #2).';

create or replace view v_rendimiento_linea_turno as
select
  p.turno_id,
  fn_ciclo_id(t.fecha)                                    as cycle_id,
  p.linea_id,
  sum(p.minutos_total)                                    as suma_reportada,
  greatest(480, sum(p.minutos_total))                     as denominador,
  sum(p.minutos_plena + p.minutos_no_alimentada)          as numerador,
  round(
    100.0 * sum(p.minutos_plena + p.minutos_no_alimentada)
    / greatest(480, sum(p.minutos_total))
  , 2)                                                     as pct_rendimiento
from parte p
join turno t on t.id = p.turno_id
where p.vigente = true
  and p.completado = true
group by p.turno_id, fn_ciclo_id(t.fecha), p.linea_id;

comment on view v_rendimiento_linea_turno is
  'Rendimiento agregado por línea+turno COMPLETO (partes vigentes y '
  'completados, sin distinguir operario) — base para repartir '
  'después entre los operarios que trabajaron esa línea+turno.';

create or replace view v_operarios_linea_turno as
select distinct
  p.turno_id,
  p.linea_id,
  p.operario_id
from parte p
where p.vigente = true
  and p.completado = true
  and p.operario_id is not null;

comment on view v_operarios_linea_turno is
  'Operarios distintos (parte.operario_id) que tienen algún parte '
  'vigente Y COMPLETADO en cada línea+turno — normalmente uno solo; '
  'más de uno solo si el responsable reasignó la línea a mitad de '
  'turno. Usada para el reparto igualitario de puntos.';