-- =============================================================
-- 25/08/2026 — Los 4 últimos logros del responsable.
-- =============================================================

-- -------------------------------------------------------------
-- 1) El detallista — nueva columna + vista de apoyo para el ciclo en
--    vivo (mismo patrón que v_metros_responsable_ciclo /
--    v_tiempo_responsable_ciclo). Cuenta partes donde el responsable
--    dejó una verificación de código de barras REAL (no
--    'no_realizada', que es el estado explícito de "no se hizo").
-- -------------------------------------------------------------
alter table historial_ciclo_responsable
  add column if not exists verificaciones_codbar numeric not null default 0;

create or replace view v_verificaciones_codbar_responsable_ciclo as
select
  p.responsable_id,
  fn_ciclo_id(t.fecha) as cycle_id,
  count(*)             as verificaciones_codbar
from parte p
join turno t on t.id = p.turno_id
where p.vigente = true
  and p.verificacion_codbar_estado in ('completo', 'parcial', 'manual')
group by p.responsable_id, fn_ciclo_id(t.fecha);

comment on view v_verificaciones_codbar_responsable_ciclo is
  'Partes con verificación de código de barras REAL (completo/parcial/'
  'manual, no no_realizada) por responsable+ciclo. Base de "El '
  'detallista" y de la columna verificaciones_codbar de '
  'historial_ciclo_responsable.';

-- -------------------------------------------------------------
-- 2) Creador de Héroes / El Equipo A — NO por letra (cambia con el
--    tiempo, produciría atribuciones retroactivas incorrectas si
--    alguien cambia de letra) sino por quién trabajó de verdad con
--    quién: operarios que tuvieron al menos un parte con
--    responsable_id = este responsable en ese ciclo concreto
--    (parte.operario_id + parte.responsable_id, dato real de cada
--    turno, no una relación derivada que pueda desactualizarse).
--
--    Igual que el resto de columnas de historial_ciclo_responsable:
--    se CONGELAN al cerrar el ciclo (2 columnas nuevas), así que
--    mostrar los logros de un responsable nunca vuelve a tocar
--    `parte` — solo el ciclo en vivo (todavía sin cerrar) necesita
--    la vista, exactamente igual que m2_total/tiempos/etc.
-- -------------------------------------------------------------
alter table historial_ciclo_responsable
  add column if not exists puntos_equipo_ciclo numeric not null default 0,
  add column if not exists operario_gano_ciclo boolean not null default false;

comment on column historial_ciclo_responsable.puntos_equipo_ciclo is
  'Suma de puntos_ciclo de los operarios con los que este responsable '
  'trabajó de verdad ese ciclo (parte.responsable_id = él, '
  'parte.operario_id = ellos) — no por letra. Base de "El Equipo A".';
comment on column historial_ciclo_responsable.operario_gano_ciclo is
  'true si alguno de esos operarios ganó el ranking de ESE ciclo '
  '(v_ganador_por_ciclo, posicion=1). Base de "Creador de Héroes".';

-- Quiénes trabajaron de verdad con quién, por ciclo — un operario
-- puede aparecer bajo varios responsables en el mismo ciclo si hubo
-- cobertura entre letras; correcto, cada uno cuenta su propia parte.
create or replace view v_operarios_de_responsable_ciclo as
select distinct
  p.responsable_id,
  fn_ciclo_id(t.fecha) as cycle_id,
  p.operario_id
from parte p
join turno t on t.id = p.turno_id
where p.vigente = true and p.operario_id is not null;

comment on view v_operarios_de_responsable_ciclo is
  'Operarios que tuvieron al menos un parte con este responsable en '
  'ese ciclo — relación real de trabajo, no letra. Un operario puede '
  'aparecer bajo varios responsables en el mismo ciclo (cobertura).';

-- Resuelve puntos_equipo_ciclo/operario_gano_ciclo para CUALQUIER
-- ciclo (cerrado o vivo) — usada por fn_cerrar_ciclos_pendientes para
-- congelar, y por el motor de logros para el ciclo en vivo.
create or replace view v_puntos_equipo_responsable_ciclo as
select
  ore.responsable_id,
  ore.cycle_id,
  sum(coalesce(pts.puntos_ciclo, 0))     as puntos_equipo,
  bool_or(coalesce(gan.posicion, 0) = 1) as operario_gano_ciclo
from v_operarios_de_responsable_ciclo ore
left join v_puntos_operario_ciclo pts on pts.operario_id = ore.operario_id and pts.cycle_id = ore.cycle_id
left join v_ganador_por_ciclo gan on gan.operario_id = ore.operario_id and gan.cycle_id = ore.cycle_id
group by ore.responsable_id, ore.cycle_id;

comment on view v_puntos_equipo_responsable_ciclo is
  'Puntos sumados y si alguno ganó el ciclo, de los operarios reales '
  'de cada responsable, para CUALQUIER cycle_id (cerrado o vivo). '
  'Base de las columnas congeladas de arriba y del ciclo en vivo del '
  'motor de logros.';

-- -------------------------------------------------------------
-- 3) fn_cerrar_ciclos_pendientes — se reemplaza entera para añadir
--    verificaciones_codbar + puntos_equipo_ciclo + operario_gano_ciclo
--    al INSERT de responsable. El bloque de operario es idéntico al
--    de 20260825110000, sin cambios.
-- -------------------------------------------------------------
create or replace function fn_cerrar_ciclos_pendientes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id integer;
  v_ciclo_actual integer := fn_ciclo_id(now());
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
