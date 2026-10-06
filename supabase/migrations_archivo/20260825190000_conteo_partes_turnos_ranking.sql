-- =============================================================
-- 25/08/2026 — Conteo de partes (operario) / turnos (responsable)
-- + puntos por unidad ("pts/p"), como en v2. Mismo patrón que todo
-- lo demás: columna congelada en el histórico + vista en vivo para
-- el ciclo actual, reutilizable también para cerrar-ciclo.
--
-- Para operario: "partes completados" — ya cuenta doble si un mismo
-- día trabaja 2 líneas (son 2 filas de `parte`, no 1), sin inventar
-- ningún contador nuevo aparte del que ya existe.
-- Para responsable: "turnos trabajados" — turno.abierto_por, LITERAL
-- (no partes: un turno de responsable puede tener varias líneas a la
-- vez y eso NO debe multiplicar el conteo).
-- =============================================================

alter table historial_ciclos
  add column if not exists partes_completados numeric not null default 0;

create or replace view v_partes_operario_ciclo as
select
  p.operario_id,
  fn_ciclo_id(t.fecha) as cycle_id,
  count(*)             as partes_completados
from parte p
join turno t on t.id = p.turno_id
where p.vigente = true and p.completado = true and p.operario_id is not null
group by p.operario_id, fn_ciclo_id(t.fecha);

comment on view v_partes_operario_ciclo is
  'Partes completados por operario+ciclo, para CUALQUIER cycle_id — '
  'base de "partes" en el Ranking y de partes_completados en '
  'historial_ciclos. Cuenta doble si el mismo día trabaja 2 líneas '
  '(son 2 filas de parte), a propósito.';

alter table historial_ciclo_responsable
  add column if not exists turnos_trabajados numeric not null default 0;

create or replace view v_turnos_responsable_ciclo as
select
  t.abierto_por as responsable_id,
  fn_ciclo_id(t.fecha) as cycle_id,
  count(*)             as turnos_trabajados
from turno t
where t.abierto_por is not null
group by t.abierto_por, fn_ciclo_id(t.fecha);

comment on view v_turnos_responsable_ciclo is
  'Turnos abiertos por responsable+ciclo (turno.abierto_por), para '
  'CUALQUIER cycle_id — literal, no partes (varias líneas en el '
  'mismo turno NO deben multiplicar el conteo). Base de "turnos" en '
  'el Ranking y de turnos_trabajados en historial_ciclo_responsable.';

