-- =============================================================
-- Sesión 20/08/2026 — cuatro correcciones independientes,
-- agrupadas en una migración porque todas se decidieron en la
-- misma sesión de revisión de 07-pendientes.md.
-- =============================================================

-- -------------------------------------------------------------
-- A) puntos_rendimiento (OPERARIO) — tenía copiada por error la
-- escala del RESPONSABLE (10 tramos, máx 45 puntos). Se reemplaza
-- entera por la escala real (confirmada contra la tabla original de
-- v2, en minutos, convertida a % sobre el suelo de 480 min: 0-119min
-- → 1pt, 120-179 → 2pt, 180-239 → 5pt, 240-299 → 9pt, 300-359 → 12pt,
-- 360-480 → 15pt). De paso, tramos contiguos (sin huecos entre
-- pct_max de uno y pct_min del siguiente) — 07-pendientes.md #3.
-- -------------------------------------------------------------
delete from puntos_rendimiento;

insert into puntos_rendimiento (pct_min, pct_max, puntos) values
  (0.00, 24.99, 1),
  (25.00, 37.49, 2),
  (37.50, 49.99, 5),
  (50.00, 62.49, 9),
  (62.50, 74.99, 12),
  (75.00, 100.00, 15);

-- -------------------------------------------------------------
-- B) puntos_rendimiento_responsable — la escala en sí (10 tramos,
-- máx 45 puntos) SÍ es la correcta para el responsable (coherente
-- con el máximo de puntos_metros, también 45 — confirmado en
-- sesión). Solo se cierran los huecos entre tramos, sin tocar los
-- puntos de cada uno.
-- -------------------------------------------------------------
update puntos_rendimiento_responsable set pct_max = 20.82 where puntos = 2;
update puntos_rendimiento_responsable set pct_max = 29.16 where puntos = 5;
update puntos_rendimiento_responsable set pct_max = 37.49 where puntos = 8;
update puntos_rendimiento_responsable set pct_max = 45.82 where puntos = 12;
update puntos_rendimiento_responsable set pct_max = 58.32 where puntos = 16;
update puntos_rendimiento_responsable set pct_max = 66.66 where puntos = 21;
update puntos_rendimiento_responsable set pct_max = 74.99 where puntos = 26;
update puntos_rendimiento_responsable set pct_max = 83.32 where puntos = 32;
update puntos_rendimiento_responsable set pct_max = 91.66 where puntos = 38;
-- puntos = 45 (75.00–100.00, el último) no necesita cambio.

-- -------------------------------------------------------------
-- C) puntos_piezas — la tabla estaba VACÍA (el INSERT de siembra
-- nunca se llegó a aplicar, mismo patrón que pasó con
-- checklist_items). Se siembra con los datos reales de v2 (7
-- formatos × 5 tramos, confirmados por el usuario). De paso se
-- quita el tope superior del último tramo de cada formato
-- (07-pendientes.md #3): se permite `max` nulo (mismo patrón ya
-- usado en puntos_metros, donde m2_max nulo = "sin límite") y el
-- último tramo de cada formato se deja sin tope.
-- -------------------------------------------------------------
alter table puntos_piezas alter column max drop not null;

insert into puntos_piezas (formato, min, max, puntos) values
  ('200x1200', 6000, 7999, 2),
  ('200x1200', 8000, 9999, 5),
  ('200x1200', 10000, 11999, 9),
  ('200x1200', 12000, 13999, 12),
  ('200x1200', 14000, null, 15),

  ('300x1200', 4000, 5999, 2),
  ('300x1200', 6000, 7999, 5),
  ('300x1200', 8000, 9999, 9),
  ('300x1200', 10000, 11999, 12),
  ('300x1200', 12000, null, 15),

  ('600x1200', 2000, 2999, 2),
  ('600x1200', 3000, 3999, 5),
  ('600x1200', 4000, 4999, 9),
  ('600x1200', 5000, 5999, 12),
  ('600x1200', 6000, null, 15),

  ('1200x1200', 1000, 1249, 2),
  ('1200x1200', 1250, 1749, 5),
  ('1200x1200', 1750, 1999, 9),
  ('1200x1200', 2000, 2249, 12),
  ('1200x1200', 2250, null, 15),

  ('300x600', 10000, 13999, 2),
  ('300x600', 14000, 16999, 5),
  ('300x600', 17000, 19999, 9),
  ('300x600', 20000, 21999, 12),
  ('300x600', 22000, null, 15),

  ('600x600', 4000, 5999, 2),
  ('600x600', 6000, 7999, 5),
  ('600x600', 8000, 9999, 9),
  ('600x600', 10000, 11999, 12),
  ('600x600', 12000, null, 15),

  ('900x900', 1500, 2199, 2),
  ('900x900', 2200, 2999, 5),
  ('900x900', 3000, 3799, 9),
  ('900x900', 3800, 4499, 12),
  ('900x900', 4500, null, 15);

