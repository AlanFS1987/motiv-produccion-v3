-- =============================================================
-- Desglose de puntos por categoría en historial_ciclos + vistas de
-- por vida (sesión de diseño 23/08/2026 — tarjeta de gamificación de
-- Inicio necesita "puntos piezas totales", "puntos rendimiento
-- totales", "puntos limpieza totales" de POR VIDA, y hasta ahora
-- historial_ciclos solo guardaba puntos_ciclo ya sumado, sin
-- desglose — mismo hueco que ya se resolvió una vez para m² por
-- categoría (m2_contenedor/m2_com/m2_std, migración 20260822140000).
-- =============================================================

alter table historial_ciclos
  add column if not exists puntos_piezas      int default 0,
  add column if not exists puntos_rendimiento int default 0,
  add column if not exists puntos_limpieza    int default 0;

comment on column historial_ciclos.puntos_piezas is
  'Puntos de piezas de ESE ciclo (no acumulado) — desglose de '
  'puntos_ciclo, para poder sumar "puntos piezas totales de por '
  'vida" en la tarjeta de Inicio sin recalcular desde parte.';
comment on column historial_ciclos.puntos_rendimiento is
  'Puntos de rendimiento de ESE ciclo — mismo motivo que puntos_piezas.';
comment on column historial_ciclos.puntos_limpieza is
  'Puntos de limpieza de ESE ciclo — mismo motivo que puntos_piezas.';

-- -------------------------------------------------------------
-- fn_cerrar_ciclos_pendientes — se reemplaza entera de nuevo (mismo
-- patrón que 20260822180000) para añadir los 3 desgloses al INSERT
-- de operarios. Los responsables no tienen aún estas 3 categorías
-- separadas (solo metros+rendimiento, sin piezas/limpieza — fase 2),
-- así que su INSERT no cambia.
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
      fuerza, resistencia, velocidad,
      puntos_piezas, puntos_rendimiento, puntos_limpieza
    )
    select
      coalesce(prod.operario_id, pts.operario_id, ppz.operario_id, prd.operario_id, plp.operario_id),
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
      end as velocidad,
      coalesce(ppz.puntos_piezas_ciclo, 0),
      coalesce(prd.puntos_rendimiento_ciclo, 0),
      coalesce(plp.puntos_limpieza_ciclo, 0)
    from v_produccion_operario_ciclo prod
    full outer join v_puntos_operario_ciclo pts
      on pts.operario_id = prod.operario_id and pts.cycle_id = prod.cycle_id
    full outer join v_puntos_piezas_operario_ciclo ppz
      on ppz.operario_id = coalesce(prod.operario_id, pts.operario_id) and ppz.cycle_id = v_cycle_id
    full outer join v_puntos_rendimiento_operario_ciclo prd
      on prd.operario_id = coalesce(prod.operario_id, pts.operario_id, ppz.operario_id) and prd.cycle_id = v_cycle_id
    full outer join v_puntos_limpieza_operario_ciclo plp
      on plp.operario_id = coalesce(prod.operario_id, pts.operario_id, ppz.operario_id, prd.operario_id) and plp.cycle_id = v_cycle_id
    where coalesce(prod.cycle_id, pts.cycle_id, ppz.cycle_id, prd.cycle_id, plp.cycle_id) = v_cycle_id
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
      velocidad            = excluded.velocidad,
      puntos_piezas        = excluded.puntos_piezas,
      puntos_rendimiento   = excluded.puntos_rendimiento,
      puntos_limpieza      = excluded.puntos_limpieza;

    -- ---- RESPONSABLES (sin cambios respecto a 20260822180000) ----
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

    raise notice 'Ciclo % cerrado en historial_ciclos (con desglose de puntos por categoría).', v_cycle_id;
  end loop;
end;
$$;

