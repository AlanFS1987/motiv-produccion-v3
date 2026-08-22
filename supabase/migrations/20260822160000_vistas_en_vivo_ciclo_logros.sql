-- =============================================================
-- Gamificación — vistas "en vivo" del ciclo actual (sección 8 del
-- resumen 22/08/2026, terreno no discutido hasta ahora).
--
-- Dos necesidades distintas, cada una con su propia vista:
--
-- 1) PRODUCCIÓN en bruto por operario+ciclo — para los 16 logros de
--    tramo (m², piezas por formato, tiempos, m² por categoría). Cada
--    `parte` ya lleva su propio operario_id exacto: se atribuye
--    DIRECTAMENTE, sin el reparto igualitario que usan los puntos.
--    Ver explicación en el mensaje de chat — reparto igualitario
--    combina primero para poder buscar UN tramo no-lineal; aquí no
--    hay tramo que combinar, cada parte ya es de quien es.
--
-- 2) PUNTOS totales por operario+ciclo — para los 3 logros de ciclo
--    (Bestia, Ciclo Legendario, Rey de Reyes) y como estos SÍ heredan
--    el reparto igualitario (son puntos, no cantidades en bruto), se
--    construyen sumando las vistas de puntos ya existentes
--    (rendimiento, piezas, limpieza).
--
-- Ambas vistas NO se filtran a un cycle_id fijo — sirven para
-- cualquier ciclo (incluido el actual, filtrando cycle_id =
-- fn_ciclo_id(current_date) en la consulta) y de paso quedan listas
-- para "Recalcular ciclo anterior" (09-administrador.md,
-- 07-pendientes.md) el día que se construya cerrar-ciclo.
-- =============================================================

-- -------------------------------------------------------------
-- 1a) Piezas por operario+formato+ciclo — paso intermedio para poder
--    construir el jsonb piezas_por_formato (un valor por fila de
--    formato, luego agregado a un solo objeto por operario+ciclo).
-- -------------------------------------------------------------
create or replace view v_piezas_operario_formato_ciclo as
select
  p.operario_id,
  fn_ciclo_id(t.fecha)   as cycle_id,
  f.nombre               as formato,
  sum(p.piezas_entradas) as piezas_formato
from parte p
join turno t on t.id = p.turno_id
join lote lo on lo.id = p.lote_id
join producto pr on pr.id = lo.producto_id
join formato f on f.id = pr.formato_id
where p.vigente = true
  and p.completado = true
  and p.operario_id is not null
group by p.operario_id, fn_ciclo_id(t.fecha), f.nombre;

comment on view v_piezas_operario_formato_ciclo is
  'Piezas por operario+formato+ciclo, atribución DIRECTA vía '
  'parte.operario_id (sin reparto igualitario — ver cabecera de la '
  'migración). Paso intermedio de v_produccion_operario_ciclo.';

-- -------------------------------------------------------------
-- 1b) v_produccion_operario_ciclo — MISMAS columnas que
--    historial_ciclos (la parte que interesa a los logros de tramo),
--    calculadas al vuelo para cualquier ciclo. Para el ciclo en
--    curso, es el "equivalente a historial_ciclos pero sin cerrar"
--    que pide la sección 8; sumado a historial_ciclos ya cerrado da
--    el total de por vida que usan los 16 logros de tramo.
-- -------------------------------------------------------------
create or replace view v_produccion_operario_ciclo as
with base as (
  select
    p.operario_id,
    fn_ciclo_id(t.fecha)                    as cycle_id,
    sum(p.piezas_entradas)                  as piezas_total,
    sum(p.piezas_entradas * f.area_m2)      as m2_total,
    sum(p.piezas_contenedor * f.area_m2)    as m2_contenedor,
    sum(p.piezas_comercial * f.area_m2)     as m2_com,
    sum(p.piezas_1a * f.area_m2)            as m2_std,
    sum(p.minutos_plena)                    as tiempo_plena,
    sum(p.minutos_no_alimentada)            as tiempo_no_alimentada,
    sum(p.minutos_saturacion)               as tiempo_saturacion,
    sum(p.minutos_banco)                    as tiempo_banco,
    sum(p.minutos_maquina)                  as tiempo_maquina
  from parte p
  join turno t on t.id = p.turno_id
  join lote lo on lo.id = p.lote_id
  join producto pr on pr.id = lo.producto_id
  join formato f on f.id = pr.formato_id
  where p.vigente = true
    and p.completado = true
    and p.operario_id is not null
  group by p.operario_id, fn_ciclo_id(t.fecha)
),
formatos as (
  select
    operario_id,
    cycle_id,
    jsonb_object_agg(formato, piezas_formato) as piezas_por_formato
  from v_piezas_operario_formato_ciclo
  group by operario_id, cycle_id
)
select
  b.*,
  coalesce(fm.piezas_por_formato, '{}'::jsonb) as piezas_por_formato
