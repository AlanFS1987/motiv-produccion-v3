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
  if fn_rol_actual() not in ('jefe', 'administrador') then
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

create or replace function diff_programacion(p_fecha date)
returns table (
  cambio text,
  horno smallint,
  numero_orden text,
  modelo text,
  metros numeric,
  acabado text,
  cep boolean,
  caja text,
  posicion_actual integer,
  posicion_nueva integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if fn_rol_actual() not in ('jefe', 'administrador') then
    raise exception 'No autorizado';
  end if;

  return query
  with nuevo as (
    select * from parse_programacion(p_fecha)
  ),
  actual as (
    select po.horno, po.numero_orden, po.modelo, po.metros, po.acabado, po.cep, po.caja, po.posicion
    from programacion_orden po
  )
  select
    case
      when a.numero_orden is null then 'nuevo'
      when n.numero_orden is null then 'eliminado'
      when a.posicion is distinct from n.posicion then 'reordenado'
      else 'sin_cambios'
    end as cambio,
    coalesce(n.horno, a.horno) as horno,
    coalesce(n.numero_orden, a.numero_orden) as numero_orden,
    coalesce(n.modelo, a.modelo) as modelo,
    coalesce(n.metros, a.metros) as metros,
    coalesce(n.acabado, a.acabado) as acabado,
    coalesce(n.cep, a.cep) as cep,
    coalesce(n.caja, a.caja) as caja,
    a.posicion as posicion_actual,
    n.posicion as posicion_nueva
  from nuevo n
  full outer join actual a
    on a.horno = n.horno and a.numero_orden = n.numero_orden
  order by
    coalesce(n.horno, a.horno),
    coalesce(n.posicion, a.posicion);
end;
$$;

revoke execute on function diff_programacion(date) from public, anon;
grant execute on function diff_programacion(date) to authenticated;