comment on function fn_cerrar_ciclos_pendientes() is
  'Cierra en historial_ciclos todo cycle_id < ciclo actual que aún no '
  'tenga fila, incluyendo fuerza/resistencia/velocidad y el desglose '
  'puntos_piezas/puntos_rendimiento/puntos_limpieza de ESE ciclo. '
  'Idempotente (on conflict do update) — segura para el cron semanal '
  'y para "recalcular ciclo anterior" a mano.';

-- -------------------------------------------------------------
-- v_stats_vida — se amplía con m2_total_vida y tiempo_plena_vida
-- (ya se calculaban internamente para derivar fuerza/velocidad, solo
-- faltaba exponerlos) — para "metros totales" y "tiempo plena total"
-- de la tarjeta de Inicio, sin duplicar la agregación histórico+vivo
-- en otra vista aparte.
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
  end as velocidad,
  round(m2_total_vida, 2)          as m2_total_vida,
  round(tiempo_plena_vida / 60.0, 2) as horas_plena_vida
from total;

comment on view v_stats_vida is
  'Fuerza/resistencia/velocidad de toda la vida (histórico + ciclo en '
  'vivo), MÁS m2_total_vida y horas_plena_vida en crudo (ampliado '
  '23/08/2026 para la tarjeta de Inicio: "metros totales" y "tiempo '
  'plena total"). Para cualquier usuario y rol.';

-- -------------------------------------------------------------
-- Desglose de puntos de por vida — mismo patrón que
-- v_puntos_operario_total_vida (histórico cerrado + ciclo en vivo),
-- una vista por categoría para no mezclar la semántica de "puntos
-- totales" (ya existente) con "puntos de esta categoría".
-- -------------------------------------------------------------
create or replace view v_puntos_piezas_operario_total_vida as
select
  u.id as operario_id,
  coalesce((select sum(hc.puntos_piezas) from historial_ciclos hc
            where hc.usuario_id = u.id and hc.rol = 'operario'), 0)
  + coalesce((select ppz.puntos_piezas_ciclo from v_puntos_piezas_operario_ciclo ppz
              where ppz.operario_id = u.id
                and ppz.cycle_id = fn_ciclo_id(current_date)), 0)
  as puntos_piezas_totales
from usuario u
where u.rol = 'operario';

create or replace view v_puntos_rendimiento_operario_total_vida as
select
  u.id as operario_id,
  coalesce((select sum(hc.puntos_rendimiento) from historial_ciclos hc
            where hc.usuario_id = u.id and hc.rol = 'operario'), 0)
  + coalesce((select prd.puntos_rendimiento_ciclo from v_puntos_rendimiento_operario_ciclo prd
              where prd.operario_id = u.id
                and prd.cycle_id = fn_ciclo_id(current_date)), 0)
  as puntos_rendimiento_totales
from usuario u
where u.rol = 'operario';

create or replace view v_puntos_limpieza_operario_total_vida as
select
  u.id as operario_id,
  coalesce((select sum(hc.puntos_limpieza) from historial_ciclos hc
            where hc.usuario_id = u.id and hc.rol = 'operario'), 0)
  + coalesce((select plp.puntos_limpieza_ciclo from v_puntos_limpieza_operario_ciclo plp
              where plp.operario_id = u.id
                and plp.cycle_id = fn_ciclo_id(current_date)), 0)
  as puntos_limpieza_totales
from usuario u
where u.rol = 'operario';

comment on view v_puntos_piezas_operario_total_vida is
  'Puntos de piezas de por vida (histórico cerrado + ciclo en vivo) '
  'para la tarjeta de Inicio — análoga a v_puntos_operario_total_vida '
  'pero solo de esta categoría.';
comment on view v_puntos_rendimiento_operario_total_vida is
  'Puntos de rendimiento de por vida — ver v_puntos_piezas_operario_total_vida.';
comment on view v_puntos_limpieza_operario_total_vida is
  'Puntos de limpieza de por vida — ver v_puntos_piezas_operario_total_vida.';
