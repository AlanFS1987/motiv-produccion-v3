-- =============================================================
-- Gamificación — cierre de ciclo (sección 8 del resumen 22/08/2026,
-- sesión de diseño 22/08/2026 en chat).
--
-- DISEÑO ACORDADO:
--
-- - El disparador es puro calendario, no un evento de `turno`: como
--   el ciclo dura 28 días (múltiplo exacto de 7) desde un lunes
--   (`fecha_inicio_rotacion` = 31/08/2026), CADA ciclo termina
--   siempre en domingo y el siguiente arranca siempre en lunes —
--   propiedad matemática, no casualidad de este ciclo. Por eso el
--   cron solo necesita correr los lunes.
-- - Margen de seguridad: se cierra a las 8:00 de la mañana (hora
--   Madrid) del lunes, no antes. A esa hora ya han pasado de sobra
--   tanto el cierre automático del turno N (que remata a las 07:00
--   cualquier parte pendiente como "sin producción") como la ventana
--   de corrección de 1h del responsable sobre ese último parte.
--   Cierra siempre DESPUÉS de que los datos de esa última noche
--   puedan estar completos, nunca antes.
-- - "8:00 Madrid" en un cron que solo entiende UTC: se dispara CADA
--   HORA en punto (nunca a una hora fija en UTC, que se desplazaría
--   con el cambio de horario) y es la condición de dentro
--   (`at time zone 'Europe/Madrid'`) la que decide si de verdad son
--   las 8 — mismo patrón que `resumen-calidad-diario` y
--   `resumenes-turno-pendientes`.
-- - Restringido a lunes en el propio cron (día de la semana, no en la
--   condición SQL) para no ejecutar la función 24 veces al día los
--   otros 6 días, cuando por diseño nunca va a encontrar nada que
--   cerrar esos días.
-- - Autocontenido y con red de seguridad incorporada: la función NO
--   se limita a "el ciclo que acaba de terminar" — recorre TODO
--   ciclo con `cycle_id` menor que el actual que todavía no tenga
--   filas en `historial_ciclos`. Si el cron no llegó a correr un
--   lunes concreto (mantenimiento, caída), el lunes siguiente cierra
--   los que falten sin intervención manual. También es la misma
--   función que puede llamar el administrador a mano para
--   "recalcular ciclo anterior" (pendiente ya anotado en
--   07-pendientes.md): un ciclo que ya tiene fila se actualiza
--   (`on conflict ... do update`), nunca duplica.
-- - `fuerza`/`resistencia`/`velocidad` se dejan SIN TOCAR (no
--   aparecen en el INSERT) — sin fórmula decidida todavía, a
--   discutir aparte. Postgres los deja en NULL por defecto en filas
--   nuevas; en un `on conflict ... do update` tampoco se tocan
--   porque no están en el SET.
-- =============================================================

-- -------------------------------------------------------------
-- Vistas del RESPONSABLE por ciclo que faltaban (la sección 7 ya
-- dejó las de turno; aquí solo falta agregar turno -> ciclo, mismo
-- patrón que ya existe para rendimiento).
-- -------------------------------------------------------------
create or replace view v_metros_responsable_ciclo as
select
  responsable_id,
  cycle_id,
  sum(m2_total) as m2_total
from v_metros_responsable_por_turno
group by responsable_id, cycle_id;

create or replace view v_puntos_metros_responsable_ciclo as
select
  responsable_id,
  cycle_id,
  sum(puntos_metros_turno) as puntos_metros_ciclo
from v_puntos_metros_responsable_por_turno
group by responsable_id, cycle_id;

-- -------------------------------------------------------------
-- v_puntos_responsable_ciclo — puntos totales del responsable
-- (metros + rendimiento) por ciclo, para CUALQUIER cycle_id. Mismo
-- papel que v_puntos_operario_ciclo pero para el otro rol.
-- -------------------------------------------------------------
create or replace view v_puntos_responsable_ciclo as
select
  coalesce(m.responsable_id, r.responsable_id) as responsable_id,
  coalesce(m.cycle_id, r.cycle_id)             as cycle_id,
  coalesce(m.puntos_metros_ciclo, 0) + coalesce(r.puntos_rendimiento_ciclo, 0) as puntos_ciclo
from v_puntos_metros_responsable_ciclo m
full outer join v_puntos_rendimiento_responsable_ciclo r
  on r.responsable_id = m.responsable_id and r.cycle_id = m.cycle_id;

comment on view v_puntos_responsable_ciclo is
  'Puntos totales del responsable (metros+rendimiento) por ciclo, '
  'para CUALQUIER cycle_id — análogo a v_puntos_operario_ciclo.';

-- -------------------------------------------------------------
-- fn_cerrar_ciclos_pendientes — el cierre de ciclo en sí.
-- -------------------------------------------------------------
create or replace function fn_cerrar_ciclos_pendientes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id int;
  v_actual   int := fn_ciclo_id(current_date);
