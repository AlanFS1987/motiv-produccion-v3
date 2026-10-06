-- =============================================================
-- Gamificación — fuerza / resistencia / velocidad (sesión 22/08/2026,
-- a partir del ejemplo de v2 compartido en chat).
--
-- Fórmula heredada de v2 (fuerza y resistencia ligadas a producción
-- en bruto, sin techo):
--   fuerza      = m2_total / 1000
--   resistencia = (tiempo_plena + tiempo_no_alimentada) / 100
--
-- Cambiado respecto a v2:
--
-- 1) Velocidad ya no es una media ponderada arbitraria (0.6/0.4 en
--    v2, "por poner algo" según se confirmó en chat). Se calcula
--    directamente como m2_total / tiempo_plena — m² por minuto de
--    máquina realmente produciendo, SIN diluir con tiempo_no_
--    alimentada (que sí cuenta para resistencia/rendimiento, porque
--    no es culpa del operario, pero durante esos minutos no se
--    produce nada — mezclarlo en velocidad ensuciaría la medida de
--    "cuán rápido va la línea cuando va"). La proporción real
--    (~4.500 m² / ~480 min ≈ 9-10) ya cae en un rango razonable sin
--    necesidad de ningún divisor extra — no hace falta pasar por
--    fuerza/resistencia para nada.
--
-- 2) fuerza/resistencia/velocidad se guardan en historial_ciclos como
--    la APORTACIÓN de ESE ciclo (delta), nunca como un contador que
--    se actualiza con +=. v2 mantenía un contador persistente
--    (operario_dashboard.fuerza) actualizado a base de
--    "fuerza = fuerza + delta" comparando contra el valor anterior
--    guardado parte a parte en operario_ledger — exactamente el
--    patrón que la arquitectura de este proyecto evita a propósito
--    (correcciones o fallos a medias desincronizan el contador para
--    siempre sin que nadie lo note). Aquí, igual que m2_total o
--    piezas_total, cada fila de historial_ciclos es la foto de ESE
--    ciclo; el total de toda la vida es un SUM() sobre las filas ya
--    cerradas + el ciclo en vivo — nunca un valor que se muta.
--
-- Los divisores (1000, 100) se mantienen iguales a v2 solo como
-- punto de partida — son cosméticos (escala de visualización),
-- cambiarlos después no requiere tocar nada más.
-- =============================================================

-- -------------------------------------------------------------
-- v_tiempo_responsable_ciclo — minutos de rendimiento (plena +
-- no_alimentada) del responsable por ciclo, para poder calcular su
-- resistencia. Mismo filtro que el resto de vistas del responsable
-- (solo vigente=true, ver migración de las 3 vistas de sección 7).
-- -------------------------------------------------------------
create or replace view v_tiempo_responsable_ciclo as
select
  p.responsable_id,
  fn_ciclo_id(t.fecha)                              as cycle_id,
  sum(p.minutos_plena)                              as tiempo_plena,
  sum(p.minutos_plena + p.minutos_no_alimentada)    as minutos_rendimiento
from parte p
join turno t on t.id = p.turno_id
where p.vigente = true
group by p.responsable_id, fn_ciclo_id(t.fecha);

comment on view v_tiempo_responsable_ciclo is
  'Minutos del responsable por ciclo: tiempo_plena solo (base de '
  '"velocidad") y minutos_rendimiento = plena+no_alimentada (base de '
  '"resistencia"). Análogo a v_metros_responsable_ciclo pero para '
  'tiempo en vez de m².';

