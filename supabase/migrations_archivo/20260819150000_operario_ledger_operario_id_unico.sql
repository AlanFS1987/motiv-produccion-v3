-- =============================================================
-- Operario del parte como fuente única + reparto igualitario de
-- puntos de rendimiento (sesión 19/08/2026, ver memorias/CLAUDE.md
-- y memorias/04-gamificacion.md).
--
-- Hasta ahora `operario_ledger` resolvía el operario haciendo JOIN
-- con `asignacion_operario_linea` (la tabla "en vivo" que edita el
-- responsable durante el turno). Eso creaba una doble fuente con
-- `parte.operario_id` (copiado al crear el parte, usado por la RLS
-- de "Mi línea"): si el responsable reasignaba la línea a mitad de
-- turno, ambas fuentes podían divergir (07-pendientes.md #5).
--
-- Decisión: `parte.operario_id` es la única fuente, siempre.
-- `asignacion_operario_linea` deja de leerse en cualquier cálculo —
-- solo la usa el responsable como semilla al crear el parte.
--
-- Consecuencia para los puntos: como cada parte ya trae su propio
-- operario, agregar directamente por operario_id ya NO sería "puntos
-- de la línea+turno" sino "puntos de los partes de ese operario" —
-- distinto de lo que se quiere. Se decidió mantener el cálculo de
-- rendimiento agregado por línea+turno completo (todos los partes
-- vigentes juntos, sin distinguir operario) y, solo al final, REPARTIR
-- los puntos ya resueltos a partes iguales entre los operario_id
-- distintos que tengan algún parte en esa línea+turno. Normalmente
-- hay uno solo; si hubo reasignación a mitad de turno, puede haber
-- más, y cada uno se lleva la misma fracción (sin ponderar por
-- tiempo: la reasignación a mitad de turno es poco frecuente y nunca
-- tan desigual como para justificar prorratear contra el suelo de
-- 480 min).
--
-- Se sustituyen las vistas de rendimiento del operario por una
-- cadena más explícita:
--   parte (vigente)
--     → v_rendimiento_linea_turno       (% agregado, SIN operario)
--     → v_puntos_rendimiento_linea_turno (tramo → puntos, SIN operario)
--     → v_operarios_linea_turno          (operario_id distintos + cuántos)
--     → v_puntos_rendimiento_operario_por_turno (reparto igualitario)
--     → v_puntos_rendimiento_operario_ciclo      (suma para el ciclo —
--       MISMA firma de columnas que antes: operario_id, cycle_id,
--       puntos_rendimiento_ciclo — no hace falta tocar
--       v_puntos_operario_total_vida, que depende de esta).
--
-- La vieja `v_rendimiento_operario_por_turno` desaparece: su
-- pct_rendimiento "por operario" ya no tiene sentido (el rendimiento
-- es de la línea+turno, no de una persona). Nada la consumía todavía
-- (sin pantalla construida).
-- =============================================================

-- Hay que soltar en orden inverso de dependencia antes de recrear.
drop view if exists v_puntos_operario_total_vida;
drop view if exists v_puntos_rendimiento_operario_ciclo;
drop view if exists v_rendimiento_operario_por_turno;
drop view if exists operario_ledger;

-- -------------------------------------------------------------
-- operario_ledger — ahora lee `parte.operario_id` directamente, sin
-- JOIN con `asignacion_operario_linea`. Sigue siendo la base para
-- Historial y para cualquier cálculo por parte; para puntos de
-- rendimiento se usa a partir de aquí la cadena de vistas de abajo,
-- que trabaja sobre `parte` sin pasar por esta vista intermedia
-- cuando necesita agregar SIN distinguir operario.
-- -------------------------------------------------------------
create view operario_ledger as
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
where p.vigente = true;

comment on view operario_ledger is
  'Vista sobre partes vigentes. El operario sale SIEMPRE de '
  'parte.operario_id (fuente única, sesión 19/08/2026) — ya no hace '
  'JOIN con asignacion_operario_linea, que ha dejado de leerse en '
  'cualquier cálculo. Nota: sigue sin filtrar completado = true '
  '(07-pendientes.md #3, bug aparte de este cambio).';

-- -------------------------------------------------------------
-- v_rendimiento_linea_turno — % de rendimiento agregado por
-- línea+turno, con TODOS los partes vigentes juntos, sin distinguir
-- operario. Es el mismo cálculo de siempre (suelo de 480 min); lo
-- único que cambia es que ya no se agrupa por operario_id.
-- -------------------------------------------------------------
create view v_rendimiento_linea_turno as
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
group by p.turno_id, fn_ciclo_id(t.fecha), p.linea_id;

comment on view v_rendimiento_linea_turno is
  'Rendimiento agregado por línea+turno COMPLETO (todos los partes '
  'vigentes, sin distinguir operario) — base para repartir después '
  'entre los operarios que trabajaron esa línea+turno. Ver '
  'v_puntos_rendimiento_operario_por_turno.';

-- -------------------------------------------------------------
-- v_puntos_rendimiento_linea_turno — el % de arriba resuelto a
-- puntos por el tramo correspondiente, todavía SIN repartir.
-- -------------------------------------------------------------
create view v_puntos_rendimiento_linea_turno as
select
  v.turno_id,
  v.cycle_id,
  v.linea_id,
  pr.puntos as puntos_linea_turno
from v_rendimiento_linea_turno v
join puntos_rendimiento pr
  on v.pct_rendimiento between pr.pct_min and pr.pct_max;

-- -------------------------------------------------------------
-- v_operarios_linea_turno — operario_id distintos con algún parte
-- vigente en cada línea+turno. Sustituye a la lectura de
-- `asignacion_operario_linea`: el conjunto de "quién trabajó aquí" se
-- deriva de los partes reales, no de la asignación en vivo.
-- -------------------------------------------------------------
create view v_operarios_linea_turno as
select distinct
  p.turno_id,
  p.linea_id,
  p.operario_id
from parte p
where p.vigente = true
  and p.operario_id is not null;

comment on view v_operarios_linea_turno is
  'Operarios distintos (parte.operario_id) que tienen algún parte '
  'vigente en cada línea+turno — normalmente uno solo; más de uno '
  'solo si el responsable reasignó la línea a mitad de turno. Usada '
  'para el reparto igualitario de puntos, nunca para "Mi línea" (esa '
  'pantalla lee parte directamente, ver lib/operario.ts).';

-- -------------------------------------------------------------
-- v_puntos_rendimiento_operario_por_turno — reparto igualitario: los
-- puntos de la línea+turno se dividen entre el número de operarios
-- distintos que aparecen en ella. Sin ponderar por tiempo (decisión
-- sesión 19/08/2026): la reasignación a mitad de turno es poco
-- frecuente y nunca tan desigual como para justificar prorratear
-- contra el suelo de 480 min.
-- -------------------------------------------------------------
create view v_puntos_rendimiento_operario_por_turno as
select
  op.operario_id,
  plt.cycle_id,
  plt.turno_id,
  plt.linea_id,
  plt.puntos_linea_turno::numeric
    / count(*) over (partition by plt.turno_id, plt.linea_id) as puntos_operario
from v_puntos_rendimiento_linea_turno plt
join v_operarios_linea_turno op
  on op.turno_id = plt.turno_id and op.linea_id = plt.linea_id;

comment on view v_puntos_rendimiento_operario_por_turno is
  'Puntos de rendimiento de cada línea+turno repartidos a partes '
  'iguales entre los operarios que tuvieron parte ahí. '
  'puntos_operario es numeric (puede salir con decimales si hay más '
  'de un operario) — se suma tal cual para el ciclo.';

-- -------------------------------------------------------------
-- v_puntos_rendimiento_operario_ciclo — MISMA firma que antes
-- (operario_id, cycle_id, puntos_rendimiento_ciclo): suma del
-- reparto de arriba para todo el ciclo actual. v_puntos_operario_
-- total_vida depende de esta y no necesita ningún cambio.
-- -------------------------------------------------------------
create view v_puntos_rendimiento_operario_ciclo as
select
  operario_id,
  cycle_id,
  sum(puntos_operario) as puntos_rendimiento_ciclo
from v_puntos_rendimiento_operario_por_turno
group by operario_id, cycle_id;

-- -------------------------------------------------------------
-- v_puntos_operario_total_vida — sin cambios de lógica, solo se
-- recrea porque dependía de la vista anterior (drop en cascada).
-- -------------------------------------------------------------
create view v_puntos_operario_total_vida as
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
  'con datos reales (03-rol-operario.md 5.6). Puntos de rendimiento ya '
  'vienen repartidos igualitariamente por línea+turno cuando hubo más '
  'de un operario (ver v_puntos_rendimiento_operario_por_turno).';
