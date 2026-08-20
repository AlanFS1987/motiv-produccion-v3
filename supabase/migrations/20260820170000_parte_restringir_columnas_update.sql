-- =============================================================
-- Trigger: restringe qué columnas de `parte` puede tocar cada
-- camino de UPDATE, más allá de la restricción por fila que ya
-- da RLS (07-pendientes.md #11, y el hueco anotado en
-- 20260819120000_rls_parte_operario_verificacion.sql).
-- =============================================================

create or replace function fn_parte_restringir_columnas_update()
returns trigger
language plpgsql
as $$
declare
  v_rol         rol_usuario := fn_rol_actual();
  v_permitidas  text[];
  v_no_permitida text;
begin
  -- Administrador: sin restricción, ya tiene su propia política ALL.
  if v_rol = 'administrador' then
    return new;
  end if;

  -- Camino operario: solo sus 5 columnas de verificación propia.
  if old.operario_id = auth.uid() and v_rol = 'operario' then
    v_permitidas := array[
      'verificacion_caja_estado_operario',
      'fotos_caja_operario',
      'verificacion_caja_detalle_operario',
      'verificacion_codbar_estado_operario',
      'verificacion_codbar_detalle_operario'
    ];

    select n.key into v_no_permitida
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key <> all (v_permitidas)
    limit 1;

    if v_no_permitida is not null then
      raise exception 'El operario solo puede modificar sus columnas de verificación (columna no permitida: %)', v_no_permitida;
    end if;

    return new;
  end if;

  -- Camino responsable en ventana de corrección (parte ya completado):
  -- no puede tocar completado / completado_at / vigente por esta vía.
  if old.responsable_id = auth.uid() and old.completado = true then
    if new.completado is distinct from old.completado
       or new.completado_at is distinct from old.completado_at
       or new.vigente is distinct from old.vigente
    then
      raise exception 'No se puede modificar completado/completado_at/vigente en la ventana de corrección de 1h — usa una corrección (INSERT con corrige_a_parte_id)';
    end if;
    return new;
  end if;

  -- Cualquier otro camino (ej. responsable editando parte pendiente,
  -- completado = false): sin restricción adicional, es el flujo normal.
  return new;
end;
$$;

drop trigger if exists trg_parte_restringir_columnas on parte;
create trigger trg_parte_restringir_columnas
before update on parte
for each row execute function fn_parte_restringir_columnas_update();