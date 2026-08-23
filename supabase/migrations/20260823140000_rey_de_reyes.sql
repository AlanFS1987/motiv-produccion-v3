-- =============================================================
-- Apoyo para el logro de ciclo "Rey de Reyes" (1º del ranking de un
-- ciclo) — necesita saber, para CADA ciclo (cerrados + el actual en
-- vivo), quién quedó primero por puntos_ciclo. Se resuelve en una
-- vista para no repetir un RANK() por cliente para cada ciclo.
-- =============================================================

create or replace view v_ganador_por_ciclo as
select
  cycle_id,
  usuario_id as operario_id,
  puntos_ciclo,
  row_number() over (partition by cycle_id order by puntos_ciclo desc) as posicion
from (
  select cycle_id, usuario_id, puntos_ciclo
  from historial_ciclos
  where rol = 'operario'
  union all
  select cycle_id, operario_id as usuario_id, puntos_ciclo
  from v_puntos_operario_ciclo
) x;

comment on view v_ganador_por_ciclo is
  'Ranking de CADA ciclo (cerrados en historial_ciclos + el actual en '
  'vivo vía v_puntos_operario_ciclo), con posicion=1 el ganador. Base '
  'del logro "Rey de Reyes" (cuántos ciclos ha ganado un operario).';

create or replace view v_veces_rey_de_reyes as
select operario_id, count(*) as veces
from v_ganador_por_ciclo
where posicion = 1
group by operario_id;

comment on view v_veces_rey_de_reyes is
  'Cuántos ciclos ha ganado (1º del ranking) cada operario — para el '
  'logro "Rey de Reyes" (sin condicion_valor numérico, se compara '
  'contra los demás, no contra un umbral).';