from base b
left join formatos fm
  on fm.operario_id = b.operario_id and fm.cycle_id = b.cycle_id;

comment on view v_produccion_operario_ciclo is
  'Producción en bruto por operario+ciclo — mismas columnas que '
  'historial_ciclos (m2_total, piezas_total, tiempo_*, m2 por '
  'categoría, piezas_por_formato), calculadas al vuelo para '
  'CUALQUIER ciclo. Para los logros de tramo: sum(columna) sobre '
  'historial_ciclos (cerrados) + esta vista filtrada al cycle_id '
  'actual (el que aún no cerró). Atribución directa vía '
  'parte.operario_id, sin reparto igualitario — ver cabecera.';

-- -------------------------------------------------------------
-- 2a) Puntos de piezas y de limpieza por operario+ciclo — mismo
--    patrón que v_puntos_rendimiento_operario_ciclo (ya existente),
--    para completar la suma de puntos totales.
-- -------------------------------------------------------------
create or replace view v_puntos_piezas_operario_ciclo as
select
  operario_id,
  cycle_id,
  sum(puntos_operario) as puntos_piezas_ciclo
from v_puntos_piezas_operario_por_linea_turno
group by operario_id, cycle_id;

create or replace view v_puntos_limpieza_operario_ciclo as
select
  operario_id,
  cycle_id,
  sum(puntos_limpieza_turno) as puntos_limpieza_ciclo
from v_puntos_limpieza_operario_por_turno
group by operario_id, cycle_id;

-- -------------------------------------------------------------
-- 2b) v_puntos_operario_ciclo — puntos_ciclo COMPLETO (rendimiento +
--    piezas + limpieza) por operario+ciclo, para CUALQUIER ciclo.
--    Esto es lo que:
--    - usan los 3 logros de ciclo (Bestia 600+, Ciclo Legendario
--      1000+, Rey de Reyes) al filtrar por cycle_id = actual, sumado
--      a historial_ciclos.puntos_ciclo de los ciclos ya cerrados;
--    - escribirá cerrar-ciclo en historial_ciclos.puntos_ciclo al
--      cerrar (día que se construya, sección 8);
--    - sirve tal cual para "Recalcular ciclo anterior"
--      (07-pendientes.md), filtrando por el cycle_id que se quiera
--      recalcular.
-- -------------------------------------------------------------
create or replace view v_puntos_operario_ciclo as
select
  operario_id,
  cycle_id,
  sum(puntos_ciclo) as puntos_ciclo
from (
  select operario_id, cycle_id, puntos_rendimiento_ciclo as puntos_ciclo
  from v_puntos_rendimiento_operario_ciclo
  union all
  select operario_id, cycle_id, puntos_piezas_ciclo as puntos_ciclo
  from v_puntos_piezas_operario_ciclo
  union all
  select operario_id, cycle_id, puntos_limpieza_ciclo as puntos_ciclo
  from v_puntos_limpieza_operario_ciclo
) x
group by operario_id, cycle_id;

comment on view v_puntos_operario_ciclo is
  'Puntos totales del operario (rendimiento+piezas+limpieza) por '
  'ciclo, para CUALQUIER cycle_id — no solo el actual. Base de los 3 '
  'logros de ciclo y de lo que cerrar-ciclo escribirá como '
  'historial_ciclos.puntos_ciclo.';

-- -------------------------------------------------------------
-- 3) v_puntos_operario_total_vida — se amplía para sumar TAMBIÉN
--    piezas y limpieza del ciclo en vivo (el comentario de esta
--    vista, desde 20260819150000, decía explícitamente "ampliar con
--    las mismas vistas de agregación cuando se cierren esas tablas
--    con datos reales" — ya están, así que se hace ahora). Antes solo
--    sumaba rendimiento; con esto, los puntos totales que alimentan
--    el nivel del operario (sección 5 del resumen) quedan completos.
-- -------------------------------------------------------------
create or replace view v_puntos_operario_total_vida as
select
  u.id as operario_id,
  coalesce((select sum(hc.puntos_ciclo) from historial_ciclos hc
            where hc.usuario_id = u.id and hc.rol = 'operario'), 0)
  + coalesce((select voc.puntos_ciclo from v_puntos_operario_ciclo voc
              where voc.operario_id = u.id
                and voc.cycle_id = fn_ciclo_id(current_date)), 0)
  as puntos_totales
from usuario u
where u.rol = 'operario';

comment on view v_puntos_operario_total_vida is
  'Suma histórico (historial_ciclos) + ciclo actual en vivo, YA '
  'completo: rendimiento + piezas + limpieza (ampliado 22/08/2026, '
  'ver v_puntos_operario_ciclo). Es la base del nivel del operario '
  '(niveles.umbral_min/max) y del ranking.';