comment on column puntos_piezas.max is
  'NULL = sin límite superior (solo en el último tramo de cada '
  'formato) — mismo patrón que puntos_metros.m2_max. Cuando se '
  'construya la vista/consulta que use esta tabla, tratar NULL como '
  '"cualquier cantidad por encima de min cuenta para este tramo".';

-- -------------------------------------------------------------
-- D) Admin no puede corregir partes (07-pendientes.md #5): el
-- trigger que marca el original como no vigente al insertar una
-- corrección no era security definer, así que corría con los
-- permisos de quien insertaba — y ningún UPDATE existente en
-- `parte` permitía a un administrador tocar un parte que no fuera
-- suyo ni estuviera dentro de la ventana de 1h. Se hace el trigger
-- security definer (mismo patrón que fn_notificar_telegram) y se
-- añade una política explícita para el admin.
-- -------------------------------------------------------------
create or replace function fn_marcar_corregido_no_vigente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.corrige_a_parte_id is not null then
    update parte set vigente = false where id = new.corrige_a_parte_id;
  end if;
  return new;
end;
$$;

create policy parte_admin_todo on parte
  for all
  using (fn_rol_actual() = 'administrador')
  with check (fn_rol_actual() = 'administrador');

-- -------------------------------------------------------------
-- E) fn_turno_de_letra / fn_ciclo_id / fn_ciclo_rango marcadas
-- immutable pese a leer la tabla `configuracion` (07-pendientes.md
-- #6) — immutable promete a Postgres que el resultado nunca cambia
-- para los mismos argumentos, lo cual es falso si alguien cambia
-- `fecha_inicio_rotacion` en `configuracion`. Se corrige a `stable`
-- (mismo resultado dentro de una misma consulta, pero no se cachea
-- entre consultas distintas). No cambia ninguna lógica interna.
-- -------------------------------------------------------------
create or replace function fn_turno_de_letra(p_fecha date, p_letra letra_turno)
returns tipo_turno
language plpgsql stable as $$
declare
  v_inicio  date;
  v_offset  int;
  v_dia     int;
  v_patron  tipo_turno[] := array[
    'N','N','N','N','N','N','N',
    null,null,
    'T','T','T','T','T','T','T',
    null,null,
    'M','M','M','M','M','M','M',
    null,null,null
  ];
begin
  select valor::date into v_inicio from configuracion where clave = 'fecha_inicio_rotacion';

  v_offset := case p_letra
    when 'A' then 0 when 'B' then 7 when 'C' then 14 when 'D' then 21
  end;

  v_dia := ((p_fecha - v_inicio - v_offset) % 28 + 28) % 28;

  return v_patron[v_dia + 1];
end;
$$;

create or replace function fn_ciclo_id(p_fecha date)
returns int
language sql stable as $$
  select floor(
    (p_fecha - (select valor::date from configuracion where clave = 'fecha_inicio_rotacion'))
    / 28.0
  )::int;
$$;

create or replace function fn_ciclo_rango(p_cycle_id int)
returns tabla_rango
language sql stable as $$
  select
    (select valor::date from configuracion where clave = 'fecha_inicio_rotacion') + (p_cycle_id * 28) as fecha_inicio,
    (select valor::date from configuracion where clave = 'fecha_inicio_rotacion') + (p_cycle_id * 28) + 27 as fecha_fin;
$$;