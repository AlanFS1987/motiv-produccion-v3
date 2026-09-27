-- =============================================================
-- El jefe también debe poder pegar el CSV diario (hasta ahora solo
-- podía el administrador, porque admin_notas tiene RLS
-- admin_notas_admin_todo = solo 'administrador'). No se toca esa
-- RLS (sigue siendo el espacio de trabajo del admin para 'nota' y
-- para leer/gestionar todo) — se expone la escritura de
-- tipo='programacion' vía una función security definer, mismo
-- patrón que el resto de RPCs de este módulo.
-- =============================================================

create or replace function existe_csv_programacion(p_fecha date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if fn_rol_actual() not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  return exists (
    select 1 from admin_notas
    where tipo = 'programacion' and fecha = p_fecha
  );
end;
$$;

revoke execute on function existe_csv_programacion(date) from public, anon;
grant execute on function existe_csv_programacion(date) to authenticated;

comment on function existe_csv_programacion(date) is
  'Indica si ya hay un CSV de programación pegado para esa fecha. '
  'security definer (admin_notas es RLS-only-administrador) — la usa '
  'la pantalla Revisar del jefe para decidir si mostrar el textarea '
  'de pegar o el diff directamente.';

create or replace function guardar_programacion_csv(p_fecha date, p_contenido text)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_num_filas integer;
  v_existente_id uuid;
begin
  if fn_rol_actual() not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  if trim(p_contenido) = '' then
    raise exception 'El CSV está vacío';
  end if;

  v_num_filas := array_length(string_to_array(trim(p_contenido), E'\n'), 1);

  select id into v_existente_id
  from admin_notas
  where tipo = 'programacion' and fecha = p_fecha;

  if v_existente_id is not null then
    update admin_notas
    set contenido = p_contenido,
        num_filas = v_num_filas,
        creado_por = auth.uid(),
        updated_at = now()
    where id = v_existente_id;
  else
    insert into admin_notas (tipo, fecha, contenido, num_filas, creado_por)
    values ('programacion', p_fecha, p_contenido, v_num_filas, auth.uid());
  end if;
end;
$$;

revoke execute on function guardar_programacion_csv(date, text) from public, anon;
grant execute on function guardar_programacion_csv(date, text) to authenticated;

comment on function guardar_programacion_csv(date, text) is
  'Permite a jefe/administrador pegar el CSV diario de programación '
  '(security definer: admin_notas es RLS-only-administrador para '
  'acceso directo). Mismo comportamiento que guardarProgramacion en '
  'lib/admin-notas.ts: sobrescribe si ya existía fila para esa fecha.';
