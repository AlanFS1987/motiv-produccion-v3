-- =============================================================
-- Fix — fn_cerrar_ciclos_pendientes llamaba a fn_ciclo_id(now()),
-- pero fn_ciclo_id espera `date`, no `timestamptz`. Error real visto
-- al ejecutar la función tras 20260825140000:
--   ERROR: function fn_ciclo_id(timestamp with time zone) does not
--   exist
-- Se cambia now() por now()::date en la única línea que lo usa
-- (v_ciclo_actual). El resto de la función queda idéntico a
-- 20260825140000 — no se toca nada más.
-- =============================================================

create or replace function fn_cerrar_ciclos_pendientes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id integer;
  v_ciclo_actual integer := fn_ciclo_id(now()::date);
begin
  for v_cycle_id in
    select distinct cycle_id from v_puntos_operario_ciclo where cycle_id < v_ciclo_actual
    union
    select distinct cycle_id from v_puntos_responsable_ciclo where cycle_id < v_ciclo_actual
  loop
    -- ---- OPERARIOS (sin cambios) ----
    insert into historial_ciclos (
      usuario_id, rol, cycle_id, fecha_cierre, puntos_ciclo, m2_total, piezas_total,
      tiempo_plena, tiempo_no_alimentada, tiempo_saturacion, tiempo_banco, tiempo_maquina,
      piezas_por_formato, m2_contenedor, m2_com, m2_std,
      fuerza, resistencia, velocidad,
      puntos_piezas, puntos_rendimiento, puntos_limpieza
    )
    select
      coalesce(prod.operario_id, pts.operario_id), 'operario', v_cycle_id, now(),
      coalesce(pts.puntos_ciclo, 0), coalesce(prod.m2_total, 0), coalesce(prod.piezas_total, 0),
      coalesce(prod.tiempo_plena, 0), coalesce(prod.tiempo_no_alimentada, 0), coalesce(prod.tiempo_saturacion, 0),
      coalesce(prod.tiempo_banco, 0), coalesce(prod.tiempo_maquina, 0),
      prod.piezas_por_formato, coalesce(prod.m2_contenedor, 0), coalesce(prod.m2_com, 0), coalesce(prod.m2_std, 0),
      round(coalesce(prod.m2_total, 0) / 1000.0, 2),
      round((coalesce(prod.tiempo_plena, 0) + coalesce(prod.tiempo_no_alimentada, 0)) / 100.0, 2),
      case when coalesce(prod.tiempo_plena, 0) > 0 then round(coalesce(prod.m2_total, 0) / prod.tiempo_plena, 4) else null end,
      pts.puntos_piezas, pts.puntos_rendimiento, pts.puntos_limpieza
    from v_produccion_operario_ciclo prod
    full outer join v_puntos_operario_ciclo pts
      on pts.operario_id = prod.operario_id and pts.cycle_id = prod.cycle_id
    where coalesce(prod.cycle_id, pts.cycle_id) = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      fecha_cierre = excluded.fecha_cierre, puntos_ciclo = excluded.puntos_ciclo,
      m2_total = excluded.m2_total, piezas_total = excluded.piezas_total,
      tiempo_plena = excluded.tiempo_plena, tiempo_no_alimentada = excluded.tiempo_no_alimentada,
      tiempo_saturacion = excluded.tiempo_saturacion, tiempo_banco = excluded.tiempo_banco,
      tiempo_maquina = excluded.tiempo_maquina, piezas_por_formato = excluded.piezas_por_formato,
      m2_contenedor = excluded.m2_contenedor, m2_com = excluded.m2_com, m2_std = excluded.m2_std,
      fuerza = excluded.fuerza, resistencia = excluded.resistencia, velocidad = excluded.velocidad,
      puntos_piezas = excluded.puntos_piezas, puntos_rendimiento = excluded.puntos_rendimiento,
      puntos_limpieza = excluded.puntos_limpieza;

    -- ---- RESPONSABLES (+ verificaciones_codbar + equipo) ----
    insert into historial_ciclo_responsable (
      usuario_id, cycle_id, fecha_cierre, puntos_ciclo,
      m2_total, m2_contenedor, m2_com, m2_std,
      minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
      verificaciones_codbar, puntos_equipo_ciclo, operario_gano_ciclo,
      fuerza, resistencia, velocidad
    )
    select
      pr.responsable_id, v_cycle_id, now(), coalesce(pr.puntos_ciclo, 0),
      coalesce(m.m2_total, 0), coalesce(m.m2_contenedor, 0), coalesce(m.m2_com, 0), coalesce(m.m2_std, 0),
      coalesce(tr.tiempo_plena, 0), coalesce(tr.minutos_no_alimentada, 0), coalesce(tr.minutos_saturacion, 0),
      coalesce(tr.minutos_banco, 0), coalesce(tr.minutos_maquina, 0),
      coalesce(vc.verificaciones_codbar, 0), coalesce(eq.puntos_equipo, 0), coalesce(eq.operario_gano_ciclo, false),
      round(coalesce(m.m2_total, 0) / 1000.0, 2),
      round(coalesce(tr.minutos_rendimiento, 0) / 100.0, 2),
      case when coalesce(tr.tiempo_plena, 0) > 0 then round(coalesce(m.m2_total, 0) / tr.tiempo_plena, 4) else null end
    from v_puntos_responsable_ciclo pr
    left join v_metros_responsable_ciclo m on m.responsable_id = pr.responsable_id and m.cycle_id = pr.cycle_id
    left join v_tiempo_responsable_ciclo tr on tr.responsable_id = pr.responsable_id and tr.cycle_id = pr.cycle_id
    left join v_verificaciones_codbar_responsable_ciclo vc on vc.responsable_id = pr.responsable_id and vc.cycle_id = pr.cycle_id
    left join v_puntos_equipo_responsable_ciclo eq on eq.responsable_id = pr.responsable_id and eq.cycle_id = pr.cycle_id
    where pr.cycle_id = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      fecha_cierre = excluded.fecha_cierre, puntos_ciclo = excluded.puntos_ciclo,
      m2_total = excluded.m2_total, m2_contenedor = excluded.m2_contenedor,
      m2_com = excluded.m2_com, m2_std = excluded.m2_std,
      minutos_plena = excluded.minutos_plena, minutos_no_alimentada = excluded.minutos_no_alimentada,
      minutos_saturacion = excluded.minutos_saturacion, minutos_banco = excluded.minutos_banco,
      minutos_maquina = excluded.minutos_maquina, verificaciones_codbar = excluded.verificaciones_codbar,
      puntos_equipo_ciclo = excluded.puntos_equipo_ciclo, operario_gano_ciclo = excluded.operario_gano_ciclo,
      fuerza = excluded.fuerza, resistencia = excluded.resistencia, velocidad = excluded.velocidad;

    raise notice 'Ciclo % cerrado (operarios en historial_ciclos, responsables en historial_ciclo_responsable).', v_cycle_id;
  end loop;
end;
$$;
