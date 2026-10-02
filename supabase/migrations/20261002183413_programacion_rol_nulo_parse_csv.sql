-- (02/10/2026) Comprobación de rol a prueba de nulos en las tres RPC de
-- programación que faltaban (diff, confirmar y deshacer ya se arreglaron en
-- 20261002164859). Con fn_rol_actual() = NULL (sesión sin fila en `usuario`),
-- `NULL NOT IN (...)` es NULL y el `if ... then raise` no saltaba.
-- Solo cambia la guarda; el resto de cada función es idéntico al anterior.

-- parse_programacion (cuerpo de 20260927002941)
create or replace function parse_programacion(p_fecha date)
returns table (
  horno smallint,
  posicion integer,
  numero_orden text,
  modelo text,
  metros numeric,
  acabado text,
  cep boolean,
  caja text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  return query
  with lineas as (
    select line, ordinality
    from admin_notas,
         unnest(string_to_array(contenido, E'\n')) with ordinality as t(line, ordinality)
    where tipo = 'programacion' and fecha = p_fecha
  ),
  marcadas as (
    select *, (line ilike '%Nº ORDEN%' and line ilike '%MODELO%') as es_header
    from lineas
  ),
  con_horno as (
    select *,
      sum(case when es_header then 1 else 0 end) over (order by ordinality) as h
    from marcadas
  ),
  campos as (
    select
      h, ordinality,
      trim(split_part(line, ';', 2)) as numero_orden,
      trim(split_part(line, ';', 3)) as modelo,
      trim(split_part(line, ';', 4)) as metros_raw,
      trim(split_part(line, ';', 9)) as acabado,
      trim(split_part(line, ';', 11)) as cep_raw,
      trim(split_part(line, ';', 12)) as caja
    from con_horno
    where not es_header
  ),
  filtrado as (
    select *,
      row_number() over (partition by h order by ordinality) as pos
    from campos
    where numero_orden ~ '^[0-9]{6,8}$'
  )
  select
    f.h::smallint,
    f.pos::integer,
    f.numero_orden,
    f.modelo,
    nullif(replace(f.metros_raw, '.', ''), '')::numeric,
    f.acabado,
    (f.cep_raw = 'X'),
    nullif(f.caja, '')
  from filtrado f
  order by f.h, f.pos;
end;
$$;

revoke execute on function parse_programacion(date) from public, anon;
grant execute on function parse_programacion(date) to authenticated;

-- existe_csv_programacion (cuerpo de 20260927003941)
create or replace function existe_csv_programacion(p_fecha date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
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

-- guardar_programacion_csv (cuerpo de 20260927003941)
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
  if coalesce(fn_rol_actual()::text, '') not in ('jefe', 'administrador') then
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

-- Nota de rescate: sustituye a parse_programacion (20260927002941),
-- existe_csv_programacion y guardar_programacion_csv (20260927003941).
