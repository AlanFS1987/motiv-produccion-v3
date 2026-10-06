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
language sql
stable
as $$
  with lineas as (
    select p_fecha as fecha, line, ordinality
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
      sum(case when es_header then 1 else 0 end) over (order by ordinality) as horno
    from marcadas
  ),
  campos as (
    select
      horno, ordinality,
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
      row_number() over (partition by horno order by ordinality) as posicion
    from campos
    where numero_orden ~ '^[0-9]{6,8}$'
  )
  select
    horno::smallint,
    posicion::integer,
    numero_orden,
    modelo,
    nullif(replace(metros_raw, '.', ''), '')::numeric as metros,
    acabado,
    (cep_raw = 'X') as cep,
    nullif(caja, '') as caja
  from filtrado
  order by horno, posicion;
$$;

comment on function parse_programacion(date) is 'Parsea el CSV crudo de admin_notas (tipo=programacion) para una fecha dada, devolviendo las filas de pedido de los 4 hornos con sus 7 campos + posición.';

-- Nota de rescate (27/09/2026): esta es la PRIMERA versión de la
-- función, en SQL puro sin security definer. Queda reemplazada por
-- completo en 20260926183848_fix_parse_diff_programacion_plpgsql.sql
-- (el mismo día, pocas horas después) — se conserva aquí tal cual
-- porque así ocurrió de verdad el historial real en producción.