-- -------------------------------------------------------------
-- fn_cerrar_ciclos_pendientes — se reemplaza entera para añadir
-- partes_completados (operario) y turnos_trabajados (responsable).
-- Todo lo demás es idéntico a la versión de 20260825140000.
-- -------------------------------------------------------------
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
    -- ---- OPERARIOS (+ partes_completados) ----
    insert into historial_ciclos (
      usuario_id, rol, cycle_id, fecha_cierre, puntos_ciclo, m2_total, piezas_total,
      tiempo_plena, tiempo_no_alimentada, tiempo_saturacion, tiempo_banco, tiempo_maquina,
      piezas_por_formato, m2_contenedor, m2_com, m2_std,
      partes_completados,
      fuerza, resistencia, velocidad,
      puntos_piezas, puntos_rendimiento, puntos_limpieza
    )
    select
      coalesce(prod.operario_id, pts.operario_id), 'operario', v_cycle_id, now(),
      coalesce(pts.puntos_ciclo, 0), coalesce(prod.m2_total, 0), coalesce(prod.piezas_total, 0),
      coalesce(prod.tiempo_plena, 0), coalesce(prod.tiempo_no_alimentada, 0), coalesce(prod.tiempo_saturacion, 0),
      coalesce(prod.tiempo_banco, 0), coalesce(prod.tiempo_maquina, 0),
      prod.piezas_por_formato, coalesce(prod.m2_contenedor, 0), coalesce(prod.m2_com, 0), coalesce(prod.m2_std, 0),
      coalesce(part.partes_completados, 0),
      round(coalesce(prod.m2_total, 0) / 1000.0, 2),
      round((coalesce(prod.tiempo_plena, 0) + coalesce(prod.tiempo_no_alimentada, 0)) / 100.0, 2),
      case when coalesce(prod.tiempo_plena, 0) > 0 then round(coalesce(prod.m2_total, 0) / prod.tiempo_plena, 4) else null end,
      pts.puntos_piezas, pts.puntos_rendimiento, pts.puntos_limpieza
    from v_produccion_operario_ciclo prod
    full outer join v_puntos_operario_ciclo pts
      on pts.operario_id = prod.operario_id and pts.cycle_id = prod.cycle_id
    left join v_partes_operario_ciclo part
      on part.operario_id = coalesce(prod.operario_id, pts.operario_id) and part.cycle_id = v_cycle_id
    where coalesce(prod.cycle_id, pts.cycle_id) = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      fecha_cierre = excluded.fecha_cierre, puntos_ciclo = excluded.puntos_ciclo,
      m2_total = excluded.m2_total, piezas_total = excluded.piezas_total,
      tiempo_plena = excluded.tiempo_plena, tiempo_no_alimentada = excluded.tiempo_no_alimentada,
      tiempo_saturacion = excluded.tiempo_saturacion, tiempo_banco = excluded.tiempo_banco,
      tiempo_maquina = excluded.tiempo_maquina, piezas_por_formato = excluded.piezas_por_formato,
      m2_contenedor = excluded.m2_contenedor, m2_com = excluded.m2_com, m2_std = excluded.m2_std,
      partes_completados = excluded.partes_completados,
      fuerza = excluded.fuerza, resistencia = excluded.resistencia, velocidad = excluded.velocidad,
      puntos_piezas = excluded.puntos_piezas, puntos_rendimiento = excluded.puntos_rendimiento,
      puntos_limpieza = excluded.puntos_limpieza;

    -- ---- RESPONSABLES (+ turnos_trabajados) ----
    insert into historial_ciclo_responsable (
      usuario_id, cycle_id, fecha_cierre, puntos_ciclo,
      m2_total, m2_contenedor, m2_com, m2_std,
      minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
      verificaciones_codbar, puntos_equipo_ciclo, operario_gano_ciclo,
      turnos_trabajados,
      fuerza, resistencia, velocidad
    )
    select
      pr.responsable_id, v_cycle_id, now(), coalesce(pr.puntos_ciclo, 0),
      coalesce(m.m2_total, 0), coalesce(m.m2_contenedor, 0), coalesce(m.m2_com, 0), coalesce(m.m2_std, 0),
      coalesce(tr.tiempo_plena, 0), coalesce(tr.minutos_no_alimentada, 0), coalesce(tr.minutos_saturacion, 0),
      coalesce(tr.minutos_banco, 0), coalesce(tr.minutos_maquina, 0),
      coalesce(vc.verificaciones_codbar, 0), coalesce(eq.puntos_equipo, 0), coalesce(eq.operario_gano_ciclo, false),
      coalesce(tu.turnos_trabajados, 0),
      round(coalesce(m.m2_total, 0) / 1000.0, 2),
      round(coalesce(tr.minutos_rendimiento, 0) / 100.0, 2),
      case when coalesce(tr.tiempo_plena, 0) > 0 then round(coalesce(m.m2_total, 0) / tr.tiempo_plena, 4) else null end
    from v_puntos_responsable_ciclo pr
    left join v_metros_responsable_ciclo m on m.responsable_id = pr.responsable_id and m.cycle_id = pr.cycle_id
    left join v_tiempo_responsable_ciclo tr on tr.responsable_id = pr.responsable_id and tr.cycle_id = pr.cycle_id
    left join v_verificaciones_codbar_responsable_ciclo vc on vc.responsable_id = pr.responsable_id and vc.cycle_id = pr.cycle_id
    left join v_puntos_equipo_responsable_ciclo eq on eq.responsable_id = pr.responsable_id and eq.cycle_id = pr.cycle_id
    left join v_turnos_responsable_ciclo tu on tu.responsable_id = pr.responsable_id and tu.cycle_id = pr.cycle_id
    where pr.cycle_id = v_cycle_id
    on conflict (usuario_id, cycle_id) do update set
      fecha_cierre = excluded.fecha_cierre, puntos_ciclo = excluded.puntos_ciclo,
      m2_total = excluded.m2_total, m2_contenedor = excluded.m2_contenedor,
      m2_com = excluded.m2_com, m2_std = excluded.m2_std,
      minutos_plena = excluded.minutos_plena, minutos_no_alimentada = excluded.minutos_no_alimentada,
      minutos_saturacion = excluded.minutos_saturacion, minutos_banco = excluded.minutos_banco,
      minutos_maquina = excluded.minutos_maquina, verificaciones_codbar = excluded.verificaciones_codbar,
      puntos_equipo_ciclo = excluded.puntos_equipo_ciclo, operario_gano_ciclo = excluded.operario_gano_ciclo,
      turnos_trabajados = excluded.turnos_trabajados,
      fuerza = excluded.fuerza, resistencia = excluded.resistencia, velocidad = excluded.velocidad;

    raise notice 'Ciclo % cerrado (operarios en historial_ciclos, responsables en historial_ciclo_responsable).', v_cycle_id;
  end loop;
end;
$$;
