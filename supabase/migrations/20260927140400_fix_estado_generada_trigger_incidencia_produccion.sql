-- =============================================================
-- Fix inmediato de la migración anterior
-- (20260927140200_restringe_columnas_update_incidencia_produccion_
-- mecanico.sql): a `estado` (columna `generated always`, calculada
-- a partir de `respuesta_fecha` — 'pendiente' si es null,
-- 'contestada' si no) le faltaba estar en la lista de columnas
-- permitidas para el mecánico.
--
-- Como respuesta_fecha SÍ está permitida, y cambiarla hace que
-- `estado` cambie de valor automáticamente (efecto colateral
-- obligatorio, nadie puede fijar `estado` a mano — Postgres lo
-- rechazaría de raíz por ser generated always), el trigger
-- confundía ese cambio automático con un intento de tocar una
-- columna prohibida, y rechazaba la respuesta entera con un error
-- 400. Detectado en pruebas reales tras aplicar la migración
-- anterior: el mecánico no podía responder ninguna incidencia.
--
-- Añadir `estado` a la lista blanca no abre ningún permiso nuevo —
-- sigue siendo imposible escribirla directamente, es solo dejar de
-- bloquear su cambio automático.
-- =============================================================

create or replace function fn_incidencia_produccion_restringir_columnas_update()
returns trigger
language plpgsql
as $$
declare
  v_permitidas   text[];
  v_no_permitida text;
begin
  if fn_rol_actual() = 'administrador' then
    return new;
  end if;

  if fn_rol_actual() = 'mecanico' then
    v_permitidas := array[
      'respuesta_texto',
      'respuesta_fotos',
      'respuesta_sin_intervencion',
      'respuesta_mecanico_id',
      'respuesta_fecha',
      'estado'  -- generated always a partir de respuesta_fecha; cambia sola, nunca se escribe a mano
    ];

    select n.key into v_no_permitida
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key <> all (v_permitidas)
    limit 1;

    if v_no_permitida is not null then
      raise exception 'El mecánico solo puede modificar los campos de respuesta (columna no permitida: %)', v_no_permitida;
    end if;
  end if;

  return new;
end;
$$;