begin
  -- Cualquier ciclo YA TERMINADO (cycle_id < el actual) que todavía
  -- no tenga ninguna fila en historial_ciclos. Normalmente será solo
  -- el inmediatamente anterior; si hay más de uno pendiente (cron
  -- que no corrió algún lunes), se cierran todos, uno a uno.
  for v_cycle_id in
    select gs
    from generate_series(0, v_actual - 1) as gs
    where not exists (
      select 1 from historial_ciclos hc where hc.cycle_id = gs
    )
    order by gs
  loop

    -- ---- OPERARIOS ----
    -- v_produccion_operario_ciclo trae las cantidades en bruto
    -- (m², piezas, tiempos, piezas_por_formato); v_puntos_operario_
    -- ciclo trae los puntos ya sumados (rendimiento+piezas+limpieza).
    -- FULL OUTER JOIN por si alguna de las dos no tiene fila para un
    -- operario que sí tiene en la otra (ej. limpió pero no tuvo
    -- ningún parte con piezas ese ciclo, o viceversa).
    insert into historial_ciclos (
      usuario_id, rol, cycle_id, fecha_cierre, puntos_ciclo,
      m2_total, piezas_total,
      tiempo_plena, tiempo_no_alimentada, tiempo_saturacion,
      tiempo_banco, tiempo_maquina,
      piezas_por_formato, m2_contenedor, m2_com, m2_std
    )
    select
      coalesce(prod.operario_id, pts.operario_id),
      'operario',
      v_cycle_id,
      now(),
      coalesce(pts.puntos_ciclo, 0),
      coalesce(prod.m2_total, 0),
      coalesce(prod.piezas_total, 0),
      coalesce(prod.tiempo_plena, 0),
      coalesce(prod.tiempo_no_alimentada, 0),
      coalesce(prod.tiempo_saturacion, 0),
      coalesce(prod.tiempo_banco, 0),
      coalesce(prod.tiempo_maquina, 0),
      coalesce(prod.piezas_por_formato, '{}'::jsonb),
      coalesce(prod.m2_contenedor, 0),
      coalesce(prod.m2_com, 0),
      coalesce(prod.m2_std, 0)
    from v_produccion_operario_ciclo prod
    full outer join v_puntos_operario_ciclo pts
      on pts.operario_id = prod.operario_id and pts.cycle_id = prod.cycle_id
    where coalesce(prod.cycle_id, pts.cycle_id) = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      rol                  = excluded.rol,
      fecha_cierre         = excluded.fecha_cierre,
      puntos_ciclo         = excluded.puntos_ciclo,
      m2_total             = excluded.m2_total,
      piezas_total         = excluded.piezas_total,
      tiempo_plena         = excluded.tiempo_plena,
      tiempo_no_alimentada = excluded.tiempo_no_alimentada,
      tiempo_saturacion    = excluded.tiempo_saturacion,
      tiempo_banco         = excluded.tiempo_banco,
      tiempo_maquina       = excluded.tiempo_maquina,
      piezas_por_formato   = excluded.piezas_por_formato,
      m2_contenedor        = excluded.m2_contenedor,
      m2_com               = excluded.m2_com,
      m2_std               = excluded.m2_std;

    -- ---- RESPONSABLES ----
    -- Solo puntos_ciclo y m2_total tienen sentido para el responsable
    -- hoy (piezas/tiempos/formato son magnitudes del operario, sin
    -- logros de responsable todavía — fase 2, sección 8). El resto de
    -- columnas quedan en su default (0/null) para estas filas.
    insert into historial_ciclos (usuario_id, rol, cycle_id, fecha_cierre, puntos_ciclo, m2_total)
    select
      pr.responsable_id,
      'responsable',
      v_cycle_id,
      now(),
      coalesce(pr.puntos_ciclo, 0),
      coalesce(m.m2_total, 0)
    from v_puntos_responsable_ciclo pr
    left join v_metros_responsable_ciclo m
      on m.responsable_id = pr.responsable_id and m.cycle_id = pr.cycle_id
    where pr.cycle_id = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      rol          = excluded.rol,
      fecha_cierre = excluded.fecha_cierre,
      puntos_ciclo = excluded.puntos_ciclo,
      m2_total     = excluded.m2_total;

    raise notice 'Ciclo % cerrado en historial_ciclos (operarios + responsables).', v_cycle_id;
  end loop;
end;
$$;

comment on function fn_cerrar_ciclos_pendientes() is
  'Cierra en historial_ciclos todo cycle_id < ciclo actual que aún no '
  'tenga fila. Idempotente (on conflict do update): segura para el '
  'cron semanal y para que el administrador la relance a mano como '
  '"recalcular ciclo anterior". No toca fuerza/resistencia/velocidad '
  '(sin fórmula decidida todavía).';

-- -------------------------------------------------------------
-- Cron: solo los LUNES (día 1 en cron estándar), cada hora en punto
-- en UTC — la condición de dentro decide si de verdad son las 8:00
-- de la mañana en Madrid antes de hacer nada.
-- -------------------------------------------------------------
do $$
begin
  perform cron.schedule(
    'cerrar-ciclos-pendientes',
    '0 * * * 1',
    $cron$
      select fn_cerrar_ciclos_pendientes()
      where extract(hour from (now() at time zone 'Europe/Madrid')) = 8;
    $cron$
  );
exception when others then
  raise notice 'No se pudo programar el cron job de cierre de ciclos '
               '(pg_cron no disponible en este entorno) — programarlo '
               'manualmente en Supabase (Database > Cron Jobs): '
               '''0 * * * 1'' + la condición de hora=8 Madrid de arriba.';
end $$;
