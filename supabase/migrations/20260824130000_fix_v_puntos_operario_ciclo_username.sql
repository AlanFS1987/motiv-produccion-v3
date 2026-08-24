-- =============================================================
-- Sesión 24/08/2026 — bug real detectado al retestear el Ranking con
-- una cuenta de operario: 400 "Could not find a relationship between
-- 'v_puntos_operario_ciclo' and 'operario_id' in the schema cache".
--
-- NO es un problema de RLS (la migración anterior,
-- 20260824120000_rls_configuracion_usuario_ranking.sql, era correcta
-- y necesaria, pero no arreglaba esto). El error es de PostgREST: los
-- embeds tipo `usuario:operario_id(username)` solo funcionan cuando
-- hay una FOREIGN KEY real en el catálogo de Postgres entre las dos
-- tablas. `v_puntos_operario_ciclo` es una VISTA — no tiene FK propia
-- aunque la tabla de debajo (`usuario`) sí la tenga — así que
-- PostgREST nunca pudo resolver esa relación, con o sin RLS. Esto
-- llevaba roto desde que se escribió `lib/ranking.ts` (23/08/2026);
-- simplemente no se había probado con datos reales hasta hoy.
--
-- El propio proyecto ya resuelve este mismo problema en otro sitio
-- con el patrón correcto: `v_rey_formato_historico`/`v_rey_formato_
-- actual` no usan embed, exponen `operario_username` como columna
-- normal calculada dentro de la vista. Se aplica aquí el mismo
-- criterio: se añade `username` al final de `v_puntos_operario_ciclo`
-- (con `create or replace view` los tres columnas originales
-- (operario_id, cycle_id, puntos_ciclo) se mantienen en la misma
-- posición — solo se añade una columna nueva al final, que es lo
-- único que `create or replace view` permite sin dropear la vista) —
-- así ninguna de las vistas que ya la consultan con listas explícitas
-- de columnas (v_puntos_operario_total_vida, v_ganador_por_ciclo) se
-- ve afectada.
-- =============================================================

create or replace view v_puntos_operario_ciclo as
select
  vp.operario_id,
  vp.cycle_id,
  vp.puntos_ciclo,
  u.username
from (
  select operario_id, cycle_id, sum(puntos_ciclo) as puntos_ciclo
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
  group by operario_id, cycle_id
) vp
join usuario u on u.id = vp.operario_id;

comment on view v_puntos_operario_ciclo is
  'Puntos totales del operario (rendimiento+piezas+limpieza) por '
  'ciclo, para CUALQUIER cycle_id — no solo el actual. Base de los 3 '
  'logros de ciclo y de lo que cerrar-ciclo escribirá como '
  'historial_ciclos.puntos_ciclo. `username` añadido 24/08/2026 como '
  'columna directa (NO como relación/embed): PostgREST no puede '
  'resolver `usuario:operario_id(username)` sobre una vista porque no '
  'hay FK real — mismo motivo por el que v_rey_formato_historico ya '
  'exponía operario_username como columna en vez de relación. El '
  'cliente (lib/ranking.ts) debe pedir `username` como columna plana, '
  'nunca como embed, contra esta vista.';