-- -------------------------------------------------------------
-- fn_cerrar_ciclos_pendientes — se reemplaza entera para añadir
-- fuerza/resistencia/velocidad a los dos INSERT (operario y
-- responsable). El resto de la función es idéntico a
-- 20260822170000_cerrar_ciclo_cron.sql.
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
  for v_cycle_id in
    select gs
    from generate_series(0, v_actual - 1) as gs
    where not exists (
      select 1 from historial_ciclos hc where hc.cycle_id = gs
    )
    order by gs
  loop

    -- ---- OPERARIOS ----
    insert into historial_ciclos (
      usuario_id, rol, cycle_id, fecha_cierre, puntos_ciclo,
      m2_total, piezas_total,
      tiempo_plena, tiempo_no_alimentada, tiempo_saturacion,
      tiempo_banco, tiempo_maquina,
      piezas_por_formato, m2_contenedor, m2_com, m2_std,
      fuerza, resistencia, velocidad
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
      coalesce(prod.m2_std, 0),
      round(coalesce(prod.m2_total, 0) / 1000.0, 2) as fuerza,
      round((coalesce(prod.tiempo_plena, 0) + coalesce(prod.tiempo_no_alimentada, 0)) / 100.0, 2) as resistencia,
      case
        when coalesce(prod.tiempo_plena, 0) > 0
          then round(coalesce(prod.m2_total, 0) / prod.tiempo_plena, 4)
        else null
      end as velocidad
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
      m2_std               = excluded.m2_std,
      fuerza               = excluded.fuerza,
      resistencia          = excluded.resistencia,
      velocidad            = excluded.velocidad;

    -- ---- RESPONSABLES ----
    insert into historial_ciclos (
      usuario_id, rol, cycle_id, fecha_cierre, puntos_ciclo, m2_total,
      fuerza, resistencia, velocidad
    )
    select
      pr.responsable_id,
      'responsable',
      v_cycle_id,
      now(),
      coalesce(pr.puntos_ciclo, 0),
      coalesce(m.m2_total, 0),
      round(coalesce(m.m2_total, 0) / 1000.0, 2) as fuerza,
      round(coalesce(tr.minutos_rendimiento, 0) / 100.0, 2) as resistencia,
      case
        when coalesce(tr.tiempo_plena, 0) > 0
          then round(coalesce(m.m2_total, 0) / tr.tiempo_plena, 4)
        else null
      end as velocidad
    from v_puntos_responsable_ciclo pr
    left join v_metros_responsable_ciclo m
      on m.responsable_id = pr.responsable_id and m.cycle_id = pr.cycle_id
    left join v_tiempo_responsable_ciclo tr
      on tr.responsable_id = pr.responsable_id and tr.cycle_id = pr.cycle_id
    where pr.cycle_id = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      rol          = excluded.rol,
      fecha_cierre = excluded.fecha_cierre,
      puntos_ciclo = excluded.puntos_ciclo,
      m2_total     = excluded.m2_total,
      fuerza       = excluded.fuerza,
      resistencia  = excluded.resistencia,
      velocidad    = excluded.velocidad;

    raise notice 'Ciclo % cerrado en historial_ciclos (operarios + responsables, con fuerza/resistencia/velocidad).', v_cycle_id;
  end loop;
end;
$$;

comment on function fn_cerrar_ciclos_pendientes() is
  'Cierra en historial_ciclos todo cycle_id < ciclo actual que aún no '
  'tenga fila, incluyendo fuerza/resistencia/velocidad de ESE ciclo '
  '(delta, no contador acumulado). velocidad = m2_total/tiempo_plena '
  'del propio ciclo. Idempotente (on conflict do update): segura '
  'para el cron semanal y para "recalcular ciclo anterior" a mano.';

-- -------------------------------------------------------------
-- v_stats_vida — fuerza/resistencia/velocidad de TODA LA VIDA
-- (histórico + ciclo en vivo), para cualquier usuario de cualquier
-- rol. La velocidad NO se promedia entre ciclos (promediar ratios ya
-- calculados da un resultado sesgado) — se recalcula como m2_total /
-- tiempo_plena sobre los totales acumulados de toda la vida, igual
-- que se calculó por ciclo dentro de cerrar-ciclo.
-- -------------------------------------------------------------
create or replace view v_stats_vida as
with historico as (
  select
    usuario_id,
    rol,
    sum(m2_total)                                                        as m2_total,
    sum(coalesce(tiempo_plena, 0))                                       as tiempo_plena,
    sum(coalesce(tiempo_plena, 0) + coalesce(tiempo_no_alimentada, 0))   as minutos_rendimiento
  from historial_ciclos
  group by usuario_id, rol
),
vivo_operario as (
  select
    operario_id as usuario_id,
    'operario'  as rol,
    m2_total,
    coalesce(tiempo_plena, 0) as tiempo_plena,
    coalesce(tiempo_plena, 0) + coalesce(tiempo_no_alimentada, 0) as minutos_rendimiento
  from v_produccion_operario_ciclo
  where cycle_id = fn_ciclo_id(current_date)
),
vivo_responsable as (
  select
    m.responsable_id as usuario_id,
    'responsable'     as rol,
    m.m2_total,
    coalesce(tr.tiempo_plena, 0) as tiempo_plena,
    coalesce(tr.minutos_rendimiento, 0) as minutos_rendimiento
  from v_metros_responsable_ciclo m
  left join v_tiempo_responsable_ciclo tr
    on tr.responsable_id = m.responsable_id and tr.cycle_id = m.cycle_id
  where m.cycle_id = fn_ciclo_id(current_date)
),
vivo as (
  select * from vivo_operario
  union all
  select * from vivo_responsable
),
total as (
  select
    coalesce(h.usuario_id, v.usuario_id) as usuario_id,
    coalesce(h.rol, v.rol)               as rol,
    coalesce(h.m2_total, 0) + coalesce(v.m2_total, 0)                         as m2_total_vida,
    coalesce(h.tiempo_plena, 0) + coalesce(v.tiempo_plena, 0)                 as tiempo_plena_vida,
    coalesce(h.minutos_rendimiento, 0) + coalesce(v.minutos_rendimiento, 0)   as minutos_rendimiento_vida
  from historico h
  full outer join vivo v on v.usuario_id = h.usuario_id and v.rol = h.rol
)
select
  usuario_id,
  rol,
  round(m2_total_vida / 1000.0, 2) as fuerza,
  round(minutos_rendimiento_vida / 100.0, 2) as resistencia,
  case
    when tiempo_plena_vida > 0
      then round(m2_total_vida / tiempo_plena_vida, 4)
    else null
  end as velocidad
from total;

comment on view v_stats_vida is
  'Fuerza/resistencia/velocidad de toda la vida (histórico + ciclo en '
  'vivo), para cualquier usuario y rol. Velocidad = m2_total_vida / '
  'tiempo_plena_vida, recalculada desde los totales acumulados — '
  'nunca promediando los ratios por ciclo ya guardados en '
  'historial_ciclos (promediar ratios sesga el resultado hacia los '
  'ciclos con menos actividad).';
