-- =============================================================
-- Restringe, a nivel de columna, qué puede tocar el mecánico al
-- responder una incidencia de producción (S4, auditoría 27/09/2026).
--
-- Hoy `incidencia_produccion_update_mecanico` solo protege por FILA
-- (no puede reabrir una ya contestada: `respuesta_fecha is null` en
-- el USING) pero no restringe qué COLUMNAS puede cambiar dentro de
-- esa fila — un mecánico podría, además de responder, cambiar la
-- `descripcion` o las `fotos` originales de la incidencia (que no
-- son suyas), o incluso `turno_id`/`linea_id`.
--
-- Mismo patrón ya usado en el proyecto para el mismo tipo de
-- problema: fn_parte_restringir_columnas_update
-- (20260820170000_parte_restringir_columnas_update.sql) — diff
-- genérico OLD/NEW por jsonb, solo se permiten las columnas de la
-- lista blanca.
-- =============================================================

create or replace function fn_incidencia_produccion_restringir_columnas_update()
returns trigger
language plpgsql
as $$
declare
  v_permitidas   text[];
  v_no_permitida text;
begin
  -- Administrador: sin restricción (ya tiene su propio alcance total
  -- de gestión sobre esta tabla, igual que en el resto del proyecto).
  if fn_rol_actual() = 'administrador' then
    return new;
  end if;

  if fn_rol_actual() = 'mecanico' then
    v_permitidas := array[
      'respuesta_texto',
      'respuesta_fotos',
      'respuesta_sin_intervencion',
      'respuesta_mecanico_id',
      'respuesta_fecha'
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

drop trigger if exists trg_incidencia_produccion_restringir_columnas on incidencia_produccion;
create trigger trg_incidencia_produccion_restringir_columnas
before update on incidencia_produccion
for each row execute function fn_incidencia_produccion_restringir_columnas_update();

comment on function fn_incidencia_produccion_restringir_columnas_update() is
  'Restringe qué columnas puede tocar cada UPDATE en incidencia_'
  'produccion, más allá de la restricción por FILA que ya da RLS '
  '(incidencia_produccion_update_mecanico). El mecánico solo puede '
  'modificar sus 5 columnas de respuesta; el administrador, sin '
  'restricción. Mismo patrón que fn_parte_restringir_columnas_update.';
