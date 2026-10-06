-- =============================================================
-- 0006 — Rotación de turnos (calculada) y ciclo de gamificación
-- Ref. spec: 04-rol-administrador.md 6.2, 05-modelo-de-datos.md 7.8,
--            03-rol-operario.md 5.8, 08-pendientes.md
--
-- Patrón fijo de 28 días por letra: 7 noches, 2 descanso, 7 tardes,
-- 2 descanso, 7 mañanas, 3 descanso. Las 4 letras (A/B/C/D) siguen
-- el mismo patrón, desfasadas 7 días entre sí. Arranca en el lunes
-- de `configuracion.fecha_inicio_rotacion` y se repite indefinidamente.
-- Nunca se pausa, ni siquiera durante el cierre anual de fábrica.
-- =============================================================

-- Devuelve 'M' / 'T' / 'N' / null (descanso) para una letra en una fecha.
create or replace function fn_turno_de_letra(p_fecha date, p_letra letra_turno)
returns tipo_turno
language plpgsql immutable as $$
declare
  v_inicio  date;
  v_offset  int;
  v_dia     int;
  v_patron  tipo_turno[] := array[
    'N','N','N','N','N','N','N',           -- días 0-6:   7 noches
    null,null,                              -- días 7-8:   2 descanso
    'T','T','T','T','T','T','T',           -- días 9-15:  7 tardes
    null,null,                              -- días 16-17: 2 descanso
    'M','M','M','M','M','M','M',           -- días 18-24: 7 mañanas
    null,null,null                          -- días 25-27: 3 descanso
  ];
begin
  select valor::date into v_inicio from configuracion where clave = 'fecha_inicio_rotacion';

  v_offset := case p_letra
    when 'A' then 0 when 'B' then 7 when 'C' then 14 when 'D' then 21
  end;

  -- módulo siempre positivo, aunque la fecha sea anterior al inicio
  v_dia := ((p_fecha - v_inicio - v_offset) % 28 + 28) % 28;

  return v_patron[v_dia + 1];
end;
$$;

-- Inversa: qué letra trabaja un tipo de turno concreto en una fecha
-- (útil para saber "quién puede abrir turno hoy").
create or replace function fn_letra_de_turno(p_fecha date, p_tipo tipo_turno)
returns letra_turno
language plpgsql stable as $$
declare
  v_letra letra_turno;
begin
  foreach v_letra in array array['A','B','C','D']::letra_turno[] loop
    if fn_turno_de_letra(p_fecha, v_letra) = p_tipo then
      return v_letra;
    end if;
  end loop;
  return null; -- no debería pasar: siempre hay alguien en cada turno
end;
$$;

-- Nº de ciclo de gamificación (28 días, misma fórmula de calendario
-- que la rotación, nunca se pausa — 03-rol-operario.md 5.8).
create or replace function fn_ciclo_id(p_fecha date)
returns int
language sql immutable as $$
  select floor(
    (p_fecha - (select valor::date from configuracion where clave = 'fecha_inicio_rotacion'))
    / 28.0
  )::int;
$$;

-- Rango de fechas [inicio, fin] de un ciclo dado, útil para acotar
-- las consultas del ciclo actual en vivo (07-arquitectura.md 9.3).
create type tabla_rango as (fecha_inicio date, fecha_fin date);

create or replace function fn_ciclo_rango(p_cycle_id int)
returns tabla_rango
language sql immutable as $$
  select
    (select valor::date from configuracion where clave = 'fecha_inicio_rotacion') + (p_cycle_id * 28) as fecha_inicio,
    (select valor::date from configuracion where clave = 'fecha_inicio_rotacion') + (p_cycle_id * 28) + 27 as fecha_fin;
$$;
